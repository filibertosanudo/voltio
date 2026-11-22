"use client";

import { useState } from "react";
import { ActionForm, SubmitButton } from "@/components/ui/form";
import { PlusIcon, XIcon } from "@/components/ui/icons";
import type { QuoteItemKind } from "@/lib/generated/prisma/enums";
import { ITEM_KIND_LABEL } from "@/lib/labels";
import { formatMoney, parseMoneyToCents } from "@/lib/money";
import { saveQuoteAction } from "@/lib/quotes/actions";
import { computeTotals } from "@/lib/quotes/totals";

export type EditorLine = { kind: QuoteItemKind; description: string; quantity: string; unitPrice: string };

const EMPTY: EditorLine = { kind: "PART", description: "", quantity: "1", unitPrice: "" };

/**
 * The technician's quote builder. The totals shown while typing are a
 * preview computed with the same function the server uses; the server
 * recomputes them from the lines on save and stores only its own numbers.
 */
export function QuoteEditor({
  orderId,
  initialLines,
  initialNotes,
  taxRateBps,
  currency,
  canSend,
}: {
  orderId: string;
  initialLines: EditorLine[];
  initialNotes: string;
  taxRateBps: number;
  currency: string;
  canSend: boolean;
}) {
  const [lines, setLines] = useState<EditorLine[]>(initialLines.length > 0 ? initialLines : [EMPTY]);

  const update = (index: number, patch: Partial<EditorLine>) =>
    setLines((current) => current.map((line, i) => (i === index ? { ...line, ...patch } : line)));

  const filled = lines.filter((line) => line.description.trim() !== "" || line.unitPrice.trim() !== "");
  const preview = computeTotals(
    filled.map((line) => ({
      quantity: Number.parseInt(line.quantity, 10) || 0,
      unitPriceCents: parseMoneyToCents(line.unitPrice) ?? 0,
    })),
    taxRateBps
  );
  const money = (cents: number) => formatMoney(cents, currency);

  return (
    <ActionForm action={saveQuoteAction} className="space-y-4 p-5">
      <input type="hidden" name="orderId" value={orderId} />
      <input type="hidden" name="items" value={JSON.stringify(filled)} />

      <ul className="space-y-3">
        {lines.map((line, index) => (
          <li key={index} className="grid grid-cols-12 gap-2 rounded-lg border border-line bg-paper/50 p-3">
            <select
              aria-label="Tipo de concepto"
              className="input col-span-12 sm:col-span-3"
              value={line.kind}
              onChange={(event) => update(index, { kind: event.target.value as QuoteItemKind })}
            >
              {Object.entries(ITEM_KIND_LABEL).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            <input
              aria-label="Descripción"
              className="input col-span-12 sm:col-span-5"
              placeholder="Pantalla OLED original"
              value={line.description}
              maxLength={200}
              onChange={(event) => update(index, { description: event.target.value })}
            />
            <input
              aria-label="Cantidad"
              className="input col-span-3 text-center sm:col-span-1 sm:px-1"
              inputMode="numeric"
              value={line.quantity}
              onChange={(event) => update(index, { quantity: event.target.value.replace(/\D/g, "").slice(0, 3) })}
            />
            <input
              aria-label="Precio unitario sin impuesto"
              className="input col-span-7 text-right tabular-nums sm:col-span-2"
              inputMode="decimal"
              placeholder="0.00"
              value={line.unitPrice}
              onChange={(event) => update(index, { unitPrice: event.target.value })}
            />
            <button
              type="button"
              aria-label="Quitar concepto"
              className="col-span-2 grid place-items-center rounded-lg text-muted transition hover:bg-rose-50 hover:text-rose-700 sm:col-span-1"
              onClick={() => setLines((current) => (current.length > 1 ? current.filter((_, i) => i !== index) : [EMPTY]))}
            >
              <XIcon />
            </button>
          </li>
        ))}
      </ul>

      <button type="button" className="btn btn-ghost btn-sm" onClick={() => setLines((current) => [...current, EMPTY])}>
        <PlusIcon /> Agregar concepto
      </button>

      <div>
        <label htmlFor="quote-notes" className="label">
          Nota para el cliente (opcional)
        </label>
        <textarea
          id="quote-notes"
          name="notes"
          rows={2}
          maxLength={1000}
          className="input"
          defaultValue={initialNotes}
          placeholder="La pantalla es original. El tiempo de reparación es de 2 días."
        />
      </div>

      <dl className="ml-auto max-w-xs space-y-1 text-sm">
        <div className="flex justify-between text-muted">
          <dt>Subtotal</dt>
          <dd className="tabular-nums">{money(preview.subtotalCents)}</dd>
        </div>
        <div className="flex justify-between text-muted">
          <dt>IVA ({taxRateBps / 100}%)</dt>
          <dd className="tabular-nums">{money(preview.taxCents)}</dd>
        </div>
        <div className="flex justify-between border-t border-line pt-2 text-base font-semibold">
          <dt>Total</dt>
          <dd className="tabular-nums">{money(preview.totalCents)}</dd>
        </div>
      </dl>

      <div className="flex flex-wrap justify-end gap-2">
        <SubmitButton name="intent" value="save" className="btn btn-ghost">
          Guardar borrador
        </SubmitButton>
        {canSend && (
          <SubmitButton name="intent" value="send" className="btn btn-primary" pendingLabel="Enviando…">
            Guardar y enviar al cliente
          </SubmitButton>
        )}
      </div>
    </ActionForm>
  );
}
