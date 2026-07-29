import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { HistoryList } from "../HistoryList";
import type { HistoryEntry, PropertyFeatures } from "@/lib/schemas/estimator";

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: jest.fn() }),
}));

const SAMPLE_FEATURES: PropertyFeatures = {
  square_footage: 2000,
  bedrooms: 3,
  bathrooms: 2.5,
  year_built: 1990,
  lot_size: 5000,
  distance_to_city_center: 5.5,
  school_rating: 8,
};

function makeEntry(overrides: Partial<HistoryEntry> = {}): HistoryEntry {
  return {
    id: `id-${Math.random().toString(36).slice(2, 8)}`,
    timestamp: new Date("2026-07-30T10:30:00Z").getTime(),
    features: SAMPLE_FEATURES,
    predicted_price: 425000.5,
    ...overrides,
  };
}

describe("HistoryList", () => {
  beforeEach(() => {
    jest.spyOn(window, "confirm").mockReturnValue(true);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("renders the empty state when there are no entries", () => {
    render(<HistoryList entries={[]} />);
    expect(
      screen.getByText(/no saved estimates yet/i)
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /go to estimator/i })
    ).toHaveAttribute("href", "/estimator");
  });

  it("renders the table caption and header row when entries exist", () => {
    render(<HistoryList entries={[makeEntry()]} />);
    expect(
      screen.getByRole("table", {
        name: /previously saved property estimates/i,
      })
    ).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: /date/i })).toBeInTheDocument();
    expect(
      screen.getByRole("columnheader", { name: /predicted price/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("columnheader", { name: /features/i })
    ).toBeInTheDocument();
  });

  it("shows the entry count in the card title", () => {
    render(<HistoryList entries={[makeEntry(), makeEntry(), makeEntry()]} />);
    expect(screen.getByText(/Saved Estimates \(3\)/)).toBeInTheDocument();
  });

  it("formats the predicted price as USD currency", () => {
    render(
      <HistoryList
        entries={[makeEntry({ predicted_price: 1234567.89 })]}
      />
    );
    expect(screen.getByText("$1,234,567.89")).toBeInTheDocument();
  });

  it("renders the timestamp as a <time> element with ISO dateTime", () => {
    const entry = makeEntry({ timestamp: 1_700_000_000_000 });
    render(<HistoryList entries={[entry]} />);
    const time = screen.getByRole("rowheader", { name: /.+/ });
    expect(time.tagName).toBe("TH");
    const timeEl = time.querySelector("time");
    expect(timeEl).not.toBeNull();
    expect(timeEl).toHaveAttribute(
      "dateTime",
      new Date(entry.timestamp).toISOString()
    );
  });

  it("includes a compact feature summary in the features column", () => {
    render(<HistoryList entries={[makeEntry()]} />);
    expect(screen.getByText(/Square Footage: 2000 sq ft/)).toBeInTheDocument();
    expect(screen.getByText(/Bedrooms: 3/)).toBeInTheDocument();
    expect(screen.getByText(/Bathrooms: 2.5/)).toBeInTheDocument();
    expect(screen.getByText(/Year Built: 1990/)).toBeInTheDocument();
  });

  it("calls onRemove when the Remove button is clicked", async () => {
    const onRemove = jest.fn();
    const entry = makeEntry({ id: "abc-123" });
    render(<HistoryList entries={[entry]} onRemove={onRemove} />);

    await userEvent.click(screen.getByRole("button", { name: /remove/i }));

    expect(onRemove).toHaveBeenCalledWith("abc-123");
  });

  it("renders one Remove button per entry with an accessible label", () => {
    render(<HistoryList entries={[makeEntry(), makeEntry()]} />);
    const removeButtons = screen.getAllByRole("button", { name: /remove/i });
    expect(removeButtons).toHaveLength(2);
    // Each has an aria-label including the entry's formatted timestamp.
    for (const btn of removeButtons) {
      expect(btn).toHaveAttribute("aria-label");
      expect(btn.getAttribute("aria-label")).toMatch(/remove estimate from/i);
    }
  });

  it("calls onClear after confirmation when Clear all is clicked", async () => {
    const onClear = jest.fn();
    render(<HistoryList entries={[makeEntry()]} onClear={onClear} />);

    await userEvent.click(screen.getByRole("button", { name: /clear all/i }));

    expect(window.confirm).toHaveBeenCalled();
    expect(onClear).toHaveBeenCalled();
  });

  it("does NOT call onClear when the user cancels the confirm dialog", async () => {
    jest.spyOn(window, "confirm").mockReturnValue(false);
    const onClear = jest.fn();
    render(<HistoryList entries={[makeEntry()]} onClear={onClear} />);

    await userEvent.click(screen.getByRole("button", { name: /clear all/i }));

    expect(onClear).not.toHaveBeenCalled();
  });

  it("renders a Compare button per entry", () => {
    render(<HistoryList entries={[makeEntry()]} />);
    expect(
      screen.getByRole("button", { name: /compare/i })
    ).toBeInTheDocument();
  });

  it("renders multiple rows for multiple entries", () => {
    render(
      <HistoryList
        entries={[makeEntry({ id: "a" }), makeEntry({ id: "b" }), makeEntry({ id: "c" })]}
      />
    );
    // 3 row headers (one per entry)
    const rowHeaders = screen.getAllByRole("rowheader");
    expect(rowHeaders).toHaveLength(3);
  });
});
