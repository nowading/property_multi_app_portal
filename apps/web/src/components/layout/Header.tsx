import Link from "next/link";

import { Building2 } from "lucide-react";

/**
 * Top application bar.
 * Server component — no client interactivity required.
 */
export function Header() {
  return (
    <header
      className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-slate-200 bg-white/95 px-4 backdrop-blur md:px-6"
      role="banner"
    >
      <Link
        href="/"
        className="flex items-center gap-2 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2"
        aria-label="Property Portal home"
      >
        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary-600 text-white">
          <Building2 className="h-5 w-5" aria-hidden="true" />
        </span>
        <span className="flex flex-col leading-none">
          <span className="text-base font-semibold text-slate-900">
            Property Portal
          </span>
          <span className="text-xs text-slate-500">
            Estimator &amp; Analytics
          </span>
        </span>
      </Link>
    </header>
  );
}
