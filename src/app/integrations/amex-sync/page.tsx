import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { resolveAmexSyncConfiguration } from "@/lib/amex-sync/mode";
import { AmexSyncHandoffClient } from "./AmexSyncHandoffClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  title: "Review Amex sync",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

interface PageProps {
  searchParams: Promise<{ transfer?: string | string[] }>;
}

export default async function AmexSyncPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const transfer = typeof params.transfer === "string" && /^[a-f0-9]{32}$/.test(params.transfer)
    ? params.transfer
    : null;
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    const callback = transfer
      ? `/integrations/amex-sync?transfer=${transfer}`
      : "/integrations/amex-sync";
    redirect(`/api/auth/signin?callbackUrl=${encodeURIComponent(callback)}`);
  }
  const mode = resolveAmexSyncConfiguration().mode;
  return <AmexSyncHandoffClient transferId={transfer} initialMode={mode} />;
}
