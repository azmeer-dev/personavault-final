import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import bcrypt from "bcrypt";
import { App } from "@prisma/client";
import { createAuditLog } from "@/lib/audit"; // Adjusted path
import { AuditActorType, AuditLogOutcome } from "@prisma/client";

export async function authenticateApp(
  req: NextRequest
): Promise<{ app?: App; error?: NextResponse }> {
  console.log("[AuthApp] Attempting API key authentication...");
  const requestPath = req.nextUrl.pathname; // For audit details

  const authHeader = req.headers.get("Authorization");
  const appIdHeader = req.headers.get("X-App-ID");

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    const reason =
      "Missing or malformed Authorization header. Expecting Bearer token.";
    console.warn(`[AuthApp] ${reason}`);
    await createAuditLog({
      actorType: AuditActorType.SYSTEM,
      action: "APP_API_KEY_LOGIN_FAILURE",
      outcome: AuditLogOutcome.FAILURE,
      details: { reason, requestPath, providedAppId: appIdHeader }, // appIdHeader might be null here
    });
    return {
      error: NextResponse.json(
        { message: `Unauthorized: ${reason}` },
        { status: 401 }
      ),
    };
  }
  const apiKey = authHeader.substring(7); // Remove "Bearer "

  if (!appIdHeader) {
    const reason = "Missing X-App-ID header.";
    console.warn(`[AuthApp] ${reason}`);
    await createAuditLog({
      actorType: AuditActorType.SYSTEM,
      action: "APP_API_KEY_LOGIN_FAILURE",
      outcome: AuditLogOutcome.FAILURE,
      details: { reason, requestPath },
    });
    return {
      error: NextResponse.json(
        { message: `Unauthorized: ${reason}` },
        { status: 401 }
      ),
    };
  }

  console.log(`[AuthApp] Attempting authentication for App ID: ${appIdHeader}`);

  try {
    const app = await prisma.app.findUnique({
      where: { id: appIdHeader },
    });

    if (!app) {
      const reason = "Invalid App ID";
      console.warn(`[AuthApp] ${reason}: ${appIdHeader}`);
      await createAuditLog({
        actorType: AuditActorType.SYSTEM,
        actorAppId: appIdHeader, // Using provided (invalid) appId
        action: "APP_API_KEY_LOGIN_FAILURE",
        outcome: AuditLogOutcome.FAILURE,
        details: { reason, providedAppId: appIdHeader, requestPath },
      });
      return {
        error: NextResponse.json(
          { message: "Forbidden: Invalid App ID or API Key." },
          { status: 403 }
        ),
      };
    }

    if (!app.apiKeyHash) {
      const reason = "API key not configured";
      console.warn(`[AuthApp] ${reason} for App ID: ${app.id}.`);
      await createAuditLog({
        actorType: AuditActorType.APP,
        actorAppId: app.id,
        action: "APP_API_KEY_LOGIN_FAILURE",
        outcome: AuditLogOutcome.FAILURE,
        details: { reason, appName: app.name, requestPath },
      });
      return {
        error: NextResponse.json(
          { message: "Forbidden: API Key not configured for this App." },
          { status: 403 }
        ),
      };
    }

    if (!app.isEnabled) {
      const reason = "App disabled";
      console.warn(`[AuthApp] App ID: ${app.id} is disabled.`);
      await createAuditLog({
        actorType: AuditActorType.APP,
        actorAppId: app.id,
        action: "APP_API_KEY_LOGIN_FAILURE",
        outcome: AuditLogOutcome.FAILURE,
        details: { reason, appName: app.name, requestPath },
      });
      return {
        error: NextResponse.json(
          { message: "Forbidden: App is disabled." },
          { status: 403 }
        ),
      };
    }

    // bcrypt.compare handles the salt internally as it's part of the app.apiKeyHash string
    const isValid = await bcrypt.compare(apiKey, app.apiKeyHash);

    if (!isValid) {
      const reason = "Invalid API Key";
      console.warn(`[AuthApp] ${reason} provided for App ID: ${app.id}`);
      await createAuditLog({
        actorType: AuditActorType.APP,
        actorAppId: app.id,
        action: "APP_API_KEY_LOGIN_FAILURE",
        outcome: AuditLogOutcome.FAILURE,
        details: { reason, appName: app.name, requestPath },
      });
      return {
        error: NextResponse.json(
          { message: "Forbidden: Invalid App ID or API Key." },
          { status: 403 }
        ),
      };
    }

    console.log(
      `[AuthApp] API Key validated successfully for App ID: ${app.id}`
    );
    await createAuditLog({
      actorType: AuditActorType.APP,
      actorAppId: app.id,
      action: "APP_API_KEY_LOGIN_SUCCESS",
      targetEntityType: "App",
      targetEntityId: app.id,
      outcome: AuditLogOutcome.SUCCESS,
      details: { appName: app.name, requestPath },
    });
    return { app };
  } catch (err) {
    // Typed error
    console.error("[AuthApp] Error during app authentication:", err);
    // Log the specific error on the server, but return a generic message to the client
    // It's hard to attribute this to a specific app if 'app' object isn't resolved or if appIdHeader is problematic
    await createAuditLog({
      actorType: AuditActorType.SYSTEM,
      actorAppId: appIdHeader || undefined, // Use appIdHeader if available
      action: "APP_API_KEY_LOGIN_FAILURE",
      outcome: AuditLogOutcome.FAILURE,
      details: {
        reason: "Internal server error during authentication",
        error: err instanceof Error ? err.message : String(err),
        requestPath,
      },
    });
    return {
      error: NextResponse.json(
        { message: "Internal Server Error during authentication process." },
        { status: 500 }
      ),
    };
  }
}
