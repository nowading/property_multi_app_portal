import "@testing-library/jest-dom";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { CompareClient } from "../CompareClient";
import type { HistoryEntry, PropertyFeatures } from "@/lib/schemas/estimator";

const BASE_FEATURES: PropertyFeatures = {
  square_footage: 2000,
  bedrooms: 3,
  bathrooms: 2.5,
  year_built: 1990,
  lot_size: 5000,
  distance_to_city_center: 5.5,
  school_rating: 8,
};

function makeEntry(
  id: string,
  overrides: Partial<HistoryEntry> = {}
): HistoryEntry {
  return {
    id,
    timestamp: new Date("2026-07-30T10:30:00Z").getTime(),
    features: { ...BASE_FEATURES, ...overrides.features },
    predicted_price: overrides.predicted_price ?? 425000,
    ...overrides,
  };
}

describe("CompareClient", () => {
  it("renders the empty-history prompt when there are no entries", () => {
    render(<CompareClient entries={[]} />);
    expect(screen.getByText(/no saved estimates yet/i)).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /run an estimate first/i })
    ).toHaveAttribute("href", "/estimator");
  });

  it("renders one checkbox per available entry", () => {
    const entries = [makeEntry("a"), makeEntry("b"), makeEntry("c")];
    render(<CompareClient entries={entries} />);
    const checkboxes = screen.getAllByRole("checkbox");
    expect(checkboxes).toHaveLength(3);
  });

  it("shows the 'select at least 2' prompt when fewer than 2 are selected", () => {
    const entries = [makeEntry("a"), makeEntry("b")];
    render(<CompareClient entries={entries} />);
    expect(
      screen.getByText(/select at least 2 estimates above/i)
    ).toBeInTheDocument();
  });

  it("changes the prompt to 'select one more' when exactly 1 is selected", async () => {
    const entries = [makeEntry("a"), makeEntry("b")];
    const user = userEvent.setup();
    render(<CompareClient entries={entries} />);

    // Both entries have the same default price, so click by index instead of label.
    await user.click(screen.getAllByRole("checkbox")[0]);

    expect(screen.getByText(/select one more estimate/i)).toBeInTheDocument();
  });

  it("renders the comparison table when ≥2 entries are selected", async () => {
    const entries = [
      makeEntry("a", { predicted_price: 100000 }),
      makeEntry("b", { predicted_price: 200000 }),
    ];
    const user = userEvent.setup();
    render(<CompareClient entries={entries} />);

    await user.click(screen.getAllByRole("checkbox")[0]);
    await user.click(screen.getAllByRole("checkbox")[1]);

    expect(
      screen.getByRole("table", {
        name: /feature values and predicted prices for each selected estimate/i,
      })
    ).toBeInTheDocument();
  });

  it("renders one column per selected entry in the comparison table", async () => {
    const entries = [
      makeEntry("a"),
      makeEntry("b"),
      makeEntry("c"),
      makeEntry("d"),
    ];
    const user = userEvent.setup();
    render(<CompareClient entries={entries} />);

    for (const cb of screen.getAllByRole("checkbox")) {
      await user.click(cb);
    }

    const table = screen.getByRole("table");
    const headers = within(table).getAllByRole("columnheader");
    // First column = "Feature", then one per entry.
    expect(headers.length).toBe(1 + 4);
    expect(headers[1]).toHaveTextContent(/estimate 1/i);
    expect(headers[4]).toHaveTextContent(/estimate 4/i);
  });

  it("renders one row per feature plus the predicted-price row", async () => {
    const entries = [makeEntry("a"), makeEntry("b")];
    const user = userEvent.setup();
    render(<CompareClient entries={entries} />);

    await user.click(screen.getAllByRole("checkbox")[0]);
    await user.click(screen.getAllByRole("checkbox")[1]);

    const table = screen.getByRole("table");
    const rowHeaders = within(table).getAllByRole("rowheader");
    // 7 feature rows + 1 predicted-price row.
    expect(rowHeaders.length).toBe(8);
    expect(rowHeaders[0]).toHaveTextContent("Square Footage");
    expect(rowHeaders[7]).toHaveTextContent("Predicted Price");
  });

  it("disables further checkboxes once 4 are selected", async () => {
    const entries = [
      makeEntry("a"),
      makeEntry("b"),
      makeEntry("c"),
      makeEntry("d"),
      makeEntry("e"),
    ];
    const user = userEvent.setup();
    render(<CompareClient entries={entries} />);

    const checkboxes = screen.getAllByRole("checkbox");
    // Select the first 4.
    await user.click(checkboxes[0]);
    await user.click(checkboxes[1]);
    await user.click(checkboxes[2]);
    await user.click(checkboxes[3]);

    // The 5th should now be disabled.
    expect(checkboxes[4]).toBeDisabled();
    // The selected ones should remain enabled (so user can deselect).
    expect(checkboxes[0]).not.toBeDisabled();
  });

  it("renders the grouped chart container when ≥2 are selected", async () => {
    const entries = [makeEntry("a"), makeEntry("b")];
    const user = userEvent.setup();
    render(<CompareClient entries={entries} />);

    await user.click(screen.getAllByRole("checkbox")[0]);
    await user.click(screen.getAllByRole("checkbox")[1]);

    expect(screen.getByTestId("compare-chart-container")).toBeInTheDocument();
  });

  it("does not render the chart or table when selection drops below 2", async () => {
    const entries = [makeEntry("a"), makeEntry("b")];
    const user = userEvent.setup();
    render(<CompareClient entries={entries} />);

    const checkboxes = screen.getAllByRole("checkbox");
    await user.click(checkboxes[0]);
    await user.click(checkboxes[1]);
    expect(screen.getByRole("table")).toBeInTheDocument();

    // Deselect one — table + chart should disappear.
    await user.click(checkboxes[0]);
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    expect(
      screen.queryByTestId("compare-chart-container")
    ).not.toBeInTheDocument();
  });

  it("highlights the highest predicted price with a success badge", async () => {
    const entries = [
      makeEntry("a", { predicted_price: 100000 }),
      makeEntry("b", { predicted_price: 300000 }),
      makeEntry("c", { predicted_price: 200000 }),
    ];
    const user = userEvent.setup();
    render(<CompareClient entries={entries} />);

    for (const cb of screen.getAllByRole("checkbox")) {
      await user.click(cb);
    }

    // Scope to the comparison table so we don't pick up the same price in
    // the checkbox labels above.
    const table = screen.getByRole("table", {
      name: /feature values and predicted prices for each selected estimate/i,
    });

    // Three price badges total in the predicted-price row.
    const priceCells = within(table).getAllByText(/\$[0-9,]+\.00/);
    expect(priceCells.length).toBe(3);

    // The highest one ($300,000.00) should be in a success-variant badge.
    const highest = within(table).getByText("$300,000.00");
    const badge = highest.closest("span");
    expect(badge?.className).toContain("bg-emerald-50");

    // The non-highest ones should NOT have the success class.
    const others = [
      within(table).getByText("$100,000.00"),
      within(table).getByText("$200,000.00"),
    ];
    for (const el of others) {
      const otherBadge = el.closest("span");
      expect(otherBadge?.className).not.toContain("bg-emerald-50");
    }
  });

  it("respects initialIds prop to pre-select entries", () => {
    const entries = [makeEntry("a"), makeEntry("b"), makeEntry("c")];
    render(<CompareClient entries={entries} initialIds={["a", "c"]} />);

    const checkboxes = screen.getAllByRole("checkbox");
    expect(checkboxes[0]).toBeChecked();
    expect(checkboxes[1]).not.toBeChecked();
    expect(checkboxes[2]).toBeChecked();

    // With 2 selected, the table should render.
    expect(screen.getByRole("table")).toBeInTheDocument();
  });

  it("binds each checkbox to its label via htmlFor/id", () => {
    const entries = [makeEntry("a")];
    render(<CompareClient entries={entries} />);
    const checkbox = screen.getByRole("checkbox");
    const id = checkbox.getAttribute("id");
    expect(id).toBe("compare-a");
    expect(document.querySelector(`label[for="${id}"]`)).not.toBeNull();
  });
});
