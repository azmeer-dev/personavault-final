import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import prisma from '@/lib/prisma';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { createAuditLog } from '@/lib/audit'; // Added
import { AuditActorType, AuditLogOutcome } from '@prisma/client'; // Added

const SECRET = process.env.NEXTAUTH_SECRET;

export async function POST(
  req: NextRequest,
  { params }: { params: { appId: string } }
) {
  try {
    // Authenticated user session
    const token = await getToken({ req, secret: SECRET });
    if (!token || !token.sub) {
      // No audit log here as we don't have a userId or appId yet
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const userId = token.sub; // Extracted userId for logging

    const { appId } = params;

    // Fetch App from the database
    const app = await prisma.app.findUnique({
      where: { id: appId },
    });

    if (!app) {
      await createAuditLog({
        actorType: AuditActorType.USER, actorUserId: userId, action: "GENERATE_API_KEY_FAILURE",
        targetEntityType: "App", targetEntityId: appId, outcome: AuditLogOutcome.FAILURE,
        details: { error: "App not found" }
      });
      return NextResponse.json({ error: 'App not found' }, { status: 404 });
    }

    // Verify that the authenticated user is the owner of the App
    if (app.ownerId !== userId) { // Used extracted userId
      await createAuditLog({
        actorType: AuditActorType.USER, actorUserId: userId, action: "GENERATE_API_KEY_FAILURE",
        targetEntityType: "App", targetEntityId: appId, outcome: AuditLogOutcome.FAILURE,
        details: { error: "User not owner of app", appName: app.name, actualOwner: app.ownerId }
      });
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
    await createAuditLog({
        actorType: AuditActorType.USER, actorUserId: userId, action: "GENERATE_API_KEY",
        targetEntityType: "App", targetEntityId: appId, outcome: AuditLogOutcome.SUCCESS,
        details: { appName: app.name }
    });
    return NextResponse.json({ apiKey });

  } catch (error: any) { // Typed error for better property access
    const auditActorUserId = token?.sub; // Use token.sub directly as userId might not be set if error is early
    const appNameFromFetchedApp = (typeof app !== 'undefined' && app) ? app.name : undefined; // Safely access app name

    console.error(`[POST /api/apps/${params.appId}/keys] Error generating API key for app ${params.appId} by user ${auditActorUserId || 'unknown'}:`, error);
    if (auditActorUserId) { // Only log if we have a user
        await createAuditLog({
            actorType: AuditActorType.USER, actorUserId: auditActorUserId, action: "GENERATE_API_KEY_FAILURE",
            targetEntityType: "App", targetEntityId: params.appId, outcome: AuditLogOutcome.FAILURE,
            details: { error: error.message || "Internal Server Error", appName: appNameFromFetchedApp, code: error.code }
        });
    }
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
