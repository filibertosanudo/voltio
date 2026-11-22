import { describe, expect, it } from "vitest";
import { escapeHtml, renderEmail } from "./templates";
import type { NotificationPayload } from "./enqueue";

const shop = { name: "Voltio", phone: "667 123 4567", address: "Av. Obregón 123", currency: "MXN" };
const payload: NotificationPayload = {
  customerName: "Ana",
  folio: "VT-261115-001",
  deviceLabel: "Samsung Galaxy S23",
  trackUrl: "http://voltio.test/r/abc",
};

describe("email templates", () => {
  it("renders every template with a subject, the folio and the tracking link", () => {
    for (const template of ["ORDER_RECEIVED", "QUOTE_READY", "WAITING_PARTS", "READY_FOR_PICKUP", "DELIVERED"] as const) {
      const email = renderEmail(template, payload, shop);
      expect(email.subject, template).toContain("VT-261115-001");
      expect(email.text, template).toContain(payload.trackUrl);
      expect(email.html, template).toContain(`href="${payload.trackUrl}"`);
    }
  });

  it("includes amounts only when there is something to say", () => {
    expect(renderEmail("QUOTE_READY", { ...payload, totalCents: 261_000 }, shop).text).toContain("$2,610.00");
    expect(renderEmail("READY_FOR_PICKUP", { ...payload, balanceCents: 0 }, shop).text).not.toContain("Saldo");
    expect(renderEmail("READY_FOR_PICKUP", { ...payload, balanceCents: 50_000 }, shop).text).toContain("$500.00");
    expect(renderEmail("DELIVERED", { ...payload, warrantyUntil: "13 feb 2027" }, shop).text).toContain("13 feb 2027");
  });

  it("escapes everything a customer or a technician typed", () => {
    const hostile = { ...payload, customerName: `<img src=x onerror="alert(1)">`, note: "<script>x</script>" };
    const { html } = renderEmail("WAITING_PARTS", hostile, shop);
    expect(html).not.toContain("<img");
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
    expect(escapeHtml(`a&b"c'd`)).toBe("a&amp;b&quot;c&#39;d");
  });
});
