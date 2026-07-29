"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { NAV_ITEMS } from "@/lib/navigation";

/**
 * Left navigation rail.
 * Client component because it needs `usePathname` to highlight the active link.
 */
export function Sidebar() {
  const pathname = usePathname();

  return (
    <nav
      className="flex w-64 shrink-0 flex-col gap-1 border-r border-slate-200 bg-slate-50 p-3"
      aria-label="Primary navigation"
    >
      {NAV_ITEMS.map((item) => {
        const Icon = item.icon;
        const isActive =
          item.href === "/"
            ? pathname === "/"
            : pathname === item.href || pathname.startsWith(`${item.href}/`);

        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={isActive ? "page" : undefined}
            className={
              "flex items-start gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 " +
              (isActive
                ? "bg-primary-50 text-primary-700 font-medium"
                : "text-slate-600 hover:bg-slate-100 hover:text-slate-900")
            }
          >
            <Icon
              className={
                "mt-0.5 h-5 w-5 shrink-0 " +
                (isActive ? "text-primary-600" : "text-slate-400")
              }
              aria-hidden="true"
            />
            <span className="flex flex-col">
              <span>{item.label}</span>
              <span className="text-xs text-slate-400">{item.description}</span>
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
