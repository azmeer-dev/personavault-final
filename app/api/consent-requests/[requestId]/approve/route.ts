// app/api/consent-requests/[requestId]/approve/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import prisma from '@/lib/prisma';
import {
  ConsentRequestStatus,
  AuditActorType,
  AuditLogOutcome,
} from '@prisma/client';
import { createAuditLog } from '@/lib/audit';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { sendNotification } from '@/lib/notifications';

const SECRET = process.env.NEXTAUTH_SECRET;

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ requestId: string }> }
): Promise<NextResponse> {
  // 1) Await params
  const { requestId } = await context.params;

  // 2) Authenticate
  const token = await getToken({ req, secret: SECRET });
  if (!token?.sub) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const userId = token.sub;

  // 3) Load the consent request
  const consentRequest = await prisma.consentRequest.findUnique({
    where: { id: requestId },
  });
  if (!consentRequest) {
    return NextResponse.json({ error: 'ConsentRequest not found' }, { status: 404 });
  }
  if (consentRequest.targetUserId !== userId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  if (consentRequest.status !== ConsentRequestStatus.PENDING) {
    return NextResponse.json(
      { error: `Already ${consentRequest.status.toLowerCase()}` },
      { status: 400 }
    );
  }

  const now = new Date();

  try {
    let upsertedConsent: unknown;

    if (consentRequest.appId) {
      // ── App→User flow ──
      upsertedConsent = await prisma.consent.upsert({
        where: {
          // use the name of your @@unique([userId, appId, identityId], name: "UserAppIdentityConsent")
          UserAppIdentityConsent: {
            userId,
            appId: consentRequest.appId,
            identityId: consentRequest.identityId!,
          },
        },
        update: {
          grantedScopes: consentRequest.requestedScopes,
          grantedAt: now,
          revokedAt: null,
          expiresAt: null,
        },
        create: {
          userId,
          appId: consentRequest.appId,
          identityId: consentRequest.identityId!,
          grantedScopes: consentRequest.requestedScopes,
          grantedAt: now,
        },
      });
    } else {
      // ── User→User flow ──
      upsertedConsent = await prisma.consent.upsert({
        where: {
          // and this matches @@unique([userId, requestingUserId, identityId], name: "UserUserIdentityConsent")
          UserUserIdentityConsent: {
            userId,
            requestingUserId: consentRequest.requestingUserId!,
            identityId: consentRequest.identityId!,
          },
        },
        update: {
          grantedScopes: consentRequest.requestedScopes,
          grantedAt: now,
          revokedAt: null,
          expiresAt: null,
        },
        create: {
          userId,
          requestingUserId: consentRequest.requestingUserId!,
          identityId: consentRequest.identityId!,
          grantedScopes: consentRequest.requestedScopes,
          grantedAt: now,
        },
      });
    }

    // 4) Mark the request as approved
    await prisma.consentRequest.update({
      where: { id: requestId },
      data: { status: ConsentRequestStatus.APPROVED, processedAt: now },
    });

    // 5) Audit log
    await createAuditLog({
      actorType: AuditActorType.USER,
      actorUserId: userId,
      action: 'APPROVE_CONSENT_REQUEST',
      targetEntityType: 'ConsentRequest',
      targetEntityId: requestId,
      outcome: AuditLogOutcome.SUCCESS,
      details: {
        via: consentRequest.appId ? 'app' : 'user',
        consumer: consentRequest.appId ?? consentRequest.requestingUserId,
      },
    });

    // Send notification to the requesting user/app owner
    if (consentRequest.requestingUserId) {
      await sendNotification(
        consentRequest.requestingUserId,
        'CONSENT_REQUEST_APPROVED',
        {
          consentRequestId: requestId,
          identityId: consentRequest.identityId,
        }
      );
    }

    return NextResponse.json(upsertedConsent);
  } catch (err) {
    console.error('Error approving consent request:', err);
    if (err instanceof PrismaClientKnownRequestError) {
      const status = err.code === 'P2003' ? 400 : 500;
      return NextResponse.json({ error: err.message }, { status });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
