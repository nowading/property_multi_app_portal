import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import userEvent, { type UserEvent } from "@testing-library/user-event";

import { EstimatorForm } from "../EstimatorForm";
import { FIELD_CONFIGS, type PropertyFeatures } from "@/lib/schemas/estimator";

async function fillAllFields(user: UserEvent) {
  const sample: Record<string, string> = {
    square_footage: "2000",
    bedrooms: "3",
    bathrooms: "2.5",
    year_built: "1990",
    lot_size: "5000",
    distance_to_city_center: "5.5",
    school_rating: "8",
  };
  for (const f of FIELD_CONFIGS) {
    await user.type(screen.getByLabelText(f.label), sample[f.name]!);
  }
}

describe("EstimatorForm", () => {
  it("renders all 7 feature inputs with labels", () => {
    render(<EstimatorForm onSubmit={jest.fn()} />);
    for (const field of FIELD_CONFIGS) {
      expect(screen.getByLabelText(field.label)).toBeInTheDocument();
    }
  });

  it("renders a submit button labelled 'Estimate Value'", () => {
    render(<EstimatorForm onSubmit={jest.fn()} />);
    expect(
      screen.getByRole("button", { name: /estimate value/i })
    ).toBeInTheDocument();
  });

  it("shows 'required' errors for all empty fields on submit and does not call onSubmit", async () => {
    const user = userEvent.setup();
    const onSubmit = jest.fn();
    render(<EstimatorForm onSubmit={onSubmit} />);

    await user.click(screen.getByRole("button", { name: /estimate value/i }));

    // Every field should now have an error message with role="alert".
    const alerts = screen.getAllByRole("alert");
    expect(alerts).toHaveLength(FIELD_CONFIGS.length);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("submits parsed numeric values when all fields are valid", async () => {
    const user = userEvent.setup();
    const onSubmit = jest.fn() as jest.Mock<void, [PropertyFeatures]>;
    render(<EstimatorForm onSubmit={onSubmit} />);

    await fillAllFields(user);
    await user.click(screen.getByRole("button", { name: /estimate value/i }));

    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledWith({
      square_footage: 2000,
      bedrooms: 3,
      bathrooms: 2.5,
      year_built: 1990,
      lot_size: 5000,
      distance_to_city_center: 5.5,
      school_rating: 8,
    });
  });

  it("clears a field's error when the user edits that field", async () => {
    const user = userEvent.setup();
    render(<EstimatorForm onSubmit={jest.fn()} />);

    await user.click(screen.getByRole("button", { name: /estimate value/i }));
    expect(screen.getAllByRole("alert")).toHaveLength(FIELD_CONFIGS.length);

    // Type into the first field (Square Footage).
    await user.type(screen.getByLabelText("Square Footage"), "2000");

    // That field's error should be gone; others remain.
    const alertsAfter = screen.getAllByRole("alert");
    expect(alertsAfter).toHaveLength(FIELD_CONFIGS.length - 1);
  });

  it("shows a range error when a value is out of bounds", async () => {
    const user = userEvent.setup();
    render(<EstimatorForm onSubmit={jest.fn()} />);

    await user.type(screen.getByLabelText("School Rating"), "15");
    await user.click(screen.getByRole("button", { name: /estimate value/i }));

    const alerts = screen.getAllByRole("alert");
    const schoolAlert = alerts.find((a) => a.textContent?.includes("10"));
    expect(schoolAlert).toBeDefined();
  });

  it("disables all inputs and the button when isLoading is true", () => {
    render(<EstimatorForm onSubmit={jest.fn()} isLoading={true} />);
    const button = screen.getByRole("button", { name: /estimate value/i });
    expect(button).toBeDisabled();
    for (const field of FIELD_CONFIGS) {
      expect(screen.getByLabelText(field.label)).toBeDisabled();
    }
  });
});
