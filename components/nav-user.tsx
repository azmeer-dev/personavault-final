// components/nav-user.tsx
"use client";

import * as React from "react";
import Link from "next/link";
import { useSession, signOut } from "next-auth/react";
import {
  useSidebar,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
} from "@/components/ui/sidebar";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuSeparator,
  DropdownMenuGroup,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import {
  Bell,
  ChevronsUpDown,
  LogOut,
  LogIn as LoginIcon,
  Sun,
  Moon,
  Laptop,
  UserPlus, // Added for Sign Up
  Settings, // Added for Account Settings
} from "lucide-react";
import { useTheme } from "next-themes";

export function NavUser() {
  const { data: session } = useSession();
  const { isMobile } = useSidebar();
  const { setTheme } = useTheme();

  const user = session?.user
    ? {
        name: session.user.name || "User", // Fallback to "User" if name is null/undefined
        email: session.user.email || "",
        avatar: session.user.image || "/placeholder-avatar.png",
      }
    : { name: "Guest", email: "", avatar: "/placeholder-avatar.png" };

  // Note: session.user.id is available if you've configured it in your authOptions callbacks.
  // You might use it for links, e.g., `/profile/${session.user.id}`

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
              <Avatar className="h-8 w-8 rounded-lg">
                <AvatarImage src={user.avatar} alt={user.name} />
                <AvatarFallback className="rounded-lg">
                  {user.name ? user.name.charAt(0).toUpperCase() : "?"}
                </AvatarFallback>
              </Avatar>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">{user.name}</span>
                <span className="truncate text-xs">{user.email}</span>
              </div>
              <ChevronsUpDown className="ml-auto size-4" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>

          <DropdownMenuContent
            className="min-w-[220px] rounded-lg" // Slightly increased min-width for new items
            side={isMobile ? "bottom" : "right"}
            align="end"
            sideOffset={4}
          >
            {/* Theme selector items */}
            <DropdownMenuGroup>
              <DropdownMenuItem onClick={() => setTheme("light")}>
                <Sun className="mr-2 h-4 w-4" /> Light
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setTheme("dark")}>
                <Moon className="mr-2 h-4 w-4" /> Dark
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setTheme("system")}>
                <Laptop className="mr-2 h-4 w-4" /> System
              </DropdownMenuItem>
            </DropdownMenuGroup>

            <DropdownMenuSeparator />

            {/* Guests see Sign Up / Sign In */}
            {!session?.user && (
              <DropdownMenuGroup>
                <DropdownMenuItem asChild>
                  <Link href="/signup">
                    <UserPlus className="mr-2 h-4 w-4" /> Sign Up {/* Changed Icon */}
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/signin">
                    <LoginIcon className="mr-2 h-4 w-4" /> Sign In
                  </Link>
                </DropdownMenuItem>
              </DropdownMenuGroup>
            )}

            {/* Logged-in users see more options */}
            {session?.user && (
              <>
                <DropdownMenuGroup>
                  <DropdownMenuItem asChild>
                    {/* You might want to make this path dynamic or configurable */}
                    <Link href="/dashboard/settings/account">
                      <Settings className="mr-2 h-4 w-4" /> Account Settings
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/notifications"> {/* Standardized path prefix */}
                      <Bell className="mr-2 h-4 w-4" /> Notifications
                    </Link>
                  </DropdownMenuItem>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => signOut({ callbackUrl: "/signin" })}>
                  <LogOut className="mr-2 h-4 w-4" /> Sign Out
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}