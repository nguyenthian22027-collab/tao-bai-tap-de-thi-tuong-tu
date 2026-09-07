// ============================================================
// geoviz/geovizService.ts — Dịch vụ tổng hợp GeoViz 2D Engine
// Tích hợp vào dự án d:\tao-bai-tuong-tu bằng callGeminiRoundRobin hiện có
// ============================================================

import { callGeminiRoundRobin } from '../gemini';
import { buildGeovizPrompt } from './geovizPrompt';
import { solveGeometryGraph } from './geoSolver';
import { generateGeovizTikz } from './geovizTikz';
import { GeoConstraintGraph } from './geoConstraints';
import { Shape2DData } from './types';

export interface GeovizResult {
  tikzCode: string;
  shapeData: Shape2DData;
  method: 'geoviz' | 'fallback';
  message?: string;
}

/**
 * Hàm chính: Sinh mã TikZ hình phẳng 2D chính xác bằng GeoViz Engine.
 *
 * Quy trình 3 pha:
 * 1. Gọi AI (Gemini) lấy JSON ràng buộc hình học ---GEOCONSTRAINTS---
 * 2. Giải tọa độ chính xác 100% bằng geoSolver (chạy trong trình duyệt)
 * 3. Sinh mã TikZ chuẩn từ tọa độ đã giải
 *
 * @param questionText - Văn bản đề bài hình học 2D
 * @param model - Model Gemini sử dụng (mặc định flash)
 * @returns GeovizResult với tikzCode, shapeData và method đã dùng
 */
export async function generateGeovizTikzFromQuestion(
  questionText: string,
  model = 'gemini-3.5-flash'
): Promise<GeovizResult> {
  // === PHA 1: AI trích xuất ràng buộc hình học ===
  const prompt = buildGeovizPrompt(questionText);
  let rawResponse: string;

  try {
    rawResponse = await callGeminiRoundRobin(prompt, model);
  } catch (err: any) {
    throw new Error(`Không thể gọi AI: ${err.message || 'Lỗi không xác định'}`);
  }

  // === Parse JSON từ ---GEOCONSTRAINTS--- (hỗ trợ xử lý lỗi dấu phẩy, comment của AI) ===
  const graph = parseGeoConstraintsFromText(rawResponse);

  if (!graph) {
    throw new Error(
      'AI không nhận ra cấu trúc hình học 2D trong bài toán này. ' +
      'Bài toán có thể là hình không gian 3D, đồ thị hoặc không phải hình phẳng. ' +
      'Hãy thử nút "Sinh TikZ AI" thông thường.'
    );
  }

  // === PHA 2: Giải tọa độ chính xác 100% bằng giải tích ===
  const shapeData = solveGeometryGraph(graph);

  if (!shapeData || shapeData.points.length === 0) {
    throw new Error(
      'Bộ máy giải hình học không tính được tọa độ các điểm. ' +
      'AI có thể đã trích xuất sai cấu trúc ràng buộc. ' +
      'Hãy thử nút "Sinh TikZ AI" thông thường.'
    );
  }

  // === PHA 3: Sinh mã TikZ chuẩn SGK Việt Nam ===
  const tikzCode = generateGeovizTikz(shapeData);

  return {
    tikzCode,
    shapeData,
    method: 'geoviz',
    message: `✅ Đã vẽ bằng GeoViz AI — ${shapeData.points.length} điểm, tọa độ chính xác 100%`,
  };
}

/** Làm sạch JSON: loại bỏ chú thích (//, /*), dấu phẩy thừa cuối mảng/object, dấu ngoặc kép thông minh */
function cleanJsonString(raw: string): string {
  return raw
    .replace(/\/\*[\s\S]*?\*\//gm, '')           // chú thích khối
    .replace(/\/\/.*$/gm, '')                     // chú thích dòng
    .replace(/,(\s*[}\]])/g, '$1')                // dấu phẩy thừa cuối
    .replace(/[\u201C\u201D\u2018\u2019]/g, '"') // ngoặc kép cong → thẳng
    .trim();
}

/**
 * Parse JSON ràng buộc hình học từ text trả về của AI.
 * Đa chiến lược: tách theo ---GEOCONSTRAINTS---, tìm khối json, hoặc tìm cặp ngoặc { ... }
 */
function parseGeoConstraintsFromText(rawText: string): GeoConstraintGraph | null {
  if (!rawText) return null;

  const candidates: string[] = [];

  // Chiến lược 1: Khối nằm giữa ---GEOCONSTRAINTS---
  if (rawText.includes('---GEOCONSTRAINTS---')) {
    const parts = rawText.split('---GEOCONSTRAINTS---');
    for (let i = 1; i < parts.length; i += 2) {
      const block = parts[i]?.trim();
      if (block) candidates.push(block);
    }
    candidates.reverse(); // Ưu tiên khối cuối/tốt nhất
  }

  // Chiến lược 2: Tìm khối ```json ... ```
  const jsonBlockRegex = /```(?:json)?\s*([\s\S]*?)```/g;
  let match: RegExpExecArray | null;
  while ((match = jsonBlockRegex.exec(rawText)) !== null) {
    if (match[1]) candidates.push(match[1].trim());
  }

  // Chiến lược 3: Tìm từ dấu { đầu tiên tới dấu } cuối cùng
  const firstBrace = rawText.indexOf('{');
  const lastBrace = rawText.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    candidates.push(rawText.substring(firstBrace, lastBrace + 1));
  }

  for (const candidate of candidates) {
    try {
      let jsonBlock = candidate;

      if (jsonBlock.includes('```')) {
        jsonBlock = jsonBlock.replace(/```(?:json)?/gi, '').replace(/```/g, '').trim();
      }

      const fb = jsonBlock.indexOf('{');
      const lb = jsonBlock.lastIndexOf('}');
      if (fb !== -1 && lb !== -1) {
        jsonBlock = jsonBlock.substring(fb, lb + 1);
      }

      const cleaned = cleanJsonString(jsonBlock);
      if (!cleaned || !cleaned.startsWith('{')) continue;

      const graph = JSON.parse(cleaned) as GeoConstraintGraph;

      if (graph && (graph.constraints?.length > 0 || (graph.free_points && Object.keys(graph.free_points).length > 0))) {
        if (!graph.constraints) graph.constraints = [];
        return graph;
      }
    } catch (err) {
      console.warn('[geovizService] Thử parse khối JSON không thành công:', err);
    }
  }

  return null;
}
