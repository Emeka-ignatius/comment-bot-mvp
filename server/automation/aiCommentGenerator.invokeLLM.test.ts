/**
 * Test AI Comment Generation with invokeLLM
 */

import { describe, it, expect } from 'vitest';
import { generateAIComment } from './aiCommentGenerator';

describe('AI Comment Generation with invokeLLM', () => {
  it('should generate a comment without vision', async () => {
    const result = await generateAIComment({
      audioTranscript: 'The streamer is talking about their favorite game',
      platform: 'rumble',
      style: 'engaging',
      maxLength: 150,
      includeEmojis: true,
    });

    expect(result).toBeDefined();
    expect(result.comment).toBeTruthy();
    expect(typeof result.comment).toBe('string');
    expect(result.comment.length).toBeLessThanOrEqual(150);
    expect(result.confidence).toBeGreaterThanOrEqual(0);
    expect(result.confidence).toBeLessThanOrEqual(1);
    expect(result.reasoning).toBeTruthy();
    
    console.log('Generated comment:', result.comment);
    console.log('Confidence:', result.confidence);
    console.log('Reasoning:', result.reasoning);
  }, 30000); // 30 second timeout for API call

  it('should generate a comment with vision (screenshot)', async () => {
    // Create a simple 1x1 red pixel PNG as base64
    const redPixelBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==';
    
    const result = await generateAIComment({
      screenImageBase64: redPixelBase64,
      screenDescription: 'A gaming stream showing a red screen',
      platform: 'rumble',
      style: 'engaging',
      maxLength: 150,
      includeEmojis: true,
    });

    expect(result).toBeDefined();
    expect(result.comment).toBeTruthy();
    expect(typeof result.comment).toBe('string');
    expect(result.comment.length).toBeLessThanOrEqual(150);
    expect(result.confidence).toBeGreaterThanOrEqual(0);
    expect(result.confidence).toBeLessThanOrEqual(1);
    expect(result.reasoning).toBeTruthy();
    
    console.log('Generated comment with vision:', result.comment);
    console.log('Confidence:', result.confidence);
    console.log('Reasoning:', result.reasoning);
  }, 30000); // 30 second timeout for API call
});
