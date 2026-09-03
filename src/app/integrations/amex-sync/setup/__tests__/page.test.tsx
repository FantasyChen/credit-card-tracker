import { render, screen } from "@testing-library/react";
import {
  AMEX_GREASY_FORK_URL,
  AMEX_READER_SUPPORT_URL,
} from "@/lib/amex-benefit-reader/public-links";
import AmexReaderSetupPage, { metadata } from "../page";

describe("public Amex reader setup page", () => {
  it("explains the manual Greasy Fork setup and safety boundaries", () => {
    render(<AmexReaderSetupPage />);

    expect(
      screen.getByRole("heading", {
        name: "Set up the Perks Reminder Amex benefit reader",
        level: 1,
      }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Tampermonkey/i)).toBeInTheDocument();
    expect(screen.getByText("Greasy Fork")).toBeInTheDocument();
    expect(screen.getByText(/signed-in American Express session/i)).toBeInTheDocument();
    expect(screen.getByText(/Scan all cards/i)).toBeInTheDocument();
    expect(screen.getByText(/exact five ending digits/i)).toBeInTheDocument();
    expect(screen.getByText(/Chrome extension and Greasy Fork userscript/i)).toBeInTheDocument();

    const installLink = screen.getByRole("link", { name: /Install from Greasy Fork/i });
    expect(installLink).toHaveAttribute("href", AMEX_GREASY_FORK_URL);
    expect(installLink).toHaveAttribute("target", "_blank");
    expect(installLink).toHaveAttribute("rel", "noopener noreferrer");

    const supportLink = screen.getByRole("link", { name: "reader support" });
    expect(supportLink).toHaveAttribute("href", AMEX_READER_SUPPORT_URL);
    expect(supportLink).toHaveAttribute("target", "_blank");
    expect(supportLink).toHaveAttribute("rel", "noopener noreferrer");
    expect(screen.getByRole("link", { name: "Read the privacy policy" })).toHaveAttribute("href", "/privacy");
  });

  it("publishes a canonical, indexable setup route", () => {
    expect(metadata).toMatchObject({
      title: "Set up the Amex benefit reader",
      alternates: { canonical: "/integrations/amex-sync/setup" },
    });
  });
});
