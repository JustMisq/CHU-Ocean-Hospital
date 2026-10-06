import {
  Activity,
  Ambulance,
  Baby,
  Bone,
  Brain,
  Ear,
  Eye,
  FlaskConical,
  HeartPulse,
  Pill,
  Scan,
  Scissors,
  Siren,
  Stethoscope,
  Syringe,
  type LucideProps,
} from "lucide-react";

/** Icônes proposées dans la configuration des services. */
export const SERVICE_ICONS = {
  stethoscope: ["Stéthoscope", Stethoscope],
  siren: ["Sirène", Siren],
  ambulance: ["Ambulance", Ambulance],
  scissors: ["Ciseaux", Scissors],
  brain: ["Cerveau", Brain],
  scan: ["Scanner", Scan],
  activity: ["Activité", Activity],
  heart: ["Cœur", HeartPulse],
  bone: ["Os", Bone],
  baby: ["Bébé", Baby],
  eye: ["Œil", Eye],
  ear: ["Oreille", Ear],
  pill: ["Médicament", Pill],
  syringe: ["Seringue", Syringe],
  lab: ["Laboratoire", FlaskConical],
} as const;

export function ServiceIcon({ name, ...props }: { name: string } & LucideProps) {
  const Icon = SERVICE_ICONS[name as keyof typeof SERVICE_ICONS]?.[1] ?? Stethoscope;
  return <Icon {...props} />;
}
