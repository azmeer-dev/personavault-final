/* app/api/consent-requests/route.ts */

import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import prisma from '@/lib/prisma';
import { ConsentRequestStatus } from '@prisma/client';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';

interface ConsentRequestBody {
  identityId: string;
  targetUserId: string;
  requestedScopes: string[];
  contextDescription: string;
  appId?: string;
}

export async function POST(req: NextRequest) {
  try {
    // Authenticate
    const token = await getToken({ req });
    if (!token?.sub) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const requesterUserId = token.sub;

    // Parse body
    const {
      identityId,
      targetUserId,
      requestedScopes,
      contextDescription,
      appId,
    }: ConsentRequestBody = await req.json();

    // Validate
    if (
      !identityId ||
      !targetUserId ||
      !Array.isArray(requestedScopes) ||
      requestedScopes.length === 0 ||
      !contextDescription.trim()
    ) {
      return NextResponse.json(
        { error: 'Missing or invalid required fields' },
        { status: 400 }
      );
    }

    // Determine flow
    const useAppId = appId?.trim() || undefined;
    const isAppFlow = Boolean(useAppId);
    const isUserFlow = !useAppId;
    if (isAppFlow === isUserFlow) {
      return NextResponse.json(
        { error: 'Must supply exactly one of appId (app flow) or omit it for user flow' },
        { status: 400 }
      );
    }
    if (!isAppFlow && requesterUserId === targetUserId) {
      return NextResponse.json(
        { error: 'Cannot request consent from yourself' },
        { status: 400 }
      );
    }

    // Verify app exists if app flow
    if (isAppFlow) {
      const appExists = await prisma.app.findUnique({
        where: { id: useAppId! },
        select: { id: true },
      });
      if (!appExists) {
        return NextResponse.json(
          { error: `App ${useAppId} not found` },
          { status: 400 }
        );
      }
    }

    // Verify identity ownership
    const identity = await prisma.identity.findUnique({
      where: { id: identityId },
      select: { userId: true },
    });
    if (!identity) {
      return NextResponse.json(
        { error: `Identity ${identityId} not found` },
        { status: 404 }
      );
    }
    if (identity.userId !== targetUserId) {
      return NextResponse.json(
        { error: `Identity does not belong to user ${targetUserId}` },
        { status: 400 }
      );
    }

    // Prevent duplicate pending
    const existing = await prisma.consentRequest.findFirst({
      where: {
        identityId,
        targetUserId,
        requestingUserId: requesterUserId,
        status: ConsentRequestStatus.PENDING,
        ...(isAppFlow ? { appId: useAppId } : {}),
      },
      select: { id: true },
    });
    if (existing) {
      return NextResponse.json(
        {
          error: 'A pending consent request already exists',
          requestId: existing.id,
        },
        { status: 409 }
      );
    }

    // Create request
    const newRequest = await prisma.consentRequest.create({
      data: {
        identityId,
        targetUserId,
        requestingUserId: requesterUserId,
        requestedScopes,
        contextDescription,
        status: ConsentRequestStatus.PENDING,
        ...(isAppFlow ? { appId: useAppId! } : {}),
      },
    });

    return NextResponse.json(newRequest, { status: 201 });
  } catch (err) {
    console.error('Error creating consent request:', err);
    if (err instanceof PrismaClientKnownRequestError) {
      return NextResponse.json(
        { error: 'Database error', details: err.message },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
