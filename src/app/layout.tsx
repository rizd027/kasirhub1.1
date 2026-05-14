import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import { BottomNav } from "@/components/layout/BottomNav";
import { SyncProvider } from "@/components/SyncProvider";
import { Toaster } from "@/components/ui/sonner";
import { cn } from "@/lib/utils";

const geist = Geist({ subsets: ['latin'], variable: '--font-sans' });

export const metadata: Metadata = {
  title: "KasirHub - POS PWA",
  description: "Aplikasi Kasir Point of Sale Offline-First",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "KasirHub",
  },
};

export const viewport: Viewport = {
  themeColor: "#ffffff",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

import { MainWrapper } from "@/components/layout/MainWrapper";
import { AuthCheck } from "@/features/auth/AuthCheck";
import { SidebarNav } from "@/components/layout/SidebarNav";
import { AppEventsHandler } from "@/components/layout/AppEventsHandler";
import { BusinessAssistant } from "@/components/intelligence/BusinessAssistant";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id" className={cn("h-full antialiased font-sans", geist.variable)}>
      <body className="min-h-full flex flex-col bg-background lg:bg-slate-50/50 text-foreground overflow-x-hidden">
        <SyncProvider />
        <AppEventsHandler />
        <AuthCheck>
          <div className="flex-1 flex w-full min-h-screen">
            <SidebarNav />
            <div className="flex-1 flex flex-col min-w-0 relative">
              <MainWrapper>
                {children}
              </MainWrapper>
              <BottomNav />
              <BusinessAssistant />
            </div>
          </div>
        </AuthCheck>
        <Toaster
          position="bottom-right"
          duration={3000}
          expand={false}
          richColors
          toastOptions={{
            className: 'rounded-lg border-slate-100 shadow-2xl font-sans font-bold',
          }}
        />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                navigator.serviceWorker.getRegistrations().then(function(registrations) {
                  for(let registration of registrations) {
                    registration.unregister();
                  }
                });
              }
            `,
          }}
        />
      </body>
    </html>
  );
}

