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
  const [oauthLoading, setOauthLoading] = useState(false);

  const update =
    (k: keyof FormValues) => (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((p) => ({ ...p, [k]: e.target.value }));

  /* credentials sign-in */
  const handleCredentials = async (e: React.FormEvent) => {
    e.preventDefault();

    // 1) Validate form
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

    // 2) Attempt signIn without auto-redirect
    const res = await signIn("credentials", {
      redirect: false,
      callbackUrl: `${window.location.origin}/dashboard`,
      email: form.email,
      password: form.password,
    });

    setLoading(false);

    // 3) On success → hard redirect
    if (res?.ok && res.url) {
      toast.success("Signed in — welcome back!");
      window.location.href = res.url;
    } else {
      toast.error(res?.error ?? "Invalid e-mail or password");
    }
  };

  /* Google OAuth */
  const handleGoogle = () => {
    setOauthLoading(true);
    // show toast
    toast.success("Signing you in…");
    // let NextAuth perform its hard redirect
    signIn("google", {
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
          {/* OAuth */}
          <Button
            onClick={handleGoogle}
            className="w-full"
            variant="outline"
            disabled={oauthLoading}
            type="button"
          >
            {oauthLoading ? "Redirecting…" : "Sign in with Google"}
          </Button>

          {/* Credentials */}
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
