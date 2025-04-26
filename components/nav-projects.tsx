// components/nav-projects.tsx
"use client";

import * as React from "react";
import Link from "next/link";
import {
  Folder,
  Forward,
  MoreHorizontal,
  Trash2,
  type LucideIcon,
} from "lucide-react";
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuAction,
  SidebarMenuButton,
} from "@/components/ui/sidebar";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

export interface NavProject {
  name: string;
  url: string;
  icon: LucideIcon;
  isActive?: boolean;
}

export function NavProjects({ projects }: { projects: NavProject[] }) {
  const isHidden = "group-data-[collapsible=icon]:hidden";

  return (
    <SidebarGroup className={isHidden}>
      <SidebarGroupLabel>Projects</SidebarGroupLabel>
      <SidebarMenu>
        {projects.map((p) => (
          <SidebarMenuItem key={p.name}>
            <SidebarMenuButton asChild isActive={!!p.isActive}>
              <Link
                href={p.url}
                className="flex w-full items-center gap-2 truncate"
              >
                <p.icon className="h-5 w-5 flex-shrink-0" />
                <span>{p.name}</span>
              </Link>
            </SidebarMenuButton>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuAction showOnHover>
                  <MoreHorizontal />
                  <span className="sr-only">More</span>
                </SidebarMenuAction>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                className="w-48 rounded-lg"
                side="right"
                align="start"
              >
                <DropdownMenuItem>
                  <Folder className="text-muted-foreground" />
                  View Project
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <Forward className="text-muted-foreground" />
                  Share Project
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem>
                  <Trash2 className="text-muted-foreground" />
                  Delete Project
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        ))}
        <SidebarMenuItem>
          <SidebarMenuButton className="text-sidebar-foreground/70">
            <MoreHorizontal className="text-sidebar-foreground/70" />
            <span>More</span>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    </SidebarGroup>
  );
}
