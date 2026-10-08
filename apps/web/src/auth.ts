import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { normalizeLogin, prisma, verifyPassword } from "@ocean/db";
import { DEMO_LOGIN_PREFIX, devLoginEnabled } from "@/lib/features";

const MAX_FAILED_LOGINS = 5;
const LOCK_MINUTES = 15;

/** Identifiant + mot de passe, avec blocage temporaire après plusieurs échecs. */
async function authorizePassword(credentials: Partial<Record<string, unknown>>) {
  const login = normalizeLogin(String(credentials.login ?? ""));
  const password = String(credentials.password ?? "");
  const user = login ? await prisma.user.findUnique({ where: { login } }) : null;
  if (!user?.passwordHash || !password) return null;
  if (user.lockedUntil && user.lockedUntil > new Date()) return null;

  if (!(await verifyPassword(password, user.passwordHash))) {
    const failed = user.failedLogins + 1;
    const locked = failed >= MAX_FAILED_LOGINS;
    await prisma.user.update({
      where: { id: user.id },
      data: locked ? { failedLogins: 0, lockedUntil: new Date(Date.now() + LOCK_MINUTES * 60_000) } : { failedLogins: failed },
    });
    return null;
  }
  if (user.failedLogins || user.lockedUntil) {
    await prisma.user.update({ where: { id: user.id }, data: { failedLogins: 0, lockedUntil: null } });
  }
  return { id: user.id, name: user.username };
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt" },
  pages: { signIn: "/connexion", error: "/connexion" },
  providers: [
    Credentials({
      id: "password",
      name: "Identifiant",
      credentials: { login: {}, password: {} },
      authorize: authorizePassword,
    }),
    ...(devLoginEnabled
      ? [
          Credentials({
            id: "dev",
            name: "Compte de démo",
            credentials: { login: {} },
            async authorize(credentials) {
              const login = String(credentials.login ?? "");
              if (!login.startsWith(DEMO_LOGIN_PREFIX)) return null;
              const user = await prisma.user.findUnique({ where: { login } });
              return user ? { id: user.id, name: user.username } : null;
            },
          }),
        ]
      : []),
  ],
  callbacks: {
    jwt({ token, account, user }) {
      if (account && user?.id) token.uid = user.id;
      return token;
    },
    session({ session, token }) {
      if (token.uid) session.user.id = token.uid as string;
      return session;
    },
  },
});