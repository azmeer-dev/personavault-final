// app/identities/page.tsx
import { getServerSession } from "next-auth/next";
import { redirect } from "next/navigation";
import { authOptions } from "@/app/api/auth/[...nextauth]/options";
import {revalidatePath} from "next/cache";
import prisma from "@/lib/prisma";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";

type Identity = {
  id: string;
  identityLabel: string;
  description: string | null;
};

// ─── Server Action: Delete Identity ─────────────────────────────
async function deleteIdentity(formData: FormData) {
  "use server";
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/signin");
  const id = formData.get("id")?.toString();
  if (id) {
    await prisma.identity.delete({
      where: { id },
    });
    revalidatePath("/identities");
  }
}

export default async function IdentitiesPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/signin");
  const userId = session.user.id;

  const identities: Identity[] = await prisma.identity.findMany({
    where: { userId },
    select: { id: true, identityLabel: true, description: true },
    orderBy: { updatedAt: "desc" },
  });

  return (
    <main className="space-y-8 p-6">
      <h1 className="text-3xl font-semibold">Identities</h1>

      <Button asChild>
        <Link href="/identities/create">Create New Identity</Link>
      </Button>

      {identities.length > 0 ? (
        identities.map((item) => (
          <Card key={item.id} className="space-y-4">
            <CardHeader className="flex justify-between items-center">
              <span className="text-lg font-medium">{item.identityLabel}</span>
              <div className="flex space-x-2">
                <Link href={`/identities/${item.id}`}>
                  <Button size="sm" variant="outline">
                    Edit
                  </Button>
                </Link>
                <form action={deleteIdentity}>
                  <input type="hidden" name="id" value={item.id} />
                  <Button size="sm" variant="destructive">
                    Delete
                  </Button>
                </form>
              </div>
            </CardHeader>
            <CardContent>
              {item.description ?? <span className="text-sm text-muted-foreground">No description</span>}
            </CardContent>
          </Card>
        ))
      ) : (
        <p className="text-muted-foreground">You do not have any identities.</p>
      )}
    </main>
  );
}
