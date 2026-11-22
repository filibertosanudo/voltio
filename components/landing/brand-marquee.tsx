import { BoltIcon } from "@/components/ui/icons";

function Row({ brands, duplicate = false }: { brands: string[]; duplicate?: boolean }) {
  return (
    <ul className={`v-marquee-row ${duplicate ? "v-marquee-dup" : ""}`} aria-hidden={duplicate || undefined}>
      {brands.map((brand) => (
        <li key={brand} className="flex items-center gap-10 whitespace-nowrap font-display text-2xl font-bold text-ink/70 sm:text-3xl">
          {brand}
          <BoltIcon className="text-base text-volt-deep" />
        </li>
      ))}
    </ul>
  );
}

/**
 * The brands of the devices this shop has actually received, from its own
 * records: a claim the data backs, not a logo wall. The second row is a
 * copy that makes the loop seamless; screen readers get the list once.
 */
export function BrandMarquee({ brands }: { brands: string[] }) {
  return (
    <section aria-labelledby="brands-title" className="v-loop overflow-hidden border-b border-line py-10">
      <h2 id="brands-title" className="eyebrow mb-6 text-balance px-5 text-center text-muted">
        Marcas que ya pasaron por nuestro banco
      </h2>
      <div className="v-marquee [mask-image:linear-gradient(to_right,transparent,black_8%,black_92%,transparent)]">
        <div className="v-marquee-track">
          <Row brands={brands} />
          <Row brands={brands} duplicate />
        </div>
      </div>
    </section>
  );
}
