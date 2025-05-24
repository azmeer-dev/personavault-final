import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import prisma from '@/lib/prisma';
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
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const userId = token.sub;
    console.log(`[POST /api/users/me/consents/batch-grant] Authenticated user: ${userId}`);

    const body = await req.json();

    // Basic validation
    const { appId, identityIds, scopes } = body;
    if (!appId || typeof appId !== 'string') {
      return NextResponse.json({ error: 'Missing or invalid parameter: appId (string) is required.' }, { status: 400 });
    }
    if (!Array.isArray(identityIds) || identityIds.length === 0 || !identityIds.every(id => typeof id === 'string')) {
      return NextResponse.json({ error: 'Missing or invalid parameter: identityIds (non-empty array of strings) is required.' }, { status: 400 });
    }
    if (!Array.isArray(scopes) || scopes.length === 0 || !scopes.every(scope => typeof scope === 'string')) {
      return NextResponse.json({ error: 'Missing or invalid parameter: scopes (non-empty array of strings) is required.' }, { status: 400 });
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
      const errorMessage = `Forbidden: One or more identities are invalid or not owned by you. Problematic IDs: ${missingOrUnownedIds.join(', ')}`;
      console.warn(`[POST /api/users/me/consents/batch-grant] User ${userId} - ${errorMessage}`);
      return NextResponse.json({ error: errorMessage }, { status: 403 });
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
    return NextResponse.json({ message: successMessage, count: identityIds.length }, { status: 200 });

  } catch (error: any) {
    console.error(`[POST /api/users/me/consents/batch-grant] Failed to batch grant consents for user ${token?.sub || 'unknown'}:`, error);
    if (error.code === 'P2003') { // Prisma foreign key constraint failed (e.g. appId doesn't exist)
        if (error.meta?.field_name?.includes('appId')) {
            return NextResponse.json({ error: 'Invalid App ID: The specified application does not exist.' }, { status: 400 });
        }
    }
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
