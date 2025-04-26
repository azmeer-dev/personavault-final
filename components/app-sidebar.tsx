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
  BookOpen as DocIcon,
  LayoutDashboardIcon as DashboardIcon,
  Code as CodeIcon,
  CheckCircle as CheckIcon,
  FileText as FileIcon,
  Fingerprint,
  Link as LinkIcon,
} from "lucide-react";

// ─── your original data ───
const navDataNoUser = {
  main: [
    { title: "Home", url: "/" },
    {
      title: "Building Your Application",
      url: "#",
      items: [
        { title: "Routing", url: "#" },
        { title: "Data Fetching", url: "#" },
        { title: "Rendering", url: "#" },
        // …etc
      ],
    },
  ],
};
const navDataUser = {
  main: [
    { title: "Dashboard", url: "/dashboard" },
    { title: "Linked Accounts", url: "/linkedAccounts" },
    { title: "Identities", url: "/identities" },
    { title: "API Clients", url: "/apiClients" },
    { title: "Pending Consents", url: "/consent" },
    { title: "Audit Logs", url: "/audit" },
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
  const iconMap: Record<string, React.ComponentType<any>> = {
    Home: HomeIcon,
    "Building Your Application": DocIcon,
    "Dashboard": DashboardIcon,
    "Linked Accounts": LinkIcon,
    "Identities": Fingerprint,
    "API Clients": CodeIcon,
    "Pending Consents": CheckIcon,
    "Audit Logs": FileIcon,
  };

  // Map your old data into NavMain shape
  const mainItems: NavMainItem[] = navData.main.map((item) => ({
    title: item.title,
    url: item.url,
    icon: iconMap[item.title] || HomeIcon,
    isActive:
      pathname === item.url || pathname.startsWith(item.url + "/"),
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
        {isUser ? (
          <NavUser />
        ) : (
          <div className="px-4 py-2 border-t flex items-center gap-2">
            <Link
              href="/signup"
              className="flex-1 text-sm text-center hover:underline"
            >
              Sign Up
            </Link>
            <Link
              href="/signin"
              className="text-sm hover:underline whitespace-nowrap"
            >
              Sign In
            </Link>
          </div>
        )}
      </SidebarFooter>

      {/* Collapse rail */}
      <SidebarRail />
    </Sidebar>
  );
}
