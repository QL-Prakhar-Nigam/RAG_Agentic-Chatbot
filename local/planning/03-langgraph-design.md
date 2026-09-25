# LangGraph Design

## Why LangGraph, specifically

Two reasons, both concrete rather than "it's popular for agents":

1. **It solves the "classifier doing too much" problem structurally.** A single LLM call asked to
   output several independent judgments in one JSON response (intent, whether to ask a clarifying
   question, which capability applies, an objective summary, whether the topic is in scope...) is
   fragile — every field is a place the call can be subtly wrong, and fixing one often risks breaking
   another. A graph lets each node own exactly one narrow decision; the *structure* of the graph
   carries what used to be encoded as extra output fields on one mega-call.
2. **Checkpointing gives "pause mid-turn, resume later" for free.** This matters specifically because
   tool-calling and multi-step flows (collecting form input, confirming an action before it runs) are
   explicitly planned for later, not now. A hand-rolled loop has no native concept of "we're mid-flow,
   waiting on the user" — that has to be reconstructed from conversation history heuristics (e.g. "was
   the incoming message empty, with structured answers attached? then treat this as a resume, not a
   fresh request") which is exactly the kind of fragile, easy-to-regress logic worth avoiding by
   picking a framework that has a real primitive for it. LangGraph's checkpointer persists the whole
   graph state, including which node execution paused at, keyed by a thread id — a future multi-step
   node uses `interrupt()` to pause and hand control back to the user, and the next message resumes
   exactly where it left off. No heuristic detection needed.

## State shape

```typescript
interface GraphState {
  siteId: string;
  sessionId: string;        // = LangGraph's thread_id
  message: string;
  history: ChatMessage[];   // trimmed to a fixed window before respond reads it — see below

  medicalRedirect?: boolean;          // set by medicalGuard
  kbResults?: KbSearchResult[];       // set by retrieve
  routeCandidates?: RouteCandidate[]; // set by navigateCandidates

  responseMode?: "answer" | "fallback";  // does kbResults support a grounded answer? — decided
                                          // independently of whether a CTA is also offered
  ctaCandidates?: RouteCandidate[];      // 0, 1, or a few — decided purely from routeCandidates +
                                          // the distance floor, never gated on responseMode

  responseText?: string;
  clientActions?: ClientAction[];     // respond's final output — a navigate action per ctaCandidate,
                                       // composed alongside responseText, never instead of it
}
```

`responseMode` and `ctaCandidates` are deliberately two separate fields, not one combined `decision`
enum. An earlier version of this design used a single field that forced a choice between "answer" and
"offer a CTA" — which breaks on an ordinary question like "how do I book an appointment?" that
legitimately has both a real answer and a matching route. See `01-architecture.md`'s "Navigation / CTA
design" section for the full reasoning; this state shape is what makes that composability possible.

## Graph wiring (v1)

```
START → medicalGuard
  ├─ (flagged)     → redirectResponse → END
  └─ (not flagged) → [retrieve, navigateCandidates]   // parallel fan-out, both read `message`+`siteId`
                          ↓              ↓
                              decide   (joins once both complete — different state keys, no conflict)
                                ↓
                             respond → END
```

- **`medicalGuard`** runs first, via a conditional edge (`addConditionalEdges`). If flagged, the graph
  short-circuits straight to a canned redirect and never reaches retrieval — deliberately, so a
  well-covered knowledge-base topic can never accidentally override the redirect by being retrieved
  and answered from (see `01-architecture.md`).
- **`retrieve`** and **`navigateCandidates`** run as a genuine parallel fan-out — both only depend on
  `message`/`siteId`, and they write to different state keys (`kbResults` vs. `routeCandidates`), so
  there's no merge conflict when `decide` (which depends on both) runs next. They **share one query
  embedding call** rather than each computing their own — both need the embedding of the same
  `message`, so it's computed once (a small step ahead of the fan-out, or memoized for the turn) and
  passed to both, not duplicated for no reason.
- **`decide`** sets `state.responseMode` from `kbResults` and `state.ctaCandidates` from
  `routeCandidates` — two independent judgments, not one combined branch. See the state shape above and
  `01-architecture.md`'s "Navigation / CTA design" for why they're kept separate.
- **`respond`** is a single node reading `responseMode` + `ctaCandidates` + `kbResults` from state,
  rather than a separate respond-node variant per branch — the same LLM call, shaped by what's actually
  in state, not four node types to maintain in parallel. It composes `responseText` from
  `responseMode`/`kbResults` and `clientActions` from `ctaCandidates` independently, so a turn can
  return both a full answer and a CTA in the same response.

## Conversation-history window per call

Redis's TTL (below) bounds how long a session's state survives — it says nothing about how much of
`history` gets sent to the model on any single call, which is a separate problem that needs its own
explicit answer. Unbounded history sent to `respond` on every turn is a real cost/latency problem that
tends to surface live rather than get caught early if it's never decided up front. `history` is trimmed
to a fixed window (a message count or token budget) before `respond` reads it. The exact number isn't
fixed at planning time — pick a starting value (e.g. the last 10-15 messages) during Phase 1, alongside
the eval harness, rather than guessing a permanent constant now.

## Persistence: one checkpointer (Redis), Postgres as a separate archive

`.compile({ checkpointer })` takes a **single** checkpointer implementation — LangGraph has no built-in
dual-backend mode. An earlier draft of this section described Redis and Postgres as both backing the
graph checkpointer at once, which isn't how the API works. Here's the accurate v1 design:

- **Redis is the checkpointer**, via `@langchain/langgraph-checkpoint-redis` — fast, per-turn graph
  state, TTL-bound, ephemeral by design. This specific package needs the RedisJSON and RediSearch
  modules to build and query its checkpoint indices; see `05-setup.md` for why that means the Docker
  Compose Redis image must be `redis:8`, not plain `redis:7`.
- **Losing in-progress turn state on a restart is an acceptable risk in v1**, because nothing uses
  `interrupt()` yet — there's no paused mid-flow state to lose. A purely ephemeral, Redis-only
  checkpointer is the right choice for what v1 actually needs, not a corner cut.
- **Postgres is a separate, application-level archive** — the `ConversationLog` table
  (`04-database-schema.md`), written directly by the API server after each turn, independent of
  LangGraph's checkpointer mechanism entirely. It backs the admin panel's conversation log view and any
  future analytics. It is not a second checkpointer backend, and the graph itself never reads from it.

**Real migration cost to flag now, not discover later:** when Phase 8 introduces `interrupt()`-based
multi-step flows, in-progress state has to survive a server restart, which means swapping to a durable
checkpointer (e.g. a Postgres-backed one) at that point — turn state moves backends. That's genuine
migration work, not "just add a node." The claim elsewhere in this planning set that tool-calling
extends the system "without a redesign" is accurate for the *graph's shape* (new nodes, new edges,
nothing existing has to change) but does not cover the *persistence layer* — that's separate work,
scoped to Phase 8 when it actually starts, not something this plan gets for free.

## Streaming

LangGraph supports streaming graph execution natively — per-node output as it's produced — which maps
cleanly onto Server-Sent Events for the widget's streaming chat endpoint. Worth building in from v1
rather than bolting on later: retrofitting streaming onto an already-built non-streaming loop tends to
surface edge cases only after the fact (e.g. what happens when a node emits partial text and then
decides to take a different action instead — a case worth designing for up front rather than
discovering live).

## How this extends later — the graph shape, and what doesn't come for free

- **Tool-calling**: add a `toolCall` node and a conditional edge that loops back to itself until a
  terminal condition is met — the standard LangGraph "agent with tools" pattern. Nothing about the v1
  graph structure needs to change to add this; it's a new node plus new edges, not a different engine.
- **Multi-step flows** (collecting structured input, confirming before an action executes): built on
  `interrupt()`. The graph pauses at the interrupt point, state is persisted, and the next inbound
  message resumes execution from exactly that point — no "is this a resume turn?" detection logic
  needed anywhere in the codebase. **This is the piece that needs the persistence-layer migration
  described above** — `interrupt()` needs state that survives a restart, which the v1 Redis-only
  checkpointer doesn't guarantee. So "extends without a redesign" is true for the graph itself and not
  fully true for everything underneath it; budget the checkpointer swap as real Phase 8 work, not a
  side effect of adding a node.
