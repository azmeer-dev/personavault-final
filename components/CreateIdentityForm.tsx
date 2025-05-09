"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
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
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  RadioGroup,
  RadioGroupItem,
} from "@/components/ui/radio-group";
import { X } from "lucide-react";
import { IdentitySchema, IdentityFormData } from "@/schemas/identity";

export interface CreateIdentityFormProps {
  accountOptions: { id: string; provider: string; email: string | null }[];
  identityId?: string;
  initialData?: IdentityFormData;
}

export default function CreateIdentityForm({
  accountOptions,
  identityId,
  initialData,
}: CreateIdentityFormProps) {
  const router = useRouter();

  const [data, setData] = useState<IdentityFormData>(() =>
    initialData
      ? { ...initialData }
      : {
          name: "",
          category: "",
          customCategory: "",
          description: "",
          previousNames: "",
          religiousNames: "",
          visibility: "PRIVATE",
          connectedAccountIds: [],
          adHocAccounts: [],
        }
  );

  useEffect(() => {
    if (initialData) {
      setData(initialData);
    }
  }, [initialData]);

  const [errors, setErrors] = useState<Partial<Record<keyof IdentityFormData, string>>>({});
  const [accountsOpen, setAccountsOpen] = useState(false);

  const CATEGORIES = [
    "Personal",
    "Professional",
    "Family",
    "Education",
    "Community",
    "Creative",
    "Health & Wellness",
    "Travel",
    "Legal",
    "Communication",
    "SocialMedia",
    "Messaging",
    "Productivity",
    "Development",
    "Finance",
    "Shopping",
    "Entertainment",
    "HealthcarePortal",
    "GovernmentService",
    "Utility",
    "IoT",
    "Custom",
  ];

  const onSubmit = async () => {
    const parsed = IdentitySchema.safeParse(data);
    if (!parsed.success) {
      const errs: Record<string, string> = {};
      parsed.error.errors.forEach((e) => {
        errs[e.path[0] as keyof IdentityFormData] = e.message;
      });
      setErrors(errs);
      return;
    }

    const payload = {
      ...parsed.data,
      adHocAccounts: parsed.data.adHocAccounts.length ? parsed.data.adHocAccounts : undefined,
    };

    const url = identityId ? `/api/identities/${identityId}` : `/api/identities`;
    const method = identityId ? "PUT" : "POST";

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (res.ok) {
      router.push("/identities");
    } else {
      console.error(await res.text());
    }
  };

  const toggleLinked = (id: string) => {
    setData((d) => {
      const has = d.connectedAccountIds.includes(id);
      return {
        ...d,
        connectedAccountIds: has
          ? d.connectedAccountIds.filter((x) => x !== id)
          : [...d.connectedAccountIds, id],
      };
    });
    setErrors((e) => ({ ...e, connectedAccountIds: undefined }));
  };

  const addAdHoc = () => {
    setData((d) => ({
      ...d,
      adHocAccounts: [...d.adHocAccounts, { provider: "", info: "" }],
    }));
  };

  const updateAdHoc = (idx: number, field: "provider" | "info", val: string) => {
    setData((d) => {
      const arr = [...d.adHocAccounts];
      arr[idx] = { ...arr[idx], [field]: val };
      return { ...d, adHocAccounts: arr };
    });
  };

  const removeAdHoc = (idx: number) => {
    setData((d) => {
      const arr = [...d.adHocAccounts];
      arr.splice(idx, 1);
      return { ...d, adHocAccounts: arr };
    });
  };

  function capitalizeFirstLetter(str: string) {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  return (
    <form onSubmit={(e) => { e.preventDefault(); onSubmit(); }} className="space-y-8 max-w-xl p-8">
      {/* Category */}
      <div className="space-y-1">
        <Label htmlFor="category">Category*</Label>
        <Select value={data.category} onValueChange={(v) => { setData(d => ({ ...d, category: v, customCategory: "" })); setErrors(e => ({ ...e, category: undefined })); }}>
          <SelectTrigger id="category" className="w-full py-2 px-4 border rounded">
            <SelectValue placeholder="Select category" />
          </SelectTrigger>
          <SelectContent className="py-1">
            {CATEGORIES.map(cat => (
              <SelectItem key={cat} value={cat} className="py-1 px-4 hover:underline">
                {cat}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {errors.category && <p className="text-sm text-red-600">{errors.category}</p>}
      </div>

      {/* Custom Category */}
      {data.category === "Custom" && (
        <div className="space-y-1">
          <Label htmlFor="customCategory">Custom Category*</Label>
          <Input id="customCategory" className="py-2 px-4 border rounded" value={data.customCategory} onChange={(e) => setData(d => ({ ...d, customCategory: e.target.value }))} />
          {errors.customCategory && <p className="text-sm text-red-600">{errors.customCategory}</p>}
        </div>
      )}

      {/* Identity Name */}
      <div className="space-y-1">
        <Label htmlFor="name">Identity Name*</Label>
        <Input id="name" className="py-2 px-4 border rounded" value={data.name} onChange={(e) => setData(d => ({ ...d, name: e.target.value }))} />
        {errors.name && <p className="text-sm text-red-600">{errors.name}</p>}
      </div>

      {/* Previous & Religious Names */}
      {data.category === "Personal" && (
        <>
          <div className="space-y-1">
            <Label htmlFor="previousNames">Previous Names</Label>
            <Input id="previousNames" className="py-2 px-4 border rounded" placeholder="Comma-separated" value={data.previousNames} onChange={(e) => setData(d => ({ ...d, previousNames: e.target.value }))} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="religiousNames">Religious Names</Label>
            <Input id="religiousNames" className="py-2 px-4 border rounded" placeholder="Comma-separated" value={data.religiousNames} onChange={(e) => setData(d => ({ ...d, religiousNames: e.target.value }))} />
          </div>
        </>
      )}

      {/* Description */}
      <div className="space-y-1">
        <Label htmlFor="description">Description</Label>
        <Textarea id="description" className="py-2 px-4 border rounded" rows={4} value={data.description} onChange={(e) => setData(d => ({ ...d, description: e.target.value }))} />
      </div>

      {/* Visibility */}
      <div className="space-y-1">
        <Label>Visibility</Label>
        <RadioGroup value={data.visibility} onValueChange={(v) => setData(d => ({ ...d, visibility: v as "PUBLIC" | "PRIVATE" }))} className="flex space-x-4">
          <Label className="inline-flex items-center"><RadioGroupItem value="PUBLIC" className="mr-2" />Public</Label>
          <Label className="inline-flex items-center"><RadioGroupItem value="PRIVATE" className="mr-2" />Private</Label>
        </RadioGroup>
      </div>

      {/* Linked Accounts */}
      <div className="space-y-1">
        <Label>Linked Accounts</Label>
        <Popover open={accountsOpen} onOpenChange={setAccountsOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" className="w-full text-left py-2 px-4">
              {data.connectedAccountIds.length ? `${data.connectedAccountIds.length} selected` : "Select accounts"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-full p-2">
            <ScrollArea className="h-40">
              {accountOptions.map(acc => (
                <div key={acc.id} className="flex items-center space-x-2 py-1 px-2 hover:underline rounded">
                  <Checkbox checked={data.connectedAccountIds.includes(acc.id)} onCheckedChange={() => toggleLinked(acc.id)} />
                  <span>{capitalizeFirstLetter(acc.provider)}{acc.email && ` (${acc.email})`}</span>
                </div>
              ))}
            </ScrollArea>
          </PopoverContent>
        </Popover>
      </div>

      {/* Ad-hoc Accounts */}
      <div className="space-y-1">
        <Label>Ad-hoc Accounts</Label>
        <div className="space-y-2">
          {data.adHocAccounts.map((item, idx) => (
            <div key={idx} className="flex space-x-2">
              <Input className="py-2 px-4 border rounded" placeholder="Provider" value={item.provider} onChange={e => updateAdHoc(idx, "provider", e.target.value)} />
              <Input className="py-2 px-4 border rounded" placeholder="Email or username" value={item.info} onChange={e => updateAdHoc(idx, "info", e.target.value)} />
              <Button type="button" variant="ghost" size="icon" onClick={() => removeAdHoc(idx)}><X size={16} /></Button>
            </div>
          ))}
          <Button type="button" variant="link" onClick={addAdHoc} className="pl-0">+ Add custom account</Button>
        </div>
      </div>

      <Button type="submit" className="w-full py-2">{identityId ? "Save Changes" : "Create Identity"}</Button>
    </form>
  );
}
