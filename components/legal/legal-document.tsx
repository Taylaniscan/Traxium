import Link from "next/link";
import type { ReactNode } from "react";

import { PRIVACY_CONTACT_EMAIL } from "@/lib/legal";

export type LegalSection = {
  id: string;
  title: string;
  body: ReactNode;
};

export function LegalParagraph({ children }: { children: ReactNode }) {
  return <p className="text-sm leading-7 text-[var(--muted-foreground)]">{children}</p>;
}

export function LegalList({ items }: { items: ReactNode[] }) {
  return (
    <ul className="list-disc space-y-2 pl-5 text-sm leading-7 text-[var(--muted-foreground)]">
      {items.map((item, index) => (
        <li key={index}>{item}</li>
      ))}
    </ul>
  );
}

export function LegalTerm({ children }: { children: ReactNode }) {
  return <strong className="font-semibold text-[var(--foreground)]">{children}</strong>;
}

export function LegalContactLink() {
  return (
    <a
      href={`mailto:${PRIVACY_CONTACT_EMAIL}`}
      className="font-medium text-[var(--primary-action)] underline underline-offset-2"
    >
      {PRIVACY_CONTACT_EMAIL}
    </a>
  );
}

export function LegalInlineLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="font-medium text-[var(--primary-action)] underline underline-offset-2"
    >
      {children}
    </Link>
  );
}

export function LegalDocument({
  title,
  effectiveDate,
  sections,
}: {
  title: string;
  effectiveDate: string;
  sections: LegalSection[];
}) {
  return (
    <main className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      <header className="border-b border-[var(--border)] bg-[var(--surface)]">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-4">
          <Link href="/" className="text-base font-semibold">
            Traxium
          </Link>
          <nav className="flex items-center gap-2 text-sm">
            <Link href="/trust" className="rounded-md px-3 py-2 font-medium">
              Trust &amp; security
            </Link>
            <Link href="/login" className="rounded-md px-3 py-2 font-medium">
              Sign in
            </Link>
          </nav>
        </div>
      </header>

      <article className="mx-auto max-w-3xl px-6 py-12">
        <h1 className="text-3xl font-semibold tracking-[-0.02em] sm:text-4xl">{title}</h1>
        <p className="mt-3 text-sm text-[var(--muted-foreground)]">
          Effective {effectiveDate}
        </p>

        <nav
          aria-label={`${title} sections`}
          className="mt-8 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5"
        >
          <p className="text-sm font-semibold">Contents</p>
          <ol className="mt-3 grid gap-1 text-sm sm:grid-cols-2">
            {sections.map((section) => (
              <li key={section.id}>
                <a
                  href={`#${section.id}`}
                  className="text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
                >
                  {section.title}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        <div className="mt-10 space-y-10">
          {sections.map((section) => (
            <section key={section.id} id={section.id} className="scroll-mt-8 space-y-3">
              <h2 className="text-xl font-semibold">{section.title}</h2>
              {section.body}
            </section>
          ))}
        </div>

        <footer className="mt-12 flex flex-wrap gap-4 border-t border-[var(--border)] pt-6 text-sm text-[var(--muted-foreground)]">
          <Link href="/terms" className="hover:text-[var(--foreground)]">
            Terms of Service
          </Link>
          <Link href="/privacy" className="hover:text-[var(--foreground)]">
            Privacy Policy
          </Link>
          <Link href="/trust" className="hover:text-[var(--foreground)]">
            Trust &amp; security
          </Link>
        </footer>
      </article>
    </main>
  );
}
