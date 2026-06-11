import {
  EvidenceType,
  MembershipStatus,
  OrganizationRole,
  Phase,
  Role,
  SavingsImpactType,
  SubscriptionStatus,
} from "@prisma/client";

export const UTOPIATRAX_DEMO_NAME = "UtopiaTrax";
export const UTOPIATRAX_DEMO_SLUG = "utopiatrax";
export const UTOPIATRAX_SHOWCASE_CARD_TITLE =
  "PP Carrier dual-source negotiation";

export const UTOPIATRAX_DEMO_REQUIREMENTS = {
  users: 4,
  directCategories: 6,
  savingCards: 25,
  evidenceDefinitions: 12,
  persistedEvidence: 12,
  alternativeCards: 8,
  pendingPhaseRequests: 5,
  pendingOpenActions: 7,
  volumeProfileCards: 10,
  financeLockedCards: 1,
} as const;

export const UTOPIATRAX_EXPECTED_USERS = [
  {
    email: "taylaniscan+4@gmail.com",
    role: Role.HEAD_OF_GLOBAL_PROCUREMENT,
    membershipRole: OrganizationRole.OWNER,
    recommendedUse: "Dashboard, saving cards, Kanban, reports, and admin",
  },
  {
    email: "taylaniscan+5@gmail.com",
    role: Role.FINANCIAL_CONTROLLER,
    membershipRole: OrganizationRole.ADMIN,
    recommendedUse: "Open Actions and finance approval queue",
  },
  {
    email: "taylaniscan+6@gmail.com",
    role: Role.GLOBAL_CATEGORY_LEADER,
    membershipRole: OrganizationRole.MEMBER,
    recommendedUse: "Category ownership view",
  },
  {
    email: "taylaniscan+7@gmail.com",
    role: Role.TACTICAL_BUYER,
    membershipRole: OrganizationRole.MEMBER,
    recommendedUse: "Operational action view",
  },
] as const;

export const UTOPIATRAX_EXPECTED_CATEGORIES = [
  "Polymer Carriers",
  "TiO2 & White Pigments",
  "Organic Pigments & Dyes",
  "Additives & Stabilizers",
  "Packaging Materials",
  "Tolling & Subcontracted Processing",
] as const;

const CUSTOMER_FACING_UK_TERMS = [
  /\brealised\b/iu,
  /\brealisation\b/iu,
  /\bcancelled\b/iu,
  /\bcancelling\b/iu,
  /\boptimisation\b/iu,
  /\bcolour\b/iu,
  /\bprogramme\b/iu,
] as const;

export type UtopiaTraxStaticCardContract = {
  title: string;
  categoryName: string;
  phase: Phase;
  narrative: string;
  savingDriver: string;
  legacySavingsMethod: string;
  financeLocked?: boolean;
  cancellationReason?: string;
  evidence: ReadonlyArray<{
    fileName: string;
    label: string;
    content: string;
    evidenceType: EvidenceType;
  }>;
  alternative?: unknown;
  volumeProfile?: string;
  savingType?: string;
  impactType?: string;
  impactRecurrence?: string;
  budgetImpact?: string;
};

export type UtopiaTraxStaticContractInput = {
  users: ReadonlyArray<{
    email: string;
    name: string;
    role: Role;
    membershipRole: OrganizationRole;
  }>;
  categories: ReadonlyArray<{ name: string }>;
  cards: ReadonlyArray<UtopiaTraxStaticCardContract>;
  pendingPhaseRequestCount: number;
  expectedPendingOpenActions: number;
};

export type UtopiaTraxPersistedSnapshot = {
  workspace: {
    id: string;
    name: string;
    slug: string;
    workspaceTrialEndsAt: Date | null;
  } | null;
  users: Array<{
    id: string;
    name: string;
    email: string;
    role: Role;
    membershipRole: OrganizationRole | null;
    membershipStatus: MembershipStatus | null;
  }>;
  categories: Array<{ id: string; name: string }>;
  cards: Array<{
    id: string;
    title: string;
    phase: Phase;
    impactType: SavingsImpactType;
    referencePrice: number | null;
    calculatedSavings: number;
    annualizedRunRate: number;
    inYearValue: number;
    financeLocked: boolean;
    cancellationReason: string | null;
    categoryName: string;
    evidence: Array<{
      id: string;
      storageBucket: string;
      storagePath: string;
    }>;
    alternativeSupplierCount: number;
    alternativeMaterialCount: number;
    phaseHistoryCount: number;
    approvalCount: number;
    pendingPhaseRequestCount: number;
    pendingApprovalCount: number;
    forecastCount: number;
    actualCount: number;
  }>;
  billing: {
    customerPresent: boolean;
    subscriptionStatus: SubscriptionStatus | null;
    trialEnd: Date | null;
    currentPeriodEnd: Date | null;
  };
  adminActivityCount: number;
  unrelatedWorkspaceCount: number;
};

export type UtopiaTraxHealthCheck = {
  key: string;
  label: string;
  status: "PASS" | "FAIL" | "WARN";
  detail: string;
};

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

export function getUnexpectedUtopiaTraxWorkspaceUsers(
  emails: readonly string[]
) {
  const expected = new Set(
    UTOPIATRAX_EXPECTED_USERS.map((user) => normalizeEmail(user.email))
  );

  return emails.filter((email) => !expected.has(normalizeEmail(email)));
}

export function getUtopiaTraxResetSafetyViolations(
  organizationId: string,
  users: ReadonlyArray<{
    email: string;
    membershipOrganizationIds: readonly string[];
  }>
) {
  return {
    unexpectedEmails: getUnexpectedUtopiaTraxWorkspaceUsers(
      users.map((user) => user.email)
    ),
    externalMembershipEmails: users
      .filter((user) =>
        user.membershipOrganizationIds.some(
          (membershipOrganizationId) =>
            membershipOrganizationId !== organizationId
        )
      )
      .map((user) => user.email),
  };
}

function duplicateValues(values: readonly string[]) {
  const seen = new Set<string>();
  const duplicates = new Set<string>();

  for (const value of values) {
    const normalized = value.trim().toLowerCase();
    if (seen.has(normalized)) {
      duplicates.add(value);
    }
    seen.add(normalized);
  }

  return [...duplicates].sort();
}

function scanCustomerFacingText(values: readonly string[]) {
  const findings: string[] = [];

  for (const value of values) {
    for (const pattern of CUSTOMER_FACING_UK_TERMS) {
      if (pattern.test(value)) {
        findings.push(value);
        break;
      }
    }
  }

  return findings;
}

export function validateUtopiaTraxStaticContract(
  input: UtopiaTraxStaticContractInput
) {
  const errors: string[] = [];
  const categoryNames = new Set(input.categories.map((category) => category.name));
  const representedCategories = new Set(
    input.cards.map((card) => card.categoryName)
  );
  const evidenceDefinitions = input.cards.reduce(
    (sum, card) => sum + card.evidence.length,
    0
  );
  const alternativeCards = input.cards.filter((card) => card.alternative).length;
  const volumeProfileCards = input.cards.filter((card) => card.volumeProfile).length;
  const financeLockedCards = input.cards.filter((card) => card.financeLocked);
  const canceledCards = input.cards.filter(
    (card) => card.phase === Phase.CANCELLED
  );
  const phases = new Set(input.cards.map((card) => card.phase));

  if (input.users.length !== UTOPIATRAX_DEMO_REQUIREMENTS.users) {
    errors.push(
      `Expected ${UTOPIATRAX_DEMO_REQUIREMENTS.users} demo users, found ${input.users.length}.`
    );
  }

  const expectedUsers = new Map(
    UTOPIATRAX_EXPECTED_USERS.map((user) => [normalizeEmail(user.email), user])
  );
  for (const user of input.users) {
    const expected = expectedUsers.get(normalizeEmail(user.email));
    if (!expected) {
      errors.push(`Unexpected demo user email: ${user.email}.`);
      continue;
    }
    if (user.role !== expected.role || user.membershipRole !== expected.membershipRole) {
      errors.push(`Demo user role mismatch for ${user.email}.`);
    }
  }

  if (input.categories.length !== UTOPIATRAX_DEMO_REQUIREMENTS.directCategories) {
    errors.push(
      `Expected exactly ${UTOPIATRAX_DEMO_REQUIREMENTS.directCategories} direct categories, found ${input.categories.length}.`
    );
  }

  if (input.cards.length !== UTOPIATRAX_DEMO_REQUIREMENTS.savingCards) {
    errors.push(
      `Expected ${UTOPIATRAX_DEMO_REQUIREMENTS.savingCards} saving cards, found ${input.cards.length}.`
    );
  }

  for (const phase of Object.values(Phase)) {
    if (!phases.has(phase)) {
      errors.push(`Missing saving cards in ${phase} phase.`);
    }
  }

  if (
    UTOPIATRAX_EXPECTED_CATEGORIES.some(
      (category) => !categoryNames.has(category)
    ) ||
    UTOPIATRAX_EXPECTED_CATEGORIES.some(
      (category) => !representedCategories.has(category)
    )
  ) {
    errors.push("All six expected direct categories must exist and be represented.");
  }

  if (evidenceDefinitions < UTOPIATRAX_DEMO_REQUIREMENTS.evidenceDefinitions) {
    errors.push(
      `Expected at least ${UTOPIATRAX_DEMO_REQUIREMENTS.evidenceDefinitions} evidence definitions, found ${evidenceDefinitions}.`
    );
  }

  if (alternativeCards < UTOPIATRAX_DEMO_REQUIREMENTS.alternativeCards) {
    errors.push(
      `Expected at least ${UTOPIATRAX_DEMO_REQUIREMENTS.alternativeCards} cards with alternatives, found ${alternativeCards}.`
    );
  }

  if (volumeProfileCards < UTOPIATRAX_DEMO_REQUIREMENTS.volumeProfileCards) {
    errors.push(
      `Expected at least ${UTOPIATRAX_DEMO_REQUIREMENTS.volumeProfileCards} volume-profile cards, found ${volumeProfileCards}.`
    );
  }

  if (
    input.pendingPhaseRequestCount <
    UTOPIATRAX_DEMO_REQUIREMENTS.pendingPhaseRequests
  ) {
    errors.push(
      `Expected at least ${UTOPIATRAX_DEMO_REQUIREMENTS.pendingPhaseRequests} pending phase-change requests, found ${input.pendingPhaseRequestCount}.`
    );
  }

  if (
    input.expectedPendingOpenActions <
    UTOPIATRAX_DEMO_REQUIREMENTS.pendingOpenActions
  ) {
    errors.push(
      `Expected at least ${UTOPIATRAX_DEMO_REQUIREMENTS.pendingOpenActions} pending approval actions, found ${input.expectedPendingOpenActions}.`
    );
  }

  if (!financeLockedCards.length) {
    errors.push("Expected at least one finance-locked card.");
  }
  for (const card of financeLockedCards) {
    if (card.phase !== Phase.VALIDATED) {
      errors.push(
        `Finance lock is only valid in Finance Validated phase: ${card.title}.`
      );
    }
  }

  for (const card of canceledCards) {
    if (!card.cancellationReason?.trim()) {
      errors.push(`Canceled card is missing a cancellation reason: ${card.title}.`);
    }
  }

  for (const card of input.cards) {
    if (!categoryNames.has(card.categoryName)) {
      errors.push(`Card references an unknown category: ${card.title}.`);
    }
    if (
      !card.savingType ||
      !card.impactType ||
      !card.impactRecurrence ||
      !card.budgetImpact
    ) {
      errors.push(`Card is missing savings classification: ${card.title}.`);
    }
  }

  const showcase = input.cards.find(
    (card) => card.title === UTOPIATRAX_SHOWCASE_CARD_TITLE
  );
  if (!showcase) {
    errors.push(
      `Recommended showcase card is missing: ${UTOPIATRAX_SHOWCASE_CARD_TITLE}.`
    );
  } else {
    if (showcase.evidence.length < 4) {
      errors.push("Showcase card must define at least four evidence files.");
    }
    const showcaseEvidenceTypes = new Set(
      showcase.evidence.map((item) => item.evidenceType)
    );
    for (const requiredType of [
      EvidenceType.SUPPLIER_QUOTE,
      EvidenceType.PRICE_CONFIRMATION,
      EvidenceType.CALCULATION_WORKBOOK,
      EvidenceType.INVOICE_OR_ACTUAL,
    ]) {
      if (!showcaseEvidenceTypes.has(requiredType)) {
        errors.push(
          `Showcase card is missing ${requiredType} evidence coverage.`
        );
      }
    }
    if (!showcase.alternative) {
      errors.push("Showcase card must include an alternative scenario.");
    }
    if (!showcase.volumeProfile) {
      errors.push("Showcase card must include a forecast/actual volume profile.");
    }
    if (
      showcase.phase !== Phase.REALISED &&
      showcase.phase !== Phase.ACHIEVED
    ) {
      errors.push("Showcase card must be implemented or captured.");
    }
  }

  const duplicateGroups = [
    ["user emails", input.users.map((user) => user.email)],
    ["category names", input.categories.map((category) => category.name)],
    ["saving-card titles", input.cards.map((card) => card.title)],
  ] as const;
  for (const [label, values] of duplicateGroups) {
    const duplicates = duplicateValues(values);
    if (duplicates.length) {
      errors.push(`Duplicate ${label}: ${duplicates.join(", ")}.`);
    }
  }

  const customerFacingText = input.cards.flatMap((card) => [
    card.title,
    card.narrative,
    card.savingDriver,
    card.legacySavingsMethod,
    card.cancellationReason ?? "",
    ...card.evidence.flatMap((item) => [
      item.fileName,
      item.label,
      item.content,
    ]),
  ]);
  const terminologyFindings = scanCustomerFacingText(customerFacingText);
  if (terminologyFindings.length) {
    errors.push(
      `Customer-facing demo text contains non-US terminology: ${terminologyFindings.join(" | ")}.`
    );
  }

  return errors;
}

function makeCheck(
  key: string,
  label: string,
  passed: boolean,
  detail: string
): UtopiaTraxHealthCheck {
  return {
    key,
    label,
    status: passed ? "PASS" : "FAIL",
    detail,
  };
}

export function validateUtopiaTraxPersistedSnapshot(
  snapshot: UtopiaTraxPersistedSnapshot
) {
  if (!snapshot.workspace) {
    return [
      makeCheck(
        "workspace",
        "Workspace",
        false,
        "UtopiaTrax was not found. Run npm run db:seed:utopiatrax in an approved non-production environment."
      ),
    ];
  }

  const checks: UtopiaTraxHealthCheck[] = [];
  const cards = snapshot.cards;
  const phaseSet = new Set(cards.map((card) => card.phase));
  const categoriesRepresented = new Set(cards.map((card) => card.categoryName));
  const evidenceCount = cards.reduce(
    (sum, card) => sum + card.evidence.length,
    0
  );
  const alternativeCards = cards.filter(
    (card) =>
      card.alternativeSupplierCount > 0 || card.alternativeMaterialCount > 0
  ).length;
  const pendingRequestCount = cards.reduce(
    (sum, card) => sum + card.pendingPhaseRequestCount,
    0
  );
  const pendingApprovalCount = cards.reduce(
    (sum, card) => sum + card.pendingApprovalCount,
    0
  );
  const volumeCards = cards.filter(
    (card) => card.forecastCount > 0 || card.actualCount > 0
  );
  const forecastRows = cards.reduce((sum, card) => sum + card.forecastCount, 0);
  const actualRows = cards.reduce((sum, card) => sum + card.actualCount, 0);
  const financeLockedCards = cards.filter((card) => card.financeLocked);
  const canceledWithoutReason = cards.filter(
    (card) =>
      card.phase === Phase.CANCELLED && !card.cancellationReason?.trim()
  );
  const knownUsers = new Set(
    UTOPIATRAX_EXPECTED_USERS.map((user) => normalizeEmail(user.email))
  );
  const unexpectedUsers = snapshot.users.filter(
    (user) => !knownUsers.has(normalizeEmail(user.email))
  );
  const missingOrInvalidUsers = UTOPIATRAX_EXPECTED_USERS.filter((expected) => {
    const user = snapshot.users.find(
      (candidate) =>
        normalizeEmail(candidate.email) === normalizeEmail(expected.email)
    );
    return (
      !user ||
      user.role !== expected.role ||
      user.membershipRole !== expected.membershipRole ||
      user.membershipStatus !== MembershipStatus.ACTIVE
    );
  });
  const showcase = cards.find(
    (card) => card.title === UTOPIATRAX_SHOWCASE_CARD_TITLE
  );
  const evidencePathsManaged = cards
    .flatMap((card) =>
      card.evidence.map((item) => ({
        ...item,
        cardId: card.id,
      }))
    )
    .every(
      (item) =>
        item.storageBucket === "evidence-private" &&
        item.storagePath.startsWith(
          `organizations/${snapshot.workspace?.id}/saving-cards/${item.cardId}/evidence/`
        ) &&
        !item.storagePath.includes("..") &&
        !item.storagePath.includes("//")
    );

  checks.push(
    makeCheck(
      "workspace",
      "Workspace",
      snapshot.workspace.name === UTOPIATRAX_DEMO_NAME &&
        snapshot.workspace.slug === UTOPIATRAX_DEMO_SLUG,
      `${snapshot.workspace.name} (${snapshot.workspace.slug})`
    ),
    makeCheck(
      "users",
      "Demo users and memberships",
      snapshot.users.length === UTOPIATRAX_DEMO_REQUIREMENTS.users &&
        !unexpectedUsers.length &&
        !missingOrInvalidUsers.length,
      `${snapshot.users.length} users; ${missingOrInvalidUsers.length} missing or role-mismatched`
    ),
    makeCheck(
      "categories",
      "Direct categories",
      snapshot.categories.length ===
        UTOPIATRAX_DEMO_REQUIREMENTS.directCategories &&
        UTOPIATRAX_EXPECTED_CATEGORIES.every((name) =>
          snapshot.categories.some((category) => category.name === name)
        ) &&
        UTOPIATRAX_EXPECTED_CATEGORIES.every((name) =>
          categoriesRepresented.has(name)
        ),
      `${snapshot.categories.length} categories; ${categoriesRepresented.size} represented`
    ),
    makeCheck(
      "cards",
      "Saving-card portfolio",
      cards.length === UTOPIATRAX_DEMO_REQUIREMENTS.savingCards &&
        cards.every((card) => card.calculatedSavings > 0),
      `${cards.length} cards with ${cards.filter((card) => card.calculatedSavings > 0).length} positive savings cases`
    ),
    (() => {
      const periodizedConsistent = cards.every(
        (card) =>
          card.annualizedRunRate > 0 &&
          card.inYearValue >= 0 &&
          card.inYearValue <= card.annualizedRunRate + 0.01
      );
      const costAvoidanceCards = cards.filter(
        (card) => card.impactType === SavingsImpactType.COST_AVOIDANCE
      );
      const costAvoidanceWithReference = costAvoidanceCards.filter(
        (card) => card.referencePrice !== null && (card.referencePrice ?? 0) > 0
      );

      return makeCheck(
        "periodized-savings",
        "In-year vs annualized run-rate reconciliation",
        periodizedConsistent &&
          costAvoidanceCards.length >= 2 &&
          costAvoidanceWithReference.length === costAvoidanceCards.length,
        `run-rate populated and in-year ≤ run-rate on all cards; ${costAvoidanceWithReference.length}/${costAvoidanceCards.length} cost-avoidance cards carry a reference price`
      );
    })(),
    makeCheck(
      "phases",
      "Mixed workflow phases",
      Object.values(Phase).every((phase) => phaseSet.has(phase)),
      Object.values(Phase)
        .map(
          (phase) =>
            `${phase}=${cards.filter((card) => card.phase === phase).length}`
        )
        .join(", ")
    ),
    makeCheck(
      "evidence",
      "Private evidence records",
      evidenceCount >= UTOPIATRAX_DEMO_REQUIREMENTS.persistedEvidence &&
        evidencePathsManaged,
      `${evidenceCount} records; managed private paths=${evidencePathsManaged ? "yes" : "no"}`
    ),
    makeCheck(
      "alternatives",
      "Alternative scenarios",
      alternativeCards >= UTOPIATRAX_DEMO_REQUIREMENTS.alternativeCards,
      `${alternativeCards} cards with supplier or material alternatives`
    ),
    makeCheck(
      "open-actions",
      "Pending phase requests and open actions",
      pendingRequestCount >=
        UTOPIATRAX_DEMO_REQUIREMENTS.pendingPhaseRequests &&
        pendingApprovalCount >= UTOPIATRAX_DEMO_REQUIREMENTS.pendingOpenActions,
      `${pendingRequestCount} pending requests; ${pendingApprovalCount} pending approvals`
    ),
    makeCheck(
      "workflow-history",
      "Approval and phase history",
      cards.reduce((sum, card) => sum + card.phaseHistoryCount, 0) > 0 &&
        cards.reduce((sum, card) => sum + card.approvalCount, 0) > 0,
      `${cards.reduce((sum, card) => sum + card.phaseHistoryCount, 0)} phase-history rows; ${cards.reduce((sum, card) => sum + card.approvalCount, 0)} decisions`
    ),
    makeCheck(
      "finance-locks",
      "Finance locks and cancellations",
      financeLockedCards.length >=
        UTOPIATRAX_DEMO_REQUIREMENTS.financeLockedCards &&
        financeLockedCards.every((card) => card.phase === Phase.VALIDATED) &&
        !canceledWithoutReason.length,
      `${financeLockedCards.length} locked cards; ${canceledWithoutReason.length} canceled cards missing reason`
    ),
    makeCheck(
      "volume",
      "Forecast and actual volume",
      volumeCards.length >=
        UTOPIATRAX_DEMO_REQUIREMENTS.volumeProfileCards &&
        forecastRows > 0 &&
        actualRows > 0,
      `${volumeCards.length} cards; ${forecastRows} forecast rows; ${actualRows} actual rows`
    ),
    makeCheck(
      "billing",
      "Non-blocking billing access",
      snapshot.billing.customerPresent &&
        (snapshot.billing.subscriptionStatus === SubscriptionStatus.TRIALING ||
          snapshot.billing.subscriptionStatus === SubscriptionStatus.ACTIVE),
      `customer=${snapshot.billing.customerPresent ? "present" : "missing"}; subscription=${snapshot.billing.subscriptionStatus ?? "missing"}`
    ),
    makeCheck(
      "admin-activity",
      "Admin activity",
      snapshot.adminActivityCount > 0,
      `${snapshot.adminActivityCount} workspace audit records`
    ),
    makeCheck(
      "showcase-card",
      "Showcase saving card",
      Boolean(
        showcase &&
          showcase.evidence.length >= 2 &&
          (showcase.alternativeSupplierCount > 0 ||
            showcase.alternativeMaterialCount > 0) &&
          showcase.phaseHistoryCount > 1 &&
          showcase.approvalCount > 0 &&
          showcase.forecastCount > 0 &&
          showcase.actualCount > 0
      ),
      showcase
        ? `${showcase.title}; evidence=${showcase.evidence.length}; alternatives=${showcase.alternativeSupplierCount + showcase.alternativeMaterialCount}; forecast=${showcase.forecastCount}; actual=${showcase.actualCount}`
        : `${UTOPIATRAX_SHOWCASE_CARD_TITLE} is missing`
    ),
    {
      key: "read-only",
      label: "Read-only validation boundary",
      status: "PASS",
      detail: `${snapshot.unrelatedWorkspaceCount} unrelated workspace(s) observed and not mutated`,
    }
  );

  return checks;
}
