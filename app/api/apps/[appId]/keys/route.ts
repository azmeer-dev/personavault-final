import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import prisma from '@/lib/prisma';
import bcrypt from 'bcrypt';
import crypto from 'crypto';

const SECRET = process.env.NEXTAUTH_SECRET;

export async function POST(
  req: NextRequest,
  { params }: { params: { appId: string } }
) {
  try {
    // Authenticated user session
    const token = await getToken({ req, secret: SECRET });
    if (!token || !token.sub) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { appId } = params;

    // Fetch App from the database
    const app = await prisma.app.findUnique({
      where: { id: appId },
    });

    if (!app) {
      return NextResponse.json({ error: 'App not found' }, { status: 404 });
    }

    // Verify that the authenticated user is the owner of the App
    if (app.ownerId !== token.sub) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // API Key Generation
    const apiKey = crypto.randomBytes(32).toString('hex');
    const salt = bcrypt.genSaltSync(10);
    const apiKeyHash = bcrypt.hashSync(apiKey, salt);

    // Database Update
    await prisma.app.update({
      where: { id: appId },
      data: {
        apiKeyHash,
        apiKeySalt: salt,
      },
    });

    // Response
    return NextResponse.json({ apiKey });
  } catch (error) {
    console.error('Error generating API key:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
