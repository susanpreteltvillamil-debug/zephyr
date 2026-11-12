/** Tipos de las filas de la base de datos (espejo de supabase/migrations). */

export type AppointmentStatus =
  | "pending_payment"
  | "confirmed"
  | "completed"
  | "no_show"
  | "cancelled"
  | "expired";

export type PriceType = "fixed" | "addon";
export type RefundMode = "credit" | "refund";
export type RefundStatus = "none" | "credited" | "refund_pending" | "refunded";

export interface Settings {
  id: number;
  salon_name: string;
  tagline: string;
  address: string;
  city: string;
  whatsapp_number: string;
  deposit_percent: number;
  hold_minutes: number;
  min_notice_minutes: number;
  max_advance_days: number;
  slot_interval_minutes: number;
  buffer_minutes: number;
  change_cutoff_hours: number;
  max_reschedules: number;
  cancellation_refund_mode: RefundMode;
  max_pending_per_phone: number;
  updated_at: string;
}

export interface ServiceCategory {
  id: string;
  name: string;
  slug: string;
  description: string;
  active: boolean;
  sort_order: number;
}

export interface Service {
  id: string;
  category_id: string;
  name: string;
  description: string;
  price: number;
  price_type: PriceType;
  duration_minutes: number;
  image_url: string | null;
  active: boolean;
  sort_order: number;
  requires_any_service_ids: string[];
}

export interface BusinessHour {
  id: string;
  weekday: number;
  start_time: string;
  end_time: string;
}

export interface TimeOff {
  id: string;
  start_at: string;
  end_at: string;
  reason: string;
}

export interface Customer {
  id: string;
  full_name: string;
  phone: string;
  email: string | null;
  credit_balance: number;
  notes: string;
  created_at: string;
}

export interface AppointmentServiceRow {
  id: string;
  appointment_id: string;
  service_id: string | null;
  name: string;
  price: number;
  price_type: PriceType;
  duration_minutes: number;
  sort_order: number;
}

export interface Appointment {
  id: string;
  code: string;
  staff_id: string;
  customer_id: string;
  customer_name: string;
  customer_phone: string;
  customer_email: string | null;
  notes: string;
  start_at: string;
  end_at: string;
  blocked_until: string;
  status: AppointmentStatus;
  source: "web" | "admin";
  total_price: number;
  total_duration_minutes: number;
  deposit_percent: number;
  deposit_amount: number;
  deposit_paid: boolean;
  deposit_confirmed_at: string | null;
  hold_expires_at: string | null;
  reschedule_count: number;
  refund_status: RefundStatus;
  cancelled_at: string | null;
  cancelled_by: "customer" | "admin" | null;
  cancel_reason: string;
  privacy_accepted_at: string | null;
  privacy_version: string | null;
  booking_policy_accepted_at: string | null;
  booking_policy_version: string | null;
  created_at: string;
  updated_at: string;
}

export type AppointmentWithServices = Appointment & {
  appointment_services: AppointmentServiceRow[];
  customers?: Pick<Customer, "credit_balance"> | null;
};

export interface GalleryItem {
  id: string;
  storage_path: string | null;
  image_url: string;
  alt: string;
  title: string;
  category: string;
  width: number | null;
  height: number | null;
  visible: boolean;
  sort_order: number;
}

export interface SiteSectionRow {
  key: string;
  content: unknown;
  visible: boolean;
  sort_order: number;
  updated_at: string;
}

export const CONTACT_TYPES = [
  "whatsapp",
  "phone",
  "email",
  "instagram",
  "facebook",
  "tiktok",
  "youtube",
  "x",
  "address",
  "website",
  "other",
] as const;

export type ContactType = (typeof CONTACT_TYPES)[number];

export interface ContactChannel {
  id: string;
  type: ContactType;
  label: string;
  value: string;
  url: string;
  active: boolean;
  sort_order: number;
}

export interface PaymentMethod {
  id: string;
  name: string;
  account_number: string;
  holder: string;
  instructions: string;
  qr_url: string | null;
  active: boolean;
  sort_order: number;
}

export interface LegalDocument {
  slug: string;
  title: string;
  content_md: string;
  version: string;
  updated_at: string;
}

/** Respuesta de create_booking */
export interface BookingResult {
  id: string;
  code: string;
  manage_token: string;
  start_at: string;
  end_at: string;
  total_price: number;
  total_duration_minutes: number;
  deposit_percent: number;
  deposit_amount: number;
  hold_expires_at: string;
  status: AppointmentStatus;
}

/** Respuesta de booking_json (gestión por enlace privado) */
export interface ManagedBooking {
  id: string;
  code: string;
  status: AppointmentStatus;
  start_at: string;
  end_at: string;
  customer_name: string;
  total_price: number;
  total_duration_minutes: number;
  deposit_percent: number;
  deposit_amount: number;
  deposit_paid: boolean;
  hold_expires_at: string | null;
  reschedule_count: number;
  refund_status: RefundStatus;
  max_reschedules: number;
  change_cutoff_hours: number;
  can_change: boolean;
  services: {
    service_id: string | null;
    name: string;
    price: number;
    price_type: PriceType;
    duration_minutes: number;
  }[];
}

export type ActionResult<T = null> = { ok: true; data: T } | { ok: false; error: string; code?: string };
