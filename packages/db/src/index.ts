import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";

export * from "../generated/prisma/client";
export * from "./permissions";
export * from "./settings";
export * from "./discord-sync";

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

export type BotEventType =
  | "appointment.created"
  | "appointment.cancelled"
  | "appointment.completed";

/** Ajoute un événement à la file lue par le bot Discord. */
export function queueBotEvent(type: BotEventType, payload: Record<string, unknown>) {
  return prisma.botEvent.create({ data: { type, payload: JSON.stringify(payload) } });
}
