"use client";

import React from "react";

/**
 * Parses markdown text (headers, bold, lists, tables, code) into clean,
 * modern React elements without external dependencies.
 */
export default function FormattedMessage({ content, isUser = false }) {
  if (!content) return null;

  if (isUser) {
    return <span className="whitespace-pre-wrap">{content}</span>;
  }

  // Parse lines into blocks (paragraphs, lists, tables, headings)
  const lines = content.split("\n");
  const blocks = [];
  let currentList = null; // { type: 'ul' | 'ol', items: [] }
  let currentTable = null; // { headers: [], rows: [] }

  function flushList() {
    if (currentList) {
      blocks.push({ type: currentList.type, items: currentList.items });
      currentList = null;
    }
  }

  function flushTable() {
    if (currentTable) {
      blocks.push({ type: "table", headers: currentTable.headers, rows: currentTable.rows });
      currentTable = null;
    }
  }

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const line = rawLine.trim();

    // 1. Table Detection
    if (line.startsWith("|") && line.endsWith("|")) {
      flushList();
      const cells = line
        .split("|")
        .slice(1, -1)
        .map((c) => c.trim());

      // Check if this is a separator line (|---|---|)
      const isSeparator = cells.every((c) => /^:?-+:?$/.test(c));

      if (!currentTable) {
        currentTable = { headers: cells, rows: [] };
      } else if (!isSeparator) {
        currentTable.rows.push(cells);
      }
      continue;
    } else {
      flushTable();
    }

    // 2. Empty Line
    if (!line) {
      flushList();
      continue;
    }

    // 3. Bullet List item (- or * )
    const bulletMatch = line.match(/^[-*•]\s+(.*)$/);
    if (bulletMatch) {
      if (!currentList || currentList.type !== "ul") {
        flushList();
        currentList = { type: "ul", items: [] };
      }
      currentList.items.push(bulletMatch[1]);
      continue;
    }

    // 4. Numbered List item (1. or 2. )
    const numMatch = line.match(/^(\d+)[\.\)]\s+(.*)$/);
    if (numMatch) {
      if (!currentList || currentList.type !== "ol") {
        flushList();
        currentList = { type: "ol", items: [] };
      }
      currentList.items.push(numMatch[2]);
      continue;
    }

    // Any normal text flushes pending lists
    flushList();

    // 5. Headings (###### down to #)
    const headerMatch = line.match(/^(#{1,6})\s*(.*)$/);
    if (headerMatch) {
      blocks.push({ type: "header", level: headerMatch[1].length, text: headerMatch[2] });
      continue;
    }

    // Standalone bold titles like **Heading** or **Heading:**
    const boldTitleMatch = line.match(/^\*\*([^*]+)\*\*:?$/);
    if (boldTitleMatch) {
      blocks.push({ type: "header", level: 3, text: boldTitleMatch[1] });
      continue;
    }

    // 6. Regular Paragraph
    blocks.push({ type: "p", text: line });
  }

  flushList();
  flushTable();

  return (
    <div className="flex flex-col gap-2.5 text-sm leading-relaxed text-slate-800">
      {blocks.map((block, idx) => {
        if (block.type === "header") {
          return (
            <h4
              key={idx}
              className={`font-display font-bold text-slate-900 mt-2 first:mt-0 ${
                block.level === 1 ? "text-base text-emerald-900" : "text-sm text-slate-900"
              }`}
            >
              {renderInlineFormatted(block.text)}
            </h4>
          );
        }

        if (block.type === "ul") {
          return (
            <ul key={idx} className="flex flex-col gap-1.5 my-1 pl-1">
              {block.items.map((item, itemIdx) => (
                <li key={itemIdx} className="flex items-start gap-2.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-600 shrink-0 mt-2" />
                  <span className="flex-1">{renderInlineFormatted(item)}</span>
                </li>
              ))}
            </ul>
          );
        }

        if (block.type === "ol") {
          return (
            <ol key={idx} className="flex flex-col gap-1.5 my-1 pl-1">
              {block.items.map((item, itemIdx) => (
                <li key={itemIdx} className="flex items-start gap-2.5">
                  <span className="font-mono text-[10px] font-bold h-4 w-4 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0 mt-0.5">
                    {itemIdx + 1}
                  </span>
                  <span className="flex-1">{renderInlineFormatted(item)}</span>
                </li>
              ))}
            </ol>
          );
        }

        if (block.type === "table") {
          return (
            <div key={idx} className="my-2.5 overflow-x-auto rounded-xl border border-slate-200 shadow-2xs">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-100 border-b border-slate-200 text-slate-800">
                    {block.headers.map((h, hIdx) => (
                      <th key={hIdx} className="px-3 py-2 font-bold whitespace-nowrap">
                        {renderInlineFormatted(h)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {block.rows.map((row, rIdx) => (
                    <tr
                      key={rIdx}
                      className="border-b last:border-0 border-slate-100 odd:bg-white even:bg-slate-50/60 hover:bg-emerald-50/30 transition-colors"
                    >
                      {row.map((cell, cIdx) => (
                        <td key={cIdx} className="px-3 py-2 text-slate-700">
                          {renderInlineFormatted(cell)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        }

        // Standard Paragraph
        return (
          <p key={idx} className="text-slate-700">
            {renderInlineFormatted(block.text)}
          </p>
        );
      })}
    </div>
  );
}

/**
 * Handles inline markdown: **bold**, `code`, and statutory badges
 */
function renderInlineFormatted(text) {
  if (!text) return null;

  // Split by bold (**bold**) and inline code (`code`)
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);

  return parts.map((part, index) => {
    // Bold
    if (part.startsWith("**") && part.endsWith("**") && part.length >= 4) {
      const clean = part.slice(2, -2);
      return (
        <strong key={index} className="font-semibold text-slate-900">
          {clean}
        </strong>
      );
    }

    // Inline Code
    if (part.startsWith("`") && part.endsWith("`") && part.length >= 2) {
      const clean = part.slice(1, -1);
      return (
        <code
          key={index}
          className="font-mono text-[11px] bg-slate-100 text-emerald-800 px-1.5 py-0.5 rounded border border-slate-200"
        >
          {clean}
        </code>
      );
    }

    return part;
  });
}

