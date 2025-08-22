// app/settings/SettingsPageClient.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { z } from "zod";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import Image from "next/image";
import { supabase } from "@/lib/supabase";
import type { Session } from "next-auth";
import { useSession } from "next-auth/react";

type Props = {
  session: Session;
};

/* ----------------------------- Validation Schemas ----------------------------- */
const PasswordSchema = z
  .object({
    currentPassword: z
      .string()
      .min(8, "Password must be at least 8 characters"),
    newPassword: z.string().min(8),
    confirmNewPassword: z.string(),
  })
  .refine((data) => data.newPassword === data.confirmNewPassword, {
    path: ["confirmNewPassword"],
    message: "Passwords do not match",
  });

const AccountInfoSchema = z.object({
  globalDisplayName: z.string().min(2).max(100),
  globalProfileImage: z
    .string()
    .url("Enter a valid image URL")
    .optional()
    .or(z.literal("")),
});

const DeleteAccountSchema = z.object({
  password: z.string().min(8, "Password required to confirm deletion"),
});

/* ----------------------------- Component ----------------------------- */
export default function SettingsPageClient({ session }: Props) {
  const router = useRouter();
  const { update } = useSession();

  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmNewPassword: "",
  });

  const [accountForm, setAccountForm] = useState({
    globalDisplayName: session.user?.name ?? "",
    globalProfileImage: session.user?.image ?? "",
  });

  const [deleteForm, setDeleteForm] = useState({
    password: "",
  });

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  /* ----------------------------- Change Handlers ----------------------------- */
  const handleChange =
    (formType: "password" | "account" | "delete", field: string) =>
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      if (formType === "password") {
        setPasswordForm((prev) => ({ ...prev, [field]: value }));
      } else if (formType === "account") {
        setAccountForm((prev) => ({ ...prev, [field]: value }));
      } else if (formType === "delete") {
        setDeleteForm((prev) => ({ ...prev, [field]: value }));
      }
    };

  const handleImageUpload = async (file: File) => {
    const fileExt = file.name.split(".").pop();
    const fileName = `${crypto.randomUUID()}.${fileExt}`;
    const filePath = `profile/${fileName}`;

    const { error } = await supabase.storage
      .from("profile-pictures")
      .upload(filePath, file, { upsert: false });

    if (error) {
      console.error("Supabase upload error:", error);
      toast.error(`Upload failed: ${error.message}`);
      return;
    }

    const { data: publicData } = supabase.storage
      .from("profile-pictures")
      .getPublicUrl(filePath);

    if (!publicData?.publicUrl) {
      toast.error("Failed to retrieve image URL");
      return;
    }

    // ✅ Only set local form state
    setAccountForm((prev) => ({
      ...prev,
      globalProfileImage: publicData.publicUrl,
    }));
  };

  /* ----------------------------- Submit Handlers ----------------------------- */
  async function handlePasswordChange(e: React.FormEvent) {
    e.preventDefault();
    const result = PasswordSchema.safeParse(passwordForm);
    if (!result.success) {
      const errs: Record<string, string> = {};
      result.error.errors.forEach((e) => (errs[e.path[0]] = e.message));
      setFieldErrors(errs);
      toast.error("Please fix the password form");
      return;
    }

    setFieldErrors({});
    setLoading(true);
    const res = await fetch("/api/settings/change-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(passwordForm),
    });
    setLoading(false);

    if (res.ok) {
      toast.success("Password changed");
      setPasswordForm({
        currentPassword: "",
        newPassword: "",
        confirmNewPassword: "",
      });
    } else {
      const { error } = await res.json();
      toast.error(error ?? "Failed to change password");
    }
  }

  async function handleAccountInfoUpdate(e: React.FormEvent) {
    e.preventDefault();
    const result = AccountInfoSchema.safeParse(accountForm);
    if (!result.success) {
      const errs: Record<string, string> = {};
      result.error.errors.forEach((e) => (errs[e.path[0]] = e.message));
      setFieldErrors(errs);
      toast.error("Fix account info form");
      return;
    }

    setFieldErrors({});
    setLoading(true);
    const res = await fetch("/api/settings/update-account", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(accountForm),
    });
    setLoading(false);

    if (res.ok) {
      toast.success("Account info updated");
      await update();
    } else {
      const { error } = await res.json();
      toast.error(error ?? "Failed to update account");
    }
  }

  async function handleDeleteAccount(e: React.FormEvent) {
    e.preventDefault();
    const result = DeleteAccountSchema.safeParse(deleteForm);
    if (!result.success) {
      setFieldErrors({ password: result.error.errors[0]?.message });
      toast.error("Password confirmation required");
      return;
    }

    const confirmed = confirm("This action is irreversible. Are you sure?");
    if (!confirmed) return;

    setLoading(true);
    const res = await fetch("/api/settings/delete-account", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: deleteForm.password }),
    });
    setLoading(false);

    if (res.ok) {
      toast.success("Account deleted");
      router.push("/goodbye");
    } else {
      const { error } = await res.json();
      toast.error(error ?? "Deletion failed");
    }
  }

  /* ----------------------------- Render ----------------------------- */
  return (
    <main className="p-4 md:p-6 max-w-6xl mx-auto space-y-6">
      <div className="space-y-1">
        <h1 className="text-3xl font-semibold">Settings</h1>
      </div>
      <Card className="max-w-xl mx-auto">
        <form onSubmit={handleAccountInfoUpdate}>
          <CardHeader>
            <CardTitle className="font-bold">Account Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 mt-1">
            <div className="space-y-2">
              <Label htmlFor="globalDisplayName">Display Name</Label>
              <Input
                id="globalDisplayName"
                value={accountForm.globalDisplayName}
                onChange={handleChange("account", "globalDisplayName")}
              />
              {fieldErrors.globalDisplayName && (
                <p className="text-sm text-red-600">
                  {fieldErrors.globalDisplayName}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="uploadImage">Profile Picture</Label>
              <Input
                id="uploadImage"
                type="file"
                accept="image/*"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleImageUpload(file);
                }}
              />
              {accountForm.globalProfileImage && (
                <div className="w-20 h-20 relative rounded-full overflow-hidden mt-2 border">
                  <Image
                    src={accountForm.globalProfileImage}
                    alt="Profile Preview"
                    fill
                    className="object-cover"
                    sizes="80px"
                  />
                </div>
              )}
            </div>
          </CardContent>
          <CardFooter>
            <div className="mt-2">
              <Button type="submit" disabled={loading}>
                Save Changes
              </Button>
            </div>
          </CardFooter>
        </form>
      </Card>

      {/* Password */}
      <Card className="max-w-xl mx-auto">
        <form onSubmit={handlePasswordChange}>
          <CardHeader>
            <CardTitle className="font-bold">Change Password</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="currentPassword">Current Password</Label>
              <Input
                id="currentPassword"
                type="password"
                value={passwordForm.currentPassword}
                onChange={handleChange("password", "currentPassword")}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="newPassword">New Password</Label>
              <Input
                id="newPassword"
                type="password"
                value={passwordForm.newPassword}
                onChange={handleChange("password", "newPassword")}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmNewPassword">Confirm New Password</Label>
              <Input
                id="confirmNewPassword"
                type="password"
                value={passwordForm.confirmNewPassword}
                onChange={handleChange("password", "confirmNewPassword")}
              />
            </div>
          </CardContent>
          <CardFooter>
            <div className="mt-2">
              <Button type="submit" disabled={loading}>
                Update Password
              </Button>
            </div>
          </CardFooter>
        </form>
      </Card>

      {/* Danger Zone */}
      <Card className="max-w-xl mx-auto border-red-600">
        <form onSubmit={handleDeleteAccount}>
          <CardHeader>
            <CardTitle className="text-red-600 font-bold">
              Danger Zone
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Deleting your account is permanent and cannot be undone. All your
              identities and data will be lost.
            </p>
            <div className="space-y-2">
              <Label htmlFor="deletePassword">Confirm Password</Label>
              <Input
                id="deletePassword"
                type="password"
                value={deleteForm.password}
                onChange={handleChange("delete", "password")}
              />
            </div>
          </CardContent>
          <CardFooter>
            <div className="mt-2">
              <Button type="submit" variant="destructive" disabled={loading}>
                Delete My Account
              </Button>
            </div>
          </CardFooter>
        </form>
      </Card>
    </main>
  );
}
