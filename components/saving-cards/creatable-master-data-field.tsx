"use client";

import { type ReactNode, useState } from "react";
import { Sparkles } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";

export type CreatableValue = {
  id?: string;
  name: string;
  mode: "existing" | "new";
};

export function CreatableMasterDataField({
  label,
  labelSuffix,
  items,
  value,
  onChange,
  helper
}: {
  label: string;
  labelSuffix?: ReactNode;
  items: Array<{ id: string; name: string }>;
  value: CreatableValue;
  onChange: (value: CreatableValue) => void;
  helper?: string;
}) {
  const [draftName, setDraftName] = useState(value.mode === "new" ? value.name : "");
  const hasExistingItems = items.length > 0;
  const normalizedDraftName = draftName.trim();

  const statusLabel =
    value.mode === "new" && normalizedDraftName
      ? `Will create in this workspace: ${normalizedDraftName}`
      : value.id
        ? `Using existing: ${value.name}`
        : hasExistingItems
          ? "Select an existing record or type a new one below."
          : `Add the first ${label.toLowerCase()} below to keep this card moving.`;

  const creationPrompt = hasExistingItems
    ? `Need a new ${label.toLowerCase()}? Type it below and continue without leaving the form.`
    : `Type the first ${label.toLowerCase()} below. Traxium will create it in the active workspace when this card is saved.`;

  const inputPlaceholder = hasExistingItems
    ? `Type new ${label.toLowerCase()} name`
    : `Enter first ${label.toLowerCase()} name`;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <Label>
          {label}
          {labelSuffix ? <> {labelSuffix}</> : null}
        </Label>
        {helper ? <span className="text-xs text-[var(--muted-foreground)]">{helper}</span> : null}
      </div>

      {hasExistingItems ? (
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--muted-foreground)]">
              Use existing
            </p>
            <p className="text-xs text-[var(--muted-foreground)]">
              {items.length} available
            </p>
          </div>
          <Select
            value={value.mode === "existing" ? value.id ?? "" : ""}
            onChange={(event) => {
              const selected = items.find((item) => item.id === event.target.value);
              if (!selected) {
                onChange({ id: undefined, name: "", mode: "existing" });
                return;
              }

              setDraftName("");
              onChange({ id: selected.id, name: selected.name, mode: "existing" });
            }}
          >
            <option value="">Select existing {label.toLowerCase()}</option>
            {items.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </Select>
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-[var(--border)] bg-[var(--muted)]/22 px-4 py-4">
          <p className="text-sm font-semibold text-[var(--foreground)]">
            No existing {label.toLowerCase()} yet
          </p>
          <p className="mt-1 text-sm leading-6 text-[var(--muted-foreground)]">
            Start with the first one here. You do not need to leave the saving card form.
          </p>
        </div>
      )}

      <div className="space-y-2 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
        <div className="flex items-center justify-between gap-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--muted-foreground)]">
            {hasExistingItems ? "Create inline" : "Create first record"}
          </p>
          {normalizedDraftName ? (
            <span className="text-xs font-medium text-[var(--info)]">
              Ready to create on save
            </span>
          ) : null}
        </div>
        <Input
          value={draftName}
          onChange={(event) => {
            const nextDraftName = event.target.value;
            const trimmedNextDraftName = nextDraftName.trim();
            setDraftName(nextDraftName);

            if (!trimmedNextDraftName) {
              if (value.mode === "new") {
                onChange({ id: undefined, name: "", mode: "existing" });
              }
              return;
            }

            onChange({ id: undefined, name: trimmedNextDraftName, mode: "new" });
          }}
          placeholder={inputPlaceholder}
        />
        <p className="text-xs leading-5 text-[var(--muted-foreground)]">
          {creationPrompt}
        </p>
      </div>

      <div className="flex items-center gap-2 rounded-2xl bg-[var(--muted)] px-3 py-2 text-xs text-[var(--muted-foreground)]">
        <Sparkles className="h-3.5 w-3.5 text-[var(--accent)]" />
        <span>{statusLabel}</span>
      </div>
    </div>
  );
}
