import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";

import { PriceScatter } from "../PriceScatter";
import type { ScatterPoint } from "@/lib/schemas/analytics";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const SAMPLE_DATA: ScatterPoint[] = [
  { square_footage: 1200, price: 250_000, bedrooms: 2 },
  { square_footage: 1800, price: 380_000, bedrooms: 3 },
  { square_footage: 2400, price: 520_000, bedrooms: 4 },
  { square_footage: 3200, price: 720_000, bedrooms: 5 },
];

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("PriceScatter", () => {
  it("renders the card title and description", () => {
    render(<PriceScatter data={SAMPLE_DATA} />);

    expect(screen.getByText("Price vs. Square Footage")).toBeInTheDocument();
    expect(
      screen.getByText(/each dot is a property/i)
    ).toBeInTheDocument();
  });

  it("renders the chart container with accessible label", () => {
    render(<PriceScatter data={SAMPLE_DATA} />);

    const chart = screen.getByRole("img", {
      name: /price vs square footage scatter plot/i,
    });
    expect(chart).toBeInTheDocument();
  });

  it("renders without throwing for empty data", () => {
    expect(() => {
      render(<PriceScatter data={[]} />);
    }).not.toThrow();
  });

  it("renders without throwing for a single data point", () => {
    expect(() => {
      render(
        <PriceScatter
          data={[{ square_footage: 2000, price: 400_000, bedrooms: 3 }]}
        />
      );
    }).not.toThrow();
  });
});
