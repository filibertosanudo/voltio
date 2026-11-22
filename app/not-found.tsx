import Link from "next/link";
import { Logo } from "@/components/ui/primitives";

export default function NotFound() {
  return (
    <main className="grid min-h-screen place-items-center px-5">
      <div className="max-w-md text-center">
        <Logo />
        <h1 className="mt-8 text-3xl font-bold">No encontramos esa página</h1>
        <p className="mt-3 text-muted">
          Si buscabas tu reparación, revisa que el enlace esté completo o búscala con el folio de tu recibo.
        </p>
        <Link href="/#rastrear" className="btn btn-primary mt-8">
          Rastrear mi equipo
        </Link>
      </div>
    </main>
  );
}
