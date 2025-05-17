
import prisma from "@/lib/prisma";

import { getServerSession } from "next-auth/next";
import { redirect } from "next/navigation";
import { authOptions } from "@/app/api/auth/[...nextauth]/options";
import IdentityForm from "@/components/IdentityForm";

export default async function IdentitiesPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/signin");

  const accountOptions = await prisma.account.findMany({
    where: { userId: session.user.id },
    select: { id: true, provider: true, emailFromProvider:true },
  });

  return (
    <main className="min-h-full p-6 min-w-4xl mx-auto overflow-y-auto">
      <h1 className="text-2xl font-semibold mb-4">New Identity</h1>
      <IdentityForm userId={session.user.id} accounts={accountOptions} />
    </main>
  );
}
