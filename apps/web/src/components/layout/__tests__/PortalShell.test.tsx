import "@testing-library/jest-dom";
import { render, screen, within } from "@testing-library/react";

import { PortalShell } from "../PortalShell";

// `Sidebar` uses `usePathname` from next/navigation — mock it per test.
jest.mock("next/navigation", () => ({
  usePathname: jest.fn(() => "/"),
}));

// `next/link` renders an anchor in jsdom; no special mock needed.
describe("PortalShell", () => {
  it("renders the header with the portal brand", () => {
    render(
      <PortalShell>
        <div />
      </PortalShell>
    );
    const header = screen.getByRole("banner");
    expect(
      within(header).getByRole("link", { name: /property portal home/i })
    ).toHaveAttribute("href", "/");
  });

  it("renders the primary navigation with all three nav items", () => {
    render(
      <PortalShell>
        <div />
      </PortalShell>
    );
    const nav = screen.getByRole("navigation", {
      name: /primary navigation/i,
    });

    const links = within(nav).getAllByRole("link");
    expect(links).toHaveLength(3);

    const hrefs = links.map((l) => l.getAttribute("href"));
    expect(hrefs).toEqual(["/", "/estimator", "/analytics"]);
  });

  it("renders nav item labels and descriptions", () => {
    render(
      <PortalShell>
        <div />
      </PortalShell>
    );
    expect(screen.getByText("Home")).toBeInTheDocument();
    expect(screen.getByText("Estimator")).toBeInTheDocument();
    expect(screen.getByText("Analytics")).toBeInTheDocument();
  });

  it("marks the active nav item with aria-current=page when path matches", () => {
    const { usePathname } = jest.requireMock("next/navigation") as {
      usePathname: jest.Mock;
    };
    usePathname.mockReturnValue("/estimator");

    render(
      <PortalShell>
        <div />
      </PortalShell>
    );
    const nav = screen.getByRole("navigation", { name: /primary navigation/i });
    const activeLinks = within(nav).getAllByRole("link", { current: "page" });
    expect(activeLinks).toHaveLength(1);
    expect(activeLinks[0]).toHaveAttribute("href", "/estimator");
  });

  it("renders the footer with current year", () => {
    render(
      <PortalShell>
        <div />
      </PortalShell>
    );
    const footer = screen.getByRole("contentinfo");
    const year = new Date().getFullYear().toString();
    expect(footer.textContent).toContain(year);
  });

  it("renders children inside the main content region", () => {
    render(
      <PortalShell>
        <p>Page-specific content</p>
      </PortalShell>
    );
    const main = screen.getByRole("main");
    expect(main).toContainElement(screen.getByText("Page-specific content"));
  });

  it("exposes a skip link pointing at main content", () => {
    render(
      <PortalShell>
        <div />
      </PortalShell>
    );
    const skipLink = screen.getByRole("link", { name: /skip to main content/i });
    expect(skipLink).toHaveAttribute("href", "#main-content");
  });
});
