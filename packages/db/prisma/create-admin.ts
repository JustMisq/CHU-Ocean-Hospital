// Crée (ou met à jour) un compte super-admin : npm run admin -- <identifiant> <motdepasse>
import "dotenv/config";
import { LOGIN_PATTERN, hashPassword, normalizeLogin, prisma } from "../src/index";

async function main() {
  const [rawLogin, password] = process.argv.slice(2);
  const login = normalizeLogin(rawLogin ?? "");
  if (!LOGIN_PATTERN.test(login) || !password || password.length < 8) {
    console.error("Usage : npm run admin -- <identifiant> <motdepasse>");
    console.error("Identifiant : 3 à 32 caractères (a-z, 0-9, . _ -). Mot de passe : 8 caractères minimum.");
    process.exit(1);
  }

  const passwordHash = await hashPassword(password);
  const user = await prisma.user.upsert({
    where: { login },
    update: { passwordHash, isSuperAdmin: true, mustChangePassword: false, failedLogins: 0, lockedUntil: null },
    create: { login, username: rawLogin, passwordHash, isSuperAdmin: true },
  });
  console.log(`Super-admin « ${user.login} » prêt. Connectez-vous sur /connexion.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
