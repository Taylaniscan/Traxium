import fs from "node:fs";
import path from "node:path";

import ts from "typescript";
import { describe, expect, it } from "vitest";

const CUSTOMER_FACING_TARGETS = [
  "app",
  "components",
  "docs/demo-utopiatrax.md",
  "docs/paid-pilot-buyer-package.md",
  "docs/paid-pilot-offer-and-pricing.md",
  "README.md",
] as const;

const DISALLOWED_TERMS = [
  "Realised",
  "realised",
  "Cancelled",
  "cancelled",
  "Finance Approver",
  "Financial Controller",
  "Head of Global Procurement",
  "Global Category Leader",
  "Workflow Roles",
  "finance approver",
] as const;

const ALLOWED_TECHNICAL_LINES: Array<{
  file: string;
  term: (typeof DISALLOWED_TERMS)[number];
  includes: string;
  reason: string;
}> = [
  {
    file: "app/api/import/route.ts",
    term: "realised",
    includes: 'phaseImportAliases.set("realised", "REALISED")',
    reason: "Legacy import compatibility maps UK spelling into the stable internal enum.",
  },
  {
    file: "app/api/import/route.ts",
    term: "cancelled",
    includes: 'phaseImportAliases.set("cancelled", "CANCELLED")',
    reason: "Legacy import compatibility maps UK spelling into the stable internal enum.",
  },
  {
    file: "app/billing-required/page.tsx",
    term: "cancelled",
    includes: 'case "checkout_cancelled"',
    reason: "Billing query-state compatibility, not buyer-facing copy.",
  },
  {
    file: "app/settings/billing/page.tsx",
    term: "cancelled",
    includes: 'checkoutState === "cancelled"',
    reason: "Billing query-state compatibility, not buyer-facing copy.",
  },
  {
    file: "app/settings/billing/page.tsx",
    term: "cancelled",
    includes: 'case "checkout_cancelled"',
    reason: "Billing query-state compatibility, not buyer-facing copy.",
  },
];

function listFiles(target: string): string[] {
  const absoluteTarget = path.join(process.cwd(), target);
  const stat = fs.statSync(absoluteTarget);

  if (stat.isFile()) {
    return [target];
  }

  return fs
    .readdirSync(absoluteTarget, { withFileTypes: true })
    .flatMap((entry) => {
      const relativePath = path.join(target, entry.name);

      if (entry.isDirectory()) {
        if (["node_modules", ".next"].includes(entry.name)) {
          return [];
        }

        return listFiles(relativePath);
      }

      return entry.isFile() && /\.(?:md|tsx?|jsx?)$/u.test(entry.name)
        ? [relativePath]
        : [];
    });
}

function isAllowedTechnicalLine(input: {
  file: string;
  line: string;
  term: (typeof DISALLOWED_TERMS)[number];
}) {
  return ALLOWED_TECHNICAL_LINES.some(
    (allowance) =>
      allowance.file === input.file &&
      allowance.term === input.term &&
      input.line.includes(allowance.includes)
  );
}

type CustomerFacingText = {
  line: number;
  sourceLine: string;
  text: string;
};

function getScriptKind(file: string) {
  if (file.endsWith(".tsx")) return ts.ScriptKind.TSX;
  if (file.endsWith(".jsx")) return ts.ScriptKind.JSX;
  if (file.endsWith(".js")) return ts.ScriptKind.JS;
  return ts.ScriptKind.TS;
}

function collectCustomerFacingText(file: string, content: string) {
  if (file.endsWith(".md")) {
    return content.split(/\r?\n/u).map((text, index) => ({
      line: index + 1,
      sourceLine: text,
      text,
    }));
  }

  const sourceFile = ts.createSourceFile(
    file,
    content,
    ts.ScriptTarget.Latest,
    true,
    getScriptKind(file)
  );
  const findings: CustomerFacingText[] = [];
  const sourceLines = content.split(/\r?\n/u);

  function addNodeText(node: ts.Node, text: string) {
    const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
    findings.push({
      line: line + 1,
      sourceLine: sourceLines[line] ?? text,
      text,
    });
  }

  function visit(node: ts.Node) {
    if (ts.isStringLiteralLike(node) || ts.isJsxText(node)) {
      addNodeText(node, node.text);
    } else if (
      ts.isTemplateHead(node) ||
      ts.isTemplateMiddle(node) ||
      ts.isTemplateTail(node)
    ) {
      addNodeText(node, node.text);
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return findings;
}

describe("US terminology scan", () => {
  it("scans rendered copy while ignoring internal identifier names", () => {
    const findings = collectCustomerFacingText(
      "example.tsx",
      [
        "const realisedSavings = 10;",
        'const label = "Realised savings";',
        "export const view = <p>Cancelled initiative</p>;",
      ].join("\n")
    );

    expect(findings.map((finding) => finding.text)).toEqual([
      "Realised savings",
      "Cancelled initiative",
    ]);
  });

  it("keeps old buyer-facing terminology out of customer-facing surfaces", () => {
    const violations: string[] = [];
    const files = CUSTOMER_FACING_TARGETS.flatMap((target) => listFiles(target));

    for (const file of files) {
      const content = fs.readFileSync(path.join(process.cwd(), file), "utf8");

      for (const finding of collectCustomerFacingText(file, content)) {
        for (const term of DISALLOWED_TERMS) {
          if (
            finding.text.includes(term) &&
            !isAllowedTechnicalLine({ file, line: finding.sourceLine, term })
          ) {
            violations.push(`${file}:${finding.line}: ${term}`);
          }
        }
      }
    }

    expect(violations).toEqual([]);
  });
});
