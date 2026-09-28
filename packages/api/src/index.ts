import "./env.js";
import { fileURLToPath } from "node:url";
import path from "node:path";
import cors from "cors";
import express from "express";
import { config } from "./config.js";
import { errorHandler, notFoundHandler } from "./middleware/error-handler.js";
import { healthRouter } from "./routes/health.js";
import { chatRouter } from "./routes/chat.js";
import { sitesRouter } from "./routes/sites.js";
import { documentsRouter } from "./routes/documents.js";

const app = express();

app.use(express.json());
// CORS is wide open at the HTTP layer — the widget embeds on third-party
// domains, so the preflight can't distinguish "the client's real site" from
// anywhere else. Per-site Origin validation happens server-side, per request,
// once Site.allowedOrigins exists (Phase 4). See local/planning/01-architecture.md.
app.use(cors({ origin: "*" }));

// Serves the built widget bundle at /widget.js — one file for every site
// (site identity is read from the embedding <script> tag's data-site-id at
// runtime, not baked into the build). Resolved from this module's own
// location, not cwd, same reasoning as kb/parse.ts's tokenizer path and
// env.ts's root-.env path — correct whether running from src/ under tsx or
// compiled dist/ in production, since both sit one level inside packages/api.
// 404s (not a crash) if packages/widget hasn't been built yet.
// See local/planning/01-architecture.md's "Widget / embed model".
const widgetDistPath = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../widget/dist"
);
app.use(express.static(widgetDistPath));

app.use(healthRouter);
app.use(chatRouter);
app.use(sitesRouter);
app.use(documentsRouter);

app.use(notFoundHandler);
app.use(errorHandler);

app.listen(config.port, () => {
  console.log(`api listening on :${config.port}`);
});
