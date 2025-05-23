// app/(protectedRoutes)/consent-requests/page.tsx
import ConsentRequestProcessor from '@/components/consent/ConsentRequestProcessor';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { redirect } from 'next/navigation';

export default async function ConsentRequestsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    // This check is a safeguard; middleware should ideally handle unauthenticated access.
    redirect('/signin?callbackUrl=/consent-requests');
  }

  return (
    <main className="p-4 md:p-6 max-w-4xl mx-auto space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Pending Consent Requests</h1>
        <p className="text-sm text-muted-foreground">
          Review applications and identities requesting access to your data. 
          Approve or reject these requests below.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Review Incoming Requests</CardTitle>
          <CardDescription>
            The following applications are requesting permission to access your specified data or identities.
            Granting access will allow them to use your information according to their terms.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ConsentRequestProcessor />
        </CardContent>
      </Card>
    </main>
  );
}
