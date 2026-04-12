import type { Metadata } from "next";
import { AnalyticsBootstrap } from "@/components/analytics/analytics-bootstrap";
import "./globals.css";

export const metadata: Metadata = {
  title: "Traxium | Procurement Savings Governance",
  description:
    "Traxium helps procurement and finance teams govern savings initiatives from idea to realized value.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full scroll-smooth">
      <body className="min-h-full bg-[var(--background)] text-[var(--foreground)] antialiased">
        <AnalyticsBootstrap />
        {children}
      </body>
    </html>
  );
}
