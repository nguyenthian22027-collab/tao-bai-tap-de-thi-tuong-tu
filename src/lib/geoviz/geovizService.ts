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

  // === Parse JSON từ ---GEOCONSTRAINTS--- ===
  const graph = parseGeoConstraintsFromText(rawResponse);

  if (!graph) {
    // Fallback: không phải hình phẳng 2D hoặc AI không trả về đúng format
    throw new Error(
      'AI không nhận ra cấu trúc hình học 2D trong bài toán này. ' +
      'Bài toán có thể là hình không gian 3D hoặc không phải hình học phẳng. ' +
      'Hãy thử nút "Sinh TikZ AI" thông thường.'
    );
  }

  // === PHA 2: Giải tọa độ chính xác ===
  const shapeData = solveGeometryGraph(graph);

  if (shapeData.points.length === 0) {
    throw new Error(
      'Bộ máy giải hình học không tính được tọa độ các điểm. ' +
      'AI có thể đã trích xuất sai cấu trúc ràng buộc. ' +
      'Hãy thử nút "Sinh TikZ AI" thông thường.'
    );
  }

  // === PHA 3: Sinh mã TikZ chuẩn ===
  const tikzCode = generateGeovizTikz(shapeData);

  return {
    tikzCode,
    shapeData,
    method: 'geoviz',
    message: `✅ Đã vẽ bằng GeoViz AI — ${shapeData.points.length} điểm, tọa độ chính xác 100%`,
  };
}

/**
 * Parse JSON ràng buộc hình học từ text trả về của AI.
 * Tìm JSON nằm giữa hai dòng ---GEOCONSTRAINTS---
 */
function parseGeoConstraintsFromText(rawText: string): GeoConstraintGraph | null {
  // Tìm khối ---GEOCONSTRAINTS---
  const markerRegex = /---GEOCONSTRAINTS---([\s\S]*?)---GEOCONSTRAINTS---/;
  const markerMatch = rawText.match(markerRegex);

  let jsonStr = '';

  if (markerMatch && markerMatch[1]) {
    jsonStr = markerMatch[1].trim();
  } else {
    // Fallback: tìm khối JSON bất kỳ trong text
    const jsonBlockRegex = /```(?:json)?\s*([\s\S]*?)```/;
    const blockMatch = rawText.match(jsonBlockRegex);
    if (blockMatch && blockMatch[1]) {
      jsonStr = blockMatch[1].trim();
    } else {
      // Thử tìm dấu { ... } trực tiếp
      const rawJsonMatch = rawText.match(/(\{[\s\S]*\})/);
      if (rawJsonMatch && rawJsonMatch[1]) {
        jsonStr = rawJsonMatch[1].trim();
      }
    }
  }

  if (!jsonStr) return null;

  try {
    const parsed = JSON.parse(jsonStr) as GeoConstraintGraph;
    // Kiểm tra cấu trúc tối thiểu
    if (!parsed.constraints && !parsed.free_points) return null;
    if (!parsed.constraints) parsed.constraints = [];
    return parsed;
  } catch (e) {
    console.error('[GeoViz] JSON parse error:', e, '\nRaw:', jsonStr.substring(0, 200));
    return null;
  }
}
