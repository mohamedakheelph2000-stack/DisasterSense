import Link from "next/link";
import { 
  LayoutDashboard, 
  Map as MapIcon, 
  Activity, 
  AlertTriangle,
  History,
  ShieldAlert,
  Settings,
  BarChart2,
  Server
} from "lucide-react";
import { useAuth } from "@/lib/auth/auth-context";
import { usePathname } from "next/navigation";

export function Sidebar() {
  const { user } = useAuth();
  const role = user?.role || "citizen";
  const pathname = usePathname();

  const isAdmin = role === "admin";
  const isResponder = role === "responder" || isAdmin;

  const getLinkClass = (path: string) => {
    const isActive = pathname === path;
    return `flex items-center space-x-3 px-3 py-2.5 rounded-md transition-colors ${
      isActive 
        ? "bg-primary/10 text-primary font-medium" 
        : "text-foreground/70 hover:bg-surface hover:text-foreground font-medium"
    }`;
  };

  return (
    <aside className="w-64 border-r border-border bg-surface-muted/50 hidden md:flex flex-col backdrop-blur-sm">
      <div className="h-16 flex items-center px-6 border-b border-border">
        <ShieldAlert className="h-6 w-6 text-primary mr-3" />
        <span className="font-bold text-lg tracking-wider">DISASTERSENSE</span>
      </div>
      
      <nav className="flex-1 py-6 px-4 space-y-2 overflow-y-auto">
        <p className="px-2 text-xs font-semibold text-foreground/40 uppercase tracking-wider mb-4">Command Center</p>
        
        <Link href="/" className={getLinkClass("/")}>
          <LayoutDashboard className="h-5 w-5" />
          <span>Dashboard</span>
        </Link>
        <Link href="/map" className={getLinkClass("/map")}>
          <MapIcon className="h-5 w-5" />
          <span>Live Map</span>
        </Link>
        
        {isResponder && (
          <Link href="/alerts" className={getLinkClass("/alerts")}>
            <AlertTriangle className="h-5 w-5" />
            <span>Incidents</span>
          </Link>
        )}
        
        {!isResponder && (
          <Link href="/alerts" className={getLinkClass("/alerts")}>
            <AlertTriangle className="h-5 w-5" />
            <span>Active Alerts</span>
          </Link>
        )}

        <Link href="/risk-assessment" className={getLinkClass("/risk-assessment")}>
          <Activity className="h-5 w-5" />
          <span>{isResponder ? "Risk Intelligence" : "Risk Assessment"}</span>
        </Link>
        
        <Link href="/analytics" className={getLinkClass("/analytics")}>
          <BarChart2 className="h-5 w-5" />
          <span>Analytics</span>
        </Link>

        <Link href="/events" className={getLinkClass("/events")}>
          <History className="h-5 w-5" />
          <span>Disaster Events</span>
        </Link>
        
        {isAdmin && (
          <>
            <Link href="/system" className={getLinkClass("/system")}>
              <Server className="h-5 w-5" />
              <span>System</span>
            </Link>
            <Link href="/ml-intelligence" className={getLinkClass("/ml-intelligence")}>
              <Activity className="h-5 w-5" />
              <span>ML Intelligence</span>
            </Link>
            <Link href="/data-governance" className={getLinkClass("/data-governance")}>
              <LayoutDashboard className="h-5 w-5" />
              <span>Data Governance</span>
            </Link>
          </>
        )}
      </nav>

      <div className="p-4 border-t border-border">
        <Link href="/settings" className={getLinkClass("/settings")}>
          <Settings className="h-5 w-5" />
          <span>Settings</span>
        </Link>
      </div>
    </aside>
  );
}
