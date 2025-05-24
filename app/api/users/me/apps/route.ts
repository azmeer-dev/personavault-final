import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import prisma from '@/lib/prisma';
// import { App } from '@prisma/client'; // App type can be implicitly handled by Prisma's return type

const SECRET = process.env.NEXTAUTH_SECRET;

export async function GET(req: NextRequest) {

  let token;
  try {
    token = await getToken({ req, secret: SECRET });
    if (!token || !token.sub) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const userId = token.sub;

    console.log(`[GET /api/users/me/apps] Fetching apps for user ${userId}`);

    const apps = await prisma.app.findMany({
      where: {
        ownerId: userId,
      },
      select: {
        id: true,
        name: true,
        description: true,
        logoUrl: true,
        websiteUrl: true,
        isEnabled: true,
        createdAt: true,
        // apiKeyHash is sensitive and should not be returned in a list view
        // apiKeySalt is sensitive and should not be returned
        // ownerId is redundant as it's the user themselves
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    console.log(`[GET /api/users/me/apps] Found ${apps.length} apps for user ${userId}`);
    if (apps.length > 0) {
      console.log(`[GET /api/users/me/apps] Returning user's apps. First app keys: ${Object.keys(apps[0]).join(', ')}`);
    }
    return NextResponse.json(apps);

  } catch (error) {
    console.error(`[GET /api/users/me/apps] Failed to fetch user applications for user ${token?.sub || 'unknown'}:`, error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
