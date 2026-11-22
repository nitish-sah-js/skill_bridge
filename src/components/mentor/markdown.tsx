import { Fragment, type ReactNode } from "react";

/**
 * Minimal Markdown renderer for mentor replies: headings, paragraphs, lists, fenced code,
 * inline code, bold and italics. Produces React elements only (no HTML injection).
 */
export function Markdown({ text }: { text: string }) {
  const blocks: ReactNode[] = [];
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  let i = 0;
  let key = 0;

  while (i < lines.length) {
    const line = lines[i];

    const fence = line.match(/^```\s*([\w+-]*)\s*$/);
    if (fence) {
      const code: string[] = [];
      i++;
      while (i < lines.length && !/^```\s*$/.test(lines[i])) code.push(lines[i++]);
      i++;
      blocks.push(
        <pre key={key++} className="my-2.5 overflow-x-auto rounded-md border border-l-2 border-l-primary/60 bg-muted p-3 font-mono text-[0.8125rem] leading-relaxed">
          <code>{code.join("\n")}</code>
        </pre>,
      );
      continue;
    }

    const heading = line.match(/^(#{1,4})\s+(.*)$/);
    if (heading) {
      blocks.push(
        <p key={key++} className="mt-3 mb-1 font-semibold text-primary first:mt-0">
          {inline(heading[2])}
        </p>,
      );
      i++;
      continue;
    }

    if (/^\s*([-*]|\d+[.)])\s+/.test(line)) {
      const ordered = /^\s*\d+[.)]\s+/.test(line);
      const items: string[] = [];
      while (i < lines.length && /^\s*([-*]|\d+[.)])\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*([-*]|\d+[.)])\s+/, ""));
        i++;
      }
      const List = ordered ? "ol" : "ul";
      blocks.push(
        <List key={key++} className={`my-2 grid gap-1 pl-5 marker:text-primary ${ordered ? "list-decimal" : "list-disc"}`}>
          {items.map((item, n) => (
            <li key={n}>{inline(item)}</li>
          ))}
        </List>,
      );
      continue;
    }

    if (line.trim() === "") {
      i++;
      continue;
    }

    const para: string[] = [];
    while (i < lines.length && lines[i].trim() !== "" && !/^(```|#{1,4}\s|\s*([-*]|\d+[.)])\s+)/.test(lines[i])) {
      para.push(lines[i++]);
    }
    blocks.push(
      <p key={key++} className="my-2 first:mt-0 last:mb-0">
        {inline(para.join(" "))}
      </p>,
    );
  }
  return <>{blocks}</>;
}

function inline(text: string): ReactNode[] {
  const parts = text.split(/(`[^`]+`|\*\*[^*]+\*\*|\*[^*\s][^*]*\*)/g);
  return parts.map((part, n) => {
    if (part.startsWith("`") && part.endsWith("`") && part.length > 1) {
      return (
        <code key={n} className="rounded bg-primary/10 px-1 py-0.5 text-primary font-mono text-[0.85em]">
          {part.slice(1, -1)}
        </code>
      );
    }
    if (part.startsWith("**") && part.endsWith("**") && part.length > 4) return <strong key={n}>{part.slice(2, -2)}</strong>;
    if (part.startsWith("*") && part.endsWith("*") && part.length > 2) return <em key={n}>{part.slice(1, -1)}</em>;
    return <Fragment key={n}>{part}</Fragment>;
  });
}
