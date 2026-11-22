import { describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { recordPayment } from "@/lib/payments/record-payment";
import { decideQuote } from "@/lib/quotes/quote-service";
import { makeStaff, orderAwaitingApproval, orderInput, QUOTE_TOTAL_CENTS } from "@/test/factories";
import { createOrder } from "./create-order";
import { addNote, transitionOrder } from "./transition";

const NOW = new Date("2026-11-15T18:00:00Z");

describe("createOrder", () => {
  it("creates the customer, device, order, first event and confirmation email together", async () => {
    const actor = await makeStaff("FRONT_DESK");
    const order = await createOrder(orderInput(), actor, NOW);

    expect(order.folio).toBe("VT-261115-001");
    expect(order.publicToken).toMatch(/^[a-z0-9]{24}$/);
    const saved = await prisma.order.findUniqueOrThrow({
      where: { id: order.id },
      include: { customer: true, device: true, events: true, notifications: true },
    });
    expect(saved.status).toBe("RECEIVED");
    expect(saved.customer.phone).toBe("526671234567");
    expect(saved.events.map((e) => [e.type, e.isPublic])).toEqual([["CREATED", true]]);
    expect(saved.notifications.map((n) => n.template)).toEqual(["ORDER_RECEIVED"]);
    expect((saved.notifications[0]?.payload as { trackUrl: string }).trackUrl).toBe(
      `http://voltio.test/r/${order.publicToken}`
    );
  });

  it("uses the shop's local day for the folio, not the server's", async () => {
    const actor = await makeStaff();
    // 03:30 UTC on the 16th is still the 15th in Mexico City.
    const order = await createOrder(orderInput(), actor, new Date("2026-11-16T03:30:00Z"));
    expect(order.folio).toBe("VT-261115-001");
  });

  it("gives simultaneous intakes consecutive folios with no gaps or repeats", async () => {
    const actor = await makeStaff();
    const orders = await Promise.all(
      Array.from({ length: 12 }, (_, i) =>
        createOrder(
          orderInput({
            customer: { name: `Cliente ${i}`, phone: `52667000${String(i).padStart(4, "0")}`, email: null },
            device: { kind: "PHONE", brand: "Apple", model: "iPhone 13", serial: null, color: "" },
          }),
          actor,
          NOW
        )
      )
    );
    const sequences = orders.map((o) => Number(o.folio.split("-")[2])).sort((a, b) => a - b);
    expect(sequences).toEqual(Array.from({ length: 12 }, (_, i) => i + 1));
  });

  it("recognizes a returning customer by phone and a returning device by serial", async () => {
    const actor = await makeStaff();
    const first = await createOrder(orderInput(), actor, NOW);
    const second = await createOrder(
      orderInput({ customer: { name: "Ana T.", phone: "526671234567", email: null } }),
      actor,
      NOW
    );

    expect(await prisma.customer.count()).toBe(1);
    expect(await prisma.device.count()).toBe(1);
    const a = await prisma.order.findUniqueOrThrow({ where: { id: first.id } });
    const b = await prisma.order.findUniqueOrThrow({ where: { id: second.id } });
    expect(a.deviceId).toBe(b.deviceId);
    // The name and the email already on file both stay.
    expect(await prisma.customer.findFirstOrThrow()).toMatchObject({ name: "Ana Torres", email: "ana@example.com" });
  });

  it("queues no email for a customer without one", async () => {
    const actor = await makeStaff();
    await createOrder(orderInput({ customer: { name: "Luis", phone: "526679998877", email: null } }), actor, NOW);
    expect(await prisma.notification.count()).toBe(0);
  });

  it("flags a device that comes back inside its warranty", async () => {
    const owner = await makeStaff("OWNER");
    const order = await orderAwaitingApproval(owner);
    await decideQuote({ quoteId: order.quoteId, approve: true, reason: "", by: { kind: "staff", actor: owner, channel: "IN_PERSON" } });
    await transitionOrder({ orderId: order.id, to: "IN_REPAIR", note: "" }, owner);
    await transitionOrder({ orderId: order.id, to: "READY", note: "" }, owner);
    await recordPayment({ orderId: order.id, kind: "PAYMENT", method: "CASH", amountCents: QUOTE_TOTAL_CENTS, note: "" }, owner);
    await transitionOrder({ orderId: order.id, to: "DELIVERED", note: "" }, owner, NOW);

    const inside = await createOrder(orderInput(), owner, new Date(NOW.getTime() + 30 * 86_400_000));
    expect(inside.warrantyOfFolio).toBe(order.folio);
    const notes = await prisma.orderEvent.findMany({ where: { orderId: inside.id, type: "NOTE" } });
    expect(notes[0]?.isPublic).toBe(false);

    const outside = await createOrder(orderInput(), owner, new Date(NOW.getTime() + 120 * 86_400_000));
    expect(outside.warrantyOfFolio).toBeNull();
  });
});

describe("transitionOrder", () => {
  it("moves the order and writes a public event", async () => {
    const tech = await makeStaff("TECHNICIAN");
    const order = await createOrder(orderInput(), tech, NOW);
    await transitionOrder({ orderId: order.id, to: "DIAGNOSING", note: "" }, tech, NOW);

    const saved = await prisma.order.findUniqueOrThrow({ where: { id: order.id }, include: { events: { orderBy: { createdAt: "asc" } } } });
    expect(saved.status).toBe("DIAGNOSING");
    expect(saved.events.at(-1)).toMatchObject({ type: "STATUS_CHANGED", fromStatus: "RECEIVED", toStatus: "DIAGNOSING", actorId: tech.id });
  });

  it("refuses a move the table does not have, and a move only a quote can make", async () => {
    const owner = await makeStaff();
    const order = await createOrder(orderInput(), owner);
    await expect(transitionOrder({ orderId: order.id, to: "READY", note: "" }, owner)).rejects.toMatchObject({ code: "INVALID_TRANSITION" });
    await transitionOrder({ orderId: order.id, to: "DIAGNOSING", note: "" }, owner);
    await expect(transitionOrder({ orderId: order.id, to: "AWAITING_APPROVAL", note: "" }, owner)).rejects.toMatchObject({ code: "INVALID_TRANSITION" });
    await expect(transitionOrder({ orderId: "missing", to: "DIAGNOSING", note: "" }, owner)).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("enforces who may make each move", async () => {
    const desk = await makeStaff("FRONT_DESK");
    const tech = await makeStaff("TECHNICIAN");
    const order = await createOrder(orderInput(), desk);
    await expect(transitionOrder({ orderId: order.id, to: "DIAGNOSING", note: "" }, desk)).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(transitionOrder({ orderId: order.id, to: "CANCELLED", note: "No quiso esperar" }, tech)).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("lets only one of two conflicting moves win", async () => {
    const owner = await makeStaff();
    const order = await orderAwaitingApproval(owner);
    await decideQuote({ quoteId: order.quoteId, approve: true, reason: "", by: { kind: "staff", actor: owner, channel: "PHONE" } });
    // From APPROVED, starting the repair and cancelling exclude each other:
    // whichever commits first makes the other one illegal.
    const results = await Promise.allSettled([
      transitionOrder({ orderId: order.id, to: "IN_REPAIR", note: "" }, owner),
      transitionOrder({ orderId: order.id, to: "CANCELLED", note: "El cliente se arrepintió" }, owner),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const loser = results.find((r) => r.status === "rejected");
    expect(loser).toMatchObject({ reason: { code: "INVALID_TRANSITION" } });
    // The earlier move to DIAGNOSING, plus the single winner of the race.
    const events = await prisma.orderEvent.count({ where: { orderId: order.id, type: "STATUS_CHANGED" } });
    expect(events).toBe(2);
  });

  it("requires a reason to cancel, and a refund first if money was taken", async () => {
    const owner = await makeStaff();
    const order = await orderAwaitingApproval(owner);
    await expect(transitionOrder({ orderId: order.id, to: "CANCELLED", note: "  " }, owner)).rejects.toMatchObject({ code: "NOTE_REQUIRED" });

    await decideQuote({ quoteId: order.quoteId, approve: true, reason: "", by: { kind: "staff", actor: owner, channel: "PHONE" } });
    await recordPayment({ orderId: order.id, kind: "PAYMENT", method: "CARD", amountCents: 50_000, note: "Anticipo" }, owner);
    await expect(transitionOrder({ orderId: order.id, to: "CANCELLED", note: "Sin refacción" }, owner)).rejects.toMatchObject({ code: "PAID_ORDER" });

    await recordPayment({ orderId: order.id, kind: "REFUND", method: "CARD", amountCents: 50_000, note: "" }, owner);
    await transitionOrder({ orderId: order.id, to: "CANCELLED", note: "Sin refacción" }, owner, NOW);
    const saved = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(saved).toMatchObject({ status: "CANCELLED", cancelledAt: NOW });
  });

  it("does not start a repair nobody approved", async () => {
    const owner = await makeStaff();
    const order = await orderAwaitingApproval(owner);
    await decideQuote({ quoteId: order.quoteId, approve: false, reason: "Muy caro", by: { kind: "staff", actor: owner, channel: "PHONE" } });
    await transitionOrder({ orderId: order.id, to: "READY", note: "" }, owner);
    await expect(transitionOrder({ orderId: order.id, to: "IN_REPAIR", note: "" }, owner)).rejects.toMatchObject({ code: "NO_APPROVED_QUOTE" });
  });

  it("will not hand over a device with a balance, and starts the warranty when it does", async () => {
    const owner = await makeStaff();
    const order = await orderAwaitingApproval(owner);
    await decideQuote({ quoteId: order.quoteId, approve: true, reason: "", by: { kind: "staff", actor: owner, channel: "IN_PERSON" } });
    await transitionOrder({ orderId: order.id, to: "IN_REPAIR", note: "" }, owner);
    await transitionOrder({ orderId: order.id, to: "WAITING_PARTS", note: "Llega el jueves" }, owner);
    await transitionOrder({ orderId: order.id, to: "IN_REPAIR", note: "" }, owner);
    await transitionOrder({ orderId: order.id, to: "READY", note: "" }, owner, NOW);

    await expect(transitionOrder({ orderId: order.id, to: "DELIVERED", note: "" }, owner)).rejects.toMatchObject({ code: "BALANCE_PENDING" });
    await recordPayment({ orderId: order.id, kind: "PAYMENT", method: "CASH", amountCents: QUOTE_TOTAL_CENTS, note: "" }, owner);
    await transitionOrder({ orderId: order.id, to: "DELIVERED", note: "" }, owner, NOW);

    const saved = await prisma.order.findUniqueOrThrow({ where: { id: order.id }, include: { notifications: { orderBy: { createdAt: "asc" } } } });
    expect(saved.readyAt).toEqual(NOW);
    expect(saved.deliveredAt).toEqual(NOW);
    expect(saved.warrantyUntil).toEqual(new Date(NOW.getTime() + 90 * 86_400_000));
    expect(saved.notifications.map((n) => n.template)).toEqual([
      "ORDER_RECEIVED",
      "QUOTE_READY",
      "WAITING_PARTS",
      "READY_FOR_PICKUP",
      "DELIVERED",
    ]);
    const ready = saved.notifications.find((n) => n.template === "READY_FOR_PICKUP");
    expect((ready?.payload as { balanceCents: number }).balanceCents).toBe(QUOTE_TOTAL_CENTS);
  });

  it("gives no warranty for a device returned unrepaired", async () => {
    const owner = await makeStaff();
    const order = await orderAwaitingApproval(owner);
    await decideQuote({ quoteId: order.quoteId, approve: false, reason: "", by: { kind: "staff", actor: owner, channel: "PHONE" } });
    await transitionOrder({ orderId: order.id, to: "READY", note: "" }, owner);
    await transitionOrder({ orderId: order.id, to: "DELIVERED", note: "" }, owner);
    expect((await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).warrantyUntil).toBeNull();
  });
});

describe("order history", () => {
  it("keeps internal notes internal", async () => {
    const owner = await makeStaff();
    const order = await createOrder(orderInput(), owner);
    await addNote({ orderId: order.id, message: "El cliente es exigente", isPublic: false }, owner);
    await addNote({ orderId: order.id, message: "Ya pedimos la pieza", isPublic: true }, owner);
    await expect(addNote({ orderId: order.id, message: "   ", isPublic: true }, owner)).rejects.toMatchObject({ code: "NOTE_REQUIRED" });

    const notes = await prisma.orderEvent.findMany({ where: { orderId: order.id, type: "NOTE" }, orderBy: { createdAt: "asc" } });
    expect(notes.map((n) => n.isPublic)).toEqual([false, true]);
  });

  it("cannot be rewritten or deleted, even by the table owner", async () => {
    const owner = await makeStaff();
    const order = await createOrder(orderInput(), owner);
    const event = await prisma.orderEvent.findFirstOrThrow({ where: { orderId: order.id } });

    await expect(prisma.orderEvent.update({ where: { id: event.id }, data: { message: "nunca pasó" } })).rejects.toThrow(/append-only/);
    await expect(prisma.orderEvent.delete({ where: { id: event.id } })).rejects.toThrow(/append-only/);
    expect((await prisma.orderEvent.findUniqueOrThrow({ where: { id: event.id } })).message).toBe(event.message);
  });
});
