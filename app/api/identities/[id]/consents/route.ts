// app/api/identities/[id]/consents/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import prisma from "@/lib/prisma";

/* ────────── GET /api/identities/[id]/consents ────────── */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: identityId } = await params;

  const token = await getToken({ req: request });
  if (!token?.sub) {
    return NextResponse.json(
      { message: "Authentication required" },
      { status: 401 }
    );
  }

  const identity = await prisma.identity.findUnique({
    where: { id: identityId },
  });
  if (!identity || identity.userId !== token.sub) {
    return NextResponse.json(
      { message: "Identity not found or access denied" },
      { status: 404 }
    );
  }

  const connectableApps = await prisma.app.findMany({
    where: { isSystemApp: false, isAdminApproved: true, isEnabled: true },
    select: { id: true, name: true, description: true, logoUrl: true },
  });

  const activeConsents = await prisma.consent.findMany({
    where: { identityId, revokedAt: null },
    include: {
      app: {
        select: { id: true, name: true, description: true, logoUrl: true },
      },
    },
  });

  const grantedMap = new Map<string, unknown>();
  activeConsents.forEach((c) =>
    grantedMap.set(c.appId, {
      ...c.app,
      consentId: c.id,
      grantedScopes: c.grantedScopes,
      grantedAt: c.grantedAt,
    })
  );

  return NextResponse.json({
    grantedApps: Array.from(grantedMap.values()),
    availableApps: connectableApps.filter((a) => !grantedMap.has(a.id)),
  });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: identityId } = await params;

  /* ---------- Auth & ownership ---------- */
  const token = await getToken({ req: request });
  if (!token?.sub)
    return NextResponse.json(
      { message: "Authentication required" },
      { status: 401 }
    );

  const identity = await prisma.identity.findUnique({
    where: { id: identityId },
  });
  if (!identity || identity.userId !== token.sub)
    return NextResponse.json(
      { message: "Identity not found or access denied" },
      { status: 404 }
    );

  /* ---------- Payload ---------- */
  let body: { appId?: string; grantedScopes?: string[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: "Invalid JSON body" }, { status: 400 });
  }
  const { appId, grantedScopes = [] } = body;
  if (!appId)
    return NextResponse.json({ message: "appId required" }, { status: 400 });

  /* ---------- App whitelist ---------- */
  const app = await prisma.app.findFirst({
    where: {
      id: appId,
      isSystemApp: false,
      isAdminApproved: true,
      isEnabled: true,
    },
    select: { id: true, name: true, description: true, logoUrl: true },
  });
  if (!app)
    return NextResponse.json(
      { message: "App not available for consent" },
      { status: 400 }
    );

  /* ---------- Up-sert logic ---------- */
  const existing = await prisma.consent.findFirst({
    where: { userId: token.sub, appId, identityId },
  });

  let consent;
  if (existing) {
    // Row exists – revive or update it
    consent = await prisma.consent.update({
      where: { id: existing.id },
      data: {
        revokedAt: null, // clear revocation
        grantedScopes,
        grantedAt: new Date(),
      },
    });
  } else {
    // No row yet – create new
    consent = await prisma.consent.create({
      data: {
        userId: token.sub,
        identityId,
        appId,
        grantedScopes,
        grantedAt: new Date(),
      },
    });
  }

  return NextResponse.json(
    {
      ...app,
      consentId: consent.id,
      grantedScopes: consent.grantedScopes,
      grantedAt: consent.grantedAt,
    },
    { status: existing ? 200 : 201 }
  );
}
