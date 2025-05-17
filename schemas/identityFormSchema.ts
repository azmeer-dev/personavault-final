import { z } from "zod";
import { identityCategoryOptions, identityVisibilityOptions } from "@/types/types";

export const identityFormSchema = z.object({
  identityLabel: z.string(),
  category: z.enum(identityCategoryOptions),
  customCategoryName: z.string().optional(),
  description: z.string().optional(),
  contextualNameDetails: z.object({
    preferredName: z.string(),
    usageContext: z.string(),
  }),
  identityNameHistory: z.array(z.object({
    name: z.string(),
    from: z.string(),
    to: z.string(),
    context: z.string(),
  })),
  contextualReligiousNames: z.array(z.string()),
  genderIdentity: z.string().optional(),
  customGenderDescription: z.string().optional(),
  pronouns: z.string().optional(),
  dateOfBirth: z.string().optional(),
  location: z.string().optional(),
  profilePictureUrl: z.string().optional(),
  identityContacts: z.record(z.string()),
  onlinePresence: z.record(z.string()),
  websiteUrls: z.array(z.string()),
  additionalAttributes: z.record(z.string()),
  visibility: z.enum(identityVisibilityOptions),
  linkedAccountIds: z.array(z.string()),
});
