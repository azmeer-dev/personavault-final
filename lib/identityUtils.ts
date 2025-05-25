import { Identity } from "@prisma/client"

type ContextualNameDetails = {
  preferredName?: string | null
  usageContext?: string | null
}
type IdentityContact = Record<string, string>
type AdditionalAttribute = Record<string, string>

interface FullIdentity extends Omit<Identity,
  "contextualNameDetails" | "identityContacts" | "websiteUrls" | "additionalAttributes"
> {
  contextualNameDetails: ContextualNameDetails
  identityContacts: IdentityContact
  websiteUrls: string[]
  additionalAttributes: AdditionalAttribute
}


export function filterIdentityByScopes(
  identity: FullIdentity,
  grantedScopes: string[]
): Partial<FullIdentity> {
  const result: Partial<FullIdentity> = {
    id: identity.id,
    visibility: identity.visibility,
    userId: identity.userId,
  };

  const scopeMap: Record<string, (keyof FullIdentity)[]> = {
    "profile:label": ["identityLabel", "profilePictureUrl"],
    "profile:description": ["description"],
    "profile:category": ["category", "customCategoryName"],
    "profile:name_details": ["contextualNameDetails"],
    "profile:contact_details": ["identityContacts", "websiteUrls"],
    "profile:personal_info": ["genderIdentity", "pronouns", "dateOfBirth", "location"],
    "profile:additional_attributes": ["additionalAttributes"],
  };

  if (grantedScopes.some(scope => scope.startsWith("profile:"))) {
    result.identityLabel = identity.identityLabel;
    result.profilePictureUrl = identity.profilePictureUrl;
  }

  for (const scope of grantedScopes) {
    const fields = scopeMap[scope];
    if (fields) {
      for (const field of fields) {
        const value = identity[field];
        if (value !== undefined) {
          (result as Record<string, unknown>)[field as string] = value;
        }
      }
    }
  }

  return result;
}
