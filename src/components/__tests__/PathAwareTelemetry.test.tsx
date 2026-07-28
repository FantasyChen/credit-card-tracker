import { render, screen } from "@testing-library/react";
import PathAwareTelemetry from "../PathAwareTelemetry";

const mockPathname = jest.fn(() => "/");
jest.mock("next/navigation", () => ({ usePathname: () => mockPathname() }));
jest.mock("next/script", () => function MockScript(props: { id?: string; src?: string }) {
  return <span data-testid={props.id ?? "script"} data-src={props.src} />;
});
jest.mock("@vercel/analytics/next", () => ({ Analytics: () => <span data-testid="vercel-analytics" /> }));

describe("pathname-aware telemetry", () => {
  beforeEach(() => mockPathname.mockReturnValue("/"));

  it("loads configured analytics outside the private handoff", () => {
    render(<PathAwareTelemetry googleAnalyticsId="G-SYNTHETIC" />);
    expect(screen.getByTestId("google-analytics-loader")).toHaveAttribute("data-src", expect.stringContaining("G-SYNTHETIC"));
    expect(screen.getByTestId("google-analytics-config")).toBeInTheDocument();
    expect(screen.getByTestId("vercel-analytics")).toBeInTheDocument();
  });

  it("loads no Google or Vercel analytics on the exact handoff path", () => {
    mockPathname.mockReturnValue("/integrations/amex-sync");
    const { container } = render(<PathAwareTelemetry googleAnalyticsId="G-SYNTHETIC" />);
    expect(container).toBeEmptyDOMElement();
  });

  it("does not suppress telemetry on a lookalike path", () => {
    mockPathname.mockReturnValue("/integrations/amex-sync-history");
    render(<PathAwareTelemetry />);
    expect(screen.getByTestId("vercel-analytics")).toBeInTheDocument();
  });
});
