import "dotenv/config";
import { TZDate } from "@date-fns/tz";
import { ALL_PERMISSIONS, prisma } from "../src/index";

const TZ = process.env.NEXT_PUBLIC_TZ ?? "Europe/Paris";

// Données d'exemple : tout est modifiable ensuite depuis /pro/config.
const services = [
  { slug: "medecine-generale", name: "Médecine générale", icon: "stethoscope", description: "Consultations, bilans de santé, certificats et suivi courant." },
  { slug: "urgences", name: "Urgences & EMS", icon: "siren", description: "Suivi post-intervention et soins urgents." },
  { slug: "chirurgie", name: "Chirurgie", icon: "scissors", description: "Interventions programmées, retrait de balles, sutures complexes." },
  { slug: "psychologie", name: "Psychologie", icon: "brain", description: "Soutien psychologique, suivi post-traumatique, évaluations." },
  { slug: "radiologie", name: "Radiologie", icon: "scan", description: "Radios, scanners et IRM sur prescription." },
  { slug: "kinesitherapie", name: "Kinésithérapie", icon: "activity", description: "Rééducation après blessure ou opération." },
];

const specialties = [
  { slug: "traumatologie", name: "Traumatologie" },
  { slug: "psychiatrie", name: "Psychiatrie" },
  { slug: "medecine-legale", name: "Médecine légale" },
  { slug: "formateur", name: "Formateur" },
];

const ALL = ALL_PERMISSIONS.join(",");
const grades = [
  { name: "Directeur", order: 100, color: "#7c3aed", permissions: ALL },
  { name: "Directeur adjoint", order: 90, color: "#7c3aed", permissions: ALL },
  { name: "Chef de service", order: 70, color: "#0a6f98", permissions: "patients.history,prescriptions.write,agenda.view_all,appointments.manage_all,staff.manage,stats.view,audit.view" },
  { name: "Médecin", order: 50, color: "#0a6f98", permissions: "patients.history,prescriptions.write,agenda.view_all" },
  { name: "Interne", order: 30, color: "#138cb8", permissions: "patients.history,prescriptions.write" },
  { name: "Ambulancier", order: 20, color: "#dc2626", permissions: "patients.history", bookable: false },
  { name: "Stagiaire", order: 10, color: "#64748b", permissions: "", bookable: false },
];

// Comptes de démo (sans mot de passe) utilisables avec la connexion « dev ».
const demoStaff = [
  { login: "demo-direction", username: "Dr. Morgan Hale", grade: "Directeur", services: ["medecine-generale"], specialties: [], bio: "Directeur de l'Ocean Hospital." },
  { login: "demo-doctor", username: "Dr. Léa Vasquez", grade: "Médecin", services: ["chirurgie", "urgences"], specialties: ["traumatologie"], bio: "Spécialisée en traumatologie balistique." },
  { login: "demo-psy", username: "Dr. Samuel Okafor", grade: "Médecin", services: ["psychologie"], specialties: ["psychiatrie"], bio: "Accompagnement post-traumatique." },
  { login: "demo-ems", username: "Jordan Reyes", grade: "Ambulancier", services: ["urgences"], specialties: [], bio: null },
];

async function main() {
  for (const [order, s] of services.entries()) {
    await prisma.service.upsert({ where: { slug: s.slug }, update: {}, create: { ...s, order } });
  }
  for (const [order, s] of specialties.entries()) {
    await prisma.specialty.upsert({ where: { slug: s.slug }, update: {}, create: { ...s, order } });
  }
  if ((await prisma.grade.count()) === 0) {
    await prisma.grade.createMany({ data: grades });
  }

  for (const s of demoStaff) {
    const grade = await prisma.grade.findFirstOrThrow({ where: { name: s.grade } });
    const user = await prisma.user.upsert({
      where: { login: s.login },
      update: {},
      create: { login: s.login, username: s.username },
    });
    const links = {
      services: { set: s.services.map((slug) => ({ slug })) },
      specialties: { set: s.specialties.map((slug) => ({ slug })) },
    };
    const staff = await prisma.staffProfile.upsert({
      where: { userId: user.id },
      update: { gradeId: grade.id, ...links },
      create: {
        userId: user.id,
        displayName: s.username,
        bio: s.bio,
        gradeId: grade.id,
        services: { connect: s.services.map((slug) => ({ slug })) },
        specialties: { connect: s.specialties.map((slug) => ({ slug })) },
      },
    });

    // Disponibilités sur les 7 prochains jours : 20h-23h heure du serveur RP.
    await prisma.availability.deleteMany({ where: { staffId: staff.id } });
    for (let d = 0; d < 7; d++) {
      const day = new TZDate(Date.now(), TZ);
      day.setDate(day.getDate() + d);
      const at = (h: number) => new Date(new TZDate(day.getFullYear(), day.getMonth(), day.getDate(), h, 0, TZ).getTime());
      await prisma.availability.create({ data: { staffId: staff.id, start: at(20), end: at(23), slotMinutes: 30 } });
    }
  }

  const patient = await prisma.user.upsert({
    where: { login: "demo-patient" },
    update: {},
    create: { login: "demo-patient", username: "Citoyen Test" },
  });
  if ((await prisma.character.count({ where: { userId: patient.id } })) === 0) {
    await prisma.character.create({
      data: { userId: patient.id, firstName: "Tony", lastName: "Russo", birthDate: new Date("1990-04-12"), phone: "555-0142", bloodType: "O+" },
    });
  }

  console.log("Seed terminé.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
