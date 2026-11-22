import type { UserRole } from "@/lib/generated/prisma/enums";

// The seeded demo staff. These passwords are public on purpose: the seed
// refuses to run against a database that is not local or a demo, and the
// one-click sign-in that uses them only exists when DEMO_MODE=1.
export const DEMO_ACCOUNTS: Record<UserRole, { name: string; email: string; password: string; label: string; hint: string }> = {
  OWNER: {
    name: "Mariana Robles",
    email: "duena@voltio.test",
    password: "VoltioDuena123!",
    label: "Dueña",
    hint: "Ve todo: reportes, equipo y ajustes.",
  },
  FRONT_DESK: {
    name: "Diego Luna",
    email: "recepcion@voltio.test",
    password: "VoltioRecepcion123!",
    label: "Recepción",
    hint: "Recibe equipos, cobra y entrega.",
  },
  TECHNICIAN: {
    name: "Beto Salas",
    email: "tecnico@voltio.test",
    password: "VoltioTecnico123!",
    label: "Técnico",
    hint: "Diagnostica, cotiza y repara.",
  },
};
