import { z } from "zod";
import { identityCategoryOptions, identityVisibilityOptions } from "@/types/types";

export const identityFormSchema = z.object({
  identityLabel: z.string().min(1, "Identity label is required"),
  category: z.enum(identityCategoryOptions, {
    required_error: "Category is required",
  }),
  customCategoryName: z.string().optional(),
  description: z.string().optional(),

  contextualNameDetails: z.object({
    preferredName: z.string().min(1, "Preferred name is required"),
    usageContext: z.string().min(1, "Usage context is required"),
  }),

  identityNameHistory: z.array(
    z.object({
      name: z.string().min(1, "Name is required"),
      from: z.string().min(1, "From date is required"),
      to: z.string().min(1, "To date is required"),
      context: z.string().min(1, "Context is required"),
    })
  ).optional(),

  contextualReligiousNames: z.array(z.string()).optional(),
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

  visibility: z.enum(identityVisibilityOptions, {
    required_error: "Visibility is required",
  }),

  linkedAccountIds: z.array(z.string()),
});
