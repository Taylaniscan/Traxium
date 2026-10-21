// Fails a hosted (Vercel preview/production) build when the target database has
// pending Prisma migrations. Shipping code ahead of its schema breaks every query
// that selects a new column, so `npm run release:migrate` must run first.
import { spawnSync } from "node:child_process";

const hostingEnvironment = process.env.VERCEL_ENV?.trim().toLowerCase() ?? "";

if (hostingEnvironment !== "preview" && hostingEnvironment !== "production") {
  console.info(
    JSON.stringify({
      event: "migrations.check.skipped",
      reason: "not_a_hosted_deploy",
    })
  );
  process.exit(0);
}

const result = spawnSync("npx", ["prisma", "migrate", "status"], {
  encoding: "utf8",
  env: process.env,
});
const output = `${result.stdout ?? ""}${result.stderr ?? ""}`;

if (result.status === 0) {
  console.info(
    JSON.stringify({
      event: "migrations.check.passed",
      hostingEnvironment,
    })
  );
  process.exit(0);
}

const pending = output.includes("have not yet been applied");

console.error(
  JSON.stringify({
    event: "migrations.check.failed",
    hostingEnvironment,
    reason: pending ? "pending_migrations" : "status_unavailable",
    error: pending
      ? "The target database has unapplied Prisma migrations. Run `npm run release:migrate` against this environment's database before deploying."
      : "Could not confirm the migration status of the target database. Check DIRECT_URL and database availability.",
  })
);
console.error(output.trim());
process.exit(1);
