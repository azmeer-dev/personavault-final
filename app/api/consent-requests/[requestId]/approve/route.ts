import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import prisma from '@/lib/prisma';
import { ConsentRequestStatus, AuditActorType, AuditLogOutcome, ConsentRequest } from '@prisma/client';
import { createAuditLog } from '@/lib/audit';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';

const SECRET = process.env.NEXTAUTH_SECRET;

export async function POST(
  req: NextRequest,
  { params }: { params: { requestId: string } }
): Promise<NextResponse> {
  const { requestId } = params;
  const token = await getToken({ req, secret: SECRET });

  if (!token || !token.sub) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userId: string = token.sub;

  if (!requestId) {
    await createAuditLog({
      actorType: AuditActorType.USER,
      actorUserId: userId,
      action: 'APPROVE_CONSENT_REQUEST_FAILURE',
      outcome: AuditLogOutcome.FAILURE,
      details: { error: 'Bad Request: requestId is required' },
    });
    return NextResponse.json({ error: 'Bad Request: requestId is required' }, { status: 400 });
  }

  let consentRequest: (ConsentRequest & { app: { id: string; name: string } }) | null = null;

  try {
    consentRequest = await prisma.consentRequest.findUnique({
      where: { id: requestId },
      include: {
        app: { select: { id: true, name: true } },
      },
    });

    if (!consentRequest) {
      await createAuditLog({
        actorType: AuditActorType.USER,
        actorUserId: userId,
        action: 'APPROVE_CONSENT_REQUEST_FAILURE',
        targetEntityType: 'ConsentRequest',
        targetEntityId: requestId,
        outcome: AuditLogOutcome.FAILURE,
        details: { error: 'ConsentRequest not found' },
      });
      return NextResponse.json({ error: 'ConsentRequest not found' }, { status: 404 });
    }

    if (consentRequest.targetUserId !== userId) {
      await createAuditLog({
        actorType: AuditActorType.USER,
        actorUserId: userId,
        action: 'APPROVE_CONSENT_REQUEST_FAILURE',
        targetEntityType: 'ConsentRequest',
        targetEntityId: requestId,
        outcome: AuditLogOutcome.FAILURE,
        details: {
          error: 'Forbidden: You are not the target user for this request',
          appId: consentRequest.appId,
          actualTargetUserId: consentRequest.targetUserId,
        },
      });
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (consentRequest.status !== ConsentRequestStatus.PENDING) {
      const errorMsg = `Bad Request: ConsentRequest is already ${consentRequest.status.toLowerCase()}`;
      await createAuditLog({
        actorType: AuditActorType.USER,
        actorUserId: userId,
        action: 'APPROVE_CONSENT_REQUEST_FAILURE',
        targetEntityType: 'ConsentRequest',
        targetEntityId: requestId,
        outcome: AuditLogOutcome.FAILURE,
        details: {
          error: errorMsg,
          appId: consentRequest.appId,
          currentStatus: consentRequest.status,
        },
      });
      return NextResponse.json({ error: errorMsg }, { status: 400 });
    }

    const now = new Date();

    const result = await prisma.$transaction(async (tx) => {
      const updatedRequest = await tx.consentRequest.update({
        where: { id: requestId },
        data: {
          status: ConsentRequestStatus.APPROVED,
          processedAt: now,
        },
      });

      const existingConsent = await tx.consent.findFirst({
        where: {
          userId: userId,
          appId: consentRequest!.appId,
          identityId: consentRequest!.identityId,
        },
      });

      const createdOrUpdatedConsent = existingConsent
        ? await tx.consent.update({
            where: { id: existingConsent.id },
            data: {
              grantedScopes: consentRequest!.requestedScopes,
              grantedAt: now,
              revokedAt: null,
              expiresAt: null,
            },
          })
        : await tx.consent.create({
            data: {
              userId: userId,
              appId: consentRequest!.appId,
              identityId: consentRequest!.identityId,
              grantedScopes: consentRequest!.requestedScopes,
              grantedAt: now,
              revokedAt: null,
              expiresAt: null,
            },
          });

      return { updatedRequest, createdOrUpdatedConsent };
    });

    await createAuditLog({
      actorType: AuditActorType.USER,
      actorUserId: userId,
      action: 'APPROVE_CONSENT_REQUEST',
      targetEntityType: 'ConsentRequest',
      targetEntityId: requestId,
      outcome: AuditLogOutcome.SUCCESS,
      details: {
        appId: consentRequest.appId,
        identityId: consentRequest.identityId,
        scopes: consentRequest.requestedScopes,
        createdConsentId: result.createdOrUpdatedConsent.id,
        appName: consentRequest.app.name,
      },
    });

    return NextResponse.json(result.createdOrUpdatedConsent);
  } catch (err) {
    const error = err as Error | PrismaClientKnownRequestError;
    console.error(`Error approving consent request ${requestId} for user ${userId}:`, error);

    const isPrisma = error instanceof PrismaClientKnownRequestError;
    const code = isPrisma ? error.code : undefined;
    const details = {
      error: error.message,
      requestId,
      appId: consentRequest?.appId,
      identityId: consentRequest?.identityId,
      code,
    };

    let statusCode = 500;
    let errorMessage = 'Internal Server Error';

    if (isPrisma && error.code === 'P2003') {
      statusCode = 400;
      errorMessage = 'Bad Request: Invalid data provided for consent (e.g., App ID does not exist).';
    }

    await createAuditLog({
      actorType: AuditActorType.USER,
      actorUserId: userId,
      action: 'APPROVE_CONSENT_REQUEST_FAILURE',
      targetEntityType: 'ConsentRequest',
      targetEntityId: requestId,
      outcome: AuditLogOutcome.FAILURE,
      details,
    });

    return NextResponse.json({ error: errorMessage }, { status: statusCode });
  }
}
