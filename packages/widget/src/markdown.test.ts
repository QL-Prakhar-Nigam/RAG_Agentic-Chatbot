import { describe, expect, it } from "vitest";
import { renderMarkdown } from "./markdown.js";

function parse(html: string): HTMLDivElement {
  const container = document.createElement("div");
  container.innerHTML = html;
  return container;
}

describe("renderMarkdown links", () => {
  it("renders [label](url) as a real anchor", () => {
    const dom = parse(
      renderMarkdown("Watch this: [How to assign bibs](https://www.loom.com/share/abc123)")
    );
    const a = dom.querySelector("a.rcb-md-link")!;
    expect(a.getAttribute("href")).toBe("https://www.loom.com/share/abc123");
    expect(a.textContent).toBe("How to assign bibs");
    expect(a.getAttribute("target")).toBe("_blank");
    expect(a.getAttribute("rel")).toBe("noopener noreferrer");
  });

  it("keeps the surrounding prose intact", () => {
    const dom = parse(renderMarkdown("See [the guide](https://example.com/guide) for details."));
    expect(dom.querySelector("p")!.textContent).toBe("See the guide for details.");
  });

  it("renders links inside list items and table cells", () => {
    const listDom = parse(
      renderMarkdown("- [Alpha](https://example.com/a)\n- [Beta](https://example.com/b)")
    );
    expect(listDom.querySelectorAll("li a.rcb-md-link")).toHaveLength(2);

    const tableDom = parse(
      renderMarkdown("| Race | Link |\n|---|---|\n| Alpha | [Open](https://example.com/a) |")
    );
    expect(tableDom.querySelector("td a.rcb-md-link")).not.toBeNull();
  });

  it("leaves a non-http(s) link as literal text with no anchor", () => {
    for (const url of [
      "javascript:alert(1)",
      "data:text/html,<script>alert(1)</script>",
      "/relative/path",
    ]) {
      const dom = parse(renderMarkdown(`Click [here](${url})`));
      expect(dom.querySelector("a")).toBeNull();
      expect(dom.textContent).toContain("[here]");
    }
  });

  it("does not mangle a URL containing emphasis characters", () => {
    const dom = parse(renderMarkdown("[Report](https://example.com/a*b*c)"));
    expect(dom.querySelector("a")!.getAttribute("href")).toBe("https://example.com/a*b*c");
  });

  it("round-trips an ampersand in the query string", () => {
    const dom = parse(renderMarkdown("[Search](https://example.com/s?a=1&b=2)"));
    expect(dom.querySelector("a")!.getAttribute("href")).toBe("https://example.com/s?a=1&b=2");
  });

  it("does not treat a bare number in prose as a link placeholder", () => {
    const dom = parse(renderMarkdown("There are 5 races and [one guide](https://example.com/g)."));
    expect(dom.textContent).toContain("There are 5 races");
    expect(dom.querySelectorAll("a.rcb-md-link")).toHaveLength(1);
  });

  it("renders two links in one line independently", () => {
    const dom = parse(renderMarkdown("[A](https://example.com/a) and [B](https://example.com/b)"));
    const hrefs = [...dom.querySelectorAll("a.rcb-md-link")].map((a) => a.getAttribute("href"));
    expect(hrefs).toEqual(["https://example.com/a", "https://example.com/b"]);
  });

  it("still escapes HTML in the label", () => {
    const dom = parse(renderMarkdown("[<b>bold</b>](https://example.com)"));
    const a = dom.querySelector("a.rcb-md-link")!;
    expect(a.querySelector("b")).toBeNull();
    expect(a.textContent).toBe("<b>bold</b>");
  });
});

describe("renderMarkdown tables", () => {
  it("renders a GFM pipe table as a real <table> inside .rcb-table-wrap", () => {
    const dom = parse(
      renderMarkdown(
        "| Name | Date |\n| --- | --- |\n| Alpha | 2026-08-10 |\n| Beta | 2026-08-11 |"
      )
    );
    const wrap = dom.querySelector(".rcb-table-wrap");
    expect(wrap).not.toBeNull();
    const table = wrap!.querySelector("table")!;
    expect([...table.querySelectorAll("th")].map((th) => th.textContent)).toEqual(["Name", "Date"]);
    const rows = table.querySelectorAll("tbody tr");
    expect(rows).toHaveLength(2);
    expect([...rows[0].querySelectorAll("td")].map((td) => td.textContent)).toEqual([
      "Alpha",
      "2026-08-10",
    ]);
  });

  it("signals a wide bubble via the .rcb-table-wrap marker in its output", () => {
    // ui.ts toggles the wide-bubble class by checking for this substring in
    // the rendered HTML — asserted here so the two stay in sync.
    expect(renderMarkdown("| A | B |\n|---|---|\n| 1 | 2 |")).toContain("rcb-table-wrap");
    expect(renderMarkdown("Just some text.")).not.toContain("rcb-table-wrap");
  });

  it("applies inline formatting inside cells", () => {
    const dom = parse(renderMarkdown("| Item | Price |\n|---|---|\n| **Alpha** | `42` |"));
    const cells = dom.querySelectorAll("tbody td");
    expect(cells[0].querySelector("strong")!.textContent).toBe("Alpha");
    expect(cells[1].querySelector("code")!.textContent).toBe("42");
  });

  it("escapes HTML in cell content", () => {
    const dom = parse(renderMarkdown("| A | B |\n|---|---|\n| <img src=x> | ok |"));
    expect(dom.querySelector("img")).toBeNull();
    expect(dom.querySelector("tbody td")!.textContent).toBe("<img src=x>");
  });

  it("degrades a table with no separator row to paragraphs", () => {
    const dom = parse(renderMarkdown("| Name | Date |\n| Alpha | 2026-08-10 |"));
    expect(dom.querySelector("table")).toBeNull();
    expect(dom.querySelectorAll("p")).toHaveLength(2);
  });

  it("does not treat a single-column pipe line as a table", () => {
    const dom = parse(renderMarkdown("| just text |\n| --- |"));
    expect(dom.querySelector("table")).toBeNull();
  });

  it("renders a header-only table with no body rows", () => {
    const dom = parse(renderMarkdown("| A | B |\n|---|---|"));
    const table = dom.querySelector("table")!;
    expect(table).not.toBeNull();
    expect(table.querySelectorAll("tbody tr")).toHaveLength(0);
  });

  it("pads a ragged row out to the header width", () => {
    const dom = parse(renderMarkdown("| A | B | C |\n|---|---|---|\n| 1 | 2 |"));
    const cells = dom.querySelectorAll("tbody td");
    expect(cells).toHaveLength(3);
    expect(cells[2].textContent).toBe("");
  });

  it("renders prose before and after a table", () => {
    const dom = parse(
      renderMarkdown("Here you go:\n\n| A | B |\n|---|---|\n| 1 | 2 |\n\nLet me know.")
    );
    expect(dom.querySelector("table")).not.toBeNull();
    expect([...dom.querySelectorAll("p")].map((p) => p.textContent)).toEqual([
      "Here you go:",
      "Let me know.",
    ]);
  });
});

describe("renderMarkdown lists", () => {
  it("renders an unordered list", () => {
    const dom = parse(renderMarkdown("- First\n- Second"));
    expect(dom.querySelector("ul.rcb-md-ul")).not.toBeNull();
    expect([...dom.querySelectorAll("li")].map((li) => li.textContent)).toEqual([
      "First",
      "Second",
    ]);
  });

  it("renders an ordered list", () => {
    const dom = parse(renderMarkdown("1. First\n2. Second"));
    expect(dom.querySelector("ol.rcb-md-ol")).not.toBeNull();
  });

  it("closes a list when prose follows it", () => {
    const dom = parse(renderMarkdown("- Item\n\nAfter."));
    expect(dom.querySelectorAll("ul")).toHaveLength(1);
    expect(dom.querySelector("p")!.textContent).toBe("After.");
  });
});

describe("renderMarkdown headings and emphasis", () => {
  it("renders #/##/### as their own styled classes", () => {
    const dom = parse(renderMarkdown("# H1\n## H2\n### H3"));
    expect(dom.querySelector(".rcb-md-h1")!.textContent).toBe("H1");
    expect(dom.querySelector(".rcb-md-h2")!.textContent).toBe("H2");
    expect(dom.querySelector(".rcb-md-h3")!.textContent).toBe("H3");
  });

  it("renders bold, italic, bold+italic, and inline code", () => {
    const dom = parse(renderMarkdown("**bold** *italic* ***both*** `code`"));
    expect(dom.querySelector("strong")!.textContent).toBe("bold");
    expect(dom.querySelector("em")!.textContent).toBe("italic");
    expect(dom.querySelector("strong em")!.textContent).toBe("both");
    expect(dom.querySelector("code.rcb-code")!.textContent).toBe("code");
  });

  it("escapes raw HTML in plain prose", () => {
    const dom = parse(renderMarkdown("<script>alert(1)</script>"));
    expect(dom.querySelector("script")).toBeNull();
    expect(dom.textContent).toContain("<script>alert(1)</script>");
  });

  it("returns an empty string for empty input", () => {
    expect(renderMarkdown("")).toBe("");
  });
});
