"use client";

import * as React from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { GalleryItem } from "@/lib/types";

export function GalleryGrid({ items }: { items: GalleryItem[] }) {
  const categories = React.useMemo(
    () => [...new Set(items.map((i) => i.category).filter(Boolean))],
    [items],
  );
  const [filter, setFilter] = React.useState<string | null>(null);
  const [index, setIndex] = React.useState<number | null>(null);
  const visible = filter ? items.filter((i) => i.category === filter) : items;
  const current = index !== null ? visible[index] : undefined;

  const go = (delta: number) =>
    setIndex((i) => (i === null ? null : (i + delta + visible.length) % visible.length));

  return (
    <>
      {categories.length > 1 ? (
        <div className="mb-6 flex flex-wrap justify-center gap-2" role="group" aria-label="Filtrar galería">
          {[null, ...categories].map((c) => (
            <button
              key={c ?? "all"}
              type="button"
              onClick={() => setFilter(c)}
              aria-pressed={filter === c}
              className={cn(
                "rounded-full border px-4 py-2 text-sm font-medium transition-colors",
                filter === c ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:bg-accent",
              )}
            >
              {c ?? "Todos"}
            </button>
          ))}
        </div>
      ) : null}

      <ul className="columns-2 gap-3 sm:gap-4 md:columns-3">
        {visible.map((item, i) => (
          <li key={item.id} className="mb-3 break-inside-avoid sm:mb-4">
            <button
              type="button"
              onClick={() => setIndex(i)}
              className="group relative block w-full overflow-hidden rounded-2xl bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              aria-label={`Ver imagen: ${item.title || item.alt}`}
            >
              <Image
                src={item.image_url}
                alt={item.alt}
                width={item.width ?? 800}
                height={item.height ?? 1000}
                sizes="(min-width: 768px) 33vw, 50vw"
                loading="lazy"
                className="h-auto w-full transition-transform duration-500 group-hover:scale-[1.03]"
              />
              {item.title ? (
                <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-3 pt-8 text-left text-sm font-medium text-white">
                  {item.title}
                </span>
              ) : null}
            </button>
          </li>
        ))}
      </ul>

      <Dialog open={index !== null} onOpenChange={(o) => !o && setIndex(null)}>
        <DialogContent className="max-w-4xl bg-black p-2 text-white sm:p-3">
          {current ? (
            <>
              <DialogTitle className="sr-only">{current.title || "Imagen de la galería"}</DialogTitle>
              <DialogDescription className="sr-only">{current.alt}</DialogDescription>
              <div className="relative">
                <Image
                  src={current.image_url}
                  alt={current.alt}
                  width={current.width ?? 1200}
                  height={current.height ?? 1500}
                  sizes="90vw"
                  className="mx-auto max-h-[80dvh] w-auto rounded-xl object-contain"
                />
                {visible.length > 1 ? (
                  <>
                    <button
                      type="button"
                      onClick={() => go(-1)}
                      className="absolute top-1/2 left-2 flex size-11 -translate-y-1/2 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80"
                      aria-label="Anterior"
                    >
                      <ChevronLeft className="size-6" />
                    </button>
                    <button
                      type="button"
                      onClick={() => go(1)}
                      className="absolute top-1/2 right-2 flex size-11 -translate-y-1/2 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80"
                      aria-label="Siguiente"
                    >
                      <ChevronRight className="size-6" />
                    </button>
                  </>
                ) : null}
              </div>
              {current.title ? <p className="px-2 pt-2 pb-1 text-center text-sm">{current.title}</p> : null}
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
