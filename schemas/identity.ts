// schemas/identity.ts
import { z } from "zod";

export const IdentitySchema = z
  .object({
    name: z.string().min(1, "Name is required"),
    category: z.string().min(1, "Category is required"),
    customCategory: z.string().optional(),
    description: z.string().optional(),
    previousNames: z.string().optional(),
    religiousNames: z.string().optional(),
    visibility: z.enum(["PUBLIC", "PRIVATE"]).default("PRIVATE"),
    connectedAccountIds: z.array(z.string()).optional().default([]),
    adHocAccounts: z
      .array(
        z.object({
          provider: z.string().min(1, "Provider is required"),
          info: z.string().min(1, "Account info is required"),
        })
      )
      .optional()
      .default([]),
  })
  .refine(
    (d) => d.category !== "Custom" || !!d.customCategory,
    { message: "Custom category is required", path: ["customCategory"] }
  );

export type IdentityFormData = z.infer<typeof IdentitySchema>;
