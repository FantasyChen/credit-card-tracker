import { resolveAmexSyncHandoffTarget } from "@/lib/amex-benefit-reader/handoff-target";

const target = resolveAmexSyncHandoffTarget("production");

export function isExactHandoffUrl(locationValue: Pick<Location, "origin" | "pathname" | "search">): boolean {
  if (locationValue.origin !== target.origin || locationValue.pathname !== target.path) return false;
  const params = new URLSearchParams(locationValue.search);
  return Array.from(params.keys()).length === 1 && /^[a-f0-9]{32}$/.test(params.get("transfer") ?? "");
}
