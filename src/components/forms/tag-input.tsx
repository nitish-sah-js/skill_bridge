"use client";

import { useId, useState, type KeyboardEvent } from "react";
import { Plus, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Pick from suggestions or type your own; values are shown as removable chips. */
export function TagInput({
  id,
  value,
  onChange,
  suggestions = [],
  placeholder,
  max = 20,
  invalid,
}: {
  id: string;
  value: string[];
  onChange: (next: string[]) => void;
  suggestions?: string[];
  placeholder?: string;
  max?: number;
  invalid?: boolean;
}) {
  const [draft, setDraft] = useState("");
  const listId = useId();
  const has = (v: string) => value.some((x) => x.toLowerCase() === v.toLowerCase());

  const add = (raw: string) => {
    const v = raw.trim().slice(0, 40);
    if (!v || has(v) || value.length >= max) return;
    onChange([...value, v]);
  };
  const remove = (v: string) => onChange(value.filter((x) => x !== v));

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      add(draft);
      setDraft("");
    } else if (e.key === "Backspace" && !draft && value.length) {
      remove(value[value.length - 1]);
    }
  };

  const remaining = suggestions.filter((s) => !has(s));

  return (
    <div className="grid gap-2.5">
      {value.length > 0 && (
        <ul className="flex flex-wrap gap-1.5" aria-label="Selected">
          {value.map((v) => (
            <li key={v}>
              <span className="inline-flex items-center gap-1 rounded-full border border-primary/50 bg-primary/15 py-0.5 pr-1 pl-2.5 text-sm text-foreground">
                {v}
                <button
                  type="button"
                  onClick={() => remove(v)}
                  className="rounded p-0.5 outline-none hover:bg-primary/10 focus-visible:ring-2 focus-visible:ring-ring"
                  aria-label={`Remove ${v}`}
                >
                  <X className="size-3.5" />
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}
      <div className="flex gap-2">
        <Input
          id={id}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          aria-invalid={invalid}
          aria-describedby={listId}
        />
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            add(draft);
            setDraft("");
          }}
          disabled={!draft.trim()}
        >
          <Plus /> Add
        </Button>
      </div>
      {remaining.length > 0 && (
        <div id={listId}>
          <p className="mb-1.5 text-xs text-muted-foreground">Suggestions</p>
          <div className="flex flex-wrap gap-1.5">
            {remaining.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => add(s)}
                disabled={value.length >= max}
                className={cn(
                  "rounded-full border border-dashed border-primary/30 px-2.5 py-0.5 text-sm text-muted-foreground outline-none transition-colors hover:border-primary hover:bg-primary/10 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50",
                )}
              >
                + {s}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
