"use client";

import { useRef, useState, type FormEvent } from "react";
import { Plus } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { onboardingPrimaryClass } from "@/components/onboarding/onboarding-shell";
import type { MasterDataOnboardingEntityKey } from "@/lib/onboarding/master-data-config";

type QuickAddRecordProps = {
  entity: MasterDataOnboardingEntityKey;
  label: string;
  example: string;
  onCreated: () => void;
  allowEmail?: boolean;
  allowRegion?: boolean;
};

type SaveResult = {
  error?: string;
  summary?: { created: number; skipped: number; failed: number };
  results?: Array<{ message: string; status: string }>;
};

export function QuickAddRecord({
  entity,
  label,
  example,
  onCreated,
  allowEmail = false,
  allowRegion = false,
}: QuickAddRecordProps) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [region, setRegion] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{
    text: string;
    error: boolean;
  } | null>(null);
  const inFlight = useRef(false);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (inFlight.current || !name.trim() || (allowRegion && !region.trim()))
      return;
    inFlight.current = true;
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch("/api/onboarding/master-data", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          entity,
          rows: [
            {
              name: name.trim(),
              ...(allowEmail ? { email: email.trim() } : {}),
              ...(allowRegion ? { region: region.trim() } : {}),
            },
          ],
        }),
      });
      const result = (await response
        .json()
        .catch(() => null)) as SaveResult | null;
      if (!response.ok || !result?.summary) {
        setMessage({
          text:
            result?.error ??
            `Could not save this ${label.toLowerCase()}. Try again.`,
          error: true,
        });
        return;
      }
      const row = result.results?.[0];
      if (result.summary.created === 1) {
        setMessage({
          text: `${name.trim()} was added. You can add another or continue.`,
          error: false,
        });
        setName("");
        setEmail("");
        setRegion("");
        onCreated();
      } else {
        setMessage({
          text:
            row?.message ??
            "This record was not added. Check the details and try again.",
          error: result.summary.failed > 0,
        });
      }
    } catch {
      setMessage({
        text: "Could not connect. Your entry is still here; try again.",
        error: true,
      });
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={save}
      className="space-y-4 rounded-xl border border-[#e1e8e8] bg-white p-5 sm:p-6"
    >
      <div>
        <Label htmlFor={`quick-${entity}`} className="text-sm font-semibold">
          {label} name
        </Label>
        <Input
          id={`quick-${entity}`}
          value={name}
          onChange={(event) => setName(event.target.value)}
          maxLength={120}
          placeholder={example}
          className="mt-2 h-11 rounded-xl"
          required
        />
      </div>
      {allowEmail ? (
        <div>
          <Label htmlFor="quick-buyer-email">
            Work email{" "}
            <span className="font-normal text-[#5b7075]">(optional)</span>
          </Label>
          <Input
            id="quick-buyer-email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="buyer@example.com"
            className="mt-2 h-11 rounded-xl"
          />
        </div>
      ) : null}
      {allowRegion ? (
        <div>
          <Label htmlFor="quick-site-region">Region or country</Label>
          <Input
            id="quick-site-region"
            value={region}
            onChange={(event) => setRegion(event.target.value)}
            maxLength={120}
            placeholder="e.g. Benelux"
            className="mt-2 h-11 rounded-xl"
            required
          />
        </div>
      ) : null}
      {message ? (
        <p
          role={message.error ? "alert" : "status"}
          className={`rounded-xl px-4 py-3 text-sm ${message.error ? "bg-red-50 text-red-800" : "bg-emerald-50 text-emerald-900"}`}
        >
          {message.text}
        </p>
      ) : null}
      <button
        type="submit"
        className={onboardingPrimaryClass}
        disabled={busy || !name.trim() || (allowRegion && !region.trim())}
      >
        {busy ? (
          "Saving…"
        ) : (
          <>
            <Plus size={16} aria-hidden="true" /> Add {label.toLowerCase()}
          </>
        )}
      </button>
    </form>
  );
}
