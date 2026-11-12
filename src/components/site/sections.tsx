import Image from "next/image";
import {
  CalendarCheck,
  Check,
  ChevronDown,
  Clock,
  Gem,
  Heart,
  Leaf,
  MapPin,
  Plus,
  ShieldCheck,
  Smile,
  Sparkles,
  Star,
  Wallet,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { BookButton } from "@/components/booking/booking-modal";
import { Button } from "@/components/ui/button";
import { NextSlot } from "./client-bits";
import { ChannelIcon, WhatsAppIcon, channelHref } from "./brand-icons";
import { GalleryGrid } from "./gallery-grid";
import { formatCOP, formatDuration } from "@/lib/booking/money";
import { formatClock, WEEKDAYS } from "@/lib/booking/time";
import { waLink } from "@/lib/booking/whatsapp";
import { cn } from "@/lib/utils";
import type { SectionContent, BENEFIT_ICONS } from "@/lib/content/sections";
import type { Catalog } from "@/lib/data/public";
import type { BusinessHour, ContactChannel, GalleryItem, Settings } from "@/lib/types";

function SectionHeading({ id, title, subtitle, align = "center" }: { id: string; title: string; subtitle?: string; align?: "center" | "left" }) {
  return (
    <div className={cn("mb-10 max-w-2xl sm:mb-12", align === "center" && "mx-auto text-center")}>
      <h2 id={id} className="font-display text-3xl font-semibold tracking-tight sm:text-4xl md:text-[2.75rem] md:leading-[1.1]">
        {title}
      </h2>
      {subtitle ? <p className="mt-4 text-base text-muted-foreground sm:text-lg">{subtitle}</p> : null}
    </div>
  );
}

function Section({
  id,
  labelledBy,
  className,
  children,
}: {
  id: string;
  labelledBy: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} aria-labelledby={labelledBy} className={cn("scroll-mt-20 px-4 py-20 sm:px-6 sm:py-24", className)}>
      <div className="mx-auto max-w-6xl">{children}</div>
    </section>
  );
}

/* ----------------------------------------------------------------------------- */

export function HeroSection({
  content,
  whatsapp,
  salonName,
}: {
  content: SectionContent<"hero">;
  whatsapp: string;
  salonName: string;
}) {
  return (
    <section aria-labelledby="hero-title" className="relative isolate overflow-hidden px-4 pt-10 pb-20 sm:px-6 sm:pt-16 md:pb-28">
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -top-32 -right-24 size-[34rem] rounded-full bg-[radial-gradient(closest-side,var(--hero-glow-1),transparent)]" />
        <div className="absolute top-40 -left-40 size-[30rem] rounded-full bg-[radial-gradient(closest-side,var(--hero-glow-2),transparent)]" />
      </div>
      <div className="mx-auto grid max-w-6xl items-center gap-12 md:grid-cols-[1.1fr_0.9fr]">
        <div className="animate-fade-up">
          {content.eyebrow ? (
            <p className="mb-5 inline-flex items-center gap-2 rounded-full bg-soft px-3.5 py-1.5 text-xs font-semibold tracking-wide text-soft-foreground uppercase">
              <Sparkles className="size-3.5" aria-hidden /> {content.eyebrow}
            </p>
          ) : null}
          <h1
            id="hero-title"
            className="font-display text-[2.6rem] leading-[1.05] font-semibold tracking-tight sm:text-6xl md:text-[4.25rem]"
          >
            {content.title}
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted-foreground">{content.subtitle}</p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <BookButton size="lg" className="h-14 px-8 text-base">
              <CalendarCheck className="size-5" />
              {content.primaryCta}
            </BookButton>
            <Button asChild size="lg" variant="outline" className="h-14 px-7 text-base">
              <a href={waLink(whatsapp, `¡Hola ${salonName}! Quiero agendar una cita.`)} target="_blank" rel="noopener noreferrer">
                <WhatsAppIcon className="size-5 text-[#128C4B] dark:text-[#4ade80]" />
                {content.secondaryCta}
              </a>
            </Button>
          </div>
          <div className="mt-6">
            <NextSlot />
          </div>
          {content.highlights.length > 0 ? (
            <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground">
              {content.highlights.map((h) => (
                <li key={h} className="flex items-center gap-2">
                  <Check className="size-4 text-brand" aria-hidden /> {h}
                </li>
              ))}
            </ul>
          ) : null}
        </div>

        <div className="relative mx-auto w-full max-w-md md:max-w-none">
          {content.image.url ? (
            <div className="relative aspect-[4/5] overflow-hidden rounded-[2rem] shadow-2xl shadow-primary/20">
              <Image
                src={content.image.url}
                alt={content.image.alt || `Trabajo de uñas en ${salonName}`}
                fill
                priority
                sizes="(min-width: 768px) 45vw, 90vw"
                className="object-cover"
              />
            </div>
          ) : (
            <HeroArt />
          )}
          <div className="absolute -bottom-6 left-4 flex items-center gap-3 rounded-2xl border bg-card/95 px-4 py-3 shadow-xl backdrop-blur sm:left-[-1.5rem]">
            <span className="flex size-10 items-center justify-center rounded-full bg-success-soft text-success-foreground">
              <ShieldCheck className="size-5" aria-hidden />
            </span>
            <span className="text-sm leading-tight">
              <strong className="block">Higiene garantizada</strong>
              <span className="text-muted-foreground">Material estéril en cada cita</span>
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}

/** Ilustración decorativa cuando aún no hay foto de portada. */
function HeroArt() {
  return (
    <div
      aria-hidden
      className="relative aspect-[4/5] overflow-hidden rounded-[2rem] bg-[linear-gradient(150deg,#7B2CBF_0%,#a05ad8_45%,#FFB5C0_100%)] shadow-2xl shadow-primary/25"
    >
      <svg viewBox="0 0 400 500" className="absolute inset-0 size-full">
        <defs>
          <linearGradient id="nail-a" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#fff" stopOpacity=".95" />
            <stop offset="1" stopColor="#FFE3E8" stopOpacity=".85" />
          </linearGradient>
          <linearGradient id="nail-b" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#3d1563" />
            <stop offset="1" stopColor="#7B2CBF" />
          </linearGradient>
        </defs>
        <g className="motion-safe:animate-float" style={{ transformOrigin: "200px 250px" }}>
          {[
            { x: 70, y: 170, r: -14, f: "url(#nail-a)", h: 180 },
            { x: 135, y: 110, r: -5, f: "url(#nail-b)", h: 210 },
            { x: 205, y: 95, r: 3, f: "url(#nail-a)", h: 220 },
            { x: 275, y: 120, r: 11, f: "url(#nail-b)", h: 200 },
          ].map((n, i) => (
            <g key={i} transform={`rotate(${n.r} ${n.x + 30} ${n.y + n.h / 2})`}>
              <path
                d={`M${n.x} ${n.y + 40} C${n.x} ${n.y + 8} ${n.x + 60} ${n.y + 8} ${n.x + 60} ${n.y + 40} L${n.x + 60} ${n.y + n.h} L${n.x} ${n.y + n.h} Z`}
                fill={n.f}
              />
              <path
                d={`M${n.x + 14} ${n.y + 34} C${n.x + 18} ${n.y + 22} ${n.x + 30} ${n.y + 18} ${n.x + 40} ${n.y + 20}`}
                stroke="#fff"
                strokeOpacity=".7"
                strokeWidth="5"
                strokeLinecap="round"
                fill="none"
              />
            </g>
          ))}
        </g>
        <circle cx="330" cy="70" r="6" fill="#fff" opacity=".8" />
        <circle cx="60" cy="90" r="4" fill="#fff" opacity=".6" />
        <circle cx="350" cy="380" r="3" fill="#fff" opacity=".7" />
      </svg>
    </div>
  );
}

/* ----------------------------------------------------------------------------- */

const ICONS: Record<(typeof BENEFIT_ICONS)[number], LucideIcon> = {
  shield: ShieldCheck,
  sparkles: Sparkles,
  clock: Clock,
  heart: Heart,
  star: Star,
  leaf: Leaf,
  gem: Gem,
  smile: Smile,
};

export function BenefitsSection({ content }: { content: SectionContent<"benefits"> }) {
  return (
    <Section id="beneficios" labelledBy="benefits-title" className="bg-muted/50">
      <SectionHeading id="benefits-title" title={content.title} subtitle={content.subtitle} />
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {content.items.map((item) => {
          const Icon = ICONS[item.icon] ?? Sparkles;
          return (
            <li key={item.title} className="rounded-3xl border bg-card p-6 transition-shadow hover:shadow-lg hover:shadow-primary/5">
              <span className="mb-5 flex size-12 items-center justify-center rounded-2xl bg-soft text-soft-foreground">
                <Icon className="size-6" aria-hidden />
              </span>
              <h3 className="text-lg font-semibold">{item.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{item.description}</p>
            </li>
          );
        })}
      </ul>
    </Section>
  );
}

/* ----------------------------------------------------------------------------- */

export function ServicesSection({
  content,
  catalog,
  depositPercent,
}: {
  content: SectionContent<"services">;
  catalog: Catalog;
  depositPercent: number;
}) {
  return (
    <Section id="servicios" labelledBy="services-title">
      <SectionHeading id="services-title" title={content.title} subtitle={content.subtitle} />
      {catalog.categories.length === 0 ? (
        <p className="text-center text-muted-foreground">Muy pronto publicaremos nuestros servicios.</p>
      ) : (
        <div className="grid gap-6 lg:grid-cols-3">
          {catalog.categories.map((cat) => (
            <article key={cat.id} className="flex flex-col rounded-3xl border bg-card p-6 sm:p-7">
              <h3 className="font-display text-2xl font-semibold">{cat.name}</h3>
              {cat.description ? <p className="mt-1 text-sm text-muted-foreground">{cat.description}</p> : null}
              <ul className="mt-5 flex-1 divide-y">
                {cat.services.map((s) => (
                  <li key={s.id} className="flex items-start justify-between gap-4 py-3.5">
                    <div className="min-w-0">
                      <p className="font-medium">{s.name}</p>
                      <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="size-3" aria-hidden /> {formatDuration(s.duration_minutes)}
                        {s.price_type === "addon" ? " · adicional" : ""}
                      </p>
                    </div>
                    <p className="shrink-0 font-semibold tabular-nums text-brand">
                      {s.price_type === "addon" ? (
                        <span className="inline-flex items-center">
                          <Plus className="size-3.5" aria-label="más" />
                          {formatCOP(s.price)}
                        </span>
                      ) : (
                        formatCOP(s.price)
                      )}
                    </p>
                  </li>
                ))}
              </ul>
              <BookButton variant="secondary" size="default" className="mt-5 w-full" serviceId={cat.services.find((s) => s.price_type === "fixed")?.id}>
                Reservar {cat.name.toLowerCase()}
              </BookButton>
            </article>
          ))}
        </div>
      )}
      <div className="mx-auto mt-8 flex max-w-3xl flex-col items-center gap-2 text-center text-sm text-muted-foreground">
        <p className="inline-flex items-center gap-2 rounded-full bg-accent px-4 py-2 text-accent-foreground">
          <Wallet className="size-4" aria-hidden />
          Aseguras tu cita con un abono del {depositPercent} %. No es reembolsable si no asistes.
        </p>
        {content.note ? <p>{content.note}</p> : null}
      </div>
    </Section>
  );
}

/* ----------------------------------------------------------------------------- */

export function GallerySection({ content, items }: { content: SectionContent<"gallery">; items: GalleryItem[] }) {
  if (items.length === 0) return null;
  return (
    <Section id="galeria" labelledBy="gallery-title" className="bg-muted/50">
      <SectionHeading id="gallery-title" title={content.title} subtitle={content.subtitle} />
      <GalleryGrid items={items} />
    </Section>
  );
}

/* ----------------------------------------------------------------------------- */

export function HowToBookSection({ content }: { content: SectionContent<"how_to_book"> }) {
  return (
    <Section id="como-reservar" labelledBy="how-title">
      <SectionHeading id="how-title" title={content.title} subtitle={content.subtitle} />
      <ol className="grid gap-5 md:grid-cols-3">
        {content.steps.map((step, i) => (
          <li key={step.title} className="relative rounded-3xl border bg-card p-6 sm:p-7">
            <span className="font-display text-5xl font-semibold text-brand/90" aria-hidden>
              {String(i + 1).padStart(2, "0")}
            </span>
            <h3 className="mt-3 text-lg font-semibold">
              <span className="sr-only">Paso {i + 1}: </span>
              {step.title}
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{step.description}</p>
          </li>
        ))}
      </ol>
      <div className="mt-10 flex justify-center">
        <BookButton>Empezar mi reserva</BookButton>
      </div>
    </Section>
  );
}

/* ----------------------------------------------------------------------------- */

export function TestimonialsSection({ content }: { content: SectionContent<"testimonials"> }) {
  if (content.items.length === 0) return null;
  return (
    <Section id="testimonios" labelledBy="testimonials-title" className="bg-soft/60 dark:bg-soft/40">
      <SectionHeading id="testimonials-title" title={content.title} subtitle={content.subtitle} />
      <ul className="grid gap-5 md:grid-cols-3">
        {content.items.map((t) => (
          <li key={t.name + t.text.slice(0, 12)}>
            <figure className="flex h-full flex-col rounded-3xl border bg-card p-6 sm:p-7">
              <div className="flex gap-0.5 text-[#B7791F] dark:text-[#FACC15]" aria-label={`${t.rating} de 5 estrellas`}>
                {Array.from({ length: 5 }, (_, i) => (
                  <Star key={i} className={cn("size-4", i < t.rating ? "fill-current" : "opacity-30")} aria-hidden />
                ))}
              </div>
              <blockquote className="mt-4 flex-1 text-base leading-relaxed">“{t.text}”</blockquote>
              <figcaption className="mt-5 text-sm">
                <strong className="font-semibold">{t.name}</strong>
                {t.service ? <span className="text-muted-foreground"> · {t.service}</span> : null}
              </figcaption>
            </figure>
          </li>
        ))}
      </ul>
    </Section>
  );
}

/* ----------------------------------------------------------------------------- */

export function FaqSection({ content }: { content: SectionContent<"faq"> }) {
  if (content.items.length === 0) return null;
  return (
    <Section id="preguntas" labelledBy="faq-title">
      <div className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr]">
        <SectionHeading id="faq-title" title={content.title} subtitle={content.subtitle} align="left" />
        <div className="grid gap-3">
          {content.items.map((item) => (
            <details key={item.question} className="group rounded-2xl border bg-card px-5 open:shadow-sm">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-4 font-semibold [&::-webkit-details-marker]:hidden">
                {item.question}
                <ChevronDown className="size-5 shrink-0 text-brand transition-transform group-open:rotate-180" aria-hidden />
              </summary>
              <p className="pb-5 text-sm leading-relaxed text-muted-foreground">{item.answer}</p>
            </details>
          ))}
        </div>
      </div>
    </Section>
  );
}

/* ----------------------------------------------------------------------------- */

export function CtaSection({ content }: { content: SectionContent<"cta"> }) {
  return (
    <section aria-labelledby="cta-title" className="px-4 py-16 sm:px-6">
      <div className="relative mx-auto max-w-5xl overflow-hidden rounded-[2rem] bg-primary px-6 py-14 text-center text-primary-foreground sm:px-12 sm:py-20">
        <div aria-hidden className="absolute -top-20 -right-16 size-72 rounded-full bg-[#FFB5C0]/30 blur-3xl" />
        <div aria-hidden className="absolute -bottom-24 -left-10 size-72 rounded-full bg-white/10 blur-3xl" />
        <h2 id="cta-title" className="relative font-display text-3xl font-semibold sm:text-5xl">
          {content.title}
        </h2>
        <p className="relative mx-auto mt-4 max-w-xl text-lg text-white/90">{content.subtitle}</p>
        <div className="relative mt-8 flex justify-center">
          <BookButton
            size="lg"
            variant="secondary"
            className="h-14 bg-white px-8 text-base text-[#3d1563] hover:bg-[#FFE3E8] hover:text-[#3d1563]"
          >
            <CalendarCheck className="size-5" />
            {content.buttonLabel}
          </BookButton>
        </div>
      </div>
    </section>
  );
}

/* ----------------------------------------------------------------------------- */

function groupHours(hours: BusinessHour[]): { label: string; ranges: string }[] {
  const order = [1, 2, 3, 4, 5, 6, 0];
  return order.map((d) => {
    const ranges = hours
      .filter((h) => h.weekday === d)
      .map((h) => `${formatClock(h.start_time)} – ${formatClock(h.end_time)}`)
      .join(" · ");
    return { label: WEEKDAYS[d]!, ranges: ranges || "Cerrado" };
  });
}

export function ContactSection({
  content,
  channels,
  hours,
  settings,
}: {
  content: SectionContent<"contact">;
  channels: ContactChannel[];
  hours: BusinessHour[];
  settings: Settings;
}) {
  const location = [settings.address, settings.city].filter(Boolean).join(", ");
  return (
    <Section id="contacto" labelledBy="contact-title" className="bg-muted/50">
      <SectionHeading id="contact-title" title={content.title} subtitle={content.subtitle} />
      <div className="grid gap-6 md:grid-cols-2">
        <div className="rounded-3xl border bg-card p-6 sm:p-7">
          <h3 className="font-display text-xl font-semibold">Canales</h3>
          <ul className="mt-4 grid gap-3">
            {location ? (
              <li>
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 rounded-2xl p-2 -m-2 hover:bg-accent"
                >
                  <span className="flex size-10 items-center justify-center rounded-full bg-soft text-soft-foreground">
                    <MapPin className="size-5" aria-hidden />
                  </span>
                  <span>
                    <span className="block text-xs text-muted-foreground">Dirección</span>
                    <span className="font-medium">{location}</span>
                  </span>
                </a>
              </li>
            ) : null}
            {channels.map((c) => {
              const href = channelHref(c.type, c.value, c.url);
              const inner = (
                <>
                  <span className="flex size-10 items-center justify-center rounded-full bg-soft text-soft-foreground">
                    <ChannelIcon type={c.type} className="size-5" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-xs text-muted-foreground">{c.label}</span>
                    <span className="block truncate font-medium">{c.value || c.url}</span>
                  </span>
                </>
              );
              return (
                <li key={c.id}>
                  {href ? (
                    <a
                      href={href}
                      target={href.startsWith("http") ? "_blank" : undefined}
                      rel="noopener noreferrer"
                      className="-m-2 flex items-center gap-3 rounded-2xl p-2 hover:bg-accent"
                    >
                      {inner}
                    </a>
                  ) : (
                    <div className="flex items-center gap-3">{inner}</div>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
        {content.showHours ? (
          <div className="rounded-3xl border bg-card p-6 sm:p-7">
            <h3 className="font-display text-xl font-semibold">Horario de atención</h3>
            <p className="mt-1 text-sm text-muted-foreground">Hora de Colombia · Solo con cita previa</p>
            <dl className="mt-4 divide-y text-sm">
              {groupHours(hours).map((row) => (
                <div key={row.label} className="flex justify-between gap-4 py-2.5">
                  <dt className="font-medium">{row.label}</dt>
                  <dd className={cn("text-right", row.ranges === "Cerrado" && "text-muted-foreground")}>{row.ranges}</dd>
                </div>
              ))}
            </dl>
          </div>
        ) : null}
      </div>
    </Section>
  );
}
