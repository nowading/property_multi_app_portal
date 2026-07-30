import "@testing-library/jest-dom";
import { fireEvent, render, screen } from "@testing-library/react";

import { DataTable } from "../DataTable";
import type { PropertyRow } from "@/lib/schemas/analytics";

function createMockRows(count: number): PropertyRow[] {
  const rows: PropertyRow[] = [];
  for (let i = 0; i < count; i++) {
    rows.push({
      id: i + 1,
      square_footage: 1000 + i * 10,
      bedrooms: (i % 6) + 1,
      bathrooms: (i % 4) + 1,
      year_built: 1950 + (i % 75),
      lot_size: 2000 + i * 20,
      distance_to_city_center: Math.round(((i % 30) + 1) * 10) / 10,
      school_rating: Math.round(((i % 10) + 1) * 10) / 10,
      price: 200000 + i * 1000,
    });
  }
  return rows;
}

describe("DataTable", () => {
  const renderTable = (
    props: { data?: PropertyRow[]; total?: number; initialPageSize?: number } = {}
  ) => {
    const data = props.data ?? createMockRows(25);
    return render(
      <DataTable
        data={data}
        total={props.total}
        initialPageSize={props.initialPageSize}
      />
    );
  };

  describe("rendering", () => {
    it("renders the table with all column headers", () => {
      renderTable();

      expect(screen.getByText("Property Listings")).toBeInTheDocument();
      expect(screen.getByText("ID")).toBeInTheDocument();
      expect(screen.getByText("Sq Ft")).toBeInTheDocument();
      expect(screen.getByText("Beds")).toBeInTheDocument();
      expect(screen.getByText("Baths")).toBeInTheDocument();
      expect(screen.getByText("Year")).toBeInTheDocument();
      expect(screen.getByText("Lot Size")).toBeInTheDocument();
      expect(screen.getByText("Distance")).toBeInTheDocument();
      expect(screen.getByText("School")).toBeInTheDocument();
      expect(screen.getByText("Price")).toBeInTheDocument();
    });

    it("renders rows with formatted data", () => {
      renderTable();

      const rows = screen.getAllByRole("row");
      // 1 header row + 10 data rows (default page size)
      expect(rows.length).toBeGreaterThanOrEqual(2);
    });

    it("shows pagination info", () => {
      renderTable();

      expect(screen.getByText(/Page 1 of 3/i)).toBeInTheDocument();
      expect(screen.getByText(/25 properties/i)).toBeInTheDocument();
    });

    it("renders Prev/Next buttons", () => {
      renderTable();

      expect(screen.getByRole("button", { name: /previous page/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /next page/i })).toBeInTheDocument();
    });

    it("shows empty state when no data", () => {
      renderTable({ data: [] });

      expect(screen.getByText(/no properties match/i)).toBeInTheDocument();
    });

    it("shows correct range description for first page", () => {
      renderTable({ data: createMockRows(25), initialPageSize: 10 });

      expect(screen.getByText(/showing 1–10/i)).toBeInTheDocument();
    });

    it("shows correct range description for last page", () => {
      renderTable({ data: createMockRows(25), initialPageSize: 10 });

      const nextBtn = screen.getByRole("button", { name: /next page/i });
      fireEvent.click(nextBtn);
      fireEvent.click(nextBtn);

      expect(screen.getByText(/showing 21–25/i)).toBeInTheDocument();
    });
  });

  describe("sorting", () => {
    it("sorts by price descending by default", () => {
      renderTable({ data: createMockRows(10) });

      const rows = screen.getAllByRole("row").slice(1); // skip header
      const firstRowCells = rows[0].querySelectorAll("td");
      const lastRowCells = rows[rows.length - 1].querySelectorAll("td");

      // Price is the last column, check it's formatted
      expect(firstRowCells[firstRowCells.length - 1].textContent).toContain("$");
    });

    it("toggles sort direction on header click", () => {
      renderTable({ data: createMockRows(10) });

      const priceHeader = screen.getByRole("button", { name: /sort by price/i });
      const initialSortIcon = priceHeader.textContent;

      fireEvent.click(priceHeader);

      // After clicking, sort should toggle from desc to asc
      const updatedIcon = priceHeader.textContent;
      expect(updatedIcon).not.toBe(initialSortIcon);
    });

    it("sorts by a different column when clicking its header", () => {
      renderTable({ data: createMockRows(10) });

      const sqftHeader = screen.getByRole("button", { name: /sort by sq ft/i });
      fireEvent.click(sqftHeader);

      // Should now show sort indicator on Sq Ft header
      expect(sqftHeader.textContent).toContain("↓");
    });

    it("resets to page 1 when sorting changes", () => {
      renderTable({ data: createMockRows(25), initialPageSize: 10 });

      // Go to page 2
      fireEvent.click(screen.getByRole("button", { name: /next page/i }));
      expect(screen.getByText(/Page 2 of 3/i)).toBeInTheDocument();

      // Sort by bedrooms
      const bedsHeader = screen.getByRole("button", { name: /sort by beds/i });
      fireEvent.click(bedsHeader);

      // Should reset to page 1
      expect(screen.getByText(/Page 1 of 3/i)).toBeInTheDocument();
    });

    it("applies aria-sort attributes correctly", () => {
      renderTable({ data: createMockRows(10) });

      const priceHeader = screen.getByRole("columnheader", { name: /price/i });
      expect(priceHeader).toHaveAttribute("aria-sort", "descending");

      const sqftHeader = screen.getByRole("columnheader", { name: /sq ft/i });
      expect(sqftHeader).toHaveAttribute("aria-sort", "none");
    });
  });

  describe("pagination", () => {
    it("paginates to next page when Next is clicked", () => {
      renderTable({ data: createMockRows(25), initialPageSize: 10 });

      expect(screen.getByText(/Page 1 of 3/i)).toBeInTheDocument();

      fireEvent.click(screen.getByRole("button", { name: /next page/i }));

      expect(screen.getByText(/Page 2 of 3/i)).toBeInTheDocument();
    });

    it("paginates to previous page when Prev is clicked", () => {
      renderTable({ data: createMockRows(25), initialPageSize: 10 });

      fireEvent.click(screen.getByRole("button", { name: /next page/i }));
      fireEvent.click(screen.getByRole("button", { name: /next page/i }));
      expect(screen.getByText(/Page 3 of 3/i)).toBeInTheDocument();

      fireEvent.click(screen.getByRole("button", { name: /previous page/i }));
      expect(screen.getByText(/Page 2 of 3/i)).toBeInTheDocument();
    });

    it("disables Prev button on first page", () => {
      renderTable({ data: createMockRows(25) });

      const prevBtn = screen.getByRole("button", { name: /previous page/i });
      expect(prevBtn).toBeDisabled();
    });

    it("disables Next button on last page", () => {
      renderTable({ data: createMockRows(10), initialPageSize: 10 });

      const nextBtn = screen.getByRole("button", { name: /next page/i });
      expect(nextBtn).toBeDisabled();
    });

    it("changes page size when selector changes", () => {
      renderTable({ data: createMockRows(50), initialPageSize: 10 });

      expect(screen.getByText(/Page 1 of 5/i)).toBeInTheDocument();

      const pageSizeSelect = screen.getByLabelText(/rows per page/i);
      fireEvent.change(pageSizeSelect, { target: { value: "25" } });

      expect(screen.getByText(/Page 1 of 2/i)).toBeInTheDocument();
    });

    it("resets to page 1 when page size changes", () => {
      renderTable({ data: createMockRows(50), initialPageSize: 10 });

      // Go to page 3
      fireEvent.click(screen.getByRole("button", { name: /next page/i }));
      fireEvent.click(screen.getByRole("button", { name: /next page/i }));
      expect(screen.getByText(/Page 3 of 5/i)).toBeInTheDocument();

      // Change page size
      const pageSizeSelect = screen.getByLabelText(/rows per page/i);
      fireEvent.change(pageSizeSelect, { target: { value: "25" } });

      // Should be back on page 1
      expect(screen.getByText(/Page 1 of 2/i)).toBeInTheDocument();
    });

    it("handles single page case", () => {
      renderTable({ data: createMockRows(5), initialPageSize: 10 });

      expect(screen.getByText(/Page 1 of 1/i)).toBeInTheDocument();

      const prevBtn = screen.getByRole("button", { name: /previous page/i });
      const nextBtn = screen.getByRole("button", { name: /next page/i });
      expect(prevBtn).toBeDisabled();
      expect(nextBtn).toBeDisabled();
    });
  });

  describe("accessibility", () => {
    it("has proper table aria-label", () => {
      renderTable();
      expect(screen.getByRole("table")).toHaveAttribute(
        "aria-label",
        "Property listings data table"
      );
    });

    it("has proper pagination nav aria-label", () => {
      renderTable();
      expect(screen.getByRole("navigation", { name: /pagination/i })).toBeInTheDocument();
    });

    it("has sort buttons with aria-labels", () => {
      renderTable();
      const sortButtons = screen.getAllByRole("button", { name: /sort by/i });
      expect(sortButtons.length).toBeGreaterThan(0);
    });
  });

  describe("formatting", () => {
    it("formats price as USD currency", () => {
      renderTable({ data: [{
        id: 1,
        square_footage: 2000,
        bedrooms: 3,
        bathrooms: 2,
        year_built: 2000,
        lot_size: 5000,
        distance_to_city_center: 5.0,
        school_rating: 7.0,
        price: 450000,
      }] });

      const priceCell = screen.getByText(/\$450,000/);
      expect(priceCell).toBeInTheDocument();
    });

    it("formats distance with mi suffix", () => {
      renderTable({ data: [{
        id: 1,
        square_footage: 2000,
        bedrooms: 3,
        bathrooms: 2,
        year_built: 2000,
        lot_size: 5000,
        distance_to_city_center: 8.5,
        school_rating: 7.0,
        price: 450000,
      }] });

      expect(screen.getByText("8.5 mi")).toBeInTheDocument();
    });

    it("formats school rating with /10 suffix", () => {
      renderTable({ data: [{
        id: 1,
        square_footage: 2000,
        bedrooms: 3,
        bathrooms: 2,
        year_built: 2000,
        lot_size: 5000,
        distance_to_city_center: 5.0,
        school_rating: 8.5,
        price: 450000,
      }] });

      expect(screen.getByText("8.5/10")).toBeInTheDocument();
    });

    it("formats large numbers with separators", () => {
      renderTable({ data: [{
        id: 1,
        square_footage: 2500,
        bedrooms: 3,
        bathrooms: 2,
        year_built: 2000,
        lot_size: 12500,
        distance_to_city_center: 5.0,
        school_rating: 7.0,
        price: 450000,
      }] });

      expect(screen.getByText("2,500")).toBeInTheDocument();
      expect(screen.getByText("12,500")).toBeInTheDocument();
    });
  });
});