/**
 * Utility functions for parsing LaTeX tabular environments, statistical data,
 * and generating SVGs for charts and diagrams in SimilarExam Studio.
 */

export interface ParsedTableData {
  headers: string[];
  rows: string[][];
}

/**
 * Kiểm tra xem một bảng dữ liệu có phải là Bảng Biến Thiên (Toán THCS/THPT) hay không
 */
export function isVariationTable(table?: ParsedTableData | null): boolean {
  if (!table || !table.headers) return false;
  const allRows = [table.headers, ...(table.rows || [])];
  const allText = allRows.flat().join(' ');

  // 1. Chứa mũi tên biến thiên (\nearrow, \searrow, ↗, ↘, \uparrow, \downarrow)
  const hasArrows = /\\nearrow|\\searrow|↗|↘|\\uparrow|\\downarrow/i.test(allText);

  // 2. Chứa vô cực (-\infty, +\infty, -∞, +∞, −∞)
  const hasInfinity = /\\infty|[-+−–]\\infty|[-+−–]∞/i.test(allText);

  // 3. Cột đầu tiên chứa x, y', y hoặc f'(x), f(x)
  const firstColText = allRows.map((r) => (r[0] || '').trim()).join(' ');
  const hasX = /(?:^|\b|\$)x(?:\$|\b|$)/i.test(firstColText);
  const hasYPrime = /(?:^|\b|\$)(?:y|f)\s*(?:'|’|\^\s*\{?\s*\\prime\s*\}?)(?:\s*\([a-zA-Z]\))?(?:\$|\b|$)/i.test(firstColText);
  const hasY = /(?:^|\b|\$)(?:y|f|f\s*\(\s*x\s*\))(?:\$|\b|$)/i.test(firstColText);

  if ((hasX && (hasYPrime || hasY)) || (hasArrows && (hasInfinity || hasX || hasYPrime))) {
    return true;
  }

  // 4. Có hàng dấu đạo hàm (+, -, 0)
  const hasSignsRow = allRows.some((r) => {
    const signs = r.filter((c) => /^[+\-−–0]$|^\\pm$|^\|\|$/.test(c.trim().replace(/\$/g, '')));
    return signs.length >= 2;
  });

  if (hasX && hasSignsRow) {
    return true;
  }

  return false;
}

export interface FormattedVariationTable {
  xRow: string[];
  yPrimeRow: string[];
  yRows: string[][];
  maxCols: number;
}

/**
 * Chuẩn hóa một ô chuỗi trong Bảng Biến Thiên:
 * Thay thế \nearrow thành ↗, \searrow thành ↘, \infty thành ∞, loại bỏ $ thừa
 */
export function cleanVariationToken(cell: string): string {
  if (!cell) return '';
  let s = cell.trim();
  // Bỏ dấu $ bao ngoài
  s = s.replace(/^\$+|\$+$/g, '').trim();
  s = s.replace(/\\mathrm\{([^}]+)\}/g, '$1');
  s = s.replace(/\\text\{([^}]+)\}/g, '$1');

  // Mũi tên tăng / giảm
  if (/^\\*(?:nearrow|uparrow|rightarrow|->)$|^↗$/i.test(s) || s.includes('nearrow') || s.includes('↗')) {
    return '↗';
  }
  if (/^\\*(?:searrow|downarrow)$|^↘$/i.test(s) || s.includes('searrow') || s.includes('↘')) {
    return '↘';
  }

  // Ký hiệu không xác định
  if (/^(\\|\\||\\||\/\/)$/.test(s)) {
    return '||';
  }

  // Vô cực: kiểm tra mọi loại dấu âm (ASCII -, Unicode minus −, en-dash –)
  if (s.includes('infty') || s.includes('∞')) {
    const isNeg = /[-−–]/.test(s);
    return isNeg ? '−∞' : '+∞';
  }

  // Dấu trừ
  if (s === '-' || s === '−' || s === '–') {
    return '−';
  }

  // Dấu cộng
  if (s === '+') {
    return '+';
  }

  return s;
}

/**
 * Chuẩn hóa và phân tách các dòng trong Bảng Biến Thiên:
 * Tự động căn chỉnh hoàn hảo các cột điểm (nghiệm x, cực trị y, 0)
 * và các cột khoảng biến thiên (dấu đạo hàm +, - và mũi tên ↗ ↘)
 */
export function structureVariationTable(table: ParsedTableData): FormattedVariationTable {
  const allRows = [table.headers, ...(table.rows || [])];

  // 1. Phân loại các hàng: hàng x, hàng y', và các hàng y
  let rawXRow: string[] = [];
  let rawYPrimeRow: string[] = [];
  const rawYRows: string[][] = [];

  for (let i = 0; i < allRows.length; i++) {
    const row = allRows[i];
    const firstCell = (row[0] || '').trim().toLowerCase().replace(/\$/g, '');
    const isXLabel = firstCell === 'x' || /^(?:\\text\{)?x(?:\})?$/i.test(firstCell);
    const isYPrimeLabel = /(?:^|[^a-zA-Z])(?:y|f)\s*(?:'|’|\^\s*\{?\s*\\prime\s*\}?)(?:\s*\([a-zA-Z]\))?/i.test(firstCell);
    const hasManySigns = row.filter((c) => /^[+\-−–0]$|^\\pm$|^\|\|$/.test(c.trim().replace(/\$/g, ''))).length >= 2;

    if (rawXRow.length === 0 && (isXLabel || i === 0)) {
      rawXRow = row;
    } else if (rawYPrimeRow.length === 0 && (isYPrimeLabel || hasManySigns || i === 1)) {
      rawYPrimeRow = row;
    } else {
      rawYRows.push(row);
    }
  }

  // Dự phòng nếu không tìm thấy theo tên nhãn:
  if (rawXRow.length === 0 && allRows.length > 0) rawXRow = allRows[0];
  if (rawYPrimeRow.length === 0 && allRows.length > 1) rawYPrimeRow = allRows[1];
  if (rawYRows.length === 0 && allRows.length > 2) rawYRows.push(...allRows.slice(2));

  // Lấy danh sách các điểm x không rỗng (bỏ nhãn 'x')
  let xPoints = rawXRow.slice(1).map(cleanVariationToken).filter((c) => c.length > 0);
  if (xPoints.length === 0) {
    xPoints = rawXRow.map(cleanVariationToken).filter((c) => c.length > 0 && c !== 'x');
  }

  // Chuẩn hóa vô cực ở hai đầu của trục x
  if (xPoints.length > 0) {
    if (xPoints[0].includes('∞') && !xPoints[0].includes('+')) {
      xPoints[0] = '−∞';
    }
    if (xPoints[xPoints.length - 1].includes('∞') && !xPoints[xPoints.length - 1].includes('-') && !xPoints[xPoints.length - 1].includes('−')) {
      xPoints[xPoints.length - 1] = '+∞';
    }
  }

  const yPrimeItems = rawYPrimeRow.slice(1).map(cleanVariationToken).filter((c) => c.length > 0);
  const N = xPoints.length;

  if (N >= 2) {
    const totalDataCols = 2 * N - 1;

    // Căn cột hàng x: điểm nằm ở các cột chẵn 0, 2, 4, 6...; cột lẻ là khoảng trống
    const alignedXData: string[] = [];
    for (let i = 0; i < totalDataCols; i++) {
      if (i % 2 === 0) {
        alignedXData.push(xPoints[i / 2] || '');
      } else {
        alignedXData.push('');
      }
    }
    const xRow = [rawXRow[0] || 'x', ...alignedXData];

    // Lấy chiều biến thiên arrows (độ dài N-1)
    const allYTokens = rawYRows.flatMap((r) =>
      r.slice(r[0] && (r[0].includes('y') || r[0].includes('f')) ? 1 : 0)
       .map(cleanVariationToken)
       .filter((c) => c.length > 0)
    );
    const explicitArrows = allYTokens.filter((t) => t === '↗' || t === '↘');

    const arrows: ('↗' | '↘')[] = [];
    for (let i = 0; i < N - 1; i++) {
      if (explicitArrows.length === N - 1) {
        arrows.push(explicitArrows[i] as any);
      } else {
        const signs = yPrimeItems.filter((item) => item === '+' || item === '-' || item === '−' || item === '–');
        if (signs.length >= N - 1) {
          arrows.push(signs[i] === '+' ? '↗' : '↘');
        } else {
          arrows.push(i % 2 === 0 ? '↘' : '↗');
        }
      }
    }

    // Căn cột hàng y':
    const alignedYPrimeData: string[] = Array(totalDataCols).fill('');
    for (let i = 0; i < N; i++) {
      if (i > 0 && i < N - 1) {
        const isDouble = yPrimeItems.includes('||') || xPoints[i] === '||';
        alignedYPrimeData[2 * i] = isDouble ? '||' : '0';
      }
      if (i < N - 1) {
        alignedYPrimeData[2 * i + 1] = arrows[i] === '↗' ? '+' : '−';
      }
    }
    const yPrimeRow = [rawYPrimeRow[0] || "y'", ...alignedYPrimeData];

    // Phân loại điểm cực trị: TOP (cực đại), BOT (cực tiểu), MID (điểm uốn)
    const pointTypes: ('TOP' | 'BOT' | 'MID')[] = [];
    for (let i = 0; i < N; i++) {
      if (i === 0) {
        pointTypes.push(arrows[0] === '↘' ? 'TOP' : 'BOT');
      } else if (i === N - 1) {
        pointTypes.push(arrows[arrows.length - 1] === '↗' ? 'TOP' : 'BOT');
      } else {
        const prevUp = arrows[i - 1] === '↗';
        const nextUp = arrows[i] === '↗';
        if (prevUp && !nextUp) {
          pointTypes.push('TOP');
        } else if (!prevUp && nextUp) {
          pointTypes.push('BOT');
        } else {
          pointTypes.push('MID');
        }
      }
    }

    // Lấy các giá trị y
    const rowTokens = rawYRows.map((r) =>
      r.slice(r[0] && (r[0].includes('y') || r[0].includes('f')) ? 1 : 0)
       .map(cleanVariationToken)
       .filter((c) => c.length > 0)
    ).filter((r) => r.length > 0);

    const nonArrowRows = rowTokens.filter((r) => !r.some((t) => t === '↗' || t === '↘'));
    const finalYValues: string[] = Array(N).fill('');

    if (nonArrowRows.length === 2) {
      const topTokens = nonArrowRows[0];
      const botTokens = nonArrowRows[1];
      let topIdx = 0;
      let botIdx = 0;
      for (let i = 0; i < N; i++) {
        if (pointTypes[i] === 'TOP') {
          if (topIdx < topTokens.length) finalYValues[i] = topTokens[topIdx++];
        } else {
          if (botIdx < botTokens.length) finalYValues[i] = botTokens[botIdx++];
        }
      }
    } else {
      const valTokens = allYTokens.filter((t) => t !== '↗' && t !== '↘' && t !== 'y' && t !== 'f');
      for (let i = 0; i < N; i++) {
        if (i < valTokens.length) {
          finalYValues[i] = valTokens[i];
        }
      }
    }

    const topRow = Array(totalDataCols).fill('');
    const midRow = Array(totalDataCols).fill('');
    const botRow = Array(totalDataCols).fill('');

    for (let i = 0; i < arrows.length; i++) {
      midRow[2 * i + 1] = arrows[i];
    }

    for (let i = 0; i < N; i++) {
      const val = finalYValues[i];
      if (pointTypes[i] === 'TOP') {
        topRow[2 * i] = val;
      } else if (pointTypes[i] === 'BOT') {
        botRow[2 * i] = val;
      } else {
        midRow[2 * i] = val;
      }
    }

    const yRows = [
      ['y', ...topRow],
      ['', ...midRow],
      ['', ...botRow],
    ];

    return { xRow, yPrimeRow, yRows, maxCols: totalDataCols + 1 };
  }

  // Trường hợp dự phòng nếu cấu trúc không theo quy luật thông thường
  const maxCols = Math.max(...allRows.map((r) => r.length), 1);
  const paddedRows = allRows.map((r) => {
    const copy = r.map(cleanVariationToken);
    while (copy.length < maxCols) copy.push('');
    return copy;
  });

  const xRow = paddedRows[0] || [];
  const yPrimeRow = paddedRows.length > 1 ? paddedRows[1] : [];
  const yRows = paddedRows.slice(2);

  return { xRow, yPrimeRow, yRows, maxCols };
}

/**
 * Tự động tạo ảnh vector SVG cho Bảng Biến Thiên chuẩn sách giáo khoa Việt Nam:
 * - Có các đường mũi tên vector dài nối liền mạch từ đáy lên đỉnh (↗) hoặc từ đỉnh xuống đáy (↘)
 * - Mũi tên có đầu nhọn chỉ chính xác vào các số cực trị
 * - Các mốc x, dấu y' và giá trị y được tính toán toạ độ chính xác 100%
 */
export function generateVariationTableSvg(table: ParsedTableData): string | null {
  if (!table) return null;
  const allRows = [table.headers, ...(table.rows || [])];

  // 1. Phân loại hàng x, hàng y', và các hàng của y
  let rawXRow: string[] = [];
  let rawYPrimeRow: string[] = [];
  const rawYRows: string[][] = [];

  for (let i = 0; i < allRows.length; i++) {
    const row = allRows[i];
    const firstCell = (row[0] || '').trim().toLowerCase().replace(/\$/g, '');
    const isXLabel = firstCell === 'x' || /^(?:\\text\{)?x(?:\})?$/i.test(firstCell);
    const isYPrimeLabel = /(?:^|[^a-zA-Z])(?:y|f)\s*(?:'|’|\^\s*\{?\s*\\prime\s*\}?)(?:\s*\([a-zA-Z]\))?/i.test(firstCell);
    const hasManySigns = row.filter((c) => /^[+\-−–0]$|^\\pm$|^\|\|$/.test(c.trim().replace(/\$/g, ''))).length >= 2;

    if (rawXRow.length === 0 && (isXLabel || i === 0)) {
      rawXRow = row;
    } else if (rawYPrimeRow.length === 0 && (isYPrimeLabel || hasManySigns || i === 1)) {
      rawYPrimeRow = row;
    } else {
      rawYRows.push(row);
    }
  }

  // Dự phòng nếu không tìm thấy theo tên nhãn:
  if (rawXRow.length === 0 && allRows.length > 0) rawXRow = allRows[0];
  if (rawYPrimeRow.length === 0 && allRows.length > 1) rawYPrimeRow = allRows[1];
  if (rawYRows.length === 0 && allRows.length > 2) rawYRows.push(...allRows.slice(2));

  // Lấy các điểm x
  let xPoints = rawXRow.slice(1).map(cleanVariationToken).filter((c) => c.length > 0);
  if (xPoints.length === 0) {
    xPoints = rawXRow.map(cleanVariationToken).filter((c) => c.length > 0 && c !== 'x');
  }

  // Chuẩn hóa vô cực ở hai đầu của trục x
  if (xPoints.length > 0) {
    if (xPoints[0].includes('∞') && !xPoints[0].includes('+')) {
      xPoints[0] = '−∞';
    }
    if (xPoints[xPoints.length - 1].includes('∞') && !xPoints[xPoints.length - 1].includes('-') && !xPoints[xPoints.length - 1].includes('−')) {
      xPoints[xPoints.length - 1] = '+∞';
    }
  }

  const N = xPoints.length;
  if (N < 2) return null;

  // Lấy dấu và ký hiệu hàng y'
  const yPrimeItems = rawYPrimeRow.slice(1).map(cleanVariationToken).filter((c) => c.length > 0);

  // Lấy chiều biến thiên arrows (độ dài N-1)
  const allYTokens = rawYRows.flatMap((r) =>
    r.slice(r[0] && (r[0].includes('y') || r[0].includes('f')) ? 1 : 0)
     .map(cleanVariationToken)
     .filter((c) => c.length > 0)
  );
  const explicitArrows = allYTokens.filter((t) => t === '↗' || t === '↘');

  const arrows: ('↗' | '↘')[] = [];
  for (let i = 0; i < N - 1; i++) {
    if (explicitArrows.length === N - 1) {
      arrows.push(explicitArrows[i] as any);
    } else {
      const signs = yPrimeItems.filter((item) => item === '+' || item === '-' || item === '−' || item === '–');
      if (signs.length >= N - 1) {
        arrows.push(signs[i] === '+' ? '↗' : '↘');
      } else {
        arrows.push(i % 2 === 0 ? '↘' : '↗');
      }
    }
  }

  // Phân loại điểm cực trị: TOP (cực đại), BOT (cực tiểu), MID (điểm uốn)
  const pointTypes: ('TOP' | 'BOT' | 'MID')[] = [];
  for (let i = 0; i < N; i++) {
    if (i === 0) {
      pointTypes.push(arrows[0] === '↘' ? 'TOP' : 'BOT');
    } else if (i === N - 1) {
      pointTypes.push(arrows[arrows.length - 1] === '↗' ? 'TOP' : 'BOT');
    } else {
      const prevUp = arrows[i - 1] === '↗';
      const nextUp = arrows[i] === '↗';
      if (prevUp && !nextUp) {
        pointTypes.push('TOP');
      } else if (!prevUp && nextUp) {
        pointTypes.push('BOT');
      } else {
        pointTypes.push('MID');
      }
    }
  }

  // Lấy các giá trị y
  const rowTokens = rawYRows.map((r) =>
    r.slice(r[0] && (r[0].includes('y') || r[0].includes('f')) ? 1 : 0)
     .map(cleanVariationToken)
     .filter((c) => c.length > 0)
  ).filter((r) => r.length > 0);

  const nonArrowRows = rowTokens.filter((r) => !r.some((t) => t === '↗' || t === '↘'));
  const finalYValues: string[] = Array(N).fill('');

  if (nonArrowRows.length === 2) {
    const topTokens = nonArrowRows[0];
    const botTokens = nonArrowRows[1];
    let topIdx = 0;
    let botIdx = 0;
    for (let i = 0; i < N; i++) {
      if (pointTypes[i] === 'TOP') {
        if (topIdx < topTokens.length) finalYValues[i] = topTokens[topIdx++];
      } else {
        if (botIdx < botTokens.length) finalYValues[i] = botTokens[botIdx++];
      }
    }
  } else {
    const valTokens = allYTokens.filter((t) => t !== '↗' && t !== '↘' && t !== 'y' && t !== 'f');
    for (let i = 0; i < N; i++) {
      if (i < valTokens.length) {
        finalYValues[i] = valTokens[i];
      }
    }
  }

  // Kiểm tra tiệm cận đứng / điểm không xác định (||)
  const isDoubleBar = (idx: number) => {
    if (xPoints[idx] === '||') return true;
    if (idx < yPrimeItems.length && yPrimeItems[idx] === '||') return true;
    return false;
  };

  // TÍNH TOÁN TOẠ ĐỘ SVG CHUẨN XÁC
  const W = Math.max(560, N * 135);
  const H = 205;
  const col1W = 70;
  const plotW = W - col1W - 50;
  const stepX = plotW / (N - 1);

  const X_pts = xPoints.map((_, i) => col1W + 25 + i * stepX);
  const Y_top = 118;
  const Y_mid = 150;
  const Y_bot = 182;

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" class="w-full max-w-[620px] h-auto select-none font-serif">`;
  svg += `<defs>
    <marker id="bbt-arrow-indigo" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="6.5" markerHeight="6.5" orient="auto-start-reverse">
      <path d="M 0 1.5 L 8.5 5 L 0 8.5 z" fill="#4F46E5"/>
    </marker>
  </defs>`;

  svg += `<rect x="1" y="1" width="${W - 2}" height="${H - 2}" rx="10" fill="#FFFFFF" stroke="#CBD5E1" stroke-width="1.5"/>`;
  svg += `<line x1="${col1W}" y1="8" x2="${col1W}" y2="${H - 8}" stroke="#0F172A" stroke-width="2"/>`;
  svg += `<line x1="8" y1="46" x2="${W - 8}" y2="46" stroke="#0F172A" stroke-width="1.5"/>`;
  svg += `<line x1="8" y1="90" x2="${W - 8}" y2="90" stroke="#0F172A" stroke-width="1.5"/>`;

  svg += `<text x="${col1W / 2}" y="31" text-anchor="middle" font-family="serif" font-weight="bold" font-style="italic" font-size="16" fill="#0F172A">x</text>`;
  svg += `<text x="${col1W / 2}" y="74" text-anchor="middle" font-family="serif" font-weight="bold" font-style="italic" font-size="16" fill="#0F172A">y'</text>`;
  svg += `<text x="${col1W / 2}" y="152" text-anchor="middle" font-family="serif" font-weight="bold" font-style="italic" font-size="16" fill="#0F172A">y</text>`;

  // 1. Điểm hàng x
  X_pts.forEach((x, i) => {
    if (xPoints[i] !== '||') {
      svg += `<text x="${x.toFixed(1)}" y="31" text-anchor="middle" font-family="serif" font-weight="bold" font-size="15" fill="#0F172A">${xPoints[i]}</text>`;
    }
  });

  // 2. Dấu và số 0 ở hàng y', hoặc tiệm cận đứng ||
  for (let i = 0; i < N; i++) {
    if (isDoubleBar(i)) {
      // Hai vạch song song cho điểm không xác định
      svg += `<line x1="${(X_pts[i] - 2.5).toFixed(1)}" y1="46" x2="${(X_pts[i] - 2.5).toFixed(1)}" y2="${H - 8}" stroke="#0F172A" stroke-width="1.2"/>`;
      svg += `<line x1="${(X_pts[i] + 2.5).toFixed(1)}" y1="46" x2="${(X_pts[i] + 2.5).toFixed(1)}" y2="${H - 8}" stroke="#0F172A" stroke-width="1.2"/>`;
    } else if (i > 0 && i < N - 1) {
      svg += `<text x="${X_pts[i].toFixed(1)}" y="74" text-anchor="middle" font-weight="bold" font-size="15" fill="#0F172A">0</text>`;
    }
    if (i < N - 1) {
      const midX = (X_pts[i] + X_pts[i + 1]) / 2;
      const isUp = arrows[i] === '↗';
      const signText = isUp ? '+' : '−';
      const signColor = isUp ? '#047857' : '#E11D48';
      svg += `<text x="${midX.toFixed(1)}" y="74" text-anchor="middle" font-weight="bold" font-size="17" fill="${signColor}">${signText}</text>`;
    }
  }

  // 3. Giá trị hàng y
  X_pts.forEach((x, i) => {
    const yVal = finalYValues[i];
    const type = pointTypes[i];
    const yPos = type === 'TOP' ? Y_top : (type === 'MID' ? Y_mid : Y_bot);
    if (yVal && yVal !== '||') {
      svg += `<text x="${x.toFixed(1)}" y="${yPos}" text-anchor="middle" font-family="serif" font-weight="bold" font-size="15" fill="#0F172A">${yVal}</text>`;
    }
  });

  // 4. Các đường mũi tên vector dài và chỉ đúng vị trí
  for (let i = 0; i < N - 1; i++) {
    const isUp = arrows[i] === '↗';
    const x1 = X_pts[i] + 18;
    const x2 = X_pts[i + 1] - 18;
    const startType = pointTypes[i];
    const endType = pointTypes[i + 1];

    let y1: number;
    let y2: number;

    if (isUp) {
      y1 = (startType === 'BOT' ? Y_bot - 8 : (startType === 'MID' ? Y_mid - 6 : Y_top - 6));
      y2 = (endType === 'TOP' ? Y_top + 4 : (endType === 'MID' ? Y_mid + 4 : Y_bot + 4));
    } else {
      y1 = (startType === 'TOP' ? Y_top + 6 : (startType === 'MID' ? Y_mid + 6 : Y_bot + 6));
      y2 = (endType === 'BOT' ? Y_bot - 8 : (endType === 'MID' ? Y_mid - 8 : Y_top - 8));
    }

    svg += `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="#4F46E5" stroke-width="2.2" marker-end="url(#bbt-arrow-indigo)"/>`;
  }

  svg += `</svg>`;
  return svg;
}

/**
 * Parses LaTeX \begin{tabular} ... \end{tabular} out of a text string.
 * Returns the cleaned text (without tabular) and the structured table data.
 */
export function extractAndParseTabular(text: string): {
  cleanText: string;
  table?: ParsedTableData;
  tables?: ParsedTableData[];
} {
  if (!text) return { cleanText: '' };

  // Regex khớp cả \begin{tabular} và \begin{tabular*}
  const tabularRegex = /\\begin\{tabular\*?\}\s*(?:\{[^}]*\}\s*)?\{[^}]*\}\s*([\s\S]*?)\\end\{tabular\*?\}/gi;
  const allMatches = [...text.matchAll(tabularRegex)];

  if (allMatches.length === 0) {
    // Fallback: try simpler pattern without optional second arg (for {|c|c|} only)
    const simpleRegex = /\\begin\{tabular\}\s*\{[^}]*\}\s*([\s\S]*?)\\end\{tabular\}/gi;
    const simpleMatches = [...text.matchAll(simpleRegex)];
    if (simpleMatches.length === 0) return { cleanText: text };

    const tables: ParsedTableData[] = [];
    let cleanText = text
      .replace(/\\begin\{center\}/gi, '')
      .replace(/\\end\{center\}/gi, '');

    for (const match of simpleMatches) {
      const table = parseTabularBody(match[1]);
      if (table) {
        tables.push(table);
        cleanText = cleanText.replace(match[0], '').trim();
      }
    }

    return tables.length > 0
      ? { cleanText: cleanText.trim(), table: tables[0], tables }
      : { cleanText: text };
  }

  const tables: ParsedTableData[] = [];
  let cleanText = text
    .replace(/\\begin\{center\}/gi, '')
    .replace(/\\end\{center\}/gi, '');

  for (const match of allMatches) {
    const table = parseTabularBody(match[1]);
    if (table) {
      tables.push(table);
      cleanText = cleanText.replace(match[0], '').trim();
    }
  }

  return tables.length > 0
    ? { cleanText: cleanText.trim(), table: tables[0], tables }
    : { cleanText: text };
}

/**
 * Helper: Parses the body of a tabular environment into ParsedTableData
 */
function parseTabularBody(tabularBody: string): ParsedTableData | null {
  // Strip horizontal line commands before splitting rows
  const cleanBody = tabularBody
    .replace(/\\hline/g, '')
    .replace(/\\toprule/g, '')
    .replace(/\\midrule/g, '')
    .replace(/\\bottomrule/g, '')
    .replace(/\\cline\{[^}]*\}/g, '');

  // Split rows by '\\' or '\cr'
  const rawRows = cleanBody
    .split(/\\\\|\\cr/)
    .map((r) => r.trim())
    .filter((r) => r.length > 0);

  const rows: string[][] = [];

  for (const rawRow of rawRows) {
    const cells = rawRow.split('&').map((c) => c.trim());
    if (cells.length > 0 && cells.some((c) => c.length > 0)) {
      rows.push(cells);
    }
  }

  if (rows.length === 0) return null;

  const headers = rows[0];
  const dataRows = rows.slice(1);

  return { headers, rows: dataRows };
}


/**
 * Extracts statistical group percentages or frequencies (e.g. from Câu 12)
 * like "Nhóm 1 (từ 0 đến dưới 5 giờ): 15%" or "[0; 5): 15%"
 * and generates a clean, scalable SVG bar chart.
 */
export function extractAndGenerateStatisticalChart(text: string): {
  cleanText: string;
  chartSvg?: string;
  chartBase64?: string;
} {
  if (!text) return { cleanText: '' };

  // Look for bullet points with Nhóm X (...): Y% or Y
  const groupRegex = /(?:•|-|\*|\+)?\s*(?:Nhóm\s*\d+\s*)?\((?:từ\s*)?(\d+)\s*(?:đến|;|-)\s*(?:dưới\s*)?(\d+)[^)]*\):\s*([\d.,]+)\s*%/gi;
  const matches = [...text.matchAll(groupRegex)];

  if (matches.length < 2) {
    return { cleanText: text };
  }

  const categories = matches.map((m) => {
    const from = m[1];
    const to = m[2];
    const val = parseFloat(m[3].replace(',', '.'));
    return {
      label: `[${from}; ${to})`,
      value: isNaN(val) ? 0 : val,
      displayValue: `${m[3]}%`,
    };
  });

  const chartSvg = generateBarChartSvg(
    'Biểu đồ tần số tương đối ghép nhóm (%)',
    categories
  );

  // Clean out the bullet list and center tags from the text
  const cleanText = text
    .replace(/\\begin\{center\}[\s\S]*?\\end\{center\}/gi, (match) => {
      if (match.includes('%')) return '';
      return match;
    })
    .replace(groupRegex, '')
    .trim();

  return {
    cleanText,
    chartSvg,
  };
}

/**
 * Generates an SVG Bar Chart for statistical frequency tables.
 */
export function generateBarChartSvg(
  title: string,
  categories: { label: string; value: number; displayValue: string }[]
): string {
  const width = 540;
  const height = 280;
  const margin = { top: 40, right: 30, bottom: 50, left: 60 };
  const plotWidth = width - margin.left - margin.right;
  const plotHeight = height - margin.top - margin.bottom;

  const maxVal = Math.max(...categories.map((c) => c.value), 10);
  const yMax = Math.ceil(maxVal / 10) * 10;

  const barCount = categories.length;
  const barGap = 24;
  const barWidth = Math.max(36, Math.min(70, (plotWidth - barGap * (barCount + 1)) / barCount));
  const totalBarsWidth = barCount * barWidth + (barCount - 1) * barGap;
  const startX = margin.left + (plotWidth - totalBarsWidth) / 2;

  // Grid lines
  let gridLines = '';
  const stepCount = 5;
  for (let i = 0; i <= stepCount; i++) {
    const yVal = (yMax / stepCount) * i;
    const yPos = margin.top + plotHeight - (yVal / yMax) * plotHeight;
    gridLines += `
      <line x1="${margin.left}" y1="${yPos}" x2="${width - margin.right}" y2="${yPos}" stroke="#E2E8F0" stroke-dasharray="3,3" />
      <text x="${margin.left - 8}" y="${yPos + 4}" text-anchor="end" font-size="11" fill="#64748B" font-family="sans-serif">${yVal}%</text>
    `;
  }

  // Bars & labels
  let barsSvg = '';
  categories.forEach((cat, idx) => {
    const x = startX + idx * (barWidth + barGap);
    const barH = (cat.value / yMax) * plotHeight;
    const y = margin.top + plotHeight - barH;

    barsSvg += `
      <!-- Bar ${idx + 1} -->
      <rect x="${x}" y="${y}" width="${barWidth}" height="${barH}" rx="4" fill="url(#barGradient)" filter="url(#dropShadow)" />
      <!-- Value Label -->
      <text x="${x + barWidth / 2}" y="${y - 6}" text-anchor="middle" font-size="12" font-weight="bold" fill="#1E3A8A" font-family="sans-serif">${cat.displayValue}</text>
      <!-- Category Label -->
      <text x="${x + barWidth / 2}" y="${margin.top + plotHeight + 20}" text-anchor="middle" font-size="12" font-weight="600" fill="#334155" font-family="sans-serif">${cat.label}</text>
    `;
  });

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" style="background-color: #ffffff; border-radius: 8px;">
    <defs>
      <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#3B82F6" />
        <stop offset="100%" stop-color="#1D4ED8" />
      </linearGradient>
      <filter id="dropShadow" x="-10%" y="-10%" width="120%" height="120%">
        <feDropShadow dx="0" dy="2" stdDeviation="2" flood-opacity="0.15" />
      </filter>
    </defs>
    <!-- Chart Title -->
    <text x="${width / 2}" y="24" text-anchor="middle" font-size="14" font-weight="bold" fill="#0F172A" font-family="sans-serif">${title}</text>
    <!-- Y-Axis line -->
    <line x1="${margin.left}" y1="${margin.top}" x2="${margin.left}" y2="${margin.top + plotHeight}" stroke="#94A3B8" stroke-width="1.5" />
    <!-- X-Axis line -->
    <line x1="${margin.left}" y1="${margin.top + plotHeight}" x2="${width - margin.right}" y2="${margin.top + plotHeight}" stroke="#94A3B8" stroke-width="1.5" />
    <!-- Grid -->
    ${gridLines}
    <!-- Bars & Labels -->
    ${barsSvg}
  </svg>`;
}

/**
 * Converts an SVG string into a data:image/png;base64 string using client-side Canvas.
 */
export async function svgStringToPngBase64(svgString: string): Promise<string> {
  if (typeof window === 'undefined' || typeof document === 'undefined') return '';
  return new Promise((resolve) => {
    try {
      // Detect viewBox dimensions
      const vbMatch = svgString.match(/viewBox=["']\s*([\d.-]+)\s+([\d.-]+)\s+([\d.-]+)\s+([\d.-]+)\s*["']/i);
      let targetW = 600;
      let targetH = 350;

      if (vbMatch) {
        const vbW = parseFloat(vbMatch[3]);
        const vbH = parseFloat(vbMatch[4]);
        if (vbW > 0 && vbH > 0) {
          targetW = Math.round(vbW * 1.5);
          targetH = Math.round(vbH * 1.5);
        }
      }

      let cleanSvg = svgString;
      if (!cleanSvg.includes('xmlns=')) {
        cleanSvg = cleanSvg.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"');
      }

      const svgBlob = new Blob([cleanSvg], { type: 'image/svg+xml;charset=utf-8' });
      const urlObj = window.URL || (window as any).webkitURL;
      const blobURL = urlObj.createObjectURL(svgBlob);
      const img = new Image();

      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          const finalW = img.naturalWidth || img.width || targetW;
          const finalH = img.naturalHeight || img.height || targetH;
          canvas.width = finalW;
          canvas.height = finalH;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.fillStyle = '#FFFFFF';
            ctx.fillRect(0, 0, finalW, finalH);
            ctx.drawImage(img, 0, 0, finalW, finalH);
            const pngUrl = canvas.toDataURL('image/png');
            urlObj.revokeObjectURL(blobURL);
            resolve(pngUrl);
            return;
          }
        } catch (canvasErr) {
          console.warn('Canvas render error:', canvasErr);
        }
        urlObj.revokeObjectURL(blobURL);
        resolve('');
      };

      img.onerror = () => {
        urlObj.revokeObjectURL(blobURL);
        resolve('');
      };

      img.src = blobURL;
    } catch {
      resolve('');
    }
  });
}
