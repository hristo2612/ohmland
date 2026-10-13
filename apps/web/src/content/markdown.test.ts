import { describe, expect, it } from "vitest";
import { blockMd, inlineMd } from "./markdown";

// YAML block scalars (`|`) keep their line breaks, so inline spans in lesson text often wrap onto the next line.
describe("markdown spans that wrap lines", () => {
  it("renders bold, italic, underscore italic and code across a line break in a paragraph", () => {
    const html = blockMd("The black lead goes in **COM, short\nfor common**, and *never\nmoves*. Its _other\nend_ sits in `V\nΩ`.");
    expect(html).toBe("<p>The black lead goes in <strong>COM, short for common</strong>, and <em>never moves</em>. Its <em>other end</em> sits in <code>V Ω</code>.</p>");
  });

  it("renders a wrapped span in a list item and in inline text", () => {
    expect(blockMd("- a **long\n  bold** item")).toBe("<ul><li>a <strong>long bold</strong> item</li></ul>");
    expect(inlineMd("**one\ntwo**")).toBe("<strong>one\ntwo</strong>");
    expect(blockMd("[the\nguide](https://example.com)")).toBe('<p><a href="https://example.com" rel="noopener" target="_blank">the guide</a></p>');
  });

  it("keeps spans inside their paragraph and leaves lone asterisks alone", () => {
    expect(blockMd("**open\n\nclose**")).toBe("<p>**open</p><p>close**</p>");
    expect(blockMd("2 * 3 is\n6 * 1")).toBe("<p>2 * 3 is 6 * 1</p>");
  });

  it("keeps a number and its unit together when the source wrapped between them", () => {
    expect(blockMd("about 20\nmA through it")).toBe("<p>about 20\u00a0mA through it</p>");
  });
});
