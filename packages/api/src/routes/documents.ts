// Internal, admin-only routes — see the same not-yet-auth'd note in
// routes/sites.ts. Must not be reachable from anywhere but local dev until
// Phase 5 adds real admin auth.
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import { Router } from "express";
import multer from "multer";
import { prisma } from "../services/prisma.js";
import { ingestDocument } from "../kb/ingest.js";

export const documentsRouter = Router();

const upload = multer({
  storage: multer.diskStorage({
    destination: os.tmpdir(),
    // docling.rs detects the document format from the file extension —
    // multer's own default temp filename has none, which would silently
    // break every upload. Preserve the original extension explicitly.
    filename: (_req, file, cb) => {
      cb(null, `${crypto.randomUUID()}${path.extname(file.originalname)}`);
    },
  }),
});

documentsRouter.post("/internal/documents", upload.single("file"), async (req, res, next) => {
  if (!req.file) {
    res.status(400).json({ error: { message: "Missing file" } });
    return;
  }

  const siteId =
    typeof req.body?.siteId === "string" && req.body.siteId.length > 0 ? req.body.siteId : null;

  try {
    const result = await ingestDocument({
      filePath: req.file.path,
      fileName: req.file.originalname,
      siteId,
    });
    res.status(201).json(result);
  } catch (err) {
    next(err);
  } finally {
    await fs.unlink(req.file.path).catch((err) => {
      console.error("failed to clean up temp upload file", err);
    });
  }
});

// siteId omitted -> lists global documents (siteId IS NULL), not "all sites" —
// the admin UI shows per-site and global documents as separate sections.
documentsRouter.get("/internal/documents", async (req, res, next) => {
  const siteId =
    typeof req.query.siteId === "string" && req.query.siteId.length > 0 ? req.query.siteId : null;

  try {
    const documents = await prisma.kbDocument.findMany({
      where: { siteId },
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { chunks: true } } },
    });
    res.json(
      documents.map((doc) => ({
        id: doc.id,
        fileName: doc.fileName,
        createdAt: doc.createdAt,
        chunkCount: doc._count.chunks,
      }))
    );
  } catch (err) {
    next(err);
  }
});
