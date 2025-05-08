// components/SidebarLayout.tsx
"use client";

import React, { useState, useEffect } from "react";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";

interface SidebarLayoutProps {
  children: React.ReactNode;
  defaultOpen?: boolean;
}

export default function SidebarLayout({
  children,
  defaultOpen = true,
}: SidebarLayoutProps) {
  // lazy-init from localStorage so initial mount already matches persisted state
  const [open, setOpen] = useState<boolean>(() => {
    if (typeof window !== "undefined") {
      const stored = window.localStorage.getItem("sidebarOpen");
      if (stored !== null) {
        try {
          return JSON.parse(stored);
        } catch {}
      }
    }
    // if provided via props, use that as the fallback initial value
    return defaultOpen;
  });

  // Persist on every change
  useEffect(() => {
    try {
      window.localStorage.setItem("sidebarOpen", JSON.stringify(open));
    } catch {}
  }, [open]);

  return (
    <SidebarProvider open={open} onOpenChange={setOpen}>
      <AppSidebar />
      <div className="pt-2 flex-col">
        <div className="flex-col">
        </div>
      </div>
      <main className="flex-1 overflow-y-auto">{children}</main>
    </SidebarProvider>
  );
}
