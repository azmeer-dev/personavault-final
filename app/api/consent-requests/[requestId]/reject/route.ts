import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import prisma from '@/lib/prisma';
import { ConsentRequestStatus } from '@prisma/client';
import { createAuditLog } from '@/lib/audit'; // Added
import { AuditActorType, AuditLogOutcome } from '@prisma/client'; // Added
import { sendNotification } from '@/lib/notifications';


const SECRET = process.env.NEXTAUTH_SECRET;

export async function POST(
  req: NextRequest,
  { params }: { params: { requestId: string } }
): Promise<NextResponse> {
  const token = await getToken({ req, secret: SECRET });
  if (!token || !token.sub) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = token.sub;
  const { requestId } = params;

  if (!requestId) {
    const errorMsg = "Bad Request: requestId is required";
    await createAuditLog({
      actorType: AuditActorType.USER,
      actorUserId: userId,
      action: "REJECT_CONSENT_REQUEST_FAILURE",
      outcome: AuditLogOutcome.FAILURE,
      details: { error: errorMsg },
    });
    return NextResponse.json({ error: errorMsg }, { status: 400 });
  }

  try {
    const consentRequest = await prisma.consentRequest.findUnique({
      where: { id: requestId },
      include: { app: { select: { name: true } } },
    });

    if (!consentRequest) {
      const errorMsg = "ConsentRequest not found";
      await createAuditLog({
        actorType: AuditActorType.USER,
        actorUserId: userId,
        action: "REJECT_CONSENT_REQUEST_FAILURE",
        targetEntityType: "ConsentRequest",
        targetEntityId: requestId,
        outcome: AuditLogOutcome.FAILURE,
        details: { error: errorMsg },
      });
      return NextResponse.json({ error: errorMsg }, { status: 404 });
    }

    if (consentRequest.targetUserId !== userId) {
      const errorMsg = "Forbidden: You are not the target user for this request";
      await createAuditLog({
        actorType: AuditActorType.USER,
        actorUserId: userId,
        action: "REJECT_CONSENT_REQUEST_FAILURE",
        targetEntityType: "ConsentRequest",
        targetEntityId: requestId,
        outcome: AuditLogOutcome.FAILURE,
        details: {
          error: errorMsg,
          appId: consentRequest.appId,
          actualTargetUserId: consentRequest.targetUserId,
        },
      });
      return NextResponse.json({ error: errorMsg }, { status: 403 });
    }

    if (consentRequest.status !== ConsentRequestStatus.PENDING) {
      const errorMsg = `Bad Request: ConsentRequest is already ${consentRequest.status.toLowerCase()}`;
      await createAuditLog({
        actorType: AuditActorType.USER,
        actorUserId: userId,
        action: "REJECT_CONSENT_REQUEST_FAILURE",
        targetEntityType: "ConsentRequest",
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

    const updatedRequest = await prisma.consentRequest.update({
      where: { id: requestId },
      data: {
        status: ConsentRequestStatus.REJECTED,
        processedAt: new Date(),
      },
    });

    await createAuditLog({
      actorType: AuditActorType.USER,
      actorUserId: userId,
      action: "REJECT_CONSENT_REQUEST",
      targetEntityType: "ConsentRequest",
      targetEntityId: requestId,
      outcome: AuditLogOutcome.SUCCESS,
      details: {
        appId: updatedRequest.appId,
        identityId: updatedRequest.identityId,
        scopes: updatedRequest.requestedScopes,
        appName: consentRequest.app?.name,
      },
    });

    // Send notification to the requesting user/app owner
    if (updatedRequest.requestingUserId) {
      await sendNotification(
        updatedRequest.requestingUserId,
        'CONSENT_REQUEST_REJECTED',
        {
          consentRequestId: requestId,
          identityId: updatedRequest.identityId,
        }
      );
    }

    return NextResponse.json(updatedRequest);
  } catch (error: unknown) {
    const auditActorUserId = userId;
    const e = error as Error & { code?: string };
    console.error(`Error rejecting consent request ${requestId}:`, e);

    const errorDetails = {
      error: e.message,
      requestId,
      code: e.code || "UNKNOWN",
    };

    if (auditActorUserId) {
      await createAuditLog({
        actorType: AuditActorType.USER,
        actorUserId: auditActorUserId,
        action: "REJECT_CONSENT_REQUEST_FAILURE",
        targetEntityType: "ConsentRequest",
        targetEntityId: requestId,
        outcome: AuditLogOutcome.FAILURE,
        details: errorDetails,
      });
    }

    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}