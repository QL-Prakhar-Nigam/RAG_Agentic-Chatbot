# RAG Architecture

Built to a full "industry-level" target from day one — there is no legacy vector-only baseline here to
stay backward-compatible with, so the cheapest time to build ingestion and retrieval correctly is now,
not as a later upgrade.

## Ingestion pipeline

```
Document upload
  1. Parse with docling.rs → structured blocks (headings, paragraphs, tables) with hierarchy
  2. Chunk via docling.rs's own hybrid chunker → { text, headings, contextualized } per chunk
  3. Batch chunks (8-12 per call) → ONE LLM call per batch → { chunk_id, summary, questions }[]
     - each chunk tagged with an id before the call; the model echoes it back per item (structured
       JSON output); results mapped back by id, not by array position; missing ids retried individually
  4. Embed the chunk's `contextualized` text (docling's own context-enriched string — heading path +
     surrounding context folded in) → ONE vector per chunk
  5. Build a keyword search index from chunk text + summary + hypothetical questions (not re-embedded)
  6. Persist: one row per chunk (embedding + keyword index + siteId, or null siteId for global content)
```

**`docling.rs` over a Python Docling service.** IBM's original Docling library is Python-only
(PyTorch-based layout/table models), which would mean either a subprocess per upload (repeated
model-load cold start, and it forces the whole ML dependency stack into the main API's deploy image)
or a separate containerized Python service. `docling.rs` is a genuine native Node addon (built with
napi-rs, ships a real `.node` binary, no Python anywhere) — plain `npm install`, no extra process to
operate. The real tradeoff: it's a younger, smaller project than IBM's original, so parsing/chunking
quality on messy real-world documents is less proven. Mitigation: the parser is wrapped behind this
repo's own `ParsedDocument` type rather than re-exporting the library's raw output, so if quality
proves insufficient on real documents, swapping to a Python-backed service later is contained to
rewriting one module plus adding new infra — not a pipeline-wide rewrite.

**Why lean on `docling.rs`'s own hybrid chunker instead of hand-rolling a heading-boundary/table-atomic
walker.** The library already ships a purpose-built chunker producing heading-hierarchy-aware,
table-atomic chunks — reinventing that from scratch means guessing at the same JSON schema the
library's own chunker already understands correctly. Its `contextualized` field is effectively the
"context blurb embedded together with the chunk" that a hand-rolled contextual-retrieval step would
otherwise need to build (prepending heading path + a short LLM-generated description before
embedding) — produced by the library itself instead of a second hand-written step.

**Why summary/hypothetical-questions are folded into the keyword index, not re-embedded.** A summary
mostly restates the chunk in fewer words — embedding it adds little the chunk's own embedding doesn't
already capture semantically. Hypothetical questions are alternate phrasings of what the chunk
answers — their value is as extra literal vocabulary for keyword matching (catching a user's casual
phrasing that doesn't share words with the source document's formal text), not as a second semantic
signal. This keeps ingestion to one embedding call per chunk, not two or three.

## Hybrid retrieval

```
Query arrives
  1. Embed the query
  2. Run in parallel:
     - vector search (pgvector cosine distance) over this site's chunks + global chunks
     - keyword search (Postgres tsvector/GIN) over the same set
  3. Merge both ranked lists via Reciprocal Rank Fusion (RRF)
  4. [pluggable, currently a no-op] optional rerank step
  5. Return top 5-8 chunks
```

**Why both signals, not vector alone.** Vector search is strong at paraphrase/meaning matching
("how do I cancel" ≈ "terminate my plan") but weak at exact terms — a short code, an ID, a specific
product/drug name can embed close to similar-but-wrong alternatives, since embeddings capture semantic
content more than literal digit/token sequences. Keyword search is the opposite: exact-term matching
with zero understanding of paraphrase. Running both and merging catches what either one alone misses.

**Why RRF, not blending raw scores.** Cosine similarity and a keyword rank score live on incompatible
scales — there's no principled way to add a `0.87` similarity to a `4.2` keyword rank without an
arbitrary, dataset-specific weighting. RRF sidesteps this entirely by using only each result's
*rank position* in its own list, not its raw score: `score = Σ 1/(k + rank)` summed across whichever
lists a result appears in (k ≈ 60). A result appearing near the top of *both* lists outranks one that's
merely #1 in a single list — rewarding agreement between the two signals rather than trusting either
one blindly.

**Reranking is deferred, but the seam is built in from the start** — the retrieval function has an
internal `rerank(query, candidates)` step, defaulting to the identity function. This is the one piece
with a real *per-query* recurring cost (unlike ingestion, which is one-time per document), so it's
worth waiting for evidence (from the eval harness below) that RRF-only ordering isn't good enough
before paying for either a hosted reranking API or hosting a cross-encoder model.

## Route retrieval (navigation CTAs)

Same hybrid-retrieval infrastructure, applied to `SiteRoute` rows instead of `KbDocument` chunks — see
`01-architecture.md`'s "Navigation / CTA design" section for the full design (distance floor, tiered
single/branch/none CTA decision). The point worth repeating here: this is *why* route search stays on
the embedding-search path rather than being simplified to "list all routes in the prompt" — a real
property can have 50-200+ pages, well past prompt-listing scale.

## Evaluation harness

Bootstrapped for close to free: the hypothetical questions generated during ingestion (step 3 above)
double as a synthetic golden set — each one already carries a known-correct source chunk id. Track
recall@k and MRR for retrieval; run this before/after any change to the ingestion or retrieval logic so
changes are verified, not assumed. A hand-curated set (real questions a client's staff expects to be
answerable) is worth adding once the product is live — a synthetic set generated by the same model
family doing retrieval is a good bootstrap, not a permanent substitute for real usage data.

## Cost shape

Ingestion is a one-time cost per document, at upload — not a per-chat-turn cost. For a typical
document (~20 pages, ~25 chunks): embeddings are effectively free (a fraction of a cent), batched
enrichment (summary + questions, `gpt-4o-mini`-class model, batched 8-12 chunks/call) runs a few cents
total per document. Retrieval adds no new recurring cost beyond the query embedding call every chat
turn already needs — keyword search and RRF merging are free (Postgres + arithmetic). The only
meaningfully recurring cost this design defers is reranking, and only once it's actually turned on.
