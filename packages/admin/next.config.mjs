/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // @rag-chatbot/shared resolves straight to its TS source (no dist/ build
  // step) — see local/planning/01-architecture.md on why. Next.js needs this
  // to transpile it like its own app code.
  transpilePackages: ["@rag-chatbot/shared"],
};

export default nextConfig;
