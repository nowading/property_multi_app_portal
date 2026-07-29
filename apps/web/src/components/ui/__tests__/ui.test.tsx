import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";

import { Badge } from "../Badge";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "../Card";
import { Input } from "../Input";

describe("Card", () => {
  it("renders all subcomponents in the expected slots", () => {
    render(
      <Card>
        <CardHeader>
          <CardTitle>Title</CardTitle>
          <CardDescription>Description</CardDescription>
        </CardHeader>
        <CardContent>Body</CardContent>
        <CardFooter>Footer</CardFooter>
      </Card>
    );
    expect(screen.getByText("Title")).toBeInTheDocument();
    expect(screen.getByText("Description")).toBeInTheDocument();
    expect(screen.getByText("Body")).toBeInTheDocument();
    expect(screen.getByText("Footer")).toBeInTheDocument();
  });

  it("CardTitle renders as an h3 for correct heading semantics", () => {
    render(<CardTitle>Heading</CardTitle>);
    expect(screen.getByRole("heading", { level: 3 })).toHaveTextContent(
      "Heading"
    );
  });
});

describe("Input", () => {
  it("renders label associated with input via htmlFor", () => {
    render(<Input id="email" label="Email" />);
    const input = screen.getByLabelText("Email") as HTMLInputElement;
    expect(input.id).toBe("email");
  });

  it("renders hint text when provided", () => {
    render(<Input id="x" label="X" hint="Helpful text" />);
    expect(screen.getByText("Helpful text")).toBeInTheDocument();
  });

  it("sets aria-invalid and aria-describedby when error is present", () => {
    render(<Input id="age" label="Age" error="Must be positive" />);
    const input = screen.getByLabelText("Age");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAttribute("aria-describedby", "age-error");
    expect(screen.getByRole("alert")).toHaveTextContent("Must be positive");
  });

  it("hides hint when error is also present (error takes precedence)", () => {
    render(
      <Input id="y" label="Y" hint="Hint text" error="Error text" />
    );
    expect(screen.queryByText("Hint text")).not.toBeInTheDocument();
    expect(screen.getByText("Error text")).toBeInTheDocument();
  });

  it("forwards native input attributes", () => {
    render(
      <Input
        id="n"
        type="number"
        placeholder="0"
        defaultValue={42}
        min={0}
      />
    );
    const input = screen.getByPlaceholderText("0") as HTMLInputElement;
    expect(input.type).toBe("number");
    expect(input.value).toBe("42");
    expect(input.min).toBe("0");
  });
});

describe("Badge", () => {
  it.each([
    ["default", "bg-slate-100"],
    ["primary", "bg-primary-50"],
    ["success", "bg-emerald-50"],
    ["warning", "bg-amber-50"],
    ["danger", "bg-red-50"],
    ["info", "bg-sky-50"],
  ] as const)("applies %s variant classes", (variant, expectedClass) => {
    const { container } = render(
      <Badge variant={variant}>{variant}</Badge>
    );
    expect(container.querySelector("span")!.className).toContain(
      expectedClass
    );
  });

  it("renders children text", () => {
    render(<Badge>New</Badge>);
    expect(screen.getByText("New")).toBeInTheDocument();
  });
});
