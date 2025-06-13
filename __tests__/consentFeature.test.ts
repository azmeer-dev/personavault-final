import { filterIdentityByScopes } from "../lib/identityUtils";
import { POST as approveConsentRequest } from "../app/api/consent-requests/[requestId]/approve/route";
import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { identityCategoryOptions, identityVisibilityOptions } from '../types/types';
jest.mock("next-auth/jwt", () => ({
  getToken: jest.fn(() => Promise.resolve({ sub: "user1" })),
}));

jest.mock("../lib/prisma", () => ({
  __esModule: true,
  default: {
    consentRequest: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    consent: {
      upsert: jest.fn(),
    },
  },
}));

jest.mock("../lib/audit", () => ({
  createAuditLog: jest.fn(),
}));

/** Utility to build a NextRequest with JSON body */
function buildJsonRequest(url: string, body: unknown): NextRequest {
  return new NextRequest(
    new Request(url, { method: "POST", body: JSON.stringify(body) })
  );
}

describe("filterIdentityByScopes", () => {
  const fullIdentity = {
    id: "id1",
    userId: "user1",
    visibility: identityVisibilityOptions[1],
    identityLabel: "Test Identity",
    category: identityCategoryOptions[0],
    customCategoryName: null,
    description: "desc",
    contextualNameDetails: { preferredName: "Alice", usageContext: "online" },
    identityContacts: { email: "alice@example.com" },
    websiteUrls: ["https://example.com"],
    genderIdentity: "non-binary",
    pronouns: "they/them",
    dateOfBirth: new Date("1990-01-01"),
    location: "Earth",
    profilePictureUrl: "https://example.com/pic.jpg",
    additionalAttributes: { note: "extra" },
    identityNameHistory: [],
    contextualReligiousNames: [],
    customGenderDescription: null,
    onlinePresence: [],
    preferredPronouns: null,
    createdAt: new Date("2023-01-01T00:00:00.000Z"),
    updatedAt: new Date("2023-06-01T00:00:00.000Z"),
  };

  it("includes fields for granted scopes", () => {
    const filtered = filterIdentityByScopes(fullIdentity, [
      "profile:label",
      "profile:personal_info",
    ]);
    expect(filtered.identityLabel).toBe("Test Identity");
    expect(filtered.profilePictureUrl).toBe("https://example.com/pic.jpg");
    expect(filtered.genderIdentity).toBe("non-binary");
    expect(filtered.location).toBe("Earth");
  });

  it("excludes fields without scopes", () => {
    const filtered = filterIdentityByScopes(fullIdentity, []);
    expect(filtered.identityLabel).toBeUndefined();
    expect(filtered.genderIdentity).toBeUndefined();
  });
});

describe("approveConsentRequest route", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("approves a pending request and upserts consent", async () => {
    (prisma.consentRequest.findUnique as jest.Mock).mockResolvedValue({
      id: "req1",
      targetUserId: "user1",
      status: "PENDING",
      appId: "app1",
      identityId: "id1",
      requestedScopes: ["profile:label"],
    });

    (prisma.consent.upsert as jest.Mock).mockResolvedValue({ id: "consent1" });

    const req = buildJsonRequest(
      "https://example.com/api/consent-requests/req1/approve",
      {}
    );

    const res = await approveConsentRequest(req, {
      params: Promise.resolve({ requestId: "req1" }),
    });

    expect(res.status).toBe(200);
    expect(prisma.consent.upsert).toHaveBeenCalled();
    expect(prisma.consentRequest.update).toHaveBeenCalledWith({
      where: { id: "req1" },
      data: { status: "APPROVED", processedAt: expect.any(Date) },
    });
  });
});
