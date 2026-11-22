import type { NotificationTemplate } from "@/lib/generated/prisma/enums";
import { formatMoney } from "@/lib/money";
import type { NotificationPayload } from "./enqueue";

export type ShopInfo = { name: string; phone: string; address: string; currency: string };
export type RenderedEmail = { subject: string; text: string; html: string };

/** Everything interpolated into the HTML passes through here. */
export function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

type Copy = { subject: string; heading: string; lines: string[]; cta: string };

function copyFor(template: NotificationTemplate, p: NotificationPayload, shop: ShopInfo): Copy {
  const money = (cents: number) => formatMoney(cents, shop.currency);
  switch (template) {
    case "ORDER_RECEIVED":
      return {
        subject: `Recibimos tu ${p.deviceLabel} (folio ${p.folio})`,
        heading: "Tu equipo ya está en el taller",
        lines: [
          `Hola ${p.customerName}, recibimos tu ${p.deviceLabel}. Tu folio es ${p.folio}.`,
          "Un técnico lo va a revisar y te enviaremos la cotización antes de hacer cualquier reparación.",
        ],
        cta: "Ver el estado de mi equipo",
      };
    case "QUOTE_READY":
      return {
        subject: `Tu cotización está lista (folio ${p.folio})`,
        heading: "Ya sabemos qué tiene tu equipo",
        lines: [
          `Hola ${p.customerName}, terminamos el diagnóstico de tu ${p.deviceLabel}.`,
          p.totalCents !== undefined ? `El total de la reparación es ${money(p.totalCents)}.` : "",
          "Revisa el detalle y dinos si la aprobamos. No tocamos tu equipo hasta que respondas.",
        ],
        cta: "Revisar y responder la cotización",
      };
    case "WAITING_PARTS":
      return {
        subject: `Estamos esperando una refacción (folio ${p.folio})`,
        heading: "Pedimos una pieza para tu equipo",
        lines: [
          `Hola ${p.customerName}, la reparación de tu ${p.deviceLabel} necesita una refacción que ya pedimos.`,
          p.note ?? "",
          "Retomamos el trabajo en cuanto llegue.",
        ],
        cta: "Ver el estado de mi equipo",
      };
    case "READY_FOR_PICKUP":
      return {
        subject: `Tu ${p.deviceLabel} está listo (folio ${p.folio})`,
        heading: "Ya puedes pasar por tu equipo",
        lines: [
          `Hola ${p.customerName}, tu ${p.deviceLabel} está listo para entrega.`,
          p.balanceCents && p.balanceCents > 0 ? `Saldo por pagar al recoger: ${money(p.balanceCents)}.` : "",
          `Te esperamos en ${shop.address}. Trae tu folio.`,
        ],
        cta: "Ver el detalle de mi orden",
      };
    case "DELIVERED":
      return {
        subject: `Gracias por tu visita (folio ${p.folio})`,
        heading: "Entregamos tu equipo",
        lines: [
          `Hola ${p.customerName}, gracias por confiarnos tu ${p.deviceLabel}.`,
          p.warrantyUntil ? `Tu reparación tiene garantía hasta el ${p.warrantyUntil}.` : "",
          "Si algo no queda como esperabas, responde a este correo o visítanos con tu folio.",
        ],
        cta: "Ver mi comprobante de servicio",
      };
  }
}

export function renderEmail(template: NotificationTemplate, payload: NotificationPayload, shop: ShopInfo): RenderedEmail {
  const copy = copyFor(template, payload, shop);
  const lines = copy.lines.filter((line) => line.length > 0);
  const footer = [shop.name, shop.phone].filter(Boolean).join(" · ");

  const text = [copy.heading, "", ...lines, "", `${copy.cta}: ${payload.trackUrl}`, "", footer].join("\n");

  const paragraphs = lines
    .map((line) => `<p style="margin:0 0 14px;line-height:1.55;color:#30363d">${escapeHtml(line)}</p>`)
    .join("");
  const html = `<!doctype html>
<html lang="es">
<body style="margin:0;background:#f7f5f0;font-family:Helvetica,Arial,sans-serif">
  <div style="max-width:520px;margin:0 auto;padding:32px 20px">
    <p style="margin:0 0 20px;font-weight:700;font-size:18px;color:#0d1117">${escapeHtml(shop.name)}</p>
    <div style="background:#ffffff;border:1px solid #e2ded3;border-radius:14px;padding:28px">
      <h1 style="margin:0 0 16px;font-size:20px;color:#0d1117">${escapeHtml(copy.heading)}</h1>
      ${paragraphs}
      <p style="margin:22px 0 0">
        <a href="${escapeHtml(payload.trackUrl)}" style="display:inline-block;background:#ffd400;color:#0d1117;font-weight:700;text-decoration:none;padding:12px 20px;border-radius:10px">${escapeHtml(copy.cta)}</a>
      </p>
    </div>
    <p style="margin:18px 0 0;font-size:12px;color:#646b75">${escapeHtml(footer)}</p>
  </div>
</body>
</html>`;

  return { subject: copy.subject, text, html };
}
