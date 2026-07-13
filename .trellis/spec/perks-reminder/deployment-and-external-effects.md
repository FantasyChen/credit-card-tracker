# Deployment and External Effects

## Deployment ownership

- GitHub `main` deploys automatically through Vercel. Agents must not perform a manual production deployment unless the user explicitly requests it.
- The build command includes `prisma migrate deploy`; therefore local or CI build execution can have database effects. See [Database and Data Safety](database-and-data-safety.md).
- The production domains are served by the Vercel `coupon-cycle` project even though a local checkout may be linked to a different project. Never infer the production target from ignored `.vercel/project.json` alone.
- Provider environment values are managed in Vercel or other provider dashboards. Do not write secret values, project-local copies, or command output containing them to tracked files.

## Cron and notification safety

- `/api/cron/check-benefits` and `/api/cron/send-notifications` consume both Vercel Hobby cron slots and must remain within the 10-second function ceiling.
- Cron authorization uses `Authorization: Bearer <CRON_SECRET>`. Log authorization presence and aggregate counts, never the secret or recipient data.
- Never trigger notification/email endpoints against production data during testing. A non-production `mockDate` changes time selection but does not prevent email delivery.
- Do not send production announcement or notification batches without explicit authorization, dry-run evidence, recipient counts, a cap, and resumable/auditable state.
- Resend quota is recipient-based. One message with many recipients can consume one unit per recipient; do not infer safety from message count.

## Operational review

Before any Vercel, DNS, cron, email, or production-domain action:

1. identify the exact project, domain, database, and side effect;
2. preview without exposing secrets;
3. obtain authorization for the production action;
4. define rollback or stop conditions;
5. run the narrowest post-change check.

`docs/vercel-domains-and-deploy.md` and `docs/supabase-fallback.md` retain detailed operator procedures. Specs define the safety contract; do not duplicate or casually rewrite provider commands in unrelated changes.
