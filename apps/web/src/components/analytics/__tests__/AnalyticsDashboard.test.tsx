import "@testing-library/jest-dom";
import { fireEvent, render, screen } from "@testing-library/react";

import { AnalyticsDashboard } from "../AnalyticsDashboard";
import { generateMarketStats } from "@/lib/mock/analytics";

describe("AnalyticsDashboard", () => {
  describe("rendering", () => {
    it("renders KPI cards with market summary", () => {
      render(<AnalyticsDashboard />);

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

    it("renders the filter panel", () => {
      render(<AnalyticsDashboard />);
      expect(screen.getByText("Filters")).toBeInTheDocument();
      expect(screen.getByText(/no filters applied/i)).toBeInTheDocument();
    });

    it("accepts pre-fetched stats (deterministic rendering)", () => {
      const stats = generateMarketStats(123);
      render(<AnalyticsDashboard initialStats={stats} />);

      const expectedPrice = new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: 0,
      }).format(stats.kpis.avg_price);

      expect(screen.getByText(expectedPrice)).toBeInTheDocument();
    });

    it("generates mock data when no initial stats provided", () => {
      render(<AnalyticsDashboard />);

      const dollarElements = screen.getAllByText(/\$/);
      expect(dollarElements.length).toBeGreaterThan(0);
    });

    it("renders KPI with correct structure", () => {
      const stats = generateMarketStats(42);
      render(<AnalyticsDashboard initialStats={stats} />);

      expect(screen.getByText(/\/sqft/)).toBeInTheDocument();
    });
  });

  describe("filter integration", () => {
    const getKpiValue = (label: string): string | null => {
      const labelEl = screen.getByText(label);
      const card = labelEl.closest(".flex.flex-col.gap-2");
      if (!card) return null;
      const valueDiv = card.querySelector(".text-2xl");
      return valueDiv?.textContent ?? null;
    };

    it("updates KPI values when filters change (mock data regeneration)", () => {
      render(<AnalyticsDashboard />);

      const initialAvgPrice = getKpiValue("Average Price");

      const slider = screen.getByLabelText("Min Bedrooms range slider");
      fireEvent.change(slider, { target: { value: "5" } });

      const updatedAvgPrice = getKpiValue("Average Price");

      expect(updatedAvgPrice).not.toBe(initialAvgPrice);
    });

    it("shows active filter count when filters are applied", () => {
      render(<AnalyticsDashboard />);

      const slider = screen.getByLabelText("Min Bedrooms range slider");
      fireEvent.change(slider, { target: { value: "4" } });

      expect(screen.getByText("1 filter active")).toBeInTheDocument();
    });

    it("resets filters when Clear all is clicked", () => {
      render(<AnalyticsDashboard />);

      const slider = screen.getByLabelText("Min Bedrooms range slider");
      fireEvent.change(slider, { target: { value: "4" } });

      expect(screen.getByText("1 filter active")).toBeInTheDocument();

      fireEvent.click(screen.getByText("Clear all"));

      expect(screen.getByText(/no filters applied/i)).toBeInTheDocument();
    });

    it("regenerates data deterministically with same filters", () => {
      const { rerender } = render(<AnalyticsDashboard />);

      const firstRenderPrice = getKpiValue("Average Price");

      rerender(<AnalyticsDashboard />);

      const secondRenderPrice = getKpiValue("Average Price");

      expect(firstRenderPrice).toBe(secondRenderPrice);
    });

    it("respects initialStats prop over filter-driven regeneration", () => {
      const stats = generateMarketStats(99);
      render(<AnalyticsDashboard initialStats={stats} />);

      const expectedPrice = new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: 0,
      }).format(stats.kpis.avg_price);

      const slider = screen.getByLabelText("Min Bedrooms range slider");
      fireEvent.change(slider, { target: { value: "5" } });

      expect(screen.getAllByText(expectedPrice).length).toBeGreaterThan(0);
    });
  });
});
