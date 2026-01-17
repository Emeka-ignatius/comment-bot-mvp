export const ENV = {
  cookieSecret: process.env.JWT_SECRET ?? "",
  databaseUrl: process.env.DATABASE_URL ?? "",
  isProduction: process.env.NODE_ENV === "production",
  mockMode: process.env.MOCK_AUTOMATION === "true",
  localDevMode: process.env.LOCAL_DEV_MODE === "true",
  // OpenAI API for GPT-4o (vision + chat)
  openaiApiKey: process.env.OPENAI_API_KEY ?? "",
  // Support both env var spellings
  openaiBaseUrl:
    process.env.OPENAI_BASE_URL ??
    process.env.OPEN_AI_BASE_URL ??
    "https://api.openai.com",
  openaiModel: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
  // Storage proxy (optional; used by server/storage.ts)
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? "",
};
