#!/usr/bin/env tsx

import dotenv from "dotenv";
import { createIndependentUserCloneClients } from "../src/lib/amex-sync/prisma-single-user-clone";
import {
  runSingleUserCloneOperator,
  UserCloneOperatorError,
} from "../src/lib/amex-sync/single-user-clone";

dotenv.config();

interface CliOptions {
  email: string;
  mode: "dry-run" | "apply";
  targetVerified: boolean;
  applyConfirmation?: string;
  replacementConfirmation?: string;
}

function optionValue(args: string[], name: string): string | undefined {
  const prefix = `${name}=`;
  return args.find((argument) => argument.startsWith(prefix))?.slice(prefix.length);
}

function parseOptions(args: string[]): CliOptions {
  const allowedFlags = new Set(["--apply", "--dry-run", "--target-verified"]);
  const allowedValuePrefixes = ["--email=", "--confirm=", "--replace-confirm="];
  const unknown = args.find((argument) =>
    !allowedFlags.has(argument)
    && !allowedValuePrefixes.some((prefix) => argument.startsWith(prefix)));
  if (unknown) throw new UserCloneOperatorError("The clone command received an unsupported argument.");
  if (args.includes("--apply") && args.includes("--dry-run")) {
    throw new UserCloneOperatorError("Choose either dry-run or apply mode, not both.");
  }
  const email = optionValue(args, "--email");
  if (!email) throw new UserCloneOperatorError("The clone command requires --email.");
  return {
    email,
    mode: args.includes("--apply") ? "apply" : "dry-run",
    targetVerified: args.includes("--target-verified"),
    applyConfirmation: optionValue(args, "--confirm"),
    replacementConfirmation: optionValue(args, "--replace-confirm"),
  };
}

async function main(): Promise<void> {
  const options = parseOptions(process.argv.slice(2));
  const sourceDatabaseUrl = process.env.DATABASE_URL;
  const destinationDatabaseUrl = process.env.DATABASE_URL_DEV;
  if (!sourceDatabaseUrl || !destinationDatabaseUrl) {
    throw new UserCloneOperatorError("Both reviewed source and development database targets must be configured.");
  }
  const clients = createIndependentUserCloneClients({ sourceDatabaseUrl, destinationDatabaseUrl });
  try {
    const report = await runSingleUserCloneOperator({
      ...options,
      source: clients.source,
      destination: clients.destination,
    });
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  } finally {
    await Promise.allSettled([
      clients.sourceClient.$disconnect(),
      clients.destinationClient.$disconnect(),
    ]);
  }
}

main().catch((error: unknown) => {
  if (error instanceof UserCloneOperatorError) {
    process.stderr.write(`${error.message}\n`);
  } else {
    process.stderr.write("The single-user clone operator failed without a safe diagnostic.\n");
  }
  process.exitCode = 1;
});
