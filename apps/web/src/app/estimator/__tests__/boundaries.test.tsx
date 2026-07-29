import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import EstimatorError from "../error";
import EstimatorLoading from "../loading";

describe("Estimator loading boundary", () => {
  it("renders an accessible status region with a contextual label", () => {
    const { container } = render(<EstimatorLoading />);
    const status = screen.getByRole("status");
    expect(status).toHaveTextContent("Loading estimator…");
    expect(status).toHaveAttribute("aria-live", "polite");
    // spinner element present
    expect(container.querySelector("[aria-hidden]")).not.toBeNull();
  });
});

describe("Estimator error boundary", () => {
  it("renders the contextual fallback heading", () => {
    render(<EstimatorError error={new Error("boom")} reset={jest.fn()} />);
    expect(
      screen.getByRole("heading", { level: 2, name: /estimator unavailable/i })
    ).toBeInTheDocument();
  });

  it("mentions the estimator backend as a likely cause", () => {
    render(<EstimatorError error={new Error("boom")} reset={jest.fn()} />);
    expect(
      screen.getByText(/estimator backend may be offline/i)
    ).toBeInTheDocument();
  });

  it("renders a Try again button that calls reset when clicked", async () => {
    const user = userEvent.setup();
    const reset = jest.fn();
    render(<EstimatorError error={new Error("boom")} reset={reset} />);
    await user.click(screen.getByRole("button", { name: /try again/i }));
    expect(reset).toHaveBeenCalledTimes(1);
  });

  it("renders a 'View saved estimates' link to /estimator/history", () => {
    render(<EstimatorError error={new Error("boom")} reset={jest.fn()} />);
    const link = screen.getByRole("link", { name: /view saved estimates/i });
    expect(link).toHaveAttribute("href", "/estimator/history");
  });

  it("exposes the error digest when present", () => {
    const error = new Error("boom") as Error & { digest?: string };
    error.digest = "est-abc-123";
    render(<EstimatorError error={error} reset={jest.fn()} />);
    expect(screen.getByText("est-abc-123")).toBeInTheDocument();
  });

  it("omits the reference block when digest is absent", () => {
    render(<EstimatorError error={new Error("boom")} reset={jest.fn()} />);
    expect(screen.queryByText(/reference/i)).not.toBeInTheDocument();
  });

  it("logs the error to console.error on mount", () => {
    const spy = jest.spyOn(console, "error").mockImplementation(() => {});
    const error = new Error("estimator-boom");
    render(<EstimatorError error={error} reset={jest.fn()} />);
    expect(spy).toHaveBeenCalledWith(
      "[portal] estimator route error:",
      expect.objectContaining({ message: "estimator-boom" })
    );
    spy.mockRestore();
  });

  it("uses role=alert so screen readers announce the error", () => {
    render(<EstimatorError error={new Error("boom")} reset={jest.fn()} />);
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });
});
