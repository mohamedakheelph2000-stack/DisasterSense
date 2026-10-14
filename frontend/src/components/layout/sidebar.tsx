"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import {
  LayoutDashboard,
  Map as MapIcon,
  Activity,
  AlertTriangle,
  History,
  ShieldAlert,
  Settings,
  BarChart2,
  Server,
  Database,
  Building2,
  Radar,
  Siren,
  Rss,
  CloudSun,
  type LucideIcon,
} from "lucide-react";
import { useAuth } from "@/lib/auth/auth-context";
import { cn } from "@/lib/utils";

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  roles?: string[];
}

interface NavGroup {
  heading: string;
  /** When set, only these roles see the group. */
  roles?: string[];
  items: NavItem[];
}

const GROUPS: NavGroup[] = [
  {
    heading: "Command",
    items: [
      { href: "/", label: "Dashboard", icon: LayoutDashboard },
      { href: "/weather", label: "Weather Forecast", icon: CloudSun },
      { href: "/warnings", label: "Warnings", icon: Siren },
      { href: "/map", label: "Live Map", icon: MapIcon },
      { href: "/alerts", label: "Incidents", icon: AlertTriangle },
    ],
  },
  {
    heading: "Operations",
    items: [
      { href: "/risk-assessment", label: "Risk Assessment", icon: Activity },
      { href: "/resources", label: "Resources", icon: Building2 },
      { href: "/events", label: "Event Log", icon: History },
      { href: "/analytics", label: "Analytics", icon: BarChart2 },
      { href: "/sources", label: "Data Sources", icon: Rss },
    ],
  },
  {
    heading: "Intelligence",
    roles: ["responder", "admin"],
    items: [
      { href: "/ml-intelligence", label: "ML Models", icon: Radar },
      { href: "/data-governance", label: "Data Governance", icon: Database },
    ],
  },
  {
    heading: "Administration",
    roles: ["admin"],
    items: [{ href: "/system", label: "System Telemetry", icon: Server }],
  },
];

export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const { user } = useAuth();
  const pathname = usePathname();
  const role = user?.role || "citizen";

  return (
    <div className="flex h-full w-64 flex-col border-r border-border bg-rail/95 backdrop-blur-md">
      {/* Brand */}
      <div className="flex h-16 shrink-0 items-center gap-3 border-b border-border px-5">
        <span className="relative flex h-8 w-8 items-center justify-center rounded-lg border border-primary/40 bg-primary/10">
          <ShieldAlert className="h-5 w-5 text-primary" />
          <span className="absolute -right-0.5 -top-0.5 h-2 w-2 animate-blink rounded-full bg-success shadow-[0_0_8px_hsl(var(--success))]" />
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold tracking-[0.14em] text-foreground">
            DISASTERSENSE
          </p>
          <p className="hud-label truncate">Operations Console</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-5">
        {GROUPS.filter((group) => !group.roles || group.roles.includes(role)).map(
          (group) => (
            <div key={group.heading}>
              <p className="eyebrow mb-2 px-2.5">{group.heading}</p>
              <ul className="space-y-1">
                {group.items.map((item) => {
                  const active =
                    item.href === "/"
                      ? pathname === "/"
                      : pathname === item.href || pathname.startsWith(`${item.href}/`);
                  const Icon = item.icon;

                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        onClick={onNavigate}
                        aria-current={active ? "page" : undefined}
                        className={cn(
                          "group relative flex items-center gap-3 rounded-lg px-2.5 py-2 text-[13px] transition-colors duration-200",
                          active
                            ? "text-primary"
                            : "text-foreground/60 hover:bg-surface/70 hover:text-foreground/90"
                        )}
                      >
                        {active && (
                          <motion.span
                            layoutId="sidebar-active"
                            transition={{ type: "spring", stiffness: 420, damping: 34 }}
                            className="absolute inset-0 rounded-lg border border-primary/25 bg-primary/10"
                          />
                        )}
                        <span className="relative z-10 flex items-center gap-3">
                          <Icon
                            className={cn(
                              "h-4 w-4 shrink-0 transition-colors",
                              active
                                ? "text-primary drop-shadow-[0_0_6px_hsl(var(--primary)/0.7)]"
                                : "text-foreground/45 group-hover:text-foreground/70"
                            )}
                          />
                          <span className="truncate">{item.label}</span>
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          )
        )}
      </nav>

      {/* Footer */}
      <div className="shrink-0 space-y-3 border-t border-border px-3 py-4">
        <Link
          href="/settings"
          onClick={onNavigate}
          className={cn(
            "flex items-center gap-3 rounded-lg px-2.5 py-2 text-[13px] transition-colors",
            pathname === "/settings"
              ? "bg-primary/10 text-primary"
              : "text-foreground/60 hover:bg-surface/70 hover:text-foreground"
          )}
        >
          <Settings className="h-4 w-4" />
          Settings
        </Link>

        <div className="rounded-lg border border-border/70 bg-surface/60 px-3 py-2.5">
          <div className="flex items-center justify-between">
            <span className="hud-label">Signed in</span>
            <span className="flex h-1.5 w-1.5 rounded-full bg-success shadow-[0_0_6px_hsl(var(--success))]" />
          </div>
          <p className="mt-1 truncate text-xs font-medium text-foreground/85">
            {user?.full_name || "Operator"}
          </p>
          <p className="truncate text-[11px] text-muted-foreground">
            {user?.role?.toUpperCase() || "CITIZEN"} · {user?.email}
          </p>
        </div>
      </div>
    </div>
  );
}
