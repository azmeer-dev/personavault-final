import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import bcrypt from 'bcrypt';
import { App } from '@prisma/client';

export async function authenticateApp(req: NextRequest): Promise<{ app?: App; error?: NextResponse }> {
  console.log('[AuthApp] Attempting API key authentication...');

  const authHeader = req.headers.get('Authorization');
  const appIdHeader = req.headers.get('X-App-ID');

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    console.warn('[AuthApp] Authorization header missing or malformed.');
    return { 
      error: NextResponse.json({ message: 'Unauthorized: Missing or malformed API key. Expecting Bearer token.' }, { status: 401 }) 
    };
  }
  const apiKey = authHeader.substring(7); // Remove "Bearer "

  if (!appIdHeader) {
    console.warn('[AuthApp] X-App-ID header missing.');
    return { 
      error: NextResponse.json({ message: 'Unauthorized: Missing App ID header (X-App-ID).' }, { status: 401 }) 
    };
  }

  console.log(`[AuthApp] Attempting authentication for App ID: ${appIdHeader}`);

  try {
    const app = await prisma.app.findUnique({
      where: { id: appIdHeader },
    });

    if (!app) {
      console.warn(`[AuthApp] App not found for ID: ${appIdHeader}`);
      // Generic message to avoid leaking information about valid App IDs
      return { 
        error: NextResponse.json({ message: 'Forbidden: Invalid App ID or API Key.' }, { status: 403 }) 
      };
    }

    if (!app.apiKeyHash) {
      console.warn(`[AuthApp] API key not configured for App ID: ${app.id}. apiKeyHash is null.`);
      return { 
        error: NextResponse.json({ message: 'Forbidden: API Key not configured for this App.' }, { status: 403 }) 
      };
    }
    
    if (!app.isEnabled) {
      console.warn(`[AuthApp] App ID: ${app.id} is disabled.`);
      return { 
        error: NextResponse.json({ message: 'Forbidden: App is disabled.' }, { status: 403 }) 
      };
    }

    // bcrypt.compare handles the salt internally as it's part of the app.apiKeyHash string
    const isValid = await bcrypt.compare(apiKey, app.apiKeyHash);

    if (!isValid) {
      console.warn(`[AuthApp] Invalid API Key provided for App ID: ${app.id}`);
      return { 
        error: NextResponse.json({ message: 'Forbidden: Invalid App ID or API Key.' }, { status: 403 }) 
      };
    }

    console.log(`[AuthApp] API Key validated successfully for App ID: ${app.id}`);
    return { app };
  } catch (e) {
    console.error('[AuthApp] Error during app authentication:', e);
    // Log the specific error on the server, but return a generic message to the client
    return { 
      error: NextResponse.json({ message: 'Internal Server Error during authentication process.' }, { status: 500 }) 
    };
  }
}
