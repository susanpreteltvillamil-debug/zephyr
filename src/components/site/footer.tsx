import Link from "next/link";
import { LogoMark } from "./header";
import { ChannelIcon, channelHref } from "./brand-icons";
import { LEGAL_SLUGS, LEGAL_TITLES } from "@/lib/data/public";
import type { SectionContent } from "@/lib/content/sections";
import type { ContactChannel } from "@/lib/types";

export function SiteFooter({
  salonName,
  content,
  channels,
}: {
  salonName: string;
  content: SectionContent<"footer">;
  channels: ContactChannel[];
}) {
  const year = new Date().getFullYear();
  const social = channels.filter((c) => channelHref(c.type, c.value, c.url));
  return (
    <footer className="border-t bg-background px-4 pt-14 pb-28 sm:px-6 sm:pb-12">
      <div className="mx-auto grid max-w-6xl gap-10 md:grid-cols-[1.4fr_1fr_1fr]">
        <div>
          <Link href="/" className="inline-flex items-center gap-2">
            <LogoMark />
            <span className="font-display text-2xl font-semibold">{salonName}</span>
          </Link>
          {content.tagline ? <p className="mt-3 max-w-xs text-sm text-muted-foreground">{content.tagline}</p> : null}
          {social.length > 0 ? (
            <ul className="mt-5 flex gap-2">
              {social.map((c) => {
                const href = channelHref(c.type, c.value, c.url)!;
                return (
                  <li key={c.id}>
                    <a
                      href={href}
                      target={href.startsWith("http") ? "_blank" : undefined}
                      rel="noopener noreferrer"
                      aria-label={c.label}
                      className="flex size-10 items-center justify-center rounded-full border text-foreground transition-colors hover:bg-accent hover:text-brand"
                    >
                      <ChannelIcon type={c.type} className="size-[18px]" />
                    </a>
                  </li>
                );
              })}
            </ul>
          ) : null}
        </div>
        <nav aria-label="Secciones">
          <h2 className="text-sm font-semibold">Explora</h2>
          <ul className="mt-3 grid gap-2 text-sm text-muted-foreground">
            <li><Link className="hover:text-brand" href="/#servicios">Servicios y precios</Link></li>
            <li><Link className="hover:text-brand" href="/#como-reservar">Cómo reservar</Link></li>
            <li><Link className="hover:text-brand" href="/#preguntas">Preguntas frecuentes</Link></li>
            <li><Link className="hover:text-brand" href="/reservar">Reservar cita</Link></li>
          </ul>
        </nav>
        <nav aria-label="Legal">
          <h2 className="text-sm font-semibold">Legal</h2>
          <ul className="mt-3 grid gap-2 text-sm text-muted-foreground">
            {LEGAL_SLUGS.map((slug) => (
              <li key={slug}>
                <Link className="hover:text-brand" href={`/legal/${slug}`}>
                  {LEGAL_TITLES[slug]}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
      <p className="mx-auto mt-12 max-w-6xl border-t pt-6 text-xs text-muted-foreground">
        © {year} {salonName}. {content.copyright}
      </p>
    </footer>
  );
}
