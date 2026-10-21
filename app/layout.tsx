import type { Metadata } from "next";
import { Figtree } from "next/font/google";
import { AnalyticsBootstrap } from "@/components/analytics/analytics-bootstrap";
import "./globals.css";

const figtree = Figtree({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-sans",
});

const siteTitle = "Traxium | Finance-Trusted Procurement Savings for SMEs";
const siteDescription =
  "Finance-trusted procurement savings tracking for SMEs worldwide. Small procurement and finance teams can govern saving cards, evidence, approvals, and reporting in one workspace.";

function resolveMetadataBase() {
  try {
    return new URL(process.env.NEXT_PUBLIC_APP_URL?.trim() || "http://localhost:3000");
  } catch {
    return new URL("http://localhost:3000");
  }
}

export const metadata: Metadata = {
  metadataBase: resolveMetadataBase(),
  title: siteTitle,
  description: siteDescription,
  applicationName: "Traxium",
  openGraph: {
    type: "website",
    siteName: "Traxium",
    title: siteTitle,
    description: siteDescription,
    url: "/",
  },
  twitter: {
    card: "summary",
    title: siteTitle,
    description: siteDescription,
  },
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
