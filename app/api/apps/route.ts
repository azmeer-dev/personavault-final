import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import prisma from "@/lib/prisma";
// import { z } from 'zod'; // Zod not used for this basic implementation
import bcrypt from "bcrypt";
import crypto from "crypto";

const SECRET = process.env.NEXTAUTH_SECRET;

// Basic URL validation helper (very simple)
function isValidUrl(urlString?: string | null): boolean {
  if (!urlString) return true; // Optional fields are valid if empty
  try {
    new URL(urlString);
    return true;
  } catch {
    return false;
  }
}

async function generateApiKeyAndHash(): Promise<{
  apiKey: string;
  apiKeyHash: string;
}> {
  const apiKey = crypto.randomBytes(32).toString("hex"); // Secure random API key
  const apiKeyHash = await bcrypt.hash(apiKey, 10); // Hash with salt rounds = 10
  return { apiKey, apiKeyHash };
}

export async function POST(req: NextRequest) {
  console.log("[POST /api/apps] Received request to create new app");

  let token;

  try {
    token = await getToken({ req, secret: SECRET });
    if (!token || !token.sub) {
      console.log("[POST /api/apps] Unauthorized: No token or token.sub");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userId = token.sub;
    console.log(`[POST /api/apps] Authenticated user: ${userId}`);

    const body: {
      name: string;
      description?: string;
      websiteUrl?: string;
      logoUrl?: string;
      redirectUris: string[];
      privacyPolicyUrl?: string;
      termsOfServiceUrl?: string;
    } = await req.json();

    // Basic validation
    if (
      !body.name ||
      typeof body.name !== "string" ||
      body.name.trim() === ""
    ) {
      console.log("[POST /api/apps] Validation failed: Name is required.");
      return NextResponse.json({ error: "Name is required." }, { status: 400 });
    }
    if (
      !Array.isArray(body.redirectUris) ||
      body.redirectUris.length === 0 ||
      body.redirectUris.some(
        (uri) => typeof uri !== "string" || !isValidUrl(uri)
      )
    ) {
      console.log(
        "[POST /api/apps] Validation failed: redirectUris must be a non-empty array of valid URLs."
      );
      return NextResponse.json(
        { error: "redirectUris must be a non-empty array of valid URLs." },
        { status: 400 }
      );
    }

    // Optional URL validations
    if (!isValidUrl(body.websiteUrl)) {
      return NextResponse.json(
        { error: "Invalid websiteUrl format." },
        { status: 400 }
      );
    }
    if (!isValidUrl(body.logoUrl)) {
      return NextResponse.json(
        { error: "Invalid logoUrl format." },
        { status: 400 }
      );
    }
    if (!isValidUrl(body.privacyPolicyUrl)) {
      return NextResponse.json(
        { error: "Invalid privacyPolicyUrl format." },
        { status: 400 }
      );
    }
    if (!isValidUrl(body.termsOfServiceUrl)) {
      return NextResponse.json(
        { error: "Invalid termsOfServiceUrl format." },
        { status: 400 }
      );
    }

    console.log(
      `[POST /api/apps] Validation passed for app name: ${body.name}`
    );

    const { apiKey, apiKeyHash } = await generateApiKeyAndHash();

    const newApp = await prisma.app.create({
      data: {
        ownerId: userId,
        name: body.name,
        description: body.description || null,
        websiteUrl: body.websiteUrl || null,
        logoUrl: body.logoUrl || null,
        redirectUris: body.redirectUris,
        privacyPolicyUrl: body.privacyPolicyUrl || null,
        termsOfServiceUrl: body.termsOfServiceUrl || null,
        apiKeyHash,
        apiKeySalt: "",
      },
      select: {
        // Select the fields to return, excluding sensitive ones by default
        id: true,
        name: true,
        description: true,
        websiteUrl: true,
        logoUrl: true,
        redirectUris: true,
        privacyPolicyUrl: true,
        termsOfServiceUrl: true,
        isEnabled: true,
        createdAt: true,
        ownerId: true, // To confirm ownership
      },
    });

    console.log(
      `[POST /api/apps] App created successfully with ID: ${newApp.id} for user ${userId}`
    );
    // Reminder: In a real development environment, after modifying `prisma/schema.prisma`,
    // you would need to run `npx prisma generate` to update the Prisma Client and
    // `npx prisma migrate dev --name make_app_apikey_optional` (or similar) to create a new database migration.
    return NextResponse.json({ ...newApp, apiKey }, { status: 201 });
  } catch (err: unknown) {
    console.error(
      `[POST /api/apps] Failed to create app for user ${
        token?.sub || "unknown"
      }:`,
      err
    );

    if (
      typeof err === "object" &&
      err !== null &&
      "code" in err &&
      "meta" in err &&
      (err as { code: string }).code === "P2002" &&
      Array.isArray((err as { meta: { target?: string[] } }).meta?.target) &&
      (err as { meta: { target?: string[] } }).meta.target?.includes("name")
    ) {
      console.log("[POST /api/apps] Conflict: App name already taken.");
      return NextResponse.json(
        { error: "App name already taken" },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
