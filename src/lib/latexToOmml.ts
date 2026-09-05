/**
 * Converts LaTeX expressions to OpenXML Office Math (OMML) XML strings
 * for Microsoft Word Equation Editor support with 100% native rendering.
 */

const GREEK_AND_SYMBOLS: Record<string, string> = {
  // Greek Lowercase
  alpha: 'α',
  beta: 'β',
  gamma: 'γ',
  delta: 'δ',
  epsilon: 'ε',
  varepsilon: 'ε',
  zeta: 'ζ',
  eta: 'η',
  theta: 'θ',
  vartheta: 'θ',
  iota: 'ι',
  kappa: 'κ',
  lambda: 'λ',
  mu: 'μ',
  nu: 'ν',
  xi: 'ξ',
  pi: 'π',
  varpi: 'ϖ',
  rho: 'ρ',
  varrho: 'ϱ',
  sigma: 'σ',
  varsigma: 'ς',
  tau: 'τ',
  upsilon: 'υ',
  phi: 'φ',
  varphi: 'ϕ',
  chi: 'χ',
  psi: 'ψ',
  omega: 'ω',

  // Greek Uppercase
  Alpha: 'Α',
  Beta: 'Β',
  Gamma: 'Γ',
  Delta: 'Δ',
  Epsilon: 'Ε',
  Zeta: 'Ζ',
  Eta: 'Η',
  Theta: 'Θ',
  Iota: 'Ι',
  Kappa: 'Κ',
  Lambda: 'Λ',
  Mu: 'Μ',
  Nu: 'Ν',
  Xi: 'Ξ',
  Pi: 'Π',
  Rho: 'Ρ',
  Sigma: 'Σ',
  Tau: 'Τ',
  Upsilon: 'Υ',
  Phi: 'Φ',
  Chi: 'Χ',
  Psi: 'Ψ',
  Omega: 'Ω',

  // Arithmetic & Operators
  times: '×',
  cdot: '·',
  div: '÷',
  pm: '±',
  mp: '∓',
  circ: '°',
  degree: '°',
  ast: '*',
  star: '⋆',

  // Relations
  ge: '≥',
  geq: '≥',
  le: '≤',
  leq: '≤',
  neq: '≠',
  ne: '≠',
  approx: '≈',
  equiv: '≡',
  sim: '∼',
  simeq: '≃',
  cong: '≅',
  propto: '∝',
  perp: '⊥',
  parallel: '∥',

  // Set theory & logic
  in: '∈',
  notin: '∉',
  subset: '⊂',
  supset: '⊃',
  subseteq: '⊆',
  supseteq: '⊇',
  cup: '∪',
  cap: '∩',
  setminus: '\\',
  emptyset: '∅',
  empty: '∅',
  varnothing: '∅',
  infty: '∞',
  forall: '∀',
  exists: '∃',
  nexists: '∄',
  neg: '¬',
  vee: '∨',
  wedge: '∧',

  // Arrows
  to: '→',
  rightarrow: '→',
  leftarrow: '←',
  leftrightarrow: '↔',
  Rightarrow: '⇒',
  Leftarrow: '⇐',
  Leftrightarrow: '⇔',
  iff: '⇔',
  mapsto: '↦',
  longrightarrow: '⟶',
  longleftarrow: '⟵',
  Longrightarrow: '⟹',
  Longleftarrow: '⟸',
  Longleftrightarrow: '⟺',
  uparrow: '↑',
  downarrow: '↓',

  // Geometry & Misc
  angle: '∠',
  triangle: '△',
  nabla: '∇',
  partial: '∂',
  prime: '′',
  ldots: '...',
  cdots: '···',
  dots: '...',
  vdots: '⋮',
  ddots: '⋱',
};

const MATH_FUNCS = new Set([
  'sin', 'cos', 'tan', 'cot', 'arcsin', 'arccos', 'arctan',
  'sinh', 'cosh', 'tanh', 'coth',
  'log', 'ln', 'lg', 'exp',
  'lim', 'max', 'min', 'sup', 'inf',
  'det', 'dim', 'ker', 'gcd', 'deg', 'arg',
]);

function escapeXml(unsafe: string): string {
  if (!unsafe) return '';
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function ommlRun(text: string, font?: string, isNormalText = false): string {
  if (!text) return '';
  const escaped = escapeXml(text);
  let rPr = '';
  if (font || isNormalText) {
    const f = font || 'Times New Roman';
    rPr = `<w:rPr><w:rFonts w:ascii="${f}" w:hAnsi="${f}"/>${isNormalText ? '<m:sty m:val="p"/>' : ''}</w:rPr>`;
  }
  return `<m:r>${rPr}<m:t xml:space="preserve">${escaped}</m:t></m:r>`;
}

/**
 * Parses LaTeX braced expression {...} safely considering nested brackets
 */
function parseBracedGroup(s: string, startIdx: number): { content: string; endIdx: number } {
  if (startIdx >= s.length) {
    return { content: '', endIdx: s.length };
  }
  if (s[startIdx] !== '{') {
    // Single character token (e.g. \sqrt 2 or x^2)
    return { content: s[startIdx], endIdx: startIdx + 1 };
  }
  let depth = 1;
  let idx = startIdx + 1;
  let content = '';
  while (idx < s.length && depth > 0) {
    if (s[idx] === '{') depth++;
    else if (s[idx] === '}') depth--;
    if (depth > 0) {
      content += s[idx];
    }
    idx++;
  }
  return { content, endIdx: idx };
}

/**
 * Parses bracketed optional argument [...] safely
 */
function parseBracketGroup(s: string, startIdx: number): { content: string; endIdx: number } {
  if (startIdx >= s.length || s[startIdx] !== '[') {
    return { content: '', endIdx: startIdx };
  }
  let depth = 1;
  let idx = startIdx + 1;
  let content = '';
  while (idx < s.length && depth > 0) {
    if (s[idx] === '[') depth++;
    else if (s[idx] === ']') depth--;
    if (depth > 0) {
      content += s[idx];
    }
    idx++;
  }
  return { content, endIdx: idx };
}

/**
 * Extracts content inside an environment like \begin{name}...\end{name}
 */
function extractEnvironment(s: string, startIdx: number, envName: string): { content: string; endIdx: number } {
  const endTag = `\\end{${envName}}`;
  const endPos = s.indexOf(endTag, startIdx);
  if (endPos === -1) {
    return { content: s.slice(startIdx), endIdx: s.length };
  }
  return {
    content: s.slice(startIdx, endPos),
    endIdx: endPos + endTag.length,
  };
}

interface MathElement {
  xml: string;
  isSpace?: boolean;
}

/**
 * Main parser converting LaTeX string to OMML fragment.
 * Uses an element stack to properly bind preceding bases to superscripts/subscripts.
 */
function processLatex(input: string, font?: string): string {
  const elements: MathElement[] = [];
  let i = 0;

  while (i < input.length) {
    const char = input[i];

    // 1. Backslash Commands
    if (char === '\\') {
      // Space macro checks: \, \; \: \! \quad \qquad \  (backslash space)
      if (input[i + 1] === ' ' || input[i + 1] === ',' || input[i + 1] === ';' || input[i + 1] === ':') {
        elements.push({ xml: ommlRun(' ', font), isSpace: true });
        i += 2;
        continue;
      }
      if (input[i + 1] === '!') {
        i += 2;
        continue; // negative thin space ignored
      }
      if (input[i + 1] === '{' || input[i + 1] === '}') {
        elements.push({ xml: ommlRun(input[i + 1], font), isSpace: false });
        i += 2;
        continue;
      }

      // Read command name
      let cmd = '';
      let j = i + 1;
      while (j < input.length && /[a-zA-Z]/.test(input[j])) {
        cmd += input[j];
        j++;
      }

      // Skip trailing spaces after command
      let nextCharIdx = j;
      while (nextCharIdx < input.length && input[nextCharIdx] === ' ') {
        nextCharIdx++;
      }

      // Handle Environments: \begin{cases}, \begin{matrix}, etc.
      if (cmd === 'begin') {
        const envGroup = parseBracedGroup(input, j);
        const envName = envGroup.content.trim();
        const envBody = extractEnvironment(input, envGroup.endIdx, envName);
        i = envBody.endIdx;

        // Split rows by \\ or \cr
        const rows = envBody.content
          .split(/\\\\|\\cr/)
          .map((r) => r.trim())
          .filter((r) => r.length > 0);

        if (envName === 'cases') {
          // Left brace + equation array
          const rowsXml = rows
            .map((r) => {
              const cleanRow = r.replace(/&/g, ' ').trim();
              return `<m:e>${processLatex(cleanRow, font)}</m:e>`;
            })
            .join('');

          elements.push({
            xml: `<m:d><m:dPr><m:begChr m:val="{"/><m:endChr m:val=""/><m:grow/></m:dPr><m:e><m:eqArr>${rowsXml}</m:eqArr></m:e></m:d>`,
            isSpace: false,
          });
          continue;
        } else if (envName === 'pmatrix' || envName === 'bmatrix' || envName === 'matrix' || envName === 'aligned') {
          const begChr = envName === 'pmatrix' ? '(' : envName === 'bmatrix' ? '[' : '';
          const endChr = envName === 'pmatrix' ? ')' : envName === 'bmatrix' ? ']' : '';
          const rowsXml = rows
            .map((r) => {
              const cleanRow = r.replace(/&/g, ' ').trim();
              return `<m:e>${processLatex(cleanRow, font)}</m:e>`;
            })
            .join('');

          if (begChr) {
            elements.push({
              xml: `<m:d><m:dPr><m:begChr m:val="${begChr}"/><m:endChr m:val="${endChr}"/><m:grow/></m:dPr><m:e><m:eqArr>${rowsXml}</m:eqArr></m:e></m:d>`,
              isSpace: false,
            });
          } else {
            elements.push({
              xml: `<m:eqArr>${rowsXml}</m:eqArr>`,
              isSpace: false,
            });
          }
          continue;
        } else {
          // General environment
          elements.push({
            xml: processLatex(envBody.content.replace(/&/g, ' '), font),
            isSpace: false,
          });
          continue;
        }
      }

      // Fractions \frac{a}{b}
      if (cmd === 'frac' || cmd === 'dfrac' || cmd === 'tfrac') {
        const numGroup = parseBracedGroup(input, nextCharIdx);
        const denGroup = parseBracedGroup(input, numGroup.endIdx);
        const numXml = processLatex(numGroup.content, font);
        const denXml = processLatex(denGroup.content, font);
        elements.push({
          xml: `<m:f><m:num>${numXml}</m:num><m:den>${denXml}</m:den></m:f>`,
          isSpace: false,
        });
        i = denGroup.endIdx;
        continue;
      }

      // Square roots \sqrt{x} or \sqrt[n]{x}
      if (cmd === 'sqrt') {
        let afterCmd = nextCharIdx;
        let degXml = '';
        if (input[afterCmd] === '[') {
          const bracketGroup = parseBracketGroup(input, afterCmd);
          degXml = processLatex(bracketGroup.content, font);
          afterCmd = bracketGroup.endIdx;
        }
        const bodyGroup = parseBracedGroup(input, afterCmd);
        const bodyXml = processLatex(bodyGroup.content, font);

        if (degXml) {
          elements.push({
            xml: `<m:rad><m:deg>${degXml}</m:deg><m:e>${bodyXml}</m:e></m:rad>`,
            isSpace: false,
          });
        } else {
          elements.push({
            xml: `<m:rad><m:radPr><m:degHide m:val="1"/></m:radPr><m:e>${bodyXml}</m:e></m:rad>`,
            isSpace: false,
          });
        }
        i = bodyGroup.endIdx;
        continue;
      }

      // Limits \lim_{x \to 0}
      if (cmd === 'lim') {
        let subXml = '';
        let curr = nextCharIdx;
        while (curr < input.length && input[curr] === ' ') curr++;
        if (curr < input.length && input[curr] === '_') {
          const subGrp = parseBracedGroup(input, curr + 1);
          subXml = processLatex(subGrp.content, font);
          curr = subGrp.endIdx;
        }

        const limBase = ommlRun('lim', font, true);
        if (subXml) {
          elements.push({
            xml: `<m:limLow><m:e>${limBase}</m:e><m:lim>${subXml}</m:lim></m:limLow>`,
            isSpace: false,
          });
        } else {
          elements.push({ xml: limBase, isSpace: false });
        }
        i = curr;
        continue;
      }

      // Large Operators: Sum, Int, Prod
      if (cmd === 'sum' || cmd === 'int' || cmd === 'prod') {
        const symbol = cmd === 'sum' ? '∑' : cmd === 'int' ? '∫' : '∏';
        let subXml = '';
        let supXml = '';
        let curr = nextCharIdx;

        while (curr < input.length && (input[curr] === '_' || input[curr] === '^' || input[curr] === ' ')) {
          if (input[curr] === ' ') {
            curr++;
            continue;
          }
          if (input[curr] === '_') {
            const subGrp = parseBracedGroup(input, curr + 1);
            subXml = processLatex(subGrp.content, font);
            curr = subGrp.endIdx;
          } else if (input[curr] === '^') {
            const supGrp = parseBracedGroup(input, curr + 1);
            supXml = processLatex(supGrp.content, font);
            curr = supGrp.endIdx;
          }
        }

        const opBase = ommlRun(symbol, font);
        if (subXml && supXml) {
          elements.push({
            xml: `<m:sSubSup><m:e>${opBase}</m:e><m:sub>${subXml}</m:sub><m:sup>${supXml}</m:sup></m:sSubSup>`,
            isSpace: false,
          });
        } else if (subXml) {
          elements.push({
            xml: `<m:sSub><m:e>${opBase}</m:e><m:sub>${subXml}</m:sub></m:sSub>`,
            isSpace: false,
          });
        } else if (supXml) {
          elements.push({
            xml: `<m:sSup><m:e>${opBase}</m:e><m:sup>${supXml}</m:sup></m:sSup>`,
            isSpace: false,
          });
        } else {
          elements.push({ xml: opBase, isSpace: false });
        }
        i = curr;
        continue;
      }

      // Delimiters \left...\right
      if (cmd === 'left') {
        let delim = input[nextCharIdx] || '(';
        if (delim === '\\') {
          const nextC = input[nextCharIdx + 1];
          delim = nextC === '{' ? '{' : nextC === '}' ? '}' : nextC === '|' ? '|' : '.';
          nextCharIdx += 2;
        } else {
          nextCharIdx += 1;
        }

        const rightTag = '\\right';
        const rightPos = input.indexOf(rightTag, nextCharIdx);
        let rightDelim = ')';
        let innerContent = '';

        if (rightPos !== -1) {
          innerContent = input.slice(nextCharIdx, rightPos);
          let afterRight = rightPos + rightTag.length;
          while (afterRight < input.length && input[afterRight] === ' ') afterRight++;
          let rDelimChar = input[afterRight] || ')';
          if (rDelimChar === '\\') {
            const nextC = input[afterRight + 1];
            rightDelim = nextC === '{' ? '{' : nextC === '}' ? '}' : nextC === '|' ? '|' : '.';
            i = afterRight + 2;
          } else {
            rightDelim = rDelimChar === '.' ? '' : rDelimChar;
            i = afterRight + 1;
          }
        } else {
          innerContent = input.slice(nextCharIdx);
          i = input.length;
        }

        const begChr = delim === '.' ? '' : delim;
        const endChr = rightDelim === '.' ? '' : rightDelim;
        elements.push({
          xml: `<m:d><m:dPr><m:begChr m:val="${begChr}"/><m:endChr m:val="${endChr}"/><m:grow/></m:dPr><m:e>${processLatex(innerContent, font)}</m:e></m:d>`,
          isSpace: false,
        });
        continue;
      }

      // Overline, Vectors, Hats
      if (cmd === 'overline' || cmd === 'bar') {
        const grp = parseBracedGroup(input, nextCharIdx);
        elements.push({
          xml: `<m:bar><m:barPr><m:pos m:val="top"/></m:barPr><m:e>${processLatex(grp.content, font)}</m:e></m:bar>`,
          isSpace: false,
        });
        i = grp.endIdx;
        continue;
      }
      if (cmd === 'vec') {
        const grp = parseBracedGroup(input, nextCharIdx);
        elements.push({
          xml: `<m:acc><m:accPr><m:chr m:val="→"/></m:accPr><m:e>${processLatex(grp.content, font)}</m:e></m:acc>`,
          isSpace: false,
        });
        i = grp.endIdx;
        continue;
      }
      if (cmd === 'hat') {
        const grp = parseBracedGroup(input, nextCharIdx);
        elements.push({
          xml: `<m:acc><m:accPr><m:chr m:val="^"/></m:accPr><m:e>${processLatex(grp.content, font)}</m:e></m:acc>`,
          isSpace: false,
        });
        i = grp.endIdx;
        continue;
      }
      if (cmd === 'wideparen' || cmd === 'overgroup' || cmd === 'arc') {
        const grp = parseBracedGroup(input, nextCharIdx);
        elements.push({
          xml: `<m:acc><m:accPr><m:chr m:val="⌒"/></m:accPr><m:e>${processLatex(grp.content, font)}</m:e></m:acc>`,
          isSpace: false,
        });
        i = grp.endIdx;
        continue;
      }
      if (cmd === 'overset') {
        const topGrp = parseBracedGroup(input, nextCharIdx);
        let secondIdx = topGrp.endIdx;
        while (secondIdx < input.length && input[secondIdx] === ' ') secondIdx++;
        const baseGrp = parseBracedGroup(input, secondIdx);
        if (topGrp.content.includes('frown') || topGrp.content.includes('⌒')) {
          elements.push({
            xml: `<m:acc><m:accPr><m:chr m:val="⌒"/></m:accPr><m:e>${processLatex(baseGrp.content, font)}</m:e></m:acc>`,
            isSpace: false,
          });
        } else {
          elements.push({
            xml: `<m:limUpp><m:e>${processLatex(baseGrp.content, font)}</m:e><m:lim>${processLatex(topGrp.content, font)}</m:lim></m:limUpp>`,
            isSpace: false,
          });
        }
        i = baseGrp.endIdx;
        continue;
      }

      // Text inside math: \text{...}, \mathrm{...}, \mathbf{...}
      if (cmd === 'text' || cmd === 'mathrm' || cmd === 'mathbf' || cmd === 'operatorname') {
        const textGroup = parseBracedGroup(input, nextCharIdx);
        elements.push({
          xml: ommlRun(textGroup.content, font, true),
          isSpace: false,
        });
        i = textGroup.endIdx;
        continue;
      }

      // Spacing commands
      if (cmd === 'quad') {
        elements.push({ xml: ommlRun('    ', font), isSpace: true });
        i = j;
        continue;
      }
      if (cmd === 'qquad') {
        elements.push({ xml: ommlRun('        ', font), isSpace: true });
        i = j;
        continue;
      }

      // Standard Math Functions (sin, cos, ln, log...)
      if (MATH_FUNCS.has(cmd)) {
        elements.push({ xml: ommlRun(cmd, font, true), isSpace: false });
        elements.push({ xml: ommlRun(' ', font), isSpace: true });
        i = j;
        continue;
      }

      // Greek and Symbols
      if (GREEK_AND_SYMBOLS[cmd]) {
        elements.push({ xml: ommlRun(GREEK_AND_SYMBOLS[cmd], font), isSpace: false });
        i = j;
        continue;
      }

      // Other LaTeX command: output command name as clean text
      if (cmd) {
        elements.push({ xml: ommlRun(cmd, font), isSpace: false });
      }
      i = j;
      continue;
    }

    // 2. Prime mark (e.g. f'(x), y')
    if (char === '\'') {
      let primeRun = ommlRun('′', font);
      // Consume any consecutive primes: f''(x)
      let pCount = 1;
      while (i + pCount < input.length && input[i + pCount] === '\'') {
        pCount++;
      }
      if (pCount === 2) primeRun = ommlRun('″', font);
      else if (pCount > 2) primeRun = ommlRun('‴', font);

      let baseXml = '';
      while (elements.length > 0 && elements[elements.length - 1].isSpace) {
        elements.pop();
      }
      if (elements.length > 0) {
        baseXml = elements.pop()!.xml;
      }

      if (baseXml) {
        elements.push({
          xml: `<m:sSup><m:e>${baseXml}</m:e><m:sup>${primeRun}</m:sup></m:sSup>`,
          isSpace: false,
        });
      } else {
        elements.push({ xml: primeRun, isSpace: false });
      }
      i += pCount;
      continue;
    }

    // 3. Subscripts (_) and Superscripts (^)
    if (char === '^' || char === '_') {
      let supXml = '';
      let subXml = '';
      let curr = i;

      // Extract all consecutive ^ and _ (e.g. x_1^2 or x^2_1)
      while (curr < input.length) {
        if (input[curr] === ' ') {
          curr++;
          continue;
        }
        if (input[curr] === '^') {
          const grp = parseBracedGroup(input, curr + 1);
          supXml = processLatex(grp.content, font);
          curr = grp.endIdx;
        } else if (input[curr] === '_') {
          const grp = parseBracedGroup(input, curr + 1);
          subXml = processLatex(grp.content, font);
          curr = grp.endIdx;
        } else {
          break;
        }
      }

      // Pop trailing spaces if any
      while (elements.length > 0 && elements[elements.length - 1].isSpace) {
        elements.pop();
      }

      // Pop the preceding element to use as the base
      let baseXml = '';
      if (elements.length > 0) {
        baseXml = elements.pop()!.xml;
      }

      // Construct proper OMML tag with non-empty base
      if (supXml && subXml) {
        elements.push({
          xml: `<m:sSubSup><m:e>${baseXml}</m:e><m:sub>${subXml}</m:sub><m:sup>${supXml}</m:sup></m:sSubSup>`,
          isSpace: false,
        });
      } else if (supXml) {
        elements.push({
          xml: `<m:sSup><m:e>${baseXml}</m:e><m:sup>${supXml}</m:sup></m:sSup>`,
          isSpace: false,
        });
      } else if (subXml) {
        elements.push({
          xml: `<m:sSub><m:e>${baseXml}</m:e><m:sub>${subXml}</m:sub></m:sSub>`,
          isSpace: false,
        });
      }

      i = curr;
      continue;
    }

    // 4. Braces grouping {...}
    if (char === '{') {
      const grp = parseBracedGroup(input, i);
      const grpXml = processLatex(grp.content, font);
      elements.push({ xml: grpXml, isSpace: false });
      i = grp.endIdx;
      continue;
    }
    if (char === '}') {
      i++;
      continue;
    }

    // 5. Regular characters and operators
    if (char === ' ') {
      elements.push({ xml: ommlRun(' ', font), isSpace: true });
    } else if (char === '&') {
      elements.push({ xml: ommlRun(' ', font), isSpace: true });
    } else {
      elements.push({ xml: ommlRun(char, font), isSpace: false });
    }
    i++;
  }

  return elements.map((e) => e.xml).join('');
}

/**
 * Main entry point: converts a LaTeX string to complete OMML element
 */
export function latexToOmml(latex: string, useCambriaMath = false): string {
  if (!latex) return '';

  const font = useCambriaMath ? 'Cambria Math' : undefined;
  let str = latex.trim();

  // Strip $ wrapper if present
  if (str.startsWith('$$') && str.endsWith('$$')) {
    str = str.slice(2, -2).trim();
  } else if (str.startsWith('$') && str.endsWith('$')) {
    str = str.slice(1, -1).trim();
  }

  // Chuẩn hóa ký hiệu cung tròn dạng không ngoặc: \wideparen AB -> \wideparen{AB}
  str = str.replace(/\\(?:wideparen|overgroup|arc)\s*(?:\{([^{}]+)\}|([A-Za-z0-9']+))/g, (_m, g1, g2) => {
    const content = (g1 || g2 || '').trim();
    return `\\wideparen{${content}}`;
  });

  const innerOmml = processLatex(str, font);
  return `<m:oMath xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math" xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">${innerOmml}</m:oMath>`;
}
