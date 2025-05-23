// app/(protectedRoutes)/settings/consents/page.tsx
import UserConsentsManager from '@/components/consent/UserConsentsManager';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { getServerSession } from 'next-auth/next'; 
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { redirect } from 'next/navigation';


export default async function ConsentsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    // This check is a safeguard; middleware should ideally handle unauthenticated access.
    redirect('/signin?callbackUrl=/settings/consents'); 
  }

  return (
    <main className="p-4 md:p-6 max-w-4xl mx-auto space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Manage Your Consents</h1>
        <p className="text-sm text-muted-foreground">
          Review applications and identities you have granted access to your data.
          You can revoke access at any time.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Active Consents</CardTitle>
          <CardDescription>
            Below is a list of applications and identities that currently have access to your data based on your approvals.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <UserConsentsManager />
        </CardContent>
      </Card>
    </main>
  );
}
