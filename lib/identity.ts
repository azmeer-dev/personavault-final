import prisma from "@/lib/prisma";
import { AuditActorType, AuditLogOutcome } from "@prisma/client";

interface LogAuditEntryData {
  actorType: AuditActorType;
  actorUserId?: string;
  actorAppId?: string;
  action: string;
  targetEntityType: string;
  targetEntityId: string;
  outcome: AuditLogOutcome;
  details?: object;
}

export async function logAuditEntry(data: LogAuditEntryData) {
  return prisma.auditLog.create({ data });
}

export async function getIdentityById(id: string) {
  return prisma.identity.findUnique({
    where: { id, visibility: "PUBLIC" },
    include: {
      linkedExternalAccounts: {
        select: {
          accountId: true,
          account: { select: { emailFromProvider: true, provider: true } },
        },
      },
    },
  });
}
