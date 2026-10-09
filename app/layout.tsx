import type { Metadata } from "next";
import { Figtree } from "next/font/google";
import { AnalyticsBootstrap } from "@/components/analytics/analytics-bootstrap";
import "./globals.css";

const figtree = Figtree({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-sans",
});

export const metadata: Metadata = {
  title: "Traxium | Finance-Trusted Procurement Savings for SMEs",
  description:
    "Finance-trusted procurement savings tracking for SMEs worldwide. Small procurement and finance teams can govern saving cards, evidence, approvals, and reporting in one workspace.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`h-full scroll-smooth ${figtree.variable}`}>
      <body className="min-h-full bg-[var(--background)] text-[var(--foreground)] antialiased">
        <AnalyticsBootstrap />
        {children}
      </body>
    </html>
  );
}
