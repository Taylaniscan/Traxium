"use client";

import { type ReactNode, useState } from "react";
import { Plus, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
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

  const statusLabel =
    value.mode === "new" && value.name
      ? `Will create: ${value.name}`
      : value.id
        ? `Using existing: ${value.name}`
        : "Choose an existing record or create a new one.";

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <Label>
          {label}
          {labelSuffix ? <> {labelSuffix}</> : null}
        </Label>
        {helper ? <span className="text-xs text-[var(--muted-foreground)]">{helper}</span> : null}
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

      <div className="grid gap-2 md:grid-cols-[1fr_auto]">
        <Input
          value={draftName}
          onChange={(event) => setDraftName(event.target.value)}
          placeholder={`Type new ${label.toLowerCase()} name`}
        />
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            const name = draftName.trim();
            if (!name) return;
            onChange({ id: undefined, name, mode: "new" });
          }}
        >
          <Plus className="mr-2 h-4 w-4" />
          Create {label}
        </Button>
      </div>

      <div className="flex items-center gap-2 rounded-2xl bg-[var(--muted)] px-3 py-2 text-xs text-[var(--muted-foreground)]">
        <Sparkles className="h-3.5 w-3.5 text-[var(--accent)]" />
        <span>{statusLabel}</span>
      </div>
    </div>
  );
}
