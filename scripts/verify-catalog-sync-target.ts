#!/usr/bin/env tsx

import { createHash } from "node:crypto";
import { PrismaClient } from "../src/generated/prisma";

interface IdentityRow {
  database_name: string;
  schema_name: string;
  branch_id: string | null;
}

function targetFingerprint(databaseUrl: string, row: IdentityRow): string {
  let parsed: URL;
  try {
    parsed = new URL(databaseUrl);
  } catch {
    throw new Error("Catalog sync database target is invalid.");
  }
  if (parsed.protocol !== "postgres:" && parsed.protocol !== "postgresql:") {
    throw new Error("Catalog sync database target must use PostgreSQL.");
  }
  const host = parsed.hostname.toLowerCase();
  if (!host || !row.database_name || !row.schema_name || !row.branch_id) {
    throw new Error("Catalog sync database target identity is incomplete.");
  }
  const canonicalHost = host.replace("-pooler.", ".");
  return createHash("sha256")
    .update([canonicalHost, row.database_name, row.schema_name, row.branch_id].join("|"))
    .digest("hex")
    .slice(0, 16);
}

async function main(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  const expectedFingerprint = process.env.CATALOG_SYNC_EXPECTED_FINGERPRINT;
  if (!databaseUrl || !expectedFingerprint) {
    throw new Error("Catalog sync target verification is not configured.");
  }
  if (!/^[a-f0-9]{16}$/.test(expectedFingerprint)) {
    throw new Error("Catalog sync target fingerprint is invalid.");
  }

  const client = new PrismaClient({ datasourceUrl: databaseUrl });
  try {
    const rows = await client.$queryRawUnsafe<IdentityRow[]>(
      "SELECT current_database() AS database_name, current_schema() AS schema_name, current_setting('neon.branch_id', true) AS branch_id",
    );
    const row = rows[0];
    if (!row || targetFingerprint(databaseUrl, row) !== expectedFingerprint) {
      throw new Error("Catalog sync database target verification failed.");
    }
    console.log("Catalog sync database target verified.");
  } finally {
    await client.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Catalog sync target verification failed.");
  process.exitCode = 1;
});
