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

    const identities = await prisma.identity.findMany({
      where: whereClause,
      select: {
        id: true,
        identityLabel: true,
        profilePictureUrl: true,
        category: true,
        customCategoryName: true, // Useful if category is CUSTOM
        visibility: true,
        description: true, // Adding description for more context in listings
        createdAt: true, // Useful for sorting or display
        updatedAt: true, // Useful for display
        // linkedExternalAccounts: { // Example of including related data if needed
        //   select: { account: { select: { provider: true } } }
        // }
      },
      orderBy: {
        identityLabel: 'asc',
      },
    });

    console.log(`[GET /api/users/me/identities] Found ${identities.length} identities for user ${userId} with current filters.`);
    return NextResponse.json(identities);

  } catch (error) {
    console.error(`[GET /api/users/me/identities] Failed to fetch user's identities for user ${token?.sub || 'unknown'}:`, error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
