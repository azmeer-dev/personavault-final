// app/(protectedRoutes)/my-apps/new/page.tsx
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { redirect } from 'next/navigation';
import CreateAppForm from '@/components/apps/CreateAppForm'; // This component will be created next
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';

export default async function NewAppPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect('/signin?callbackUrl=/my-apps/new');
  }

  return (
    <main className="p-4 md:p-6 max-w-2xl mx-auto space-y-6"> {/* Adjusted padding, kept max-w from example */}
      <div className="text-center"> {/* Centering title and main description */}
        <h1 className="text-2xl sm:text-3xl font-semibold">Register a New Application</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Provide the necessary details to get your application set up.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Application Details</CardTitle>
          <CardDescription>
            Fill out the form below to register your new application.
            You can generate API keys for your application after it&apos;s created.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <CreateAppForm />
        </CardContent>
      </Card>
    </main>
  );
}
