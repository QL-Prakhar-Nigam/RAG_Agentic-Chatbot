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
};
