"use client";

import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Trash2, PlusCircle, Loader2, CheckCircle } from "lucide-react";

// zod schema for form validation
export const newAppSchema = z.object({
  name: z.string().min(3, { message: "App name must be at least 3 characters." }),
  description: z
    .string()
    .max(500, { message: "Description cannot exceed 500 characters." })
    .optional(),
  websiteUrl: z
    .string()
    .url({ message: "Invalid URL format. Please include http(s)://" })
    .optional()
    .or(z.literal("")),
  logoUrl: z
    .string()
    .url({ message: "Invalid URL format. Please include http(s)://" })
    .optional()
    .or(z.literal("")),
  redirectUris: z
    .array(
      z.object({
        url: z.string().url({
          message: "Each redirect URI must be a valid URL. e.g., https://myapp.com/callback",
        }),
      })
    )
    .min(1, { message: "At least one redirect URI is required." })
    .max(5, { message: "You can add a maximum of 5 redirect URIs." }),
  privacyPolicyUrl: z
    .string()
    .url({ message: "Invalid URL format. Please include http(s)://" })
    .optional()
    .or(z.literal("")),
  termsOfServiceUrl: z
    .string()
    .url({ message: "Invalid URL format. Please include http(s)://" })
    .optional()
    .or(z.literal("")),
});

type NewAppFormValues = z.infer<typeof newAppSchema>;

export default function CreateAppForm() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);

  const form = useForm<NewAppFormValues>({
    resolver: zodResolver(newAppSchema),
    defaultValues: {
      name: "",
      description: "",
      websiteUrl: "",
      logoUrl: "",
      redirectUris: [{ url: "" }],
      privacyPolicyUrl: "",
      termsOfServiceUrl: "",
    },
  });

  const {
    fields: redirectUriFields,
    append: appendRedirectUri,
    remove: removeRedirectUri,
  } = useFieldArray<NewAppFormValues, "redirectUris", "id">({
    control: form.control,
    name: "redirectUris",
  });

  async function onSubmit(values: NewAppFormValues) {
    setIsSubmitting(true);
    setSubmitError(null);
    setSubmitSuccess(null);

    try {
      const response = await fetch("/api/apps", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });

      const responseData = await response.json();

      if (!response.ok) {
        throw new Error(responseData.error || `Server error: ${response.status}`);
      }

      setSubmitSuccess(`Application "${responseData.name}" registered successfully! Redirecting...`);
      form.reset();
      router.push(`/my-apps/${responseData.id}/settings`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
      setSubmitError(errorMessage);
      console.error("app registration failed:", errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
        {submitSuccess && (
          <Alert
            variant="default"
            className="bg-green-50 border-green-300 text-green-700 dark:bg-green-900/30 dark:border-green-700 dark:text-green-400"
          >
            <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-500" />
            <AlertTitle>Success!</AlertTitle>
            <AlertDescription>{submitSuccess}</AlertDescription>
          </Alert>
        )}

        {submitError && (
          <Alert variant="destructive">
            <AlertTitle>Registration Failed</AlertTitle>
            <AlertDescription>{submitError}</AlertDescription>
          </Alert>
        )}

        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>
                Application Name <span className="text-destructive">*</span>
              </FormLabel>
              <FormControl>
                <Input placeholder="My Awesome App" {...field} />
              </FormControl>
              <FormDescription>a unique name for your application</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Description</FormLabel>
              <FormControl>
                <Textarea placeholder="describe what your application does" rows={3} {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div>
          <FormLabel>
            Redirect URIs <span className="text-destructive">*</span>
          </FormLabel>
          <FormDescription className="text-sm mb-2">
            these are the urls where users will be redirected after successful authentication
          </FormDescription>

          {redirectUriFields.map((field, index) => (
            <FormField
              key={field.id}
              control={form.control}
              name={`redirectUris.${index}.url`}
              render={({ field: itemField }) => (
                <FormItem className="flex items-center space-x-2 mb-2">
                  <FormControl>
                    <Input placeholder="https://myapp.com/auth/callback" {...itemField} />
                  </FormControl>
                  {redirectUriFields.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeRedirectUri(index)}
                      title="remove uri"
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  )}
                  <FormMessage className="ml-2" />
                </FormItem>
              )}
            />
          ))}

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => appendRedirectUri({ url: "" })}
            disabled={redirectUriFields.length >= 5}
          >
            <PlusCircle className="mr-2 h-4 w-4" /> add redirect uri
          </Button>
        </div>

        <FormField
          control={form.control}
          name="websiteUrl"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Website URL</FormLabel>
              <FormControl>
                <Input placeholder="https://myawesomeapp.com" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="logoUrl"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Logo URL</FormLabel>
              <FormControl>
                <Input placeholder="https://myawesomeapp.com/logo.png" {...field} />
              </FormControl>
              <FormDescription>a direct link to your application&apos;s logo (png, jpg, svg)</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="privacyPolicyUrl"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Privacy Policy URL</FormLabel>
              <FormControl>
                <Input placeholder="https://myawesomeapp.com/privacy" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="termsOfServiceUrl"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Terms of Service URL</FormLabel>
              <FormControl>
                <Input placeholder="https://myawesomeapp.com/terms" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button type="submit" disabled={isSubmitting} className="w-full sm:w-auto">
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              registering...
            </>
          ) : (
            "Register Application"
          )}
        </Button>
      </form>
    </Form>
  );
}
