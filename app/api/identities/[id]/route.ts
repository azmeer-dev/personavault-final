import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import prisma from '@/lib/prisma';
import { identityFormSchema } from '@/schemas/identityFormSchema';

const SECRET = process.env.NEXTAUTH_SECRET;

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const identityId = params.id;
  const token = await getToken({ req, secret: SECRET });

  if (!token || !token.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const json = await req.json();
    const data = identityFormSchema.parse(json);

    // Verify the identity belongs to the session user
    const existing = await prisma.identity.findUnique({
      where: { id: identityId },
      select: { userId: true },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Identity not found' }, { status: 404 });
    }

    if (existing.userId !== token.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Transaction: update identity and reset linked accounts
    const updatedIdentity = await prisma.$transaction(async (prismaTx) => {
      await prismaTx.identityAccount.deleteMany({ where: { identityId } });

      const identityUpdate = await prismaTx.identity.update({
        where: { id: identityId },
        data: {
          identityLabel:            data.identityLabel,
          category:                 data.category,
          customCategoryName:       data.customCategoryName,
          description:              data.description,
          contextualNameDetails:    data.contextualNameDetails,
          identityNameHistory:      data.identityNameHistory,
          contextualReligiousNames: data.contextualReligiousNames,
          genderIdentity:           data.genderIdentity,
          customGenderDescription:  data.customGenderDescription,
          pronouns:                 data.pronouns,
          dateOfBirth:              data.dateOfBirth ? new Date(data.dateOfBirth) : null,
          location:                 data.location,
          profilePictureUrl:        data.profilePictureUrl,
          identityContacts:         data.identityContacts,
          onlinePresence:           data.onlinePresence,
          websiteUrls:              data.websiteUrls,
          additionalAttributes:     data.additionalAttributes,
          visibility:               data.visibility,
        },
      });

      if (data.linkedAccountIds?.length) {
        await Promise.all(
          data.linkedAccountIds.map((accountId) =>
            prismaTx.identityAccount.create({ data: { identityId, accountId } })
          )
        );
      }

      return identityUpdate;
    });

    return NextResponse.json(updatedIdentity);
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 400 }
    );
  }
}

import { authenticateApp } from '@/lib/app-auth'; // Added import

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const identityId = params.id;
  console.log(`[GET /api/identities/${identityId}] Received request`);

  const authHeader = req.headers.get('Authorization');
  const appIdHeader = req.headers.get('X-App-ID');
  const requiredScope = "identity.read";

  if (authHeader && authHeader.startsWith('Bearer ') && appIdHeader) {
    console.log(`[GET /api/identities/${identityId}] Attempting API Key Auth via App ID ${appIdHeader}`);
    const authResult = await authenticateApp(req);

    if (authResult.error) {
      console.warn(`[GET /api/identities/${identityId}] API Key Auth failed for App ID ${appIdHeader}: ${authResult.error.status}`);
      return authResult.error;
    }

    if (authResult.app) {
      const authenticatedApp = authResult.app;
      console.log(`[GET /api/identities/${identityId}] API Key validated for App: ${authenticatedApp.id}`);

      const identity = await prisma.identity.findUnique({
        where: { id: identityId },
        include: { 
          linkedExternalAccounts: {
            include: {
              account: true,
            }
          } 
        },
      });

      if (!identity) {
        console.log(`[GET /api/identities/${identityId}] Identity not found for App ${authenticatedApp.id}`);
        return NextResponse.json({ error: 'Identity not found' }, { status: 404 });
      }
      console.log(`[GET /api/identities/${identityId}] Found identity for App ${authenticatedApp.id}, owner: ${identity.userId}, visibility: ${identity.visibility}`);

      // --- NEW LOGIC: Check for PUBLIC visibility first ---
      if (identity.visibility === 'PUBLIC') {
        console.log(`[GET /api/identities/${identityId}] Access to PUBLIC identity ${identity.id} granted to App ${authenticatedApp.id} via API key without specific consent.`);
        return NextResponse.json(identity);
      }
      // --- END NEW LOGIC ---

      // If not public, proceed with consent checks
      console.log(`[GET /api/identities/${identityId}] Identity ${identity.id} is not public. Proceeding with consent check for App ${authenticatedApp.id}.`);
      // 1. Check for identity-specific consent
      let consent = await prisma.consent.findFirst({
        where: {
          appId: authenticatedApp.id,
          userId: identity.userId,
          identityId: identity.id, // Specific to this identity
          revokedAt: null,
        },
      });

      if (consent) {
        console.log(`[GET /api/identities/${identityId}] Found identity-specific consent ID: ${consent.id} for App ${authenticatedApp.id}`);
        if (consent.grantedScopes.includes(requiredScope)) {
          console.log(`[GET /api/identities/${identityId}] '${requiredScope}' scope validated in identity-specific consent for App ${authenticatedApp.id}. Returning identity.`);
          return NextResponse.json(identity);
        } else {
          console.warn(`[GET /api/identities/${identityId}] Identity-specific consent found, but '${requiredScope}' scope missing for App ${authenticatedApp.id}.`);
          // Fall through to check user-level consent, or deny if strict identity-specific consent is required.
          // For now, let's be explicit: if identity-specific consent exists but lacks scope, it's a targeted denial.
           return NextResponse.json({ error: `Forbidden: Insufficient scope in identity-specific consent. '${requiredScope}' is required.` }, { status: 403 });
        }
      } else {
         console.log(`[GET /api/identities/${identityId}] No identity-specific consent found for App ${authenticatedApp.id}. Checking user-level consent.`);
      }

      // 2. Check for user-level consent (identityId is null)
      const userLevelConsent = await prisma.consent.findFirst({
        where: {
          appId: authenticatedApp.id,
          userId: identity.userId,
          identityId: null, // User-level consent
          revokedAt: null,
        },
      });

      if (userLevelConsent) {
        console.log(`[GET /api/identities/${identityId}] Found user-level consent ID: ${userLevelConsent.id} for App ${authenticatedApp.id} and user ${identity.userId}`);
        if (userLevelConsent.grantedScopes.includes(requiredScope)) {
          console.log(`[GET /api/identities/${identityId}] '${requiredScope}' scope validated in user-level consent for App ${authenticatedApp.id}. Returning identity.`);
          return NextResponse.json(identity);
        } else {
          console.warn(`[GET /api/identities/${identityId}] User-level consent found, but '${requiredScope}' scope missing for App ${authenticatedApp.id}.`);
          return NextResponse.json({ error: `Forbidden: Insufficient scope in user-level consent. '${requiredScope}' is required.` }, { status: 403 });
        }
      }
      
      console.warn(`[GET /api/identities/${identityId}] No valid (identity-specific or user-level) consent with '${requiredScope}' scope found for App ${authenticatedApp.id}.`);
      return NextResponse.json({ error: 'Forbidden: Consent not granted or insufficient scope for this application to access the specified identity.' }, { status: 403 });
    }
  }

  // Fallback to session-based authentication
  console.log(`[GET /api/identities/${identityId}] No API key auth attempt or API auth did not resolve. Falling back to session-based auth.`);
  try {
    const identity = await prisma.identity.findUnique({
      where: { id: identityId },
      include: { 
        linkedExternalAccounts: {
          include: {
            account: true,
          }
        } 
      },
    });

    if (!identity) {
      console.log(`[GET /api/identities/${identityId}] (Session Auth) Identity not found.`);
      return NextResponse.json({ error: 'Identity not found' }, { status: 404 });
    }

    console.log(`[GET /api/identities/${identityId}] (Session Auth) Found identity, visibility: ${identity.visibility}`);
    const token = await getToken({ req, secret: SECRET });

    if (identity.visibility === 'PUBLIC') {
      console.log(`[GET /api/identities/${identityId}] (Session Auth) Public identity, returning data.`);
      return NextResponse.json(identity);
    }

    if (token && token.sub && identity.userId === token.sub) {
      console.log(`[GET /api/identities/${identityId}] (Session Auth) Private identity, user ${token.sub} is owner. Returning data.`);
      return NextResponse.json(identity);
    }
    
    console.warn(`[GET /api/identities/${identityId}] (Session Auth) Forbidden access attempt by user ${token?.sub || 'anonymous'}.`);
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  } catch (error) {
    console.error(`[GET /api/identities/${identityId}] (Session Auth) Error fetching identity:`, error);
    return NextResponse.json({ error: 'Internal server error during session auth path' }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const identityId = params.id;
  console.log(`[DELETE /api/identities/${identityId}] Received request`);

  try {
    const token = await getToken({ req, secret: SECRET });
    // Ensure token.sub is used for consistency, assuming it holds the user ID.
    // The previous PUT handler used token.id, this uses token.sub like the GET handler.
    if (!token || !token.sub) { 
      console.log(`[DELETE /api/identities/${identityId}] Unauthorized: No session token or user ID (sub) in token.`);
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const userId = token.sub;

    const identity = await prisma.identity.findUnique({
      where: { id: identityId },
      select: { userId: true }, // Only fetch userId for ownership check
    });

    if (!identity) {
      console.log(`[DELETE /api/identities/${identityId}] Identity not found for user ${userId}.`);
      return NextResponse.json({ error: 'Identity not found' }, { status: 404 });
    }

    if (identity.userId !== userId) {
      console.warn(`[DELETE /api/identities/${identityId}] Forbidden: User ${userId} does not own identity ${identityId} (owned by ${identity.userId}).`);
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    await prisma.identity.delete({
      where: { id: identityId },
    });

    console.log(`[DELETE /api/identities/${identityId}] Identity deleted successfully by user ${userId}.`);
    // Returning 200 with a message is often preferred over 204 for DELETE if a confirmation is useful
    return NextResponse.json({ message: 'Identity deleted successfully' }, { status: 200 });

  } catch (error) {
    console.error(`[DELETE /api/identities/${identityId}] Error deleting identity for user ${token?.sub || 'unknown'}:`, error);
    // Check for specific Prisma errors, e.g., P2025 (Record to delete does not exist)
    // Although findUnique should catch this first.
    if (error instanceof prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2025') {
        console.log(`[DELETE /api/identities/${identityId}] Prisma Error P2025: Record to delete does not exist (already deleted?).`);
        return NextResponse.json({ error: 'Identity not found or already deleted' }, { status: 404 });
      }
      // Add other Prisma error codes to handle if necessary
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
