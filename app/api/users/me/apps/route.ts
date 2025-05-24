import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import prisma from '@/lib/prisma';

const SECRET = process.env.NEXTAUTH_SECRET;

export async function GET(req: NextRequest) {
  let userId: string | undefined;

  try {
    const token = await getToken({ req, secret: SECRET });
    if (!token || !token.sub) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    userId = token.sub;
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
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    console.log(`[GET /api/users/me/apps] Found ${apps.length} apps for user ${userId}`);
    return NextResponse.json(apps);

  } catch (error) {
    console.error(`[GET /api/users/me/apps] Failed to fetch user applications for user ${userId || 'unknown'}:`, error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
