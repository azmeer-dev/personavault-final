// app/identities/[id]/page.tsx

import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth/next";
import { redirect } from "next/navigation";
import { authOptions } from "@/app/api/auth/[...nextauth]/options";
import CreateIdentityForm from "@/components/CreateIdentityForm";
import { IdentityFormData } from "@/schemas/identity";
import { Prisma } from "@prisma/client";

type Props = {
  params: Promise<{ id: string }>;
  // If you end up needing searchParams, it’s also a Promise<{ [key: string]: string | string[] | undefined }>
};

export default async function EditIdentityPage({ params }: Props) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/signin");

  // Now this matches the Promise in your Props
  const { id: identityId } = await params;

  // …the rest of your logic is unchanged
  const userId = session.user.id;
  const identity = await prisma.identity.findFirst({
    where: { id: identityId, userId },
    include: { accounts: { select: { id: true } } },
  });
  if (!identity) redirect("/identities");

  const accountOptions = await prisma.account.findMany({
    where: { userId },
    select: { id: true, provider: true, email: true },
  });

  const cf = (identity.customFields as Prisma.JsonObject) ?? {};
  const previousNames =
    Array.isArray(cf.previousNames) &&
    cf.previousNames.every((x) => typeof x === "string")
      ? (cf.previousNames as string[]).join(",")
      : "";
  const religiousNames =
    Array.isArray(cf.religiousNames) &&
    cf.religiousNames.every((x) => typeof x === "string")
      ? (cf.religiousNames as string[]).join(",")
      : "";
  const adHocAccounts = Array.isArray(cf.adHocAccounts)
    ? (cf.adHocAccounts as { provider: string; info: string }[])
    : [];
  const isCustom = !!identity.customValue;

  const initialData: IdentityFormData = {
    name: identity.name,
    category: isCustom ? "Custom" : identity.category,
    customCategory: isCustom ? identity.customValue! : "",
    description: identity.description ?? "",
    previousNames,
    religiousNames,
    visibility: identity.visibility,
    connectedAccountIds: identity.accounts.map((a) => a.id),
    adHocAccounts,
  };

  return (
    <main className="p-6">
      <h1 className="text-2xl font-semibold mb-4">Edit Identity</h1>
      <CreateIdentityForm
        accountOptions={accountOptions}
        initialData={initialData}
        identityId={identityId}
      />
    </main>
  );
}
