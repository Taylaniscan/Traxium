import fs from "node:fs";
import path from "node:path";

const nextBuildPath = path.join(
  process.cwd(),
  process.env.NEXT_DIST_DIR?.trim() || ".next"
);
const tsBuildInfoPath = path.join(process.cwd(), "tsconfig.tsbuildinfo");

for (const targetPath of [nextBuildPath, tsBuildInfoPath]) {
  fs.rmSync(targetPath, { recursive: true, force: true });
}

console.log("Cleared Next.js build artifacts.");
