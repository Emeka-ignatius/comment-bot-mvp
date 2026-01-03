/**
 * AI Comment Generator Service
 * 
 * Uses GPT-4o to generate contextual comments based on:
 * - Audio transcription from the stream
 * - Screen capture/visual analysis
 * - Comment style preferences
 */

import { ENV } from "../_core/env";

export type CommentStyle = 
  | 'engaging'      // Questions, reactions, enthusiasm
  | 'supportive'    // Positive, encouraging comments
  | 'curious'       // Asking questions about the content
  | 'casual'        // Relaxed, conversational tone
  | 'professional'; // Formal, informative comments

export interface GenerateCommentParams {
  // Context from the stream
  audioTranscript?: string;        // What was said recently
  screenDescription?: string;      // What's visible on screen
  screenImageBase64?: string;      // Base64 encoded screenshot for vision
  
  // Stream metadata
  streamTitle?: string;
  streamerName?: string;
  platform: 'youtube' | 'rumble';
  
  // Comment preferences
  style?: CommentStyle;
  maxLength?: number;              // Max characters for comment
  avoidTopics?: string[];          // Topics to avoid mentioning
  includeEmojis?: boolean;
  
  // Previous comments to avoid repetition
  previousComments?: string[];
}

export interface GeneratedComment {
  comment: string;
  confidence: number;              // 0-1 how confident the AI is
  reasoning?: string;              // Why this comment was generated
}

/**
 * Generate a contextual comment using GPT-4o
 */
export async function generateAIComment(params: GenerateCommentParams): Promise<GeneratedComment> {
  const apiKey = ENV.openaiApiKey;
  const baseUrl = ENV.openaiBaseUrl;
  
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured");
  }
  
  const {
    audioTranscript,
    screenDescription,
    screenImageBase64,
    streamTitle,
    streamerName,
    platform,
    style = 'engaging',
    maxLength = 200,
    avoidTopics = [],
    includeEmojis = true,
    previousComments = [],
  } = params;
  
  // Build the system prompt
  const systemPrompt = buildSystemPrompt({
    style,
    maxLength,
    avoidTopics,
    includeEmojis,
    platform,
    streamerName,
  });
  
  // Build the user message with context
  const userMessage = buildUserMessage({
    audioTranscript,
    screenDescription,
    streamTitle,
    previousComments,
  });
  
  // Build messages array
  const messages: any[] = [
    { role: "system", content: systemPrompt },
  ];
  
  // If we have a screenshot, use vision
  if (screenImageBase64) {
    messages.push({
      role: "user",
      content: [
        { type: "text", text: userMessage },
        {
          type: "image_url",
          image_url: {
            url: `data:image/jpeg;base64,${screenImageBase64}`,
            detail: "low", // Use low detail for faster processing
          },
        },
      ],
    });
  } else {
    messages.push({ role: "user", content: userMessage });
  }
  
  // Call GPT-4o
  const response = await fetch(`${baseUrl}/v1/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: screenImageBase64 ? "gpt-4o" : "gpt-4o-mini", // Use full 4o for vision
      messages,
      max_tokens: 300,
      temperature: 0.8, // Some creativity
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "comment_response",
          strict: true,
          schema: {
            type: "object",
            properties: {
              comment: { 
                type: "string", 
                description: "The generated comment to post" 
              },
              confidence: { 
                type: "number", 
                description: "Confidence score from 0 to 1" 
              },
              reasoning: { 
                type: "string", 
                description: "Brief explanation of why this comment fits" 
              },
            },
            required: ["comment", "confidence", "reasoning"],
            additionalProperties: false,
          },
        },
      },
    }),
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI API error: ${response.status} - ${errorText}`);
  }
  
  const result = await response.json();
  const content = result.choices[0]?.message?.content;
  
  if (!content) {
    throw new Error("No response from OpenAI");
  }
  
  try {
    const parsed = JSON.parse(content);
    return {
      comment: parsed.comment,
      confidence: parsed.confidence,
      reasoning: parsed.reasoning,
    };
  } catch (e) {
    // Fallback if JSON parsing fails
    return {
      comment: content.slice(0, maxLength),
      confidence: 0.5,
      reasoning: "Fallback parsing",
    };
  }
}

function buildSystemPrompt(params: {
  style: CommentStyle;
  maxLength: number;
  avoidTopics: string[];
  includeEmojis: boolean;
  platform: string;
  streamerName?: string;
}): string {
  const { style, maxLength, avoidTopics, includeEmojis, platform, streamerName } = params;
  
  const styleGuides: Record<CommentStyle, string> = {
    engaging: "Be enthusiastic and engaging. Ask questions, react to content, show genuine interest.",
    supportive: "Be positive and encouraging. Support the streamer and community.",
    curious: "Ask thoughtful questions about what's happening. Show genuine curiosity.",
    casual: "Be relaxed and conversational. Like chatting with friends.",
    professional: "Be informative and respectful. Add value to the discussion.",
  };
  
  let prompt = `You are a live stream viewer generating authentic chat comments for ${platform}.

STYLE: ${styleGuides[style]}

RULES:
- Keep comments under ${maxLength} characters
- Sound like a real viewer, not a bot
- Be relevant to what's happening in the stream
- Don't be repetitive or generic
- ${includeEmojis ? "Use emojis naturally but don't overdo it" : "Don't use emojis"}
- Never mention you're an AI or automated
- Don't be overly promotional or spammy`;

  if (streamerName) {
    prompt += `\n- You can mention the streamer by name: ${streamerName}`;
  }
  
  if (avoidTopics.length > 0) {
    prompt += `\n- AVOID these topics: ${avoidTopics.join(", ")}`;
  }
  
  prompt += `\n\nRespond with a JSON object containing: comment, confidence (0-1), and reasoning.`;
  
  return prompt;
}

function buildUserMessage(params: {
  audioTranscript?: string;
  screenDescription?: string;
  streamTitle?: string;
  previousComments: string[];
}): string {
  const { audioTranscript, screenDescription, streamTitle, previousComments } = params;
  
  let message = "Generate a comment for this live stream.\n\n";
  
  if (streamTitle) {
    message += `STREAM TITLE: ${streamTitle}\n\n`;
  }
  
  if (audioTranscript) {
    message += `RECENT AUDIO (what was just said):\n"${audioTranscript}"\n\n`;
  }
  
  if (screenDescription) {
    message += `SCREEN DESCRIPTION:\n${screenDescription}\n\n`;
  }
  
  if (previousComments.length > 0) {
    message += `PREVIOUS COMMENTS (avoid repeating):\n${previousComments.map(c => `- ${c}`).join("\n")}\n\n`;
  }
  
  message += "Generate a natural, contextual comment based on the above.";
  
  return message;
}

/**
 * Analyze a screenshot using GPT-4o vision
 */
export async function analyzeScreenshot(imageBase64: string): Promise<string> {
  const apiKey = ENV.openaiApiKey;
  const baseUrl = ENV.openaiBaseUrl;
  
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured");
  }
  
  const response = await fetch(`${baseUrl}/v1/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: "You are analyzing a live stream screenshot. Describe what's happening in 2-3 sentences. Focus on: what the streamer is doing, any text/graphics on screen, the overall mood/activity.",
        },
        {
          role: "user",
          content: [
            { type: "text", text: "What's happening in this stream right now?" },
            {
              type: "image_url",
              image_url: {
                url: `data:image/jpeg;base64,${imageBase64}`,
                detail: "low",
              },
            },
          ],
        },
      ],
      max_tokens: 150,
    }),
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Vision API error: ${response.status} - ${errorText}`);
  }
  
  const result = await response.json();
  return result.choices[0]?.message?.content || "Unable to analyze screenshot";
}
