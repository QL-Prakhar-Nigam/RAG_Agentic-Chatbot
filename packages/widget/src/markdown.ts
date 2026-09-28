// Hand-rolled markdown → safe HTML, zero dependency (matches the widget's
// "vanilla JS IIFE" constraint — no markdown library). Ported from a prior
// system's widget (verified against its actual source and test suite, not
// reimplemented from memory), same technique throughout. Used only for the
// model's own assistant text — never for user-typed input or error text,
// which stay plain `textContent` (see ui.ts).

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function inline(raw: string): string {
  let s = esc(raw);

  // [label](url) → a real anchor. Links are lifted to a NUL-sentinel
  // placeholder BEFORE the emphasis rules run, and spliced back in after —
  // running the link rule alone isn't enough, since the emphasis rules would
  // otherwise still see (and mangle) a `*` sitting inside the generated
  // <a href="...">, rewriting markup *inside the attribute*.
  //
  // Only http(s) becomes an anchor, so a javascript:/data: URL can never
  // acquire an href — it's left as the literal escaped text it already was.
  //
  // A NUL sentinel can't collide with real text: esc() never produces one,
  // and model prose won't contain one either — unlike a bare digit marker,
  // which would collide with an ordinary number in prose ("there are 5 races").
  const links: { label: string; url: string }[] = [];
  s = s.replace(/\[([^\]\n]+)\]\(([^)\s]+)\)/g, (match, label: string, url: string) =>
    /^https?:\/\//i.test(url) ? `\u0000${links.push({ label, url }) - 1}\u0000` : match
  );

  s = s.replace(/\*\*\*(.+?)\*\*\*/g, "<strong><em>$1</em></strong>");
  s = s.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  s = s.replace(/\*([^*\n]+?)\*/g, "<em>$1</em>");
  s = s.replace(/`([^`\n]+?)`/g, '<code class="rcb-code">$1</code>');

  // Link labels are deliberately NOT emphasis-processed — the cheaper half of
  // the trade that keeps URLs (and the placeholder splice) intact.
  s = s.replace(/\u0000(\d+)\u0000/g, (_, i: string) => {
    const { label, url } = links[Number(i)];
    return `<a href="${url}" target="_blank" rel="noopener noreferrer" class="rcb-md-link">${label}</a>`;
  });
  return s;
}

function splitRow(s: string): string[] {
  let t = s.trim();
  if (t.startsWith("|")) t = t.slice(1);
  if (t.endsWith("|")) t = t.slice(0, -1);
  return t.split("|").map((c) => c.trim());
}

function isRow(s: string | undefined): s is string {
  return typeof s === "string" && s.includes("|") && s.trim() !== "";
}

function isSeparator(s: string | undefined): boolean {
  if (!isRow(s)) return false;
  const cells = splitRow(s);
  return cells.length > 0 && cells.every((c) => /^:?-+:?$/.test(c));
}

interface ParsedTable {
  html: string;
  endIndex: number;
}

// A block only counts as a table when a header row is immediately followed
// by a |---|---| separator; anything else falls through to the paragraph
// branch and renders as ordinary text (avoids a false-positive on prose that
// happens to contain a stray pipe).
function parseTableAt(lines: string[], start: number): ParsedTable | null {
  if (!isRow(lines[start]) || !isSeparator(lines[start + 1])) return null;
  const headers = splitRow(lines[start]);
  // A single-column "table" is nearly always a false positive.
  if (headers.length < 2) return null;

  const rows: string[][] = [];
  let endIndex = start + 1;
  for (let j = start + 2; j < lines.length && isRow(lines[j]); j++) {
    rows.push(splitRow(lines[j]));
    endIndex = j;
  }

  let html = '<div class="rcb-table-wrap"><table class="rcb-table"><thead><tr>';
  html += headers.map((h) => `<th>${inline(h)}</th>`).join("");
  html += "</tr></thead>";
  if (rows.length) {
    html += "<tbody>";
    for (const row of rows) {
      // Pad/truncate to the header width so a ragged row can't skew the grid.
      html += `<tr>${headers.map((_, c) => `<td>${inline(row[c] ?? "")}</td>`).join("")}</tr>`;
    }
    html += "</tbody>";
  }
  return { html: html + "</table></div>", endIndex };
}

type ListType = "ul" | "ol";
interface ListFrame {
  type: ListType;
  indent: number;
}

export function renderMarkdown(text: string): string {
  if (!text) return "";

  const lines = text.split("\n");
  let out = "";
  const stack: ListFrame[] = [];

  const closeTag = (t: ListType) => (t === "ul" ? "</ul>" : "</ol>");
  const closeTo = (indent: number) => {
    while (stack.length && stack[stack.length - 1].indent > indent) {
      out += closeTag(stack.pop()!.type);
    }
  };
  const closeAll = () => {
    while (stack.length) out += closeTag(stack.pop()!.type);
  };
  const openList = (type: ListType, indent: number) => {
    const top = stack[stack.length - 1];
    if (!top || top.indent < indent) {
      out += type === "ul" ? '<ul class="rcb-md-ul">' : '<ol class="rcb-md-ol">';
      stack.push({ type, indent });
    } else if (top.type !== type) {
      out += closeTag(stack.pop()!.type);
      out += type === "ul" ? '<ul class="rcb-md-ul">' : '<ol class="rcb-md-ol">';
      stack.push({ type, indent });
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.trim() === "") continue;

    const table = parseTableAt(lines, i);
    if (table) {
      closeAll();
      out += table.html;
      i = table.endIndex;
      continue;
    }

    const hMatch = line.match(/^(#{1,3}) (.*)/);
    const ulMatch = line.match(/^(\s*)[-*] (.*)/);
    const olMatch = line.match(/^(\s*)\d+\. (.*)/);

    if (hMatch) {
      closeAll();
      out += `<p class="rcb-md-h${hMatch[1].length}">${inline(hMatch[2])}</p>`;
    } else if (ulMatch) {
      const indent = ulMatch[1].length;
      closeTo(indent);
      openList("ul", indent);
      out += `<li>${inline(ulMatch[2])}</li>`;
    } else if (olMatch) {
      const indent = olMatch[1].length;
      closeTo(indent);
      openList("ol", indent);
      out += `<li>${inline(olMatch[2])}</li>`;
    } else {
      closeAll();
      out += `<p>${inline(line)}</p>`;
    }
  }

  closeAll();
  return out;
}
