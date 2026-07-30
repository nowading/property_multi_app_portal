import "@testing-library/jest-dom";
import { fireEvent, render, screen } from "@testing-library/react";

import { FilterPanel } from "../FilterPanel";
import { DEFAULT_FILTERS, type StatsFilters } from "@/lib/schemas/analytics";

describe("FilterPanel", () => {
  const renderPanel = (filters: StatsFilters = {}, onReset?: jest.Mock) => {
    const onChange = jest.fn();
    render(
      <FilterPanel
        filters={filters}
        onChange={onChange}
        onReset={onReset}
      />
    );
    return { onChange };
  };

  describe("rendering", () => {
    it("renders the Filters card title and description", () => {
      renderPanel();
      expect(screen.getByText("Filters")).toBeInTheDocument();
      expect(screen.getByText(/no filters applied/i)).toBeInTheDocument();
    });

    it("renders all 6 filter sliders", () => {
      renderPanel();
      const sliders = screen.getAllByRole("slider");
      expect(sliders).toHaveLength(6);
    });

    it("shows 'Any' for unset filters", () => {
      renderPanel();
      const anyLabels = screen.getAllByText("Any");
      expect(anyLabels).toHaveLength(6);
    });

    it("shows formatted values for active filters", () => {
      renderPanel({ bedrooms_min: 3, distance_max: 10 });
      expect(screen.getByText("3")).toBeInTheDocument();
      expect(screen.getByText("10mi")).toBeInTheDocument();
    });

    it("shows active filter count", () => {
      renderPanel({ bedrooms_min: 2, year_built_min: 2000 });
      expect(screen.getByText("2 filters active")).toBeInTheDocument();
    });

    it("shows singular '1 filter active' for one filter", () => {
      renderPanel({ bedrooms_min: 2 });
      expect(screen.getByText("1 filter active")).toBeInTheDocument();
    });
  });

  describe("filter changes", () => {
    it("calls onChange when a slider is moved", () => {
      const { onChange } = renderPanel();
      const slider = screen.getByLabelText("Min Bedrooms range slider");
      fireEvent.change(slider, { target: { value: "4" } });
      expect(onChange).toHaveBeenCalledWith({ bedrooms_min: 4 });
    });

    it("calls onChange when a clear button is clicked", () => {
      const filters: StatsFilters = { bedrooms_min: 3 };
      const { onChange } = renderPanel(filters);
      const clearBtn = screen.getByLabelText("Clear Min Bedrooms filter");
      fireEvent.click(clearBtn);
      expect(onChange).toHaveBeenCalledWith({ bedrooms_min: undefined });
    });

    it("preserves other filter values when clearing one", () => {
      const filters: StatsFilters = { bedrooms_min: 2, distance_max: 15 };
      const { onChange } = renderPanel(filters);
      const clearBtn = screen.getByLabelText("Clear Min Bedrooms filter");
      fireEvent.click(clearBtn);
      expect(onChange).toHaveBeenCalledWith({
        bedrooms_min: undefined,
        distance_max: 15,
      });
    });

    it("syncs bedrooms_max when bedrooms_min exceeds max", () => {
      const filters: StatsFilters = { bedrooms_min: 2, bedrooms_max: 3 };
      const { onChange } = renderPanel(filters);
      const slider = screen.getByLabelText("Min Bedrooms range slider");
      fireEvent.change(slider, { target: { value: "5" } });
      expect(onChange).toHaveBeenCalledWith({
        bedrooms_min: 5,
        bedrooms_max: 5,
      });
    });

    it("syncs bedrooms_min when bedrooms_max goes below min", () => {
      const filters: StatsFilters = { bedrooms_min: 4, bedrooms_max: 6 };
      const { onChange } = renderPanel(filters);
      const slider = screen.getByLabelText("Max Bedrooms range slider");
      fireEvent.change(slider, { target: { value: "2" } });
      expect(onChange).toHaveBeenCalledWith({
        bedrooms_min: 2,
        bedrooms_max: 2,
      });
    });

    it("syncs year_built_max when year_built_min exceeds max", () => {
      const filters: StatsFilters = { year_built_min: 1980, year_built_max: 2000 };
      const { onChange } = renderPanel(filters);
      const slider = screen.getByLabelText("Min Year Built range slider");
      fireEvent.change(slider, { target: { value: "2010" } });
      expect(onChange).toHaveBeenCalledWith({
        year_built_min: 2010,
        year_built_max: 2010,
      });
    });
  });

  describe("reset", () => {
    it("does not show Clear all button when no filters active", () => {
      renderPanel(DEFAULT_FILTERS, jest.fn());
      expect(screen.queryByText("Clear all")).not.toBeInTheDocument();
    });

    it("shows Clear all button when filters are active", () => {
      renderPanel({ bedrooms_min: 2 }, jest.fn());
      expect(screen.getByText("Clear all")).toBeInTheDocument();
    });

    it("calls onReset when Clear all is clicked", () => {
      const onReset = jest.fn();
      renderPanel({ bedrooms_min: 2, distance_max: 10 }, onReset);
      fireEvent.click(screen.getByText("Clear all"));
      expect(onReset).toHaveBeenCalledTimes(1);
    });
  });

  describe("boundary values", () => {
    it("treats 0 as an active filter value (not undefined)", () => {
      renderPanel({ distance_max: 0 });
      expect(screen.getByText("1 filter active")).toBeInTheDocument();
      const zeroLabels = screen.getAllByText("0mi");
      expect(zeroLabels.length).toBeGreaterThanOrEqual(1);
    });

    it("slider is enabled when filter is undefined (user can set a value)", () => {
      renderPanel();
      const slider = screen.getByLabelText("Min Bedrooms range slider");
      expect(slider).not.toBeDisabled();
    });

    it("slider is enabled when filter has a value", () => {
      renderPanel({ bedrooms_min: 3 });
      const slider = screen.getByLabelText("Min Bedrooms range slider");
      expect(slider).not.toBeDisabled();
    });
  });
});