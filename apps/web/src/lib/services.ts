/**
 * Static service descriptors for the portal landing page.
 *
 * These describe the architecture (not live health). Live health is exposed
 * by each service's own `/healthz` or `/actuator/health` endpoint and is
 * checked at runtime by the backends themselves.
 */
export interface ServiceDescriptor {
  name: string;
  technology: string;
  port: number;
  role: string;
  healthEndpoint: string;
}

export const SERVICES: readonly ServiceDescriptor[] = [
  {
    name: "Estimator API",
    technology: "Python 3.12 · FastAPI",
    port: 8001,
    role: "Property value estimation — integrates with ML model",
    healthEndpoint: "/healthz",
  },
  {
    name: "Analytics API",
    technology: "Java 21 · Spring Boot 3.4.4",
    port: 8002,
    role: "Market statistics, segments & what-if analysis",
    healthEndpoint: "/actuator/health",
  },
  {
    name: "ML Container",
    technology: "Python · Dockerised FastAPI",
    port: 8000,
    role: "Regression model serving /predict, /predict/batch, /model-info",
    healthEndpoint: "/health",
  },
] as const;

export interface AppEntry {
  title: string;
  href: string;
  description: string;
  highlights: string[];
}

export const APP_ENTRIES: readonly AppEntry[] = [
  {
    title: "Property Value Estimator",
    href: "/estimator",
    description:
      "Submit property features and receive an estimated value with a feature-contribution breakdown, history, and side-by-side compare.",
    highlights: [
      "7-feature input form with validation",
      "Tabular + chart result view",
      "History & comparison tools",
    ],
  },
  {
    title: "Property Market Analysis",
    href: "/analytics",
    description:
      "Explore the housing dataset through KPIs, charts, and a what-if simulator. Filter, sort, and export insights.",
    highlights: [
      "Interactive dashboard & filters",
      "What-if analysis with live prediction",
      "CSV / PDF export",
    ],
  },
] as const;
