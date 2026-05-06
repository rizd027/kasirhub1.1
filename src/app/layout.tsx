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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id" className={cn("h-full antialiased font-sans", geist.variable)}>
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <SyncProvider />
        <AuthCheck>
          <MainWrapper>
            {children}
          </MainWrapper>
          <BottomNav />
        </AuthCheck>
        <Toaster
          position="top-center"
          duration={2800}
          gap={8}
          visibleToasts={3}
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
