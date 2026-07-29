import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";

import { ResultDisplay } from "../ResultDisplay";
import type {
  FeatureContribution,
  PredictionResult,
  PropertyFeatures,
} from "@/lib/schemas/estimator";

const SAMPLE_FEATURES: PropertyFeatures = {
  square_footage: 2000,
  bedrooms: 3,
  bathrooms: 2.5,
  year_built: 1990,
  lot_size: 5000,
  distance_to_city_center: 5.5,
  school_rating: 8,
};

const SAMPLE_CONTRIBUTIONS: FeatureContribution[] = [
  { feature: "square_footage", value: 2000, contribution: 150000 },
  { feature: "bedrooms", value: 3, contribution: 25000 },
  { feature: "bathrooms", value: 2.5, contribution: 12000 },
  { feature: "year_built", value: 1990, contribution: -8000 },
  { feature: "lot_size", value: 5000, contribution: 30000 },
  { feature: "distance_to_city_center", value: 5.5, contribution: -15000 },
  { feature: "school_rating", value: 8, contribution: 18000 },
];

describe("ResultDisplay", () => {
  it("formats the predicted price as USD currency", () => {
    const result: PredictionResult = { predicted_price: 425000.5 };
    render(<ResultDisplay result={result} features={SAMPLE_FEATURES} />);
    expect(screen.getByTestId("predicted-price")).toHaveTextContent(
      "$425,000.50"
    );
  });

  it("renders a feature breakdown table with all 7 features", () => {
    const result: PredictionResult = { predicted_price: 100000 };
    render(<ResultDisplay result={result} features={SAMPLE_FEATURES} />);

    expect(
      screen.getByRole("table", {
        name: /property features used for this prediction/i,
      })
    ).toBeInTheDocument();

    // Each feature label appears as a row header.
    expect(screen.getByRole("rowheader", { name: "Square Footage" })).toBeInTheDocument();
    expect(screen.getByRole("rowheader", { name: "Bedrooms" })).toBeInTheDocument();
    expect(screen.getByRole("rowheader", { name: "Bathrooms" })).toBeInTheDocument();
    expect(screen.getByRole("rowheader", { name: "Year Built" })).toBeInTheDocument();
    expect(screen.getByRole("rowheader", { name: "Lot Size" })).toBeInTheDocument();
    expect(
      screen.getByRole("rowheader", { name: "Distance to City Center" })
    ).toBeInTheDocument();
    expect(screen.getByRole("rowheader", { name: "School Rating" })).toBeInTheDocument();
  });

  it("shows the input values with their units in the table", () => {
    const result: PredictionResult = { predicted_price: 100000 };
    render(<ResultDisplay result={result} features={SAMPLE_FEATURES} />);

    const cells = screen.getAllByRole("cell");
    const cellText = cells.map((c) => c.textContent);
    expect(cellText).toContain("2000 sq ft");
    expect(cellText).toContain("3");
    expect(cellText).toContain("2.5");
    expect(cellText).toContain("1990");
    expect(cellText).toContain("5000 sq ft");
    expect(cellText).toContain("5.5 miles");
    expect(cellText).toContain("8 / 10");
  });

  it("renders a chart container", () => {
    const result: PredictionResult = { predicted_price: 100000 };
    render(<ResultDisplay result={result} features={SAMPLE_FEATURES} />);
    expect(screen.getByTestId("chart-container")).toBeInTheDocument();
  });

  it("falls back to the Feature Scale chart when contributions are absent", () => {
    const result: PredictionResult = { predicted_price: 100000 };
    render(<ResultDisplay result={result} features={SAMPLE_FEATURES} />);
    expect(
      screen.getByRole("heading", { name: /feature scale chart/i })
    ).toBeInTheDocument();
    expect(
      screen.getByText(/normalised to a 0–100 scale/i)
    ).toBeInTheDocument();
  });

  it("switches to the Price Contribution chart when contributions are present", () => {
    const result: PredictionResult = {
      predicted_price: 212000,
      contributions: SAMPLE_CONTRIBUTIONS,
    };
    render(<ResultDisplay result={result} features={SAMPLE_FEATURES} />);

    expect(
      screen.getByRole("heading", { name: /price contribution chart/i })
    ).toBeInTheDocument();
    expect(
      screen.getByText(/adds to \(or subtracts from\) the predicted price/i)
    ).toBeInTheDocument();
  });

  it("renders a Contribution column header only when contributions exist", () => {
    const withoutContrib: PredictionResult = { predicted_price: 100000 };
    const { rerender } = render(
      <ResultDisplay result={withoutContrib} features={SAMPLE_FEATURES} />
    );
    expect(
      screen.queryByRole("columnheader", { name: /contribution/i })
    ).not.toBeInTheDocument();

    const withContrib: PredictionResult = {
      predicted_price: 100000,
      contributions: SAMPLE_CONTRIBUTIONS,
    };
    rerender(<ResultDisplay result={withContrib} features={SAMPLE_FEATURES} />);
    expect(
      screen.getByRole("columnheader", { name: /contribution/i })
    ).toBeInTheDocument();
  });

  it("renders contribution badges with positive and negative variants", () => {
    const result: PredictionResult = {
      predicted_price: 212000,
      contributions: SAMPLE_CONTRIBUTIONS,
    };
    render(<ResultDisplay result={result} features={SAMPLE_FEATURES} />);

    // Positive contributions exist (square_footage +150000)
    expect(screen.getByText("$150,000.00")).toBeInTheDocument();
    // Negative contributions exist (year_built -8000)
    expect(screen.getByText("-$8,000.00")).toBeInTheDocument();

    // Verify at least one success-variant and one danger-variant badge.
    const successBadges = screen
      .getAllByText(/^\$[0-9,.]+$/)
      .map((el) => el.closest("span"));
    const dangerBadges = screen
      .getAllByText(/^-\$[0-9,.]+$/)
      .map((el) => el.closest("span"));
    expect(successBadges.length).toBeGreaterThan(0);
    expect(dangerBadges.length).toBeGreaterThan(0);
  });

  it("shows em-dash placeholders when features are null", () => {
    const result: PredictionResult = { predicted_price: 100000 };
    render(<ResultDisplay result={result} features={null} />);

    // All value cells should be em-dash because features are null.
    const cells = screen.getAllByRole("cell");
    const emDashes = cells.filter((c) => c.textContent === "—");
    expect(emDashes.length).toBe(7);
  });

  it("formats the predicted price with a thousands separator", () => {
    const result: PredictionResult = { predicted_price: 1234567.89 };
    render(<ResultDisplay result={result} features={SAMPLE_FEATURES} />);
    expect(screen.getByTestId("predicted-price")).toHaveTextContent(
      "$1,234,567.89"
    );
  });
});
