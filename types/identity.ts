import { Identity } from "@prisma/client";

export type PublicIdentity = Pick<
  Identity,
  | "id"
  | "identityLabel"
  | "profilePictureUrl"
  | "description"
  | "category"
  | "customCategoryName"
  | "genderIdentity"
  | "pronouns"
  | "location"
  | "dateOfBirth"
  | "visibility"
> & {
  contextualNameDetails: {
    preferredName: string;
    usageContext: string;
  };
  websiteUrls: string[];
  linkedAccountIds?: string[];
};

export type PrivateIdentityStub = {
  id: string;
  visibility: "PRIVATE" | "APP_SPECIFIC"; // Assuming IdentityVisibility.PRIVATE and IdentityVisibility.APP_SPECIFIC are string literals
  category: string; // Assuming IdentityCategoryType is a string literal like the enum values
  customCategoryName: string | null;
  identityLabel: "Private Identity" | "Restricted Identity";
  profilePictureUrl: string | null;
};
