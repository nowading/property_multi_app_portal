import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";

import AnalyticsError from "@/app/analytics/error";
import AnalyticsLoading from "@/app/analytics/loading";

describe("Analytics loading boundary", () => {
  it("renders an accessible status region with contextual label", () => {
    render(<AnalyticsLoading />);
    const status = screen.getByRole("status");
    expect(status).toHaveTextContent("Loading market data…");
    expect(status).toHaveAttribute("aria-live", "polite");
  });

  it("renders a loading spinner", () => {
    render(<AnalyticsLoading />);
    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(
      screen.getByText(/loading market data/i)
    ).toBeInTheDocument();
  });
});

describe("Analytics error boundary", () => {
  it("renders the contextual fallback heading", () => {
    render(
      <AnalyticsError error={new Error("boom")} reset={jest.fn()} />
    );
    expect(
      screen.getByRole("heading", { level: 2, name: /dashboard unavailable/i })
    ).toBeInTheDocument();
  });

  it("renders error explanation text", () => {
    render(
      <AnalyticsError error={new Error("boom")} reset={jest.fn()} />
    );
    expect(
      screen.getByText(/couldn't load the market analysis/i)
    ).toBeInTheDocument();
  });

  it("renders a 'Try again' button that calls reset", () => {
    const reset = jest.fn();
    render(<AnalyticsError error={new Error("boom")} reset={reset} />);

    const button = screen.getByRole("button", { name: /try again/i });
    expect(button).toBeInTheDocument();

    button.click();
    expect(reset).toHaveBeenCalledTimes(1);
  });

  it("renders a 'Go home' link", () => {
    render(
      <AnalyticsError error={new Error("boom")} reset={jest.fn()} />
    );
    const link = screen.getByRole("link", { name: /go home/i });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute("href", "/");
  });

  it("renders digest when provided", () => {
    const err: Error & { digest?: string } = new Error("boom");
    err.digest = "abc123";
    render(<AnalyticsError error={err} reset={jest.fn()} />);
    expect(screen.getByText("abc123")).toBeInTheDocument();
  });
});
