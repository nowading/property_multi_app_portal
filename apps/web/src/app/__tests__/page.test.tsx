import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";

jest.mock("@/lib/server-fetch", () => ({
  checkHealth: jest.fn().mockResolvedValue({ status: "healthy" }),
}));

import { checkHealth } from "@/lib/server-fetch";

import HomePage from "../page";

const mockCheckHealth = checkHealth as jest.MockedFunction<typeof checkHealth>;

beforeEach(() => {
  mockCheckHealth.mockReset();
  mockCheckHealth.mockResolvedValue({ status: "healthy" });
});

describe("HomePage (landing)", () => {
  it("renders the portal title and description", async () => {
    const page = await HomePage();
    render(page);
    expect(
      screen.getByRole("heading", { level: 1, name: /property multi-app portal/i })
    ).toBeInTheDocument();
    expect(
      screen.getByText(/unified portal hosting two independent applications/i)
    ).toBeInTheDocument();
  });

  it("renders both application entry cards with links", async () => {
    const page = await HomePage();
    render(page);
    const estimatorLink = screen.getByRole("link", { name: /open estimator/i });
    const analyticsLink = screen.getByRole("link", { name: /open analytics/i });
    expect(estimatorLink).toHaveAttribute("href", "/estimator");
    expect(analyticsLink).toHaveAttribute("href", "/analytics");
  });

  it("renders the Applications section heading", async () => {
    const page = await HomePage();
    render(page);
    expect(
      screen.getByRole("heading", { level: 2, name: /applications/i })
    ).toBeInTheDocument();
  });

  it("renders the Service Architecture section with all three services", async () => {
    const page = await HomePage();
    render(page);
    expect(
      screen.getByRole("heading", { level: 2, name: /service architecture/i })
    ).toBeInTheDocument();
    expect(screen.getByText("Estimator API")).toBeInTheDocument();
    expect(screen.getByText("Analytics API")).toBeInTheDocument();
    expect(screen.getByText("ML Container")).toBeInTheDocument();
  });

  it("renders port badges for each service", async () => {
    const page = await HomePage();
    render(page);
    expect(screen.getByText(":8001")).toBeInTheDocument();
    expect(screen.getByText(":8002")).toBeInTheDocument();
    expect(screen.getByText(":8000")).toBeInTheDocument();
  });

  it("renders health endpoint codes for each service", async () => {
    const page = await HomePage();
    render(page);
    expect(screen.getByText("/healthz")).toBeInTheDocument();
    expect(screen.getByText("/actuator/health")).toBeInTheDocument();
    expect(screen.getByText("/health")).toBeInTheDocument();
  });

  it("renders all app highlights as list items", async () => {
    const page = await HomePage();
    render(page);
    // Estimator highlights
    expect(screen.getByText("7-feature input form with validation")).toBeInTheDocument();
    expect(screen.getByText("History & comparison tools")).toBeInTheDocument();
    // Analytics highlights
    expect(screen.getByText("Interactive dashboard & filters")).toBeInTheDocument();
    expect(screen.getByText("CSV / PDF export")).toBeInTheDocument();
  });

  it("shows healthy status badges when all services are up", async () => {
    mockCheckHealth.mockResolvedValue({ status: "healthy" });
    const page = await HomePage();
    render(page);
    expect(screen.getAllByText("Healthy").length).toBe(3);
  });

  it("shows degraded status badge when a service is unhealthy", async () => {
    mockCheckHealth.mockImplementation((url: string) => {
      if (url.includes("/healthz")) {
        return Promise.resolve({ status: "unhealthy", details: "HTTP 503" });
      }
      return Promise.resolve({ status: "healthy" });
    });
    const page = await HomePage();
    render(page);
    expect(screen.getByText("Degraded")).toBeInTheDocument();
  });

  it("shows down status badge when a service is unreachable", async () => {
    mockCheckHealth.mockImplementation((url: string) => {
      if (url.includes("/actuator/health")) {
        return Promise.resolve({ status: "down" });
      }
      return Promise.resolve({ status: "healthy" });
    });
    const page = await HomePage();
    render(page);
    expect(screen.getByText("Down")).toBeInTheDocument();
  });
});