import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

type MatrixRow = {
  route: string;
  methods: string[];
  rateLimitedCell: string;
};

function readProjectFile(relativePath: string) {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

function walkRouteFiles(directory: string, results: string[] = []) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const fullPath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      walkRouteFiles(fullPath, results);
      continue;
    }

    if (entry.isFile() && entry.name === "route.ts") {
      results.push(
        path.relative(process.cwd(), fullPath).split(path.sep).join("/")
      );
    }
  }

  return results;
}

function routePathFromFile(relativeFilePath: string) {
  return `/${relativeFilePath.replace(/^app\//u, "").replace(/\/route\.ts$/u, "")}`;
}

function parseMethods(value: string) {
  return [...value.matchAll(/`(GET|POST|PUT|PATCH|DELETE)`/g)].map(
    ([, method]) => method
  );
}

function parseMatrixRows(markdown: string) {
  return markdown
    .split("\n")
    .filter((line) => /^\|\s*`\/api\//u.test(line))
    .map((line) => {
      const cells = line
        .split("|")
        .slice(1, -1)
        .map((cell) => cell.trim());

      return {
        route: cells[0].replace(/`/g, ""),
        methods: parseMethods(cells[1]),
        rateLimitedCell: cells[8],
      } satisfies MatrixRow;
    });
}

function getDocumentedRateLimitedMethods(row: MatrixRow) {
  if (row.rateLimitedCell === "Yes") {
    return row.methods;
  }

  if (row.rateLimitedCell === "No" || row.rateLimitedCell === "N/A") {
    return [];
  }

  if (!row.rateLimitedCell.includes("Yes")) {
    return [];
  }

  return [...new Set(parseMethods(row.rateLimitedCell))];
}

function getActualRateLimitedMethods(routeSource: string) {
  const methodMatches = [...routeSource.matchAll(/export async function (GET|POST|PUT|PATCH|DELETE)\s*\(/g)];

  return methodMatches
    .filter((match, index) => {
      const start = match.index ?? 0;
      const end = methodMatches[index + 1]?.index ?? routeSource.length;
      const block = routeSource.slice(start, end);

      return block.includes("enforceRateLimit(");
    })
    .map((match) => match[1]);
}

describe("api hardening matrix", () => {
  it("covers the current major hardened route families with concrete route names", () => {
    const matrix = readProjectFile("docs/api-hardening-matrix.md");

    for (const route of [
      "/api/admin/insights",
      "/api/admin/jobs",
      "/api/saving-cards",
      "/api/saving-cards/[id]",
      "/api/invitations",
      "/api/invitations/[token]",
      "/api/invitations/[token]/accept",
      "/api/invitations/[token]/complete",
      "/api/onboarding/workspace",
      "/api/onboarding/sample-data",
      "/api/auth/forgot-password",
      "/api/auth/reset-password",
      "/api/upload/evidence",
      "/api/evidence/[id]/download",
      "/api/import",
      "/api/export",
    ]) {
      expect(matrix).toContain(route);
    }
  });

  it("keeps rate-limit documentation aligned with the actual route handlers", () => {
    const matrix = readProjectFile("docs/api-hardening-matrix.md");
    const rows = parseMatrixRows(matrix);
    const rowsByRoute = new Map(rows.map((row) => [row.route, row]));
    const routeFiles = walkRouteFiles(path.join(process.cwd(), "app/api"));
    const actualRateLimitedRoutes = routeFiles
      .map((filePath) => {
        const route = routePathFromFile(filePath);
        const source = readProjectFile(filePath);

        return {
          route,
          actualRateLimitedMethods: getActualRateLimitedMethods(source),
        };
      })
      .filter((entry) => entry.actualRateLimitedMethods.length > 0);

    for (const entry of actualRateLimitedRoutes) {
      const row = rowsByRoute.get(entry.route);

      expect(row, `Missing matrix row for ${entry.route}`).toBeTruthy();
      expect(getDocumentedRateLimitedMethods(row as MatrixRow)).toEqual(
        entry.actualRateLimitedMethods
      );
    }

    for (const row of rows) {
      const routeFile = routeFiles.find(
        (filePath) => routePathFromFile(filePath) === row.route
      );

      if (!routeFile) {
        continue;
      }

      const source = readProjectFile(routeFile);

      expect(getDocumentedRateLimitedMethods(row)).toEqual(
        getActualRateLimitedMethods(source)
      );
    }
  });

  it("does not leave protected routes marked as unknown or TODO", () => {
    const matrix = readProjectFile("docs/api-hardening-matrix.md");

    expect(matrix).not.toContain("Unknown");
    expect(matrix).not.toContain("TODO");
  });
});
