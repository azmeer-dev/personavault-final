import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import prisma from '@/lib/prisma';
import { IdentityVisibility } from '@prisma/client'; // For visibility enum

const SECRET = process.env.NEXTAUTH_SECRET;

export async function GET(req: NextRequest) {
  console.log('[GET /api/users/me/identities] Received request');
  let token;
  try {
    token = await getToken({ req, secret: SECRET });
    if (!token || !token.sub) {
      console.log('[GET /api/users/me/identities] Unauthorized: No token or token.sub');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const userId = token.sub;
    console.log(`[GET /api/users/me/identities] Authenticated user: ${userId}`);

    const { searchParams } = new URL(req.url);
    const visibilityParam = searchParams.get('visibility');
    console.log(`[GET /api/users/me/identities] Visibility param: ${visibilityParam}`);

    // Base where clause for Prisma query
    const whereClause: {
      userId: string;
      visibility?: IdentityVisibility;
    } = { userId };

    if (visibilityParam) {
      // Validate visibilityParam against the IdentityVisibility enum
      if (Object.values(IdentityVisibility).includes(visibilityParam.toUpperCase() as IdentityVisibility)) {
        whereClause.visibility = visibilityParam.toUpperCase() as IdentityVisibility;
        console.log(`[GET /api/users/me/identities] Filtering by visibility: ${whereClause.visibility}`);
      } else {
        console.warn(`[GET /api/users/me/identities] Invalid visibility value: ${visibilityParam}`);
        return NextResponse.json({ error: `Invalid visibility value. Must be one of: ${Object.values(IdentityVisibility).join(', ')}` }, { status: 400 });
      }
    }

    const appId = searchParams.get('appId');

let identities;

if (appId) {
  console.log(`[GET /api/users/me/identities] Filtering out identities with active consent for appId: ${appId}`);

  // Step 1: Get identity IDs with active consent
  const consentedIdentityIds = await prisma.consent.findMany({
    where: {
      userId,
      appId,
      revokedAt: null,
    },
    select: { identityId: true },
  });

  const excludedIds = consentedIdentityIds.map((c) => c.identityId);

  // Step 2: Get all identities not in excluded list
  identities = await prisma.identity.findMany({
    where: {
      ...whereClause,
      id: {
        notIn: excludedIds.filter((id) => id !== null),
      },
    },
    select: {
      id: true,
      identityLabel: true,
      profilePictureUrl: true,
      category: true,
      customCategoryName: true,
      visibility: true,
      description: true,
      createdAt: true,
      updatedAt: true,
    },
    orderBy: {
      identityLabel: 'asc',
    },
  });

  console.log(`[GET /api/users/me/identities] Found ${identities.length} unconsented identities.`);
} else {
  identities = await prisma.identity.findMany({
    where: whereClause,
    select: {
      id: true,
      identityLabel: true,
      profilePictureUrl: true,
      category: true,
      customCategoryName: true,
      visibility: true,
      description: true,
      createdAt: true,
      updatedAt: true,
    },
    orderBy: {
      identityLabel: 'asc',
    },
  });

  console.log(`[GET /api/users/me/identities] Found ${identities.length} identities with no appId filtering.`);
}


    console.log(`[GET /api/users/me/identities] Found ${identities.length} identities for user ${userId} with current filters.`);
    return NextResponse.json(identities);

  } catch (error) {
    console.error(`[GET /api/users/me/identities] Failed to fetch user's identities for user ${token?.sub || 'unknown'}:`, error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
