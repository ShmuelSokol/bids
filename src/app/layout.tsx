import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Sidebar } from "@/components/sidebar";
import { BugReporter } from "@/components/bug-reporter";
import { ErrorCapture } from "@/components/error-capture";
import { ActivityTracker } from "@/components/activity-tracker";
import { AutoRefresh } from "@/components/auto-refresh";
import { NotificationBar } from "@/components/notification-bar";
import { getCurrentUser } from "@/lib/supabase-server";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "DIBS - Government Bidding System",
  description:
    "Defense Department solicitation bidding, order management, and invoicing",
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const currentUser = await getCurrentUser().catch(() => null);
  const isLoggedIn = !!currentUser;

  const hdrs = await headers();
  const pathname = hdrs.get("x-pathname") || "";
  const isSetPasswordPage = pathname.includes("/login/set-password");
  const isLoginPage = pathname.includes("/login");
  const isApiRoute = pathname.includes("/api/");

  if (
    isLoggedIn &&
    currentUser?.profile?.must_reset_password &&
    !isSetPasswordPage &&
    !isLoginPage &&
    !isApiRoute
  ) {
    redirect("/login/set-password");
  }

  // Always show sidebar/bug reporter on non-login pages
  // The middleware handles auth — if user got past middleware, they're logged in
  const isLoginRoute = pathname.includes("/login");
  const showChrome = !isLoginRoute;

  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="h-full flex flex-col md:flex-row">
        {showChrome && <Sidebar user={currentUser} />}
        <div className="flex-1 flex flex-col overflow-hidden">
          {showChrome && (
            <div className="flex items-center justify-end px-4 py-1.5 border-b border-gray-100 bg-white shrink-0">
              <NotificationBar />
            </div>
          )}
          <main className="flex-1 overflow-auto">{children}</main>
        </div>
        {showChrome && <BugReporter />}
        {showChrome && <ActivityTracker />}
        <ErrorCapture />
        {showChrome && <AutoRefresh intervalMs={60000} />}
      </body>
    </html>
  );
}
