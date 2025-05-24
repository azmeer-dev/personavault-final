import prisma from '@/lib/prisma';
import { AuditActorType, AuditLogOutcome, Prisma } from '@prisma/client';

export interface CreateAuditLogArgs {
  actorType: AuditActorType;
  actorUserId?: string | null;
  actorAppId?: string | null;
  action: string;
  targetEntityType?: string | null;
  targetEntityId?: string | null;
  details?: Prisma.InputJsonValue | null;
  outcome?: AuditLogOutcome;
}

export async function createAuditLog(data: CreateAuditLogArgs): Promise<void> {
  try {
    const {
      actorType,
      actorUserId,
      actorAppId,
      action,
      targetEntityType,
      targetEntityId,
      details,
      outcome,
    } = data;

    await prisma.auditLog.create({
      data: {
        actorType,
        actorUserId: actorUserId ?? undefined,
        actorAppId: actorAppId ?? undefined,
        action,
        targetEntityType: targetEntityType ?? undefined,
        targetEntityId: targetEntityId ?? undefined,
        details: details ?? undefined,
        outcome,
      },
    });

    console.log('Audit log created:', action, outcome);
  } catch (error) {
    console.error('Failed to create audit log:', error, 'Log data:', data);
  }
}
