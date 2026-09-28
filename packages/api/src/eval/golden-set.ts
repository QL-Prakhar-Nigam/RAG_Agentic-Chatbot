import { prisma } from "../services/prisma.js";

export interface GoldenExample {
  question: string;
  chunkId: string;
}

// Bootstrapped from ingestion-time hypothetical questions — each one already
// carries a known-correct source chunk id, no separate hand-labeling needed
// to get started. See local/planning/02-rag-architecture.md's "Evaluation
// harness".
export async function loadGoldenSet(siteId: string): Promise<GoldenExample[]> {
  const chunks = await prisma.kbChunk.findMany({
    where: { OR: [{ siteId }, { siteId: null }] },
    select: { id: true, hypotheticalQuestions: true },
  });

  const examples: GoldenExample[] = [];
  for (const chunk of chunks) {
    const questions = Array.isArray(chunk.hypotheticalQuestions)
      ? (chunk.hypotheticalQuestions as string[])
      : [];
    for (const question of questions) {
      examples.push({ question, chunkId: chunk.id });
    }
  }
  return examples;
}
