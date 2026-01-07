/**
 * Audio Capture Service
 * 
 * Captures audio from live stream pages using Playwright
 * Uploads to S3 for transcription
 */

import { Page } from 'playwright';
import { storagePut } from '../storage';
import { exec } from 'child_process';
import { promisify } from 'util';
import { writeFileSync, unlinkSync, existsSync } from 'fs';
import { join } from 'path';

const execAsync = promisify(exec);

export interface AudioCaptureConfig {
  page: Page;
  duration: number;        // How long to capture (in seconds)
  streamUrl: string;       // The stream URL for direct audio extraction
}

export interface AudioCaptureResult {
  audioUrl: string;        // S3 URL for the captured audio
  duration: number;        // Actual duration captured
  fileSize: number;        // Size in bytes
  transcript?: string;     // Optional: transcribed text
}

/**
 * Capture audio from a live stream using ffmpeg
 * 
 * This extracts audio directly from the stream URL
 * Works for both Rumble and YouTube streams
 */
export async function captureStreamAudio(config: AudioCaptureConfig): Promise<AudioCaptureResult> {
  const { duration, streamUrl } = config;
  
  try {
    console.log(`[AudioCapture] Starting audio capture from ${streamUrl} for ${duration}s`);
    
    const audioPath = join('/tmp', `audio_${Date.now()}.mp3`);
    
    // Use ffmpeg to extract audio from the stream
    // This works by downloading the stream and extracting just the audio
    const ffmpegCmd = `ffmpeg -i "${streamUrl}" -f mp3 -t ${duration} -q:a 9 -n "${audioPath}" 2>&1`;
    
    console.log(`[AudioCapture] Running: ${ffmpegCmd}`);
    
    try {
      const { stdout, stderr } = await execAsync(ffmpegCmd, { timeout: (duration + 30) * 1000 });
      console.log(`[AudioCapture] FFmpeg output:`, stdout || stderr);
    } catch (error: any) {
      // FFmpeg might exit with non-zero even on success, check if file was created
      if (!existsSync(audioPath)) {
        console.error(`[AudioCapture] FFmpeg failed and no audio file created:`, error.message);
        throw new Error(`Failed to capture audio: ${error.message}`);
      }
      console.log(`[AudioCapture] FFmpeg completed with file created`);
    }
    
    // Read the audio file
    const fs = await import('fs').then(m => m.promises);
    const audioBuffer = await fs.readFile(audioPath);
    
    console.log(`[AudioCapture] Audio file size: ${audioBuffer.length} bytes`);
    
    if (audioBuffer.length < 1000) {
      console.warn(`[AudioCapture] Audio file is very small, capture may have failed`);
    }
    
    // Upload to S3
    const fileKey = `audio-captures/${Date.now()}-stream-audio.mp3`;
    const { url } = await storagePut(fileKey, audioBuffer, 'audio/mpeg');
    
    console.log(`[AudioCapture] Audio uploaded to S3: ${url}`);
    
    // Clean up local file
    try {
      unlinkSync(audioPath);
    } catch (e) {
      console.warn(`[AudioCapture] Could not delete local file: ${e}`);
    }
    
    return {
      audioUrl: url,
      duration,
      fileSize: audioBuffer.length,
    };
    
  } catch (error) {
    console.error(`[AudioCapture] Failed to capture audio:`, error);
    throw error;
  }
}

/**
 * Capture audio using page context recording
 * 
 * This method attempts to record audio from the browser page itself
 * Useful for capturing streamer's voice if available in the page
 */
export async function capturePageContextAudio(config: AudioCaptureConfig): Promise<AudioCaptureResult> {
  const { page, duration } = config;
  
  try {
    console.log(`[AudioCapture] Starting page context audio capture for ${duration}s`);
    
    // Inject script to capture audio from the page
    const audioData = await page.evaluate(async (captureDuration: number) => {
      return new Promise<{ chunks: string; duration: number }>((resolve) => {
        try {
          // Create audio context
          const AudioContext = (window as any).AudioContext || (window as any).webkitAudioContext;
          const audioContext = AudioContext ? new AudioContext() : null;
          
          if (!audioContext) {
            console.log('[AudioCapture] AudioContext not available');
            resolve({ chunks: '', duration: captureDuration });
            return;
          }
          
          // Create destination
          const destination = audioContext.createMediaStreamDestination();
          
          // Try to connect to any audio/video elements
          const mediaElements = Array.from(document.querySelectorAll('audio, video')) as HTMLMediaElement[];
          let connected = false;
          
          for (const element of mediaElements) {
            try {
              const source = audioContext.createMediaElementAudioSource(element);
              source.connect(destination);
              connected = true;
              console.log('[AudioCapture] Connected to media element');
              break;
            } catch (e) {
              // Element might not have audio
            }
          }
          
          if (!connected) {
            console.log('[AudioCapture] Could not connect to any media elements');
            resolve({ chunks: '', duration: captureDuration });
            return;
          }
          
          // Create recorder
          const mediaRecorder = new (window as any).MediaRecorder(destination.stream);
          const chunks: Blob[] = [];
          
          mediaRecorder.ondataavailable = (event: any) => {
            chunks.push(event.data);
          };
          
          mediaRecorder.onstop = () => {
            const blob = new Blob(chunks, { type: 'audio/webm' });
            const reader = new FileReader();
            reader.onload = () => {
              const arrayBuffer = reader.result as ArrayBuffer;
              const view = new Uint8Array(arrayBuffer);
              const binary = String.fromCharCode.apply(null, Array.from(view));
              const base64 = btoa(binary);
              resolve({ chunks: base64, duration: captureDuration });
            };
            reader.readAsArrayBuffer(blob);
          };
          
          mediaRecorder.start();
          
          // Stop after duration
          setTimeout(() => {
            mediaRecorder.stop();
          }, captureDuration * 1000);
          
        } catch (error) {
          console.log('[AudioCapture] Error in page context:', error);
          resolve({ chunks: '', duration: captureDuration });
        }
      });
    }, duration);
    
    if (!audioData.chunks) {
      console.warn(`[AudioCapture] No audio data captured from page context`);
      // Return a minimal audio file
      const minimalAudio = Buffer.from([0x52, 0x49, 0x46, 0x46]); // RIFF header
      const fileKey = `audio-captures/${Date.now()}-empty.webm`;
      const { url } = await storagePut(fileKey, minimalAudio, 'audio/webm');
      
      return {
        audioUrl: url,
        duration,
        fileSize: minimalAudio.length,
      };
    }
    
    // Convert base64 to buffer
    const audioBuffer = Buffer.from(audioData.chunks, 'base64');
    
    console.log(`[AudioCapture] Audio captured from page context: ${audioBuffer.length} bytes`);
    
    // Upload to S3
    const fileKey = `audio-captures/${Date.now()}-page-audio.webm`;
    const { url } = await storagePut(fileKey, audioBuffer, 'audio/webm');
    
    console.log(`[AudioCapture] Audio uploaded to S3: ${url}`);
    
    return {
      audioUrl: url,
      duration,
      fileSize: audioBuffer.length,
    };
    
  } catch (error) {
    console.error(`[AudioCapture] Failed to capture page audio:`, error);
    throw error;
  }
}

/**
 * Test if ffmpeg is available
 */
export async function checkFFmpegAvailable(): Promise<boolean> {
  try {
    await execAsync('ffmpeg -version', { timeout: 5000 });
    return true;
  } catch (error) {
    console.warn(`[AudioCapture] FFmpeg not available:`, error);
    return false;
  }
}
