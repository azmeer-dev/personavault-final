
import type { Metadata } from "next";
import "./globals.css";

import { getServerSession } from "next-auth/next";
import { cookies }          from "next/headers";
import { authOptions }      from "@/app/api/auth/[...nextauth]/options";
import { Providers }        from "./providers";
import { ThemeProvider }    from "@/components/theme-provider";
import SidebarLayout        from "@/components/sidebarLayout";
import { Toaster }          from "@/components/ui/sonner";
import ClientOnly from "@/components/ClientOnly";

export const metadata: Metadata = {
  title:       "PersonaVault",
  description: "Centralize all your online personas in one secure dashboard",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // 1) fetch your auth session
  const session = await getServerSession(authOptions);

  // 2) await the cookie store before reading from it
  const cookieStore = await cookies();
  const defaultOpen = cookieStore.get("sidebar_state")?.value === "true";

  return (
    <html lang="en" suppressHydrationWarning>
      <body className="flex h-screen">
        <Providers session={session}>
          <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange
          >
            {/* pass defaultOpen into your layout */}
            <ClientOnly>
            <SidebarLayout defaultOpen={defaultOpen}>
              {children}
            </SidebarLayout>
            </ClientOnly>
            <Toaster position="bottom-right" />
          </ThemeProvider>
        </Providers>
      </body>
    </html>
  );
}
