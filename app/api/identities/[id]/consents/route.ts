import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import prisma from '@/lib/prisma'; // Assuming prisma client is in /lib/prisma

// Placeholder for user session type
interface UserSession {
  id: string;
  // Add other relevant user properties if needed
}

// GET /api/identities/[identityId]/consents
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const { id: identityId } = params;
  const token = await getToken({ req: request });

  if (!token || !token.sub) {
    return NextResponse.json({ message: 'Authentication required' }, { status: 401 });
  }
  const userId = token.sub;

  try {
    // 1. Validate user ownership of the identity
    const identity = await prisma.identity.findUnique({
      where: { id: identityId },
    });

    if (!identity || identity.userId !== userId) {
      return NextResponse.json({ message: 'Identity not found or access denied' }, { status: 404 });
    }

    // 2. Fetch connectable apps
    const connectableApps = await prisma.app.findMany({
      where: {
        isSystemApp: false,
        isAdminApproved: true,
        isEnabled: true,
      },
      select: {
        id: true,
        name: true,
        description: true,
        logoUrl: true,
        // Add any other non-sensitive fields needed for the response
      },
    });

    // 3. Fetch active consents for the given identityId
    const activeConsents = await prisma.consent.findMany({
      where: {
        identityId: identityId,
        revokedAt: null, // Only active consents
      },
      include: {
        app: { // Include app details for grantedApps
          select: {
            id: true,
            name: true,
            description: true,
            logoUrl: true,
          }
        }
      }
    });

    // 4. Prepare response
    const grantedAppsMap = new Map();
    activeConsents.forEach(consent => {
      grantedAppsMap.set(consent.appId, {
        ...consent.app, // Spread the selected app details
        consentId: consent.id,
        grantedScopes: consent.grantedScopes,
        grantedAt: consent.createdAt, // or updatedAt if more appropriate
      });
    });

    const grantedApps = Array.from(grantedAppsMap.values());
    const availableApps = connectableApps.filter(app => !grantedAppsMap.has(app.id));

    return NextResponse.json({ grantedApps, availableApps });

  } catch (error) {
    console.error('GET /consents error:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/identities/[identityId]/consents
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const { id: identityId } = params;
  const token = await getToken({ req: request });

  if (!token || !token.sub) {
    return NextResponse.json({ message: 'Authentication required' }, { status: 401 });
  }
  const userId = token.sub;

  try {
    const { appId, scopes } = await request.json();

    if (!appId || !scopes || !Array.isArray(scopes)) {
      return NextResponse.json({ message: 'Missing appId or scopes in request body' }, { status: 400 });
    }

    // 1. Validate user ownership of the identity
    const identity = await prisma.identity.findUnique({
      where: { id: identityId },
    });

    if (!identity || identity.userId !== userId) {
      return NextResponse.json({ message: 'Identity not found or access denied' }, { status: 404 });
    }

    // 2. Verify the app exists and is connectable
    const app = await prisma.app.findUnique({
      where: { id: appId },
    });

    if (!app || app.isSystemApp || !app.isAdminApproved || !app.isEnabled) {
      return NextResponse.json({ message: 'App not found or not connectable' }, { status: 404 });
    }

    // 3. Check if active consent already exists for this user-app-identity
    const existingConsent = await prisma.consent.findFirst({
      where: {
        userId: userId,
        appId: appId,
        identityId: identityId,
        revokedAt: null,
      },
    });

    if (existingConsent) {
      return NextResponse.json({ message: 'Active consent already exists for this app and identity.' }, { status: 409 });
    }

    // 4. Create new consent
    const newConsent = await prisma.consent.create({
      data: {
        userId: userId,
        appId: appId,
        identityId: identityId,
        grantedScopes: scopes,
        // grantedAt and updatedAt are set by default
      },
    });

    return NextResponse.json(newConsent, { status: 201 });

  } catch (error) {
    console.error('POST /consents error:', error);
    // Consider more specific error handling, e.g., Prisma validation errors
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/consents/[consentId] - Note: Path is different from the folder structure
// This will be handled in a different file: app/api/consents/[consentId]/route.ts
// For now, this file will only contain GET and POST for /api/identities/[id]/consents

// To implement DELETE /api/consents/[consentId], a new file
// app/api/consents/[consentId]/route.ts would be needed.
// The logic would be:
// 1. Get consentId from params.
// 2. Authenticate user via getToken.
// 3. Find consent by consentId.
// 4. Verify user owns the identity associated with the consent OR user is the direct user of the consent.
//    const consent = await prisma.consent.findUnique({ where: { id: consentId }, include: { identity: true } });
//    if (!consent) return NextResponse.json({ message: 'Consent not found' }, { status: 404 });
//    if (consent.userId !== userId) { // Check if the user directly owns the consent
//        // If consent is linked to an identity, check if user owns that identity
//        if (!consent.identity || consent.identity.userId !== userId) {
//            return NextResponse.json({ message: 'Unauthorized' }, { status: 403 });
//        }
//    }
// 5. Soft delete: await prisma.consent.update({ where: { id: consentId }, data: { revokedAt: new Date() } });
// 6. Return 204 or success message.
// This is just a sketch for the DELETE handler.
