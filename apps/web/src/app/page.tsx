import Link from "next/link";
import { ArrowRight, BarChart3, Calculator, Server } from "lucide-react";

import { Badge } from "@/components/ui/Badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/Card";
import { APP_ENTRIES, SERVICES } from "@/lib/services";

/**
 * Portal landing page (React Server Component).
 *
 * Renders the portal overview, two application entry cards, and the
 * underlying service architecture. No client interactivity — all links
 * are server-rendered anchors via `next/link`.
 */
export default function HomePage() {
  return (
    <div className="flex flex-col gap-10">
      {/* Hero */}
      <section className="flex flex-col gap-3">
        <Badge variant="primary" className="w-fit">
          Next.js · FastAPI · Spring Boot · ML
        </Badge>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900 md:text-4xl">
          Property Multi-App Portal
        </h1>
        <p className="max-w-2xl text-base text-slate-600">
          A unified portal hosting two independent applications: a property
          value estimator backed by FastAPI, and a market analysis dashboard
          backed by Spring Boot. Both integrate with a shared ML regression
          model container.
        </p>
      </section>

      {/* App entries */}
      <section className="flex flex-col gap-4">
        <h2 className="text-xl font-semibold text-slate-900">Applications</h2>
        <div className="grid gap-4 md:grid-cols-2">
          {APP_ENTRIES.map((app) => {
            const Icon = app.href === "/estimator" ? Calculator : BarChart3;
            const shortName =
              app.href.charAt(1).toUpperCase() + app.href.slice(2);
            return (
              <Card key={app.href} className="flex flex-col">
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-50 text-primary-600">
                      <Icon className="h-5 w-5" aria-hidden="true" />
                    </span>
                    <CardTitle>{app.title}</CardTitle>
                  </div>
                  <CardDescription>{app.description}</CardDescription>
                </CardHeader>
                <CardContent className="flex-1">
                  <ul className="flex flex-col gap-1.5">
                    {app.highlights.map((h) => (
                      <li
                        key={h}
                        className="flex items-start gap-2 text-sm text-slate-600"
                      >
                        <span
                          className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-primary-400"
                          aria-hidden="true"
                        />
                        {h}
                      </li>
                    ))}
                  </ul>
                </CardContent>
                <CardFooter>
                  <Link
                    href={app.href}
                    className="inline-flex items-center gap-1.5 text-sm font-medium text-primary-600 hover:text-primary-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2"
                  >
                    Open {shortName}
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </Link>
                </CardFooter>
              </Card>
            );
          })}
        </div>
      </section>

      {/* Service architecture */}
      <section className="flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <Server className="h-5 w-5 text-slate-400" aria-hidden="true" />
          <h2 className="text-xl font-semibold text-slate-900">
            Service Architecture
          </h2>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {SERVICES.map((svc) => (
            <Card key={svc.name}>
              <CardHeader>
                <div className="flex items-center justify-between gap-2">
                  <CardTitle className="text-base">{svc.name}</CardTitle>
                  <Badge variant="default">:{svc.port}</Badge>
                </div>
                <CardDescription>{svc.technology}</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-slate-600">{svc.role}</p>
                <p className="mt-2 text-xs text-slate-400">
                  Health:{" "}
                  <code className="font-mono">{svc.healthEndpoint}</code>
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}
