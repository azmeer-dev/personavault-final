// components/ConnectAccountButtons.tsx
"use client";

import { signIn } from "next-auth/react";
import { Button } from "@/components/ui/button";

interface Props {
  providers: readonly string[];
}

export default function ConnectAccountButtons({ providers }: Props) {
  return (
    <div className="flex flex-col gap-4">
      {providers.map((provider) => (
        <Button
          className="cursor-pointer"
          key={provider}
          onClick={() =>
            signIn(provider, { callbackUrl: "/connected-accounts" })
          }
        >
          Connect {provider.charAt(0).toUpperCase() + provider.slice(1)}
        </Button>
      ))}
    </div>
  );
}


