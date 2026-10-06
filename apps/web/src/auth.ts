import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Discord from "next-auth/providers/discord";
import { loadSettings, prisma, syncDiscordMember } from "@ocean/db";

const devLogin = process.env.NODE_ENV !== "production" && process.env.AUTH_DEV_LOGIN === "true";

type GuildMember = { nick: string | null; roles: string[] };

async function fetchGuildMember(guildId: string, accessToken: string): Promise<GuildMember | null> {
  const res = await fetch(`https://discord.com/api/v10/users/@me/guilds/${guildId}/member`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return res.ok ? ((await res.json()) as GuildMember) : null;
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt" },
  pages: { signIn: "/connexion", error: "/connexion" },
  providers: [
    Discord({ authorization: { params: { scope: "identify guilds.members.read" } } }),
    ...(devLogin
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
      const member = guildId ? await fetchGuildMember(guildId, account.access_token) : null;
      if (!member && guildId && settings.requireGuildMember === "true") return "/connexion?erreur=serveur";

      const discordId = String(profile.id);
      await syncDiscordMember(prisma, {
        discordId,
        username: member?.nick || (profile.global_name as string | null) || String(profile.username),
        avatarUrl: profile.avatar ? `https://cdn.discordapp.com/avatars/${discordId}/${profile.avatar}.png` : null,
        roles: member?.roles ?? null,
      });
      return true;
    },
    async jwt({ token, account, profile, user }) {
      if (account?.provider === "discord" && profile) {
        const dbUser = await prisma.user.findUnique({ where: { discordId: String(profile.id) } });
        if (dbUser) token.uid = dbUser.id;
      } else if (account?.provider === "dev" && user?.id) {
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

export const devLoginEnabled = devLogin;
