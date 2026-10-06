import type { PrismaClient } from "../generated/prisma/client";

/** Réglages modifiables depuis /pro/config, avec leur valeur par défaut. */
export const SETTING_DEFAULTS = {
  hospitalName: "Ocean Hospital",
  tagline: "Votre santé à Los Santos, en quelques clics.",
  emergencyNote: "En cas d'urgence en jeu, contactez le 911.",
  discordGuildId: "",
  requireGuildMember: "false",
  bookingWindowDays: "14",
  minNoticeMinutes: "15",
  maxUpcomingPerCharacter: "3",
  maxCharactersPerUser: "5",
};

export type SettingKey = keyof typeof SETTING_DEFAULTS;
export type Settings = Record<SettingKey, string>;

export async function loadSettings(db: PrismaClient): Promise<Settings> {
  const rows = await db.setting.findMany();
  const values = { ...SETTING_DEFAULTS };
  for (const row of rows) if (row.key in values) values[row.key as SettingKey] = row.value;
  return values;
}

export async function saveSettings(db: PrismaClient, values: Partial<Settings>) {
  await db.$transaction(
    Object.entries(values).map(([key, value]) =>
      db.setting.upsert({ where: { key }, update: { value: String(value) }, create: { key, value: String(value) } }),
    ),
  );
}
