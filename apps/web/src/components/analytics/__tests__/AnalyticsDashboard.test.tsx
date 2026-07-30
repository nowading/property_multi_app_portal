import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";

import { AnalyticsDashboard } from "../AnalyticsDashboard";
import { generateMarketStats } from "@/lib/mock/analytics";

describe("AnalyticsDashboard", () => {
  it("renders KPI cards with market summary", () => {
    render(<AnalyticsDashboard />);

    // All 4 KPI labels should be present
    expect(screen.getByText("Total Listings")).toBeInTheDocument();
    expect(screen.getByText("Average Price")).toBeInTheDocument();
    expect(screen.getByText("Median Price")).toBeInTheDocument();
    expect(screen.getByText("Price Range")).toBeInTheDocument();
  });

  it("renders chart sections", () => {
    render(<AnalyticsDashboard />);

    expect(screen.getByText("Price Distribution")).toBeInTheDocument();
    expect(screen.getByText("Price vs. Square Footage")).toBeInTheDocument();
    expect(screen.getByText("Price Range by Bedroom Count")).toBeInTheDocument();
  });

  it("accepts pre-fetched stats (deterministic rendering)", () => {
    const stats = generateMarketStats(123);
    render(<AnalyticsDashboard initialStats={stats} />);

    // The dashboard should render with the provided data
    // Check that the average price from seed 123 is displayed
    const expectedPrice = new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    }).format(stats.kpis.avg_price);

    expect(screen.getByText(expectedPrice)).toBeInTheDocument();
  });

  it("generates mock data when no initial stats provided", () => {
    render(<AnalyticsDashboard />);

    // Should still show KPI values (formatted prices include $)
    const dollarElements = screen.getAllByText(/\$/);
    expect(dollarElements.length).toBeGreaterThan(0);
  });

  it("renders KPI with correct structure", () => {
    const stats = generateMarketStats(42);
    render(<AnalyticsDashboard initialStats={stats} />);

    // Average price should include the per-sqft trend
    expect(screen.getByText(/\/sqft/)).toBeInTheDocument();
  });
});
