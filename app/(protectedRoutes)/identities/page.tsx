import { getServerSession } from "next-auth/next";
import { redirect } from "next/navigation";
// /import { revalidatePath } from "next/cache";
import { authOptions } from "@/app/api/auth/[...nextauth]/options";
import prisma from "@/lib/prisma";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export default async function IdentitiesPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/signin");
  const userId = session.user.id;

  type Identity = {
    id: string;
    name: string;
    description: string | null;
  };

  const identities: Identity[] = await prisma.identity.findMany({
    where: { userId },
    select: {
      id: true,
      name: true,
      description: true,
    },
  });

  return (
    <main className="space-y-8 p-6">
      <h1 className="text-3xl font-semibold">Identities</h1>
      <Button>
        <Link href={"/identities/create"}>Create New Identity</Link>
      </Button>
      {identities.length > 0 ? (
        identities.map((item, id) => (
          <Card key={id}>
            <CardHeader>{item.name}</CardHeader>
            <CardContent>{item.description}</CardContent>
          </Card>
        ))
      ) : (
        <h1>You do not have any identities.</h1>
      )}
    </main>
  );
}
