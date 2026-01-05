/**
 * AI Comment Generator Service
 * 
 * Uses LLM to generate contextual comments based on:
 * - Audio transcription from the stream
 * - Screen capture/visual analysis
 * - Comment style preferences
 */

import { invokeLLM, type Message } from "../_core/llm";

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
 * Generate a contextual comment using LLM
 */
export async function generateAIComment(params: GenerateCommentParams): Promise<GeneratedComment> {
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
  const messages: Message[] = [
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
  
  // Call LLM with structured output
  const response = await invokeLLM({
    messages,
    maxTokens: 300,
    responseFormat: {
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
  });
  
  const content = response.choices[0]?.message?.content;
  
  if (!content) {
    throw new Error("No response from LLM");
  }
  
  try {
    const contentStr = typeof content === 'string' ? content : JSON.stringify(content);
    const parsed = JSON.parse(contentStr);
    return {
      comment: parsed.comment,
      confidence: parsed.confidence,
      reasoning: parsed.reasoning,
    };
  } catch (e) {
    // Fallback if JSON parsing fails
    const fallbackContent = typeof content === 'string' ? content : JSON.stringify(content);
    return {
      comment: fallbackContent.slice(0, maxLength),
      confidence: 0.5,
      reasoning: "Fallback parsing",
    };
  }
}

/**
 * Build the system prompt based on style and preferences
 */
function buildSystemPrompt(opts: {
  style: CommentStyle;
  maxLength: number;
  avoidTopics: string[];
  includeEmojis: boolean;
  platform: string;
  streamerName?: string;
}): string {
  const { style, maxLength, avoidTopics, includeEmojis, platform, streamerName } = opts;
  
  const styleDescriptions = {
    engaging: "Be enthusiastic, ask questions, and show genuine interest. React to exciting moments.",
    supportive: "Be positive and encouraging. Compliment the streamer and support their content.",
    curious: "Ask thoughtful questions about what's happening. Show interest in learning more.",
    casual: "Be relaxed and conversational. Use casual language like you're chatting with a friend.",
    professional: "Be formal and informative. Provide constructive feedback or insights.",
  };
  
  let prompt = `You are a helpful assistant that generates natural, contextual comments for ${platform} live streams.

Your task is to generate a single comment that feels authentic and engaging.

**Style**: ${styleDescriptions[style]}

**Requirements**:
- Maximum ${maxLength} characters
- ${includeEmojis ? 'Include relevant emojis where appropriate' : 'Do NOT use emojis'}
- Sound like a real viewer, not a bot
- Be specific to what's happening in the stream
- Don't be overly promotional or spammy`;

  if (streamerName) {
    prompt += `\n- You can address the streamer as "${streamerName}"`;
  }

  if (avoidTopics.length > 0) {
    prompt += `\n- AVOID mentioning these topics: ${avoidTopics.join(', ')}`;
  }

  prompt += `\n\n**Output Format**: Return a JSON object with:
- comment: The actual comment text
- confidence: A number from 0 to 1 indicating how well this comment fits the context
- reasoning: A brief explanation of why this comment is appropriate`;

  return prompt;
}

/**
 * Build the user message with stream context
 */
function buildUserMessage(opts: {
  audioTranscript?: string;
  screenDescription?: string;
  streamTitle?: string;
  previousComments?: string[];
}): string {
  const { audioTranscript, screenDescription, streamTitle, previousComments = [] } = opts;
  
  let message = "Generate a comment for this live stream.\n\n";
  
  if (streamTitle) {
    message += `**Stream Title**: ${streamTitle}\n\n`;
  }
  
  if (audioTranscript) {
    message += `**Recent Audio/Transcript**:\n${audioTranscript}\n\n`;
  }
  
  if (screenDescription) {
    message += `**What's on Screen**:\n${screenDescription}\n\n`;
  }
  
  if (previousComments.length > 0) {
    message += `**Previous Comments (avoid repeating these)**:\n${previousComments.slice(-3).join('\n')}\n\n`;
  }
  
  if (!audioTranscript && !screenDescription) {
    message += "**Note**: No specific context available. Generate a general engaging comment that would work for most streams.\n\n";
  }
  
  message += "Now generate an appropriate comment.";
  
  return message;
}
