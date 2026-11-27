"use server";

import { COUNTER_ROLES, requireRole } from "@/lib/auth/guards";
import { DEVICE_KIND_LABEL } from "@/lib/labels";
import type { DeviceKind } from "@/lib/generated/prisma/enums";
import { formatPhone, normalizePhone } from "./phone";
import { findCustomerByPhone } from "./queries";

export type CustomerMatch = {
  name: string;
  email: string;
  phone: string;
  orders: number;
  devices: { id: string; kind: DeviceKind; kindLabel: string; brand: string; model: string; serial: string; color: string }[];
};

/**
 * The intake form asks while the phone is typed. Read-only, and only for
 * the counter: it returns a customer's contact details and devices.
 */
export async function lookupCustomerAction(rawPhone: string): Promise<CustomerMatch | null> {
  await requireRole(...COUNTER_ROLES);

  const phone = normalizePhone(String(rawPhone).slice(0, 40));
  if (!phone) return null;
  const customer = await findCustomerByPhone(phone);
  if (!customer) return null;

  return {
    name: customer.name,
    email: customer.email ?? "",
    phone: formatPhone(phone),
    orders: customer._count.orders,
    devices: customer.devices.map((device) => ({
      id: device.id,
      kind: device.kind,
      kindLabel: DEVICE_KIND_LABEL[device.kind],
      brand: device.brand,
      model: device.model,
      serial: device.serial ?? "",
      color: device.color,
    })),
  };
}
