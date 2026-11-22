// The Spanish word for each enum value, in one place. Type-only imports:
// client components use these too.
import type {
  DecisionChannel,
  DeviceKind,
  PaymentMethod,
  QuoteItemKind,
  QuoteStatus,
  UserRole,
} from "@/lib/generated/prisma/enums";

export const DEVICE_KIND_LABEL: Record<DeviceKind, string> = {
  PHONE: "Celular",
  TABLET: "Tablet",
  LAPTOP: "Laptop",
  DESKTOP: "Computadora de escritorio",
  CONSOLE: "Consola",
  WEARABLE: "Reloj o wearable",
  OTHER: "Otro",
};

export const ROLE_LABEL: Record<UserRole, string> = {
  OWNER: "Dueño",
  FRONT_DESK: "Recepción",
  TECHNICIAN: "Técnico",
};

export const ITEM_KIND_LABEL: Record<QuoteItemKind, string> = {
  LABOR: "Mano de obra",
  PART: "Refacción",
  OTHER: "Otro",
};

export const QUOTE_STATUS_LABEL: Record<QuoteStatus, string> = {
  DRAFT: "Borrador",
  SENT: "Enviada, esperando respuesta",
  APPROVED: "Aprobada",
  REJECTED: "Rechazada",
  SUPERSEDED: "Reemplazada",
};

export const PAYMENT_METHOD_LABEL: Record<PaymentMethod, string> = {
  CASH: "Efectivo",
  CARD: "Tarjeta",
  TRANSFER: "Transferencia",
};

export const CHANNEL_LABEL: Record<DecisionChannel, string> = {
  CUSTOMER_LINK: "el cliente, desde su enlace",
  IN_PERSON: "el cliente, en mostrador",
  PHONE: "el cliente, por teléfono",
};
