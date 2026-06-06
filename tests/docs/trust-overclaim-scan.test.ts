import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const filesToScan = [
  "docs/trust-pack.md",
  "docs/support-expectations.md",
  "docs/data-export-offboarding.md",
  "docs/backup-restore-statement.md",
  "docs/paid-pilot-buyer-package.md",
  "docs/paid-pilot-offer-and-pricing.md",
  "app/page.tsx",
  "app/trust/page.tsx",
  "app/pilot/page.tsx",
  "README.md",
] as const;

const unsupportedClaims = [
  /\bSOC 2 certified\b/iu,
  /\bISO 27001 certified\b/iu,
  /\bHIPAA compliant\b/iu,
  /\b24\/7 support\b/iu,
  /\bSSO(?:\/SAML)? (?:is )?included\b/iu,
  /\bSAML (?:is )?included\b/iu,
  /\bSCIM (?:is )?included\b/iu,
  /\bERP (?:or MRP )?integration (?:is )?included\b/iu,
  /\baccounting(?:-system)? posting\b/iu,
  /\baudited savings\b/iu,
  /\bguaranteed savings\b/iu,
  /\benterprise SLA\b/iu,
  /\bcustom approval[- ]builder\b/iu,
  /\bvendor risk scoring\b/iu,
  /\bcontract lifecycle management\b/iu,
  /\bspend analytics suite\b/iu,
] as const;

const exclusionContext =
  /\b(no|not|does not|do not|without|excluded|exclusions?|outside|unsupported|must not|not currently|requires more proof|cannot|isn't)\b/iu;

function readProjectFile(relativePath: string) {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

function findUnsupportedClaimsInText(filePath: string, contents: string) {
  const lines = contents.split("\n");
  const violations: string[] = [];
  let currentHeading = "";
  let currentQualifier = "";

  lines.forEach((line, index) => {
    if (/^#{1,6}\s/u.test(line)) {
      currentHeading = line;
      currentQualifier = "";
    } else if (
      /^(Not a good|Excluded|Claims that require|Not included|The standard pilot does not include|Traxium does not currently include).+:\s*$/iu.test(
        line.trim()
      )
    ) {
      currentQualifier = line;
    }

    for (const phrase of unsupportedClaims) {
      if (!phrase.test(line)) {
        continue;
      }

      const nearbyLines = lines.slice(Math.max(0, index - 3), index + 1);
      const context =
        `${currentHeading} ${currentQualifier} ${nearbyLines.join(" ")}`;

      if (!exclusionContext.test(context)) {
        violations.push(`${filePath}:${index + 1}: ${line.trim()}`);
      }
    }
  });

  return violations;
}

function findUnsupportedClaims(filePath: string) {
  return findUnsupportedClaimsInText(filePath, readProjectFile(filePath));
}

describe("trust no-overclaim scan", () => {
  it("allows explicit limitations while rejecting unsupported affirmative claims", () => {
    const violations = filesToScan.flatMap(findUnsupportedClaims);

    expect(violations).toEqual([]);
  });

  it("rejects affirmative claims and permits explicit non-claims", () => {
    expect(
      findUnsupportedClaimsInText(
        "affirmative.md",
        "Traxium is SOC 2 certified and provides 24/7 support."
      )
    ).toEqual([
      "affirmative.md:1: Traxium is SOC 2 certified and provides 24/7 support.",
      "affirmative.md:1: Traxium is SOC 2 certified and provides 24/7 support.",
    ]);

    expect(
      findUnsupportedClaimsInText(
        "exclusion.md",
        "## Known Exclusions\nTraxium is not SOC 2 certified and does not provide 24/7 support."
      )
    ).toEqual([]);
  });

  it("includes every required buyer-facing trust surface", () => {
    for (const filePath of filesToScan) {
      expect(fs.existsSync(path.join(process.cwd(), filePath))).toBe(true);
    }
  });
});
