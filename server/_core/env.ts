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
  // iProyal Residential proxies (optional; used to avoid single-IP posting)
  iproyalHost: process.env.IPROYAL_HOST ?? "",
  iproyalPort: Number(process.env.IPROYAL_PORT ?? "12321"),
  iproyalUsername: process.env.IPROYAL_USERNAME ?? "",
  iproyalPassword: process.env.IPROYAL_PASSWORD ?? "",
  // e.g. "2h", "30m", "1d"
  iproyalSessionLifetime: process.env.IPROYAL_SESSION_LIFETIME ?? "4h",
  // Optional geo targeting (only if you want it)
  iproyalCountry: process.env.IPROYAL_COUNTRY ?? "",
  iproyalState: process.env.IPROYAL_STATE ?? "",
  iproyalCity: process.env.IPROYAL_CITY ?? "",
};
