"use client";

import { useRef, useState, useTransition } from "react";
import { Field } from "@/components/ui/form";
import { lookupCustomerAction, type CustomerMatch } from "@/lib/customers/actions";

type Initial = { name?: string; phone?: string; email?: string };

/**
 * The intake form's customer fields, phone first: the phone is how a
 * returning customer is found, so it is asked before anything else, and
 * once it has ten digits the rest of what is on file fills itself in. Their
 * earlier devices are offered too, one click each, for the device fields.
 *
 * Only a convenience: the order action still finds the customer by phone
 * and the device by serial on its own, whatever these fields say.
 */
export function CustomerLookup({ initial }: { initial: Initial }) {
  const [match, setMatch] = useState<CustomerMatch | null>(null);
  const [checked, setChecked] = useState<string | null>(null);
  const [looking, startLookup] = useTransition();
  const lastAsked = useRef<string | null>(null);
  const root = useRef<HTMLDivElement>(null);

  function setField(name: string, value: string) {
    const control = root.current?.closest("form")?.elements.namedItem(name);
    if (control instanceof HTMLInputElement || control instanceof HTMLSelectElement || control instanceof HTMLTextAreaElement) {
      control.value = value;
    }
  }

  function onPhoneChange(value: string) {
    const digits = value.replace(/\D/g, "");
    if (digits.length < 10) {
      lastAsked.current = null;
      setMatch(null);
      setChecked(null);
      return;
    }
    if (digits === lastAsked.current) return;
    lastAsked.current = digits;
    startLookup(async () => {
      const found = await lookupCustomerAction(value).catch(() => null);
      // A newer number was typed while this one was in flight.
      if (lastAsked.current !== digits) return;
      setMatch(found);
      setChecked(digits);
      if (found) {
        setField("customerName", found.name);
        if (found.email) setField("email", found.email);
      }
    });
  }

  function fillDevice(device: CustomerMatch["devices"][number]) {
    setField("kind", device.kind);
    setField("brand", device.brand);
    setField("model", device.model);
    setField("color", device.color);
    setField("serial", device.serial);
  }

  return (
    <div ref={root} className="grid gap-4 p-5 sm:grid-cols-2">
      <Field label="Teléfono" name="phone" hint="10 dígitos. Si ya es cliente, llenamos lo demás." className="sm:col-span-2">
        <input
          id="phone"
          name="phone"
          className="input"
          inputMode="tel"
          defaultValue={initial.phone}
          onChange={(event) => onPhoneChange(event.target.value)}
          autoComplete="off"
          autoFocus={!initial.phone}
          required
        />
      </Field>

      <div className="sm:col-span-2" aria-live="polite">
        {looking ? (
          <p className="text-sm text-muted">Buscando cliente…</p>
        ) : match ? (
          <div className="rounded-lg border border-line bg-paper p-3">
            <p className="text-sm">
              <span className="font-semibold">Cliente registrado</span>
              <span className="text-muted">
                {" "}
                · {match.orders === 1 ? "1 orden" : `${match.orders} órdenes`} · {match.phone}
              </span>
            </p>
            {match.devices.length > 0 && (
              <div className="mt-2.5">
                <p className="text-xs text-muted">Equipos que ha traído, para llenar la sección de equipo:</p>
                <ul className="mt-1.5 flex flex-wrap gap-2">
                  {match.devices.map((device) => (
                    <li key={device.id}>
                      <button type="button" className="btn btn-ghost btn-sm border border-line" onClick={() => fillDevice(device)}>
                        {device.brand} {device.model}
                        <span className="text-muted">· {device.kindLabel}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ) : checked ? (
          <p className="text-sm text-muted">Cliente nuevo: se registra con esta orden.</p>
        ) : null}
      </div>

      <Field label="Nombre completo" name="customerName" className="sm:col-span-2">
        <input id="customerName" name="customerName" className="input" defaultValue={initial.name} autoComplete="off" required />
      </Field>
      <Field label="Correo (opcional)" name="email" hint="Para avisarle de cada cambio." className="sm:col-span-2">
        <input id="email" name="email" type="email" className="input" defaultValue={initial.email} autoComplete="off" />
      </Field>
    </div>
  );
}
