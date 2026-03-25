"use client";

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
  LogOut,
} from "lucide-react";

const navigation = [
  { name: "Dashboard", href: "/", icon: LayoutDashboard },
  { name: "Solicitations", href: "/solicitations", icon: FileSearch },
  { name: "Orders", href: "/orders", icon: ShoppingCart },
  { name: "Purchase Orders", href: "/purchase-orders", icon: Package },
  { name: "Shipping", href: "/shipping", icon: Truck },
  { name: "Invoicing", href: "/invoicing", icon: Receipt },
  { name: "Analytics", href: "/analytics", icon: BarChart3 },
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

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="flex h-full w-64 flex-col bg-sidebar-bg">
      {/* Logo */}
      <div className="flex h-16 items-center gap-3 px-6 border-b border-white/10">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-sidebar-active text-white font-bold text-lg">
          D
        </div>
        <div>
          <h1 className="text-lg font-bold text-white tracking-tight">DIBS</h1>
          <p className="text-xs text-sidebar-text/60">Gov Bidding System</p>
        </div>
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

      {/* User + Logout */}
      <div className="border-t border-white/10 px-4 py-4">
        {user && (
          <div className="flex items-center justify-between">
            <div className="min-w-0">
              <p className="text-sm text-white font-medium truncate">
                {user.profile?.full_name || user.user.email}
              </p>
              <p className="text-xs text-sidebar-text/50 capitalize">
                {user.profile?.role || "viewer"}
              </p>
            </div>
            <button
              onClick={handleLogout}
              title="Sign out"
              className="text-sidebar-text/50 hover:text-white p-1.5 rounded-lg hover:bg-sidebar-hover transition-colors"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
