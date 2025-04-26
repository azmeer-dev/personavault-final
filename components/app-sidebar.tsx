// app/components/AppSidebar.tsx
"use client";

import * as React from "react";
import Link from "next/link";
import { useSession, signOut } from "next-auth/react";
import { usePathname } from "next/navigation";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarMenuSkeleton,
} from "@/components/ui/sidebar";
import { ModeToggle } from "./mode-toggle";

const navDataNoUser = {
  main: [
    { title: "Home", url: "/" },
    {
      title: "Building Your Application",
      url: "#",
      items: [
        { title: "Routing", url: "#" },
        { title: "Data Fetching", url: "#", isActive: true },
        { title: "Rendering", url: "#" },
        { title: "Caching", url: "#" },
        { title: "Styling", url: "#" },
        { title: "Optimizing", url: "#" },
        { title: "Configuring", url: "#" },
        { title: "Testing", url: "#" },
        { title: "Authentication", url: "#" },
        { title: "Deploying", url: "#" },
        { title: "Upgrading", url: "#" },
        { title: "Examples", url: "#" },
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

export function AppSidebar(props: React.ComponentProps<typeof Sidebar>) {
  const { data: session, status } = useSession();
  const pathname = usePathname();

  if (status === "loading") {
    return <SidebarMenuSkeleton suppressHydrationWarning />;
  }

  const navData = session?.user ? navDataUser : navDataNoUser;
  const userLabel =
    session?.user?.name ?? session?.user?.email?.split("@")[0] ?? null;

  return (
    <Sidebar
      variant="floating"
      {...props}
    >
      {/* ───────── Brand ───────── */}
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <Link href="/">
                <span className="font-medium text-lg leading-none">
                  PersonaVault
                </span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      {/* ───────── Navigation ───────── */}
      <SidebarContent>
        <SidebarGroup>
          <SidebarMenu className="gap-2">
            {navData.main.map((item) => {
              const parentActive =
                pathname === item.url ||
                pathname.startsWith(item.url + "/");

              return (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={parentActive}
                  >
                    <Link href={item.url} className="font-medium">
                      {item.title}
                    </Link>
                  </SidebarMenuButton>

                  {item.items?.length ? (
                    <SidebarMenuSub className="ml-0 border-l-0 px-1.5">
                      {item.items.map((sub) => (
                        <SidebarMenuSubItem key={sub.title}>
                          <SidebarMenuSubButton
                            asChild
                            isActive={pathname === sub.url}
                          >
                            <Link href={sub.url}>{sub.title}</Link>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                      ))}
                    </SidebarMenuSub>
                  ) : null}
                </SidebarMenuItem>
              );
            })}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>

      {/* ───────── Footer controls ───────── */}
      <div className="p-2 flex items-center">
        <ModeToggle />
        <div className="ml-auto flex items-center gap-2">
          {session?.user ? (
            <>
              {userLabel && (
                <Link
                  href="/settings"
                  className="p-2 hover:underline cursor-pointer"
                  title={userLabel}
                >
                  {userLabel}
                </Link>
              )}
              <button
                onClick={() => signOut()}
                className="p-2 hover:underline cursor-pointer"
              >
                Sign Out
              </button>
            </>
          ) : (
            <>
              <Link href="/signup" className="p-2 hover:underline">
                Sign Up
              </Link>
              <Link href="/signin" className="p-2 hover:underline">
                Sign In
              </Link>
            </>
          )}
        </div>
      </div>
    </Sidebar>
  );
}
