import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import ErrorBoundary from "../error";
import Loading from "../loading";

describe("Loading boundary", () => {
  it("renders an accessible status region with a spinner and label", () => {
    const { container } = render(<Loading />);
    const status = screen.getByRole("status");
    expect(status).toHaveTextContent("Loading…");
    expect(status).toHaveAttribute("aria-live", "polite");
    // spinner element present
    expect(container.querySelector("[aria-hidden]")).not.toBeNull();
  });
});

describe("Error boundary", () => {
  it("renders the fallback heading and a Try again button", () => {
    const error = new Error("boom");
    render(<ErrorBoundary error={error} reset={jest.fn()} />);
    expect(
      screen.getByRole("heading", { level: 2, name: /something went wrong/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /try again/i })
    ).toBeInTheDocument();
  });

  it("calls reset when the Try again button is clicked", async () => {
    const user = userEvent.setup();
    const reset = jest.fn();
    render(<ErrorBoundary error={new Error("boom")} reset={reset} />);
    await user.click(screen.getByRole("button", { name: /try again/i }));
    expect(reset).toHaveBeenCalledTimes(1);
  });

  it("exposes the error digest when present", () => {
    const error = new Error("boom") as Error & { digest?: string };
    error.digest = "abc-123";
    render(<ErrorBoundary error={error} reset={jest.fn()} />);
    expect(screen.getByText("abc-123")).toBeInTheDocument();
  });

  it("omits the reference block when digest is absent", () => {
    render(<ErrorBoundary error={new Error("boom")} reset={jest.fn()} />);
    expect(screen.queryByText(/reference/i)).not.toBeInTheDocument();
  });

  it("logs the error to console.error on mount", () => {
    const spy = jest.spyOn(console, "error").mockImplementation(() => {});
    const error = new Error("logged-boom");
    render(<ErrorBoundary error={error} reset={jest.fn()} />);
    expect(spy).toHaveBeenCalledWith(
      "[portal] route error:",
      expect.objectContaining({ message: "logged-boom" })
    );
    spy.mockRestore();
  });
});
