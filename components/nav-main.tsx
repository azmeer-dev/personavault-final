// components/nav-main.tsx
"use client";

import * as React from "react";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import {
  SidebarGroup,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarMenuSub,
  SidebarMenuSubItem,
  SidebarMenuSubButton,
} from "@/components/ui/sidebar";

export interface NavMainItem {
  title: string;
  url: string;
  icon: LucideIcon;
  isActive?: boolean;
  items?: { title: string; url: string }[];
}

export function NavMain({ items }: { items: NavMainItem[] }) {
  return (
    <SidebarGroup>
      <SidebarMenu>
        {items.map((item) => {
          const hasSub = Array.isArray(item.items) && item.items.length > 0;
          return (
            <SidebarMenuItem key={item.title}>
              <SidebarMenuButton asChild isActive={!!item.isActive}>
                <Link
                  href={item.url}
                  className={
                    // full-width click area, with padding in expanded mode
                    "flex w-full items-center gap-2 truncate px-2 " +
                    // center icon and remove padding in collapsed mode
                    "group-data-[collapsible=icon]:justify-center " +
                    "group-data-[collapsible=icon]:px-0"
                  }
                >
                  <item.icon className="h-5 w-5 flex-shrink-0" />
                  <span className="group-data-[collapsible=icon]:hidden">
                    {item.title}
                  </span>
                </Link>
              </SidebarMenuButton>

              {hasSub && (
                <SidebarMenuSub className="ml-0 border-l-0 px-1.5">
                  {item.items!.map((sub) => (
                    <SidebarMenuSubItem key={sub.title}>
                      <SidebarMenuSubButton asChild isActive={false}>
                        <Link
                          href={sub.url}
                          className="block w-full truncate px-2"
                        >
                          {sub.title}
                        </Link>
                      </SidebarMenuSubButton>
                    </SidebarMenuSubItem>
                  ))}
                </SidebarMenuSub>
              )}
            </SidebarMenuItem>
          );
        })}
      </SidebarMenu>
    </SidebarGroup>
  );
}
