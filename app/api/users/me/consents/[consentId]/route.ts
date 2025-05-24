import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import prisma from '@/lib/prisma';
import { createAuditLog } from '@/lib/audit'; // Added
import { AuditActorType, AuditLogOutcome } from '@prisma/client'; // Added

const SECRET = process.env.NEXTAUTH_SECRET;

export async function DELETE(
  req: NextRequest,
  { params }: { params: { consentId: string } }
) {
  try {
    const token = await getToken({ req, secret: SECRET });
    if (!token || !token.sub) {
      // No audit log here as we don't have a userId or target
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const userId = token.sub;
    const { consentId } = params;

    if (!consentId) {
      // No specific target for audit log here if consentId is missing
      await createAuditLog({
        actorType: AuditActorType.USER, actorUserId: userId, action: "REVOKE_CONSENT_FAILURE",
        outcome: AuditLogOutcome.FAILURE, details: { error: "Bad Request: consentId is required" }
      });
      return NextResponse.json({ error: 'Bad Request: consentId is required' }, { status: 400 });
    }

    const consent = await prisma.consent.findUnique({
      where: { id: consentId },
    });

    if (!consent) {
      await createAuditLog({
        actorType: AuditActorType.USER, actorUserId: userId, action: "REVOKE_CONSENT_FAILURE",
        targetEntityType: "Consent", targetEntityId: consentId, outcome: AuditLogOutcome.FAILURE,
        details: { error: "Consent not found" }
      });
      return NextResponse.json({ error: 'Consent not found' }, { status: 404 });
    }

    if (consent.userId !== userId) {
      await createAuditLog({
        actorType: AuditActorType.USER, actorUserId: userId, action: "REVOKE_CONSENT_FAILURE",
        targetEntityType: "Consent", targetEntityId: consentId, outcome: AuditLogOutcome.FAILURE,
        details: { error: "User not owner of consent", actualOwner: consent.userId, appId: consent.appId, identityId: consent.identityId }
      });
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Check if already revoked
    if (consent.revokedAt) {
      await createAuditLog({
        actorType: AuditActorType.USER, actorUserId: userId, action: "REVOKE_CONSENT", // Action is still REVOKE_CONSENT
        targetEntityType: "Consent", targetEntityId: consentId, outcome: AuditLogOutcome.SUCCESS, // Still a success from user's perspective
        details: { statusMessage: "Consent was already revoked.", appId: consent.appId, identityId: consent.identityId }
      });
      return NextResponse.json({ message: 'Consent already revoked' }, { status: 200 });
    }

    const updatedConsent = await prisma.consent.update({
      where: { id: consentId },
      data: { revokedAt: new Date() },
    });

    await createAuditLog({
      actorType: AuditActorType.USER, actorUserId: userId, action: "REVOKE_CONSENT",
      targetEntityType: "Consent", targetEntityId: consentId, outcome: AuditLogOutcome.SUCCESS,
      details: { consentDetails: { appId: updatedConsent.appId, identityId: updatedConsent.identityId, scopes: updatedConsent.grantedScopes } }
    });
    return NextResponse.json({ message: 'Consent revoked successfully' }, { status: 200 });

  } catch (error: any) { // Typed error
    const auditActorUserId = token?.sub; // Use token.sub directly as userId might not be set if error is early
    const targetId = params?.consentId; // Use params.consentId if available

    console.error(`Error revoking consent ${targetId} for user ${auditActorUserId || 'unknown'}:`, error);
    
    let specificErrorMessage = 'Internal Server Error';
    let statusCode = 500;

    if (error instanceof prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        specificErrorMessage = 'Consent not found during update attempt'; // More specific than generic "Consent not found"
        statusCode = 404;
    }
    
    if (auditActorUserId) {
        await createAuditLog({
            actorType: AuditActorType.USER, actorUserId: auditActorUserId, action: "REVOKE_CONSENT_FAILURE",
            targetEntityType: "Consent", targetEntityId: targetId, outcome: AuditLogOutcome.FAILURE,
            details: { error: error.message || specificErrorMessage, code: error.code }
        });
    }
    return NextResponse.json({ error: specificErrorMessage }, { status: statusCode });
  }
}
