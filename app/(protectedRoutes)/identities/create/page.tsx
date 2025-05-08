
import prisma from "@/lib/prisma";

import { getServerSession } from "next-auth/next";
import { redirect } from "next/navigation";
import { authOptions } from "@/app/api/auth/[...nextauth]/options";
import CreateIdentityForm from "./CreateIdentityForm";

export default async function IdentitiesPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/signin");

  const accountOptions = await prisma.account.findMany({
    where: { userId: session.user.id },
    select: { id: true, provider: true, email:true },
  });

  return (
    <main className="p-6">
      <h1 className="text-2xl font-semibold mb-4">New Identity</h1>
      <CreateIdentityForm accountOptions={accountOptions} />
    </main>
  );
}
