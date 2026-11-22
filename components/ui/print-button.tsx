"use client";

import { PrinterIcon } from "./icons";

export function PrintButton() {
  return (
    <button type="button" className="btn btn-primary" onClick={() => window.print()}>
      <PrinterIcon /> Imprimir
    </button>
  );
}
