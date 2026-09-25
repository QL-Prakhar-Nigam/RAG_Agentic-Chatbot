import { Router } from "express";
import { prisma } from "../services/prisma.js";

export const healthRouter = Router();

healthRouter.get("/health", async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: "ok" });
  } catch (err) {
    console.error(err);
    res.status(503).json({ status: "error", error: { message: "Database unavailable" } });
  }
});
