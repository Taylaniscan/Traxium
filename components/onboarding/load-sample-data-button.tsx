"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

type LoadSampleDataButtonProps = {
  children: React.ReactNode;
  variant?: "default" | "secondary" | "ghost" | "outline";
  size?: "default" | "sm" | "lg";
  className?: string;
  successHref?: string | null;
};

type LoadSampleDataErrorPayload = {
  error?: string;
};

export function LoadSampleDataButton({
  children,
  variant = "outline",
  size = "sm",
  className,
  successHref = null,
}: LoadSampleDataButtonProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/onboarding/sample-data", {
        method: "POST",
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as LoadSampleDataErrorPayload | null;
        setError(payload?.error ?? "Sample data could not be loaded.");
        setLoading(false);
        return;
      }

      if (successHref) {
        window.location.assign(successHref);
        return;
      }

      window.location.reload();
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Sample data could not be loaded."
      );
      setLoading(false);
    }
  }

  return (
    <div className="space-y-2">
      <Button
        type="button"
        variant={variant}
        size={size}
        className={className}
        onClick={handleClick}
        disabled={loading}
      >
        {loading ? "Loading sample data..." : children}
      </Button>
      {error ? (
        <p className="text-xs text-red-600">{error}</p>
      ) : null}
    </div>
  );
}
