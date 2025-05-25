import { Identity, IdentityContact, AdditionalAttribute } from "@prisma/client";

// Re-defining related types if they are not directly exported or to ensure structure
// These should ideally match what Prisma generates or what's defined in your actual types
type ContextualNameDetails = {
  preferredName?: string | null;
  usageContext?: string | null;
};

type WebsiteUrl = {
  id: string;
  url: string;
  label?: string | null;
  identityId: string;
};

// Define a more complete Identity type for the input, matching Prisma's structure
// This is a placeholder; you'd import the actual Prisma.Identity type
interface FullIdentity extends Identity {
  contextualNameDetails?: ContextualNameDetails | null;
  identityContacts: IdentityContact[];
  websiteUrls: WebsiteUrl[];
  additionalAttributes: AdditionalAttribute[];
  // linkedExternalAccounts might also be relevant for some scopes if you have them
}


export function filterIdentityByScopes(
  identity: FullIdentity,
  grantedScopes: string[]
): Partial<FullIdentity> {
  const result: Partial<FullIdentity> = {
    id: identity.id,
    visibility: identity.visibility,
    // userId is also fundamental and should probably always be included
    userId: identity.userId,
  };

  const scopeMap: Record<string, (keyof FullIdentity)[]> = {
    "profile:label": ["identityLabel", "profilePictureUrl"],
    "profile:description": ["description"],
    "profile:category": ["category", "customCategoryName"],
    "profile:name_details": ["contextualNameDetails"], // Assuming contextualNameDetails is a field
    "profile:contact_details": ["identityContacts", "websiteUrls"],
    "profile:personal_info": ["genderIdentity", "pronouns", "dateOfBirth", "location"],
    "profile:additional_attributes": ["additionalAttributes"],
    // Add more scopes as needed, for example:
    // "profile:full": [
    //   "identityLabel", "profilePictureUrl", "description", "category", "customCategoryName",
    //   "contextualNameDetails", "identityContacts", "websiteUrls", "genderIdentity",
    //   "pronouns", "dateOfBirth", "location", "additionalAttributes"
    // ],
  };

  // Always include basic identifying information if any profile scope is granted
  if (grantedScopes.some(scope => scope.startsWith("profile:"))) {
    if(!result.identityLabel) result.identityLabel = identity.identityLabel;
    if(!result.profilePictureUrl) result.profilePictureUrl = identity.profilePictureUrl;
  }

  for (const scope of grantedScopes) {
    const fields = scopeMap[scope];
    if (fields) {
      for (const field of fields) {
        // Type assertion needed here because field is a string, but result expects specific keys
        (result as any)[field] = identity[field];
      }
    }
  }
  
  // Ensure complex objects are fully included or specifically handled if needed
  // For example, if identityContacts or websiteUrls are included, they should be the full arrays.
  // The current logic handles this correctly by assigning the whole field.

  return result;
}
