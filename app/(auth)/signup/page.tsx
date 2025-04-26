"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
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

/* ------------------------------------------------------------------ */
/*  Zod schema                                                         */
/* ------------------------------------------------------------------ */
const SignUpSchema = z
  .object({
    name: z
      .string()
      .min(2, "Name must be at least 2 characters")
      .max(50, "Name is too long"),
    email: z.string().email("Enter a valid e-mail address"),
    password: z
      .string()
      .min(8, "Password must be 8 characters or longer")
      .max(100, "Password is too long"),
    confirmPassword: z.string(),
  })
  .refine(data => data.password === data.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match",
  });

type FormValues = z.infer<typeof SignUpSchema>;

export default function SignUpPage() {
  const router = useRouter();
  const [form, setForm] = useState<FormValues>({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof FormValues, string>>>(
    {}
  );
  const [loading, setLoading] = useState(false);

  /* -------------------------------------------------------------- */
  /*  Helpers                                                       */
  /* -------------------------------------------------------------- */
  const update = (key: keyof FormValues) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(prev => ({ ...prev, [key]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const result = SignUpSchema.safeParse(form);
    if (!result.success) {
      /* collect messages */
      const errs: Partial<Record<keyof FormValues, string>> = {};
      result.error.errors.forEach(err => {
        const k = err.path[0] as keyof FormValues;
        errs[k] = err.message;
      });
      setFieldErrors(errs);

      /* toast with a summary */
      toast.error("Please fix the highlighted fields.");
      return;
    }
    setFieldErrors({}); // clear any old messages

    setLoading(true);
    const res = await fetch("/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.name,
        email: form.email,
        password: form.password,
      }),
    });
    setLoading(false);

    if (res.ok) {
      toast.success("Account created — you can now sign in.");
      router.push("/signin");
    } else {
      const { error } = await res.json().catch(() => ({}));
      toast.error(error ?? "Sign-up failed. Please try again.");
    }
  };

  /* -------------------------------------------------------------- */
  /*  UI                                                            */
  /* -------------------------------------------------------------- */
  return (
    <main className="min-h-screen flex items-center justify-center bg-neutral-50 dark:bg-neutral-950 px-4">
      <Card className="w-full max-w-md">
        <form onSubmit={handleSubmit} noValidate>
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl">Create an account</CardTitle>
          </CardHeader>

          <CardContent className="space-y-4">
            {/* Name */}
            <div className="space-y-2">
              <Label htmlFor="name">Full name</Label>
              <Input
                id="name"
                placeholder="Jane Doe"
                value={form.name}
                onChange={update("name")}
                aria-invalid={!!fieldErrors.name}
                required
              />
              {fieldErrors.name && (
                <p className="text-sm text-red-600 dark:text-red-400">
                  {fieldErrors.name}
                </p>
              )}
            </div>

            {/* Email */}
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

            {/* Password */}
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

            {/* Confirm */}
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm password</Label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder="Match the password"
                value={form.confirmPassword}
                onChange={update("confirmPassword")}
                aria-invalid={!!fieldErrors.confirmPassword}
                required
              />
              {fieldErrors.confirmPassword && (
                <p className="text-sm text-red-600 dark:text-red-400">
                  {fieldErrors.confirmPassword}
                </p>
              )}
            </div>
          </CardContent>

          <CardFooter className="mt-4">
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Creating…" : "Sign up"}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </main>
  );
}
