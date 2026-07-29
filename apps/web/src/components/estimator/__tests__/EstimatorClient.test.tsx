import "@testing-library/jest-dom";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent, { type UserEvent } from "@testing-library/user-event";

import { EstimatorClient } from "../EstimatorClient";

const FIELD_LABELS = [
  "Square Footage",
  "Bedrooms",
  "Bathrooms",
  "Year Built",
  "Lot Size",
  "Distance to City Center",
  "School Rating",
] as const;

const SAMPLE_VALUES: Record<string, string> = {
  square_footage: "2000",
  bedrooms: "3",
  bathrooms: "2.5",
  year_built: "1990",
  lot_size: "5000",
  distance_to_city_center: "5.5",
  school_rating: "8",
};

async function fillForm(user: UserEvent) {
  for (const label of FIELD_LABELS) {
    const field = label.toLowerCase().replace(/ /g, "_");
    await user.type(screen.getByLabelText(label), SAMPLE_VALUES[field]!);
  }
}

function jsonResponse(data: unknown) {
  return {
    ok: true,
    status: 200,
    json: async () => ({ success: true, data, error: null }),
  } as Response;
}

describe("EstimatorClient", () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it("renders the form on initial mount", () => {
    render(<EstimatorClient />);
    expect(screen.getByLabelText("Square Footage")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /estimate value/i })
    ).toBeInTheDocument();
  });

  it("shows loading state while the request is in flight", async () => {
    let resolveFetch!: (v: Response) => void;
    global.fetch = jest.fn(
      () => new Promise<Response>((res) => (resolveFetch = res))
    ) as unknown as typeof fetch;

    const user = userEvent.setup();
    render(<EstimatorClient />);

    await fillForm(user);
    await user.click(screen.getByRole("button", { name: /estimate value/i }));

    expect(screen.getByText(/estimating property value/i)).toBeInTheDocument();
    resolveFetch(jsonResponse({ predicted_price: 350000 }));
  });

  it("renders the predicted price on a successful response", async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValue(jsonResponse({ predicted_price: 425000.5 })) as unknown as typeof fetch;

    const user = userEvent.setup();
    render(<EstimatorClient />);

    await fillForm(user);
    await user.click(screen.getByRole("button", { name: /estimate value/i }));

    await waitFor(() =>
      expect(screen.getByText("$425,000.50")).toBeInTheDocument()
    );
  });

  it("renders an error card with the envelope error code on failure", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        success: false,
        data: null,
        error: {
          code: "ML_SERVICE_TIMEOUT",
          message: "The ML model service failed to respond in time.",
        },
      }),
    } as Response) as unknown as typeof fetch;

    const user = userEvent.setup();
    render(<EstimatorClient />);

    await fillForm(user);
    await user.click(screen.getByRole("button", { name: /estimate value/i }));

    await waitFor(() =>
      expect(screen.getByText(/estimation failed/i)).toBeInTheDocument()
    );
    expect(screen.getByText("ML_SERVICE_TIMEOUT")).toBeInTheDocument();
    expect(
      screen.getByText(/ML model service failed to respond in time/i)
    ).toBeInTheDocument();
  });

  it("renders a network error when fetch rejects", async () => {
    global.fetch = jest
      .fn()
      .mockRejectedValue(new Error("Failed to fetch")) as unknown as typeof fetch;

    const user = userEvent.setup();
    render(<EstimatorClient />);

    await fillForm(user);
    await user.click(screen.getByRole("button", { name: /estimate value/i }));

    await waitFor(() =>
      expect(screen.getByText(/estimation failed/i)).toBeInTheDocument()
    );
    expect(screen.getByText("NETWORK_ERROR")).toBeInTheDocument();
  });

  it("sends a POST request with the typed feature payload", async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValue(jsonResponse({ predicted_price: 100 })) as unknown as jest.Mock;
    global.fetch = fetchMock as unknown as typeof fetch;

    const user = userEvent.setup();
    render(<EstimatorClient />);

    await fillForm(user);
    await user.click(screen.getByRole("button", { name: /estimate value/i }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain("/predict");
    expect(init.method).toBe("POST");
    expect(init.cache).toBe("no-store");
    expect(JSON.parse(init.body)).toEqual({
      square_footage: 2000,
      bedrooms: 3,
      bathrooms: 2.5,
      year_built: 1990,
      lot_size: 5000,
      distance_to_city_center: 5.5,
      school_rating: 8,
    });
  });
});
