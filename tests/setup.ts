import { afterEach, vi } from "vitest";

// next/font requires the Next.js compiler; in Vitest, return a stable stub so
// modules that load fonts (e.g. app/layout.tsx) can be imported in tests.
vi.mock("next/font/google", () => ({
  Figtree: () => ({
    className: "font-figtree",
    variable: "--font-sans",
    style: { fontFamily: "Figtree" },
  }),
}));

afterEach(() => {
  vi.restoreAllMocks();
  vi.resetAllMocks();
});
