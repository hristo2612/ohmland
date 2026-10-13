/**
 * A small, safe markdown subset for lesson text. Block: paragraphs (blank-line separated), "- " or "* " lists,
 * "1. " lists. Inline: **bold**, *italic* or _italic_, `code`, [links](https://...), and a hard break with a trailing
 * backslash. All other text is HTML-escaped, so content can never inject markup.
 */

const ESC: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
export const escapeHtml = (s: string): string => s.replace(/[&<>"']/g, (c) => ESC[c] ?? c);

function safeHref(href: string): string | null {
  const h = href.trim();
  if (/^(https?:\/\/|\/(?!\/)|#|mailto:)/i.test(h)) return h;
  return null;
}

/** Inline markdown to HTML. */
export function inlineMd(src: string): string {
  // Pull code spans out first so their contents are not formatted.
  const codes: string[] = [];
  let s = src.replace(/`([^`]+)`/g, (_, code: string) => {
    codes.push(`<code>${escapeHtml(code)}</code>`);
    return `\u0000${codes.length - 1}\u0000`;
  });
  s = escapeHtml(s);
  s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_whole, label: string, href: string) => {
    const safe = safeHref(href.replace(/&amp;/g, "&"));
    if (!safe) return label;
    const external = /^https?:/i.test(safe);
    return `<a href="${escapeHtml(safe)}"${external ? ' rel="noopener" target="_blank"' : ""}>${label}</a>`;
  });
  // Spans may wrap: text from a YAML block scalar keeps its line breaks, so `[\s\S]` rather than `.` inside them.
  s = s.replace(/\*\*([\s\S]+?)\*\*/g, "<strong>$1</strong>");
  s = s.replace(/(^|[^\w*])\*(?!\s)([\s\S]+?)(?<!\s)\*(?!\w)/g, "$1<em>$2</em>");
  s = s.replace(/(^|[^\w])_(?!\s)([\s\S]+?)(?<!\s)_(?!\w)/g, "$1<em>$2</em>");
  s = s.replace(/\\\n/g, "<br>");
  // Keep a number and its unit together ("20 mA", "470 Ω", "5 mm") so a line never breaks between them, even where
  // the source wrapped.
  s = s.replace(/(\d)[ \n](?=(?:[pnµmkMG]?(?:Ω|V|A|W|F|Hz|s|Ah)|mAh|mm|cm|%)(?![A-Za-z0-9]))/g, "$1 ");
  // eslint-disable-next-line no-control-regex
  s = s.replace(/\u0000(\d+)\u0000/g, (_, i: string) => codes[Number(i)] ?? "");
  return s;
}

/** Block markdown to HTML. */
export function blockMd(src: string): string {
  const lines = src.replace(/\r\n?/g, "\n").trim().split("\n");
  const out: string[] = [];
  let para: string[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;

  const flushPara = () => {
    if (para.length) out.push(`<p>${inlineMd(para.join("\n")).replace(/\n/g, " ")}</p>`);
    para = [];
  };
  const flushList = () => {
    if (list) {
      const tag = list.ordered ? "ol" : "ul";
      out.push(`<${tag}>${list.items.map((i) => `<li>${inlineMd(i)}</li>`).join("")}</${tag}>`);
    }
    list = null;
  };

  for (const raw of lines) {
    const line = raw.trimEnd();
    const bullet = /^\s*[-*]\s+(.*)$/.exec(line);
    const numbered = /^\s*\d+[.)]\s+(.*)$/.exec(line);
    if (line.trim() === "") {
      flushPara();
      flushList();
    } else if (bullet || numbered) {
      flushPara();
      const ordered = !!numbered;
      const item = (bullet?.[1] ?? numbered?.[1] ?? "").trim();
      if (!list || list.ordered !== ordered) {
        flushList();
        list = { ordered, items: [] };
      }
      list.items.push(item);
    } else if (list && /^\s{2,}\S/.test(raw)) {
      list.items[list.items.length - 1] += ` ${line.trim()}`;
    } else {
      flushList();
      para.push(line);
    }
  }
  flushPara();
  flushList();
  return out.join("");
}
