export const DEMO_PASSWORD =
  process.env.E2E_DEMO_PASSWORD?.trim() || "Traxium123!";

export const personas = {
  owner: {
    email: "taylaniscan+4@gmail.com",
    password: DEMO_PASSWORD,
  },
  financeAdmin: {
    email: "taylaniscan+5@gmail.com",
    password: DEMO_PASSWORD,
  },
  categoryOwner: {
    email: "taylaniscan+6@gmail.com",
    password: DEMO_PASSWORD,
  },
  buyer: {
    email: "taylaniscan+7@gmail.com",
    password: DEMO_PASSWORD,
  },
  foreignOwner: {
    email: "traxium.e2e.foreign.owner@example.com",
    password: "TraxiumE2E-Owner-2026!",
  },
  financeMember: {
    email: "traxium.e2e.finance.member@example.com",
    password: "TraxiumE2E-Finance-2026!",
  },
  normalMember: {
    email: "traxium.e2e.normal.member@example.com",
    password: "TraxiumE2E-Member-2026!",
  },
} as const;

export const E2E_FOREIGN_WORKSPACE_SLUG = "evil-tenant-e2e";
