#!/usr/bin/env tsx

import { open, readFile, unlink } from "node:fs/promises";
import {
  GLOBAL_BENEFIT_CATEGORY_REPAIR_MAX_LIMIT,
  GlobalBenefitCategoryRepairError,
  runGlobalBenefitCategoryRepairOperator,
  type GlobalBenefitCategoryRepairDatabase,
  type GlobalBenefitCategoryRepairManifest,
  type GlobalBenefitCategoryRepairMode,
  type GlobalBenefitCategoryRepairReport,
} from "../src/lib/global-benefit-category-repair";

export interface ParsedGlobalBenefitCategoryRepairArguments {
  mode: GlobalBenefitCategoryRepairMode;
  limit?: number;
  after?: string;
  manifestPath?: string;
  manifestOutputPath?: string;
  targetVerified: boolean;
  recoveryPointVerified: boolean;
  amexOffVerified: boolean;
  confirmation?: string;
  expectedInventoryFingerprint?: string;
  expectedManifestFingerprint?: string;
  expectedPageFingerprint?: string;
}

const BOOLEAN_FLAGS = new Set([
  "--discover",
  "--dry-run",
  "--rollback-preview",
  "--apply",
  "--rollback",
  "--target-verified",
  "--recovery-point-verified",
  "--amex-off-verified",
]);

const VALUE_FLAGS = [
  "--limit",
  "--after",
  "--manifest",
  "--manifest-output",
  "--confirm",
  "--expect-inventory",
  "--expect-manifest",
  "--expect-page",
] as const;

type ValueFlag = typeof VALUE_FLAGS[number];

function parseMode(args: readonly string[]): GlobalBenefitCategoryRepairMode {
  const selected: GlobalBenefitCategoryRepairMode[] = [];
  if (args.includes("--discover")) selected.push("discover");
  if (args.includes("--dry-run")) selected.push("dry-run");
  if (args.includes("--rollback-preview")) selected.push("rollback-preview");
  if (args.includes("--apply")) selected.push("apply");
  if (args.includes("--rollback")) selected.push("rollback");
  if (selected.length > 1) {
    throw new GlobalBenefitCategoryRepairError("Choose exactly one category-repair mode.");
  }
  return selected[0] ?? "dry-run";
}

function valueOptions(args: readonly string[]): Map<ValueFlag, string> {
  const values = new Map<ValueFlag, string>();
  for (const argument of args) {
    const flag = VALUE_FLAGS.find((candidate) => argument.startsWith(`${candidate}=`));
    if (!flag) continue;
    if (values.has(flag)) {
      throw new GlobalBenefitCategoryRepairError("A category-repair option was provided more than once.");
    }
    const value = argument.slice(flag.length + 1);
    if (value.length === 0) {
      throw new GlobalBenefitCategoryRepairError("A category-repair option has an empty value.");
    }
    values.set(flag, value);
  }
  return values;
}

export function parseGlobalBenefitCategoryRepairArguments(
  args: readonly string[],
): ParsedGlobalBenefitCategoryRepairArguments {
  const unknown = args.find((argument) =>
    !BOOLEAN_FLAGS.has(argument)
    && !VALUE_FLAGS.some((flag) => argument.startsWith(`${flag}=`)));
  if (unknown) {
    throw new GlobalBenefitCategoryRepairError("An unsupported category-repair argument was provided.");
  }
  for (const flag of Array.from(BOOLEAN_FLAGS)) {
    if (args.filter((argument) => argument === flag).length > 1) {
      throw new GlobalBenefitCategoryRepairError("A category-repair flag was provided more than once.");
    }
  }
  const values = valueOptions(args);
  const mode = parseMode(args);
  const manifestPath = values.get("--manifest");
  const manifestOutputPath = values.get("--manifest-output");
  if (mode === "discover" && manifestPath !== undefined) {
    throw new GlobalBenefitCategoryRepairError("Discovery does not accept a private manifest input.");
  }
  if (mode !== "discover" && manifestOutputPath !== undefined) {
    throw new GlobalBenefitCategoryRepairError("Private manifest output is available only in discovery mode.");
  }
  const rawLimit = values.get("--limit");
  const limit = rawLimit === undefined ? undefined : Number(rawLimit);
  if (rawLimit !== undefined && (!/^\d+$/.test(rawLimit)
    || !Number.isSafeInteger(limit)
    || limit === undefined
    || limit < 1
    || limit > GLOBAL_BENEFIT_CATEGORY_REPAIR_MAX_LIMIT)) {
    throw new GlobalBenefitCategoryRepairError("The category-repair limit is invalid.");
  }
  return {
    mode,
    limit,
    after: values.get("--after"),
    manifestPath,
    manifestOutputPath,
    targetVerified: args.includes("--target-verified"),
    recoveryPointVerified: args.includes("--recovery-point-verified"),
    amexOffVerified: args.includes("--amex-off-verified"),
    confirmation: values.get("--confirm"),
    expectedInventoryFingerprint: values.get("--expect-inventory"),
    expectedManifestFingerprint: values.get("--expect-manifest"),
    expectedPageFingerprint: values.get("--expect-page"),
  };
}

async function readPrivateManifest(path: string | undefined): Promise<unknown> {
  if (path === undefined) return undefined;
  try {
    return JSON.parse(await readFile(path, "utf8")) as unknown;
  } catch {
    throw new GlobalBenefitCategoryRepairError("The private category-repair manifest could not be read.");
  }
}

export async function writeGlobalBenefitCategoryRepairManifest(
  path: string,
  manifest: GlobalBenefitCategoryRepairManifest,
): Promise<void> {
  let handle: Awaited<ReturnType<typeof open>> | null = null;
  let created = false;
  try {
    handle = await open(path, "wx", 0o600);
    created = true;
    await handle.writeFile(`${JSON.stringify(manifest, null, 2)}\n`, { encoding: "utf8" });
    await handle.sync();
    await handle.close();
    handle = null;
  } catch {
    if (handle) await handle.close().catch(() => undefined);
    if (created) await unlink(path).catch(() => undefined);
    throw new GlobalBenefitCategoryRepairError(
      "The private category-repair manifest could not be created safely.",
    );
  }
}

interface AdapterModule {
  createPrismaGlobalBenefitCategoryRepairDatabase?: (
    client: unknown,
  ) => GlobalBenefitCategoryRepairDatabase;
  PrismaGlobalBenefitCategoryRepairDatabase?: new (
    client: unknown,
  ) => GlobalBenefitCategoryRepairDatabase;
}

async function loadDatabase(): Promise<{
  database: GlobalBenefitCategoryRepairDatabase;
  disconnect: () => Promise<void>;
}> {
  // Task #26 owns this adapter. Keeping the import path indirect lets this safe
  // command shell and pure planner type-check before the schema-backed adapter
  // lands, while execution still fails closed until the exact adapter exists.
  const adapterPath = "../src/lib/prisma-global-benefit-category-repair";
  const prismaPath = "../src/lib/prisma";
  let adapterModule: AdapterModule;
  let prisma: { $disconnect(): Promise<void> };
  try {
    adapterModule = await import(adapterPath) as AdapterModule;
    const prismaModule = await import(prismaPath) as {
      prisma: { $disconnect(): Promise<void> };
    };
    prisma = prismaModule.prisma;
  } catch {
    throw new GlobalBenefitCategoryRepairError(
      "The category-repair database adapter is not available.",
    );
  }
  const database = adapterModule.createPrismaGlobalBenefitCategoryRepairDatabase
    ? adapterModule.createPrismaGlobalBenefitCategoryRepairDatabase(prisma)
    : adapterModule.PrismaGlobalBenefitCategoryRepairDatabase
      ? new adapterModule.PrismaGlobalBenefitCategoryRepairDatabase(prisma)
      : null;
  if (!database) {
    await prisma.$disconnect();
    throw new GlobalBenefitCategoryRepairError(
      "The category-repair database adapter is not available.",
    );
  }
  return { database, disconnect: () => prisma.$disconnect() };
}

export function aggregateGlobalBenefitCategoryRepairReport(
  report: GlobalBenefitCategoryRepairReport,
): Pick<GlobalBenefitCategoryRepairReport, "mode" | "limit" | "hasMore" | "counts" | "actions" | "stops"> {
  return {
    mode: report.mode,
    limit: report.limit,
    hasMore: report.hasMore,
    counts: report.counts,
    actions: report.actions,
    stops: report.stops,
  };
}

async function main(): Promise<void> {
  const parsed = parseGlobalBenefitCategoryRepairArguments(process.argv.slice(2));
  const manifest = await readPrivateManifest(parsed.manifestPath);
  const loaded = await loadDatabase();
  try {
    const report = await runGlobalBenefitCategoryRepairOperator({
      mode: parsed.mode,
      limit: parsed.limit,
      after: parsed.after,
      targetVerified: parsed.targetVerified,
      recoveryPointVerified: parsed.recoveryPointVerified,
      amexOffVerified: parsed.amexOffVerified,
      confirmation: parsed.confirmation,
      expectedInventoryFingerprint: parsed.expectedInventoryFingerprint,
      expectedManifestFingerprint: parsed.expectedManifestFingerprint,
      expectedPageFingerprint: parsed.expectedPageFingerprint,
      manifest,
      onDiscoveryManifest: parsed.manifestOutputPath
        ? (value) => writeGlobalBenefitCategoryRepairManifest(parsed.manifestOutputPath!, value)
        : undefined,
      database: loaded.database,
    });
    console.log(JSON.stringify(aggregateGlobalBenefitCategoryRepairReport(report), null, 2));
    if (report.hasMore) {
      console.warn("The bounded category repair has more definitions. Review this aggregate page before continuing.");
    }
  } finally {
    await loaded.disconnect();
  }
}

const isDirectExecution = process.argv[1]?.endsWith("repair-global-benefit-categories.ts") === true;
if (isDirectExecution) {
  void main().catch((error: unknown) => {
    console.error(error instanceof GlobalBenefitCategoryRepairError
      ? error.message
      : "The global-benefit category repair failed safely.");
    process.exitCode = 1;
  });
}
