import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import prisma from '@/lib/prisma';

const SECRET = process.env.NEXTAUTH_SECRET;

export async function GET(req: NextRequest) {
  console.log('[GET /api/apps/connectable] Received request');
  let token;
  try {
    token = await getToken({ req, secret: SECRET });
    if (!token || !token.sub) {
      console.log('[GET /api/apps/connectable] Unauthorized: No token or token.sub');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const userId = token.sub;
    console.log(`[GET /api/apps/connectable] Authenticated user: ${userId}`);

    const connectableApps = await prisma.app.findMany({
      where: {
        ownerId: {
          not: userId, // Exclude apps owned by the current user
        },
        isEnabled: true, // Only list enabled apps
        isSystemApp: false, // Typically, system apps might not be "connectable" in this context
        isAdminApproved: true, // Only list apps that are approved
      },
      select: {
        id: true,
        name: true,
        description: true,
        logoUrl: true,
        websiteUrl: true,
        privacyPolicyUrl: true, // Useful for user to review before connecting
        termsOfServiceUrl: true, // Useful for user to review before connecting
        // Do not select sensitive fields like apiKeyHash, clientSecretHash, ownerId (already used in filter)
      },
      orderBy: {
        name: 'asc',
      },
    });

    console.log(`[GET /api/apps/connectable] Found ${connectableApps.length} connectable apps for user ${userId}`);
    if (connectableApps.length > 0) {
      console.log(`[GET /api/apps/connectable] Returning connectable apps. First app keys: ${Object.keys(connectableApps[0]).join(', ')}`);
    }
    return NextResponse.json(connectableApps);

  } catch (error) {
    console.error(`[GET /api/apps/connectable] Failed to fetch connectable applications for user ${token?.sub || 'unknown'}:`, error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
