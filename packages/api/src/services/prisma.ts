import { PrismaClient } from "@prisma/client";

// Single shared client — avoids exhausting Postgres connections by instantiating
// a new PrismaClient per request/module.
export const prisma = new PrismaClient();
