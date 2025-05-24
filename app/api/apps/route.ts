import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import prisma from "@/lib/prisma";
import { createAuditLog } from "@/lib/audit"; // Added
import { AuditActorType, AuditLogOutcome } from "@prisma/client"; // Added
// import { z } from 'zod'; // Zod not used for this basic implementation
import bcrypt from "bcrypt";
import crypto from "crypto";
import { PrismaClientKnownRequestError } from "@prisma/client/runtime/library";

async function generateApiKeyAndHash(): Promise<{
  apiKey: string;
  apiKeyHash: string;
}> {
  const apiKey = crypto.randomBytes(32).toString("hex"); // Secure random API key
  const apiKeyHash = await bcrypt.hash(apiKey, 10); // Hash with salt rounds = 10
  return { apiKey, apiKeyHash };
}

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

export async function POST(req: NextRequest) {
  console.log("[POST /api/apps] Received request to create new app");
  let token;
  let userId;
  let body;
  try {
    token = await getToken({ req, secret: SECRET });
    if (!token || !token.sub) {
      console.log("[POST /api/apps] Unauthorized: No token or token.sub");
      // No audit log here as we don't have a userId to associate with the attempt
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    userId = token.sub;
    console.log(`[POST /api/apps] Authenticated user: ${userId}`);

    body = await req.json();

    // Basic validation
    const validationErrorDetails = {
      providedName: body.name,
      providedRedirectUris: body.redirectUris,
      inputBody: body,
    }; // For audit

    if (
      !body.name ||
      typeof body.name !== "string" ||
      body.name.trim() === ""
    ) {
      const errorMsg = "Name is required.";
      console.log(`[POST /api/apps] Validation failed: ${errorMsg}`);
      await createAuditLog({
        actorType: AuditActorType.USER,
        actorUserId: userId,
        action: "CREATE_APP_VALIDATION_FAILURE",
        outcome: AuditLogOutcome.FAILURE,
        details: { ...validationErrorDetails, error: errorMsg },
      });
      return NextResponse.json({ error: errorMsg }, { status: 400 });
    }
    if (
      !Array.isArray(body.redirectUris) ||
      body.redirectUris.length === 0 ||
      body.redirectUris.some(
        (uri: string) =>
          typeof uri !== "string" || uri.trim() === "" || !isValidUrl(uri)
      )
    ) {
      const errorMsg = "redirectUris must be a non-empty array of valid URLs.";
      console.log(`[POST /api/apps] Validation failed: ${errorMsg}`);
      await createAuditLog({
        actorType: AuditActorType.USER,
        actorUserId: userId,
        action: "CREATE_APP_VALIDATION_FAILURE",
        outcome: AuditLogOutcome.FAILURE,
        details: { ...validationErrorDetails, error: errorMsg },
      });
      return NextResponse.json({ error: errorMsg }, { status: 400 });
    }

    // Optional URL validations
    const optionalFieldsToValidate: (keyof typeof body)[] = [
      "websiteUrl",
      "logoUrl",
      "privacyPolicyUrl",
      "termsOfServiceUrl",
    ];
    for (const field of optionalFieldsToValidate) {
      if (
        body[field] !== undefined &&
        body[field] !== null &&
        body[field] !== "" &&
        !isValidUrl(body[field])
      ) {
        const errorMsg = `Invalid ${String(field)} format.`;
        console.log(`[POST /api/apps] Validation failed: ${errorMsg}`);
        await createAuditLog({
          actorType: AuditActorType.USER,
          actorUserId: userId,
          action: "CREATE_APP_VALIDATION_FAILURE",
          outcome: AuditLogOutcome.FAILURE,
          details: {
            ...validationErrorDetails,
            error: errorMsg,
            field: String(field),
          },
        });
        return NextResponse.json({ error: errorMsg }, { status: 400 });
      }
    }

    console.log(
      `[POST /api/apps] Validation passed for app name: ${body.name}`
    );

    const { apiKeyHash } = await generateApiKeyAndHash();

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
        apiKeyHash: apiKeyHash,
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
        updatedAt: true, // Added as per example
        ownerId: true, // To confirm ownership
      },
    });

    console.log(
      `[POST /api/apps] App created successfully with ID: ${newApp.id} for user ${userId}`
    );

    await createAuditLog({
      actorType: AuditActorType.USER,
      actorUserId: userId,
      action: "CREATE_APP",
      targetEntityType: "App",
      targetEntityId: newApp.id,
      outcome: AuditLogOutcome.SUCCESS,
      details: {
        name: newApp.name,
        redirectUris: newApp.redirectUris,
        websiteUrl: newApp.websiteUrl,
      },
    });

    console.log(
      `[POST /api/apps] Returning created app. Keys: ${Object.keys(newApp).join(
        ", "
      )}`
    );
    // Reminder: In a real development environment, after modifying `prisma/schema.prisma`,
    // you would need to run `npx prisma generate` to update the Prisma Client and
    // `npx prisma migrate dev --name make_app_apikey_optional` (or similar) to create a new database migration.
    return NextResponse.json(newApp, { status: 201 });
  } catch (error) {
    if (error instanceof PrismaClientKnownRequestError) {
      // Use userId from outer scope if available, otherwise token.sub (which might be null if token itself is null)
      const auditActorUserId = userId || token?.sub;
      console.error(
        `[POST /api/apps] Failed to create app for user ${
          auditActorUserId || "unknown"
        }:`,
        error
      );

      if (
        error.code === "P2002" &&
        typeof error.meta === "object" &&
        error.meta !== null &&
        "target" in error.meta &&
        Array.isArray((error.meta as { target: unknown }).target) &&
        (error.meta as { target: string[] }).target.includes("name")
      ) {
        const errorMsg = "App name already taken";
        console.log(`[POST /api/apps] Conflict: ${errorMsg}`);
        if (auditActorUserId) {
          // Only log if we have a user to attribute it to
          await createAuditLog({
            actorType: AuditActorType.USER,
            actorUserId: auditActorUserId,
            action: "CREATE_APP_DB_FAILURE",
            targetEntityType: "App",
            outcome: AuditLogOutcome.FAILURE,
            details: {
              error: errorMsg,
              code: error.code,
              providedName: body?.name,
              inputBody: body,
            },
          });
        }
        return NextResponse.json({ error: errorMsg }, { status: 409 });
      }

      // Generic database or other error
      if (auditActorUserId) {
        // Only log if we have a user to attribute it to
        await createAuditLog({
          actorType: AuditActorType.USER,
          actorUserId: auditActorUserId,
          action: "CREATE_APP_DB_FAILURE",
          targetEntityType: "App",
          outcome: AuditLogOutcome.FAILURE,
          details: {
            error: error.message || "Unknown database error",
            code: error.code || "UNKNOWN_DB_ERROR",
            inputBody: body,
          },
        });
      }
      return NextResponse.json(
        { error: "Internal Server Error" },
        { status: 500 }
      );
    }
  }
}
