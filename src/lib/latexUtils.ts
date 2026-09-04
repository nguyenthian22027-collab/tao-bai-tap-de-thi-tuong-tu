import React from 'react';

export interface MixedContentSegment {
  type: 'text' | 'math';
  content: string;
  display?: boolean;
}

/**
 * Splits text with LaTeX inline ($...$) and display ($$...$$) math expressions
 * into structured segments for safe rendering without dangerouslySetInnerHTML or marked.
 */
export function parseMixedContent(text: string): MixedContentSegment[] {
  if (!text) return [];

  const segments: MixedContentSegment[] = [];
  // Regex to match $$ display math $$ OR $ inline math $
  const regex = /(\$\$[\s\S]+?\$\$|\$[^$\n]+?\$)/g;

  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    const matchIndex = match.index;
    const matchText = match[0];

    // Push text before match
    if (matchIndex > lastIndex) {
      segments.push({
        type: 'text',
        content: text.slice(lastIndex, matchIndex),
      });
    }

    // Determine math display mode
    const isDisplay = matchText.startsWith('$$') && matchText.endsWith('$$');
    const innerMath = isDisplay
      ? matchText.slice(2, -2)
      : matchText.slice(1, -1);

    segments.push({
      type: 'math',
      content: innerMath,
      display: isDisplay,
    });

    lastIndex = regex.lastIndex;
  }

  // Push remaining text
  if (lastIndex < text.length) {
    segments.push({
      type: 'text',
      content: text.slice(lastIndex),
    });
  }

  return segments;
}

/**
 * Strips $ or $$ delimiters from latex if present
 */
export function stripMathDelimiters(str: string): string {
  if (!str) return '';
  let cleaned = str.trim();
  if (cleaned.startsWith('$$') && cleaned.endsWith('$$')) {
    return cleaned.slice(2, -2).trim();
  }
  if (cleaned.startsWith('$') && cleaned.endsWith('$')) {
    return cleaned.slice(1, -1).trim();
  }
  return cleaned;
}

/**
 * Converts basic LaTeX Greek symbols and operators to Unicode for clean plain text export
 */
export function latexToUnicode(str: string): string {
  if (!str) return '';
  return str
    .replace(/\\alpha/g, 'α')
    .replace(/\\beta/g, 'β')
    .replace(/\\gamma/g, 'γ')
    .replace(/\\delta/g, 'δ')
    .replace(/\\epsilon/g, 'ε')
    .replace(/\\theta/g, 'θ')
    .replace(/\\lambda/g, 'λ')
    .replace(/\\mu/g, 'μ')
    .replace(/\\pi/g, 'π')
    .replace(/\\sigma/g, 'σ')
    .replace(/\\phi/g, 'φ')
    .replace(/\\omega/g, 'ω')
    .replace(/\\Delta/g, 'Δ')
    .replace(/\\Sigma/g, 'Σ')
    .replace(/\\ge/g, '≥')
    .replace(/\\le/g, '≤')
    .replace(/\\neq/g, '≠')
    .replace(/\\approx/g, '≈')
    .replace(/\\times/g, '×')
    .replace(/\\div/g, '÷')
    .replace(/\\pm/g, '±')
    .replace(/\\infty/g, '∞')
    .replace(/\\in/g, '∈')
    .replace(/\\notin/g, '∉')
    .replace(/\\subset/g, '⊂')
    .replace(/\\cup/g, '∪')
    .replace(/\\cap/g, '∩')
    .replace(/\\sqrt\{([^}]+)\}/g, '√($1)')
    .replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, '($1)/($2)')
    .replace(/\\vec\{([^}]+)\}/g, '$1⃗');
}
