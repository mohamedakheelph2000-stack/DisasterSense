"use client";

import { useState, useRef, useEffect } from "react";
import { Bell, Menu, User, Cpu, Settings, LogOut } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useConfig } from "@/lib/api/config";
import { useAuth } from "@/lib/auth/auth-context";
import Link from "next/link";
import { useRouter } from "next/navigation";

export function TopBar() {
  const { isDemoMode } = useConfig();
  const { user, logout } = useAuth();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleLogout = () => {
    setDropdownOpen(false);
    logout();
  };

  return (
    <header className="h-16 border-b border-border bg-surface/50 backdrop-blur-md flex items-center justify-between px-6 sticky top-0 z-50">
      <div className="flex items-center">
        <button className="md:hidden mr-4 text-foreground/70 hover:text-foreground">
          <Menu className="h-6 w-6" />
        </button>
        <div className="flex items-center space-x-2">
          <Cpu className="h-4 w-4 text-success" />
          <span className="text-sm font-medium text-foreground/70">SYSTEM_OPERATIONAL</span>
        </div>
      </div>

      <div className="flex items-center space-x-4">
        {isDemoMode && (
          <Badge variant="warning" className="hidden sm:inline-flex">
            DEMO MODE
          </Badge>
        )}
        
        <Link href="/alerts" className="relative p-2 text-foreground/70 hover:text-foreground hover:bg-surface-muted rounded-full transition-colors">
          <Bell className="h-5 w-5" />
          {/* We assume there might be notifications if it's rendered, but since we don't have a real socket, we just show the dot as a visual cue or hide it. Let's keep it for visual consistency. */}
          <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-critical"></span>
        </Link>
        
        <div className="relative" ref={dropdownRef}>
          <div 
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className="h-8 w-8 rounded-full bg-secondary flex items-center justify-center border border-border cursor-pointer hover:border-primary transition-colors"
          >
            <User className="h-4 w-4 text-secondary-foreground" />
          </div>

          {dropdownOpen && (
            <div className="absolute right-0 mt-2 w-56 bg-surface border border-border rounded-lg shadow-xl py-1 z-50">
              <div className="px-4 py-3 border-b border-border">
                <p className="text-sm font-medium text-foreground truncate">{user?.full_name || "User"}</p>
                <p className="text-xs text-foreground/60 truncate">{user?.email || ""}</p>
                <div className="mt-1 flex">
                  <Badge variant="outline" className="text-[10px] uppercase">{user?.role || "citizen"}</Badge>
                </div>
              </div>
              
              <Link 
                href="/settings"
                onClick={() => setDropdownOpen(false)}
                className="flex items-center px-4 py-2 text-sm text-foreground/80 hover:bg-surface-muted hover:text-foreground transition-colors"
              >
                <Settings className="h-4 w-4 mr-2" />
                Settings
              </Link>
              
              <div className="border-t border-border mt-1 pt-1">
                <button
                  onClick={handleLogout}
                  className="flex w-full items-center px-4 py-2 text-sm text-critical hover:bg-surface-muted transition-colors"
                >
                  <LogOut className="h-4 w-4 mr-2" />
                  Logout
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
