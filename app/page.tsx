// app/page.tsx

import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

export default function HomePage() {
  return (
    <main className="flex flex-col items-center justify-center space-y-16 px-6 py-12">
      {/* Hero */}
      <section className="text-center max-w-2xl mx-auto space-y-6">
        <h1 className="text-5xl font-extrabold tracking-tight">
          PersonaVault
        </h1>
        <p className="text-lg text-muted-foreground">
          Centralize all your online personas in one secure dashboard. Create,
          manage, and share identities—professional, social, gaming, legal—and
          control exactly what you expose.
        </p>
        <div className="flex justify-center gap-4">
          <Link href="/signup">
            <Button size="lg">Get Started</Button>
          </Link>
          <a href="#features">
            <Button variant="outline" size="lg">
              Learn More
            </Button>
          </a>
        </div>
      </section>

      <Separator />

      {/* Features */}
      <section id="features" className="grid gap-8 md:grid-cols-3">
        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader>
            <CardTitle>Centralize Profiles</CardTitle>
          </CardHeader>
          <CardContent>
            <CardDescription>
              Link all your OAuth accounts or add custom values. Keep
              everything in one place.
            </CardDescription>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader>
            <CardTitle>Control Visibility</CardTitle>
          </CardHeader>
          <CardContent>
            <CardDescription>
              Mark identities PUBLIC or PRIVATE. Share only what you choose,
              with friends or third-party apps.
            </CardDescription>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader>
            <CardTitle>Developer API</CardTitle>
          </CardHeader>
          <CardContent>
            <CardDescription>
              Issue API keys, request consent, and integrate PersonaVault into
              your own applications securely.
            </CardDescription>
          </CardContent>
        </Card>
      </section>

      <Separator />

      {/* Call to Action */}
      <section className="text-center max-w-xl mx-auto space-y-4">
        <h2 className="text-3xl font-bold">Ready to get started?</h2>
        <p className="text-base text-muted-foreground">
          Sign up now and take control of your digital identities.
        </p>
        <Link href="/signup">
          <Button size="lg">Create Your Vault</Button>
        </Link>
      </section>
    </main>
  );
}
