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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id" className={cn("h-full antialiased font-sans", geist.variable)}>
      <body className="min-h-full flex flex-col bg-background lg:bg-slate-50/50 text-foreground overflow-x-hidden">
        <SyncProvider />
        <AuthCheck>
          <div className="flex-1 flex w-full min-h-screen">
            <SidebarNav />
            <div className="flex-1 flex flex-col min-w-0 relative">
              <MainWrapper>
                {children}
              </MainWrapper>
              <BottomNav />
            </div>
          </div>
        </AuthCheck>
        <Toaster
          position="bottom-right"
          duration={3000}
          expand={false}
          richColors
          toastOptions={{
            className: 'rounded-2xl border-slate-100 shadow-2xl font-sans font-bold',
          }}
        />
        {/* Service Worker Registration */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', function() {
                  navigator.serviceWorker.register('/sw.js').then(function(registration) {
                    console.log('SW registered: ', registration);
                  }, function(err) {
                    console.log('SW registration failed: ', err);
                  });
                });
              }
            `,
          }}
        />
      </body>
    </html>
  );
}
