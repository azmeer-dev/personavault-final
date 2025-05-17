"use client";

import React, { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import {
  IdentityFormValues,
  identityCategoryOptions,
  identityVisibilityOptions,
} from "@/types/types";
import { identityFormSchema } from "@/schemas/identityFormSchema";

import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";

import { toast } from "sonner";
import Image from "next/image";

type Account = {
  id: string;
  provider: string;
  emailFromProvider: string | null;
};

interface IdentityFormProps {
  userId: string;
  accounts: Account[];
  initialValues?: Partial<IdentityFormValues>;
  identityId?: string;
  onSuccess?: () => void;
}

type KeyValuePair = { key: string; value: string };

function objectToPairs(obj?: Record<string, string>): KeyValuePair[] {
  if (!obj) return [];
  return Object.entries(obj).map(([key, value]) => ({ key, value }));
}
function pairsToObject(arr: KeyValuePair[]): Record<string, string> {
  const out: Record<string, string> = {};
  arr.forEach(({ key, value }) => {
    if (key) out[key] = value;
  });
  return out;
}

export default function IdentityForm({
  userId,
  accounts,
  initialValues,
  onSuccess,
  identityId,
}: IdentityFormProps) {
  const router = useRouter();
  const [uploading, setUploading] = useState(false);

  const defaultValues: IdentityFormValues = {
    identityLabel: "",
    category: "PERSONAL",
    contextualNameDetails: { preferredName: "", usageContext: "" },
    identityNameHistory: [],
    contextualReligiousNames: [],
    genderIdentity: "",
    pronouns: "",
    dateOfBirth: "",
    location: "",
    profilePictureUrl: "",
    description: "",
    websiteUrls: [],
    customCategoryName: "",
    customGenderDescription: "",
    identityContacts: {},
    onlinePresence: {},
    additionalAttributes: {},
    visibility: "PRIVATE",
    linkedAccountIds: [],
    ...initialValues,
  };

  const form = useForm<IdentityFormValues>({
    resolver: zodResolver(identityFormSchema),
    defaultValues,
    mode: "onChange",
  });

  const {
    control,
    register,
    handleSubmit,
    watch,
    setValue,
    formState: {},
  } = form;

  // useFieldArray for object array identityNameHistory
  const nameHistoryArray = useFieldArray({
    control,
    name: "identityNameHistory",
  });

  // watch string arrays for manual management
  const websiteUrls = watch("websiteUrls") || [];
  const contextualReligiousNames = watch("contextualReligiousNames") || [];

  // key-value pairs state for objects
  const [contactsPairs, setContactsPairs] = useState<KeyValuePair[]>(
    objectToPairs(defaultValues.identityContacts)
  );
  const [onlinePairs, setOnlinePairs] = useState<KeyValuePair[]>(
    objectToPairs(defaultValues.onlinePresence)
  );
  const [attrPairs, setAttrPairs] = useState<KeyValuePair[]>(
    objectToPairs(defaultValues.additionalAttributes)
  );

  function handlePairsChange(
    name: "identityContacts" | "onlinePresence" | "additionalAttributes",
    pairs: KeyValuePair[]
  ) {
    if (name === "identityContacts") setContactsPairs(pairs);
    else if (name === "onlinePresence") setOnlinePairs(pairs);
    else if (name === "additionalAttributes") setAttrPairs(pairs);
    setValue(name, pairsToObject(pairs));
  }

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    setUploading(true);
    const formData = new FormData();
    formData.append("file", e.target.files[0]);
    try {
      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });
      const json: { url?: string; error?: string } = await res.json();
      if (json.url) {
        setValue("profilePictureUrl", json.url, { shouldValidate: true });
        toast.success("Profile picture uploaded!");
      } else {
        throw new Error(json.error ?? "Upload failed");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to upload file");
    } finally {
      setUploading(false);
    }
  };

  const linkedAccountIds = watch("linkedAccountIds") || [];
  const toggleAccount = (accountId: string) => {
    const current = new Set(linkedAccountIds);
    if (current.has(accountId)) current.delete(accountId);
    else current.add(accountId);
    setValue("linkedAccountIds", Array.from(current));
  };

  const watchCategory = watch("category");
  const watchGender = watch("genderIdentity");
  const watchProfilePictureUrl = watch("profilePictureUrl");

  function updateStringArray(
    array: string[],
    idx: number,
    value: string,
    name: "websiteUrls" | "contextualReligiousNames"
  ) {
    const arr = [...array];
    arr[idx] = value;
    setValue(name, arr);
  }
  function removeStringArray(
    array: string[],
    idx: number,
    name: "websiteUrls" | "contextualReligiousNames"
  ) {
    const arr = array.filter((_, i) => i !== idx);
    setValue(name, arr);
  }
  function addStringArray(name: "websiteUrls" | "contextualReligiousNames") {
    setValue(name, [...(watch(name) || []), ""]);
  }

  const onSubmit = async (data: IdentityFormValues) => {
    try {
      data.identityContacts = pairsToObject(contactsPairs);
      data.onlinePresence = pairsToObject(onlinePairs);
      data.additionalAttributes = pairsToObject(attrPairs);

      if (!identityId) {
        // no id means create new identity
        const response = await fetch("/api/identities", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...data, userId }),
        });
        if (!response.ok) {
          const errJson = await response.json();
          throw new Error(
            typeof errJson.error === "string"
              ? errJson.error
              : "Failed to create identity"
          );
        }
      } else {
        // update existing identity, pass identityId in URL, not in body
        const dataToUpdate = { ...data };
        const response = await fetch(`/api/identities/${identityId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...dataToUpdate, userId }),
        });
        if (!response.ok) {
          const errJson = await response.json();
          throw new Error(
            typeof errJson.error === "string"
              ? errJson.error
              : "Failed to update identity"
          );
        }
      }

      toast.success("Identity saved successfully");
      if (onSuccess) onSuccess();
      router.push("/identities");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Error submitting form"
      );
    }
  };

  return (
    <Form {...form}>
      <form
        onSubmit={handleSubmit(onSubmit)}
        className="space-y-8 max-w-xl p-2"
      >
        {/* Category */}
        <FormField
          control={control}
          name="category"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Category</FormLabel>
              <FormControl>
                <div>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <SelectTrigger className="w-full" aria-label="Category">
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      {identityCategoryOptions.map((cat) => (
                        <SelectItem key={cat} value={cat}>
                          {cat}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Custom Category Name */}
        {watchCategory === "CUSTOM" && (
          <FormField
            control={control}
            name="customCategoryName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Custom Category Name</FormLabel>
                <FormControl>
                  <Input {...field} placeholder="Custom category name" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        {/* Identity Label */}
        <FormField
          control={control}
          name="identityLabel"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Identity Label</FormLabel>
              <FormControl>
                <Input {...field} placeholder="e.g., Personal, Work Profile" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Description */}
        <FormField
          control={control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Description</FormLabel>
              <FormControl>
                <Textarea {...field} placeholder="Optional description" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Contextual Religious Names */}
        <FormField
          control={control}
          name="contextualReligiousNames"
          render={() => (
            <FormItem>
              <FormLabel>Contextual Religious Names</FormLabel>
              <FormControl>
                {contextualReligiousNames.map((name, idx) => (
                  <div key={idx} className="flex items-center gap-2 mb-2">
                    <Input
                      value={name}
                      onChange={(e) =>
                        updateStringArray(
                          contextualReligiousNames,
                          idx,
                          e.target.value,
                          "contextualReligiousNames"
                        )
                      }
                    />
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() =>
                        removeStringArray(
                          contextualReligiousNames,
                          idx,
                          "contextualReligiousNames"
                        )
                      }
                    >
                      Remove
                    </Button>
                  </div>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => addStringArray("contextualReligiousNames")}
                >
                  Add Name
                </Button>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Gender Identity */}
        <FormField
          control={control}
          name="genderIdentity"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Gender Identity</FormLabel>
              <FormControl>
                <Input {...field} placeholder="Enter gender identity" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Custom Gender Description */}
        {watchGender?.toUpperCase() === "OTHER" && (
          <FormField
            control={control}
            name="customGenderDescription"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Custom Gender Description</FormLabel>
                <FormControl>
                  <Input {...field} placeholder="Describe gender identity" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        {/* Pronouns */}
        <FormField
          control={control}
          name="pronouns"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Pronouns</FormLabel>
              <FormControl>
                <Input {...field} placeholder="e.g., they/them, she/her" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Date of Birth */}
        <FormField
          control={control}
          name="dateOfBirth"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Date of Birth</FormLabel>
              <FormControl>
                <Input type="date" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Location */}
        <FormField
          control={control}
          name="location"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Location</FormLabel>
              <FormControl>
                <Input {...field} placeholder="Enter location" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Profile Picture */}
        <FormField
          control={control}
          name="profilePictureUrl"
          render={() => (
            <FormItem>
              <FormLabel>Profile Picture</FormLabel>
              <FormControl>
                <div>
                  <Input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleFileChange}
                    className="block"
                    disabled={uploading}
                  />
                  {watchProfilePictureUrl && (
                    <Image
                      src={watchProfilePictureUrl}
                      alt="Profile"
                      width={80}
                      height={80}
                      className="rounded-full mt-2"
                    />
                  )}
                </div>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Website URLs */}
        <FormField
          control={control}
          name="websiteUrls"
          render={() => (
            <FormItem>
              <FormLabel>Website URLs</FormLabel>
              <FormControl>
                {websiteUrls.map((url, idx) => (
                  <div key={idx} className="flex items-center gap-2 mb-2">
                    <Input
                      value={url}
                      onChange={(e) =>
                        updateStringArray(
                          websiteUrls,
                          idx,
                          e.target.value,
                          "websiteUrls"
                        )
                      }
                    />
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() =>
                        removeStringArray(websiteUrls, idx, "websiteUrls")
                      }
                    >
                      Remove
                    </Button>
                  </div>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => addStringArray("websiteUrls")}
                >
                  Add URL
                </Button>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Contextual Name Details */}
        <FormField
          control={control}
          name="contextualNameDetails.preferredName"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Preferred Name</FormLabel>
              <FormControl>
                <Input {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={control}
          name="contextualNameDetails.usageContext"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Usage Context</FormLabel>
              <FormControl>
                <Input {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Identity Name History */}
        <FormField
          control={control}
          name="identityNameHistory"
          render={() => (
            <FormItem>
              <FormLabel>Identity Name History</FormLabel>
              <FormControl>
                {nameHistoryArray.fields.map((field, idx) => (
                  <div
                    key={field.id}
                    className="flex flex-col gap-1 mb-2 border rounded p-2"
                  >
                    <Input
                      placeholder="Name"
                      {...register(`identityNameHistory.${idx}.name` as const)}
                    />
                    <Input
                      placeholder="From (year or date)"
                      {...register(`identityNameHistory.${idx}.from` as const)}
                    />
                    <Input
                      placeholder="To (year or date)"
                      {...register(`identityNameHistory.${idx}.to` as const)}
                    />
                    <Input
                      placeholder="Context"
                      {...register(
                        `identityNameHistory.${idx}.context` as const
                      )}
                    />
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => nameHistoryArray.remove(idx)}
                    >
                      Remove Entry
                    </Button>
                  </div>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  onClick={() =>
                    nameHistoryArray.append({
                      name: "",
                      from: "",
                      to: "",
                      context: "",
                    })
                  }
                >
                  Add Name History Entry
                </Button>
              </FormControl>
            </FormItem>
          )}
        />

        {/* Identity Contacts */}
        <FormField
          control={control}
          name="identityContacts"
          render={() => (
            <FormItem>
              <FormLabel>Identity Contacts</FormLabel>
              <FormControl>
                <KeyValueInput
                  label="Identity Contacts"
                  pairs={contactsPairs}
                  onChange={(pairs) =>
                    handlePairsChange("identityContacts", pairs)
                  }
                />
              </FormControl>
            </FormItem>
          )}
        />

        {/* Online Presence */}
        <FormField
          control={control}
          name="onlinePresence"
          render={() => (
            <FormItem>
              <FormLabel>Online Presence</FormLabel>
              <FormControl>
                <KeyValueInput
                  label="Online Presence"
                  pairs={onlinePairs}
                  onChange={(pairs) =>
                    handlePairsChange("onlinePresence", pairs)
                  }
                />
              </FormControl>
            </FormItem>
          )}
        />

        {/* Additional Attributes */}
        <FormField
          control={control}
          name="additionalAttributes"
          render={() => (
            <FormItem>
              <FormLabel>Additional Attributes</FormLabel>
              <FormControl>
                <KeyValueInput
                  label="Additional Attributes"
                  pairs={attrPairs}
                  onChange={(pairs) =>
                    handlePairsChange("additionalAttributes", pairs)
                  }
                />
              </FormControl>
            </FormItem>
          )}
        />

        {/* Visibility */}
        <FormField
          control={control}
          name="visibility"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Visibility</FormLabel>
              <FormControl>
                <RadioGroup
                  className="flex space-x-4"
                  onValueChange={field.onChange}
                  value={field.value}
                >
                  {identityVisibilityOptions.map((option) => (
                    <div key={option} className="flex items-center space-x-2">
                      <RadioGroupItem value={option} />
                      <FormLabel className="font-normal">{option}</FormLabel>
                    </div>
                  ))}
                </RadioGroup>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Link Accounts */}
        <div>
          <Label>Link Accounts</Label>
          <div className="grid grid-cols-2 gap-2">
            {accounts.map((acc) => (
              <label
                key={acc.id}
                className="flex items-center gap-2 cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={linkedAccountIds.includes(acc.id)}
                  onChange={() => toggleAccount(acc.id)}
                />
                {acc.provider}{" "}
                {acc.emailFromProvider && (
                  <span className="text-xs text-gray-400">
                    {acc.emailFromProvider}
                  </span>
                )}
              </label>
            ))}
          </div>
        </div>

        <Button type="submit" disabled={uploading} className="w-full mt-4">
          {initialValues ? "Update Identity" : "Create Identity"}
        </Button>
      </form>
    </Form>
  );
}

type KeyValueInputProps = {
  label: string;
  pairs: { key: string; value: string }[];
  onChange: (pairs: { key: string; value: string }[]) => void;
};

function KeyValueInput({ label, pairs, onChange }: KeyValueInputProps) {
  function updatePair(idx: number, which: "key" | "value", newVal: string) {
    const updated = pairs.map((p, i) =>
      i === idx ? { ...p, [which]: newVal } : p
    );
    onChange(updated);
  }
  function removePair(idx: number) {
    onChange(pairs.filter((_, i) => i !== idx));
  }
  function addPair() {
    onChange([...pairs, { key: "", value: "" }]);
  }
  return (
    <div className="border p-2 rounded">
      <Label>{label}</Label>
      {pairs.map((pair, idx) => (
        <div key={idx} className="flex gap-2 mb-2">
          <Input
            placeholder="Key"
            value={pair.key}
            onChange={(e) => updatePair(idx, "key", e.target.value)}
          />
          <Input
            placeholder="Value"
            value={pair.value}
            onChange={(e) => updatePair(idx, "value", e.target.value)}
          />
          <Button
            type="button"
            variant="secondary"
            onClick={() => removePair(idx)}
          >
            Remove
          </Button>
        </div>
      ))}
      <Button type="button" variant="outline" onClick={addPair}>
        Add
      </Button>
    </div>
  );
}
