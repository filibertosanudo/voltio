import { describe, expect, it } from "vitest";
import {
  ORDER_STATUSES,
  OPEN_STATUSES,
  PUBLIC_STEPS,
  STATUS_META,
  TRANSITIONS,
  canDraftQuote,
  canSendQuote,
  isTerminal,
  manualTargets,
  publicStepIndex,
  transitionRule,
} from "./status";

describe("order state machine", () => {
  it("has a transition table and a label for every status", () => {
    for (const status of ORDER_STATUSES) {
      expect(TRANSITIONS[status]).toBeDefined();
      expect(STATUS_META[status].label).not.toBe("");
      expect(STATUS_META[status].publicLabel).not.toBe("");
    }
  });

  it("ends only at DELIVERED and CANCELLED", () => {
    expect(ORDER_STATUSES.filter(isTerminal)).toEqual(["DELIVERED", "CANCELLED"]);
    expect(OPEN_STATUSES).not.toContain("DELIVERED");
  });

  it("can reach DELIVERED from every open status", () => {
    const reaches = (from: (typeof ORDER_STATUSES)[number], seen = new Set<string>()): boolean => {
      if (from === "DELIVERED") return true;
      if (seen.has(from)) return false;
      seen.add(from);
      return Object.keys(TRANSITIONS[from]).some((to) => reaches(to as (typeof ORDER_STATUSES)[number], seen));
    };
    for (const status of OPEN_STATUSES) expect(reaches(status), status).toBe(true);
  });

  it("only enters AWAITING_APPROVAL, and only leaves it for a decision, through a quote", () => {
    for (const from of ORDER_STATUSES) {
      const rule = transitionRule(from, "AWAITING_APPROVAL");
      if (rule) expect(rule.via, from).toBe("quote");
    }
    expect(transitionRule("AWAITING_APPROVAL", "APPROVED")?.via).toBe("quote");
    expect(transitionRule("AWAITING_APPROVAL", "QUOTE_REJECTED")?.via).toBe("quote");
  });

  it("never lets work start straight from a diagnosis", () => {
    expect(transitionRule("DIAGNOSING", "IN_REPAIR")).toBeUndefined();
    expect(transitionRule("RECEIVED", "IN_REPAIR")).toBeUndefined();
    expect(transitionRule("QUOTE_REJECTED", "IN_REPAIR")).toBeUndefined();
  });

  it("keeps the counter's moves and the bench's moves apart", () => {
    expect(manualTargets("READY", "FRONT_DESK")).toEqual(["DELIVERED"]);
    expect(manualTargets("READY", "TECHNICIAN")).toEqual(["IN_REPAIR"]);
    expect(manualTargets("IN_REPAIR", "FRONT_DESK")).toEqual([]);
    expect(manualTargets("RECEIVED", "OWNER")).toEqual(["DIAGNOSING", "CANCELLED"]);
    expect(manualTargets("DELIVERED", "OWNER")).toEqual([]);
  });

  it("allows drafting a quote exactly where one can be sent", () => {
    expect(ORDER_STATUSES.filter(canDraftQuote)).toEqual(["DIAGNOSING", "IN_REPAIR", "QUOTE_REJECTED"]);
    expect(canSendQuote("DIAGNOSING", "TECHNICIAN")).toBe(true);
    expect(canSendQuote("DIAGNOSING", "FRONT_DESK")).toBe(false);
    expect(canSendQuote("READY", "OWNER")).toBe(false);
  });

  it("maps every status onto the customer's six steps", () => {
    for (const status of ORDER_STATUSES) {
      const index = publicStepIndex(status);
      expect(index).toBeGreaterThanOrEqual(-1);
      expect(index).toBeLessThan(PUBLIC_STEPS.length);
    }
    expect(publicStepIndex("CANCELLED")).toBe(-1);
    expect(publicStepIndex("WAITING_PARTS")).toBe(publicStepIndex("IN_REPAIR"));
  });
});
