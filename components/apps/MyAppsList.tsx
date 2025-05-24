'use client';

import { useEffect, useState, useCallback } from 'react'; // Added useCallback
import Link from 'next/link';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { Info, AlertTriangle, Settings, Copy, Check } from 'lucide-react'; // Icons, Added Copy and Check
import { Badge } from '@/components/ui/badge';

interface AppData {
  id: string;
  name: string;
  description?: string | null;
  logoUrl?: string | null;
  isEnabled: boolean; // Added based on API response, could be used for styling
  createdAt: string;  // Added based on API response
}

export default function MyAppsList() {
  const [apps, setApps] = useState<AppData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copiedAppId, setCopiedAppId] = useState<string | null>(null); // State for copy feedback

  const handleCopy = useCallback(async (appId: string) => {
    try {
      await navigator.clipboard.writeText(appId);
      setCopiedAppId(appId);
      setTimeout(() => setCopiedAppId(null), 2000); // Reset after 2 seconds
    } catch (err) {
      console.error("Failed to copy App ID:", err);
      // Optionally, set an error state here to show feedback to the user
    }
  }, []);

  useEffect(() => {
    const fetchApps = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const response = await fetch('/api/users/me/apps');
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || `Failed to fetch apps: ${response.status}`);
        }
        const data: AppData[] = await response.json();
        setApps(data);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred.';
        setError(errorMessage);
        console.error("Error fetching apps:", errorMessage); // Added console error
      } finally {
        setIsLoading(false);
      }
    };
    fetchApps();
  }, []);

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
        {[1, 2, 3].map((i) => (
          <Card key={i}>
            <CardHeader className="flex flex-row items-center gap-4 space-y-0"> {/* Adjusted for better alignment */}
              <Skeleton className="h-12 w-12 rounded-lg" /> {/* Changed to rounded-lg for app logos */}
              <div className="flex-1 space-y-1"> {/* flex-1 to take available space */}
                <Skeleton className="h-5 w-3/4" /> {/* Slightly larger for title */}
                <Skeleton className="h-3 w-full" /> {/* Description line 1 */}
              </div>
            </CardHeader>
            <CardContent className="py-2"> {/* Reduced padding for content if it's just a placeholder */}
               <Skeleton className="h-4 w-5/6 mt-1" /> {/* Description line 2 or status */}
            </CardContent>
            <CardFooter>
              <Skeleton className="h-10 w-full" /> {/* Button placeholder */}
            </CardFooter>
          </Card>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive" className="mt-4">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Failed to Load Applications</AlertTitle>
        <AlertDescription>
          {error} Please try again later. If the problem persists, contact support.
        </AlertDescription>
      </Alert>
    );
  }

  if (apps.length === 0) {
    return (
      <Alert className="mt-4">
        <Info className="h-4 w-4" />
        <AlertTitle>No Applications Found</AlertTitle>
        <AlertDescription>
          You have not registered any applications yet.
          {/* When app registration page is available, a Link component can be added here */}
          {/* Example: <Link href="/my-apps/register"><Button variant="link">Register your first app</Button></Link> */}
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
      {apps.map((app) => (
        <Card key={app.id} className="flex flex-col justify-between"> {/* justify-between to push footer down */}
          <div> {/* Wrapper for header and content to allow footer to be pushed down */}
            <CardHeader className="flex flex-row items-start gap-4 space-y-0"> {/* Adjusted for better alignment */}
              <Avatar className="h-12 w-12 rounded-lg border"> {/* Changed to rounded-lg */}
                <AvatarImage src={app.logoUrl ?? undefined} alt={`${app.name} logo`} />
                <AvatarFallback className="rounded-lg text-sm"> {/* Fallback styling */}
                  {app.name.substring(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1"> {/* flex-1 to take available space */}
                <CardTitle className="text-lg">{app.name}</CardTitle>
                {!app.isEnabled && (
                    <Badge variant="outline" className="mt-1 text-xs text-orange-600 border-orange-500">
                        Disabled
                    </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="py-2">
              {app.description ? (
                <CardDescription className="line-clamp-3 text-sm mb-3"> {/* line-clamp & margin-bottom */}
                  {app.description}
                </CardDescription>
              ) : (
                <CardDescription className="italic text-sm mb-3">No description provided.</CardDescription>
              )}
              <div className="mt-auto"> {/* Push App ID to bottom of CardContent if description is short */}
                <p className="text-xs font-medium text-muted-foreground">App ID</p>
                <div className="flex items-center space-x-2 mt-1">
                  <code className="text-xs p-1.5 bg-muted rounded-md break-all">{app.id}</code>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => handleCopy(app.id)}
                    title="Copy App ID"
                    className="h-8 w-8 flex-shrink-0" // Ensure consistent size
                  >
                    {copiedAppId === app.id ? (
                      <Check className="h-4 w-4 text-green-600" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
            </CardContent>
          </div>
          <CardFooter className="pt-4 border-t mt-2"> {/* Added border-t and margin-top */}
            <Link href={`/my-apps/${app.id}/settings`} passHref className="w-full">
              <Button variant="outline" className="w-full">
                <Settings className="mr-2 h-4 w-4" />
                Manage
              </Button>
            </Link>
          </CardFooter>
        </Card>
      ))}
    </div>
  );
}
