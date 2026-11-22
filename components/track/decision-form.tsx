"use client";

import { useState } from "react";
import { ActionForm, SubmitButton } from "@/components/ui/form";
import { CheckIcon } from "@/components/ui/icons";
import { decideQuoteAction } from "@/lib/track/actions";

/**
 * The customer's answer to one quote. The quote's id travels with the
 * answer, so "yes" always means yes to the price on screen: if the shop
 * replaced the quote in the meantime, the server refuses and the page
 * reloads with the new one.
 */
export function DecisionForm({ token, quoteId, total }: { token: string; quoteId: string; total: string }) {
  const [rejecting, setRejecting] = useState(false);

  return (
    <ActionForm action={decideQuoteAction} className="space-y-3">
      <input type="hidden" name="token" value={token} />
      <input type="hidden" name="quoteId" value={quoteId} />

      {rejecting ? (
        <div className="v-enter space-y-3">
          <label htmlFor="reason" className="label">
            ¿Nos cuentas por qué? (opcional)
          </label>
          <textarea id="reason" name="reason" rows={2} maxLength={300} className="input" placeholder="Por ejemplo: prefiero cambiar de equipo" />
          <div className="flex flex-wrap gap-2">
            <SubmitButton name="decision" value="reject" className="btn btn-danger flex-1" pendingLabel="Enviando…">
              Confirmar rechazo
            </SubmitButton>
            <button type="button" className="btn btn-ghost" onClick={() => setRejecting(false)}>
              Volver
            </button>
          </div>
        </div>
      ) : (
        <>
          <input type="hidden" name="reason" value="" />
          <SubmitButton name="decision" value="approve" className="btn btn-primary w-full py-3.5 text-base" pendingLabel="Enviando…">
            <CheckIcon /> Aprobar reparación por {total}
          </SubmitButton>
          <button type="button" className="btn btn-ghost w-full" onClick={() => setRejecting(true)}>
            No quiero la reparación
          </button>
          <p className="text-center text-xs text-muted">
            Al aprobar autorizas el trabajo descrito por ese total. Queda registrado con fecha y hora.
          </p>
        </>
      )}
    </ActionForm>
  );
}
