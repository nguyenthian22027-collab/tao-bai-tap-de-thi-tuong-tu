// ============================================================
// geoviz/geovizPrompt.ts — Prompt AI trích xuất ràng buộc hình học 2D
// Điều chỉnh từ remix-geoviz-studio-V3/src/lib/geminiPrompt.ts (chỉ phần 2D)
// ============================================================

/**
 * Trả về system prompt yêu cầu AI phân tích đề bài hình học 2D
 * và trích xuất JSON ràng buộc nằm giữa ---GEOCONSTRAINTS---
 */
export function buildGeovizPrompt(questionText: string): string {
  const systemPrompt = `Bạn là chuyên gia toán học và hình học phẳng (2D) hàng đầu.
Nhiệm vụ: Phân tích đề bài toán hình học phẳng (2D) tiếng Việt và trích xuất CẤU TRÚC RÀNG BUỘC HÌNH HỌC dưới dạng JSON nằm giữa hai dòng phân cách ---GEOCONSTRAINTS---.

QUAN TRỌNG: Chỉ trả về JSON hợp lệ nằm giữa ---GEOCONSTRAINTS---. KHÔNG thêm bất kỳ giải thích nào khác.
(Bộ máy giải toán sẽ tự động tính toán tọa độ chính xác 100% từ các ràng buộc bạn định nghĩa.)

=== DANH SÁCH RÀNG BUỘC HỖ TRỢ ===

1. Đường tròn ngoại tiếp tam giác 3 điểm:
   { "type": "circumcircle", "circle_label": "O", "center_label": "O", "p1": "A", "p2": "B", "p3": "C" }

2. Đường tròn tâm O đi qua điểm A:
   { "type": "circle_from_center_and_point", "circle_label": "O", "center": "O", "through_point": "A" }

3. Đường tròn đường kính là đoạn thẳng p1p2:
   { "type": "circle_from_diameter", "circle_label": "O1", "center_label": "O1", "p1": "C", "p2": "D" }

4. Nửa đường tròn đường kính AB (phía trên):
   { "type": "semicircle", "circle_label": "O", "center_label": "O", "p1": "A", "p2": "B", "side": "upper" }

5. Tiếp tuyến tại A của đường tròn (O) cắt đường thẳng BC tại S:
   { "type": "tangent_line_intersection", "point": "S", "tangent_at": "A", "circle_label": "O", "line_p1": "B", "line_p2": "C" }

6. Dây cung song song: Đường qua A song song BC cắt (O) tại điểm thứ hai P:
   { "type": "circle_parallel_chord", "point": "P", "start_point": "A", "circle_label": "O", "line_p1": "B", "line_p2": "C" }

7. Giao điểm thứ hai của đường thẳng SK với (O) (biết K trên đường tròn):
   { "type": "line_circle_second_intersection", "point": "Q", "line_p1": "S", "line_p2": "K", "circle_label": "O", "known_point": "K" }

8. Tiếp điểm từ điểm ngoài S tới (O):
   { "type": "tangent_from_point", "tangent_point": "M", "from_point": "S", "circle_label": "O" }

9. Điểm đối xứng K của A qua tâm O (đường kính AK):
   { "type": "symmetric_point", "point": "K", "source": "A", "center": "O" }

10. Chân đường cao từ A xuống BC:
    { "type": "perpendicular_foot", "foot": "D", "from": "A", "line_p1": "B", "line_p2": "C" }

11. Trung điểm đoạn thẳng BC:
    { "type": "midpoint", "mid": "M", "p1": "B", "p2": "C" }

12. Trọng tâm tam giác ABC:
    { "type": "centroid", "point": "G", "p1": "A", "p2": "B", "p3": "C" }

13. Trực tâm tam giác ABC:
    { "type": "orthocenter", "point": "H", "p1": "A", "p2": "B", "p3": "C" }

14. Tâm đường tròn nội tiếp tam giác ABC:
    { "type": "incenter", "point": "I", "p1": "A", "p2": "B", "p3": "C" }

15. Giao điểm hai đường thẳng:
    { "type": "line_intersection", "point": "L", "l1_p1": "K", "l1_p2": "P", "l2_p1": "B", "l2_p2": "C" }

16. Điểm trên đường thẳng tại tỉ lệ t:
    { "type": "point_on_line", "point": "I", "line_p1": "A", "line_p2": "H", "t": 0.75 }

17. Chân đường phân giác góc A cắt cạnh BC:
    { "type": "angle_bisector", "point": "D", "vertex": "A", "arm1": "B", "arm2": "C", "target_line_p1": "B", "target_line_p2": "C" }

18. Điểm tạo đường song song từ C song song AB:
    { "type": "parallel_point", "point": "D", "from": "C", "line_p1": "A", "line_p2": "B", "length": 4 }

=== VÍ DỤ 1: Tam giác ABC nội tiếp (O), đường cao AD, tiếp tuyến AS, cát tuyến SK ===
Đề bài: Cho tam giác ABC nhọn nội tiếp đường tròn (O; R), đường cao AD. Vẽ đường kính AK, tiếp tuyến tại A cắt BC tại S.

---GEOCONSTRAINTS---
{
  "title": "Tam giác ABC nội tiếp (O), đường cao AD, tiếp tuyến AS, đường kính AK",
  "free_points": {
    "O": [0, 0],
    "A": [-1.2, 3.81],
    "B": [-3.8, -1.25],
    "C": [3.46, -2.0]
  },
  "constraints": [
    { "type": "circle_from_center_and_point", "circle_label": "O", "center": "O", "through_point": "A" },
    { "type": "perpendicular_foot", "foot": "D", "from": "A", "line_p1": "B", "line_p2": "C" },
    { "type": "symmetric_point", "point": "K", "source": "A", "center": "O" },
    { "type": "tangent_line_intersection", "point": "S", "tangent_at": "A", "circle_label": "O", "line_p1": "B", "line_p2": "C" }
  ],
  "segments": [
    { "from": "A", "to": "B" },
    { "from": "B", "to": "C" },
    { "from": "C", "to": "A" },
    { "from": "A", "to": "D" },
    { "from": "A", "to": "K", "style": "dashed" },
    { "from": "S", "to": "A" },
    { "from": "S", "to": "B" }
  ],
  "right_angles": [
    { "vertex": "D", "p1": "A", "p2": "B" },
    { "vertex": "A", "p1": "S", "p2": "O" }
  ]
}
---GEOCONSTRAINTS---

=== VÍ DỤ 2: Tam giác vuông có đường cao và trung tuyến ===
Đề bài: Cho tam giác ABC vuông tại A có AB=3, AC=4. Kẻ đường cao AH và trung tuyến AM.

---GEOCONSTRAINTS---
{
  "title": "Tam giác ABC vuông tại A có đường cao AH và trung tuyến AM",
  "free_points": {
    "A": [0, 0],
    "B": [0, 3],
    "C": [4, 0]
  },
  "constraints": [
    { "type": "perpendicular_foot", "foot": "H", "from": "A", "line_p1": "B", "line_p2": "C" },
    { "type": "midpoint", "mid": "M", "p1": "B", "p2": "C" }
  ],
  "segments": [
    { "from": "A", "to": "B" },
    { "from": "B", "to": "C" },
    { "from": "C", "to": "A" },
    { "from": "A", "to": "H" },
    { "from": "A", "to": "M", "style": "dashed" }
  ],
  "right_angles": [
    { "vertex": "A", "p1": "B", "p2": "C" },
    { "vertex": "H", "p1": "A", "p2": "B" }
  ]
}
---GEOCONSTRAINTS---

=== YÊU CẦU CHUNG ===
- Chọn tọa độ free_points sao cho hình vẽ đẹp, cân đối, không bị chồng chéo.
- Thường: Tâm đường tròn O ở gốc [0,0], bán kính khoảng 3-5 đơn vị.
- Đặt đúng style "dashed" cho các đường phụ (đường kính, bán kính phụ, đường kẻ từ tâm đến tiếp điểm...).
- Đặt đúng right_angles cho tất cả góc vuông quan trọng.

Bài toán cần phân tích:
"${questionText.trim()}"`;

  return systemPrompt;
}
