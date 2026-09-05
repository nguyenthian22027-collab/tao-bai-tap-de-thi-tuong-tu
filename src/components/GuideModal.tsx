import React from 'react';
import {
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  ExternalLink,
  KeyRound,
  ShieldCheck,
  X,
} from 'lucide-react';

interface GuideModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const apiSteps = [
  {
    step: '1',
    title: 'Đăng nhập Google AI Studio',
    action: 'Mở aistudio.google.com và đăng nhập đúng tài khoản Google sẽ sở hữu hạn mức/API key.',
    note: 'Tài khoản mới có thể được Google tạo sẵn project và API key sau khi chấp nhận điều khoản.',
  },
  {
    step: '2',
    title: 'Mở trang API Keys',
    action: 'Vào Dashboard → API keys, hoặc mở trực tiếp trang quản lý key bằng nút bên dưới.',
    note: 'Nếu chưa có key, chọn Create API key. Nếu đã có project, chọn đúng project muốn dùng.',
  },
  {
    step: '3',
    title: 'Chọn hoặc tạo project',
    action: 'Chọn project có sẵn hoặc tạo project mới theo hộp thoại của Google.',
    note: 'Nếu không thấy project Cloud hiện có, vào Dashboard → Projects → Import projects trước.',
  },
  {
    step: '4',
    title: 'Sao chép API key',
    action: 'Nhấn biểu tượng sao chép bên cạnh key và giữ key ở nơi riêng tư.',
    note: 'Không gửi key qua nhóm chat, không chụp ảnh màn hình có key và không dán key vào mã nguồn công khai.',
  },
  {
    step: '5',
    title: 'Thêm key vào ứng dụng',
    action: 'Trong ứng dụng, bấm Cài đặt Key → nhập tên gợi nhớ → dán key → Thêm & Test ngay.',
    note: 'Ứng dụng sẽ kiểm tra một yêu cầu nhỏ ngay lập tức. Chỉ dùng khi trạng thái là Hoạt động tốt.',
  },
  {
    step: '6',
    title: 'Kiểm tra và sẵn sàng tạo đề',
    action: 'Nếu có nhiều key, bấm Test tất cả rồi quay lại màn hình chính để nạp đề gốc.',
    note: 'Ứng dụng tự ưu tiên key hoạt động tốt và chuyển key khác khi gặp lỗi giới hạn hoặc key hỏng.',
  },
];

const appSteps = [
  ['Nạp đề gốc', 'Chọn Word, PDF, Ảnh, dán ảnh từ Clipboard hoặc dán văn bản. Kiểm tra lại nội dung trước khi tạo.'],
  ['Thiết lập đề', 'Chọn chế độ, độ tương tự, độ khó, số lượng câu, thời gian, điểm, năm học và tùy chọn hình TikZ.'],
  ['Tạo đề', 'Bấm Tạo đề tương tự và chờ AI hoàn tất. File ảnh/PDF có thể cần thêm thời gian để phân tích.'],
  ['Kiểm tra nội dung', 'Xem từng phần, bật đáp án khi cần, sửa trực tiếp câu hỏi/công thức và dùng Hỏi AI để tinh chỉnh.'],
  ['Lưu và xuất', 'Lưu vào Lịch sử, tạo mã đề A/B/C/D, hoặc xuất Word theo LaTeX, Word Equation (OMML) hay MathType.'],
];

const troubleshooting = [
  ['Chưa có API Key', 'Mở Cài đặt Key, thêm ít nhất một key rồi dùng Thêm & Test ngay.'],
  ['Không hợp lệ (400/401)', 'Kiểm tra đã dán đủ key, không có khoảng trắng thừa; thử tạo key mới trong AI Studio.'],
  ['Đạt giới hạn (403/429)', 'Chờ hạn mức khôi phục, kiểm tra Dashboard → Usage, hoặc thêm key khác thuộc project phù hợp.'],
  ['Tạo đề lỗi/rỗng', 'Kiểm tra nguồn đề có nội dung, giảm số trang/khối lượng mỗi lần, rồi thử lại với model nhẹ hơn.'],
  ['Mất key sau khi đổi máy/trình duyệt', 'Key được lưu theo trình duyệt hiện tại. Dán lại key trên thiết bị mới; không xóa dữ liệu trang nếu chưa lưu key an toàn.'],
  ['Nghi key bị lộ', 'Tạo key thay thế, cập nhật trong ứng dụng, kiểm tra hoạt động rồi vô hiệu hóa/xóa key cũ trên Google.'],
];

export const GuideModal: React.FC<GuideModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-fade-in no-print">
      <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-5xl w-full max-h-[92vh] flex flex-col overflow-hidden">
        <div className="px-5 sm:px-7 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900">Hướng dẫn sử dụng SimilarExam Studio</h2>
              <p className="text-xs text-slate-500">Làm theo bảng bên dưới, đặc biệt là phần lấy và bảo vệ Gemini API Key.</p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Đóng hướng dẫn"
            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 sm:p-7 overflow-y-auto space-y-7 flex-1 text-xs sm:text-sm">
          <section className="rounded-xl border border-indigo-200 bg-indigo-50/70 p-4">
            <div className="flex items-start gap-2.5">
              <ShieldCheck className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
              <div>
                <h3 className="font-bold text-indigo-950">Luồng sử dụng nhanh</h3>
                <p className="mt-1 text-indigo-900 leading-relaxed">
                  Lấy key tại Google AI Studio → thêm và test trong Cài đặt Key → nạp đề gốc → cấu hình → tạo đề → kiểm tra → xuất Word.
                </p>
              </div>
            </div>
          </section>

          <section>
            <div className="flex items-center justify-between gap-3 mb-3">
              <div>
                <h3 className="text-sm sm:text-base font-bold text-slate-900 flex items-center gap-2">
                  <KeyRound className="w-4 h-4 text-indigo-600" />
                  A. Lấy và thêm Google Gemini API Key
                </h3>
                <p className="text-xs text-slate-500 mt-1">Thực hiện lần lượt từ trên xuống dưới.</p>
              </div>
              <a
                href="https://aistudio.google.com/app/apikey"
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold transition-colors"
              >
                Mở trang API Keys <ExternalLink className="w-3 h-3" />
              </a>
            </div>
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full min-w-[720px] border-collapse">
                <thead className="bg-slate-50 text-left text-[11px] uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="p-3 w-12">Bước</th>
                    <th className="p-3 w-44">Việc cần làm</th>
                    <th className="p-3">Thao tác cụ thể</th>
                    <th className="p-3">Lưu ý</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {apiSteps.map((item) => (
                    <tr key={item.step} className="align-top hover:bg-slate-50/70">
                      <td className="p-3"><span className="inline-flex w-6 h-6 items-center justify-center rounded-full bg-indigo-100 text-indigo-700 font-bold">{item.step}</span></td>
                      <td className="p-3 font-semibold text-slate-800">{item.title}</td>
                      <td className="p-3 text-slate-700 leading-relaxed">{item.action}</td>
                      <td className="p-3 text-slate-500 leading-relaxed">{item.note}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-2 text-[11px] text-slate-500 leading-relaxed">
              <b>Phân biệt:</b> Gemini API Key dùng để tạo đề lấy từ Google AI Studio; không dán nhầm Firebase API Key trong mục Cấu hình Firebase.
            </p>
          </section>

          <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
              <h3 className="font-bold text-amber-950 flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-amber-600" /> Bảo mật API Key — cần nhớ</h3>
              <ul className="mt-2 space-y-2 text-amber-950 leading-relaxed list-disc pl-4">
                <li>Ứng dụng hiện gọi Gemini trực tiếp từ trình duyệt và lưu key trong bộ nhớ trình duyệt (localStorage); không dùng key thật trên máy dùng chung.</li>
                <li>Không đưa key vào GitHub, ảnh chụp, video hướng dẫn hoặc tin nhắn công khai.</li>
                <li>Nên tạo key riêng cho ứng dụng, giới hạn key chỉ cho Gemini API nếu Google hiển thị tùy chọn này, và theo dõi Usage để kiểm soát hạn mức/chi phí.</li>
                <li>Nếu key bị lộ, tạo key mới và vô hiệu hóa key cũ sau khi key mới đã test thành công.</li>
              </ul>
            </div>
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
              <h3 className="font-bold text-emerald-950 flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-600" /> Hiểu trạng thái key</h3>
              <div className="mt-2 space-y-2 text-emerald-950 leading-relaxed">
                <p><b>Hoạt động tốt:</b> đã gọi thử thành công và được ưu tiên sử dụng.</p>
                <p><b>Đang test:</b> ứng dụng đang kiểm tra key, không cần bấm lại.</p>
                <p><b>Đạt giới hạn lượt:</b> Google trả về 403/429; ứng dụng sẽ thử key khác nếu có.</p>
                <p><b>Không hợp lệ:</b> key sai, bị thu hồi, bị chặn hoặc project chưa sẵn sàng.</p>
                <p><b>Đã dùng:</b> số lần gọi thành công được ứng dụng ghi nhận để cân bằng việc chọn key.</p>
              </div>
            </div>
          </section>

          <section>
            <h3 className="text-sm sm:text-base font-bold text-slate-900 mb-3">B. Các bước tạo đề trong ứng dụng</h3>
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full min-w-[650px] border-collapse">
                <thead className="bg-slate-50 text-left text-[11px] uppercase tracking-wide text-slate-500">
                  <tr><th className="p-3 w-40">Giai đoạn</th><th className="p-3">Hướng dẫn</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {appSteps.map(([title, detail]) => (
                    <tr key={title} className="align-top hover:bg-slate-50/70"><td className="p-3 font-semibold text-slate-800">{title}</td><td className="p-3 text-slate-600 leading-relaxed">{detail}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section>
            <h3 className="text-sm sm:text-base font-bold text-slate-900 mb-3">C. Xử lý lỗi thường gặp</h3>
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full min-w-[720px] border-collapse">
                <thead className="bg-slate-50 text-left text-[11px] uppercase tracking-wide text-slate-500">
                  <tr><th className="p-3 w-52">Hiện tượng</th><th className="p-3">Cách xử lý</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {troubleshooting.map(([problem, solution]) => (
                    <tr key={problem} className="align-top hover:bg-slate-50/70"><td className="p-3 font-semibold text-slate-800">{problem}</td><td className="p-3 text-slate-600 leading-relaxed">{solution}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="pt-1 text-[11px] text-slate-500 leading-relaxed">
            Tham khảo cập nhật từ Google: <a className="text-indigo-600 hover:underline" href="https://ai.google.dev/gemini-api/docs/get-started" target="_blank" rel="noopener noreferrer">Getting started</a> và <a className="text-indigo-600 hover:underline" href="https://ai.google.dev/gemini-api/docs/api-key" target="_blank" rel="noopener noreferrer">Using Gemini API keys</a>.
          </section>
        </div>

        <div className="px-5 sm:px-7 py-3 bg-slate-50 border-t border-slate-100 flex justify-end">
          <button onClick={onClose} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-xs rounded-xl shadow-xs transition-colors cursor-pointer">Đã hiểu</button>
        </div>
      </div>
    </div>
  );
};
