import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";

export * from "../generated/prisma/client";
export * from "./permissions";
export * from "./settings";
export * from "./password";

function createClient() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL manquant");
  const adapter = new PrismaPg({ connectionString: url });
  return new PrismaClient({ adapter });
}

// Réutilise le client entre les rechargements à chaud de Next en dev.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

/** Trace une action du personnel dans le journal (/pro/journal). */
export function logAction(actorId: string, action: string, summary: string) {
  return prisma.auditLog.create({ data: { actorId, action, summary } });
}
