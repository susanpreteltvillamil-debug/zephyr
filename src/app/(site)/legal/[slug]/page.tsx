import type { Metadata } from "next";
import { notFound } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { getLegalDocuments, getSettings, LEGAL_SLUGS, LEGAL_TITLES, type LegalSlug } from "@/lib/data/public";
import { formatDateShort } from "@/lib/booking/time";

export const revalidate = 3600;
export const dynamicParams = false;

export function generateStaticParams() {
  return LEGAL_SLUGS.map((slug) => ({ slug }));
}

function isLegalSlug(s: string): s is LegalSlug {
  return (LEGAL_SLUGS as readonly string[]).includes(s);
}

export async function generateMetadata({ params }: PageProps<"/legal/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  if (!isLegalSlug(slug)) return {};
  return { title: LEGAL_TITLES[slug], alternates: { canonical: `/legal/${slug}` } };
}

export default async function LegalPage({ params }: PageProps<"/legal/[slug]">) {
  const { slug } = await params;
  if (!isLegalSlug(slug)) notFound();
  const [docs, settings] = await Promise.all([getLegalDocuments(), getSettings()]);
  const doc = docs.find((d) => d.slug === slug);

  return (
    <article className="px-4 py-12 sm:px-6 sm:py-16">
      <div className="mx-auto max-w-3xl">
        <p className="text-sm font-semibold uppercase tracking-wider text-brand">{settings.salon_name} · Legal</p>
        <h1 className="mt-2 font-display text-4xl font-semibold tracking-tight sm:text-5xl">
          {doc?.title ?? LEGAL_TITLES[slug]}
        </h1>
        {doc ? (
          <>
            <p className="mt-3 text-sm text-muted-foreground">
              Versión {doc.version} · Actualizado el {formatDateShort(doc.updated_at)}
            </p>
            <div className="prose-legal mt-8 text-[15px] text-foreground">
              <ReactMarkdown remarkPlugins={[remarkGfm]} skipHtml>
                {doc.content_md}
              </ReactMarkdown>
            </div>
          </>
        ) : (
          <p className="mt-8 text-muted-foreground">Este documento se está actualizando. Escríbenos si necesitas consultarlo.</p>
        )}
      </div>
    </article>
  );
}
