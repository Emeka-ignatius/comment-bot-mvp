import { describe, it, expect, vi } from 'vitest';
import {
  extractKeyPhrases,
  summarizeTranscript,
  buildAudioVisualContext,
  detectCallToAction,
  getCacheStats,
  clearOldCacheEntries,
} from './audioTranscriber';

describe('Audio Transcriber', () => {
  describe('extractKeyPhrases', () => {
    it('should extract key phrases from transcript', () => {
      const transcript = 'Hello everyone. Welcome to the stream. Say hi if you can hear me.';
      const phrases = extractKeyPhrases(transcript);
      
      expect(phrases.length).toBeGreaterThan(0);
      expect(phrases[phrases.length - 1]).toContain('Say hi');
    });
    
    it('should handle empty transcript', () => {
      const phrases = extractKeyPhrases('');
      expect(phrases).toEqual([]);
    });
    
    it('should return last 3 sentences', () => {
      const transcript = 'First. Second. Third. Fourth. Fifth.';
      const phrases = extractKeyPhrases(transcript);
      
      expect(phrases.length).toBeLessThanOrEqual(3);
    });
  });
  
  describe('summarizeTranscript', () => {
    it('should return short transcript as-is', () => {
      const transcript = 'Hello world';
      const summary = summarizeTranscript(transcript, 100);
      
      expect(summary).toBe(transcript);
    });
    
    it('should truncate long transcript', () => {
      const transcript = 'a'.repeat(1000);
      const summary = summarizeTranscript(transcript, 500);
      
      expect(summary.length).toBeLessThanOrEqual(500);
    });
    
    it('should handle empty transcript', () => {
      const summary = summarizeTranscript('', 100);
      expect(summary).toBe('');
    });
  });
  
  describe('buildAudioVisualContext', () => {
    it('should build context with audio and visual', () => {
      const context = buildAudioVisualContext(
        'The streamer said something',
        'Chat is active with viewers',
        ['Great stream!', 'Love it!']
      );
      
      expect(context).toContain('streamer said');
      expect(context).toContain('Chat is active');
      expect(context).toContain('Great stream');
    });
    
    it('should handle missing audio', () => {
      const context = buildAudioVisualContext(
        undefined,
        'Chat is active',
        []
      );
      
      expect(context).toContain('Chat is active');
      expect(context).not.toContain('streamer said');
    });
    
    it('should handle missing visual', () => {
      const context = buildAudioVisualContext(
        'The streamer said something',
        undefined,
        []
      );
      
      expect(context).toContain('streamer said');
      expect(context).not.toContain('Chat is active');
    });
  });
  
  describe('detectCallToAction', () => {
    it('should detect "say X if" pattern', () => {
      const cta = detectCallToAction('Say hi if you can hear me');
      expect(cta).toBeTruthy();
      expect(cta).toContain('Say');
    });
    
    it('should detect "who" questions', () => {
      const cta = detectCallToAction('Who is watching live?');
      expect(cta).toBeTruthy();
    });
    
    it('should detect "what" questions', () => {
      const cta = detectCallToAction('What do you think about this?');
      expect(cta).toBeTruthy();
    });
    
    it('should detect "comment below" pattern', () => {
      const cta = detectCallToAction('Comment below what you think');
      expect(cta).toBeTruthy();
    });
    
    it('should return null for no call-to-action', () => {
      const cta = detectCallToAction('Just talking about the weather');
      expect(cta).toBeNull();
    });
    
    it('should handle empty transcript', () => {
      const cta = detectCallToAction('');
      expect(cta).toBeNull();
    });
  });
  
  describe('Cache management', () => {
    it('should report cache stats', () => {
      const stats = getCacheStats();
      
      expect(stats).toHaveProperty('size');
      expect(stats).toHaveProperty('entries');
      expect(Array.isArray(stats.entries)).toBe(true);
    });
    
    it('should clear old cache entries', () => {
      const cleared = clearOldCacheEntries();
      
      expect(typeof cleared).toBe('number');
      expect(cleared).toBeGreaterThanOrEqual(0);
    });
  });
});
