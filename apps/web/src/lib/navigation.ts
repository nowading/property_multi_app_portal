import type { LucideIcon } from "lucide-react";
import { BarChart3, Calculator, Home } from "lucide-react";

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  description: string;
}

/**
 * Primary portal navigation items shared by Sidebar and mobile nav.
 * Order is significant for rendering and tests.
 */
export const NAV_ITEMS: readonly NavItem[] = [
  {
    label: "Home",
    href: "/",
    icon: Home,
    description: "Portal overview and service status",
  },
  {
    label: "Estimator",
    href: "/estimator",
    icon: Calculator,
    description: "Property value estimation powered by FastAPI",
  },
  {
    label: "Analytics",
    href: "/analytics",
    icon: BarChart3,
    description: "Market analysis dashboard powered by Spring Boot",
  },
] as const;
