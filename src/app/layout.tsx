import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Sidebar } from "@/components/layout/sidebar";
import { MobileNav } from "@/components/layout/mobile-nav";
import { Topbar } from "@/components/layout/topbar";
import { ToastProvider } from "@/components/ui/toast";
import { AuthGuard } from "@/components/auth/auth-guard";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Kaldik & Doa — Kalender Pendidikan & Pokok Doa Terpadu",
  description:
    "Aplikasi manajemen Kalender Pendidikan dan Pokok Doa untuk TK, SD, SMP, dan Manajemen",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="id"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex">
        <ToastProvider>
          <AuthGuard>
            {/* Desktop Sidebar */}
            <Sidebar />

            {/* Main Content */}
            <div className="flex-1 flex flex-col min-h-screen">
              <Topbar />
              <main className="flex-1 p-4 lg:p-6 pb-20 lg:pb-6">{children}</main>
            </div>

            {/* Mobile Bottom Nav */}
            <MobileNav />
          </AuthGuard>
        </ToastProvider>
      </body>
    </html>
  );
}
