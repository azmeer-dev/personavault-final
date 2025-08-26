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
  FileText as FileIcon,
  Fingerprint,
  LucideIcon,
  Globe, // Added
  AppWindow, // Added
  CheckCheck, // Added
  PlugZap, // Added
  MailQuestion, // Added
  Link as LinkIcon
} from "lucide-react";

const navDataNoUser = {
  main: [{ title: "Home", url: "/", items: [] }],
};
const navDataUser = {
  main: [
    // { title: "Home", url: "/" },
    { title: "Dashboard", url: "/dashboard", items: [] },
    { title: "Identities", url: "/identities", items: [] },
    { title: "Linked Accounts", url: "/connected-accounts", items: [] },
    // "Connected Accounts" is not part of the current scope, removed for now if it was a placeholder
    // { title: "Connected Accounts", url: "/connected-accounts", items: [] },
    { title: "Explore Identities", url: "/explore", items: [] }, // Renamed for clarity
    { title: "My Applications", url: "/my-apps", items: [] },
    { title: "Request Manager", url: "/consent-requests", items: [] }, // Updated URL from /consent to /consent-requests
    // { title: "Manage App Consents", url: "/settings/consents", items: [] },
    { title: "App Permissions", url: "/settings/connected-apps", items: [] },
    { title: "Audit Logs", url: "/audit-logs", items: [] },
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
    Identities: Fingerprint,
    "Explore Identities": Globe, // Updated icon
    "Linked Accounts": LinkIcon,
    "My Applications": AppWindow,
    "Request Manager": MailQuestion, // Updated icon and title
    "Manage App Consents": CheckCheck,
    "App Permissions": PlugZap,
    "Audit Logs": FileIcon,
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
      {/* <SidebarHeader className="group-data-[collapsible=icon]:hidden">
        <Link href="/" className="font-bold px-4 py-2 block">
          PersonaVault
        </Link>
      </SidebarHeader> */}

      <SidebarHeader
        className="
    flex items-center justify-center transition-all duration-200 ease-linear
    group-data-[collapsible=offcanvas]:px-4 group-data-[collapsible=offcanvas]:py-2
    group-data-[collapsible=icon]:px-0 group-data-[collapsible=icon]:justify-center
  "
      >
        <Link
          href="/"
          className="
      font-bold block overflow-hidden relative
    "
        >
          {/* Collapsed PV */}
          <span
            className="
        absolute left-0 right-0 text-center
        opacity-100 transition-opacity duration-200
        group-data-[state=expanded]:opacity-0
      "
          >
            PV
          </span>

          {/* Expanded PersonaVault */}
          <span
            className="
        opacity-0 transition-opacity duration-200 delay-150
        group-data-[state=expanded]:opacity-100
      "
          >
            PersonaVault
          </span>
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
