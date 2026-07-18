import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const repository = process.env.GITHUB_REPOSITORY ?? "dangssss/Showcase_Vnpost_churn_ver1";
const repositoryName = repository.split("/").at(-1);

if (!repositoryName) {
  throw new Error("GITHUB_REPOSITORY must include a repository name.");
}

const nextBin = fileURLToPath(new URL("../node_modules/next/dist/bin/next", import.meta.url));
const result = spawnSync(process.execPath, [nextBin, "build"], {
  stdio: "inherit",
  env: {
    ...process.env,
    GITHUB_PAGES: "true",
    GITHUB_REPOSITORY: repository,
    NEXT_PUBLIC_BASE_PATH: process.env.NEXT_PUBLIC_BASE_PATH ?? `/${repositoryName}`,
  },
});

process.exit(result.status ?? 1);
