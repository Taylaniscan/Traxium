import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Traxium",
  description: "Procurement Savings Tracker MVP"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
