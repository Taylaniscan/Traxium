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
  title: "Traxium | Finance-Trusted Savings Governance",
  description:
    "Traxium helps 50-500 employee US manufacturing SMEs govern saving cards, evidence, approvals, and savings exports in one paid-pilot workspace.",
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
