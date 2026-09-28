// Internal, admin-only routes — NOT protected by auth yet. Deliberate for
// this thin Phase-1.5 admin slice (discussed directly with the user), closed
// by Phase 5's real admin auth. Must not be reachable from anywhere but local
// dev until then. See local/planning/06-phased-plan.md.
import { Router } from "express";
import { z } from "zod";
import { prisma } from "../services/prisma.js";

export const sitesRouter = Router();

sitesRouter.get("/internal/sites", async (_req, res, next) => {
  try {
    const sites = await prisma.site.findMany({ orderBy: { createdAt: "desc" } });
    res.json(sites);
  } catch (err) {
    next(err);
  }
});

const createSiteSchema = z.object({
  name: z.string().min(1),
  allowedOrigins: z.array(z.string().min(1)).min(1),
});

sitesRouter.post("/internal/sites", async (req, res, next) => {
  const parsed = createSiteSchema.safeParse(req.body);
  if (!parsed.success) {
    res
      .status(400)
      .json({ error: { message: "Invalid request body", details: parsed.error.flatten() } });
    return;
  }

  try {
    const site = await prisma.site.create({ data: parsed.data });
    res.status(201).json(site);
  } catch (err) {
    next(err);
  }
});
