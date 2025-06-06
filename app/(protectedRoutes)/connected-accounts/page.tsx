// app/connected-accounts/page.tsx

import { getServerSession } from "next-auth/next";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import prisma from "@/lib/prisma";
import { authOptions } from "@/app/api/auth/[...nextauth]/options";

import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";

import ConnectAccountButtons from "@/components/ConnectAccountButtons";

//
type LinkedAccount = {
  id: string;
  provider: string;
  providerAccountId: string;
  emailFromProvider: string | null;
};

// ─── Server Action ─────────────────────────────────────────────
async function unlinkAccount(formData: FormData) {
  "use server";
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/signin");

  const accountId = formData.get("accountId")?.toString();
  if (accountId) {
    await prisma.account.delete({ where: { id: accountId } });
    revalidatePath("/connected-accounts");
  }
}

// ─── Page Component ────────────────────────────────────────────
export default async function ConnectedAccountsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/signin");
  const userId = session.user.id;

  const linked: LinkedAccount[] = await prisma.account.findMany({
    where: { userId },
    select: {
      id: true,
      provider: true,
      providerAccountId: true,
      emailFromProvider: true,
    },
    orderBy: { provider: "asc" },
  });

  const allProviders = ["google", "github", "linkedin", "twitch"] as const;

  return (
    <main className="space-y-8 p-6">
      <h1 className="text-3xl font-semibold">Connected Accounts</h1>

      {/* Linked Accounts */}
      <Card>
        <CardHeader>
          <CardTitle>Linked Accounts</CardTitle>
        </CardHeader>
        <CardContent>
          {linked.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Provider</TableHead>
                  <TableHead>Account ID</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {linked.map((acc) => (
                  <TableRow key={acc.id}>
                    <TableCell className="capitalize">{acc.provider}</TableCell>
                    <TableCell>{acc.providerAccountId}</TableCell>
                    <TableCell>{acc.emailFromProvider}</TableCell>
                    <TableCell className="text-right">
                      <form action={unlinkAccount}>
                        <input type="hidden" name="accountId" value={acc.id} />
                        <Button variant="destructive" size="sm">
                          Unlink
                        </Button>
                      </form>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-sm text-muted-foreground">
              You have not connected any accounts yet.
            </p>
          )}
        </CardContent>
      </Card>

      <Separator />

      {/* Connect New Account */}
      <Card>
        <CardHeader>
          <CardTitle>Connect a New Account</CardTitle>
        </CardHeader>
        <CardContent>
          <ConnectAccountButtons providers={allProviders} />
        </CardContent>
      </Card>
    </main>
  );
}
