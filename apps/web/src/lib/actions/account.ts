"use server";

import { AuthError } from "next-auth";
import { redirect } from "next/navigation";
import { z } from "zod";
import { LOGIN_PATTERN, hashPassword, normalizeLogin, prisma, verifyPassword } from "@ocean/db";
import { signIn } from "@/auth";
import type { FormState } from "@/components/forms";
import { getCurrentUser, getSettings } from "@/lib/session";

const safeCallback = (value: unknown) =>
  typeof value === "string" && value.startsWith("/") && !value.startsWith("//") ? value : "/espace";

const loginField = z
  .string()
  .transform(normalizeLogin)
  .refine((v) => LOGIN_PATTERN.test(v), "Identifiant : 3 à 32 caractères (lettres, chiffres, . _ -).");
const passwordField = z.string().min(8, "Mot de passe : 8 caractères minimum.").max(128);

export async function loginWithPassword(_: FormState, data: FormData): Promise<FormState> {
  const login = normalizeLogin(String(data.get("login") ?? ""));
  const password = String(data.get("password") ?? "");
  if (!login || !password) return { error: "Renseignez votre identifiant et votre mot de passe." };

  const locked = await prisma.user.findFirst({ where: { login, lockedUntil: { gt: new Date() } }, select: { id: true } });
  if (locked) return { error: "Trop de tentatives : compte bloqué 15 minutes." };

  try {
    await signIn("password", { login, password, redirectTo: safeCallback(data.get("callbackUrl")) });
  } catch (e) {
    if (e instanceof AuthError) return { error: "Identifiant ou mot de passe incorrect." };
    throw e; // redirection de succès
  }
}

const signupSchema = z
  .object({
    login: loginField,
    username: z.string().trim().min(2, "Nom affiché : 2 caractères minimum.").max(40),
    password: passwordField,
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, { message: "Les deux mots de passe ne correspondent pas." });

/** Inscription libre d'un citoyen (désactivable dans la configuration). */
export async function signup(_: FormState, data: FormData): Promise<FormState> {
  if ((await getSettings()).allowSignup !== "true") return { error: "Les inscriptions sont fermées. Adressez-vous à l'hôpital en jeu." };
  const parsed = signupSchema.safeParse(Object.fromEntries(data));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { login, username, password } = parsed.data;

  if (await prisma.user.findUnique({ where: { login }, select: { id: true } })) return { error: "Cet identifiant est déjà pris." };
  await prisma.user.create({ data: { login, username, passwordHash: await hashPassword(password) } });

  // Première étape après l'inscription : créer son personnage.
  await signIn("password", { login, password, redirectTo: "/espace/personnages" });
}

const changeSchema = z
  .object({ current: z.string().optional(), password: passwordField, confirm: z.string() })
  .refine((v) => v.password === v.confirm, { message: "Les deux mots de passe ne correspondent pas." });

export async function changePassword(_: FormState, data: FormData): Promise<FormState> {
  const session = await getCurrentUser();
  if (!session) redirect("/connexion");
  const parsed = changeSchema.safeParse(Object.fromEntries(data));
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const user = await prisma.user.findUniqueOrThrow({ where: { id: session.id } });
  // Avec un mot de passe temporaire, l'ancien n'est pas redemandé (il vient d'être saisi à la connexion).
  if (user.passwordHash && !user.mustChangePassword && !(await verifyPassword(parsed.data.current ?? "", user.passwordHash))) {
    return { error: "Mot de passe actuel incorrect." };
  }
  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: await hashPassword(parsed.data.password), mustChangePassword: false },
  });
  if (user.mustChangePassword) redirect(session.isStaff || session.isAdmin ? "/pro" : "/espace");
  return { ok: "Mot de passe modifié." };
}
