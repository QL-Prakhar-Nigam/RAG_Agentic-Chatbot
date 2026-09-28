import "../env.js";
import { ingestDocument } from "./ingest.js";
import { prisma } from "../services/prisma.js";

// Manual ingestion entry point — there's no admin upload UI until Phase 5.
// Usage: npm run ingest -- <filePath> [siteId]   (omit siteId for a global document)
async function main() {
  const [filePath, siteId] = process.argv.slice(2);
  if (!filePath) {
    console.error("Usage: npm run ingest -- <filePath> [siteId]");
    process.exit(1);
  }

  const result = await ingestDocument({ filePath, siteId: siteId ?? null });
  console.log(`Ingested ${result.chunkCount} chunks into document ${result.documentId}`);
}

main()
  .catch((err) => {
    console.error("Ingestion failed:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
