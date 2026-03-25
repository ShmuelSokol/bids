"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  FileSearch,
  ShoppingCart,
  Truck,
  Receipt,
  BarChart3,
  Settings,
  Package,
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

export function Sidebar() {
  const pathname = usePathname();

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
          const isActive = pathname === item.href ||
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

      {/* Footer */}
      <div className="border-t border-white/10 px-4 py-4">
        <div className="text-xs text-sidebar-text/50">
          DIBS v0.1.0
        </div>
      </div>
    </div>
  );
}
