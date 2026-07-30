import "@testing-library/jest-dom";
import { fireEvent, render, screen } from "@testing-library/react";

import { ExportPanel } from "../ExportPanel";
import type { MarketStats, PropertyRow } from "@/lib/schemas/analytics";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const SAMPLE_ROWS: PropertyRow[] = [
  {
    id: 1,
    square_footage: 2000,
    bedrooms: 3,
    bathrooms: 2,
    year_built: 1995,
    lot_size: 6000,
    distance_to_city_center: 5,
    school_rating: 7,
    price: 550_000,
  },
  {
    id: 2,
    square_footage: 1500,
    bedrooms: 2,
    bathrooms: 1,
    year_built: 2010,
    lot_size: 4000,
    distance_to_city_center: 3,
    school_rating: 8,
    price: 420_000,
  },
];

const SAMPLE_STATS: MarketStats = {
  kpis: {
    count: 500,
    avg_price: 600_000,
    median_price: 550_000,
    min_price: 100_000,
    max_price: 2_000_000,
    std_dev_price: 150_000,
    avg_square_footage: 2000,
    avg_price_per_sqft: 300,
  },
  price_histogram: [
    { range: "$0 – $200k", count: 50, range_start: 0, range_end: 200000 },
  ],
  price_vs_sqft: [],
  box_plot_by_bedrooms: [
    { bedrooms: 1, min: 100000, q1: 200000, median: 300000, q3: 400000, max: 500000, count: 50 },
  ],
  filters_applied: {},
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("ExportPanel", () => {
  describe("rendering", () => {
    it("renders the panel title and description", () => {
      render(<ExportPanel stats={SAMPLE_STATS} dataset={SAMPLE_ROWS} />);

      expect(screen.getByText("Export Data")).toBeInTheDocument();
      expect(
        screen.getByText(/download property dataset and market analysis/i)
      ).toBeInTheDocument();
    });

    it("renders all four export buttons", () => {
      render(<ExportPanel stats={SAMPLE_STATS} dataset={SAMPLE_ROWS} />);

      expect(screen.getByText("Dataset (CSV)")).toBeInTheDocument();
      expect(screen.getByText("Statistics (CSV)")).toBeInTheDocument();
      expect(screen.getByText("Report (PDF)")).toBeInTheDocument();
      expect(screen.getByText("Export All")).toBeInTheDocument();
    });

    it("shows dataset count in button description", () => {
      render(<ExportPanel stats={SAMPLE_STATS} dataset={SAMPLE_ROWS} />);

      expect(screen.getByText("2 properties")).toBeInTheDocument();
    });

    it("shows button descriptions", () => {
      render(<ExportPanel stats={SAMPLE_STATS} dataset={SAMPLE_ROWS} />);

      expect(screen.getByText(/kpi, histogram, box plot/i)).toBeInTheDocument();
      expect(screen.getByText(/print dashboard to pdf/i)).toBeInTheDocument();
      expect(screen.getByText(/both csvs in one click/i)).toBeInTheDocument();
    });
  });

  describe("export actions", () => {
    it("Dataset CSV button calls onExportDataset and shows success", () => {
      const mockExport = jest.fn();
      render(
        <ExportPanel
          stats={SAMPLE_STATS}
          dataset={SAMPLE_ROWS}
          onExportDataset={mockExport}
        />
      );

      fireEvent.click(screen.getByText("Dataset (CSV)"));

      expect(mockExport).toHaveBeenCalledTimes(1);
      expect(mockExport).toHaveBeenCalledWith(SAMPLE_ROWS);
      expect(
        screen.getByText(/exported 2 properties as csv/i)
      ).toBeInTheDocument();
    });

    it("Statistics CSV button calls onExportStats and shows success", () => {
      const mockExport = jest.fn();
      render(
        <ExportPanel
          stats={SAMPLE_STATS}
          dataset={SAMPLE_ROWS}
          onExportStats={mockExport}
        />
      );

      fireEvent.click(screen.getByText("Statistics (CSV)"));

      expect(mockExport).toHaveBeenCalledTimes(1);
      expect(mockExport).toHaveBeenCalledWith(SAMPLE_STATS);
      expect(
        screen.getByText(/exported market statistics as csv/i)
      ).toBeInTheDocument();
    });

    it("Export All button calls onExportAll and shows success", () => {
      const mockExportAll = jest.fn().mockReturnValue({
        success: true,
        message: "Exported everything.",
      });

      render(
        <ExportPanel
          stats={SAMPLE_STATS}
          dataset={SAMPLE_ROWS}
          onExportAll={mockExportAll}
        />
      );

      fireEvent.click(screen.getByText("Export All"));

      expect(mockExportAll).toHaveBeenCalledTimes(1);
      expect(mockExportAll).toHaveBeenCalledWith(SAMPLE_STATS, SAMPLE_ROWS);
      expect(screen.getByText(/exported everything/i)).toBeInTheDocument();
    });

    it("shows error message when export fails", () => {
      const mockFail = jest.fn(() => {
        throw new Error("Disk full");
      });

      render(
        <ExportPanel
          stats={SAMPLE_STATS}
          dataset={SAMPLE_ROWS}
          onExportDataset={mockFail}
        />
      );

      fireEvent.click(screen.getByText("Dataset (CSV)"));

      expect(screen.getByText(/disk full/i)).toBeInTheDocument();
    });
  });

  describe("PDF export", () => {
    it("Report PDF button calls onExportPdf", () => {
      const mockPdf = jest.fn();
      render(
        <ExportPanel
          stats={SAMPLE_STATS}
          dataset={SAMPLE_ROWS}
          onExportPdf={mockPdf}
        />
      );

      fireEvent.click(screen.getByText("Report (PDF)"));

      expect(mockPdf).toHaveBeenCalledTimes(1);
      expect(
        screen.getByText(/opened print dialog/i)
      ).toBeInTheDocument();
    });

    it("shows error when PDF export fails", () => {
      const mockPdfFail = jest.fn(() => {
        throw new Error("Print not supported");
      });

      render(
        <ExportPanel
          stats={SAMPLE_STATS}
          dataset={SAMPLE_ROWS}
          onExportPdf={mockPdfFail}
        />
      );

      fireEvent.click(screen.getByText("Report (PDF)"));

      expect(screen.getByText(/print not supported/i)).toBeInTheDocument();
    });
  });

  describe("state management", () => {
    it("disables dataset button when dataset is empty", () => {
      render(<ExportPanel stats={SAMPLE_STATS} dataset={[]} />);

      const datasetButton = screen.getByText("Dataset (CSV)").closest("button");
      expect(datasetButton).toBeDisabled();
    });

    it("enables all buttons when dataset has rows", () => {
      render(<ExportPanel stats={SAMPLE_STATS} dataset={SAMPLE_ROWS} />);

      const buttons = screen.getAllByRole("button");
      buttons.forEach((btn) => {
        expect(btn).not.toBeDisabled();
      });
    });
  });

  describe("accessibility", () => {
    it("all export buttons have aria-labels", () => {
      render(<ExportPanel stats={SAMPLE_STATS} dataset={SAMPLE_ROWS} />);

      const buttons = screen.getAllByRole("button");
      buttons.forEach((btn) => {
        expect(btn).toHaveAttribute("aria-label");
      });
    });

    it("status message uses aria-live region", () => {
      render(
        <ExportPanel
          stats={SAMPLE_STATS}
          dataset={SAMPLE_ROWS}
          onExportDataset={() => {}}
        />
      );

      fireEvent.click(screen.getByText("Dataset (CSV)"));

      const status = screen.getByRole("status");
      expect(status).toHaveAttribute("aria-live", "polite");
    });
  });
});