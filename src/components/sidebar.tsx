"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  FileSearch,
  ShoppingCart,
  Truck,
  Receipt,
  BarChart3,
  Settings,
  Package,
  BookOpen,
  LogOut,
  Menu,
  X,
} from "lucide-react";

const navigation = [
  { name: "Dashboard", href: "/", icon: LayoutDashboard },
  { name: "Solicitations", href: "/solicitations", icon: FileSearch },
  { name: "Awards", href: "/orders", icon: ShoppingCart },
  { name: "Shipping", href: "/shipping", icon: Truck },
  { name: "Invoicing", href: "/invoicing", icon: Receipt },
  { name: "Analytics", href: "/analytics", icon: BarChart3 },
  { name: "Wiki", href: "/wiki", icon: BookOpen },
  { name: "Settings", href: "/settings", icon: Settings },
];

interface SidebarProps {
  user?: {
    user: { email?: string };
    profile: { full_name?: string; role?: string } | null;
  } | null;
}

export function Sidebar({ user }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  const navContent = (
    <>
      {/* Logo */}
      <div className="flex h-16 items-center gap-3 px-6 border-b border-white/10">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-sidebar-active text-white font-bold text-lg">
          D
        </div>
        <div className="flex-1">
          <h1 className="text-lg font-bold text-white tracking-tight">DIBS</h1>
          <p className="text-xs text-sidebar-text/60">Gov Bidding System</p>
        </div>
        {/* Mobile close button */}
        <button
          onClick={() => setMobileOpen(false)}
          className="md:hidden text-sidebar-text/60 hover:text-white p-1"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {navigation.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href !== "/" && pathname.startsWith(item.href));
          return (
            <Link
              key={item.name}
              href={item.href}
              onClick={() => setMobileOpen(false)}
              className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                isActive
                  ? "bg-sidebar-active text-white"
                  : "text-sidebar-text hover:bg-sidebar-hover hover:text-white"
              }`}
            >
              <item.icon className="h-5 w-5 shrink-0" />
              {item.name}
            </Link>
          );
        })}
      </nav>

      {/* User + Logout — always show logout button */}
      <div className="border-t border-white/10 px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-sidebar-hover text-white text-xs font-bold">
            {user ? (user.profile?.full_name || user.user?.email || "?")[0].toUpperCase() : "U"}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm text-white font-medium truncate">
              {user?.profile?.full_name || user?.user?.email || "Logged In"}
            </p>
            <p className="text-xs text-sidebar-text/50 capitalize">
              {user?.profile?.role || "user"}
            </p>
          </div>
          <button
            onClick={handleLogout}
            title="Sign out"
            className="text-sidebar-text/50 hover:text-white p-1.5 rounded-lg hover:bg-sidebar-hover transition-colors shrink-0"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </>
  );

  return (
    <>
      {/* Mobile header bar */}
      <div className="md:hidden flex h-14 items-center gap-3 px-4 bg-sidebar-bg">
        <button
          onClick={() => setMobileOpen(true)}
          className="text-white p-1.5"
        >
          <Menu className="h-6 w-6" />
        </button>
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sidebar-active text-white font-bold text-sm">
          D
        </div>
        <h1 className="text-base font-bold text-white">DIBS</h1>
      </div>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="md:hidden fixed inset-0 bg-black/50 z-40"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Mobile slide-out sidebar */}
      <div
        className={`md:hidden fixed inset-y-0 left-0 z-50 w-64 bg-sidebar-bg transform transition-transform duration-200 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex h-full flex-col">{navContent}</div>
      </div>

      {/* Desktop sidebar */}
      <div className="hidden md:flex h-full w-64 flex-col bg-sidebar-bg shrink-0">
        {navContent}
      </div>
    </>
  );
}
