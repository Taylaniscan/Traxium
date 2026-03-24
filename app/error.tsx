"use client";

import { useEffect } from "react";

type AppErrorProps = {
  error: Error & {
    digest?: string;
  };
  reset: () => void;
};

export default function AppError({ error, reset }: AppErrorProps) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
        background: "#f8fafc",
        color: "#0f172a",
        fontFamily: "ui-sans-serif, system-ui, sans-serif",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "640px",
          border: "1px solid #e2e8f0",
          borderRadius: "24px",
          background: "#ffffff",
          padding: "32px",
          boxShadow: "0 8px 30px rgba(15, 23, 42, 0.08)",
        }}
      >
        <div
          style={{
            display: "inline-flex",
            border: "1px solid #fecaca",
            borderRadius: "999px",
            background: "#fef2f2",
            padding: "6px 12px",
            fontSize: "12px",
            fontWeight: 600,
            textTransform: "uppercase",
            letterSpacing: "0.12em",
            color: "#b91c1c",
          }}
        >
          Application Error
        </div>

        <h1
          style={{
            marginTop: "16px",
            fontSize: "32px",
            lineHeight: 1.1,
            fontWeight: 700,
          }}
        >
          Something went wrong while loading this screen.
        </h1>

        <p
          style={{
            marginTop: "12px",
            fontSize: "14px",
            lineHeight: 1.7,
            color: "#475569",
          }}
        >
          The request failed before the page could finish rendering. You can try the same action again or return to the dashboard.
        </p>

        <div
          style={{
            marginTop: "24px",
            display: "flex",
            flexWrap: "wrap",
            gap: "12px",
          }}
        >
          <button
            type="button"
            onClick={reset}
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              height: "40px",
              padding: "0 16px",
              border: 0,
              borderRadius: "10px",
              background: "#2563eb",
              color: "#ffffff",
              fontSize: "14px",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Try again
          </button>

          <a
            href="/dashboard"
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              height: "40px",
              padding: "0 16px",
              border: "1px solid #cbd5e1",
              borderRadius: "10px",
              background: "#ffffff",
              color: "#0f172a",
              fontSize: "14px",
              fontWeight: 600,
              textDecoration: "none",
            }}
          >
            Go to dashboard
          </a>
        </div>

        {error.digest ? (
          <p
            style={{
              marginTop: "24px",
              fontSize: "12px",
              color: "#64748b",
            }}
          >
            Error reference: {error.digest}
          </p>
        ) : null}
      </div>
    </main>
  );
}
