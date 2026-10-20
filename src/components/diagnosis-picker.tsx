"use client";

import { Search, X } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { cn } from "@/lib/utils";

export type DiagnosisOption = { code: string; description: string };

/**
 * Type-to-filter diagnosis code picker (spec v2 "Diagnosis code field"). Typing a code (F41)
 * or words (anxiety) narrows the list. Arrow keys move, Enter picks, Escape closes, and the
 * picked code can be cleared. `search` is a Server Action that returns the matches.
 */
export function DiagnosisPicker({
  value,
  onChange,
  search,
  label = "Diagnosis code (optional)",
}: {
  value: DiagnosisOption | null;
  onChange: (value: DiagnosisOption | null) => void;
  search: (query: string) => Promise<DiagnosisOption[]>;
  label?: string;
}) {
  const id = useId();
  const listId = `${id}-list`;
  const [query, setQuery] = useState("");
  const [options, setOptions] = useState<DiagnosisOption[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open || !query.trim()) return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      const found = await search(query).catch(() => []);
      if (!cancelled) {
        setOptions(found);
        setActive(0);
      }
    }, 200);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, open, search]);

  const shown = query.trim() ? options : [];

  function pick(option: DiagnosisOption) {
    onChange(option);
    setQuery("");
    setOpen(false);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setActive((i) => Math.min(i + 1, Math.max(shown.length - 1, 0)));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && open && shown[active]) {
      e.preventDefault();
      pick(shown[active]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div className="grid gap-2">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      {value ? (
        <div className="flex h-12 items-center gap-2 rounded-md border-[1.5px] border-input bg-card pr-1.5 pl-3.5">
          <span className="min-w-0 flex-1 truncate">
            <span className="font-semibold">{value.code}</span> {value.description}
          </span>
          <button
            type="button"
            onClick={() => {
              onChange(null);
              requestAnimationFrame(() => inputRef.current?.focus());
            }}
            aria-label="Clear diagnosis code"
            className="flex size-9 items-center justify-center rounded-full text-muted-foreground outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring"
          >
            <X className="size-4" aria-hidden />
          </button>
        </div>
      ) : (
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <input
            ref={inputRef}
            id={id}
            role="combobox"
            aria-expanded={open && shown.length > 0}
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={open && shown[active] ? `${id}-opt-${active}` : undefined}
            aria-describedby={`${id}-hint`}
            autoComplete="off"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            onBlur={() => setTimeout(() => setOpen(false), 150)}
            onKeyDown={onKeyDown}
            className="h-12 w-full rounded-md border-[1.5px] border-input bg-card pr-3.5 pl-10 text-base outline-none placeholder:text-subtle-foreground focus-visible:border-primary focus-visible:ring-3 focus-visible:ring-ring"
            placeholder="Search codes"
          />
          {open && shown.length > 0 && (
            <ul
              id={listId}
              role="listbox"
              className="absolute inset-x-0 top-full z-20 mt-1 max-h-64 overflow-y-auto rounded-md border border-border-subtle bg-popover p-1 shadow-md"
            >
              {shown.map((option, i) => (
                <li
                  key={option.code}
                  id={`${id}-opt-${i}`}
                  role="option"
                  aria-selected={i === active}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    pick(option);
                  }}
                  onMouseEnter={() => setActive(i)}
                  className={cn("cursor-pointer rounded-sm px-3 py-2.5", i === active && "bg-muted")}
                >
                  <span className="font-semibold">{option.code}</span>{" "}
                  <span className="text-muted-foreground">{option.description}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      <p id={`${id}-hint`} className="text-sm text-muted-foreground">
        Type to filter, e.g. F41 or anxiety.
      </p>
    </div>
  );
}
