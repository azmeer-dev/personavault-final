// components/AppSidebar.tsx
"use client";

import * as React from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { usePathname } from "next/navigation";
import {
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarRail,
  SidebarMenuSkeleton,
} from "@/components/ui/sidebar";
import { NavMain, NavMainItem } from "@/components/nav-main";
import { NavProjects, NavProject } from "@/components/nav-projects";
import { NavUser } from "@/components/nav-user";

import {
  Home as HomeIcon,
  LayoutDashboardIcon as DashboardIcon,
  Code as CodeIcon,
  CheckCircle as CheckIcon,
  FileText as FileIcon,
  Fingerprint,
  Link as LinkIcon,
  Search as SearchIcon,
  LucideIcon,
} from "lucide-react";

const navDataNoUser = {
  main: [{ title: "Home", url: "/", items: [] }],
};
const navDataUser = {
  main: [
    // { title: "Home", url: "/" },
    { title: "Dashboard", url: "/dashboard", items: [] },
    { title: "Connected Accounts", url: "/connected-accounts", items: [] },
    { title: "Identities", url: "/identities", items: [] },
    { title: "Explore", url: "/explore", items: [] },
    { title: "My Apps", url: "/my-apps", items: [] },
    { title: "Pending Consents", url: "/consent", items: [] },
    { title: "Audit Logs", url: "/audit", items: [] },
  ],
};
// ─────────────────────────────

export function AppSidebar(props: React.ComponentProps<typeof Sidebar>) {
  const { data: session, status } = useSession();
  const pathname = usePathname();

  if (status === "loading") {
    return <SidebarMenuSkeleton suppressHydrationWarning />;
  }

  const isUser = Boolean(session?.user);
  const navData = isUser ? navDataUser : navDataNoUser;

  // map titles to icons
  const iconMap: Record<string, LucideIcon> = {
    Home: HomeIcon,
    Dashboard: DashboardIcon,
    "Linked Accounts": LinkIcon,
    Identities: Fingerprint,
    "My Apps": CodeIcon,
    "Explore": SearchIcon,
    "Pending Consents": CheckIcon,
    "Audit Logs": FileIcon,
    Test: HomeIcon,
  };

  // Map your old data into NavMain shape
  const mainItems: NavMainItem[] = navData.main.map((item) => ({
    title: item.title,
    url: item.url,
    icon: iconMap[item.title] || HomeIcon,
    isActive: pathname === item.url || pathname.startsWith(item.url + "/"),
    items: item.items,
  }));

  // placeholder projects
  const projectItems: NavProject[] = [];

  return (
    <Sidebar
      collapsible="icon"
      variant="floating"
      className="transition-[width] ease-linear"
      {...props}
    >
      {/* Header */}
      <SidebarHeader className="group-data-[collapsible=icon]:hidden">
        <Link href="/" className="font-bold px-4 py-2 block">
          PersonaVault
        </Link>
      </SidebarHeader>

      {/* Navigation */}
      <SidebarContent className="flex-1">
        <NavMain items={mainItems} />
        {projectItems.length > 0 && <NavProjects projects={projectItems} />}
      </SidebarContent>

      {/* Footer */}
      <SidebarFooter>
        <NavUser />
      </SidebarFooter>

      {/* Collapse rail */}
      <SidebarRail />
    </Sidebar>
  );
}
