import React, { useState, useEffect, useMemo } from 'react';
import { Question } from '../types';
import {
  X,
  ExternalLink,
  Download,
  CheckCircle,
  Copy,
  TrendingUp,
  Table,
  Layers,
  GitBranch,
  RefreshCw,
  Sparkles,
  Info,
} from 'lucide-react';
import {
  FunctionGraphParams,
  FunctionType,
  renderFunctionGraphToSvg,
  renderFunctionGraphToPng,
  generateTikzForFunction,
} from '../lib/functionGraphRenderer';
import {
  renderInequalitiesToSvg,
  renderInequalitiesToPng,
  InequalityPlotOptions,
} from '../lib/inequalityRenderer';
import {
  parseTreeDiagramText,
  renderTreeDiagramToSvg,
  renderTreeDiagramToPng,
} from '../lib/treeDiagramRenderer';
import {
  generateVariationTableSvg,
  ParsedTableData,
  svgStringToPngBase64,
} from '../lib/tableAndChartHelper';

interface MathStudioModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetQuestion?: Question | null;
  onApplyImageToQuestion?: (qId: string, pngBase64: string, tikzCode?: string) => void;
  onAddToast: (type: 'success' | 'error' | 'warning' | 'info', msg: string) => void;
}

type StudioTab = 'graph' | 'variation' | 'inequality' | 'tree';

export const MathStudioModal: React.FC<MathStudioModalProps> = ({
  isOpen,
  onClose,
  targetQuestion,
  onApplyImageToQuestion,
  onAddToast,
}) => {
  const [activeTab, setActiveTab] = useState<StudioTab>('graph');
  const [isExporting, setIsExporting] = useState(false);

  // ==========================================
  // TAB 1: ĐỒ THỊ HÀM SỐ
  // ==========================================
  const [graphType, setGraphType] = useState<FunctionType>('bac3');
  const [coeffA, setCoeffA] = useState<number>(1);
  const [coeffB, setCoeffB] = useState<number>(0);
  const [coeffC, setCoeffC] = useState<number>(-3);
  const [coeffD, setCoeffD] = useState<number>(1);
  const [coeffE, setCoeffE] = useState<number>(0);
  const [graphXMin, setGraphXMin] = useState<number>(-4.5);
  const [graphXMax, setGraphXMax] = useState<number>(4.5);
  const [graphYMin, setGraphYMin] = useState<number>(-4.5);
  const [graphYMax, setGraphYMax] = useState<number>(4.5);
  const [graphShowExtrema, setGraphShowExtrema] = useState<boolean>(true);
  const [graphShowAsymptotes, setGraphShowAsymptotes] = useState<boolean>(true);

  // Mẫu đồ thị có sẵn
  const graphPresets = [
    {
      name: 'Bậc 3: y = x³ - 3x + 1 (2 cực trị)',
      type: 'bac3' as FunctionType,
      a: 1,
      b: 0,
      c: -3,
      d: 1,
      xmin: -3.5,
      xmax: 3.5,
      ymin: -3.5,
      ymax: 4.5,
    },
    {
      name: 'Bậc 3: y = -x³ + 3x² - 2',
      type: 'bac3' as FunctionType,
      a: -1,
      b: 3,
      c: 0,
      d: -2,
      xmin: -2,
      xmax: 4,
      ymin: -4,
      ymax: 4,
    },
    {
      name: 'Bậc 4: y = x⁴ - 2x² - 1 (Chữ W)',
      type: 'bac4' as FunctionType,
      a: 1,
      b: -2,
      c: -1,
      d: 0,
      xmin: -2.5,
      xmax: 2.5,
      ymin: -3,
      ymax: 4,
    },
    {
      name: 'Bậc 4: y = -x⁴ + 2x² + 1 (Chữ M)',
      type: 'bac4' as FunctionType,
      a: -1,
      b: 2,
      c: 1,
      d: 0,
      xmin: -2.5,
      xmax: 2.5,
      ymin: -3,
      ymax: 3,
    },
    {
      name: 'Phân thức: y = (2x - 1)/(x + 1)',
      type: 'phanthuc11' as FunctionType,
      a: 2,
      b: -1,
      c: 1,
      d: 1,
      xmin: -5,
      xmax: 4,
      ymin: -4,
      ymax: 6,
    },
    {
      name: 'Phân thức: y = (x² - x + 1)/(x - 1)',
      type: 'phanthuc21' as FunctionType,
      a: 1,
      b: -1,
      c: 1,
      d: 1,
      e: -1,
      xmin: -4,
      xmax: 6,
      ymin: -4,
      ymax: 8,
    },
  ];

  const graphParams: FunctionGraphParams = useMemo(
    () => ({
      type: graphType,
      a: coeffA,
      b: coeffB,
      c: coeffC,
      d: coeffD,
      e: coeffE,
      xmin: graphXMin,
      xmax: graphXMax,
      ymin: graphYMin,
      ymax: graphYMax,
      showExtrema: graphShowExtrema,
      showAsymptotes: graphShowAsymptotes,
      showGrid: true,
      color: '#2563EB',
    }),
    [graphType, coeffA, coeffB, coeffC, coeffD, coeffE, graphXMin, graphXMax, graphYMin, graphYMax, graphShowExtrema, graphShowAsymptotes]
  );

  const graphSvg = useMemo(() => {
    try {
      return renderFunctionGraphToSvg(graphParams);
    } catch {
      return '';
    }
  }, [graphParams]);

  // ==========================================
  // TAB 2: BẢNG BIẾN THIÊN (BBT)
  // ==========================================
  const [bbtXRow, setBbtXRow] = useState<string>('-\\infty, -1, 1, +\\infty');
  const [bbtYPrimeRow, setBbtYPrimeRow] = useState<string>('+, 0, -, 0, +');
  const [bbtYRow, setBbtYRow] = useState<string>('-\\infty, 3, -1, +\\infty');

  const bbtPresets = [
    {
      name: 'Hàm bậc 3: 2 cực trị (CĐ x=-1, CT x=1)',
      x: '-\\infty, -1, 1, +\\infty',
      yPrime: '+, 0, -, 0, +',
      y: '-\\infty, 3, -1, +\\infty',
      graphPresetIdx: 0,
    },
    {
      name: 'Hàm bậc 3: Nghịch biến có 2 cực trị',
      x: '-\\infty, 0, 2, +\\infty',
      yPrime: '-, 0, +, 0, -',
      y: '+\\infty, -2, 2, -\\infty',
      graphPresetIdx: 1,
    },
    {
      name: 'Hàm bậc 4: 3 cực trị chữ W',
      x: '-\\infty, -1, 0, 1, +\\infty',
      yPrime: '-, 0, +, 0, -, 0, +',
      y: '+\\infty, -2, -1, -2, +\\infty',
      graphPresetIdx: 2,
    },
    {
      name: 'Phân thức: Tiệm cận đứng x=1',
      x: '-\\infty, 1, +\\infty',
      yPrime: '-, ||, -',
      y: '2, -\\infty, +\\infty, 2',
      graphPresetIdx: 4,
    },
  ];

  const bbtParsedTable: ParsedTableData = useMemo(() => {
    const xItems = bbtXRow.split(',').map((s) => s.trim()).filter(Boolean);
    const yPrimeItems = bbtYPrimeRow.split(',').map((s) => s.trim()).filter(Boolean);
    const yItems = bbtYRow.split(',').map((s) => s.trim()).filter(Boolean);

    return {
      headers: ['x', ...xItems],
      rows: [
        ["y'", ...yPrimeItems],
        ['y', ...yItems],
      ],
    };
  }, [bbtXRow, bbtYPrimeRow, bbtYRow]);

  const bbtSvg = useMemo(() => {
    try {
      return generateVariationTableSvg(bbtParsedTable) || '';
    } catch {
      return '';
    }
  }, [bbtParsedTable]);

  // ==========================================
  // TAB 3: MIỀN NGHIỆM BPT BẬC NHẤT (TOÁN 10)
  // ==========================================
  const [ineqText, setIneqText] = useState<string>(
    'x + y <= 4\n2x - y >= 1\nx >= 0\ny >= 0'
  );
  const [ineqXMin, setIneqXMin] = useState<number>(-1);
  const [ineqXMax, setIneqXMax] = useState<number>(6);
  const [ineqYMin, setIneqYMin] = useState<number>(-1);
  const [ineqYMax, setIneqYMax] = useState<number>(6);
  const [ineqReverseShading, setIneqReverseShading] = useState<boolean>(false);
  const [ineqShowIntersections, setIneqShowIntersections] = useState<boolean>(true);

  const ineqPresets = [
    {
      name: 'Tứ giác miền nghiệm (x, y ≥ 0; x + y ≤ 4; 2x - y ≥ 1)',
      text: 'x + y <= 4\n2x - y >= 1\nx >= 0\ny >= 0',
      xmin: -1,
      xmax: 5,
      ymin: -2,
      ymax: 5,
    },
    {
      name: 'Tam giác tối ưu lợi nhuận (x + 2y ≤ 6; 3x + y ≤ 9; x, y ≥ 0)',
      text: 'x + 2y <= 6\n3x + y <= 9\nx >= 0\ny >= 0',
      xmin: -1,
      xmax: 4,
      ymin: -1,
      ymax: 4,
    },
    {
      name: 'BPT đơn: 2x - 3y + 6 ≥ 0',
      text: '2x - 3y >= -6',
      xmin: -5,
      xmax: 4,
      ymin: -2,
      ymax: 5,
    },
    {
      name: 'Đa giác ngũ giác: x + y ≤ 5; x - y ≤ 2; x ≥ 0; y ≥ 0; y ≤ 3',
      text: 'x + y <= 5\nx - y <= 2\nx >= 0\ny >= 0\ny <= 3',
      xmin: -1,
      xmax: 6,
      ymin: -1,
      ymax: 5,
    },
  ];

  const ineqOptions: InequalityPlotOptions = useMemo(
    () => ({
      xmin: ineqXMin,
      xmax: ineqXMax,
      ymin: ineqYMin,
      ymax: ineqYMax,
      reverseShading: ineqReverseShading,
      showIntersections: ineqShowIntersections,
      showGrid: true,
      showLabels: true,
    }),
    [ineqXMin, ineqXMax, ineqYMin, ineqYMax, ineqReverseShading, ineqShowIntersections]
  );

  const ineqSvg = useMemo(() => {
    try {
      const lines = ineqText.split('\n').map((l) => l.trim()).filter(Boolean);
      return renderInequalitiesToSvg(lines, ineqOptions);
    } catch {
      return '';
    }
  }, [ineqText, ineqOptions]);

  // ==========================================
  // TAB 4: SƠ ĐỒ CÂY XÁC SUẤT (TOÁN 11-12)
  // ==========================================
  const [treeText, setTreeText] = useState<string>(
`Bắt đầu
  Hộp I | 0.6
    Bi trắng | 0.7
    Bi đỏ | 0.3
  Hộp II | 0.4
    Bi trắng | 0.5
    Bi đỏ | 0.5`
  );
  const [treeShowOutcome, setTreeShowOutcome] = useState<boolean>(true);

  const treePresets = [
    {
      name: 'Hai hộp đựng bi (Xác suất toàn phần & Bayes)',
      text: `Bắt đầu
  Hộp I | 0.6
    Bi trắng | 0.7
    Bi đỏ | 0.3
  Hộp II | 0.4
    Bi trắng | 0.5
    Bi đỏ | 0.5`,
    },
    {
      name: 'Xét nghiệm y tế (Bệnh và Kết quả Test)',
      text: `Dân số
  Nhiễm bệnh | 0.02
    Test Dương tính | 0.95
    Test Âm tính | 0.05
  Không nhiễm | 0.98
    Test Dương tính | 0.01
    Test Âm tính | 0.99`,
    },
    {
      name: 'Hai xạ thủ bắn bia độc lập',
      text: `Phát 1
  Trúng | 0.8
    Phát 2 Trúng | 0.7
    Phát 2 Trượt | 0.3
  Trượt | 0.2
    Phát 2 Trúng | 0.7
    Phát 2 Trượt | 0.3`,
    },
  ];

  const treeSvg = useMemo(() => {
    try {
      const root = parseTreeDiagramText(treeText);
      if (!root) return '';
      return renderTreeDiagramToSvg(root, { showOutcomeProb: treeShowOutcome });
    } catch {
      return '';
    }
  }, [treeText, treeShowOutcome]);

  // ==========================================
  // SVG HIỆN TẠI ĐANG XEM
  // ==========================================
  const currentActiveSvg = useMemo(() => {
    switch (activeTab) {
      case 'graph':
        return graphSvg;
      case 'variation':
        return bbtSvg;
      case 'inequality':
        return ineqSvg;
      case 'tree':
        return treeSvg;
      default:
        return '';
    }
  }, [activeTab, graphSvg, bbtSvg, ineqSvg, treeSvg]);

  // Áp dụng hình vào câu hỏi đang chọn
  const handleApplyToQuestion = async () => {
    if (!targetQuestion) {
      onAddToast('warning', 'Vui lòng chọn một câu hỏi cụ thể trước khi bấm Chèn vào đề!');
      return;
    }

    setIsExporting(true);
    try {
      let pngBase64 = '';
      let tikzCode: string | undefined;

      if (activeTab === 'graph') {
        pngBase64 = await renderFunctionGraphToPng(graphParams);
        tikzCode = generateTikzForFunction(graphParams);
      } else if (activeTab === 'variation') {
        if (bbtSvg) {
          pngBase64 = (await svgStringToPngBase64(bbtSvg)) || '';
        }
      } else if (activeTab === 'inequality') {
        const lines = ineqText.split('\n').map((l) => l.trim()).filter(Boolean);
        pngBase64 = await renderInequalitiesToPng(lines, ineqOptions);
      } else if (activeTab === 'tree') {
        const root = parseTreeDiagramText(treeText);
        if (root) {
          pngBase64 = await renderTreeDiagramToPng(root, { showOutcomeProb: treeShowOutcome });
        }
      }

      if (!pngBase64) {
        throw new Error('Không thể tạo ảnh PNG từ hình vẽ này.');
      }

      if (onApplyImageToQuestion) {
        onApplyImageToQuestion(targetQuestion.id, pngBase64, tikzCode);
      }

      onAddToast('success', `✓ Đã chèn hình vẽ thành công vào Câu ${targetQuestion.stt}!`);
      onClose();
    } catch (err: any) {
      onAddToast('error', `Lỗi chèn ảnh: ${err.message || 'Lỗi không xác định'}`);
    } finally {
      setIsExporting(false);
    }
  };

  // Tải ảnh PNG chất lượng cao
  const handleDownloadPng = async () => {
    if (!currentActiveSvg) return;
    setIsExporting(true);
    try {
      const pngBase64 = await svgStringToPngBase64(currentActiveSvg);
      if (!pngBase64) throw new Error('Không tạo được ảnh PNG');

      const a = document.createElement('a');
      a.href = pngBase64;
      a.download = `Hinh_Toan_${activeTab}_${Date.now()}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

      onAddToast('success', '✓ Đã tải ảnh PNG sắc nét về máy!');
    } catch (err: any) {
      onAddToast('error', `Lỗi tải ảnh: ${err.message}`);
    } finally {
      setIsExporting(false);
    }
  };

  // Sao chép SVG
  const handleCopySvg = () => {
    if (!currentActiveSvg) return;
    navigator.clipboard.writeText(currentActiveSvg);
    onAddToast('info', '✓ Đã sao chép mã SVG vào bộ nhớ đệm!');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-5xl max-h-[92vh] rounded-2xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-5 py-3.5 bg-gradient-to-r from-indigo-700 via-indigo-800 to-indigo-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 bg-white/10 rounded-xl">
              <TrendingUp className="w-5 h-5 text-indigo-200" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-base font-bold">Xưởng Vẽ Hình &amp; Bảng Toán (Math Studio)</h2>
                <span className="bg-amber-400 text-slate-900 text-[10px] font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider">
                  GDPT 2018
                </span>
              </div>
              <p className="text-xs text-indigo-200 mt-0.5">
                Vẽ đồ thị hàm số, bảng biến thiên, miền nghiệm BPT 10 &amp; sơ đồ cây xác suất 11-12
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <a
              href="https://aichanduc.github.io/chd-math-studio/"
              target="_blank"
              rel="noopener noreferrer"
              className="hidden sm:inline-flex items-center space-x-1 px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-lg text-xs font-semibold transition-colors border border-white/20"
              title="Mở ứng dụng trực tuyến gốc CHD Math Studio để trải nghiệm đầy đủ công cụ vẽ hình mở rộng"
            >
              <span>CHĐ Math Studio Web</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
            <button
              onClick={onClose}
              className="p-1.5 text-indigo-200 hover:text-white hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-200 bg-slate-50 px-4 pt-2 gap-1 text-xs font-semibold overflow-x-auto shrink-0">
          <button
            onClick={() => setActiveTab('graph')}
            className={`px-3 py-2 rounded-t-lg flex items-center space-x-1.5 border-b-2 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'graph'
                ? 'bg-white text-indigo-700 border-indigo-600 font-bold shadow-2xs'
                : 'text-slate-600 border-transparent hover:text-slate-900'
            }`}
          >
            <TrendingUp className="w-4 h-4 text-blue-600" />
            <span>1. Đồ thị hàm số</span>
          </button>

          <button
            onClick={() => setActiveTab('variation')}
            className={`px-3 py-2 rounded-t-lg flex items-center space-x-1.5 border-b-2 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'variation'
                ? 'bg-white text-indigo-700 border-indigo-600 font-bold shadow-2xs'
                : 'text-slate-600 border-transparent hover:text-slate-900'
            }`}
          >
            <Table className="w-4 h-4 text-purple-600" />
            <span>2. Bảng biến thiên</span>
          </button>

          <button
            onClick={() => setActiveTab('inequality')}
            className={`px-3 py-2 rounded-t-lg flex items-center space-x-1.5 border-b-2 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'inequality'
                ? 'bg-white text-indigo-700 border-indigo-600 font-bold shadow-2xs'
                : 'text-slate-600 border-transparent hover:text-slate-900'
            }`}
          >
            <Layers className="w-4 h-4 text-emerald-600" />
            <span>3. Miền nghiệm BPT (Lớp 10)</span>
          </button>

          <button
            onClick={() => setActiveTab('tree')}
            className={`px-3 py-2 rounded-t-lg flex items-center space-x-1.5 border-b-2 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'tree'
                ? 'bg-white text-indigo-700 border-indigo-600 font-bold shadow-2xs'
                : 'text-slate-600 border-transparent hover:text-slate-900'
            }`}
          >
            <GitBranch className="w-4 h-4 text-amber-600" />
            <span>4. Sơ đồ cây xác suất (Lớp 11-12)</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Cột trái: Bảng điều khiển tham số (5 cột) */}
          <div className="lg:col-span-5 space-y-4">
            {/* TAB 1: ĐỒ THỊ */}
            {activeTab === 'graph' && (
              <div className="space-y-3.5">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Loại hàm số:</label>
                  <select
                    value={graphType}
                    onChange={(e) => setGraphType(e.target.value as FunctionType)}
                    className="w-full text-xs px-2.5 py-1.5 border border-slate-300 rounded-lg bg-white"
                  >
                    <option value="bac3">Hàm bậc ba: y = ax³ + bx² + cx + d</option>
                    <option value="bac4">Hàm bậc bốn trùng phương: y = ax⁴ + bx² + c</option>
                    <option value="phanthuc11">Phân thức hữu tỉ bậc nhất: y = (ax + b)/(cx + d)</option>
                    <option value="phanthuc21">Phân thức bậc hai / bậc nhất: y = (ax² + bx + c)/(dx + e)</option>
                  </select>
                </div>

                {/* Chọn mẫu nhanh */}
                <div>
                  <label className="text-[11px] font-semibold text-slate-500 block mb-1">Mẫu có sẵn (Presets):</label>
                  <div className="grid grid-cols-1 gap-1.5 max-h-36 overflow-y-auto p-1 bg-slate-50 rounded-lg border border-slate-200">
                    {graphPresets.map((p, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => {
                          setGraphType(p.type);
                          setCoeffA(p.a);
                          setCoeffB(p.b);
                          setCoeffC(p.c);
                          setCoeffD(p.d ?? 0);
                          if (p.type === 'phanthuc21') setCoeffE(-1);
                          setGraphXMin(p.xmin);
                          setGraphXMax(p.xmax);
                          setGraphYMin(p.ymin);
                          setGraphYMax(p.ymax);
                        }}
                        className="text-left text-[11px] p-1.5 rounded hover:bg-indigo-50 hover:text-indigo-700 text-slate-700 transition-colors"
                      >
                        ⚡ {p.name}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Nhập hệ số */}
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                  <div className="text-xs font-bold text-slate-700">Hệ số phương trình:</div>
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div>
                      <span className="text-[11px] text-slate-500 font-semibold">a =</span>
                      <input
                        type="number"
                        step="0.5"
                        value={coeffA}
                        onChange={(e) => setCoeffA(parseFloat(e.target.value) || 0)}
                        className="w-full px-2 py-1 border border-slate-300 rounded bg-white mt-0.5"
                      />
                    </div>
                    <div>
                      <span className="text-[11px] text-slate-500 font-semibold">b =</span>
                      <input
                        type="number"
                        step="0.5"
                        value={coeffB}
                        onChange={(e) => setCoeffB(parseFloat(e.target.value) || 0)}
                        className="w-full px-2 py-1 border border-slate-300 rounded bg-white mt-0.5"
                      />
                    </div>
                    <div>
                      <span className="text-[11px] text-slate-500 font-semibold">c =</span>
                      <input
                        type="number"
                        step="0.5"
                        value={coeffC}
                        onChange={(e) => setCoeffC(parseFloat(e.target.value) || 0)}
                        className="w-full px-2 py-1 border border-slate-300 rounded bg-white mt-0.5"
                      />
                    </div>
                    {(graphType === 'bac3' || graphType === 'phanthuc11' || graphType === 'phanthuc21') && (
                      <div>
                        <span className="text-[11px] text-slate-500 font-semibold">d =</span>
                        <input
                          type="number"
                          step="0.5"
                          value={coeffD}
                          onChange={(e) => setCoeffD(parseFloat(e.target.value) || 0)}
                          className="w-full px-2 py-1 border border-slate-300 rounded bg-white mt-0.5"
                        />
                      </div>
                    )}
                    {graphType === 'phanthuc21' && (
                      <div>
                        <span className="text-[11px] text-slate-500 font-semibold">e =</span>
                        <input
                          type="number"
                          step="0.5"
                          value={coeffE}
                          onChange={(e) => setCoeffE(parseFloat(e.target.value) || 0)}
                          className="w-full px-2 py-1 border border-slate-300 rounded bg-white mt-0.5"
                        />
                      </div>
                    )}
                  </div>
                </div>

                {/* Tùy chọn hiển thị */}
                <div className="flex items-center space-x-4 text-xs font-medium text-slate-700">
                  <label className="flex items-center space-x-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={graphShowExtrema}
                      onChange={(e) => setGraphShowExtrema(e.target.checked)}
                      className="rounded text-indigo-600"
                    />
                    <span>Hiện cực trị &amp; tọa độ</span>
                  </label>
                  <label className="flex items-center space-x-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={graphShowAsymptotes}
                      onChange={(e) => setGraphShowAsymptotes(e.target.checked)}
                      className="rounded text-indigo-600"
                    />
                    <span>Hiện tiệm cận</span>
                  </label>
                </div>
              </div>
            )}

            {/* TAB 2: BẢNG BIẾN THIÊN */}
            {activeTab === 'variation' && (
              <div className="space-y-3.5">
                <div>
                  <label className="text-[11px] font-semibold text-slate-500 block mb-1">Mẫu BBT chuẩn SGK:</label>
                  <div className="grid grid-cols-1 gap-1.5 max-h-36 overflow-y-auto p-1 bg-slate-50 rounded-lg border border-slate-200">
                    {bbtPresets.map((p, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => {
                          setBbtXRow(p.x);
                          setBbtYPrimeRow(p.yPrime);
                          setBbtYRow(p.y);
                        }}
                        className="text-left text-[11px] p-1.5 rounded hover:bg-purple-50 hover:text-purple-700 text-slate-700 transition-colors"
                      >
                        📊 {p.name}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2 p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs">
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">
                      Hàng biến số x <span className="text-[10px] text-slate-400 font-normal">(ngăn cách bởi dấu phẩy):</span>
                    </label>
                    <input
                      type="text"
                      value={bbtXRow}
                      onChange={(e) => setBbtXRow(e.target.value)}
                      className="w-full px-2.5 py-1.5 border border-slate-300 rounded bg-white font-serif"
                    />
                  </div>

                  <div>
                    <label className="font-bold text-slate-700 block mb-1">
                      Hàng đạo hàm y' <span className="text-[10px] text-slate-400 font-normal">(dấu +, -, 0, ||):</span>
                    </label>
                    <input
                      type="text"
                      value={bbtYPrimeRow}
                      onChange={(e) => setBbtYPrimeRow(e.target.value)}
                      className="w-full px-2.5 py-1.5 border border-slate-300 rounded bg-white font-serif"
                    />
                  </div>

                  <div>
                    <label className="font-bold text-slate-700 block mb-1">
                      Hàng hàm số y <span className="text-[10px] text-slate-400 font-normal">(các giá trị cực trị và vô cực):</span>
                    </label>
                    <input
                      type="text"
                      value={bbtYRow}
                      onChange={(e) => setBbtYRow(e.target.value)}
                      className="w-full px-2.5 py-1.5 border border-slate-300 rounded bg-white font-serif"
                    />
                  </div>
                </div>

                <div className="p-2.5 bg-purple-50/70 border border-purple-200 rounded-lg text-[11px] text-purple-900 leading-relaxed flex items-start gap-2">
                  <Info className="w-4 h-4 text-purple-600 shrink-0 mt-0.5" />
                  <span>
                    Hệ thống tự động nối các đường mũi tên biến thiên vector ↗ ↘ liền mạch và tính toán độ dốc cực đại / cực tiểu chuẩn quy cách Bộ GD&amp;ĐT.
                  </span>
                </div>
              </div>
            )}

            {/* TAB 3: MIỀN NGHIỆM BPT */}
            {activeTab === 'inequality' && (
              <div className="space-y-3.5">
                <div>
                  <label className="text-[11px] font-semibold text-slate-500 block mb-1">Mẫu bài toán tối ưu:</label>
                  <div className="grid grid-cols-1 gap-1.5 max-h-36 overflow-y-auto p-1 bg-slate-50 rounded-lg border border-slate-200">
                    {ineqPresets.map((p, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => {
                          setIneqText(p.text);
                          setIneqXMin(p.xmin);
                          setIneqXMax(p.xmax);
                          setIneqYMin(p.ymin);
                          setIneqYMax(p.ymax);
                        }}
                        className="text-left text-[11px] p-1.5 rounded hover:bg-emerald-50 hover:text-emerald-700 text-slate-700 transition-colors"
                      >
                        📐 {p.name}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Nhập hệ bất phương trình <span className="text-[10px] text-slate-400 font-normal">(mỗi dòng 1 BPT):</span>
                  </label>
                  <textarea
                    rows={4}
                    value={ineqText}
                    onChange={(e) => setIneqText(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-mono border border-slate-300 rounded-lg bg-white leading-relaxed"
                  />
                </div>

                {/* Tùy chọn gạch sọc */}
                <div className="space-y-2 p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs">
                  <div className="font-bold text-slate-700">Tùy chọn quy cách vẽ:</div>
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={ineqReverseShading}
                      onChange={(e) => setIneqReverseShading(e.target.checked)}
                      className="rounded text-emerald-600"
                    />
                    <span>Gạch miền nghiệm (Mặc định: Gạch bỏ phần không thỏa - chuẩn SGK)</span>
                  </label>

                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={ineqShowIntersections}
                      onChange={(e) => setIneqShowIntersections(e.target.checked)}
                      className="rounded text-emerald-600"
                    />
                    <span>Tự động giải và đánh dấu các đỉnh (A, B, C...)</span>
                  </label>
                </div>
              </div>
            )}

            {/* TAB 4: SƠ ĐỒ CÂY XÁC SUẤT */}
            {activeTab === 'tree' && (
              <div className="space-y-3.5">
                <div>
                  <label className="text-[11px] font-semibold text-slate-500 block mb-1">Mẫu bài toán xác suất:</label>
                  <div className="grid grid-cols-1 gap-1.5 max-h-36 overflow-y-auto p-1 bg-slate-50 rounded-lg border border-slate-200">
                    {treePresets.map((p, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setTreeText(p.text)}
                        className="text-left text-[11px] p-1.5 rounded hover:bg-amber-50 hover:text-amber-700 text-slate-700 transition-colors"
                      >
                        🌳 {p.name}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Cấu trúc cây <span className="text-[10px] text-slate-400 font-normal">(thụt lề tab/khoảng trắng, tách xác suất bằng | ):</span>
                  </label>
                  <textarea
                    rows={7}
                    value={treeText}
                    onChange={(e) => setTreeText(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-mono border border-slate-300 rounded-lg bg-white leading-relaxed"
                  />
                </div>

                <label className="flex items-center space-x-2 text-xs font-medium text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={treeShowOutcome}
                    onChange={(e) => setTreeShowOutcome(e.target.checked)}
                    className="rounded text-amber-600"
                  />
                  <span>Hiển thị cột tích xác suất cuối mỗi nhánh (Công thức xác suất toàn phần)</span>
                </label>
              </div>
            )}
          </div>

          {/* Cột phải: Khung hiển thị xem trước trực quan (7 cột) */}
          <div className="lg:col-span-7 flex flex-col space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700 flex items-center space-x-1.5">
                <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                <span>Xem trước kết quả trực quan (Vector SVG):</span>
              </span>
              <button
                type="button"
                onClick={handleCopySvg}
                className="text-[11px] text-slate-600 hover:text-indigo-600 flex items-center space-x-1 cursor-pointer"
              >
                <Copy className="w-3 h-3" />
                <span>Sao chép SVG</span>
              </button>
            </div>

            {/* Container hiển thị SVG */}
            <div className="flex-1 min-h-[360px] bg-white border border-slate-200 rounded-xl p-3 flex items-center justify-center overflow-auto shadow-2xs">
              {currentActiveSvg ? (
                <div
                  className="max-w-full max-h-full flex items-center justify-center select-none"
                  dangerouslySetInnerHTML={{ __html: currentActiveSvg }}
                />
              ) : (
                <div className="text-xs text-slate-400 italic text-center">
                  Không thể tạo hình ảnh từ tham số hiện tại. Vui lòng kiểm tra lại số liệu.
                </div>
              )}
            </div>

            {targetQuestion && (
              <div className="p-2.5 bg-indigo-50/70 border border-indigo-200 rounded-lg text-xs text-indigo-900 flex items-center justify-between">
                <span>
                  Đang thao tác cho: <strong className="font-bold">Câu {targetQuestion.stt}</strong>
                </span>
                <span className="text-[11px] text-indigo-600 italic">
                  (Nhấn &quot;Chèn vào câu hỏi này&quot; để nhúng trực tiếp)
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
          >
            Đóng
          </button>

          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={handleDownloadPng}
              disabled={!currentActiveSvg || isExporting}
              className="px-3.5 py-2 text-xs font-bold text-slate-700 bg-white hover:bg-slate-100 border border-slate-300 rounded-xl transition-colors cursor-pointer flex items-center space-x-1.5 disabled:opacity-50"
              title="Tải ảnh PNG độ nét cao (300 DPI) để chèn vào bất cứ tài liệu nào"
            >
              <Download className="w-3.5 h-3.5 text-slate-600" />
              <span>Tải PNG 300 DPI</span>
            </button>

            {targetQuestion && (
              <button
                type="button"
                onClick={handleApplyToQuestion}
                disabled={!currentActiveSvg || isExporting}
                className="px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-colors cursor-pointer flex items-center space-x-1.5 shadow-xs disabled:opacity-50"
              >
                {isExporting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle className="w-3.5 h-3.5" />}
                <span>📌 Chèn vào Câu {targetQuestion.stt}</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
