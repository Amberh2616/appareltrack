"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  FileText,
  Package,
  Shirt,
  ShoppingCart,
  Mail,
  Bot,
  Settings,
  User,
  Users,
  ChevronLeft,
  ChevronRight,
  Upload,
  Columns3,
  GanttChart,
  ClipboardList,
  Truck,
  Building2,
  Boxes,
  Activity,
  Calculator,
  Ruler,
  Tag,
  Layers,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";

const navigation = [
  { name: "Progress", href: "/dashboard/progress", icon: Activity },
  { name: "Styles", href: "/dashboard/styles", icon: Layers },
  { name: "Upload", href: "/dashboard/upload", icon: Upload },
  { name: "Documents", href: "/dashboard/tech-packs", icon: FileText },
  { name: "BOM", href: "/dashboard/bom", icon: Package },
  { name: "Spec", href: "/dashboard/spec", icon: Ruler },
  { name: "Costing", href: "/dashboard/costing", icon: Calculator },
  { name: "Samples", href: "/dashboard/samples", icon: Shirt },
  { name: "Kanban", href: "/dashboard/samples/kanban", icon: Columns3 },
  { name: "Scheduler", href: "/dashboard/scheduler", icon: GanttChart },
  { name: "Production", href: "/dashboard/production-orders", icon: ClipboardList },
  { name: "Purchase Orders", href: "/dashboard/purchase-orders", icon: Truck },
  { name: "Suppliers", href: "/dashboard/suppliers", icon: Building2 },
  { name: "Materials", href: "/dashboard/materials", icon: Boxes },
  { name: "Brands", href: "/dashboard/brands", icon: Tag },
];

const bottomNavigation = [
  { name: "AI Review", href: "/dashboard/ai-review", icon: Bot, badge: 3 },
  { name: "Users", href: "/dashboard/settings/users", icon: Users },
  { name: "Settings", href: "/dashboard/settings", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div
      className={cn(
        "flex flex-col h-screen bg-sidebar text-sidebar-foreground transition-all duration-300",
        collapsed ? "w-16" : "w-64"
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between h-16 px-4 border-b border-sidebar-border">
        {!collapsed && (
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center font-bold">
              F
            </div>
            <span className="font-semibold text-lg">Fashion PLM</span>
          </div>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="p-1 hover:bg-sidebar-border rounded-md transition-colors"
        >
          {collapsed ? (
            <ChevronRight className="w-5 h-5" />
          ) : (
            <ChevronLeft className="w-5 h-5" />
          )}
        </button>
      </div>

      {/* Main Navigation */}
      <nav className="flex-1 px-2 py-4 space-y-1 overflow-y-auto">
        {navigation.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors text-sm font-medium",
                isActive
                  ? "bg-sidebar-accent text-sidebar-foreground"
                  : "text-sidebar-muted hover:bg-sidebar-border hover:text-sidebar-foreground"
              )}
              title={collapsed ? item.name : undefined}
            >
              <item.icon className="w-5 h-5 flex-shrink-0" />
              {!collapsed && <span>{item.name}</span>}
            </Link>
          );
        })}
      </nav>

      {/* Divider */}
      <div className="border-t border-sidebar-border" />

      {/* Bottom Navigation */}
      <nav className="px-2 py-4 space-y-1">
        {bottomNavigation.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors text-sm font-medium relative",
                isActive
                  ? "bg-sidebar-accent text-sidebar-foreground"
                  : "text-sidebar-muted hover:bg-sidebar-border hover:text-sidebar-foreground"
              )}
              title={collapsed ? item.name : undefined}
            >
              <item.icon className="w-5 h-5 flex-shrink-0" />
              {!collapsed && <span>{item.name}</span>}
              {item.badge && !collapsed && (
                <span className="ml-auto bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                  {item.badge}
                </span>
              )}
              {item.badge && collapsed && (
                <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
              )}
            </Link>
          );
        })}
      </nav>

      {/* User Profile */}
      <div className="border-t border-sidebar-border p-4">
        <Link
          href="/dashboard/profile"
          className="flex items-center gap-3 px-2 py-2 hover:bg-sidebar-border rounded-lg transition-colors"
        >
          <div className="w-8 h-8 bg-gradient-to-br from-green-400 to-blue-500 rounded-full flex items-center justify-center flex-shrink-0">
            <User className="w-4 h-4" />
          </div>
          {!collapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">Amber</p>
              <p className="text-xs text-sidebar-muted truncate">Admin</p>
            </div>
          )}
        </Link>
      </div>
    </div>
  );
}
