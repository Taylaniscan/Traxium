"use client";

import Link from "next/link";
import { useRef, useState, type FormEvent } from "react";
import { MailPlus } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { onboardingPrimaryClass } from "@/components/onboarding/onboarding-shell";

type InvitationResult = {
  error?: string;
  invitation?: { token: string };
  delivery?: { state?: string; requiresManualDelivery?: boolean };
};

export function InviteColleague({ canInvite }: { canInvite: boolean }) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"MEMBER" | "ADMIN">("MEMBER");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{
    text: string;
    error: boolean;
    link?: string;
  } | null>(null);
  const inFlight = useRef(false);

  async function invite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (inFlight.current || !canInvite) return;
    inFlight.current = true;
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch("/api/invitations", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: email.trim(), role }),
      });
      const result = (await response
        .json()
        .catch(() => null)) as InvitationResult | null;
      if (!response.ok || !result?.invitation) {
        setMessage({
          text: result?.error ?? "Could not create the invitation. Try again.",
          error: true,
        });
        return;
      }
      const manual =
        result.delivery?.requiresManualDelivery ||
        result.delivery?.state === "unavailable";
      setMessage({
        text: manual
          ? `Invitation created for ${email.trim()}. Share the link yourself.`
          : `Invitation created for ${email.trim()}. Delivery is being processed.`,
        error: false,
        link: manual ? `/invite/${result.invitation.token}` : undefined,
      });
      setEmail("");
    } catch {
      setMessage({
        text: "Could not connect. Your email is still here; try again.",
        error: true,
      });
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  if (!canInvite)
    return (
      <p className="rounded-xl border border-[#e1e8e8] bg-white p-5 text-sm text-[#5b7075]">
        Ask a workspace owner or admin to invite colleagues. You can continue
        setting up your own work.
      </p>
    );

  return (
    <form
      onSubmit={invite}
      className="space-y-4 rounded-xl border border-[#e1e8e8] bg-white p-5 sm:p-6"
    >
      <div>
        <Label
          htmlFor="invite-colleague-email"
          className="text-sm font-semibold"
        >
          Invite a colleague{" "}
          <span className="font-normal text-[#5b7075]">(optional)</span>
        </Label>
        <Input
          id="invite-colleague-email"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="colleague@example.com"
          className="mt-2 h-11 rounded-xl"
          required
        />
      </div>
      <div>
        <Label htmlFor="invite-colleague-role">Workspace access</Label>
        <Select
          id="invite-colleague-role"
          value={role}
          onChange={(event) =>
            setRole(event.target.value as "MEMBER" | "ADMIN")
          }
          className="mt-2"
        >
          <option value="MEMBER">Team member</option>
          <option value="ADMIN">Workspace admin</option>
        </Select>
        <p className="mt-2 text-xs text-[#5b7075]">
          Procurement and finance approval roles can be assigned after your
          colleague joins.
        </p>
      </div>
      {message ? (
        <div
          role={message.error ? "alert" : "status"}
          className={`rounded-xl px-4 py-3 text-sm ${message.error ? "bg-red-50 text-red-800" : "bg-emerald-50 text-emerald-900"}`}
        >
          <p>{message.text}</p>
          {message.link ? (
            <Link
              href={message.link}
              className="mt-2 inline-block font-semibold underline underline-offset-4"
            >
              Open invitation link
            </Link>
          ) : null}
        </div>
      ) : null}
      <button
        type="submit"
        className={onboardingPrimaryClass}
        disabled={busy || !email.trim()}
      >
        {busy ? (
          "Creating invitation…"
        ) : (
          <>
            <MailPlus size={16} aria-hidden="true" /> Create invitation
          </>
        )}
      </button>
    </form>
  );
}
