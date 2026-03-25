import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Sidebar } from "@/components/sidebar";
import { BugReporter } from "@/components/bug-reporter";
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

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const currentUser = await getCurrentUser().catch(() => null);
  const isLoggedIn = !!currentUser;

  // Check if user must reset password
  const hdrs = await headers();
  const pathname = hdrs.get("x-pathname") || hdrs.get("x-invoke-path") || "";
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

  const showChrome = isLoggedIn && !currentUser?.profile?.must_reset_password;

  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="h-full flex">
        {showChrome && <Sidebar user={currentUser} />}
        <main className="flex-1 overflow-auto">{children}</main>
        {showChrome && <BugReporter />}
      </body>
    </html>
  );
}
