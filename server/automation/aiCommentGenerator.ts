/**
 * AI Comment Generator Service
 * 
 * Uses LLM to generate contextual comments based on:
 * - Audio transcription from the stream
 * - Screen capture/visual analysis
 * - Comment style preferences
 */

import { invokeLLM, type Message } from "../_core/llm";
import fs from "node:fs";
import path from "node:path";

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

type CommentBank = {
  version: number;
  voice: string;
  buckets: Record<string, string[]>;
  hard_bans?: string[];
};

let cachedCommentBank: CommentBank | null = null;

function loadCommentBank(): CommentBank | null {
  if (cachedCommentBank) return cachedCommentBank;
  try {
    const p = path.resolve(process.cwd(), "server", "automation", "commentBank.genz.json");
    const raw = fs.readFileSync(p, "utf-8");
    cachedCommentBank = JSON.parse(raw) as CommentBank;
    return cachedCommentBank;
  } catch {
    return null;
  }
}

function pickExamples(bank: CommentBank | null, style: CommentStyle): { buckets: string[]; examples: string[]; bans: string[] } {
  if (!bank) return { buckets: [], examples: [], bans: [] };

  // Map our UI style to a few relevant buckets (model can still choose the final vibe).
  const styleToBuckets: Record<CommentStyle, string[]> = {
    engaging: ["hype", "react_shock", "react_funny", "chat_bait_questions", "short_fillers"],
    supportive: ["supportive", "hype", "short_fillers"],
    curious: ["chat_bait_questions", "react_shock", "short_fillers"],
    casual: ["react_funny", "short_fillers", "meta_reacting_to_stream"],
    professional: ["supportive"], // keep it safer; still short
    hype: ["hype", "short_fillers", "react_shock"],
    question: ["chat_bait_questions"],
    agreement: ["short_fillers", "supportive"]
  };

  const buckets = styleToBuckets[style] || [];
  const pool: string[] = [];
  for (const b of buckets) {
    const items = bank.buckets?.[b] || [];
    pool.push(...items);
  }

  // Randomly sample up to 10 examples
  const examples: string[] = [];
  const copy = [...pool];
  while (examples.length < 10 && copy.length > 0) {
    const idx = Math.floor(Math.random() * copy.length);
    examples.push(copy.splice(idx, 1)[0]);
  }

  const bans = (bank.hard_bans || []).slice(0, 30);
  return { buckets, examples, bans };
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
    maxLength = 60,
    avoidTopics = [],
    includeEmojis = true,
    previousComments = [],
  } = params;
  
  // Validate audio transcript quality if available
  if (audioTranscript && audioTranscript.length < 5) {
    console.warn('[AICommentGenerator] Audio transcript too short, may be low quality');
  }

  const bank = loadCommentBank();
  const bankPick = pickExamples(bank, style);
  
  // Build the system prompt
  const systemPrompt = buildSystemPrompt({
    style,
    maxLength,
    avoidTopics,
    includeEmojis,
    platform,
    streamerName,
    bankVoice: bank?.voice,
    bankBuckets: bankPick.buckets,
    bankExamples: bankPick.examples,
    hardBans: bankPick.bans,
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
  bankVoice?: string;
  bankBuckets?: string[];
  bankExamples?: string[];
  hardBans?: string[];
}): string {
  const {
    style,
    maxLength,
    avoidTopics,
    includeEmojis,
    platform,
    streamerName,
    bankVoice,
    bankBuckets = [],
    bankExamples = [],
    hardBans = [],
  } = opts;
  
  const styleDescriptions = {
    engaging: "Be enthusiastic and reactive like real streamer chat. Use slang and keep it short.",
    supportive: "Be positive and encouraging, but still casual and not polished.",
    curious: "Ask thoughtful questions about what's happening. Show interest in learning more. Use curious emojis like 🤔 ❓ 👀. Ask 'what's next?', 'how did you...?', 'why did you...?'",
    casual: "Be relaxed streamer chat. Short lines, slang, occasional lowercase.",
    professional: "Keep it clean and short, like a normal viewer. No corporate tone.",
    hype: "High energy and excitement like gaming chat. Keep it punchy.",
    question: "Ask chat-bait questions that invite replies (W/L, 1-10, what would you do?).",
    agreement: "Short agreement/validation like real chat (facts, real, W).",
  };
  
  let prompt = `You generate a single chat message for a ${platform} live stream.

The message must feel like it came from a real viewer in a live chat (NOT a bot, NOT an AI).

**Style**: ${styleDescriptions[style]}
${bankVoice ? `\n**Voice**: ${bankVoice}` : ""}

**Requirements**:
- Maximum ${maxLength} characters
- ${includeEmojis ? "Use 2-4 relevant emojis (not 0, not 6+)." : "Do NOT use emojis"}
- Prefer 6-60 characters most of the time (still obey max)
- Use Gen Z streamer chat slang (bruh/nahh/W/L/lock in/cooked/fr/lowkey)
- Can be imperfect: fragments, lowercase, mild typos are OK
- Do not be formal, do not explain, do not narrate
- Avoid sounding like a template
- Do not be spammy or promotional
- Do not include hashtags
- Do not mention being an AI or referencing a prompt/screenshot/audio
`;

  if (streamerName) {
    prompt += `\n- You can address the streamer as "${streamerName}"`;
  }

  if (avoidTopics.length > 0) {
    prompt += `\n- AVOID mentioning these topics: ${avoidTopics.join(', ')}`;
  }

  if (hardBans.length > 0) {
    prompt += `\n- HARD BAN: do not use these phrases (case-insensitive): ${hardBans.join(", ")}`;
  }

  if (bankExamples.length > 0) {
    prompt += `\n\n**Real chat pattern examples (do NOT copy verbatim; mimic vibe + pacing):**\n- ${bankExamples.join("\n- ")}\n`;
    if (bankBuckets.length > 0) {
      prompt += `\n(Examples sourced from buckets: ${bankBuckets.join(", ")})\n`;
    }
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
    message += "**Note**: No specific context available. Generate a general chat message that fits gaming/reaction streams.\n\n";
  }
  
  message += "Now generate ONE message that feels like real chat. Keep it human and non-repetitive.";
  
  return message;
}
