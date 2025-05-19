'use client';

import React, { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  useForm,
  useFieldArray,
  FormProvider,
  useFormContext,
} from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

import {
  IdentityFormValues,
  identityCategoryOptions,
  identityVisibilityOptions,
} from '@/types/types';
import { identityFormSchema } from '@/schemas/identityFormSchema';

import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from '@/components/ui/accordion';
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
} from '@/components/ui/form';
import { Button }                      from '@/components/ui/button';
import { Input }                       from '@/components/ui/input';
import { Textarea }                    from '@/components/ui/textarea';
import { Label }                       from '@/components/ui/label';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import {
  RadioGroup,
  RadioGroupItem,
} from '@/components/ui/radio-group';
import Image from 'next/image';
import { toast } from 'sonner';

/* ------------------------------------------------------------------ */
/*  Types                                                             */
/* ------------------------------------------------------------------ */

export interface IdentityFormProps {
  userId: string;
  accounts: {
    id: string;
    provider: string;
    emailFromProvider: string | null;
  }[];
  initialValues?: Partial<IdentityFormValues>;
  identityId?: string;
  onSuccess?: () => void;
  rightPane?: React.ReactNode;
}

type KeyValuePair = { key: string; value: string };

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */

const objToPairs = (obj?: Record<string, string>): KeyValuePair[] =>
  obj ? Object.entries(obj).map(([k, v]) => ({ key: k, value: v })) : [];

const pairsToObj = (pairs: KeyValuePair[]): Record<string, string> =>
  pairs.reduce((o, { key, value }) => {
    if (key) o[key] = value;
    return o;
  }, {} as Record<string, string>);

/* ------------------------------------------------------------------ */
/*  Reusable list inputs                                              */
/* ------------------------------------------------------------------ */

function StringListInput(props: {
  name: 'websiteUrls' | 'contextualReligiousNames';
  label: string;
}) {
  const { watch, setValue } = useFormContext<IdentityFormValues>();
  const items = watch(props.name) || [];

  const updateAt = (i: number, val: string): void => {
    const next = [...items];
    next[i] = val;
    setValue(props.name, next, { shouldDirty: true });
  };

  const removeAt = (i: number): void =>
    setValue(
      props.name,
      items.filter((_, idx) => idx !== i),
      { shouldDirty: true },
    );

  const addItem = (): void =>
    setValue(props.name, [...items, ''], { shouldDirty: true });

  return (
    <FormField
      name={props.name}
      render={() => (
        <FormItem>
          <FormLabel>{props.label}</FormLabel>
          <FormControl>
            <div className="space-y-2">
              {items.map((val: string, idx: number) => (
                <div key={idx} className="flex gap-2">
                  <Input
                    value={val}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      updateAt(idx, e.target.value)
                    }
                  />
                  <Button
                    variant="secondary"
                    type="button"
                    onClick={() => removeAt(idx)}
                  >
                    Remove
                  </Button>
                </div>
              ))}
              <Button variant="outline" type="button" onClick={addItem}>
                Add
              </Button>
            </div>
          </FormControl>
        </FormItem>
      )}
    />
  );
}

function KeyValueInput(props: {
  name: 'identityContacts' | 'onlinePresence' | 'additionalAttributes';
  label: string;
}) {
  const { watch, setValue } = useFormContext<IdentityFormValues>();
  const pairs = objToPairs(watch(props.name));

  const updatePairs = (nxt: KeyValuePair[]): void =>
    setValue(props.name, pairsToObj(nxt), { shouldDirty: true });

  const changeAt = (
    i: number,
    which: 'key' | 'value',
    val: string,
  ): void => {
    const nxt = [...pairs];
    nxt[i] = { ...nxt[i], [which]: val };
    updatePairs(nxt);
  };

  const removeAt = (i: number): void =>
    updatePairs(pairs.filter((_, idx) => idx !== i));
  const addPair = (): void => updatePairs([...pairs, { key: '', value: '' }]);

  return (
    <FormItem>
      <FormLabel>{props.label}</FormLabel>
      <FormControl>
        <div className="space-y-2">
          {pairs.map((pair, idx) => (
            <div key={idx} className="flex gap-2">
              <Input
                placeholder="Key"
                value={pair.key}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  changeAt(idx, 'key', e.target.value)
                }
              />
              <Input
                placeholder="Value"
                value={pair.value}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  changeAt(idx, 'value', e.target.value)
                }
              />
              <Button
                variant="secondary"
                type="button"
                onClick={() => removeAt(idx)}
              >
                Remove
              </Button>
            </div>
          ))}
          <Button variant="outline" type="button" onClick={addPair}>
            Add
          </Button>
        </div>
      </FormControl>
    </FormItem>
  );
}

/* ------------------------------------------------------------------ */
/*  Name history sub-component                                        */
/* ------------------------------------------------------------------ */

function IdentityNameHistory() {
  const { control, register } = useFormContext<IdentityFormValues>();
  const { fields, append, remove } = useFieldArray({
    control,
    name: 'identityNameHistory',
  });

  return (
    <FormItem>
      <FormLabel>Identity name history</FormLabel>
      <FormControl>
        <div className="space-y-2">
          {fields.map((field, idx) => (
            <div
              key={field.id}
              className="flex flex-col gap-1 border p-2 rounded"
            >
              <Input
                placeholder="Name"
                {...register(`identityNameHistory.${idx}.name`)}
              />
              <Input
                placeholder="From"
                {...register(`identityNameHistory.${idx}.from`)}
              />
              <Input
                placeholder="To"
                {...register(`identityNameHistory.${idx}.to`)}
              />
              <Input
                placeholder="Context"
                {...register(`identityNameHistory.${idx}.context`)}
              />
              <Button
                variant="secondary"
                type="button"
                onClick={() => remove(idx)}
              >
                Remove entry
              </Button>
            </div>
          ))}
          <Button
            variant="outline"
            type="button"
            onClick={() =>
              append({ name: '', from: '', to: '', context: '' })
            }
          >
            Add entry
          </Button>
        </div>
      </FormControl>
    </FormItem>
  );
}

/* ------------------------------------------------------------------ */
/*  IdentityForm component                                            */
/* ------------------------------------------------------------------ */

export default function IdentityForm({
  userId,
  accounts,
  initialValues,
  identityId,
  onSuccess,
  rightPane,
}: IdentityFormProps) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const form = useForm<IdentityFormValues>({
    resolver: zodResolver(identityFormSchema),
    defaultValues: {
      identityLabel: '',
      category: 'PERSONAL',
      contextualNameDetails: { preferredName: '', usageContext: '' },
      identityNameHistory: [],
      contextualReligiousNames: [],
      genderIdentity: '',
      pronouns: '',
      dateOfBirth: '',
      location: '',
      profilePictureUrl: '',
      description: '',
      websiteUrls: [],
      customCategoryName: '',
      customGenderDescription: '',
      identityContacts: {},
      onlinePresence: {},
      additionalAttributes: {},
      visibility: 'PRIVATE',
      linkedAccountIds: [],
      ...initialValues,
    },
    mode: 'onChange',
  });

  const {
    handleSubmit,
    watch,
    setValue,
    control,
    formState: { isSubmitting },
  } = form;

  /* linked accounts */
  const linkedIds = watch('linkedAccountIds') ?? [];
  const toggleAccount = (id: string): void =>
    setValue(
      'linkedAccountIds',
      linkedIds.includes(id)
        ? linkedIds.filter((v) => v !== id)
        : [...linkedIds, id],
      { shouldDirty: true },
    );

  /* image upload */
  const uploadImage = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ): Promise<void> => {
    if (!e.target.files?.length) return;
    setUploading(true);
    const fd = new FormData();
    fd.append('file', e.target.files[0]);
    try {
      const res = await fetch('/api/upload', { method: 'POST', body: fd });
      const { url, error } = (await res.json()) as {
        url?: string;
        error?: string;
      };
      if (!url) throw new Error(error ?? 'Upload failed');
      setValue('profilePictureUrl', url, { shouldValidate: true });
      toast.success('Profile picture uploaded');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  /* submit */
  const onSubmit = async (data: IdentityFormValues): Promise<void> => {
    try {
      const endpoint = identityId
        ? `/api/identities/${identityId}`
        : '/api/identities';
      const method = identityId ? 'PUT' : 'POST';

      const res = await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data, userId }),
      });
      if (!res.ok) {
        const { error } = await res.json();
        throw new Error(error ?? 'Request failed');
      }
      toast.success('Identity saved');
      onSuccess?.();
      router.push('/identities');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Submit failed');
    }
  };

  /* ---------------------------------------------------------------- */
  /*  RENDER                                                          */
  /* ---------------------------------------------------------------- */
  return (
    <FormProvider {...form}>
      <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-[1fr_400px] h-[85dvh]">
        {/* ------------- FORM column (scrollable) ------------- */}
        <div className="overflow-y-auto pr-4">
          <Form {...form}>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
              {/* BASIC */}
              <Accordion type="multiple" defaultValue={['basic']}>
                <AccordionItem value="basic">
                  <AccordionTrigger>Basic information</AccordionTrigger>
                  <AccordionContent className="space-y-4">
                    <FormField
                      control={control}
                      name="category"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Category</FormLabel>
                          <FormControl>
                            <Select
                              value={field.value}
                              onValueChange={field.onChange}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Select category" />
                              </SelectTrigger>
                              <SelectContent>
                                {identityCategoryOptions.map((c) => (
                                  <SelectItem key={c} value={c}>
                                    {c}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    {watch('category') === 'CUSTOM' && (
                      <FormField
                        control={control}
                        name="customCategoryName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Custom category name</FormLabel>
                            <FormControl>
                              <Input {...field} />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                    )}
                    <FormField
                      control={control}
                      name="identityLabel"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Identity label</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="e.g. Personal" />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={control}
                      name="description"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Description</FormLabel>
                          <FormControl>
                            <Textarea {...field} />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </AccordionContent>
                </AccordionItem>

                {/* PROFILE */}
                <AccordionItem value="profile">
                  <AccordionTrigger>Profile & demographics</AccordionTrigger>
                  <AccordionContent className="space-y-4">
                    <FormField
                      control={control}
                      name="genderIdentity"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Gender identity</FormLabel>
                          <FormControl>
                            <Input {...field} />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    {watch('genderIdentity')?.toUpperCase() === 'OTHER' && (
                      <FormField
                        control={control}
                        name="customGenderDescription"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Custom gender description</FormLabel>
                            <FormControl>
                              <Input {...field} />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                    )}
                    <FormField
                      control={control}
                      name="pronouns"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Pronouns</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="they/them" />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={control}
                      name="dateOfBirth"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Date of birth</FormLabel>
                          <FormControl>
                            <Input type="date" {...field} />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={control}
                      name="location"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Location</FormLabel>
                          <FormControl>
                            <Input {...field} />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    {/* image */}
                    <FormField
                      control={control}
                      name="profilePictureUrl"
                      render={() => (
                        <FormItem>
                          <FormLabel>Profile picture</FormLabel>
                          <FormControl>
                            <div>
                              <Input
                                ref={fileRef}
                                type="file"
                                accept="image/*"
                                disabled={uploading}
                                onChange={uploadImage}
                              />
                              {watch('profilePictureUrl') && (
                                <Image
                                  src={watch('profilePictureUrl') as string}
                                  alt="Profile"
                                  width={80}
                                  height={80}
                                  className="rounded-full mt-2"
                                />
                              )}
                            </div>
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </AccordionContent>
                </AccordionItem>

                {/* NAMES */}
                <AccordionItem value="names">
                  <AccordionTrigger>Names & history</AccordionTrigger>
                  <AccordionContent className="space-y-4">
                    <StringListInput
                      name="contextualReligiousNames"
                      label="Contextual religious names"
                    />
                    <FormField
                      control={control}
                      name="contextualNameDetails.preferredName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Preferred name</FormLabel>
                          <FormControl>
                            <Input {...field} />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={control}
                      name="contextualNameDetails.usageContext"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Usage context</FormLabel>
                          <FormControl>
                            <Input {...field} />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <IdentityNameHistory />
                  </AccordionContent>
                </AccordionItem>

                {/* LINKS */}
                <AccordionItem value="links">
                  <AccordionTrigger>Links & presence</AccordionTrigger>
                  <AccordionContent className="space-y-4">
                    <StringListInput name="websiteUrls" label="Website URLs" />
                    <KeyValueInput
                      name="identityContacts"
                      label="Identity contacts"
                    />
                    <KeyValueInput
                      name="onlinePresence"
                      label="Online presence"
                    />
                    <KeyValueInput
                      name="additionalAttributes"
                      label="Additional attributes"
                    />
                  </AccordionContent>
                </AccordionItem>

                {/* VISIBILITY */}
                <AccordionItem value="visibility">
                  <AccordionTrigger>Visibility & linked accounts</AccordionTrigger>
                  <AccordionContent className="space-y-4">
                    <FormField
                      control={control}
                      name="visibility"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Visibility</FormLabel>
                          <FormControl>
                            <RadioGroup
                              className="flex space-x-4"
                              value={field.value}
                              onValueChange={field.onChange}
                            >
                              {identityVisibilityOptions.map((v) => (
                                <div
                                  key={v}
                                  className="flex items-center space-x-2"
                                >
                                  <RadioGroupItem value={v} />
                                  <FormLabel className="font-normal">
                                    {v}
                                  </FormLabel>
                                </div>
                              ))}
                            </RadioGroup>
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <div>
                      <Label>Link accounts</Label>
                      <div className="grid grid-cols-2 gap-2">
                        {accounts.map((acc) => (
                          <label
                            key={acc.id}
                            className="flex items-center gap-2 cursor-pointer"
                          >
                            <input
                              type="checkbox"
                              checked={linkedIds.includes(acc.id)}
                              onChange={() => toggleAccount(acc.id)}
                            />
                            {acc.provider}
                            {acc.emailFromProvider && (
                              <span className="text-xs text-gray-400">
                                {acc.emailFromProvider}
                              </span>
                            )}
                          </label>
                        ))}
                      </div>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>

              <Button className="w-full" type="submit" disabled={isSubmitting}>
                {identityId ? 'Update identity' : 'Create identity'}
              </Button>
            </form>
          </Form>
        </div>

        {/* ------------- PREVIEW column (fixed) ------------- */}
        {rightPane && (
          <div className="hidden md:block sticky top-4 h-fit self-start">
            {rightPane}
          </div>
        )}
      </div>
    </FormProvider>
  );
}