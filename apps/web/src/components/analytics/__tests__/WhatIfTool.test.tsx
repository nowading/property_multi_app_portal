import "@testing-library/jest-dom";
import { act, fireEvent, render, screen } from "@testing-library/react";

import { WhatIfTool } from "../WhatIfTool";
import {
  DEFAULT_WHAT_IF_FEATURES,
  type WhatIfFeatures,
  type WhatIfResult,
} from "@/lib/schemas/analytics";
import { predictPrice, runWhatIfAnalysis } from "@/lib/mock/predict";

const mockPostWhatIf = jest.fn();

jest.mock("@/lib/api-analytics", () => ({
  postWhatIf: (...args: unknown[]) => mockPostWhatIf(...args),
}));

jest.mock("@/lib/error-messages", () => ({
  getErrorMessage: jest.fn((code: string) => `Error: ${code}`),
}));

function makeMockResult(features: WhatIfFeatures): WhatIfResult {
  const predicted = predictPrice(features);
  const baseline = predictPrice(DEFAULT_WHAT_IF_FEATURES);
  const delta = predicted - baseline;
  const deltaPercent = baseline !== 0 ? (delta / baseline) * 100 : 0;
  return {
    predicted_price: predicted,
    baseline_price: baseline,
    delta,
    delta_percent: Math.round(deltaPercent * 10) / 10,
    features,
  };
}

describe("WhatIfTool", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockPostWhatIf.mockReset();
    mockPostWhatIf.mockImplementation(async (features: WhatIfFeatures) =>
      makeMockResult(features)
    );
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe("rendering", () => {
    it("renders the tool title and description", () => {
      render(<WhatIfTool />);

      expect(screen.getByText("What-If Analysis")).toBeInTheDocument();
      expect(
        screen.getByText(/adjust property features/i)
      ).toBeInTheDocument();
    });

    it("renders all 7 feature sliders", () => {
      render(<WhatIfTool />);

      const sliders = screen.getAllByRole("slider");
      expect(sliders).toHaveLength(7);
    });

    it("renders predicted, baseline, and delta sections after API load", async () => {
      render(<WhatIfTool />);

      await act(async () => {
        jest.runAllTimers();
      });

      expect(screen.getByText("Predicted Price")).toBeInTheDocument();
      expect(screen.getByText("Baseline Price")).toBeInTheDocument();
      expect(screen.getByText(/delta vs baseline/i)).toBeInTheDocument();
    });

    it("renders feature values summary after API load", async () => {
      render(<WhatIfTool />);

      await act(async () => {
        jest.runAllTimers();
      });

      expect(screen.getByText("Feature Values")).toBeInTheDocument();
      expect(screen.getAllByText(/Square Footage/i).length).toBeGreaterThanOrEqual(2);
      expect(screen.getAllByText(/Bedrooms/i).length).toBeGreaterThanOrEqual(2);
    });

    it("shows reset button", () => {
      render(<WhatIfTool />);

      expect(screen.getByText(/reset to baseline/i)).toBeInTheDocument();
    });
  });

  describe("loading and error states", () => {
    it("shows loading indicator while fetching", async () => {
      let resolvePostWhatIf: ((value: WhatIfResult) => void) | null = null;
      mockPostWhatIf.mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolvePostWhatIf = resolve;
          })
      );

      render(<WhatIfTool />);

      await act(async () => {
        jest.advanceTimersByTime(0);
      });

      expect(screen.getByTestId("loading-indicator")).toBeInTheDocument();

      await act(async () => {
        resolvePostWhatIf?.(makeMockResult(DEFAULT_WHAT_IF_FEATURES));
      });
    });

    it("shows error card when API fails", async () => {
      mockPostWhatIf.mockRejectedValueOnce(new (require("@/lib/api").ApiError)("NETWORK_ERROR", "Network error"));

      render(<WhatIfTool />);

      await act(async () => {
        jest.runAllTimers();
      });

      expect(screen.getByTestId("error-card")).toBeInTheDocument();
      expect(screen.getByText(/Error:/)).toBeInTheDocument();
    });

    it("shows 'Click to analyze' when result is null and not loading", () => {
      // Render without triggering the effect (no timers)
      // This is the initial state before the effect runs
      render(<WhatIfTool />);

      // Before timers run, isLoading=false and result=null
      // The loading indicator appears because isLoading is set to true in fetchPrediction
      // But fetchPrediction is called inside setTimeout(0), so it won't run until timers advance
      // Initially: isLoading=false, result=null, so "Click to analyze" should show
      expect(screen.getByText(/click to analyze/i)).toBeInTheDocument();
    });
  });

  describe("prediction", () => {
    it("shows predicted price based on default features", async () => {
      render(<WhatIfTool />);

      await act(async () => {
        jest.runAllTimers();
      });

      const priceEl = screen.getByTestId("predicted-price");
      expect(priceEl.textContent).toContain("$");
    });

    it("updates predicted price when a slider changes", async () => {
      render(<WhatIfTool />);

      await act(async () => {
        jest.runAllTimers();
      });

      const initialPrice = screen.getByTestId("predicted-price").textContent;

      const sqftSlider = screen.getByLabelText(/square footage slider/i);
      fireEvent.change(sqftSlider, { target: { value: "3000" } });

      // Advance 300ms debounce + API call
      await act(async () => {
        jest.advanceTimersByTime(300);
      });

      const updatedPrice = screen.getByTestId("predicted-price").textContent;
      expect(updatedPrice).not.toBe(initialPrice);
    });

    it("recalculates delta when features change", async () => {
      render(<WhatIfTool />);

      await act(async () => {
        jest.runAllTimers();
      });

      const deltaText = screen.getByText(/delta vs baseline/i).parentElement;
      const initialDelta = deltaText?.querySelector("p:last-child")?.textContent;

      const bedsSlider = screen.getByLabelText(/bedrooms slider/i);
      fireEvent.change(bedsSlider, { target: { value: "6" } });

      await act(async () => {
        jest.advanceTimersByTime(300);
      });

      const updatedDelta = deltaText?.querySelector("p:last-child")?.textContent;
      expect(updatedDelta).not.toBe(initialDelta);
    });

    it("shows positive delta with green color when price increases", async () => {
      render(<WhatIfTool />);

      await act(async () => {
        jest.runAllTimers();
      });

      const sqftSlider = screen.getByLabelText(/square footage slider/i);
      fireEvent.change(sqftSlider, { target: { value: "5000" } });

      await act(async () => {
        jest.advanceTimersByTime(300);
      });

      const deltaSection = screen.getByText(/delta vs baseline/i).parentElement;
      expect(deltaSection).toHaveClass("bg-emerald-50");
    });

    it("shows negative delta with red color when price decreases", async () => {
      render(<WhatIfTool />);

      await act(async () => {
        jest.runAllTimers();
      });

      const sqftSlider = screen.getByLabelText(/square footage slider/i);
      fireEvent.change(sqftSlider, { target: { value: "500" } });

      await act(async () => {
        jest.advanceTimersByTime(300);
      });

      const deltaSection = screen.getByText(/delta vs baseline/i).parentElement;
      expect(deltaSection).toHaveClass("bg-rose-50");
    });
  });

  describe("reset", () => {
    it("resets features to baseline when reset is clicked", async () => {
      render(<WhatIfTool />);

      await act(async () => {
        jest.runAllTimers();
      });

      const sqftSlider = screen.getByLabelText(/square footage slider/i);
      fireEvent.change(sqftSlider, { target: { value: "5000" } });

      await act(async () => {
        jest.advanceTimersByTime(300);
      });

      const changedPrice = screen.getByTestId("predicted-price").textContent;

      fireEvent.click(screen.getByText(/reset to baseline/i));

      await act(async () => {
        jest.runAllTimers();
      });

      const resetPrice = screen.getByTestId("predicted-price").textContent;
      expect(resetPrice).not.toBe(changedPrice);
    });

    it("returns to exact default values after reset", async () => {
      render(<WhatIfTool />);

      await act(async () => {
        jest.runAllTimers();
      });

      const sqftSlider = screen.getByLabelText(/square footage slider/i);
      fireEvent.change(sqftSlider, { target: { value: "500" } });

      fireEvent.click(screen.getByText(/reset to baseline/i));

      await act(async () => {
        jest.runAllTimers();
      });

      expect(sqftSlider).toHaveValue("2000");
    });
  });

  describe("onChange callback", () => {
    it("calls onChange with prediction result when features change", async () => {
      const handleChange = jest.fn();
      render(<WhatIfTool onChange={handleChange} />);

      await act(async () => {
        jest.runAllTimers();
      });

      // Initial fetch should NOT call onChange
      expect(handleChange).not.toHaveBeenCalled();

      const bedsSlider = screen.getByLabelText(/bedrooms slider/i);
      fireEvent.change(bedsSlider, { target: { value: "5" } });

      await act(async () => {
        jest.advanceTimersByTime(300);
      });

      expect(handleChange).toHaveBeenCalledTimes(1);
      expect(handleChange.mock.calls[0][0]).toHaveProperty("predicted_price");
      expect(handleChange.mock.calls[0][0]).toHaveProperty("baseline_price");
      expect(handleChange.mock.calls[0][0]).toHaveProperty("delta");
    });

    it("calls onChange when reset is clicked", async () => {
      const handleChange = jest.fn();
      render(<WhatIfTool onChange={handleChange} />);

      await act(async () => {
        jest.runAllTimers();
      });

      // Initial fetch should NOT call onChange
      expect(handleChange).not.toHaveBeenCalled();

      fireEvent.click(screen.getByText(/reset to baseline/i));

      await act(async () => {
        jest.runAllTimers();
      });

      expect(handleChange).toHaveBeenCalledTimes(1);
    });
  });

  describe("feature sliders", () => {
    it("each slider has correct min/max/step attributes", () => {
      render(<WhatIfTool />);

      const sqftSlider = screen.getByLabelText(/square footage slider/i);
      expect(sqftSlider).toHaveAttribute("min", "500");
      expect(sqftSlider).toHaveAttribute("max", "5000");
      expect(sqftSlider).toHaveAttribute("step", "50");

      const bedsSlider = screen.getByLabelText(/bedrooms slider/i);
      expect(bedsSlider).toHaveAttribute("min", "1");
      expect(bedsSlider).toHaveAttribute("max", "6");
      expect(bedsSlider).toHaveAttribute("step", "1");

      const yearSlider = screen.getByLabelText(/year built slider/i);
      expect(yearSlider).toHaveAttribute("min", "1950");
      expect(yearSlider).toHaveAttribute("max", "2025");
    });

    it("slider values are displayed next to labels", () => {
      render(<WhatIfTool />);

      const bedroomsLabel = screen.getByLabelText(/bedrooms slider/i);
      const bedroomsValueSpan = bedroomsLabel
        .closest(".flex.flex-col.gap-2")
        ?.querySelector("span");
      expect(bedroomsValueSpan?.textContent).toContain("3");

      const sqftLabel = screen.getByLabelText(/square footage slider/i);
      const sqftValueSpan = sqftLabel
        .closest(".flex.flex-col.gap-2")
        ?.querySelector("span");
      expect(sqftValueSpan?.textContent).toContain("2000");
    });
  });

  describe("accessibility", () => {
    it("all sliders have aria-labels", () => {
      render(<WhatIfTool />);

      const sliders = screen.getAllByRole("slider");
      sliders.forEach((slider) => {
        expect(slider).toHaveAttribute("aria-label");
      });
    });

    it("all sliders are keyboard accessible", () => {
      render(<WhatIfTool />);

      const sliders = screen.getAllByRole("slider");
      sliders.forEach((slider) => {
        expect(slider).toHaveAttribute("type", "range");
      });
    });
  });
});

describe("predictPrice", () => {
  it("produces deterministic results for same input", () => {
    const features: WhatIfFeatures = {
      square_footage: 2000,
      bedrooms: 3,
      bathrooms: 2,
      year_built: 1995,
      lot_size: 6000,
      distance_to_city_center: 5,
      school_rating: 7,
    };

    const price1 = predictPrice(features);
    const price2 = predictPrice(features);
    expect(price1).toBe(price2);
  });

  it("clamps to minimum price", () => {
    const features: WhatIfFeatures = {
      square_footage: 500,
      bedrooms: 1,
      bathrooms: 1,
      year_built: 1950,
      lot_size: 1000,
      distance_to_city_center: 30,
      school_rating: 1,
    };

    const price = predictPrice(features);
    expect(price).toBeGreaterThanOrEqual(50_000);
  });

  it("clamps to maximum price", () => {
    const features: WhatIfFeatures = {
      square_footage: 5000,
      bedrooms: 6,
      bathrooms: 4,
      year_built: 2025,
      lot_size: 15000,
      distance_to_city_center: 0,
      school_rating: 10,
    };

    const price = predictPrice(features);
    expect(price).toBeLessThanOrEqual(2_000_000);
  });

  it("increases price with higher square footage", () => {
    const base: WhatIfFeatures = {
      square_footage: 1000,
      bedrooms: 3,
      bathrooms: 2,
      year_built: 1995,
      lot_size: 6000,
      distance_to_city_center: 5,
      school_rating: 7,
    };

    const increased = { ...base, square_footage: 3000 };
    expect(predictPrice(increased)).toBeGreaterThan(predictPrice(base));
  });

  it("decreases price with greater distance to city", () => {
    const base: WhatIfFeatures = {
      square_footage: 2000,
      bedrooms: 3,
      bathrooms: 2,
      year_built: 1995,
      lot_size: 6000,
      distance_to_city_center: 5,
      school_rating: 7,
    };

    const farther = { ...base, distance_to_city_center: 20 };
    expect(predictPrice(farther)).toBeLessThan(predictPrice(base));
  });
});

describe("runWhatIfAnalysis", () => {
  it("returns zero delta when features match baseline", () => {
    const result = runWhatIfAnalysis(DEFAULT_WHAT_IF_FEATURES);

    expect(result.delta).toBe(0);
    expect(result.delta_percent).toBe(0);
    expect(result.predicted_price).toBe(result.baseline_price);
  });

  it("returns positive delta when features increase price", () => {
    const betterFeatures: WhatIfFeatures = {
      ...DEFAULT_WHAT_IF_FEATURES,
      square_footage: 4000,
    };

    const result = runWhatIfAnalysis(betterFeatures);

    expect(result.delta).toBeGreaterThan(0);
    expect(result.delta_percent).toBeGreaterThan(0);
    expect(result.predicted_price).toBeGreaterThan(result.baseline_price);
  });

  it("returns negative delta when features decrease price", () => {
    const worseFeatures: WhatIfFeatures = {
      ...DEFAULT_WHAT_IF_FEATURES,
      distance_to_city_center: 25,
    };

    const result = runWhatIfAnalysis(worseFeatures);

    expect(result.delta).toBeLessThan(0);
    expect(result.delta_percent).toBeLessThan(0);
  });

  it("includes the input features in the result", () => {
    const features: WhatIfFeatures = {
      square_footage: 3500,
      bedrooms: 4,
      bathrooms: 3,
      year_built: 2010,
      lot_size: 8000,
      distance_to_city_center: 3,
      school_rating: 8,
    };

    const result = runWhatIfAnalysis(features);

    expect(result.features).toEqual(features);
  });
});