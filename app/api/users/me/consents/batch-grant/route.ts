import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import prisma from '@/lib/prisma';
import { createAuditLog } from '@/lib/audit';
import { AuditActorType, AuditLogOutcome } from '@prisma/client';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';

const SECRET = process.env.NEXTAUTH_SECRET;

type BatchGrantRequest = {
  appId: string;
  identityIds: string[];
  scopes: string[];
};

export async function POST(req: NextRequest) {
  const token = await getToken({ req, secret: SECRET });

  if (!token?.sub) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userId = token.sub;

  let body: BatchGrantRequest;

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { appId, identityIds, scopes } = body;

  if (
    typeof appId !== 'string' ||
    !Array.isArray(identityIds) || identityIds.some(id => typeof id !== 'string') ||
    !Array.isArray(scopes) || scopes.some(scope => typeof scope !== 'string')
  ) {
    const errorDetails = { appId, identityIds, scopes };
    await createAuditLog({
      actorType: AuditActorType.USER,
      actorUserId: userId,
      action: "GRANT_CONSENT_BATCH_FAILURE",
      outcome: AuditLogOutcome.FAILURE,
      details: errorDetails
    });
    return NextResponse.json({ error: 'Invalid request parameters' }, { status: 400 });
  }

  const ownedIdentities = await prisma.identity.findMany({
    where: {
      id: { in: identityIds },
      userId
    },
    select: { id: true }
  });

  const ownedIds = ownedIdentities.map(i => i.id);
  const invalidIds = identityIds.filter(id => !ownedIds.includes(id));

  if (invalidIds.length > 0) {
    await createAuditLog({
      actorType: AuditActorType.USER,
      actorUserId: userId,
      action: "GRANT_CONSENT_BATCH_FAILURE",
      outcome: AuditLogOutcome.FAILURE,
      details: { invalidIds, ownedIds, requestedIds: identityIds }
    });
    return NextResponse.json({ error: 'Forbidden: invalid identity IDs' }, { status: 403 });
  }

  const now = new Date();

  try {
    await prisma.$transaction(
      identityIds.map(identityId =>
        prisma.consent.upsert({
          where: {
            id: `${userId}_${appId}_${identityId}`, // Replace with a real unique field or use findFirst + conditional logic
          },
          update: {
            grantedScopes: scopes,
            grantedAt: now,
            revokedAt: null
          },
          create: {
            userId,
            appId,
            identityId,
            grantedScopes: scopes,
            grantedAt: now,
            revokedAt: null
          }
        })
      )
    );

    await createAuditLog({
      actorType: AuditActorType.USER,
      actorUserId: userId,
      action: "GRANT_CONSENT_BATCH",
      outcome: AuditLogOutcome.SUCCESS,
      targetEntityType: "App",
      targetEntityId: appId,
      details: {
        appId,
        identityIds,
        scopes,
        grantedAt: now
      }
    });

    return NextResponse.json({ message: 'Consents granted successfully' }, { status: 200 });

  } catch (error: unknown) {
    let message = 'Internal Server Error';
    const isPrismaError = error instanceof PrismaClientKnownRequestError;

    if (isPrismaError && error.code === 'P2003') {
      message = 'Invalid App ID';
    }

    await createAuditLog({
      actorType: AuditActorType.USER,
      actorUserId: userId,
      action: "GRANT_CONSENT_BATCH_DB_FAILURE",
      outcome: AuditLogOutcome.FAILURE,
      details: {
        message: message,
        code: isPrismaError ? error.code : undefined
      }
    });

    return NextResponse.json({ error: message }, { status: isPrismaError ? 400 : 500 });
  }
}
