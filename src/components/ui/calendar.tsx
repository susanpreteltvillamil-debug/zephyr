"use client";

import * as React from "react";
import { DayPicker, type DayPickerProps } from "react-day-picker";
import { es } from "react-day-picker/locale/es";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

/** Calendario en español con los tokens de la marca. */
export function Calendar({ className, classNames, ...props }: DayPickerProps) {
  return (
    <DayPicker
      locale={es}
      weekStartsOn={1}
      showOutsideDays={false}
      className={cn("w-full select-none", className)}
      classNames={{
        root: "relative w-full",
        months: "flex flex-col gap-4",
        month: "w-full",
        month_caption: "flex h-10 items-center justify-center",
        caption_label: "font-display text-lg font-semibold capitalize",
        nav: "absolute inset-x-0 top-0 flex h-10 items-center justify-between",
        button_previous:
          "inline-flex size-10 items-center justify-center rounded-full text-foreground hover:bg-accent disabled:opacity-30 disabled:pointer-events-none",
        button_next:
          "inline-flex size-10 items-center justify-center rounded-full text-foreground hover:bg-accent disabled:opacity-30 disabled:pointer-events-none",
        month_grid: "mt-2 w-full border-collapse",
        weekdays: "flex",
        weekday: "flex-1 pb-2 text-center text-xs font-medium uppercase tracking-wide text-muted-foreground",
        week: "mt-1 flex w-full",
        day: "flex-1 p-0.5 text-center",
        day_button:
          "mx-auto flex aspect-square w-full max-w-11 items-center justify-center rounded-full text-sm font-medium transition-colors hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring disabled:pointer-events-none",
        selected: "[&>button]:bg-primary [&>button]:text-primary-foreground [&>button]:hover:bg-primary-hover",
        today: "[&>button]:ring-1 [&>button]:ring-brand",
        disabled: "[&>button]:text-muted-foreground/45 [&>button]:line-through [&>button]:decoration-1",
        outside: "opacity-40",
        hidden: "invisible",
        ...classNames,
      }}
      components={{
        Chevron: ({ orientation }) =>
          orientation === "left" ? <ChevronLeft className="size-5" /> : <ChevronRight className="size-5" />,
      }}
      {...props}
    />
  );
}
