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
      // No specific target for audit log here if requestId is missing
      await createAuditLog({
        actorType: AuditActorType.USER, actorUserId: userId, action: "APPROVE_CONSENT_REQUEST_FAILURE",
        outcome: AuditLogOutcome.FAILURE, details: { error: errorMsg }
      });
      return NextResponse.json({ error: errorMsg }, { status: 400 });
    }

    const consentRequest = await prisma.consentRequest.findUnique({
      where: { id: requestId },
      include: { 
        app: { select: { id: true, name: true }} // Include app name for logging
      }
    });

    if (!consentRequest) {
      const errorMsg = 'ConsentRequest not found';
      await createAuditLog({
        actorType: AuditActorType.USER, actorUserId: userId, action: "APPROVE_CONSENT_REQUEST_FAILURE",
        targetEntityType: "ConsentRequest", targetEntityId: requestId, outcome: AuditLogOutcome.FAILURE,
        details: { error: errorMsg }
      });
      return NextResponse.json({ error: errorMsg }, { status: 404 });
    }

    if (consentRequest.targetUserId !== userId) {
      const errorMsg = 'Forbidden: You are not the target user for this request';
      await createAuditLog({
        actorType: AuditActorType.USER, actorUserId: userId, action: "APPROVE_CONSENT_REQUEST_FAILURE",
        targetEntityType: "ConsentRequest", targetEntityId: requestId, outcome: AuditLogOutcome.FAILURE,
        details: { error: errorMsg, appId: consentRequest.appId, actualTargetUserId: consentRequest.targetUserId }
      });
      return NextResponse.json({ error: errorMsg }, { status: 403 });
    }

    if (consentRequest.status !== ConsentRequestStatus.PENDING) {
      const errorMsg = `Bad Request: ConsentRequest is already ${consentRequest.status.toLowerCase()}`;
      await createAuditLog({
        actorType: AuditActorType.USER, actorUserId: userId, action: "APPROVE_CONSENT_REQUEST_FAILURE",
        targetEntityType: "ConsentRequest", targetEntityId: requestId, outcome: AuditLogOutcome.FAILURE,
        details: { error: errorMsg, appId: consentRequest.appId, currentStatus: consentRequest.status }
      });
      return NextResponse.json({ error: errorMsg }, { status: 400 });
    }
    
    if (!consentRequest.appId) {
        const errorMsg = 'Internal Server Error: App ID missing from consent request.';
        console.error(`[ApproveConsentRequest] ConsentRequest ${requestId} is missing appId.`);
        await createAuditLog({
            actorType: AuditActorType.USER, actorUserId: userId, action: "APPROVE_CONSENT_REQUEST_FAILURE",
            targetEntityType: "ConsentRequest", targetEntityId: requestId, outcome: AuditLogOutcome.FAILURE,
            details: { error: errorMsg, reason: "ConsentRequest.appId is null or undefined." }
        });
        return NextResponse.json({ error: errorMsg }, { status: 500 });
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

      const consentUpsertData = {
        userId: userId,
        appId: consentRequest.appId!, // Not null due to check above
        identityId: consentRequest.identityId, 
        grantedScopes: consentRequest.requestedScopes,
        grantedAt: now,
        expiresAt: null, 
        revokedAt: null, 
        lastUsedAt: null,
      };
      
      const createdOrUpdatedConsent = await tx.consent.upsert({
        where: {
          userId_appId_identityId: {
            userId: userId,
            appId: consentRequest.appId!, // Not null
            identityId: consentRequest.identityId, 
          }
        },
        create: consentUpsertData,
        update: {
          grantedScopes: consentRequest.requestedScopes,
          grantedAt: now, 
          revokedAt: null, 
          expiresAt: null, 
        },
      });

      return { updatedRequest, createdOrUpdatedConsent };
    });

    await createAuditLog({
      actorType: AuditActorType.USER, actorUserId: userId, action: "APPROVE_CONSENT_REQUEST",
      targetEntityType: "ConsentRequest", targetEntityId: requestId, outcome: AuditLogOutcome.SUCCESS,
      details: { 
        appId: consentRequest.appId, 
        identityId: consentRequest.identityId, 
        scopes: consentRequest.requestedScopes, 
        createdConsentId: result.createdOrUpdatedConsent.id,
        appName: consentRequest.app.name // Added app name from included relation
      }
    });
    return NextResponse.json(result.createdOrUpdatedConsent);

  } catch (error: any) { // Typed error
    const auditActorUserId = userId || token?.sub; // Ensure userId is available for logging
    console.error(`Error approving consent request ${requestId} for user ${auditActorUserId || 'unknown'}:`, error);
    
    let specificErrorMessage = 'Internal Server Error';
    let statusCode = 500;
    const errorDetails: any = { 
        error: error.message || "Unknown error during consent approval", 
        requestId: requestId, 
        appId: consentRequest?.appId, // consentRequest might be undefined if error is very early
        identityId: consentRequest?.identityId,
        code: error.code
    };

    if (error instanceof prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2003') { // Foreign key constraint failed
             specificErrorMessage = 'Bad Request: Invalid data provided for consent (e.g., App ID does not exist).';
             statusCode = 400;
             errorDetails.reason = specificErrorMessage;
        }
    }
    
    if (auditActorUserId) {
        await createAuditLog({
            actorType: AuditActorType.USER, actorUserId: auditActorUserId, action: "APPROVE_CONSENT_REQUEST_FAILURE",
            targetEntityType: "ConsentRequest", targetEntityId: requestId, outcome: AuditLogOutcome.FAILURE,
            details: errorDetails
        });
    }
    return NextResponse.json({ error: specificErrorMessage }, { status: statusCode });
  }
}
