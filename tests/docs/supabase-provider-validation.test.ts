import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

function readProjectFile(relativePath: string) {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

describe("supabase provider validation docs", () => {
  it("documents the read-only provider script and manual redirect allow-list proof", () => {
    const docs = readProjectFile("docs/supabase-provider-validation.md");
    const packageJson = JSON.parse(readProjectFile("package.json")) as {
      scripts?: Record<string, string>;
    };

    expect(packageJson.scripts?.["supabase:validate"]).toContain(
      "scripts/validate-supabase-provider.ts"
    );
    expect(docs).toContain("npm run supabase:validate");
    expect(docs).toContain("The script is read-only.");
    expect(docs).toContain("The evidence bucket is private");
    expect(docs).toContain("The anon key cannot create a signed URL");
    expect(docs).toContain("The unauthenticated public storage URL is not readable.");
    expect(docs).toContain("auth_redirect_allow_list");
    expect(docs).toContain("${NEXT_PUBLIC_APP_URL}/invite/*");
    expect(docs).toContain("${NEXT_PUBLIC_APP_URL}/reset-password");
    expect(docs).toContain("${NEXT_PUBLIC_APP_URL}/auth/bootstrap");
    expect(docs).toContain("tests/api/password-recovery.test.ts");
    expect(docs).toContain("tests/api/storage-tenant-access.test.ts");
    expect(docs).toContain("tests/middleware.auth-routing.test.ts");
    expect(docs).not.toContain("TODO");
    expect(docs).not.toContain("TBD");
  });
});
