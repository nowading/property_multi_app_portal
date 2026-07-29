import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";

import { Button } from "../Button";

describe("Button", () => {
  it("renders children", () => {
    render(<Button>Click me</Button>);
    expect(
      screen.getByRole("button", { name: /click me/i })
    ).toBeInTheDocument();
  });

  it("applies primary variant classes by default", () => {
    const { container } = render(<Button>Default</Button>);
    const button = container.querySelector("button")!;
    expect(button.className).toContain("bg-primary-600");
    expect(button.className).toContain("text-white");
  });

  it.each([
    ["primary", "bg-primary-600"],
    ["secondary", "bg-slate-100"],
    ["outline", "border-slate-300"],
    ["ghost", "bg-transparent"],
    ["danger", "bg-red-600"],
  ] as const)("applies %s variant classes", (variant, expectedClass) => {
    const { container } = render(<Button variant={variant}>x</Button>);
    expect(container.querySelector("button")!.className).toContain(
      expectedClass
    );
  });

  it.each([
    ["sm", "h-8"],
    ["md", "h-10"],
    ["lg", "h-12"],
  ] as const)("applies %s size classes", (size, expectedClass) => {
    const { container } = render(<Button size={size}>x</Button>);
    expect(container.querySelector("button")!.className).toContain(
      expectedClass
    );
  });

  it("matches snapshot for all variants", () => {
    const { container } = render(
      <div>
        <Button variant="primary">Primary</Button>
        <Button variant="secondary">Secondary</Button>
        <Button variant="outline">Outline</Button>
        <Button variant="ghost">Ghost</Button>
        <Button variant="danger">Danger</Button>
      </div>
    );
    expect(container).toMatchSnapshot();
  });

  it("shows spinner and sets aria-busy when loading", () => {
    const { container } = render(<Button isLoading>Save</Button>);
    const button = container.querySelector("button")!;
    expect(button).toHaveAttribute("aria-busy", "true");
    expect(button).toBeDisabled();
    expect(button.querySelector("span[aria-hidden]")).not.toBeNull();
  });

  it("is disabled when disabled prop is set", () => {
    render(<Button disabled>Nope</Button>);
    expect(screen.getByRole("button", { name: /nope/i })).toBeDisabled();
  });

  it("forwards extra attributes (type, onClick)", () => {
    const onClick = jest.fn();
    render(
      <Button type="submit" onClick={onClick}>
        Submit
      </Button>
    );
    const button = screen.getByRole("button", { name: /submit/i });
    expect(button).toHaveAttribute("type", "submit");
    button.click();
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
