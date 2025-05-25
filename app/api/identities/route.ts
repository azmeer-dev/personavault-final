import { NextResponse, NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
import prisma from "@/lib/prisma";
import {
  Identity,
  IdentityCategoryType,
  IdentityVisibility,
  IdentityContact,
  AdditionalAttribute,
  ContextualNameDetails, // Assuming this type is available from Prisma or custom types
  WebsiteUrl, // Assuming this type is available from Prisma or custom types
} from "@prisma/client";
import { PublicIdentity, PrivateIdentityStub } from "@/types/identity";
import { filterIdentityByScopes } from "@/lib/identityUtils"; // Import the new utility

// Define FullIdentity interface matching the structure used in filterIdentityByScopes
// This should align with your Prisma model including relations
interface FullIdentityPrisma extends Identity {
  contextualNameDetails?: ContextualNameDetails | null;
  identityContacts: IdentityContact[];
  websiteUrls: WebsiteUrl[];
  additionalAttributes: AdditionalAttribute[];
  // linkedExternalAccounts might also be relevant
}


export async function GET(req: NextRequest) {
  try {
    const token = await getToken({ req });
    if (!token || !token.sub) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const requesterUserId = token.sub;

    const { searchParams } = new URL(req.url);
    const targetUserIdParam = searchParams.get("userId");
    const targetUserId = targetUserIdParam || requesterUserId;

    // Attempt to get requestingAppId from header (example)
    const requestingAppId = req.headers.get("X-App-ID") || undefined;


    const identities = await prisma.identity.findMany({
      where: { userId: targetUserId },
      include: {
        // Include all relations needed for FullIdentityPrisma and filterIdentityByScopes
        contextualNameDetails: true,
        identityContacts: true,
        websiteUrls: true,
        additionalAttributes: true,
        // linkedExternalAccounts: true, // if needed
      },
    }) as FullIdentityPrisma[]; // Cast to ensure all fields are available for filterIdentityByScopes

    if (requesterUserId === targetUserId) {
      // User viewing their own identities, return full objects
      return NextResponse.json(identities);
    } else {
      // User viewing another's identities, fetch consents for this target user
      const consents = await prisma.consent.findMany({
        where: {
          userId: targetUserId, // Consents granted by the target user
          revokedAt: null,
          // Add expiresAt logic if applicable:
          // OR: [ { expiresAt: null }, { expiresAt: { gt: new Date() } } ],
          status: "ACTIVE", // Assuming 'ACTIVE' means approved and not expired/revoked
        },
      });
      
      // Create a lookup for consents by identityId and appId
      const consentLookup = new Map<string, Map<string, typeof consents[0]>>();
      for (const consent of consents) {
        if (!consent.appId) continue; // Skip consents not tied to an app if requestingAppId logic is strict
        if (!consentLookup.has(consent.identityId)) {
          consentLookup.set(consent.identityId, new Map());
        }
        consentLookup.get(consent.identityId)!.set(consent.appId, consent);
      }

      const transformedIdentities = identities
        .map((identity): PublicIdentity | PrivateIdentityStub | Partial<FullIdentityPrisma> | null => {
          let relevantConsent = null;
          if (requestingAppId && identity.id) {
            relevantConsent = consentLookup.get(identity.id)?.get(requestingAppId);
          }
          
          if (relevantConsent && (identity.visibility === IdentityVisibility.PRIVATE || identity.visibility === IdentityVisibility.APP_SPECIFIC)) {
            // Valid consent found for this app, filter and return
            // The filterIdentityByScopes function expects a FullIdentity, ensure `identity` matches
            return filterIdentityByScopes(identity, relevantConsent.grantedScopes);
          } else {
            // No specific consent for this app, or identity is public
            switch (identity.visibility) {
              case IdentityVisibility.PUBLIC:
              case IdentityVisibility.AUTHENTICATED_USERS:
                return {
                  id: identity.id,
                  identityLabel: identity.identityLabel,
                  profilePictureUrl: identity.profilePictureUrl,
                  description: identity.description,
                  category: identity.category,
                  customCategoryName: identity.customCategoryName,
                  genderIdentity: identity.genderIdentity,
                  pronouns: identity.pronouns,
                  location: identity.location,
                  dateOfBirth: identity.dateOfBirth,
                  visibility: identity.visibility,
                  contextualNameDetails: identity.contextualNameDetails ? {
                    preferredName: identity.contextualNameDetails.preferredName || "",
                    usageContext: identity.contextualNameDetails.usageContext || "",
                  } : { preferredName: "", usageContext: "" },
                  websiteUrls: identity.websiteUrls.map((wu) => wu.url),
                  linkedAccountIds: undefined, // Or implement fetching if needed
                };
              case IdentityVisibility.PRIVATE:
                return {
                  id: identity.id,
                  visibility: IdentityVisibility.PRIVATE,
                  category: identity.category,
                  customCategoryName: identity.category === IdentityCategoryType.CUSTOM ? identity.customCategoryName : null,
                  identityLabel: "Private Identity",
                  profilePictureUrl: "/img/private-icon.svg",
                };
              case IdentityVisibility.APP_SPECIFIC:
                 // For APP_SPECIFIC, if no consent for *this specific app*, return stub.
                 // If there was consent, it would have been handled by filterIdentityByScopes.
                return {
                  id: identity.id,
                  visibility: IdentityVisibility.APP_SPECIFIC,
                  category: identity.category,
                  customCategoryName: identity.category === IdentityCategoryType.CUSTOM ? identity.customCategoryName : null,
                  identityLabel: "Restricted Identity",
                  profilePictureUrl: "/img/restricted-icon.svg",
                };
              default:
                return null;
            }
          }
        })
        .filter(Boolean); // Filter out any nulls

      return NextResponse.json(transformedIdentities);
    }
  } catch (error) {
    console.error("Error fetching identities:", error);
    // It's good practice to avoid sending detailed error messages to the client in production
    const errorMessage = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: "Internal server error", details: errorMessage }, { status: 500 });
  }
}
