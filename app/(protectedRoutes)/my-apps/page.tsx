// app/(protectedRoutes)/my-apps/page.tsx
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { redirect } from 'next/navigation';
import MyAppsList from '@/components/apps/MyAppsList';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button'; // Added
import Link from 'next/link'; // Added
import { PlusCircle } from 'lucide-react'; // Added

export default async function MyAppsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    // This should ideally be handled by middleware, but serves as a fallback.
    redirect('/signin?callbackUrl=/my-apps'); // Added callbackUrl for better UX
  }

  return (
    <main className="p-4 md:p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="space-y-1">
            <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">My Applications</h1>
            <p className="text-sm text-muted-foreground">
                Manage your registered applications and their settings.
            </p>
        </div>
        <Link href="/my-apps/new" passHref>
          <Button as="a"> {/* Use 'as="a"' for Next.js Link with Button component */}
            <PlusCircle className="mr-2 h-4 w-4" />
            Register New App
          </Button>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Your Registered Applications</CardTitle>
          <CardDescription>
            Below is a list of applications you have registered. You can access settings,
            including API key management, for each application.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* MyAppsList will handle fetching and displaying the actual list of apps */}
          <MyAppsList />
        </CardContent>
      </Card>
    </main>
  );
}
