// ============================================================================
// app/ayuda/_components/MarkdownRenderer.tsx
//
// @role: @Frontend-UX + @Knowledge-Librarian
// @spec: Fase 10.09 — Renderizador de Markdown para el Centro de Ayuda
//
// Convierte markdown crudo a JSX con estilos Tailwind.
// Soporta: h1-h3, párrafos, listas, negrita, cursiva, enlaces,
//          código inline, bloques de código, citas (callouts), separadores.
// ============================================================================

import React from "react";

type Props = {
  content: string;
};

export function MarkdownRenderer({ content }: Props) {
  const lines = content.split("\n");
  const elements: React.ReactNode[] = [];
  let i = 0;
  let key = 0;

  while (i < lines.length) {
    const line = lines[i];

    // ── Blank line → skip ───────────────────────────────────────────────
    if (line.trim() === "") {
      i++;
      continue;
    }

    // ── Code block (```) ────────────────────────────────────────────────
    if (line.trim().startsWith("```")) {
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith("```")) {
        codeLines.push(lines[i]);
        i++;
      }
      i++; // skip closing ```
      elements.push(
        <pre
          key={key++}
          className="my-3 overflow-x-auto rounded-lg border border-zinc-700 bg-zinc-800/70 p-4 text-sm"
        >
          <code className="text-zinc-300">{codeLines.join("\n")}</code>
        </pre>,
      );
      continue;
    }

    // ── Headings ────────────────────────────────────────────────────────
    if (line.startsWith("### ")) {
      elements.push(
        <h3 key={key++} className="mb-2 mt-6 text-base font-semibold text-zinc-100">
          {renderInline(line.slice(4))}
        </h3>,
      );
      i++;
      continue;
    }
    if (line.startsWith("## ")) {
      elements.push(
        <h2 key={key++} className="mb-3 mt-8 text-lg font-bold text-zinc-100">
          {renderInline(line.slice(3))}
        </h2>,
      );
      i++;
      continue;
    }
    if (line.startsWith("# ")) {
      // h1 is typically the title — rendered by the page, but we handle it
      elements.push(
        <h1 key={key++} className="mb-4 mt-6 text-2xl font-bold text-zinc-50">
          {renderInline(line.slice(2))}
        </h1>,
      );
      i++;
      continue;
    }

    // ── Horizontal rule ─────────────────────────────────────────────────
    if (/^---+$/.test(line.trim())) {
      elements.push(
        <hr key={key++} className="my-6 border-zinc-700" />,
      );
      i++;
      continue;
    }

    // ── Blockquote / callout ────────────────────────────────────────────
    if (line.startsWith("> ")) {
      const quoteLines: string[] = [];
      while (i < lines.length && lines[i].startsWith("> ")) {
        quoteLines.push(lines[i].slice(2));
        i++;
      }
      elements.push(
        <blockquote
          key={key++}
          className="my-3 rounded-r-lg border-l-3 border-orange-500/60 bg-orange-500/5 px-4 py-3 text-sm text-zinc-300"
        >
          {quoteLines.map((ql, qi) => (
            <p key={qi} className={qi > 0 ? "mt-1.5" : ""}>
              {renderInline(ql)}
            </p>
          ))}
        </blockquote>,
      );
      continue;
    }

    // ── Unordered list ──────────────────────────────────────────────────
    if (/^[-*] /.test(line.trimStart())) {
      const listItems: string[] = [];
      while (i < lines.length && /^[-*] /.test(lines[i].trimStart())) {
        listItems.push(lines[i].replace(/^[\s]*[-*] /, ""));
        i++;
      }
      elements.push(
        <ul key={key++} className="my-2 ml-5 list-disc space-y-1 text-sm text-zinc-400">
          {listItems.map((item, li) => (
            <li key={li}>{renderInline(item)}</li>
          ))}
        </ul>,
      );
      continue;
    }

    // ── Ordered list ────────────────────────────────────────────────────
    if (/^\d+\. /.test(line.trimStart())) {
      const listItems: string[] = [];
      while (i < lines.length && /^\d+\. /.test(lines[i].trimStart())) {
        listItems.push(lines[i].replace(/^[\s]*\d+\. /, ""));
        i++;
      }
      elements.push(
        <ol key={key++} className="my-2 ml-5 list-decimal space-y-1 text-sm text-zinc-400">
          {listItems.map((item, li) => (
            <li key={li}>{renderInline(item)}</li>
          ))}
        </ol>,
      );
      continue;
    }

    // ── Paragraph (default) ─────────────────────────────────────────────
    const paraLines: string[] = [line];
    i++;
    while (
      i < lines.length &&
      lines[i].trim() !== "" &&
      !lines[i].startsWith("#") &&
      !lines[i].startsWith(">") &&
      !lines[i].startsWith("```") &&
      !/^[-*] /.test(lines[i].trimStart()) &&
      !/^\d+\. /.test(lines[i].trimStart()) &&
      !/^---+$/.test(lines[i].trim())
    ) {
      paraLines.push(lines[i]);
      i++;
    }
    elements.push(
      <p key={key++} className="my-2 text-sm leading-relaxed text-zinc-400">
        {renderInline(paraLines.join(" "))}
      </p>,
    );
  }

  return <div className="prose-manual">{elements}</div>;
}

// ─── Inline formatting ──────────────────────────────────────────────────────

function renderInline(text: string): React.ReactNode {
  // Process inline elements: bold, italic, code, links
  const parts: React.ReactNode[] = [];
  let remaining = text;
  let partKey = 0;

  while (remaining.length > 0) {
    // ── Link: [text](url) ─────────────────────────────────────────────
    const linkMatch = remaining.match(/^([\s\S]*?)\[([^\]]+)\]\(([^)]+)\)([\s\S]*)/);
    if (linkMatch && linkMatch[1] !== undefined) {
      if (linkMatch[1]) parts.push(renderFormattedText(linkMatch[1], partKey++));
      parts.push(
        <a
          key={partKey++}
          href={linkMatch[3]}
          className="text-orange-400 underline underline-offset-2 hover:text-orange-300"
        >
          {linkMatch[2]}
        </a>,
      );
      remaining = linkMatch[4];
      continue;
    }

    // ── Inline code: `code` ───────────────────────────────────────────
    const codeMatch = remaining.match(/^([\s\S]*?)`([^`]+)`([\s\S]*)/);
    if (codeMatch && codeMatch[1] !== undefined) {
      if (codeMatch[1]) parts.push(renderFormattedText(codeMatch[1], partKey++));
      parts.push(
        <code
          key={partKey++}
          className="rounded bg-zinc-800 px-1.5 py-0.5 text-[13px] text-orange-300/80"
        >
          {codeMatch[2]}
        </code>,
      );
      remaining = codeMatch[3];
      continue;
    }

    // ── Bold: **text** ────────────────────────────────────────────────
    const boldMatch = remaining.match(/^([\s\S]*?)\*\*(.+?)\*\*([\s\S]*)/);
    if (boldMatch && boldMatch[1] !== undefined) {
      if (boldMatch[1]) parts.push(renderFormattedText(boldMatch[1], partKey++));
      parts.push(
        <strong key={partKey++} className="font-semibold text-zinc-200">
          {boldMatch[2]}
        </strong>,
      );
      remaining = boldMatch[3];
      continue;
    }

    // ── Italic: *text* ────────────────────────────────────────────────
    const italicMatch = remaining.match(/^([\s\S]*?)\*(.+?)\*([\s\S]*)/);
    if (italicMatch && italicMatch[1] !== undefined) {
      if (italicMatch[1]) parts.push(<span key={partKey++}>{italicMatch[1]}</span>);
      parts.push(
        <em key={partKey++} className="italic text-zinc-300">
          {italicMatch[2]}
        </em>,
      );
      remaining = italicMatch[3];
      continue;
    }

    // ── Plain text remainder ──────────────────────────────────────────
    parts.push(<span key={partKey++}>{remaining}</span>);
    break;
  }

  return parts.length === 1 ? parts[0] : <>{parts}</>;
}

/** Helper for bold/italic within pre-link/code text segments. */
function renderFormattedText(text: string, baseKey: number): React.ReactNode {
  // Simple pass — just return the text, bold/italic will be caught on next iteration
  return <span key={baseKey}>{text}</span>;
}
