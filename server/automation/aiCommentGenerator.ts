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
  | 'professional'  // Formal, informative comments
  | 'hype'          // High energy, excited vibes
  | 'question'      // Thought-provoking questions
  | 'agreement';    // Validation and consensus

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
  
  // Validate audio transcript quality if available
  if (audioTranscript && audioTranscript.length < 5) {
    console.warn('[AICommentGenerator] Audio transcript too short, may be low quality');
  }
  
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
    engaging: "Be enthusiastic, ask questions, and show genuine interest. React to exciting moments. Use lots of emojis! 🔥 Use stream-specific language like 'no cap', 'fr fr', 'bussin', 'slay', 'ate', etc.",
    supportive: "Be positive and encouraging. Compliment the streamer and support their content. Use emojis like 💪 ❤️ 🙌. Use phrases like 'keep it up', 'you got this', 'fire content'.",
    curious: "Ask thoughtful questions about what's happening. Show interest in learning more. Use curious emojis like 🤔 ❓ 👀. Ask 'what's next?', 'how did you...?', 'why did you...?'",
    casual: "Be relaxed and conversational. Use casual language like you're chatting with a friend. Use emojis freely 😂 💯 👏. Use slang like 'lol', 'ngl', 'lowkey', 'highkey', 'bet'.",
    professional: "Be formal and informative. Provide constructive feedback or insights. Use professional emojis like 📊 💼 ✅. Use phrases like 'great point', 'well explained', 'impressive work'.",
    hype: "GO CRAZY! Maximum energy and excitement! Use LOTS of fire emojis and hype language. Say things like LETS GOOOO, BUSSIN FR FR, SLAY, NO CAP, FIRE, GOATED, INSANE. Be LOUD and EXCITED!",
    question: "Ask engaging, thought-provoking questions that make viewers think. Use emojis like thinking face and question mark. Ask about opinions, predictions, or deeper topics. Make people want to answer.",
    agreement: "Validate what's happening and show consensus. Use emojis like checkmark and thumbs up. Say things like facts, facts no cap, you right, agreed, exactly, this is it, period.",
  };
  
  let prompt = `You are a helpful assistant that generates natural, contextual comments for ${platform} live streams.

Your task is to generate a single comment that feels authentic, engaging, and like it came from a real viewer.

**Style**: ${styleDescriptions[style]}

**Requirements**:
- Maximum ${maxLength} characters
- ${includeEmojis ? 'USE LOTS OF RELEVANT EMOJIS! 🎉 😂 🔥 💯 👀 etc.' : 'Do NOT use emojis'}
- Sound like a real viewer, NOT a bot or AI
- Be specific and contextual to what's happening
- Use modern internet slang and stream culture language
- Don't be overly promotional or spammy
- React emotionally and authentically
- Keep it short and punchy`;

  if (streamerName) {
    prompt += `\n- You can address the streamer as "${streamerName}"`;
  }

  if (avoidTopics.length > 0) {
    prompt += `\n- AVOID mentioning these topics: ${avoidTopics.join(', ')}`;
  }

  prompt += `\n\n**Confidence Scoring**:
- 0.9-1.0: Perfect fit, responds directly to what's happening
- 0.7-0.9: Good fit, relevant to the stream
- 0.5-0.7: Decent fit, generic but appropriate
- 0.3-0.5: Weak fit, might not match context well
- 0.0-0.3: Poor fit, don't use this comment

**Output Format**: Return a JSON object with:
- comment: The actual comment text (must feel like a real viewer)
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
    message += `**What the Streamer Just Said**:\n${audioTranscript}\n\n**IMPORTANT**: Respond directly to what was said! If they asked a question, answer it. If they made a joke, react to it. If they said something cool, hype it up!\n\n`;
  }
  
  if (screenDescription) {
    message += `**What's on Screen**:\n${screenDescription}\n\n`;
  }
  
  if (previousComments.length > 0) {
    message += `**Previous Comments (avoid repeating these)**:\n${previousComments.slice(-3).join('\n')}\n\n`;
  }
  
  if (!audioTranscript && !screenDescription) {
    message += "**Note**: No specific context available. Generate a general engaging comment that would work for most streams. Use lots of emojis and energy!\n\n";
  }
  
  message += "Now generate a comment that feels like it came from a real, engaged viewer. Make it authentic and fun!";
  
  return message;
}
