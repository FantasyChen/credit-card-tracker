import {
  decodeNumericCharacterReferences,
  formatAmexBenefitTitle,
} from "../provider-text";

describe("Amex provider display text", () => {
  it("decodes decimal and hexadecimal numeric character references once", () => {
    expect(decodeNumericCharacterReferences("&#36;12 &#x52;esy &#X43;redit")).toBe("$12 Resy Credit");
    expect(decodeNumericCharacterReferences("&#38;#36;12 Resy Credit")).toBe("&#36;12 Resy Credit");
    expect(decodeNumericCharacterReferences("&amp;#36;12 Resy Credit")).toBe("&amp;#36;12 Resy Credit");
  });

  it("leaves named, malformed, null, surrogate, and out-of-range references literal", () => {
    const literal = "&amp; &#; &#x; &#36 &#xZZ; &#0; &#xD800; &#1114112; &#x110000;";
    expect(decodeNumericCharacterReferences(literal)).toBe(literal);
  });

  it("removes recognized terminal Amex superscript footnote adornments", () => {
    expect(formatAmexBenefitTitle("Literal Credit <sup>‡</sup>   ")).toBe("Literal Credit");
    expect(formatAmexBenefitTitle("Encoded Markup Credit &#x3C;sup&#x3E;&#8225;&#x3C;/sup&#x3E; ")).toBe(
      "Encoded Markup Credit",
    );
    expect(formatAmexBenefitTitle("Encoded Dagger Credit <sup>&#x2021;</sup>")).toBe("Encoded Dagger Credit");
    expect(formatAmexBenefitTitle("Registered Credit <sup>®</sup>   ")).toBe("Registered Credit");
    expect(formatAmexBenefitTitle("Encoded Registered Markup &#60;sup&#62;&#174;&#60;/sup&#62;")).toBe(
      "Encoded Registered Markup",
    );
    expect(formatAmexBenefitTitle("Encoded Registered Symbol <sup>&#xAE;</sup>")).toBe(
      "Encoded Registered Symbol",
    );
    expect(formatAmexBenefitTitle("Extra separators  <sup>®</sup>   ")).toBe("Extra separators");
    expect(formatAmexBenefitTitle("Standalone Credit ‡  ")).toBe("Standalone Credit");
    expect(formatAmexBenefitTitle("Encoded Standalone Credit &#8225;  ")).toBe("Encoded Standalone Credit");
    expect(formatAmexBenefitTitle("Standalone Registered ®  ")).toBe("Standalone Registered ®");
    expect(formatAmexBenefitTitle("Encoded Standalone Registered &#174;  ")).toBe("Encoded Standalone Registered ®");
  });

  it("removes either exact Amex sup footnote immediately before Statement Credit", () => {
    expect(formatAmexBenefitTitle("Literal Merchant <sup>‡</sup> Statement Credit")).toBe(
      "Literal Merchant Statement Credit",
    );
    expect(formatAmexBenefitTitle(
      "Encoded Merchant &#x3C;sup&#x3E;&#8225;&#x3C;/sup&#x3E; Statement Credit",
    )).toBe("Encoded Merchant Statement Credit");
    expect(formatAmexBenefitTitle("Encoded Dagger Merchant <sup>&#x2021;</sup> Statement Credit")).toBe(
      "Encoded Dagger Merchant Statement Credit",
    );
    expect(formatAmexBenefitTitle("Registered Merchant <sup>®</sup> Statement Credit")).toBe(
      "Registered Merchant Statement Credit",
    );
    expect(formatAmexBenefitTitle(
      "Encoded Registered Merchant &#x3C;sup&#x3E;&#xAE;&#x3C;/sup&#x3E; Statement Credit",
    )).toBe("Encoded Registered Merchant Statement Credit");
    expect(formatAmexBenefitTitle("Encoded Registered Symbol <sup>&#174;</sup> Statement Credit")).toBe(
      "Encoded Registered Symbol Statement Credit",
    );
    expect(formatAmexBenefitTitle("No separator<sup>®</sup> Statement Credit")).toBe(
      "No separator Statement Credit",
    );
    expect(formatAmexBenefitTitle("Extra separators  <sup>®</sup> Statement Credit")).toBe(
      "Extra separators Statement Credit",
    );
    expect(formatAmexBenefitTitle("<sup>®</sup> Statement Credit")).toBe("Statement Credit");
    expect(formatAmexBenefitTitle("<sup>‡</sup> Statement Credit")).toBe("Statement Credit");
  });

  it("preserves arbitrary nonterminal daggers and unrelated markup-like text", () => {
    expect(formatAmexBenefitTitle("Nonterminal ‡ Credit  ")).toBe("Nonterminal ‡ Credit");
    expect(formatAmexBenefitTitle("Arbitrary <sup>‡</sup> mid-title prose")).toBe(
      "Arbitrary <sup>‡</sup> mid-title prose",
    );
    expect(formatAmexBenefitTitle("Other <em>‡</em> Statement Credit")).toBe(
      "Other <em>‡</em> Statement Credit",
    );
    expect(formatAmexBenefitTitle("Other <sup>†</sup> Statement Credit")).toBe(
      "Other <sup>†</sup> Statement Credit",
    );
    expect(formatAmexBenefitTitle("Other <sup>©</sup> Statement Credit")).toBe(
      "Other <sup>©</sup> Statement Credit",
    );
    expect(formatAmexBenefitTitle("Other <sup>™</sup>")).toBe("Other <sup>™</sup>");
    expect(formatAmexBenefitTitle("Other <SUP>®</SUP> Statement Credit")).toBe(
      "Other <SUP>®</SUP> Statement Credit",
    );
    expect(formatAmexBenefitTitle("Other <sup class=\"footnote\">®</sup> Statement Credit")).toBe(
      "Other <sup class=\"footnote\">®</sup> Statement Credit",
    );
    expect(formatAmexBenefitTitle("Other <sup> ® </sup> Statement Credit")).toBe(
      "Other <sup> ® </sup> Statement Credit",
    );
    expect(formatAmexBenefitTitle("Other <em>®</em> Statement Credit")).toBe(
      "Other <em>®</em> Statement Credit",
    );
    expect(formatAmexBenefitTitle("Arbitrary <sup>®</sup> mid-title prose")).toBe(
      "Arbitrary <sup>®</sup> mid-title prose",
    );
    expect(formatAmexBenefitTitle("Registered <sup>®</sup>  Statement Credit")).toBe(
      "Registered <sup>®</sup>  Statement Credit",
    );
    expect(formatAmexBenefitTitle("Registered <sup>®</sup> Account Credit")).toBe(
      "Registered <sup>®</sup> Account Credit",
    );
    expect(formatAmexBenefitTitle("Multiple <sup>‡</sup> markers <sup>‡</sup> Statement Credit")).toBe(
      "Multiple <sup>‡</sup> markers Statement Credit",
    );
    expect(formatAmexBenefitTitle("Markup-like <em>Credit</em>  ")).toBe("Markup-like <em>Credit</em>");
    expect(formatAmexBenefitTitle("Named &Dagger; Statement Credit")).toBe("Named &Dagger; Statement Credit");
    expect(formatAmexBenefitTitle("Double encoded &#38;#60;sup&#38;#62;&#38;#8225;&#38;#60;/sup&#38;#62; Statement Credit")).toBe(
      "Double encoded &#60;sup&#62;&#8225;&#60;/sup&#62; Statement Credit",
    );
  });

  it("falls back to the decoded original when stripping would empty the title", () => {
    expect(formatAmexBenefitTitle("‡  ")).toBe("‡");
    expect(formatAmexBenefitTitle("<sup>&#8225;</sup>  ")).toBe("<sup>‡</sup>");
    expect(formatAmexBenefitTitle("<sup>®</sup>  ")).toBe("<sup>®</sup>");
    expect(formatAmexBenefitTitle("&#60;sup&#62;&#xAE;&#60;/sup&#62;  ")).toBe("<sup>®</sup>");
  });
});
