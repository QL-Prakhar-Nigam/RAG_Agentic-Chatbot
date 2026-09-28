import "../env.js";
import { runEval } from "./evaluate.js";
import { prisma } from "../services/prisma.js";

// Usage: npm run eval -- <siteId>
async function main() {
  const siteId = process.argv[2];
  if (!siteId) {
    console.error("Usage: npm run eval -- <siteId>");
    process.exit(1);
  }

  const report = await runEval(siteId);
  console.log(`Golden set size: ${report.exampleCount}`);
  console.log(`Recall@${report.topK}: ${(report.recallAtK * 100).toFixed(1)}%`);
  console.log(`MRR: ${report.mrr.toFixed(3)}`);
}

main()
  .catch((err) => {
    console.error("Eval run failed:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
