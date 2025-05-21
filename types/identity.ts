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
