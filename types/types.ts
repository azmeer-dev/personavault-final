export const identityCategoryOptions = [
  "PERSONAL",
  "PROFESSIONAL",
  "ACADEMIC",
  "FAMILY",
  "SOCIAL_MEDIA",
  "MESSAGING_PLATFORM",
  "GAMING",
  "CREATIVE_ENDEAVOR",
  "HEALTH_WELLNESS",
  "TRAVEL_ADVENTURE",
  "LEGAL_ADMINISTRATIVE",
  "FINANCIAL_TRANSACTIONS",
  "E_COMMERCE_SHOPPING",
  "GOVERNMENT_SERVICES",
  "UTILITY_SERVICES",
  "IOT_DEVICE",
  "DEVELOPMENT_CODING",
  "COMMUNITY_FORUM",
  "ANONYMOUS_PSEUDONYMOUS",
  "CUSTOM",
] as const;
export type IdentityCategoryType = typeof identityCategoryOptions[number];

export const identityVisibilityOptions = ["PRIVATE", "PUBLIC"] as const;
export type IdentityVisibility = typeof identityVisibilityOptions[number];

export interface IdentityFormValues {
  identityLabel: string;
  category: IdentityCategoryType;
  customCategoryName?: string;
  description?: string;
  contextualNameDetails: {
    preferredName: string;
    usageContext: string;
  };
  contextualReligiousNames: string[];
  genderIdentity?: string;
  customGenderDescription?: string;
  pronouns?: string;
  dateOfBirth?: string;
  location?: string;
  profilePictureUrl?: string;
  identityContacts: Record<string, string>;
  onlinePresence: Record<string, string>;
  websiteUrls: string[];
  additionalAttributes: Record<string, string>;
  visibility: IdentityVisibility;
  linkedAccountIds: string[];
  identityNameHistory: { name: string; from: string; to: string; context: string }[];
};
