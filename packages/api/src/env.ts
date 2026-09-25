import { fileURLToPath } from "node:url";
import path from "node:path";
import dotenv from "dotenv";

// Must be the first import anywhere in the entrypoint's import chain — ESM
// hoists all imports before any top-level code runs, so config.ts's env reads
// only see these values if this module's side effect has already executed.
//
// npm workspaces run scripts with cwd = the package directory, not the repo
// root, so dotenv's default (load ".env" from cwd) would miss the root .env.
const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
dotenv.config({ path: path.join(rootDir, ".env") });
