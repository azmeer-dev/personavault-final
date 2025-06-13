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

// lib/identity.ts
export async function getIdentityById(id: string, viewerId?: string | null) {
  const identity = await prisma.identity.findUnique({
    where: { id },
    include: {
      linkedExternalAccounts: {
        include: {
          account: true,
        },
      },
    },
  });

  if (!identity) return null;

  if (identity.visibility === "PUBLIC") return identity;

  if (!viewerId) return null;

  const accessGranted = await prisma.consent.findFirst({
    where: {
      requestingUserId: viewerId,
      revokedAt: null,
      OR: [
        { identityId: id },
        { identityId: null, userId: identity.userId },
      ],
    },
  });

  return accessGranted ? identity : null;
}

