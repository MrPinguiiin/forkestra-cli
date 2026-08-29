import { unified } from "unified";
import remarkParse from "remark-parse";
import type { SpecDocument, SpecSection } from "./types";

type MarkdownNode = {
  type: string;
  depth?: number;
  value?: string;
  children?: MarkdownNode[];
  position?: { start: { offset?: number }; end: { offset?: number } };
};

function nodeText(node: MarkdownNode): string {
  if (typeof node.value === "string") return node.value;
  return node.children?.map(nodeText).join("") ?? "";
}

export function slugify(value: string) {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export function parseSpec(raw: string, path: string): SpecDocument {
  if (!raw.trim()) throw new Error(`Specification is empty: ${path}`);
  const tree = unified().use(remarkParse).parse(raw) as MarkdownNode;
  const headings = (tree.children ?? []).filter((node) => node.type === "heading" && node.position?.start.offset !== undefined);
  if (headings.length === 0) throw new Error(`Specification has no headings: ${path}`);
  const sections: SpecSection[] = headings.map((heading, index) => {
    const nextHeading = headings[index + 1];
    const start = heading.position?.end.offset ?? 0;
    const end = nextHeading?.position?.start.offset ?? raw.length;
    const title = nodeText(heading).trim();
    return { title, slug: slugify(title), depth: heading.depth ?? 1, content: raw.slice(start, end).trim() };
  });
  return { path, raw, sections };
}

export async function loadSpec(path: string): Promise<SpecDocument> {
  const file = Bun.file(path);
  if (!(await file.exists())) throw new Error(`Specification file not found: ${path}`);
  try {
    return parseSpec(await file.text(), path);
  } catch (error) {
    throw new Error(`Unable to load specification ${path}: ${error instanceof Error ? error.message : String(error)}`);
  }
}
