import { BookingProvider, type BookingConfig } from "@/components/booking/booking-context";
import { BookingModal } from "@/components/booking/booking-modal";
import { SiteHeader, type NavItem } from "@/components/site/header";
import { SiteFooter } from "@/components/site/footer";
import { FloatingActions } from "@/components/site/client-bits";
import {
  getCatalog,
  getContactChannels,
  getGallery,
  getPaymentMethods,
  getSections,
  getSettings,
  primaryWhatsApp,
} from "@/lib/data/public";

export const revalidate = 3600;

export default async function SiteLayout({ children }: LayoutProps<"/">) {
  const [settings, catalog, sections, channels, payments, gallery] = await Promise.all([
    getSettings(),
    getCatalog(),
    getSections(),
    getContactChannels(),
    getPaymentMethods(),
    getGallery(),
  ]);
  const whatsapp = primaryWhatsApp(settings, channels);
  const visible = new Set(sections.order.filter((s) => s.visible).map((s) => s.key));

  const config: BookingConfig = {
    categories: catalog.categories,
    settings: {
      salon_name: settings.salon_name,
      deposit_percent: settings.deposit_percent,
      hold_minutes: settings.hold_minutes,
      change_cutoff_hours: settings.change_cutoff_hours,
      max_advance_days: settings.max_advance_days,
      cancellation_refund_mode: settings.cancellation_refund_mode,
    },
    paymentMethods: payments,
    whatsapp,
  };

  const nav: NavItem[] = [
    visible.has("services") && { href: "/#servicios", label: "Servicios" },
    visible.has("gallery") && gallery.length > 0 && { href: "/#galeria", label: "Galería" },
    visible.has("how_to_book") && { href: "/#como-reservar", label: "Cómo reservar" },
    visible.has("faq") && { href: "/#preguntas", label: "Preguntas" },
    visible.has("contact") && { href: "/#contacto", label: "Contacto" },
  ].filter((x): x is NavItem => Boolean(x));

  return (
    <BookingProvider config={config}>
      <SiteHeader salonName={settings.salon_name} nav={nav} />
      <main id="contenido">{children}</main>
      <SiteFooter salonName={settings.salon_name} content={sections.content.footer} channels={channels} />
      <FloatingActions whatsapp={whatsapp} salonName={settings.salon_name} />
      <BookingModal />
    </BookingProvider>
  );
}
