import { getPrismaClient } from './prisma-client-provider';

// Existing application imports retain the same process-wide singleton behavior.
// Injection-aware operator modules import getPrismaClient directly so importing
// them cannot construct an environment-selected client before target validation.
export const prisma = getPrismaClient();
