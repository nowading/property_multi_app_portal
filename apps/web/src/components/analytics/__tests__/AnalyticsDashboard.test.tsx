import "@testing-library/jest-dom";
import { fireEvent, render, screen, act } from "@testing-library/react";

import { AnalyticsDashboard } from "../AnalyticsDashboard";
import { generateMarketStats } from "@/lib/mock/analytics";
import { generatePropertyDataset } from "@/lib/mock/dataset";
import type { StatsFilters } from "@/lib/schemas/analytics";

jest.mock("@/lib/api-analytics", () => ({
  fetchStats: jest.fn(),
  fetchDataset: jest.fn(),
}));

const apiAnalyticsMock = jest.requireMock("@/lib/api-analytics") as {
  fetchStats: jest.Mock;
  fetchDataset: jest.Mock;
};

jest.mock("next/navigation", () => {
  const replace = jest.fn();
  let searchParams = new URLSearchParams();

  return {
    useRouter: () => ({ replace }),
    useSearchParams: () => searchParams,
    __reset: () => {
      searchParams = new URLSearchParams();
      replace.mockClear();
    },
    __setSearchParams: (p: URLSearchParams) => {
      searchParams = p;
    },
    __routerReplace: replace,
  };
});

const navMock = jest.requireMock("next/navigation") as {
  __reset: () => void;
  __setSearchParams: (p: URLSearchParams) => void;
  __routerReplace: jest.Mock;
};

function setupDefaultMocks(seed: number = 42) {
  apiAnalyticsMock.fetchStats.mockImplementation(
    (filters?: StatsFilters) => {
      return Promise.resolve(generateMarketStats(seed, filters));
    }
  );

  apiAnalyticsMock.fetchDataset.mockImplementation(
    (page: number, pageSize: number, filters?: StatsFilters) => {
      const allRows = generatePropertyDataset(seed, filters);
      const start = (page - 1) * pageSize;
      const rows = allRows.slice(start, start + pageSize);
      return Promise.resolve({
        rows,
        total: allRows.length,
        page,
        page_size: pageSize,
      });
    }
  );
}

function getKpiValue(label: string): string | null {
  const labelEl = screen.getByText(label);
  const card = labelEl.closest(".flex.flex-col.gap-2");
  if (!card) return null;
  const valueDiv = card.querySelector(".text-2xl");
  return valueDiv?.textContent ?? null;
}

describe("AnalyticsDashboard", () => {
  beforeEach(() => {
    navMock.__reset();
    setupDefaultMocks();
  });

  describe("rendering", () => {
    it("renders KPI cards with market summary (with initialStats)", () => {
      const stats = generateMarketStats(42);
      render(<AnalyticsDashboard initialStats={stats} />);

      expect(screen.getByText("Total Listings")).toBeInTheDocument();
      expect(screen.getByText("Average Price")).toBeInTheDocument();
      expect(screen.getByText("Median Price")).toBeInTheDocument();
      expect(screen.getByText("Price Range")).toBeInTheDocument();
    });

    it("renders chart sections (with initialStats)", () => {
      const stats = generateMarketStats(42);
      render(<AnalyticsDashboard initialStats={stats} />);

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

    it("fetches and displays data when no initialStats provided", async () => {
      jest.useFakeTimers();

      render(<AnalyticsDashboard />);

      expect(screen.getByText("Loading market data...")).toBeInTheDocument();

      await act(async () => {
        jest.advanceTimersByTime(300);
        await Promise.resolve();
      });

      expect(screen.getByText("Total Listings")).toBeInTheDocument();
      expect(screen.getByText("Average Price")).toBeInTheDocument();

      const dollarElements = screen.getAllByText(/\$/);
      expect(dollarElements.length).toBeGreaterThan(0);

      jest.useRealTimers();
    });

    it("renders KPI with correct structure", () => {
      const stats = generateMarketStats(42);
      render(<AnalyticsDashboard initialStats={stats} />);

      expect(screen.getByText(/\/sqft/)).toBeInTheDocument();
    });

    it("reads initial filters from URL search params", () => {
      navMock.__setSearchParams(
        new URLSearchParams("bedrooms_min=3&distance_max=10")
      );

      render(<AnalyticsDashboard />);

      expect(screen.getByText("2 filters active")).toBeInTheDocument();
    });

    it("accepts initialFilters prop for pre-population", () => {
      render(<AnalyticsDashboard initialFilters={{ bedrooms_min: 2 }} />);

      expect(screen.getByText("1 filter active")).toBeInTheDocument();
    });
  });

  describe("filter integration", () => {
    it("updates KPI values when filters change (fetches new data)", async () => {
      jest.useFakeTimers();

      const stats = generateMarketStats(42);
      render(<AnalyticsDashboard initialStats={stats} />);

      const initialAvgPrice = getKpiValue("Average Price");

      const slider = screen.getByLabelText("Min Bedrooms range slider");
      fireEvent.change(slider, { target: { value: "5" } });

      await act(async () => {
        jest.advanceTimersByTime(300);
        await Promise.resolve();
      });

      const updatedAvgPrice = getKpiValue("Average Price");

      expect(updatedAvgPrice).not.toBe(initialAvgPrice);

      jest.useRealTimers();
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

    it("regenerates data deterministically with same filters (with initialStats)", () => {
      const stats = generateMarketStats(42);
      const { rerender } = render(
        <AnalyticsDashboard initialStats={stats} />
      );

      const firstRenderPrice = getKpiValue("Average Price");

      rerender(<AnalyticsDashboard initialStats={stats} />);

      const secondRenderPrice = getKpiValue("Average Price");

      expect(firstRenderPrice).toBe(secondRenderPrice);
    });

    it("respects initialStats prop before new data fetch completes", () => {
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

  describe("URL sync", () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it("updates URL when filters change (debounced)", () => {
      render(<AnalyticsDashboard />);

      const slider = screen.getByLabelText("Min Bedrooms range slider");
      fireEvent.change(slider, { target: { value: "4" } });

      expect(navMock.__routerReplace).not.toHaveBeenCalled();

      act(() => {
        jest.advanceTimersByTime(300);
      });

      expect(navMock.__routerReplace).toHaveBeenCalledTimes(1);
      expect(navMock.__routerReplace).toHaveBeenCalledWith(
        expect.stringContaining("bedrooms_min=4"),
        { scroll: false }
      );
    });

    it("clears URL params when all filters are reset", () => {
      navMock.__setSearchParams(new URLSearchParams("bedrooms_min=3"));
      render(<AnalyticsDashboard />);

      fireEvent.click(screen.getByText("Clear all"));

      act(() => {
        jest.advanceTimersByTime(300);
      });

      expect(navMock.__routerReplace).toHaveBeenCalledWith(
        expect.not.stringContaining("="),
        { scroll: false }
      );
    });

    it("debounces rapid filter changes (only last change takes effect)", () => {
      render(<AnalyticsDashboard />);

      const slider = screen.getByLabelText("Min Bedrooms range slider");

      fireEvent.change(slider, { target: { value: "2" } });
      fireEvent.change(slider, { target: { value: "5" } });
      fireEvent.change(slider, { target: { value: "3" } });

      act(() => {
        jest.advanceTimersByTime(300);
      });

      expect(navMock.__routerReplace).toHaveBeenCalledTimes(1);
      expect(navMock.__routerReplace).toHaveBeenCalledWith(
        expect.stringContaining("bedrooms_min=3"),
        { scroll: false }
      );
    });

    it("does not update URL on initial mount", () => {
      render(<AnalyticsDashboard />);

      act(() => {
        jest.advanceTimersByTime(300);
      });

      expect(navMock.__routerReplace).not.toHaveBeenCalled();
    });
  });
});