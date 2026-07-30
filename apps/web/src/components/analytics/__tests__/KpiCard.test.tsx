import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";

import { KpiCard } from "../KpiCard";

describe("KpiCard", () => {
  it("renders label and value", () => {
    render(<KpiCard label="Average Price" value="$350,000" />);
    expect(screen.getByText("Average Price")).toBeInTheDocument();
    expect(screen.getByText("$350,000")).toBeInTheDocument();
  });

  it("renders trend indicator with up arrow", () => {
    render(
      <KpiCard
        label="Test"
        value="100"
        trend="up"
        trendValue="+5.2%"
      />
    );
    const trend = screen.getByLabelText(/up trend/i);
    expect(trend).toHaveTextContent("▲");
    expect(trend).toHaveTextContent("+5.2%");
  });

  it("renders trend indicator with down arrow", () => {
    render(
      <KpiCard
        label="Test"
        value="100"
        trend="down"
        trendValue="-2.1%"
      />
    );
    const trend = screen.getByLabelText(/down trend/i);
    expect(trend).toHaveTextContent("▼");
  });

  it("renders trend indicator with flat arrow", () => {
    render(
      <KpiCard
        label="Test"
        value="100"
        trend="flat"
        trendValue="―"
      />
    );
    const trend = screen.getByLabelText(/flat trend/i);
    expect(trend).toHaveTextContent("―");
  });

  it("renders description text", () => {
    render(
      <KpiCard
        label="Test"
        value="100"
        description="As of Q1 2026"
      />
    );
    expect(screen.getByText("As of Q1 2026")).toBeInTheDocument();
  });

  it("renders icon when provided", () => {
    render(
      <KpiCard
        label="Test"
        value="100"
        icon={<span data-testid="test-icon">★</span>}
      />
    );
    expect(screen.getByTestId("test-icon")).toBeInTheDocument();
  });

  it("does not render trend section when trend is omitted", () => {
    render(<KpiCard label="Test" value="100" />);
    // No trend arrow should be present
    expect(screen.queryByLabelText(/trend/i)).not.toBeInTheDocument();
  });

  it("does not render description when omitted", () => {
    const { container } = render(<KpiCard label="Test" value="100" />);
    // No description text with slate-400 color
    expect(container.querySelector(".text-slate-400")).not.toBeInTheDocument();
  });
});
