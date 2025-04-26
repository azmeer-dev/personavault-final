// app/layout.tsx
import type { Metadata } from "next";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { Providers } from "./providers";
import SidebarLayout from "@/components/sidebarLayout";
import { Toaster } from "@/components/ui/sonner";

export const metadata: Metadata = {
  title: "PersonaVault",
  description: "Centralize all your online personas in one secure dashboard",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="flex h-screen">
        <Providers>
          <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange
          >
            <SidebarLayout>{children}</SidebarLayout>
            <Toaster position="bottom-right" />
          </ThemeProvider>
        </Providers>
      </body>
    </html>
  );
}
