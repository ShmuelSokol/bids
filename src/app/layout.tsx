import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Sidebar } from "@/components/sidebar";
import { BugReporter } from "@/components/bug-reporter";
import { getCurrentUser } from "@/lib/supabase-server";
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

  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="h-full flex">
        {isLoggedIn && <Sidebar user={currentUser} />}
        <main className="flex-1 overflow-auto">{children}</main>
        {isLoggedIn && <BugReporter />}
      </body>
    </html>
  );
}
