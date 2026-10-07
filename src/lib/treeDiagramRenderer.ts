/**
 * @license
 * SimilarExam Studio - Probability Tree Diagram Renderer (Xác Suất Lớp 11 & 12 GDPT 2018)
 *
 * Tự động tính toán toạ độ và vẽ sơ đồ cây phân cấp cho các bài toán xác suất:
 * Xác suất có điều kiện, Công thức xác suất toàn phần, và Định lý Bayes.
 * Xuất vector SVG / PNG chất lượng cao để nhúng trực tiếp vào file Word.
 */

import { svgStringToPngBase64 } from './tableAndChartHelper';

export interface TreeNode {
  id: string;
  name: string;
  prob?: string; // Xác suất trên nhánh dẫn đến nút này (vd: 0.6, 2/3, P(A))
  children?: TreeNode[];
  // Toạ độ tính toán
  x?: number;
  y?: number;
  depth?: number;
}

export interface TreeDiagramOptions {
  width?: number;
  height?: number;
  title?: string;
  showOutcomeProb?: boolean; // Hiển thị tích xác suất ở cuối mỗi nhánh
  nodeColor?: string;
  lineColor?: string;
}

/**
 * Phân tích văn bản dạng thụt lề thành cấu trúc cây:
 * Ví dụ:
 * Gốc
 *   Hộp I | 0.6
 *     Bi trắng | 0.7
 *     Bi đỏ | 0.3
 *   Hộp II | 0.4
 *     Bi trắng | 0.5
 *     Bi đỏ | 0.5
 */
export function parseTreeDiagramText(input: string): TreeNode | null {
  if (!input || !input.trim()) return null;

  const lines = input
    .split('\n')
    .map((l) => l.trimEnd())
    .filter((l) => l.trim().length > 0);

  if (lines.length === 0) return null;

  const root: TreeNode = {
    id: 'root',
    name: 'Bắt đầu',
    children: [],
  };

  const stack: { node: TreeNode; indent: number }[] = [{ node: root, indent: -1 }];

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const indent = rawLine.search(/\S/);
    const content = rawLine.trim();

    // Tách tên nút và xác suất (phân cách bởi dấu | hoặc :)
    let name = content;
    let prob = '';

    if (content.includes('|')) {
      const parts = content.split('|');
      name = parts[0].trim();
      prob = parts[1].trim();
    } else if (content.includes(':') && !content.startsWith('http')) {
      const parts = content.split(':');
      name = parts[0].trim();
      prob = parts[1].trim();
    }

    const newNode: TreeNode = {
      id: `node_${i}_${Date.now()}`,
      name,
      prob: prob || undefined,
      children: [],
    };

    // Tìm cha có indent nhỏ hơn
    while (stack.length > 1 && stack[stack.length - 1].indent >= indent) {
      stack.pop();
    }

    const parent = stack[stack.length - 1].node;
    if (!parent.children) parent.children = [];
    parent.children.push(newNode);

    stack.push({ node: newNode, indent });
  }

  // Nếu gốc chỉ có 1 con và gốc có tên mặc định, có thể dùng con đó làm gốc nếu hợp lý
  if (root.children && root.children.length === 1 && root.name === 'Bắt đầu' && lines[0].search(/\S/) === 0) {
    return root.children[0];
  }

  return root;
}

/**
 * Đếm số lá (leaf nodes) của cây
 */
function countLeaves(node: TreeNode): number {
  if (!node.children || node.children.length === 0) return 1;
  return node.children.reduce((acc, c) => acc + countLeaves(c), 0);
}

/**
 * Tìm độ sâu tối đa của cây
 */
function getMaxDepth(node: TreeNode, depth = 0): number {
  if (!node.children || node.children.length === 0) return depth;
  return Math.max(...node.children.map((c) => getMaxDepth(c, depth + 1)));
}

/**
 * Tính toán toạ độ x, y cho từng nút theo thuật toán cây phân cấp
 */
function layoutTree(
  node: TreeNode,
  startX: number,
  colWidth: number,
  leafHeight: number,
  currentLeafIndex: { val: number },
  depth = 0
): void {
  node.depth = depth;
  node.x = startX + depth * colWidth;

  if (!node.children || node.children.length === 0) {
    node.y = currentLeafIndex.val * leafHeight + leafHeight / 2;
    currentLeafIndex.val++;
  } else {
    node.children.forEach((child) => {
      layoutTree(child, startX, colWidth, leafHeight, currentLeafIndex, depth + 1);
    });
    // Toạ độ y của nút cha là trung bình cộng toạ độ y của các nút con
    const ys = node.children.map((c) => c.y || 0);
    node.y = (Math.min(...ys) + Math.max(...ys)) / 2;
  }
}

/**
 * Lấy danh sách đường dẫn từ gốc đến lá và tính xác suất kết quả
 */
function collectPaths(
  node: TreeNode,
  currentPath: TreeNode[] = []
): { path: TreeNode[]; outcomeProb?: string }[] {
  const newPath = [...currentPath, node];
  if (!node.children || node.children.length === 0) {
    const probs = newPath.map((n) => n.prob).filter(Boolean) as string[];
    return [{ path: newPath, outcomeProb: probs.length > 0 ? probs.join(' × ') : undefined }];
  }
  return node.children.flatMap((child) => collectPaths(child, newPath));
}

/**
 * Vẽ sơ đồ cây xác suất sang chuỗi vector SVG
 */
export function renderTreeDiagramToSvg(
  root: TreeNode,
  options: TreeDiagramOptions = {}
): string {
  if (!root) return '';

  const totalLeaves = countLeaves(root);
  const maxDepth = getMaxDepth(root);

  const leafHeight = Math.max(48, Math.min(75, 450 / Math.max(1, totalLeaves)));
  const computedHeight = Math.max(options.height || 0, totalLeaves * leafHeight + 70);
  const colWidth = Math.max(160, Math.min(220, 650 / Math.max(1, maxDepth)));
  const computedWidth = Math.max(options.width || 0, (maxDepth + 1.2) * colWidth + (options.showOutcomeProb !== false ? 120 : 60));

  const paddingLeft = 45;
  const paddingTop = 45;

  const leafIndex = { val: 0 };
  layoutTree(root, paddingLeft, colWidth, leafHeight, leafIndex, 0);

  const lineColor = options.lineColor || '#475569';
  const nodeBoxColor = options.nodeColor || '#EEF2FF';

  let branchesXml = '';
  let nodesXml = '';
  let labelsXml = '';

  // Duyệt cây để vẽ các nhánh và nhãn
  function traverse(n: TreeNode) {
    if (n.children && n.children.length > 0) {
      n.children.forEach((child) => {
        const x1 = n.x || 0;
        const y1 = n.y || 0;
        const x2 = child.x || 0;
        const y2 = child.y || 0;

        // Vẽ đường nối uốn lượn Bezier mượt mà
        const cx1 = x1 + (x2 - x1) * 0.55;
        const cy1 = y1;
        const cx2 = x1 + (x2 - x1) * 0.45;
        const cy2 = y2;

        branchesXml += `<path d="M ${x1} ${y1} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${x2} ${y2}" fill="none" stroke="${lineColor}" stroke-width="1.8" stroke-linecap="round" />`;

        // Vẽ nhãn xác suất trên nhánh (Probability badge)
        if (child.prob) {
          const midX = (x1 + x2) / 2;
          const midY = (y1 + y2) / 2;
          const probStr = String(child.prob);

          const badgeW = Math.max(32, probStr.length * 8 + 12);
          const badgeH = 20;

          labelsXml += `<rect x="${midX - badgeW / 2}" y="${midY - badgeH / 2}" width="${badgeW}" height="${badgeH}" rx="6" fill="#FFFFFF" stroke="#CBD5E1" stroke-width="1" />`;
          labelsXml += `<text x="${midX}" y="${midY + 4}" font-family="Times New Roman, serif" font-size="12" font-style="italic" font-weight="bold" fill="#2563EB" text-anchor="middle">${probStr}</text>`;
        }

        traverse(child);
      });
    }

    // Vẽ hộp nút (Node box)
    const nx = n.x || 0;
    const ny = n.y || 0;
    const textLen = n.name.length;
    const boxW = Math.max(65, textLen * 9.5 + 24);
    const boxH = 28;

    nodesXml += `<g class="tree-node">
      <rect x="${nx - boxW / 2}" y="${ny - boxH / 2}" width="${boxW}" height="${boxH}" rx="7" fill="${n.depth === 0 ? '#1E293B' : nodeBoxColor}" stroke="${n.depth === 0 ? '#0F172A' : '#C7D2FE'}" stroke-width="1.5" />
      <text x="${nx}" y="${ny + 5}" font-family="Times New Roman, serif" font-size="13.5" font-weight="${n.depth === 0 ? 'bold' : '600'}" fill="${n.depth === 0 ? '#FFFFFF' : '#1E1B4B'}" text-anchor="middle">${n.name}</text>
    </g>`;
  }

  traverse(root);

  // Hiển thị cột kết quả xác suất ở cuối các nhánh nếu bật
  let outcomesXml = '';
  if (options.showOutcomeProb !== false) {
    const paths = collectPaths(root);
    paths.forEach((p) => {
      const lastNode = p.path[p.path.length - 1];
      if (lastNode && p.outcomeProb) {
        const lx = (lastNode.x || 0) + 70;
        const ly = (lastNode.y || 0) + 4;
        outcomesXml += `<text x="${lx}" y="${ly}" font-family="Times New Roman, serif" font-size="12" font-style="italic" fill="#64748B">⇒ P = ${p.outcomeProb}</text>`;
      }
    });
  }

  // Tiêu đề
  let titleXml = '';
  if (options.title) {
    titleXml = `<text x="${computedWidth / 2}" y="24" font-family="Times New Roman, serif" font-size="15" font-weight="bold" fill="#0F172A" text-anchor="middle">${options.title}</text>`;
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${computedWidth} ${computedHeight}" width="${computedWidth}" height="${computedHeight}">
    <rect width="100%" height="100%" fill="#FFFFFF" />
    ${titleXml}
    <g class="branches">${branchesXml}</g>
    <g class="prob-labels">${labelsXml}</g>
    <g class="nodes">${nodesXml}</g>
    <g class="outcomes">${outcomesXml}</g>
  </svg>`;
}

/**
 * Xuất Sơ đồ cây sang ảnh PNG Base64 để nhúng vào Word
 */
export async function renderTreeDiagramToPng(
  root: TreeNode,
  options: TreeDiagramOptions = {}
): Promise<string> {
  const svg = renderTreeDiagramToSvg(root, options);
  if (!svg) return '';
  return await svgStringToPngBase64(svg);
}
