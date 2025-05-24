// app/(protectedRoutes)/authorize-app/page.tsx
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { redirect } from 'next/navigation';
import prisma from '@/lib/prisma';
import AppConsentPrompt from '@/components/consent/AppConsentPrompt'; // To be created
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertTriangle } from 'lucide-react';

interface AuthorizeAppPageProps {
  searchParams: {
    appId?: string;
    resourceId?: string; // Assuming this is an identityId for now
    scopes?: string;     // Comma-separated string of scopes
    // resourceType?: string; // Could add later if supporting more than just identities
  };
}

export default async function AuthorizeAppPage({ searchParams }: AuthorizeAppPageProps) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    // Construct callback URL with original search parameters
    const callbackParams = new URLSearchParams();
    if (searchParams.appId) callbackParams.set('appId', searchParams.appId);
    if (searchParams.resourceId) callbackParams.set('resourceId', searchParams.resourceId);
    if (searchParams.scopes) callbackParams.set('scopes', searchParams.scopes);
    // Ensure the base path is properly encoded, then append the query string
    const encodedCallbackPath = encodeURIComponent(`/authorize-app?${callbackParams.toString()}`);
    redirect(`/signin?callbackUrl=${encodedCallbackPath}`);
  }

  const { appId, resourceId, scopes: scopesString } = searchParams;

  if (!appId || !resourceId || !scopesString) {
    return (
      <main className="p-4 md:p-6 max-w-md mx-auto"> {/* Adjusted padding */}
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Missing Information</AlertTitle>
          <AlertDescription>
            Required parameters (appId, resourceId, scopes) were not provided. Please check the link and try again.
          </AlertDescription>
        </Alert>
      </main>
    );
  }

  const app = await prisma.app.findUnique({
    where: { id: appId },
    select: { id: true, name: true, logoUrl: true, description: true },
  });

  const identity = await prisma.identity.findUnique({
    where: { 
      id: resourceId,
      userId: session.user.id, // Crucial: User can only consent for their own identities
    },
    select: { id: true, identityLabel: true, profilePictureUrl: true, category: true, description: true }, // Added description
  });

  if (!app || !identity) {
     return (
      <main className="p-4 md:p-6 max-w-md mx-auto"> {/* Adjusted padding */}
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Invalid Request</AlertTitle>
          <AlertDescription>
            The specified application or identity was not found, or you do not have permission to access it.
          </AlertDescription>
        </Alert>
      </main>
    );
  }

  const requestedScopes = scopesString.split(',').map(s => s.trim()).filter(s => s);
  if (requestedScopes.length === 0) {
     return (
        <main className="p-4 md:p-6 max-w-md mx-auto"> {/* Adjusted padding */}
            <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Missing Scopes</AlertTitle>
            <AlertDescription>
                No scopes were provided in the request. Please specify the permissions you are requesting.
            </AlertDescription>
            </Alert>
        </main>
     );
  }


  return (
    <main className="p-4 md:p-6 max-w-xl mx-auto space-y-6"> {/* Adjusted padding */}
      <h1 className="text-2xl sm:text-3xl font-semibold text-center">Application Requesting Permission</h1> {/* Added sm:text-3xl */}
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">Review Permission Request</CardTitle> {/* Adjusted size */}
          <CardDescription>
            The application <strong className="text-foreground">{app.name}</strong> wants to access specific information related to your identity: <strong className="text-foreground">{identity.identityLabel}</strong>.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AppConsentPrompt
            app={app}
            identity={identity}
            requestedScopes={requestedScopes}
            // We will pass the raw searchParams string to allow AppConsentPrompt to reconstruct the denial redirect URL
            rawSearchParamsString={new URLSearchParams(searchParams).toString()}
          />
        </CardContent>
      </Card>
    </main>
  );
}
