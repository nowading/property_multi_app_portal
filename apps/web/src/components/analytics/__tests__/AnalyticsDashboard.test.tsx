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
        new URLSearchParams("bedroomsMin=3&distanceMax=10")
      );

      render(<AnalyticsDashboard />);

      expect(screen.getByText("2 filters active")).toBeInTheDocument();
    });

    it("accepts initialFilters prop for pre-population", () => {
      render(<AnalyticsDashboard initialFilters={{ bedrooms_min: 2 }} />);

      expect(screen.getByText("1 filter active")).toBeInTheDocument();
    });

    it("does NOT trigger duplicate client fetch when RSC data is provided", async () => {
      jest.useFakeTimers();
      apiAnalyticsMock.fetchStats.mockClear();
      apiAnalyticsMock.fetchDataset.mockClear();

      const stats = generateMarketStats(42);
      const dataset = {
        rows: generatePropertyDataset(42),
        total: 50,
        page: 1,
        page_size: 50,
      };

      render(
        <AnalyticsDashboard
          initialStats={stats}
          initialDataset={dataset}
          initialFilters={{ school_rating_min: 7.5 }}
        />
      );

      // Advance past the debounce timeout
      await act(async () => {
        jest.advanceTimersByTime(500);
        await Promise.resolve();
      });

      // Both fetch functions should NOT have been called — RSC data is used directly
      expect(apiAnalyticsMock.fetchStats).not.toHaveBeenCalled();
      expect(apiAnalyticsMock.fetchDataset).not.toHaveBeenCalled();

      jest.useRealTimers();
    });

    it("falls back to client fetch when RSC pre-fetch fails (no initial data)", async () => {
      jest.useFakeTimers();
      apiAnalyticsMock.fetchStats.mockClear();
      apiAnalyticsMock.fetchDataset.mockClear();

      render(<AnalyticsDashboard />);

      // Initial render shows loading
      expect(screen.getByText("Loading market data...")).toBeInTheDocument();

      await act(async () => {
        jest.advanceTimersByTime(300);
        await Promise.resolve();
      });

      // Client fetch should be called exactly once each
      expect(apiAnalyticsMock.fetchStats).toHaveBeenCalledTimes(1);
      expect(apiAnalyticsMock.fetchDataset).toHaveBeenCalledTimes(1);

      jest.useRealTimers();
    });
  });

  describe("filter integration", () => {
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

    it("skips client fetch when RSC delivers new data for changed filters", async () => {
      // Simulates the full RSC flow: user changes filter → router.replace
      // → RSC re-renders with new initialFilters + initialStats + initialDataset.
      // The client effect should NOT fetch because RSC already did.
      jest.useFakeTimers();
      apiAnalyticsMock.fetchStats.mockClear();
      apiAnalyticsMock.fetchDataset.mockClear();

      const stats = generateMarketStats(42);
      const dataset = {
        rows: generatePropertyDataset(42),
        total: 50,
        page: 1,
        page_size: 50,
      };

      const { rerender } = render(
        <AnalyticsDashboard
          initialStats={stats}
          initialDataset={dataset}
          initialFilters={{ bedrooms_min: 2 }}
        />
      );

      // Clear mocks after initial render
      apiAnalyticsMock.fetchStats.mockClear();
      apiAnalyticsMock.fetchDataset.mockClear();

      // User changes filter
      const slider = screen.getByLabelText("Min Bedrooms range slider");
      fireEvent.change(slider, { target: { value: "5" } });

      // At this point the effect fires but sees rscFiltersKey !== currentFiltersKey
      // because initialFilters is still {bedrooms_min: 2}.  It records the timestamp
      // and returns without fetching.

      // Now simulate RSC delivering new props (via rerender)
      const newStats = generateMarketStats(99, { bedrooms_min: 5 });
      const newDataset = {
        rows: generatePropertyDataset(99, { bedrooms_min: 5 }),
        total: 30,
        page: 1,
        page_size: 50,
      };
      rerender(
        <AnalyticsDashboard
          initialStats={newStats}
          initialDataset={newDataset}
          initialFilters={{ bedrooms_min: 5 }}
        />
      );

      // Advance past grace period + debounce
      await act(async () => {
        jest.advanceTimersByTime(1000);
        await Promise.resolve();
      });

      // Client fetch should NOT have been called — RSC delivered the data
      expect(apiAnalyticsMock.fetchStats).not.toHaveBeenCalled();
      expect(apiAnalyticsMock.fetchDataset).not.toHaveBeenCalled();

      // UI should show the new data from RSC
      const expectedPrice = new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: 0,
      }).format(newStats.kpis.avg_price);
      expect(screen.getByText(expectedPrice)).toBeInTheDocument();

      jest.useRealTimers();
    });

    it("falls back to client fetch when RSC delivers null data for changed filters", async () => {
      // Simulates RSC re-render that failed (initialStats=null, initialDataset=null).
      // The client effect should fall through and perform its own fetch.
      jest.useFakeTimers();
      apiAnalyticsMock.fetchStats.mockClear();
      apiAnalyticsMock.fetchDataset.mockClear();

      const stats = generateMarketStats(42);
      const dataset = {
        rows: generatePropertyDataset(42),
        total: 50,
        page: 1,
        page_size: 50,
      };

      const { rerender } = render(
        <AnalyticsDashboard
          initialStats={stats}
          initialDataset={dataset}
          initialFilters={{ bedrooms_min: 2 }}
        />
      );

      apiAnalyticsMock.fetchStats.mockClear();
      apiAnalyticsMock.fetchDataset.mockClear();

      // User changes filter
      const slider = screen.getByLabelText("Min Bedrooms range slider");
      fireEvent.change(slider, { target: { value: "5" } });

      // RSC re-render with null data (failed fetch)
      rerender(
        <AnalyticsDashboard
          initialStats={null}
          initialDataset={null}
          initialFilters={{ bedrooms_min: 5 }}
        />
      );

      // Advance past grace period + debounce
      await act(async () => {
        jest.advanceTimersByTime(1000);
        await Promise.resolve();
      });

      // Client should have performed its own fetch as fallback
      expect(apiAnalyticsMock.fetchStats).toHaveBeenCalledTimes(1);
      expect(apiAnalyticsMock.fetchDataset).toHaveBeenCalledTimes(1);
      expect(apiAnalyticsMock.fetchStats).toHaveBeenCalledWith(
        expect.objectContaining({ bedrooms_min: 5 }),
        expect.any(Object)
      );

      jest.useRealTimers();
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
        expect.stringContaining("bedroomsMin=4"),
        { scroll: false }
      );
    });

    it("clears URL params when all filters are reset", () => {
      navMock.__setSearchParams(new URLSearchParams("bedroomsMin=3"));
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
        expect.stringContaining("bedroomsMin=3"),
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

  describe("Strict Mode deduplication (double-mount resilience)", () => {
    beforeEach(() => {
      jest.useFakeTimers();
      apiAnalyticsMock.fetchStats.mockClear();
      apiAnalyticsMock.fetchDataset.mockClear();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it("resists React Strict Mode double-mount when RSC data is provided", async () => {
      const stats = generateMarketStats(42);
      const dataset = {
        rows: generatePropertyDataset(42),
        total: 50,
        page: 1,
        page_size: 50,
      };
      const filters: StatsFilters = { school_rating_min: 7.5 };

      // First mount
      const { unmount } = render(
        <AnalyticsDashboard
          initialStats={stats}
          initialDataset={dataset}
          initialFilters={filters}
        />
      );

      // Strict Mode unmount
      unmount();

      // Second mount (same props)
      render(
        <AnalyticsDashboard
          initialStats={stats}
          initialDataset={dataset}
          initialFilters={filters}
        />
      );

      await act(async () => {
        jest.advanceTimersByTime(1000);
        await Promise.resolve();
      });

      expect(apiAnalyticsMock.fetchStats).not.toHaveBeenCalled();
      expect(apiAnalyticsMock.fetchDataset).not.toHaveBeenCalled();
    });

    it("fetches data when no RSC pre-fetched data is available", async () => {
      // Scenario: no initialStats/initialDataset.
      // rscFiltersKey === currentFiltersKey (both "{}") but no data → fallback fetch.
      render(<AnalyticsDashboard initialFilters={{ bedrooms_min: 3 }} />);

      await act(async () => {
        jest.advanceTimersByTime(1000);
        await Promise.resolve();
      });

      expect(apiAnalyticsMock.fetchStats).toHaveBeenCalledTimes(1);
      expect(apiAnalyticsMock.fetchDataset).toHaveBeenCalledTimes(1);
      expect(apiAnalyticsMock.fetchStats).toHaveBeenCalledWith(
        expect.objectContaining({ bedrooms_min: 3 }),
        expect.any(Object)
      );
    });
  });
});