import { ActionForm, Field, FormMessage, SubmitButton } from "@/components/ui/form";
import { SearchIcon } from "@/components/ui/icons";
import { lookupOrderAction } from "@/lib/track/actions";

/**
 * Folio plus the last four digits of the phone: enough to find one order,
 * not enough to browse them. Stacked on a phone, one row on a wide screen.
 */
export function TrackForm() {
  return (
    <ActionForm action={lookupOrderAction} className="grid gap-4 md:grid-cols-[1.3fr_1fr_auto] md:items-start" hideMessage>
      <Field label="Folio de tu recibo" name="folio" hint="Viene arriba de tu recibo.">
        <input
          id="folio"
          name="folio"
          className="input font-mono uppercase placeholder:normal-case"
          placeholder="VT-261115-001"
          autoComplete="off"
          autoCapitalize="characters"
          required
        />
      </Field>
      <Field label="Últimos 4 dígitos de tu teléfono" name="lastFour">
        <input
          id="lastFour"
          name="lastFour"
          className="input font-mono tracking-[0.3em]"
          placeholder="0000"
          inputMode="numeric"
          maxLength={4}
          autoComplete="off"
          required
        />
      </Field>
      {/* Clears the label row so the button lines up with the inputs. */}
      <div className="md:pt-[26px]">
        <SubmitButton className="btn btn-primary w-full whitespace-nowrap py-3" pendingLabel="Buscando…">
          <SearchIcon /> Ver mi reparación
        </SubmitButton>
      </div>
      <FormMessage className="md:col-span-3" />
    </ActionForm>
  );
}
