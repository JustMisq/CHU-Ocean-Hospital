import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Discord from "next-auth/providers/discord";
import { loadSettings, normalizeLogin, prisma, syncDiscordMember, verifyPassword } from "@ocean/db";
import { devLoginEnabled, discordEnabled } from "@/lib/features";

const MAX_FAILED_LOGINS = 5;
const LOCK_MINUTES = 15;

type GuildMember = { nick: string | null; roles: string[] };

/** Le membre, `null` s'il n'est pas sur le serveur, `undefined` si Discord n'a pas répondu correctement. */
async function fetchGuildMember(guildId: string, accessToken: string): Promise<GuildMember | null | undefined> {
  try {
    const res = await fetch(`https://discord.com/api/v10/users/@me/guilds/${guildId}/member`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (res.status === 404) return null;
    return res.ok ? ((await res.json()) as GuildMember) : undefined;
  } catch {
    return undefined;
  }
}

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
    ...(discordEnabled ? [Discord({ authorization: { params: { scope: "identify guilds.members.read" } } })] : []),
    ...(devLoginEnabled
      ? [
          Credentials({
            id: "dev",
            name: "Compte de démo",
            credentials: { discordId: {} },
            async authorize(credentials) {
              const user = await prisma.user.findUnique({ where: { discordId: String(credentials.discordId) } });
              return user ? { id: user.id, name: user.username } : null;
            },
          }),
        ]
      : []),
  ],
  callbacks: {
    async signIn({ account, profile }) {
      if (account?.provider !== "discord" || !profile || !account.access_token) return true;

      const settings = await loadSettings(prisma);
      const guildId = settings.discordGuildId || process.env.DISCORD_GUILD_ID || "";
      const member = guildId ? await fetchGuildMember(guildId, account.access_token) : undefined;
      if (member === null && settings.requireGuildMember === "true") return "/connexion?erreur=serveur";
      if (member === undefined && guildId && settings.requireGuildMember === "true") return "/connexion?erreur=discord";

      const discordId = String(profile.id);
      await syncDiscordMember(prisma, {
        discordId,
        username: member?.nick || (profile.global_name as string | null) || String(profile.username),
        avatarUrl: profile.avatar ? `https://cdn.discordapp.com/avatars/${discordId}/${profile.avatar}.png` : null,
        // Absent du serveur → aucun rôle ; réponse Discord inconnue → on ne touche pas aux rôles.
        roles: member === undefined ? null : (member?.roles ?? []),
      });
      return true;
    },
    async jwt({ token, account, profile, user }) {
      if (account?.provider === "discord" && profile) {
        const dbUser = await prisma.user.findUnique({ where: { discordId: String(profile.id) } });
        if (dbUser) token.uid = dbUser.id;
      } else if ((account?.provider === "password" || account?.provider === "dev") && user?.id) {
        token.uid = user.id;
      }
      return token;
    },
    session({ session, token }) {
      if (token.uid) session.user.id = token.uid as string;
      return session;
    },
  },
});
