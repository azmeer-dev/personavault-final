import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import prisma from '@/lib/prisma';
import { ConsentRequestStatus } from '@prisma/client';
import { createAuditLog } from '@/lib/audit'; // Added
import { AuditActorType, AuditLogOutcome } from '@prisma/client'; // Added

const SECRET = process.env.NEXTAUTH_SECRET;

export async function POST(
  req: NextRequest,
  { params }: { params: { requestId: string } }
) {
  try {
    const token = await getToken({ req, secret: SECRET });
    if (!token || !token.sub) {
      // No audit log here, no user context
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const userId = token.sub;
    const { requestId } = params;

    if (!requestId) {
      const errorMsg = 'Bad Request: requestId is required';
      await createAuditLog({
        actorType: AuditActorType.USER, actorUserId: userId, action: "REJECT_CONSENT_REQUEST_FAILURE",
        outcome: AuditLogOutcome.FAILURE, details: { error: errorMsg }
      });
      return NextResponse.json({ error: errorMsg }, { status: 400 });
    }

    const consentRequest = await prisma.consentRequest.findUnique({
      where: { id: requestId },
      include: { app: { select: { name: true }}} // Include app name for logging
    });

    if (!consentRequest) {
      const errorMsg = 'ConsentRequest not found';
      await createAuditLog({
        actorType: AuditActorType.USER, actorUserId: userId, action: "REJECT_CONSENT_REQUEST_FAILURE",
        targetEntityType: "ConsentRequest", targetEntityId: requestId, outcome: AuditLogOutcome.FAILURE,
        details: { error: errorMsg }
      });
      return NextResponse.json({ error: errorMsg }, { status: 404 });
    }

    if (consentRequest.targetUserId !== userId) {
      const errorMsg = 'Forbidden: You are not the target user for this request';
      await createAuditLog({
        actorType: AuditActorType.USER, actorUserId: userId, action: "REJECT_CONSENT_REQUEST_FAILURE",
        targetEntityType: "ConsentRequest", targetEntityId: requestId, outcome: AuditLogOutcome.FAILURE,
        details: { error: errorMsg, appId: consentRequest.appId, actualTargetUserId: consentRequest.targetUserId }
      });
      return NextResponse.json({ error: errorMsg }, { status: 403 });
    }

    if (consentRequest.status !== ConsentRequestStatus.PENDING) {
      const errorMsg = `Bad Request: ConsentRequest is already ${consentRequest.status.toLowerCase()}`;
      await createAuditLog({
        actorType: AuditActorType.USER, actorUserId: userId, action: "REJECT_CONSENT_REQUEST_FAILURE",
        targetEntityType: "ConsentRequest", targetEntityId: requestId, outcome: AuditLogOutcome.FAILURE,
        details: { error: errorMsg, appId: consentRequest.appId, currentStatus: consentRequest.status }
      });
      return NextResponse.json({ error: errorMsg }, { status: 400 });
    }

    const updatedRequest = await prisma.consentRequest.update({
      where: { id: requestId },
      data: {
        status: ConsentRequestStatus.REJECTED,
        processedAt: new Date(),
      },
      // Include app relation again if needed for appName in success log, or use consentRequest.app.name
      // For simplicity, we'll use the already fetched consentRequest.app.name
    });

    await createAuditLog({
      actorType: AuditActorType.USER, actorUserId: userId, action: "REJECT_CONSENT_REQUEST",
      targetEntityType: "ConsentRequest", targetEntityId: requestId, outcome: AuditLogOutcome.SUCCESS,
      details: { 
        appId: updatedRequest.appId, 
        identityId: updatedRequest.identityId, 
        scopes: updatedRequest.requestedScopes,
        appName: consentRequest.app.name // Use appName from the initially fetched consentRequest
      }
    });
    return NextResponse.json(updatedRequest);

  } catch (error: any) { // Typed error
    const auditActorUserId = userId || token?.sub; // Ensure userId is available for logging
    console.error(`Error rejecting consent request ${requestId} for user ${auditActorUserId || 'unknown'}:`, error);
    
    let specificErrorMessage = 'Internal Server Error';
    let statusCode = 500;
    const errorDetails: any = { 
        error: error.message || "Unknown error during consent rejection", 
        requestId: requestId, 
        appId: consentRequest?.appId, // consentRequest might be undefined if error is very early
        identityId: consentRequest?.identityId,
        code: error.code
    };

    if (error instanceof prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        specificErrorMessage = 'ConsentRequest not found during update';
        statusCode = 404;
        errorDetails.reason = specificErrorMessage;
    }
    
    if (auditActorUserId) {
        await createAuditLog({
            actorType: AuditActorType.USER, actorUserId: auditActorUserId, action: "REJECT_CONSENT_REQUEST_FAILURE",
            targetEntityType: "ConsentRequest", targetEntityId: requestId, outcome: AuditLogOutcome.FAILURE,
            details: errorDetails
        });
    }
    return NextResponse.json({ error: specificErrorMessage }, { status: statusCode });
  }
}
