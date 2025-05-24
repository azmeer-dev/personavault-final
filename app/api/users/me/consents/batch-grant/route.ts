import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import prisma from '@/lib/prisma';
import { createAuditLog } from '@/lib/audit'; // Added
import { AuditActorType, AuditLogOutcome } from '@prisma/client'; // Added
// import { z } from 'zod'; // Optional: for Zod validation

const SECRET = process.env.NEXTAUTH_SECRET;

// Optional Zod schema (example, not used in this basic implementation)
// const batchGrantSchema = z.object({
//   appId: z.string().cuid(), // Assuming CUID for App ID
//   identityIds: z.array(z.string().cuid()).min(1, { message: "At least one identityId must be provided." }),
//   scopes: z.array(z.string().min(1, { message: "Scope cannot be empty."})).min(1, { message: "At least one scope must be provided." }),
// });

export async function POST(req: NextRequest) {
  console.log('[POST /api/users/me/consents/batch-grant] Received request');
  try {
    const token = await getToken({ req, secret: SECRET });
    if (!token || !token.sub) {
      console.log('[POST /api/users/me/consents/batch-grant] Unauthorized: No token or token.sub');
      // No audit log here as we don't have a userId to associate with the attempt
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const userId = token.sub;
    console.log(`[POST /api/users/me/consents/batch-grant] Authenticated user: ${userId}`);

    const body = await req.json();

    // Basic validation
    const { appId, identityIds, scopes } = body;
    const auditDetailsBase = { providedAppId: appId, providedIdentityIds: identityIds, providedScopes: scopes, inputBody: body };

    if (!appId || typeof appId !== 'string') {
      const errorMsg = 'Missing or invalid parameter: appId (string) is required.';
      await createAuditLog({
        actorType: AuditActorType.USER, actorUserId: userId, action: "GRANT_CONSENT_BATCH_FAILURE",
        outcome: AuditLogOutcome.FAILURE, details: { ...auditDetailsBase, error: errorMsg }
      });
      return NextResponse.json({ error: errorMsg }, { status: 400 });
    }
    if (!Array.isArray(identityIds) || identityIds.length === 0 || !identityIds.every(id => typeof id === 'string')) {
      const errorMsg = 'Missing or invalid parameter: identityIds (non-empty array of strings) is required.';
      await createAuditLog({
        actorType: AuditActorType.USER, actorUserId: userId, action: "GRANT_CONSENT_BATCH_FAILURE",
        outcome: AuditLogOutcome.FAILURE, details: { ...auditDetailsBase, error: errorMsg }
      });
      return NextResponse.json({ error: errorMsg }, { status: 400 });
    }
    if (!Array.isArray(scopes) || scopes.length === 0 || !scopes.every(scope => typeof scope === 'string')) {
      const errorMsg = 'Missing or invalid parameter: scopes (non-empty array of strings) is required.';
      await createAuditLog({
        actorType: AuditActorType.USER, actorUserId: userId, action: "GRANT_CONSENT_BATCH_FAILURE",
        outcome: AuditLogOutcome.FAILURE, details: { ...auditDetailsBase, error: errorMsg }
      });
      return NextResponse.json({ error: errorMsg }, { status: 400 });
    }
    console.log(`[POST /api/users/me/consents/batch-grant] Validation passed for user ${userId}, app ${appId}, identities: ${identityIds.length}, scopes: ${scopes.length}`);

    // Fetch and verify ownership of all identities first
    const identities = await prisma.identity.findMany({
      where: {
        id: { in: identityIds },
        userId: userId, // Ensure all selected identities belong to the user
      },
      select: { id: true }, // Only need IDs for verification
    });

    if (identities.length !== identityIds.length) {
      const foundIds = identities.map(idObj => idObj.id);
      const missingOrUnownedIds = identityIds.filter(id => !foundIds.includes(id));
      const errorMsg = `Forbidden: One or more identities are invalid or not owned by you. Problematic IDs: ${missingOrUnownedIds.join(', ')}`;
      console.warn(`[POST /api/users/me/consents/batch-grant] User ${userId} - ${errorMsg}`);
      await createAuditLog({
        actorType: AuditActorType.USER, actorUserId: userId, action: "GRANT_CONSENT_BATCH_FAILURE",
        outcome: AuditLogOutcome.FAILURE,
        details: { ...auditDetailsBase, error: errorMsg, missingOrUnownedIds }
      });
      return NextResponse.json({ error: errorMsg }, { status: 403 });
    }
    console.log(`[POST /api/users/me/consents/batch-grant] All ${identityIds.length} identities verified for user ${userId}`);
    
    // All identities are valid and owned by the user, proceed with transaction
    const now = new Date();
    const consentUpsertOperations = identityIds.map(identityId => 
      prisma.consent.upsert({
        where: { 
          userId_appId_identityId: { userId, appId, identityId } 
        },
        create: {
          userId,
          appId,
          identityId,
          grantedScopes: scopes,
          grantedAt: now,
          revokedAt: null,
          // expiresAt: null, // TODO: Implement expiry logic if needed
        },
        update: {
          grantedScopes: scopes,
          grantedAt: now, // Refresh grantedAt on re-consent
          revokedAt: null, // Important to re-activate if previously revoked
          // expiresAt: null, // TODO: Implement expiry logic if needed
        },
      })
    );

    // Execute all upsert operations within a transaction
    await prisma.$transaction(consentUpsertOperations);

    const successMessage = `${identityIds.length} consent(s) processed successfully for app ${appId}.`;
    console.log(`[POST /api/users/me/consents/batch-grant] User ${userId} - ${successMessage}`);
    
    await createAuditLog({
      actorType: AuditActorType.USER, actorUserId: userId, action: "GRANT_CONSENT_BATCH",
      outcome: AuditLogOutcome.SUCCESS,
      // For targetEntity, we could log the appId, or each identityId if feasible.
      // Logging the batch details is a good compromise.
      targetEntityType: "App", // Target is primarily the App receiving consents
      targetEntityId: appId,
      details: { appId: appId, grantedIdentityIds: identityIds, scopes: scopes, count: identityIds.length }
    });
    
    return NextResponse.json({ message: successMessage, count: identityIds.length }, { status: 200 });

  } catch (error: any) {
    const auditActorUserId = userId || token?.sub; // Ensure userId is available for logging
    console.error(`[POST /api/users/me/consents/batch-grant] Failed to batch grant consents for user ${auditActorUserId || 'unknown'}:`, error);
    
    // Default error details
    let errorDetails: any = { error: error.message || "Unknown error during batch consent grant", inputAppId: body?.appId, inputIdentityIds: body?.identityIds, inputScopes: body?.scopes };
    let specificErrorMessage = 'Internal Server Error';

    if (error.code === 'P2003') { // Prisma foreign key constraint failed
        if (error.meta?.field_name?.includes('appId')) {
            specificErrorMessage = 'Invalid App ID: The specified application does not exist.';
            errorDetails.reason = specificErrorMessage;
        }
    }
    
    if (auditActorUserId) {
        await createAuditLog({
            actorType: AuditActorType.USER, actorUserId: auditActorUserId, action: "GRANT_CONSENT_BATCH_DB_FAILURE",
            outcome: AuditLogOutcome.FAILURE,
            details: errorDetails
        });
    }
    return NextResponse.json({ error: specificErrorMessage }, { status: (error.code === 'P2003' && error.meta?.field_name?.includes('appId')) ? 400 : 500 });
  }
}
