// app/(protectedRoutes)/settings/connected-apps/page.tsx
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { redirect } from 'next/navigation';
import UserAppConsentGranter from '@/components/consent/UserAppConsentGranter';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';

export default async function ConnectedAppsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect('/signin?callbackUrl=/settings/connected-apps');
  }
  return (
    <main className="p-4 md:p-6 max-w-3xl mx-auto space-y-6"> {/* Adjusted padding to match other pages */}
      <div className="text-center"> {/* Centering title and main description */}
        <h1 className="text-2xl sm:text-3xl font-semibold">Grant Application Permissions</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Authorize applications to access specific private identities you manage.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Connect Applications to Your Identities</CardTitle>
          <CardDescription>
            Select an application and the private identities you wish to grant it access to.
            Currently, this will grant read-only access to the selected identity profiles.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <UserAppConsentGranter />
        </CardContent>
      </Card>
    </main>
  );
}
