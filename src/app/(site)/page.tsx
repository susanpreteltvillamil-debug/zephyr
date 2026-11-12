import type { ReactNode } from "react";
import {
  BenefitsSection,
  ContactSection,
  CtaSection,
  FaqSection,
  GallerySection,
  HeroSection,
  HowToBookSection,
  ServicesSection,
  TestimonialsSection,
} from "@/components/site/sections";
import {
  getBusinessHours,
  getCatalog,
  getContactChannels,
  getGallery,
  getSections,
  getSettings,
  primaryWhatsApp,
} from "@/lib/data/public";
import { publicEnv } from "@/lib/env";
import type { SectionKey } from "@/lib/content/sections";
import { toWhatsAppNumber } from "@/lib/booking/phone";

export const revalidate = 3600;

const DAY_CODES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export default async function HomePage() {
  const [settings, catalog, sections, channels, gallery, hours] = await Promise.all([
    getSettings(),
    getCatalog(),
    getSections(),
    getContactChannels(),
    getGallery(),
    getBusinessHours(),
  ]);
  const whatsapp = primaryWhatsApp(settings, channels);
  const c = sections.content;

  const render: Partial<Record<SectionKey, ReactNode>> = {
    hero: <HeroSection key="hero" content={c.hero} whatsapp={whatsapp} salonName={settings.salon_name} />,
    benefits: <BenefitsSection key="benefits" content={c.benefits} />,
    services: (
      <ServicesSection key="services" content={c.services} catalog={catalog} depositPercent={settings.deposit_percent} />
    ),
    gallery: <GallerySection key="gallery" content={c.gallery} items={gallery} />,
    how_to_book: <HowToBookSection key="how_to_book" content={c.how_to_book} />,
    testimonials: <TestimonialsSection key="testimonials" content={c.testimonials} />,
    faq: <FaqSection key="faq" content={c.faq} />,
    cta: <CtaSection key="cta" content={c.cta} />,
    contact: <ContactSection key="contact" content={c.contact} channels={channels} hours={hours} settings={settings} />,
  };

  const order = sections.order.filter((s) => s.visible && s.key !== "footer").map((s) => s.key);
  // La portada siempre va primero si está visible.
  const sorted = [...order.filter((k) => k === "hero"), ...order.filter((k) => k !== "hero")];

  const email = channels.find((ch) => ch.type === "email")?.value;
  const sameAs = channels
    .filter((ch) => ["instagram", "facebook", "tiktok", "youtube", "x"].includes(ch.type) && ch.url)
    .map((ch) => ch.url);
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "NailSalon",
    name: settings.salon_name,
    url: publicEnv.siteUrl,
    image: c.hero.image.url || `${publicEnv.siteUrl}/opengraph-image`,
    telephone: `+${toWhatsAppNumber(whatsapp)}`,
    ...(email ? { email } : {}),
    priceRange: "$$",
    currenciesAccepted: "COP",
    ...(settings.address || settings.city
      ? {
          address: {
            "@type": "PostalAddress",
            streetAddress: settings.address || undefined,
            addressLocality: settings.city || undefined,
            addressCountry: "CO",
          },
        }
      : {}),
    openingHoursSpecification: hours.map((h) => ({
      "@type": "OpeningHoursSpecification",
      dayOfWeek: `https://schema.org/${DAY_CODES[h.weekday]}`,
      opens: h.start_time.slice(0, 5),
      closes: h.end_time.slice(0, 5),
    })),
    ...(sameAs.length ? { sameAs } : {}),
    makesOffer: catalog.services
      .filter((s) => s.price_type === "fixed")
      .map((s) => ({
        "@type": "Offer",
        price: s.price,
        priceCurrency: "COP",
        itemOffered: { "@type": "Service", name: s.name, description: s.description || undefined },
      })),
  };

  return (
    <>
      <script
        type="application/ld+json"
        // JSON serializado sin "<" para evitar inyección en el script.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
      />
      {sorted.map((key) => render[key])}
    </>
  );
}
