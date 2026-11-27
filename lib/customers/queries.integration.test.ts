import { describe, expect, it } from "vitest";
import { createOrder } from "@/lib/orders/create-order";
import { makeStaff, orderInput } from "@/test/factories";
import { findCustomerByPhone } from "./queries";

const hours = (n: number) => new Date(Date.UTC(2026, 10, 15, 12) + n * 3_600_000);

describe("findCustomerByPhone", () => {
  it("finds a returning customer with their devices, newest first", async () => {
    const desk = await makeStaff("FRONT_DESK");
    await createOrder(orderInput(), desk, hours(0));
    await createOrder(
      orderInput({ device: { kind: "LAPTOP", brand: "Lenovo", model: "ThinkPad T14", serial: "PF3XK9A2", color: "" } }),
      desk,
      hours(1)
    );

    const found = await findCustomerByPhone("526671234567");
    expect(found?.name).toBe("Ana Torres");
    expect(found?._count.orders).toBe(2);
    expect(found?.devices.map((d) => d.model)).toEqual(["ThinkPad T14", "Galaxy S23"]);
  });

  it("returns null for a number nobody has", async () => {
    expect(await findCustomerByPhone("526670000000")).toBeNull();
  });
});
