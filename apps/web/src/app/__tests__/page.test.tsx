import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";

import HomePage from "../page";

describe("HomePage (landing)", () => {
  it("renders the portal title and description", () => {
    render(<HomePage />);
    expect(
      screen.getByRole("heading", { level: 1, name: /property multi-app portal/i })
    ).toBeInTheDocument();
    expect(
      screen.getByText(/unified portal hosting two independent applications/i)
    ).toBeInTheDocument();
  });

  it("renders both application entry cards with links", () => {
    render(<HomePage />);
    const estimatorLink = screen.getByRole("link", { name: /open estimator/i });
    const analyticsLink = screen.getByRole("link", { name: /open analytics/i });
    expect(estimatorLink).toHaveAttribute("href", "/estimator");
    expect(analyticsLink).toHaveAttribute("href", "/analytics");
  });

  it("renders the Applications section heading", () => {
    render(<HomePage />);
    expect(
      screen.getByRole("heading", { level: 2, name: /applications/i })
    ).toBeInTheDocument();
  });

  it("renders the Service Architecture section with all three services", () => {
    render(<HomePage />);
    expect(
      screen.getByRole("heading", { level: 2, name: /service architecture/i })
    ).toBeInTheDocument();
    expect(screen.getByText("Estimator API")).toBeInTheDocument();
    expect(screen.getByText("Analytics API")).toBeInTheDocument();
    expect(screen.getByText("ML Container")).toBeInTheDocument();
  });

  it("renders port badges for each service", () => {
    render(<HomePage />);
    expect(screen.getByText(":8001")).toBeInTheDocument();
    expect(screen.getByText(":8002")).toBeInTheDocument();
    expect(screen.getByText(":8000")).toBeInTheDocument();
  });

  it("renders health endpoint codes for each service", () => {
    render(<HomePage />);
    expect(screen.getByText("/healthz")).toBeInTheDocument();
    expect(screen.getByText("/actuator/health")).toBeInTheDocument();
    expect(screen.getByText("/health")).toBeInTheDocument();
  });

  it("renders all app highlights as list items", () => {
    render(<HomePage />);
    // Estimator highlights
    expect(screen.getByText("7-feature input form with validation")).toBeInTheDocument();
    expect(screen.getByText("History & comparison tools")).toBeInTheDocument();
    // Analytics highlights
    expect(screen.getByText("Interactive dashboard & filters")).toBeInTheDocument();
    expect(screen.getByText("CSV / PDF export")).toBeInTheDocument();
  });
});
