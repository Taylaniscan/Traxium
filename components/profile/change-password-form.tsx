"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  getPasswordConfirmationError,
  getPasswordValidationError,
  MIN_PASSWORD_LENGTH,
} from "@/lib/passwords";

type ChangePasswordErrorPayload = {
  error?: string;
};

export function ChangePasswordForm() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!currentPassword) {
      setError("Current password is required.");
      setSuccess(null);
      return;
    }

    const passwordError = getPasswordValidationError(newPassword);

    if (passwordError) {
      setError(passwordError);
      setSuccess(null);
      return;
    }

    const confirmPasswordError = getPasswordConfirmationError(
      newPassword,
      confirmNewPassword
    );

    if (confirmPasswordError) {
      setError(confirmPasswordError);
      setSuccess(null);
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          currentPassword,
          newPassword,
          confirmNewPassword,
        }),
      });

      const payload = (await response.json().catch(() => null)) as
        | ChangePasswordErrorPayload
        | null;

      if (!response.ok) {
        setError(payload?.error ?? "Password could not be updated.");
        return;
      }

      setCurrentPassword("");
      setNewPassword("");
      setConfirmNewPassword("");
      setSuccess("Your password has been updated successfully.");
    } catch (changePasswordError) {
      setError(
        changePasswordError instanceof Error
          ? changePasswordError.message
          : "Password could not be updated."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="profile-current-password">Current password</Label>
          <Input
            id="profile-current-password"
            type="password"
            value={currentPassword}
            onChange={(event) => setCurrentPassword(event.target.value)}
            autoComplete="current-password"
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="profile-new-password">New password</Label>
          <Input
            id="profile-new-password"
            type="password"
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
            autoComplete="new-password"
            placeholder={`At least ${MIN_PASSWORD_LENGTH} characters`}
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="profile-confirm-new-password">
            Confirm new password
          </Label>
          <Input
            id="profile-confirm-new-password"
            type="password"
            value={confirmNewPassword}
            onChange={(event) => setConfirmNewPassword(event.target.value)}
            autoComplete="new-password"
            placeholder="Repeat your new password"
            required
          />
        </div>
      </div>

      <p className="text-sm text-[var(--muted-foreground)]">
        Use at least {MIN_PASSWORD_LENGTH} characters with uppercase,
        lowercase, and numeric characters.
      </p>

      {error ? (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      {success ? (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          {success}
        </div>
      ) : null}

      <div className="flex justify-end">
        <Button type="submit" disabled={loading}>
          {loading ? "Updating password..." : "Update password"}
        </Button>
      </div>
    </form>
  );
}
