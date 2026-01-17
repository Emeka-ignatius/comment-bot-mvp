/**
 * Audio Transcription Integration Service
 * 
 * Handles transcription of captured audio using OpenAI Whisper
 * Caches recent transcripts to avoid re-transcribing the same audio
 */

import { createHash } from 'node:crypto';
import { transcribeAudioBytes } from '../_core/voiceTranscription';

export interface TranscriptionCache {
  key: string;
  transcript: string;
  timestamp: Date;
  duration: number;
}

// Cache recent transcriptions to avoid re-processing
const transcriptionCache = new Map<string, TranscriptionCache>();

// Keep cache for 5 minutes
const CACHE_TTL = 5 * 60 * 1000;

/**
 * Transcribe audio from a stream
 * 
 * Uses OpenAI Whisper (`whisper-1`) for transcription (no external storage needed)
 * Caches results to avoid redundant API calls
 */
export async function transcribeStreamAudio(
  input: { audioBuffer: Buffer; mimeType: string; filename?: string },
  options?: { language?: string; prompt?: string }
): Promise<{ text: string; segments?: any[] } | null> {
  try {
    const key = createHash('sha1')
      .update(input.audioBuffer)
      .digest('hex')
      .slice(0, 24);

    console.log(
      `[AudioTranscriber] Starting transcription (bytes, ${input.mimeType}, ${input.audioBuffer.length} bytes, key=${key})`
    );
    
    // Check cache first
    const cached = transcriptionCache.get(key);
    if (cached && Date.now() - cached.timestamp.getTime() < CACHE_TTL) {
      console.log(`[AudioTranscriber] Using cached transcript for key=${key}`);
      return {
        text: cached.transcript,
        segments: [],
      };
    }
    
    const result = await transcribeAudioBytes({
      audioBuffer: input.audioBuffer,
      mimeType: input.mimeType,
      filename: input.filename,
      language: options?.language || 'en',
      prompt: options?.prompt || "Transcribe the streamer's voice and any clearly audible speech",
    });
    
    // Check for error response
    if ('error' in result) {
      console.error(`[AudioTranscriber] Transcription error:`, result);
      return null;
    }
    
    // Cache the result
    transcriptionCache.set(key, {
      key,
      transcript: result.text,
      timestamp: new Date(),
      duration: result.duration,
    });
    
    console.log(`[AudioTranscriber] Transcription complete: ${result.text.slice(0, 100)}...`);
    
    return {
      text: result.text,
      segments: result.segments,
    };
    
  } catch (error) {
    console.error(`[AudioTranscriber] Failed to transcribe audio:`, error);
    return null;
  }
}

/**
 * Extract key phrases from a transcript
 * 
 * Identifies important parts of the transcript that should influence comment generation
 */
export function extractKeyPhrases(transcript: string): string[] {
  if (!transcript || transcript.length === 0) {
    return [];
  }
  
  // Split into sentences
  const sentences = transcript
    .split(/[.!?]+/)
    .map(s => s.trim())
    .filter(s => s.length > 0);
  
  // Return the most recent sentences (last 3)
  return sentences.slice(-3);
}

/**
 * Summarize a transcript for AI context
 * 
 * Creates a concise summary of what was said
 */
export function summarizeTranscript(transcript: string, maxLength: number = 500): string {
  if (!transcript || transcript.length === 0) {
    return '';
  }
  
  // If transcript is already short, return as-is
  if (transcript.length <= maxLength) {
    return transcript;
  }
  
  // Otherwise, take the most recent part
  return transcript.slice(-maxLength);
}

/**
 * Combine audio transcript with visual context
 * 
 * Creates a rich context for AI comment generation
 */
export function buildAudioVisualContext(
  audioTranscript: string | undefined,
  screenDescription: string | undefined,
  previousComments: string[] = []
): string {
  let context = '';
  
  if (audioTranscript) {
    context += `**What the streamer said**: "${audioTranscript}"\n\n`;
  }
  
  if (screenDescription) {
    context += `**What's on screen**: ${screenDescription}\n\n`;
  }
  
  if (previousComments.length > 0) {
    context += `**Context from chat**: Recent comments include: ${previousComments.slice(-2).join(', ')}\n\n`;
  }
  
  return context;
}

/**
 * Detect if transcript contains a direct question or call-to-action
 * 
 * Helps AI generate more responsive comments
 */
export function detectCallToAction(transcript: string): string | null {
  if (!transcript) {
    return null;
  }
  
  // Look for common patterns
  const patterns = [
    /say\s+["']?([^"']+)["']?\s+if\s+/i,           // "Say X if..."
    /who\s+(?:can|could|is|are)/i,                 // "Who can/is..."
    /what\s+(?:do|does|is|are|you|everyone)/i,    // "What do/is..."
    /where\s+(?:are|is|you|everyone)/i,           // "Where are/is..."
    /comment\s+(?:below|down|here)/i,             // "Comment below"
    /let\s+me\s+(?:know|hear)/i,                  // "Let me know"
    /(?:tell|show)\s+me\s+(?:your|what)/i,       // "Tell me your..."
  ];
  
  for (const pattern of patterns) {
    const match = transcript.match(pattern);
    if (match) {
      console.log(`[AudioTranscriber] Detected call-to-action: ${match[0]}`);
      return match[0];
    }
  }
  
  return null;
}

/**
 * Clear old cache entries
 * 
 * Should be called periodically to prevent memory leaks
 */
export function clearOldCacheEntries(): number {
  let cleared = 0;
  const now = Date.now();
  const keysToDelete: string[] = [];
  
  transcriptionCache.forEach((entry, key) => {
    if (now - entry.timestamp.getTime() > CACHE_TTL) {
      keysToDelete.push(key);
    }
  });
  
  keysToDelete.forEach(key => {
    transcriptionCache.delete(key);
    cleared++;
  });
  
  if (cleared > 0) {
    console.log(`[AudioTranscriber] Cleared ${cleared} old cache entries`);
  }
  
  return cleared;
}

/**
 * Get cache statistics
 */
export function getCacheStats(): { size: number; entries: string[] } {
  return {
    size: transcriptionCache.size,
    entries: Array.from(transcriptionCache).map(([key]) => key),
  };
}
