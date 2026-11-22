/**
 * Demo data: a fictional repair shop three weeks into using the system,
 * with an order in every state.
 *
 * Every order is built by calling the real domain functions with a past
 * `now`, never by inserting rows, so the seeded history obeys the same
 * rules as live data: folios come from the counter, each state was reached
 * by a legal move, every payment fits its balance.
 *
 * The staff passwords in lib/demo/accounts.ts are public. This script
 * therefore refuses to run against a database that does not look local,
 * and refuses to run twice unless told to start over (--reset).
 */
import "dotenv/config";
import { DEMO_ACCOUNTS } from "@/lib/demo/accounts";
import { hashPassword } from "@/lib/auth/password";
import type { UserRole } from "@/lib/generated/prisma/enums";
import { createOrder, type CreateOrderInput } from "@/lib/orders/create-order";
import type { Actor } from "@/lib/orders/lock";
import { addNote, transitionOrder } from "@/lib/orders/transition";
import { recordPayment } from "@/lib/payments/record-payment";
import { prisma } from "@/lib/prisma";
import { decideQuote, saveQuoteDraft, sendQuote, type QuoteItemInput } from "@/lib/quotes/quote-service";

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);

function assertSafeTarget(): void {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set.");
  const host = new URL(url).hostname;
  // "db" is also the service name in a real deployment's compose file, so
  // it proves nothing: a non-local host needs the explicit confirmation.
  if (!LOCAL_HOSTS.has(host) && process.env.SEED_CONFIRM !== "1") {
    throw new Error(`Refusing to seed "${host}": it is not a local database. Set SEED_CONFIRM=1 only for a demo or CI database.`);
  }
}

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const start = Date.now();
/** A moment `days` ago, offset into the working day so events read naturally. */
const ago = (days: number, hours = 0) => new Date(start - days * DAY + hours * HOUR);

const part = (description: string, pesos: number, quantity = 1): QuoteItemInput => ({
  kind: "PART",
  description,
  quantity,
  unitPriceCents: pesos * 100,
});
const labor = (description: string, pesos: number): QuoteItemInput => ({
  kind: "LABOR",
  description,
  quantity: 1,
  unitPriceCents: pesos * 100,
});

async function staff(role: UserRole, extra?: { name: string; email: string }): Promise<Actor> {
  const account = extra ?? DEMO_ACCOUNTS[role];
  const password = extra ? crypto.randomUUID() : DEMO_ACCOUNTS[role].password;
  const user = await prisma.user.create({
    data: { name: account.name, email: account.email, role, passwordHash: await hashPassword(password) },
  });
  return { id: user.id, role, name: user.name };
}

type Scenario = {
  daysAgo: number;
  input: Omit<CreateOrderInput, "promisedAt" | "assignedToId" | "accessories"> & { accessories?: string };
  promisedInDays?: number;
  diagnosis?: string;
  items?: QuoteItemInput[];
  quoteNote?: string;
  /** How far the order gets. */
  until:
    | "RECEIVED"
    | "DIAGNOSING"
    | "AWAITING_APPROVAL"
    | "APPROVED"
    | "IN_REPAIR"
    | "WAITING_PARTS"
    | "QUOTE_REJECTED"
    | "READY"
    | "DELIVERED"
    | "CANCELLED";
  decidedVia?: "link" | "IN_PERSON" | "PHONE";
  depositPesos?: number;
};

const customer = (name: string, phone: string, email: string | null = null) => ({ name, phone: `52${phone}`, email });
const device = (kind: CreateOrderInput["device"]["kind"], brand: string, model: string, serial: string | null, color = "") => ({
  kind,
  brand,
  model,
  serial,
  color,
});

const SCENARIOS: Scenario[] = [
  {
    daysAgo: 20,
    input: {
      customer: customer("Ana Torres Vega", "3312045567", "ana.torres@example.com"),
      device: device("PHONE", "Samsung", "Galaxy S23", "350123456789012", "Negro"),
      reportedIssue: "La pantalla se estrelló y ya no responde al tacto en la parte de abajo.",
      intakeCondition: "Pantalla estrellada en la esquina inferior izquierda. Marco con rayones leves.",
      accessories: "Funda transparente",
    },
    diagnosis: "El panel OLED está roto y el digitalizador no responde. La tarjeta, la batería y las cámaras funcionan bien.",
    items: [part("Pantalla OLED original Samsung Galaxy S23", 3200), labor("Cambio de pantalla y sellado", 450)],
    quoteNote: "La pantalla es original y conserva la resistencia al agua.",
    until: "DELIVERED",
    decidedVia: "link",
    depositPesos: 1500,
  },
  {
    daysAgo: 17,
    input: {
      customer: customer("Luis Hernández Ríos", "3318892204", "luis.hdz@example.com"),
      device: device("LAPTOP", "Lenovo", "ThinkPad T14", "PF3XK9A2", "Negro"),
      reportedIssue: "Se apaga sola cuando se calienta y el ventilador hace mucho ruido.",
      intakeCondition: "Sin daños visibles. Teclado con desgaste normal.",
      accessories: "Cargador original",
    },
    diagnosis: "Ventilador con rodamiento dañado y pasta térmica seca. Temperatura del procesador de 98 °C en reposo.",
    items: [part("Ventilador ThinkPad T14", 780), labor("Limpieza interna y cambio de pasta térmica", 550)],
    until: "DELIVERED",
    decidedVia: "IN_PERSON",
  },
  {
    daysAgo: 15,
    input: {
      customer: customer("Mariana López Castro", "3325567781"),
      device: device("PHONE", "Apple", "iPhone 12", "353912110045871", "Azul"),
      reportedIssue: "La batería dura menos de medio día.",
      intakeCondition: "Mica con burbujas. Equipo en buen estado.",
    },
    diagnosis: "Salud de batería al 71%. No hay consumo anormal de la tarjeta.",
    items: [part("Batería iPhone 12", 890), labor("Cambio de batería", 300)],
    until: "DELIVERED",
    decidedVia: "PHONE",
  },
  {
    daysAgo: 12,
    input: {
      customer: customer("Jorge Ramírez Soto", "3331104498", "jorge.ramirez@example.com"),
      device: device("CONSOLE", "Sony", "PlayStation 5", "E21A01XR7710", "Blanco"),
      reportedIssue: "No da imagen. Enciende la luz azul y se queda así.",
      intakeCondition: "Puerto HDMI visiblemente doblado.",
      accessories: "Cable HDMI y cable de corriente",
    },
    diagnosis: "Puerto HDMI con pines doblados y pistas levantadas. Requiere reemplazo del puerto y reconstrucción de dos pistas.",
    items: [part("Puerto HDMI PS5", 420), labor("Microsoldadura y reconstrucción de pistas", 1400)],
    quoteNote: "Incluye prueba de 2 horas de uso continuo.",
    until: "QUOTE_REJECTED",
    decidedVia: "link",
  },
  {
    daysAgo: 9,
    input: {
      customer: customer("Sofía Mendoza Ruiz", "3319983345", "sofia.mendoza@example.com"),
      device: device("TABLET", "Apple", "iPad 9a generación", "DMPH3KQ9P7", "Gris espacial"),
      reportedIssue: "No carga. El cable entra flojo.",
      intakeCondition: "Golpe en una esquina. Cristal intacto.",
      accessories: "Funda con teclado",
    },
    diagnosis: "Conector Lightning con pines sulfatados. Carga con normalidad con un conector de prueba.",
    items: [part("Flex de carga iPad 9", 520), labor("Cambio de centro de carga", 480)],
    until: "READY",
    decidedVia: "link",
  },
  {
    daysAgo: 7,
    promisedInDays: -1,
    input: {
      customer: customer("Carlos Navarro Peña", "3327716650"),
      device: device("LAPTOP", "HP", "Pavilion 15", "5CD2187KXL", "Plata"),
      reportedIssue: "Se le cayó café. El teclado dejó de funcionar.",
      intakeCondition: "Restos de líquido bajo el teclado. Olor a quemado leve.",
      accessories: "Cargador",
    },
    diagnosis: "Teclado en corto por líquido. La tarjeta madre no presenta daño tras la limpieza con ultrasonido.",
    items: [part("Teclado HP Pavilion 15 en español", 950), labor("Limpieza por derrame y cambio de teclado", 700)],
    quoteNote: "El teclado es bajo pedido: tarda de 3 a 5 días hábiles en llegar.",
    until: "WAITING_PARTS",
    decidedVia: "PHONE",
    depositPesos: 800,
  },
  {
    daysAgo: 5,
    promisedInDays: 2,
    input: {
      customer: customer("Valeria Ortiz Luna", "3334451290", "valeria.ortiz@example.com"),
      device: device("PHONE", "Xiaomi", "Redmi Note 12", "861234057789034", "Verde"),
      reportedIssue: "Se mojó en la alberca. Enciende pero no tiene sonido.",
      intakeCondition: "Indicador de humedad activado. Sin daños externos.",
    },
    diagnosis: "Bocina y micrófono dañados por humedad. Se limpió la tarjeta; el resto funciona.",
    items: [part("Bocina Redmi Note 12", 260), part("Micrófono inferior", 180), labor("Limpieza por humedad y reemplazos", 520)],
    until: "IN_REPAIR",
    decidedVia: "link",
  },
  {
    daysAgo: 4,
    promisedInDays: 3,
    input: {
      customer: customer("Ricardo Flores Gil", "3310072286", "ricardo.flores@example.com"),
      device: device("PHONE", "Motorola", "Moto G54", "356789104523678", "Azul"),
      reportedIssue: "La cámara trasera sale borrosa y con una mancha.",
      intakeCondition: "Lente de la cámara con una fisura.",
      accessories: "Ninguno",
    },
    diagnosis: "Cristal del lente roto; entró polvo al módulo. El sensor está rayado.",
    items: [part("Módulo de cámara principal Moto G54", 680), part("Cristal de lente", 120), labor("Cambio de módulo de cámara", 350)],
    until: "APPROVED",
    decidedVia: "IN_PERSON",
  },
  {
    daysAgo: 3,
    promisedInDays: 2,
    input: {
      customer: customer("Daniela Cruz Mora", "3329964417", "daniela.cruz@example.com"),
      device: device("PHONE", "Apple", "iPhone 14", "358765098812345", "Medianoche"),
      reportedIssue: "Pantalla con líneas verdes después de una caída.",
      intakeCondition: "Cristal trasero estrellado. Pantalla sin fisuras visibles.",
      accessories: "Funda",
    },
    diagnosis: "El panel OLED tiene daño interno por impacto. Face ID y cámaras funcionan correctamente.",
    items: [part("Pantalla OLED iPhone 14", 4300), labor("Cambio de pantalla y calibración", 500)],
    quoteNote: "El cristal trasero se cotiza por separado si lo quieres cambiar.",
    until: "AWAITING_APPROVAL",
  },
  {
    daysAgo: 2,
    promisedInDays: 3,
    input: {
      customer: customer("Fernando Aguilar Paz", "3316620973"),
      device: device("DESKTOP", "ASUS", "ROG Strix G15 (Ryzen 5)", null, "Negro"),
      reportedIssue: "Pantalla azul al abrir juegos. A veces no arranca.",
      intakeCondition: "Mucho polvo en ventiladores. Panel lateral con un rayón.",
      accessories: "Solo el gabinete",
    },
    diagnosis: "Un módulo de RAM falla la prueba de memoria. Fuente y disco en buen estado.",
    items: [part("Memoria RAM DDR4 16 GB 3200 MHz", 890), labor("Diagnóstico, limpieza y pruebas de estabilidad", 400)],
    until: "AWAITING_APPROVAL",
  },
  {
    daysAgo: 1,
    promisedInDays: 4,
    input: {
      customer: customer("Ana Torres Vega", "3312045567", "ana.torres@example.com"),
      device: device("WEARABLE", "Apple", "Watch SE 2", "H4HLK21QN7", "Blanco estelar"),
      reportedIssue: "No enciende desde que se quedó sin batería hace una semana.",
      intakeCondition: "Correa desgastada. Cristal sin daños.",
      accessories: "Cargador magnético",
    },
    until: "DIAGNOSING",
  },
  {
    daysAgo: 1,
    input: {
      customer: customer("Patricia Salinas Rey", "3338815526", "paty.salinas@example.com"),
      device: device("PHONE", "Samsung", "Galaxy A54", "352098761234560", "Lila"),
      reportedIssue: "No reconoce la SIM. Dice sin servicio todo el tiempo.",
      intakeCondition: "Bandeja de SIM doblada.",
    },
    until: "RECEIVED",
  },
  {
    daysAgo: 0,
    promisedInDays: 3,
    input: {
      customer: customer("Miguel Ángel Vera", "3320047781"),
      device: device("LAPTOP", "Apple", "MacBook Air M1", "C02FX1Q9Q6L4", "Oro"),
      reportedIssue: "La batería se infla; el trackpad ya no hace clic.",
      intakeCondition: "Tapa inferior abombada. Sin golpes.",
      accessories: "Cargador MagSafe",
    },
    until: "RECEIVED",
  },
  {
    daysAgo: 10,
    input: {
      customer: customer("Héctor Zamora Lira", "3317739912"),
      device: device("PHONE", "Huawei", "P30 Lite", "862345019876543", "Negro"),
      reportedIssue: "No enciende. Lo dejó cargando toda la noche.",
      intakeCondition: "Tapa trasera despegada.",
    },
    until: "CANCELLED",
  },
];

async function play(scenario: Scenario, team: { desk: Actor; tech: Actor; owner: Actor }): Promise<void> {
  const { desk, tech } = team;
  const day = scenario.daysAgo;
  const order = await createOrder(
    {
      ...scenario.input,
      accessories: scenario.input.accessories ?? "",
      promisedAt: scenario.promisedInDays === undefined ? null : ago(-scenario.promisedInDays, 9),
      assignedToId: scenario.until === "RECEIVED" ? null : tech.id,
    },
    desk,
    ago(day)
  );
  const move = (to: Parameters<typeof transitionOrder>[0]["to"], at: Date, by: Actor, note = "") =>
    transitionOrder({ orderId: order.id, to, note }, by, at);

  if (scenario.until === "RECEIVED") return;
  if (scenario.until === "CANCELLED") {
    await move("CANCELLED", ago(day, 3), desk, "El cliente decidió llevarse el equipo sin diagnóstico.");
    return;
  }

  await move("DIAGNOSING", ago(day, 2), tech);
  if (scenario.until === "DIAGNOSING" || !scenario.items) return;

  await prisma.order.update({ where: { id: order.id }, data: { diagnosis: scenario.diagnosis ?? "" } });
  const quoteId = await saveQuoteDraft({ orderId: order.id, items: scenario.items, notes: scenario.quoteNote ?? "" }, tech);
  await sendQuote(order.id, tech, ago(day, 5));
  if (scenario.until === "AWAITING_APPROVAL") return;

  const approve = scenario.until !== "QUOTE_REJECTED";
  await decideQuote(
    {
      quoteId,
      approve,
      reason: approve ? "" : "Prefiere comprar una consola nueva.",
      by:
        scenario.decidedVia === "link" || !scenario.decidedVia
          ? { kind: "customer", publicToken: order.publicToken, ip: "189.203.44.17", userAgent: "Mozilla/5.0 (iPhone; demo)" }
          : { kind: "staff", actor: desk, channel: scenario.decidedVia },
    },
    ago(day, 8)
  );
  if (!approve) {
    await addNote({ orderId: order.id, message: "Se le ofreció comprarle la consola para refacciones. Lo va a pensar.", isPublic: false }, desk, ago(day, 9));
    return;
  }
  if (scenario.depositPesos) {
    await recordPayment({ orderId: order.id, kind: "PAYMENT", method: "TRANSFER", amountCents: scenario.depositPesos * 100, note: "Anticipo" }, desk, ago(day, 9));
  }
  if (scenario.until === "APPROVED") return;

  await move("IN_REPAIR", ago(day - 1, 1), tech);
  if (scenario.until === "IN_REPAIR") return;
  if (scenario.until === "WAITING_PARTS") {
    await move("WAITING_PARTS", ago(day - 1, 3), tech, "Pedimos el teclado al proveedor. Llega en 3 a 5 días hábiles.");
    return;
  }

  await move("READY", ago(day - 2, 4), tech, "Probado y funcionando.");
  if (scenario.until === "READY") return;

  const total = await prisma.quote.findUniqueOrThrow({ where: { id: quoteId }, select: { totalCents: true } });
  const remaining = total.totalCents - (scenario.depositPesos ?? 0) * 100;
  await recordPayment({ orderId: order.id, kind: "PAYMENT", method: "CARD", amountCents: remaining, note: "" }, desk, ago(day - 3, 2));
  await move("DELIVERED", ago(day - 3, 2), desk);
}

async function main(): Promise<void> {
  assertSafeTarget();
  const reset = process.argv.includes("--reset");

  if ((await prisma.user.count()) > 0) {
    if (!reset) {
      console.log("The database already has data. Nothing was changed. Use --reset to start the demo over.");
      return;
    }
    // TRUNCATE, not DELETE: the order history is append-only by trigger.
    await prisma.$executeRawUnsafe(
      `TRUNCATE TABLE "Notification", "OrderPhoto", "OrderEvent", "Payment", "QuoteItem", "Quote", "Order", "Device", "Customer", "FolioCounter", "Service", "RateLimitHit", "User" RESTART IDENTITY CASCADE`
    );
  }

  await prisma.business.update({
    where: { id: "main" },
    data: {
      name: "Voltio",
      tagline: "Reparación de celulares y electrónica",
      phone: "3336147720",
      whatsapp: "523336147720",
      email: "hola@voltio.test",
      address: "Av. Chapultepec Sur 412, Col. Americana",
      city: "Guadalajara, Jalisco",
      timezone: "America/Mexico_City",
      taxRateBps: 1600,
      defaultWarrantyDays: 90,
      folioPrefix: "VT",
      hours: [
        { label: "Lunes a viernes", value: "9:30 a 19:30" },
        { label: "Sábado", value: "10:00 a 15:00" },
        { label: "Domingo", value: "Cerrado" },
      ],
      terms: [
        "1. El diagnóstico no tiene costo si se autoriza la reparación.",
        "2. Ninguna reparación se realiza sin la aprobación del cliente sobre la cotización.",
        "3. La garantía cubre la misma falla reparada y no aplica por golpes, humedad o intervención de terceros.",
        "4. Después de 60 días sin recoger el equipo, el taller no se hace responsable de su resguardo.",
        "5. Respalda tu información: el taller no se hace responsable por pérdida de datos.",
      ].join("\n"),
    },
  });

  await prisma.service.createMany({
    data: [
      { name: "Cambio de pantalla", description: "Pantallas originales y de alta calidad para las marcas más comunes, con sellado.", fromPriceCents: 89_900, turnaround: "Mismo día", position: 1 },
      { name: "Cambio de batería", description: "Recupera la duración de tu equipo con una batería nueva y probada.", fromPriceCents: 49_900, turnaround: "1 hora", position: 2 },
      { name: "Centro de carga", description: "Limpieza o reemplazo del puerto cuando tu equipo ya no carga o el cable entra flojo.", fromPriceCents: 39_900, turnaround: "2 horas", position: 3 },
      { name: "Daño por líquido", description: "Limpieza por ultrasonido y recuperación de tarjeta. Entre antes lo traigas, mejor.", fromPriceCents: 69_900, turnaround: "1 a 3 días", position: 4 },
      { name: "Mantenimiento de laptop", description: "Limpieza interna, pasta térmica nueva y revisión de ventiladores.", fromPriceCents: 55_000, turnaround: "1 día", position: 5 },
      { name: "Reparación de consolas", description: "Puertos HDMI, sobrecalentamiento, lectores y controles.", fromPriceCents: 75_000, turnaround: "2 a 4 días", position: 6 },
    ],
  });

  const owner = await staff("OWNER");
  const desk = await staff("FRONT_DESK");
  const tech = await staff("TECHNICIAN");
  await staff("TECHNICIAN", { name: "Karla Ibáñez", email: "karla@voltio.test" });

  // Oldest first, one at a time: folios are handed out in arrival order.
  for (const scenario of [...SCENARIOS].sort((a, b) => b.daysAgo - a.daysAgo)) {
    await play(scenario, { owner, desk, tech });
  }

  const sample = await prisma.order.findFirst({ where: { status: "AWAITING_APPROVAL" }, orderBy: { receivedAt: "desc" } });
  console.log(`Seeded ${SCENARIOS.length} orders, ${await prisma.customer.count()} customers and 4 staff accounts.`);
  if (sample) console.log(`A tracking page with a quote to approve: /r/${sample.publicToken}`);
  console.log("Demo sign-in (local only):");
  for (const account of Object.values(DEMO_ACCOUNTS)) console.log(`  ${account.label.padEnd(10)} ${account.email}  ${account.password}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
