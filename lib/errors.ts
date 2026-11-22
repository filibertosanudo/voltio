// A rule of the business said no. Thrown by the domain functions and turned
// into a message for the person by the Server Action that called them; any
// other error is a bug and is left to surface as one.

const MESSAGES = {
  NOT_FOUND: "No encontramos ese registro.",
  FORBIDDEN: "Tu rol no puede hacer este movimiento.",
  INVALID_TRANSITION: "La orden ya no está en un estado que permita ese movimiento. Actualiza la página.",
  NOTE_REQUIRED: "Escribe el motivo antes de continuar.",
  NO_APPROVED_QUOTE: "No hay una cotización aprobada para esta orden.",
  BALANCE_PENDING: "La orden tiene saldo pendiente. Registra el pago antes de entregarla.",
  PAID_ORDER: "La orden tiene pagos registrados. Registra el reembolso antes de cancelarla.",
  QUOTE_NOT_EDITABLE: "La cotización no se puede editar en el estado actual de la orden.",
  QUOTE_EMPTY: "Agrega al menos un concepto a la cotización antes de enviarla.",
  QUOTE_NOT_PENDING: "Esa cotización ya no está pendiente: se respondió o se reemplazó por una nueva.",
  QUOTE_TOO_LARGE: "El total de la cotización excede el máximo permitido.",
  OVERPAYMENT: "El monto es mayor al saldo pendiente.",
  OVER_REFUND: "El reembolso es mayor a lo que se ha cobrado.",
  ORDER_CLOSED: "La orden está cancelada y ya no admite movimientos.",
  INVALID_IMAGE: "El archivo no es una imagen JPG, PNG o WebP válida.",
  IMAGE_TOO_LARGE: "La imagen pesa más de 8 MB.",
  EMAIL_TAKEN: "Ya existe una cuenta con ese correo.",
  LAST_OWNER: "Debe quedar al menos una cuenta de dueño activa.",
} as const;

export type DomainErrorCode = keyof typeof MESSAGES;

export class DomainError extends Error {
  readonly code: DomainErrorCode;

  constructor(code: DomainErrorCode) {
    super(MESSAGES[code]);
    this.name = "DomainError";
    this.code = code;
  }
}

export function isDomainError(error: unknown, code?: DomainErrorCode): error is DomainError {
  return error instanceof DomainError && (code === undefined || error.code === code);
}
