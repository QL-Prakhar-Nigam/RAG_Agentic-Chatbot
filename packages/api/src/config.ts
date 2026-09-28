// Strict env-var discipline — every configurable value has a corresponding
// .env.example entry (see local/planning/05-setup.md). Nothing here should be
// hardcoded that ought to vary per deployment.
function requireEnv(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (value === undefined) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

export const config = {
  port: Number(requireEnv("PORT", "4000")),
  nodeEnv: requireEnv("NODE_ENV", "development"),
  databaseUrl: requireEnv("DATABASE_URL"),
  redisUrl: requireEnv("REDIS_URL"),
  rateLimit: {
    windowMs: Number(requireEnv("RATE_LIMIT_WINDOW_MS", "60000")),
    maxRequests: Number(requireEnv("RATE_LIMIT_MAX_REQUESTS", "30")),
  },
  openai: {
    // Deliberately not validated here — the server (health checks, non-LLM
    // routes) must still boot without a key configured. The OpenAI client
    // (services/openai-client.ts) is constructed lazily and fails at first
    // actual use instead, which is the boundary that actually needs it.
    apiKey: process.env.OPENAI_API_KEY ?? "",
    chatModel: requireEnv("OPENAI_CHAT_MODEL", "gpt-4o-mini"),
    embeddingModel: requireEnv("OPENAI_EMBEDDING_MODEL", "text-embedding-3-small"),
    // Optional — an Azure-OpenAI-compatible gateway or self-hosted endpoint.
    // Unset uses the SDK's own default (OpenAI's public API).
    baseUrl: process.env.OPENAI_BASE_URL,
  },
};
