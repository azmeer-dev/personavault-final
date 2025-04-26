// components/SidebarLayout.tsx
"use client";

import React, { useState, useEffect } from "react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { ModeToggle } from "./mode-toggle";

export default function SidebarLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Lazy-init from localStorage so initial mount already matches persisted state
  const [open, setOpen] = useState<boolean>(() => {
    if (typeof window !== "undefined") {
      const stored = window.localStorage.getItem("sidebarOpen");
      if (stored !== null) {
        try {
          return JSON.parse(stored);
        } catch {}
      }
    }
    return true;
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
        <div>
          <ModeToggle />
        </div>
        <div>
          <SidebarTrigger />
        </div>
      </div>
      <main className="flex-1 overflow-y-auto">{children}</main>
    </SidebarProvider>
  );
}
