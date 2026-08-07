#!/usr/bin/env tsx

import { open, readFile, unlink } from "node:fs/promises";
import {
  captureGlobalBenefitCategoryRepairParityBaseline,
  captureGlobalBenefitCategoryRepairParityReport,
  aggregateGlobalBenefitCategoryRepairParityReport,
  GlobalBenefitCategoryRepairParityError,
  GlobalBenefitCategoryRepairParityVerificationError,
  parseGlobalBenefitCategoryRepairParityBaseline,
  parityScopeFromBaseline,
  type CategoryRepairParityManifestScope,
  validateGlobalBenefitCategoryRepairParityManifests,
  validateGlobalBenefitCategoryRepairParityScope,
  verifyGlobalBenefitCategoryRepairParity,
  type CategoryRepairParityDatabase,
  type GlobalBenefitCategoryRepairParityMode,
} from "../src/lib/global-benefit-category-repair-parity";

interface ParsedArguments {
  mode: GlobalBenefitCategoryRepairParityMode;
  targetVerified: boolean;
  manifestPaths: string[];
  scopeManifestPath?: string;
  baselinePath?: string;
  baselineOutputPath?: string;
}

const BOOLEAN_FLAGS = new Set(["--capture", "--verify", "--target-verified"]);

function parseArguments(args: readonly string[]): ParsedArguments {
  const modes = args.filter((arg) => arg === "--capture" || arg === "--verify");
  if (modes.length > 1 || (modes[0] !== "--capture" && modes[0] !== "--verify")) {
    throw new GlobalBenefitCategoryRepairParityError("Choose exactly one parity mode.");
  }
  if (args.some((arg) => !BOOLEAN_FLAGS.has(arg)
    && !arg.startsWith("--manifest=")
    && !arg.startsWith("--scope-manifest=")
    && !arg.startsWith("--baseline=")
    && !arg.startsWith("--baseline-output="))) {
    throw new GlobalBenefitCategoryRepairParityError("An unsupported parity option was provided.");
  }
  if (args.filter((arg) => arg === "--target-verified").length > 1) {
    throw new GlobalBenefitCategoryRepairParityError("A parity flag was provided more than once.");
  }
  const manifestPaths = args
    .filter((arg) => arg.startsWith("--manifest="))
    .map((arg) => arg.slice("--manifest=".length));
  if (manifestPaths.length === 0 || manifestPaths.some((path) => path.length === 0)) {
    throw new GlobalBenefitCategoryRepairParityError("Parity requires private manifest inputs.");
  }
  if (new Set(manifestPaths).size !== manifestPaths.length) {
    throw new GlobalBenefitCategoryRepairParityError("A parity manifest path was provided more than once.");
  }
  const scopePaths = args
    .filter((arg) => arg.startsWith("--scope-manifest="))
    .map((arg) => arg.slice("--scope-manifest=".length));
  if (scopePaths.length > 1) {
    throw new GlobalBenefitCategoryRepairParityError("A parity scope selector was provided more than once.");
  }
  const scopeManifestPath = scopePaths[0];
  if (scopeManifestPath !== undefined && scopeManifestPath.length === 0) {
    throw new GlobalBenefitCategoryRepairParityError("A parity scope selector has an empty value.");
  }
  if (scopeManifestPath !== undefined && !manifestPaths.includes(scopeManifestPath)) {
    throw new GlobalBenefitCategoryRepairParityError("The parity scope selector must match one provided manifest path.");
  }
  const baselines = args.filter((arg) => arg.startsWith("--baseline="));
  const outputs = args.filter((arg) => arg.startsWith("--baseline-output="));
  if (baselines.length > 1 || outputs.length > 1) {
    throw new GlobalBenefitCategoryRepairParityError("A parity path option was provided more than once.");
  }
  const mode: GlobalBenefitCategoryRepairParityMode = modes[0] === "--capture" ? "capture" : "verify";
  const baselinePath = baselines[0]?.slice("--baseline=".length);
  const baselineOutputPath = outputs[0]?.slice("--baseline-output=".length);
  if (mode === "capture" && (baselinePath !== undefined || !baselineOutputPath)) {
    throw new GlobalBenefitCategoryRepairParityError("Capture requires only a private baseline output path.");
  }
  if (mode === "verify" && (baselineOutputPath !== undefined || !baselinePath)) {
    throw new GlobalBenefitCategoryRepairParityError("Verify requires only a private baseline input path.");
  }
  if ([baselinePath, baselineOutputPath].some((path) => path !== undefined && path.length === 0)) {
    throw new GlobalBenefitCategoryRepairParityError("A parity path option has an empty value.");
  }
  return {
    mode,
    targetVerified: args.includes("--target-verified"),
    manifestPaths,
    scopeManifestPath,
    baselinePath,
    baselineOutputPath,
  };
}

async function readJson(path: string): Promise<unknown> {
  try {
    return JSON.parse(await readFile(path, "utf8")) as unknown;
  } catch {
    throw new GlobalBenefitCategoryRepairParityError("The private parity authority could not be read.");
  }
}

async function readManifests(paths: readonly string[]): Promise<unknown[]> {
  return Promise.all(paths.map((path) => readJson(path)));
}

async function writePrivateBaseline(path: string, value: unknown): Promise<void> {
  let handle: Awaited<ReturnType<typeof open>> | null = null;
  let created = false;
  try {
    handle = await open(path, "wx", 0o600);
    created = true;
    await handle.writeFile(`${JSON.stringify(value, null, 2)}\n`, { encoding: "utf8" });
    await handle.sync();
    await handle.close();
    handle = null;
  } catch {
    if (handle) await handle.close().catch(() => undefined);
    if (created) await unlink(path).catch(() => undefined);
    throw new GlobalBenefitCategoryRepairParityError("The private parity baseline could not be created safely.");
  }
}

interface AdapterModule {
  createPrismaGlobalBenefitCategoryRepairDatabase?: (client: unknown) => unknown;
  PrismaGlobalBenefitCategoryRepairDatabase?: new (client: unknown) => unknown;
}

async function loadDatabase(): Promise<{
  database: CategoryRepairParityDatabase;
  disconnect: () => Promise<void>;
}> {
  try {
    const adapterModule = await import("../src/lib/prisma-global-benefit-category-repair") as AdapterModule;
    const prismaModule = await import("../src/lib/prisma") as {
      prisma: { $disconnect(): Promise<void> };
    };
    const adapter = adapterModule.createPrismaGlobalBenefitCategoryRepairDatabase
      ? adapterModule.createPrismaGlobalBenefitCategoryRepairDatabase(prismaModule.prisma)
      : adapterModule.PrismaGlobalBenefitCategoryRepairDatabase
        ? new adapterModule.PrismaGlobalBenefitCategoryRepairDatabase(prismaModule.prisma)
        : null;
    if (!adapter || typeof (adapter as Partial<CategoryRepairParityDatabase>).readParitySnapshot !== "function") {
      await prismaModule.prisma.$disconnect();
      throw new GlobalBenefitCategoryRepairParityError("The parity database adapter is not available.");
    }
    return {
      database: adapter as CategoryRepairParityDatabase,
      disconnect: () => prismaModule.prisma.$disconnect(),
    };
  } catch (error) {
    if (error instanceof GlobalBenefitCategoryRepairParityError) throw error;
    throw new GlobalBenefitCategoryRepairParityError("The parity database adapter is not available.");
  }
}

async function main(): Promise<void> {
  const parsed = parseArguments(process.argv.slice(2));
  if (parsed.targetVerified !== true) {
    throw new GlobalBenefitCategoryRepairParityError("Category-repair parity requires target verification.");
  }
  const manifestValues = await readManifests(parsed.manifestPaths);
  const manifestBundle = validateGlobalBenefitCategoryRepairParityManifests(manifestValues);
  const scope: CategoryRepairParityManifestScope | null = parsed.scopeManifestPath === undefined
    ? null
    : (() => {
      const pageIndex = parsed.manifestPaths.indexOf(parsed.scopeManifestPath!);
      const page = manifestBundle.pages[pageIndex];
      if (pageIndex < 0 || !page) {
        throw new GlobalBenefitCategoryRepairParityError(
          "The parity scope selector must match one provided manifest path.",
        );
      }
      return {
        pageIndex,
        pageFingerprint: page.pageFingerprint,
        manifestFingerprint: page.manifestFingerprint,
      };
    })();
  const validatedScope = validateGlobalBenefitCategoryRepairParityScope(manifestBundle, scope);
  const loadedBaseline = parsed.mode === "verify"
    ? parseGlobalBenefitCategoryRepairParityBaseline(await readJson(parsed.baselinePath!))
    : null;
  if (loadedBaseline
    && loadedBaseline.scope !== null
    && JSON.stringify(loadedBaseline.scope) !== JSON.stringify(validatedScope)) {
    throw new GlobalBenefitCategoryRepairParityError("The private parity baseline scope does not match the selected manifest page.");
  }
  const loaded = await loadDatabase();
  try {
    const state = await loaded.database.readParitySnapshot({
      targetVerified: parsed.targetVerified,
      manifests: manifestBundle.pages,
      scope: loadedBaseline ? parityScopeFromBaseline(loadedBaseline) : null,
      manifestScope: validatedScope,
    });
    if (parsed.mode === "capture") {
      const baseline = captureGlobalBenefitCategoryRepairParityBaseline({
        targetVerified: parsed.targetVerified,
        manifests: manifestBundle.pages,
        scope: validatedScope,
        snapshot: state.snapshot,
        aggregate: state.aggregate,
      });
      await writePrivateBaseline(parsed.baselineOutputPath!, baseline);
      console.log(JSON.stringify(aggregateGlobalBenefitCategoryRepairParityReport(
        captureGlobalBenefitCategoryRepairParityReport(baseline),
      ), null, 2));
      return;
    }
    const report = verifyGlobalBenefitCategoryRepairParity({
      targetVerified: parsed.targetVerified,
      baseline: loadedBaseline,
      manifests: manifestBundle.pages,
      scope: validatedScope,
      snapshot: state.snapshot,
      aggregate: state.aggregate,
    });
    console.log(JSON.stringify(aggregateGlobalBenefitCategoryRepairParityReport(report), null, 2));
  } finally {
    await loaded.disconnect();
  }
}

export function handleGlobalBenefitCategoryRepairParityFailure(error: unknown): void {
  if (error instanceof GlobalBenefitCategoryRepairParityVerificationError) {
    console.log(JSON.stringify(error.report, null, 2));
  } else {
    console.error(error instanceof GlobalBenefitCategoryRepairParityError
      ? error.message
      : "The category-repair parity check failed safely.");
  }
  process.exitCode = 1;
}

const isDirectExecution = process.argv[1]?.endsWith("verify-global-benefit-category-repair-parity.ts") === true;
if (isDirectExecution) {
  void main().catch(handleGlobalBenefitCategoryRepairParityFailure);
}

export { parseArguments as parseGlobalBenefitCategoryRepairParityArguments };
export { writePrivateBaseline as writeGlobalBenefitCategoryRepairParityBaseline };
