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
import { checkHealth, type HealthStatus } from "@/lib/server-fetch";

const ESTIMATOR_API_URL =
  process.env.ESTIMATOR_API_URL || "http://localhost:8001";
const ANALYTICS_API_URL =
  process.env.ANALYTICS_API_URL || "http://localhost:8002";

interface ServiceWithHealth {
  name: string;
  technology: string;
  port: number;
  role: string;
  healthEndpoint: string;
  health: HealthStatus;
}

export default async function HomePage() {
  const [estimatorHealth, analyticsHealth, mlHealth] = await Promise.all([
    checkHealth(`${ESTIMATOR_API_URL}/healthz`),
    checkHealth(`${ANALYTICS_API_URL}/actuator/health`),
    checkHealth(`${ESTIMATOR_API_URL}/model-info`).then(
      () => ({ status: "healthy" as const }),
      () => ({ status: "down" as const })
    ),
  ]);

  const healthMap: Record<string, HealthStatus> = {
    "Estimator API": estimatorHealth,
    "Analytics API": analyticsHealth,
    "ML Container": mlHealth,
  };

  const servicesWithHealth: ServiceWithHealth[] = SERVICES.map((svc) => ({
    ...svc,
    health: healthMap[svc.name] ?? { status: "down" as const },
  }));

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
          {servicesWithHealth.map((svc) => (
            <Card key={svc.name}>
              <CardHeader>
                <div className="flex items-center justify-between gap-2">
                  <CardTitle className="text-base">{svc.name}</CardTitle>
                  <div className="flex items-center gap-1.5">
                    <HealthBadge status={svc.health.status} />
                    <Badge variant="default">:{svc.port}</Badge>
                  </div>
                </div>
                <CardDescription>{svc.technology}</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-slate-600">{svc.role}</p>
                <p className="mt-2 text-xs text-slate-400">
                  Endpoint:{" "}
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

function HealthBadge({ status }: { status: HealthStatus["status"] }) {
  const variants = {
    healthy: {
      label: "Healthy",
      className: "bg-emerald-50 text-emerald-700 border-emerald-200",
      dot: "bg-emerald-500",
    },
    unhealthy: {
      label: "Degraded",
      className: "bg-amber-50 text-amber-700 border-amber-200",
      dot: "bg-amber-500",
    },
    down: {
      label: "Down",
      className: "bg-rose-50 text-rose-700 border-rose-200",
      dot: "bg-rose-500",
    },
  };

  const v = variants[status];

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${v.className}`}
      aria-label={`Service is ${status}`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${v.dot}`}
        aria-hidden="true"
      />
      {v.label}
    </span>
  );
}