"use client";

import * as React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/form-controls";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/misc";
import { useAction } from "@/components/admin/kit";
import { saveLegalDocument } from "@/app/admin/actions/content";
import { formatDateShort } from "@/lib/booking/time";
import type { LegalDocument } from "@/lib/types";

const LABELS: Record<string, string> = {
  privacidad: "Datos personales",
  terminos: "Términos",
  reservas: "Reservas",
  cookies: "Cookies",
};

function bump(v: string): string {
  const parts = v.split(".").map(Number);
  if (parts.some(Number.isNaN)) return "1.1";
  parts[parts.length - 1] = (parts[parts.length - 1] ?? 0) + 1;
  return parts.join(".");
}

export function LegalEditor({ docs }: { docs: LegalDocument[] }) {
  const [current, setCurrent] = React.useState(docs[0]?.slug ?? "privacidad");
  return (
    <Tabs value={current} onValueChange={setCurrent}>
      <TabsList className="mb-4 flex h-auto w-full flex-wrap justify-start sm:w-auto">
        {docs.map((d) => (
          <TabsTrigger key={d.slug} value={d.slug}>
            {LABELS[d.slug] ?? d.slug}
          </TabsTrigger>
        ))}
      </TabsList>
      {docs.map((d) => (
        <TabsContent key={d.slug} value={d.slug}>
          <DocEditor doc={d} />
        </TabsContent>
      ))}
    </Tabs>
  );
}

function DocEditor({ doc }: { doc: LegalDocument }) {
  const { run, pending } = useAction();
  const [title, setTitle] = React.useState(doc.title);
  const [content, setContent] = React.useState(doc.content_md);
  const [version, setVersion] = React.useState(doc.version);
  const dirty = title !== doc.title || content !== doc.content_md || version !== doc.version;

  return (
    <div className="grid gap-4">
      <div className="grid gap-4 sm:grid-cols-[1fr_10rem]">
        <Field label="Título" htmlFor={`t-${doc.slug}`}>
          <Input id={`t-${doc.slug}`} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} />
        </Field>
        <Field label="Versión" htmlFor={`v-${doc.slug}`}>
          <div className="flex gap-2">
            <Input id={`v-${doc.slug}`} value={version} onChange={(e) => setVersion(e.target.value)} maxLength={10} />
            <Button type="button" variant="outline" size="sm" className="h-11" onClick={() => setVersion(bump(doc.version))}>
              +1
            </Button>
          </div>
        </Field>
      </div>
      <p className="text-xs text-muted-foreground">
        Última actualización: {formatDateShort(doc.updated_at)} · Reemplaza los marcadores como [RAZÓN SOCIAL], [NIT/CC] y [DIRECCIÓN] con tus datos.
      </p>
      <div className="grid gap-4 lg:grid-cols-2">
        <Field label="Contenido (Markdown)" htmlFor={`c-${doc.slug}`}>
          <Textarea
            id={`c-${doc.slug}`}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="min-h-[28rem] font-mono text-[13px]"
          />
        </Field>
        <div className="grid content-start gap-2">
          <span className="text-sm font-medium">Vista previa</span>
          <div className="prose-legal max-h-[28rem] overflow-y-auto rounded-xl border bg-card p-4 text-sm">
            <ReactMarkdown remarkPlugins={[remarkGfm]} skipHtml>
              {content}
            </ReactMarkdown>
          </div>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          disabled={!dirty || pending}
          onClick={() =>
            void run(saveLegalDocument({ slug: doc.slug as "privacidad", title, content_md: content, version }), {
              success: "Documento publicado",
            })
          }
        >
          Guardar y publicar
        </Button>
        <Button asChild variant="ghost">
          <a href={`/legal/${doc.slug}`} target="_blank" rel="noopener">
            <ExternalLink /> Ver en la web
          </a>
        </Button>
      </div>
    </div>
  );
}
