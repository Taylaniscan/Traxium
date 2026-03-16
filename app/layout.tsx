import type { Metadata } from "next";
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
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}