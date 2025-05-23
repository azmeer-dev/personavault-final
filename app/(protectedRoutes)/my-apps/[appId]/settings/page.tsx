import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import prisma from '@/lib/prisma';
import { redirect } from 'next/navigation';
import ApiKeyManager from '@/components/apps/ApiKeyManager';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';

export default async function AppSettingsPage({ params }: { params: { appId: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    // User not authenticated, redirect to signin
    redirect('/signin?callbackUrl=/my-apps/' + params.appId + '/settings');
  }

  const app = await prisma.app.findUnique({
    where: { id: params.appId },
    select: { id: true, name: true, ownerId: true },
  });

  if (!app) {
    // TODO: Replace with a proper "Not Found" page or a more user-friendly message
    return (
      <main className="p-6 max-w-4xl mx-auto">
        <h1 className="text-2xl font-semibold text-center">App Not Found</h1>
        <p className="text-center text-muted-foreground">
          The application you are looking for does not exist.
        </p>
      </main>
    );
  }

  if (app.ownerId !== session.user.id) {
    // User is not the owner of the app
    // TODO: Replace with a proper "Forbidden" page or a more user-friendly message
    return (
      <main className="p-6 max-w-4xl mx-auto">
        <h1 className="text-2xl font-semibold text-center">Access Denied</h1>
        <p className="text-center text-muted-foreground">
          You are not authorized to manage API keys for this application.
        </p>
      </main>
    );
  }

  return (
    <main className="p-6 max-w-4xl mx-auto space-y-6">
      <h1 className="text-3xl font-bold">
        API Key for <span className="text-primary">{app.name}</span>
      </h1>
      <Card>
        <CardHeader>
          <CardTitle>Manage API Key</CardTitle>
          <CardDescription>
            Generate or regenerate the API key for your application &quot;{app.name}&quot;.
            This key grants access to your application&apos;s resources.
            Store it securely, as it will not be shown again after generation.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ApiKeyManager appId={app.id} appName={app.name} />
        </CardContent>
      </Card>
    </main>
  );
}
