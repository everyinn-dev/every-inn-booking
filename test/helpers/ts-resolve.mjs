/** node:test resolve hook: the app's "@/…" alias and extensionless TS imports (Next/TS style) → real .ts files. */
import { existsSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";

const SRC = fileURLToPath(new URL("../../src/", import.meta.url));

export async function resolve(specifier, context, next) {
  let spec = specifier;
  if (spec.startsWith("@/")) spec = pathToFileURL(SRC + spec.slice(2)).href;
  const isRel = spec.startsWith("./") || spec.startsWith("../") || spec.startsWith("file:");
  if (isRel && !/\.(m?[jt]s|json)$/.test(spec)) {
    const base = new URL(spec, context.parentURL);
    for (const ext of [".ts", ".tsx", "/index.ts"]) {
      const cand = new URL(base.href + ext);
      if (existsSync(fileURLToPath(cand))) return next(cand.href, context);
    }
  }
  return next(spec, context);
}
