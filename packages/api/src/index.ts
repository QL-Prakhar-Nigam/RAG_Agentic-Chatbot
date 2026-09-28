import "./env.js";
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

app.use(healthRouter);
app.use(chatRouter);
app.use(sitesRouter);
app.use(documentsRouter);

app.use(notFoundHandler);
app.use(errorHandler);

app.listen(config.port, () => {
  console.log(`api listening on :${config.port}`);
});
