// app/signin/page.tsx
"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { z } from "zod";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const LoginSchema = z.object({
  email: z.string().email("Enter a valid e-mail"),
  password: z.string().min(1, "Password is required"),
});
type FormValues = z.infer<typeof LoginSchema>;

export default function LoginPage() {
  const [form, setForm] = useState<FormValues>({ email: "", password: "" });
  const [fieldErrors, setFieldErrors] = useState<
    Partial<Record<keyof FormValues, string>>
  >({});
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState<string | null>(null);

  const update =
    (k: keyof FormValues) => (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((p) => ({ ...p, [k]: e.target.value }));

  /* credentials sign-in */
  const handleCredentials = async (e: React.FormEvent) => {
    e.preventDefault();

    const result = LoginSchema.safeParse(form);
    if (!result.success) {
      const errs: Partial<Record<keyof FormValues, string>> = {};
      result.error.errors.forEach((err) => {
        errs[err.path[0] as keyof FormValues] = err.message;
      });
      setFieldErrors(errs);
      toast.error("Please fix the highlighted fields.");
      return;
    }
    setFieldErrors({});
    setLoading(true);

    const res = await signIn("credentials", {
      redirect: false,
      callbackUrl: `${window.location.origin}/dashboard`,
      email: form.email,
      password: form.password,
    });

    setLoading(false);

    if (res?.ok && res.url) {
      toast.success("Signed in — welcome back!");
      window.location.href = res.url;
    } else {
      toast.error("Invalid e-mail or password");
    }
  };

  /* generic oauth handler */
  const handleOAuth = (provider: "google" | "github" | "linkedin" | "twitch") => {
    setOauthLoading(provider);
    //toast.success(`Redirecting to ${provider}…`);
    signIn(provider, {
      callbackUrl: `${window.location.origin}/dashboard`,
    });
  };

  return (
    <main className="min-h-screen flex items-center justify-center bg-neutral-50 dark:bg-neutral-950 px-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl">Sign in</CardTitle>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* OAuth buttons */}
          <div className="space-y-2">
            <Button
              onClick={() => handleOAuth("google")}
              className="w-full"
              variant="outline"
              disabled={oauthLoading === "google"}
              type="button"
            >
              {oauthLoading === "google" ? "Redirecting…" : "Sign in with Google"}
            </Button>

            <Button
              onClick={() => handleOAuth("github")}
              className="w-full"
              variant="outline"
              disabled={oauthLoading === "github"}
              type="button"
            >
              {oauthLoading === "github" ? "Redirecting…" : "Sign in with GitHub"}
            </Button>

            {/* <Button
              onClick={() => handleOAuth("linkedin")}
              className="w-full"
              variant="outline"
              disabled={oauthLoading === "linkedin"}
              type="button"
            >
              {oauthLoading === "linkedin"
                ? "Redirecting…"
                : "Sign in with LinkedIn"}
            </Button> */}

            <Button
              onClick={() => handleOAuth("twitch")}
              className="w-full"
              variant="outline"
              disabled={oauthLoading === "twitch"}
              type="button"
            >
              {oauthLoading === "twitch" ? "Redirecting…" : "Sign in with Twitch"}
            </Button>
          </div>

          {/* Credentials form */}
          <form onSubmit={handleCredentials} noValidate className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={form.email}
                onChange={update("email")}
                aria-invalid={!!fieldErrors.email}
                required
              />
              {fieldErrors.email && (
                <p className="text-sm text-red-600 dark:text-red-400">
                  {fieldErrors.email}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={form.password}
                onChange={update("password")}
                aria-invalid={!!fieldErrors.password}
                required
              />
              {fieldErrors.password && (
                <p className="text-sm text-red-600 dark:text-red-400">
                  {fieldErrors.password}
                </p>
              )}
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Signing in…" : "Sign in with e-mail"}
            </Button>
          </form>
        </CardContent>

        <CardFooter />
      </Card>
    </main>
  );
}
