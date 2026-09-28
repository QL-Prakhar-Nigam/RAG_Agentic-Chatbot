import { Router } from "express";
import { z } from "zod";
import { runTurn } from "../graph/run-turn.js";
import { rateLimitChat } from "../middleware/rate-limit.js";

export const chatRouter = Router();

// Matches local/planning/07-api-contracts.md's POST /chat request shape.
const chatRequestSchema = z.object({
  message: z.string().min(1),
  siteId: z.string().min(1),
  sessionId: z.string().min(1),
});

chatRouter.post("/chat", rateLimitChat, async (req, res, next) => {
  const parsed = chatRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    res
      .status(400)
      .json({ error: { message: "Invalid request body", details: parsed.error.flatten() } });
    return;
  }

  try {
    const result = await runTurn(parsed.data);
    res.json(result);
  } catch (err) {
    next(err);
  }
});
