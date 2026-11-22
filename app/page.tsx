import type { CSSProperties } from "react";
import Link from "next/link";
import { BrandMarquee } from "@/components/landing/brand-marquee";
import { Circuit } from "@/components/landing/circuit";
import { CountUp } from "@/components/landing/count-up";
import { HeroPhone } from "@/components/landing/hero-phone";
import { MotionToggle } from "@/components/landing/motion-toggle";
import { SiteNav, type NavLink } from "@/components/landing/site-nav";
import { TrackForm } from "@/components/landing/track-form";
import {
  ArrowRightIcon,
  CameraIcon,
  ChatIcon,
  CheckIcon,
  ClipboardIcon,
  ClockIcon,
  EyeIcon,
  MailIcon,
  PhoneIcon,
  PinIcon,
  ShieldIcon,
  WrenchIcon,
} from "@/components/ui/icons";
import { Logo } from "@/components/ui/primitives";
import { formatPhone, normalizePhone } from "@/lib/customers/phone";
import { env } from "@/lib/env";
import { formatMoney } from "@/lib/money";
import { prisma } from "@/lib/prisma";
import { getBusiness } from "@/lib/settings/business";

const delay = (ms: number) => ({ "--d": `${ms}ms` }) as CSSProperties;

const STEPS = [
  {
    icon: ClipboardIcon,
    title: "Recibimos tu equipo",
    body: "Anotamos cómo llega, con fotos, y te damos un folio. Desde ese momento puedes seguirlo en línea.",
  },
  {
    icon: EyeIcon,
    title: "Diagnóstico y cotización",
    body: "Un técnico lo revisa y te enviamos el precio desglosado: refacciones, mano de obra e impuestos.",
  },
  {
    icon: CheckIcon,
    title: "Tú decides",
    body: "Apruebas o rechazas desde tu celular. No tocamos tu equipo ni te cobramos nada que no hayas aprobado.",
  },
  {
    icon: WrenchIcon,
    title: "Reparamos y te avisamos",
    body: "Te escribimos cuando está listo. Recoges, pagas y te llevas tu garantía por escrito.",
  },
];

const WHAT_YOU_SEE = [
  { icon: CameraIcon, title: "Cómo llegó tu equipo", body: "Antes de abrirlo anotamos su estado y le tomamos fotos." },
  { icon: EyeIcon, title: "Lo que encontramos", body: "El diagnóstico, escrito para ti y no para el técnico." },
  { icon: ClipboardIcon, title: "Cuánto cuesta", body: "Refacciones, mano de obra e IVA, línea por línea." },
  { icon: CheckIcon, title: "Tu aprobación", body: "Con fecha y hora. Sin ella no empezamos ni te cobramos." },
  { icon: ClockIcon, title: "Cuándo está listo", body: "Te avisamos en el momento, sin que tengas que llamar." },
  { icon: ShieldIcon, title: "Tu garantía", body: "Por escrito, con la fecha en que vence." },
];

const NAV_LINKS: NavLink[] = [
  { id: "servicios", label: "Servicios" },
  { id: "como-funciona", label: "Cómo funciona" },
  { id: "transparencia", label: "Transparencia" },
  { id: "contacto", label: "Contacto" },
];

/** Brands only appear once the shop has seen enough of them to make a row worth scrolling. */
const MIN_BRANDS = 4;

export default async function HomePage() {
  const business = await getBusiness();
  const [services, brandRows, sample] = await Promise.all([
    prisma.service.findMany({ where: { active: true }, orderBy: { position: "asc" } }),
    prisma.device.groupBy({ by: ["brand"], _count: { brand: true }, orderBy: { _count: { brand: "desc" } }, take: 14 }),
    // The portfolio demo links straight to an order waiting for its quote.
    env.DEMO_MODE
      ? prisma.order.findFirst({ where: { status: "AWAITING_APPROVAL" }, orderBy: { receivedAt: "desc" }, select: { publicToken: true } })
      : null,
  ]);
  const brands = brandRows.map((row) => row.brand);
  const phone = normalizePhone(business.phone);
  const whatsappHref = business.whatsapp ? `https://wa.me/${business.whatsapp}` : null;

  const stats = [
    { value: 100, suffix: "%", label: "de las reparaciones, aprobadas por el cliente antes de empezar" },
    { value: business.defaultWarrantyDays, suffix: " días", label: "de garantía por escrito en cada reparación" },
    { value: 24, suffix: " h", label: "para tener tu diagnóstico y tu cotización" },
  ];

  return (
    <div className="min-h-screen overflow-x-clip">
      {env.DEMO_MODE && (
        <div className="bg-volt px-4 py-2 text-center text-sm font-medium text-ink">
          Demo de portafolio con datos ficticios.{" "}
          <Link href="/admin/login" className="underline underline-offset-2">
            Entrar al panel del taller
          </Link>
          {sample && (
            <>
              {" · "}
              <Link href={`/r/${sample.publicToken}`} className="underline underline-offset-2">
                Ver una orden como cliente
              </Link>
            </>
          )}
        </div>
      )}

      <SiteNav name={business.name} links={NAV_LINKS} />

      <header id="inicio" className="bench-grid relative overflow-hidden bg-ink text-white">
        <Circuit />

        {/* pt clears the floating navigation, which overlaps the top of the hero. */}
        <div className="relative mx-auto grid max-w-6xl items-center gap-14 px-5 pb-32 pt-28 lg:grid-cols-[1.15fr_1fr] lg:pb-36 lg:pt-32">
          <div>
            <p className="v-enter eyebrow text-volt" style={delay(60)}>
              {business.city ? `${business.tagline} · ${business.city}` : business.tagline}
            </p>
            <h1 className="v-enter mt-5 text-balance text-4xl font-bold leading-[1.05] sm:text-5xl lg:text-6xl" style={delay(140)}>
              Tu equipo en buenas manos.
              <span className="block text-volt">Y tú, siempre al tanto.</span>
            </h1>
            <p className="v-enter mt-6 max-w-xl text-pretty text-lg leading-relaxed text-white/70" style={delay(220)}>
              Reparamos celulares, laptops, tablets y consolas. Sigues cada paso desde tu celular y nadie toca tu equipo
              hasta que apruebes el precio.
            </p>
            <div className="v-enter mt-8 flex flex-wrap gap-3" style={delay(300)}>
              <a href="#rastrear" className="btn btn-primary px-5 py-3">
                Rastrear mi equipo <ArrowRightIcon />
              </a>
              <a href="#como-funciona" className="btn border border-white/20 px-5 py-3 text-white hover:bg-white/10">
                Cómo funciona
              </a>
            </div>
            <ul className="v-enter mt-10 grid max-w-xl gap-3 text-sm text-white/85 sm:grid-cols-3" style={delay(380)}>
              {[
                { Icon: ClockIcon, label: "Diagnóstico en 24 h" },
                { Icon: ShieldIcon, label: `Garantía de ${business.defaultWarrantyDays} días` },
                { Icon: CheckIcon, label: "Precio aprobado por ti" },
              ].map(({ Icon, label }) => (
                <li key={label} className="flex items-center gap-2.5 rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 backdrop-blur-sm">
                  <Icon className="shrink-0 text-base text-volt" />
                  {label}
                </li>
              ))}
            </ul>
          </div>

          <div className="v-enter flex flex-col items-center" style={delay(260)}>
            <div className="v-loop">
              <HeroPhone shopName={business.name} warrantyDays={business.defaultWarrantyDays} currency={business.currency} />
            </div>
            <MotionToggle className="mt-6" />
          </div>
        </div>
      </header>

      <section id="rastrear" className="relative z-10 mx-auto -mt-20 max-w-5xl px-5" aria-labelledby="track-title">
        <div className="v-enter grid gap-6 rounded-2xl bg-white p-6 text-ink shadow-lift ring-1 ring-line sm:p-8 lg:grid-cols-[0.8fr_2fr] lg:items-center lg:gap-10" style={delay(420)}>
          <div>
            <p className="eyebrow text-muted">Seguimiento en línea</p>
            <h2 id="track-title" className="mt-2 text-2xl font-bold">
              ¿Cómo va mi reparación?
            </h2>
            <p className="mt-1.5 text-sm text-muted">Sin llamar y sin esperar en línea.</p>
          </div>
          <TrackForm />
        </div>
      </section>

      <main>
        {brands.length >= MIN_BRANDS && (
          <div className="mt-16">
            <BrandMarquee brands={brands} />
          </div>
        )}

        <section id="servicios" className="mx-auto max-w-6xl px-5 py-20">
          <div className="v-reveal">
            <p className="eyebrow text-muted">Servicios</p>
            <h2 className="mt-2 max-w-2xl text-balance text-3xl font-bold sm:text-4xl">Lo que más reparamos</h2>
            <p className="mt-3 max-w-2xl text-pretty text-muted">
              Los precios son desde: el costo final depende del modelo y lo sabes antes de que empecemos, en tu cotización.
            </p>
          </div>
          {services.length === 0 ? (
            <p className="mt-10 rounded-xl border border-dashed border-line px-5 py-10 text-center text-sm text-muted">
              Pregunta en el taller por el servicio que necesitas.
            </p>
          ) : (
            <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {services.map((service) => (
                <li
                  key={service.id}
                  className="v-reveal card group relative flex flex-col overflow-hidden p-6 transition duration-300 hover:-translate-y-1 hover:border-ink hover:shadow-lift"
                >
                  <span className="absolute inset-x-0 top-0 h-1 origin-left scale-x-0 bg-volt transition-transform duration-300 ease-out group-hover:scale-x-100" />
                  <h3 className="text-lg font-semibold">{service.name}</h3>
                  <p className="mt-2 flex-1 text-sm leading-relaxed text-muted">{service.description}</p>
                  <div className="mt-5 flex items-end justify-between border-t border-line pt-4">
                    <p>
                      {service.fromPriceCents !== null && (
                        <>
                          <span className="block text-xs text-muted">desde</span>
                          <span className="font-display text-xl font-bold tabular-nums">
                            {formatMoney(service.fromPriceCents, business.currency).replace(".00", "")}
                          </span>
                        </>
                      )}
                    </p>
                    {service.turnaround && (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-paper px-2.5 py-1 text-xs font-medium transition group-hover:bg-volt-soft">
                        <ClockIcon /> {service.turnaround}
                      </span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section id="como-funciona" className="scroll-mt-8 border-y border-line bg-white">
          <div className="mx-auto max-w-6xl px-5 py-20">
            <div className="v-reveal">
              <p className="eyebrow text-muted">Cómo funciona</p>
              <h2 className="mt-2 max-w-2xl text-balance text-3xl font-bold sm:text-4xl">Cuatro pasos, cero sorpresas</h2>
            </div>
            <ol className="relative mt-12 grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
              {/* The wire that joins the four steps on a wide screen, drawn as you scroll. */}
              <span className="absolute left-[22px] right-[calc((100%-7.5rem)/4-22px)] top-[22px] hidden h-0.5 bg-line lg:block" aria-hidden="true">
                <span className="v-connector-fill absolute inset-0 bg-ink" />
              </span>
              {STEPS.map((step, index) => (
                <li key={step.title} className="v-reveal relative">
                  <div className="flex items-center gap-3">
                    <span className="relative grid h-11 w-11 place-items-center rounded-xl bg-ink text-xl text-volt shadow-card">
                      <step.icon />
                    </span>
                    <span className="font-mono text-sm text-muted">0{index + 1}</span>
                  </div>
                  <h3 className="mt-4 text-lg font-semibold">{step.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted">{step.body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section id="transparencia" className="bench-grid bg-ink text-white" aria-labelledby="transparency-title">
          <div className="mx-auto grid max-w-6xl gap-14 px-5 py-20 lg:grid-cols-2 lg:gap-20">
            <div>
              <div className="v-reveal">
                <p className="eyebrow text-volt">Transparencia</p>
                <h2 id="transparency-title" className="mt-2 text-balance text-3xl font-bold sm:text-4xl">
                  Sabes lo mismo que nosotros, al mismo tiempo
                </h2>
                <p className="mt-4 max-w-lg text-pretty leading-relaxed text-white/70">
                  Cada movimiento de tu orden queda registrado con fecha y hora, y tú lo ves desde un enlace privado. Nadie
                  puede borrarlo ni cambiarlo después: ni siquiera nosotros.
                </p>
              </div>
              <dl className="mt-10 grid gap-6 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
                {stats.map((stat, index) => (
                  <div key={stat.label} className="v-reveal border-l-2 border-volt pl-4">
                    <dt className="sr-only">{stat.label}</dt>
                    <dd>
                      <p className="font-display text-4xl font-bold text-volt">
                        <CountUp to={stat.value} delay={index * 180} />
                        <span aria-hidden="true">{stat.suffix}</span>
                        <span className="sr-only">
                          {stat.value}
                          {stat.suffix}
                        </span>
                      </p>
                      <p className="mt-1 text-sm text-white/60">{stat.label}</p>
                    </dd>
                  </div>
                ))}
              </dl>
              <a href="#rastrear" className="btn btn-primary mt-10">
                Rastrear mi equipo <ArrowRightIcon />
              </a>
            </div>

            <ol className="v-steps relative space-y-8 pl-14" aria-label="Lo que ves en tu seguimiento">
              {/* The line fills as you scroll past it, with a spark at its tip. */}
              <span className="absolute bottom-5 left-[19px] top-5 w-0.5 overflow-hidden bg-white/10" aria-hidden="true">
                <span className="v-line-fill absolute inset-0 bg-volt" />
              </span>
              <span className="absolute bottom-5 left-[19px] top-5 w-0.5" aria-hidden="true">
                <span className="v-spark absolute inset-0">
                  <span className="absolute -bottom-1.5 -left-[5px] h-3 w-3 rounded-full bg-volt shadow-[0_0_14px_4px_rgb(255_212_0/0.55)]" />
                </span>
              </span>
              {WHAT_YOU_SEE.map((item) => (
                <li key={item.title} className="v-reveal relative">
                  <span className="absolute -left-14 grid h-10 w-10 place-items-center rounded-xl border border-white/10 bg-ink-800 text-lg text-volt">
                    <item.icon />
                  </span>
                  <h3 className="pt-1 font-semibold">{item.title}</h3>
                  <p className="mt-1 text-sm text-white/60">{item.body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section id="contacto" className="mx-auto max-w-6xl px-5 py-20">
          <div className="grid gap-10 lg:grid-cols-2">
            <div className="v-reveal">
              <p className="eyebrow text-muted">Contacto</p>
              <h2 className="mt-2 text-balance text-3xl font-bold sm:text-4xl">Pasa al taller o escríbenos</h2>
              <ul className="mt-8 space-y-4 text-sm">
                {business.address && (
                  <li className="flex items-start gap-3">
                    <PinIcon className="mt-0.5 text-lg" />
                    <span>
                      {business.address}
                      {business.city && <span className="block text-muted">{business.city}</span>}
                    </span>
                  </li>
                )}
                {phone && (
                  <li className="flex items-center gap-3">
                    <PhoneIcon className="text-lg" />
                    <a href={`tel:+${phone}`} className="font-medium underline-offset-4 hover:underline">
                      {formatPhone(phone)}
                    </a>
                  </li>
                )}
                {business.email && (
                  <li className="flex items-center gap-3">
                    <MailIcon className="text-lg" />
                    <a href={`mailto:${business.email}`} className="font-medium underline-offset-4 hover:underline">
                      {business.email}
                    </a>
                  </li>
                )}
              </ul>
              {whatsappHref && (
                <a href={whatsappHref} className="btn btn-dark mt-8" rel="noopener noreferrer" target="_blank">
                  <ChatIcon /> Escribir por WhatsApp
                </a>
              )}
            </div>
            <div className="v-reveal card p-6 sm:p-8">
              <h3 className="text-lg font-semibold">Horario</h3>
              {business.hours.length === 0 ? (
                <p className="mt-3 text-sm text-muted">Consulta nuestro horario por teléfono.</p>
              ) : (
                <dl className="mt-4 divide-y divide-line text-sm">
                  {business.hours.map((row) => (
                    <div key={row.label} className="flex justify-between gap-6 py-3">
                      <dt className="text-muted">{row.label}</dt>
                      <dd className="font-medium">{row.value}</dd>
                    </div>
                  ))}
                </dl>
              )}
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-line bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-5 py-8 text-sm text-muted">
          <Logo name={business.name} />
          <p>
            Sistema de gestión de taller hecho por{" "}
            <a href="https://github.com/filibertosanudo" className="font-medium text-ink underline-offset-4 hover:underline">
              Filiberto Sañudo
            </a>
          </p>
          <Link href="/admin/login" className="font-medium text-ink underline-offset-4 hover:underline">
            Acceso del personal
          </Link>
        </div>
      </footer>
    </div>
  );
}
