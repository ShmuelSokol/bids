import type { LucideIcon } from "lucide-react";

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  trend?: { value: number; label: string };
  color?: "blue" | "green" | "yellow" | "red";
}

const colorMap = {
  blue: "bg-blue-50 text-blue-600",
  green: "bg-green-50 text-green-600",
  yellow: "bg-yellow-50 text-yellow-600",
  red: "bg-red-50 text-red-600",
};

export function StatCard({ title, value, subtitle, icon: Icon, trend, color = "blue" }: StatCardProps) {
  return (
    <div className="rounded-xl border border-card-border bg-card-bg p-6 shadow-sm">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-muted">{title}</p>
          <p className="mt-2 text-3xl font-bold tracking-tight">{value}</p>
          {subtitle && (
            <p className="mt-1 text-sm text-muted">{subtitle}</p>
          )}
          {trend && (
            <p className={`mt-2 text-sm font-medium ${trend.value >= 0 ? "text-green-600" : "text-red-600"}`}>
              {trend.value >= 0 ? "+" : ""}{trend.value}% {trend.label}
            </p>
          )}
        </div>
        <div className={`rounded-lg p-3 ${colorMap[color]}`}>
          <Icon className="h-6 w-6" />
        </div>
      </div>
    </div>
  );
}
