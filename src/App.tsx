/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import { 
  LayoutDashboard, 
  Activity, 
  History, 
  Settings, 
  Bell, 
  User, 
  Download, 
  UploadCloud, 
  CheckCircle2, 
  AlertTriangle, 
  XCircle,
  Database,
  Cpu,
  ArrowRight,
  Search,
  ChevronDown,
  FileText,
  Mail,
  Clock,
  Loader2
} from 'lucide-react';
import { analyzeADDMReport, AnalysisResult } from './services/geminiService';

// --- MOCK DATA ---
const RECENT_LOGS = [
  { id: 'FIN_PROD_01', score: 98, issues: 2, status: 'healthy' },
  { id: 'HR_LEGACY', score: 62, issues: 14, status: 'warning' },
  { id: 'SALES_DW', score: 84, issues: 5, status: 'healthy' },
  { id: 'CRM_CLUSTER', score: 91, issues: 1, status: 'healthy' },
];

const RECENT_SUBMISSIONS = [
  { id: 'ORCL_FIN_PRIMARY', time: '10 mins ago', status: 'Completed', score: 92 },
  { id: 'DW_HADOOP_STAGING', time: 'Vừa xong', status: 'Đang phân tích...', score: null },
  { id: 'CRM_PROD_SHADOW', time: 'Chờ xử lý', status: 'Chờ xử lý', score: null },
];

const MOCK_FINDINGS = [
  { id: 1, type: 'warning' as const, title: 'Top SQL Statements causing high I/O', impact: '14.2% DB Time', rec: 'Kiểm tra execution plans cho SQL IDs: 8x9y7z, 1a2b3c. Cân nhắc thêm index trên các cột thường xuyên truy vấn.', details: 'Câu lệnh SQL 8x9y7z đang thực hiện Full Table Scan trên bảng TRANSACTIONS với hơn 50 triệu bản ghi. Việc thiếu index trên cột TRANSACTION_DATE dẫn đến việc đọc một lượng lớn dữ liệu từ đĩa vào buffer cache, gây ra sự kiện chờ "db file scattered read".' },
  { id: 2, type: 'error' as const, title: 'Undersized Buffer Cache', impact: '28.5% DB Time', rec: 'Tăng DB_CACHE_SIZE thêm ít nhất 2GB để giảm physical reads.', details: 'Tỷ lệ Buffer Cache Hit Ratio hiện tại chỉ đạt 82%, thấp hơn nhiều so với mức khuyến nghị (>95%). Điều này cho thấy buffer cache quá nhỏ để chứa working set của ứng dụng, dẫn đến việc các block dữ liệu liên tục bị đẩy ra và đọc lại từ đĩa. Sự kiện chờ "free buffer waits" cũng đang tăng cao.' },
  { id: 3, type: 'healthy' as const, title: 'CPU Usage Normal', impact: 'N/A', rec: 'Phân bổ CPU hiện tại đủ cho khối lượng công việc.', details: 'Hệ thống hiện đang sử dụng trung bình 35% CPU, với các đỉnh điểm (peaks) không vượt quá 65%. Không có hiện tượng thắt nút cổ chai (bottleneck) về CPU. Hàng đợi CPU (run queue) duy trì ở mức thấp, cho thấy các tiến trình không phải chờ đợi lâu để được cấp phát CPU.' },
];

const MOCK_DETAILED_ANALYSIS = `
## Đánh giá Tổng quan Hệ thống
Hệ thống cơ sở dữ liệu đang hoạt động dưới mức tải trung bình, tuy nhiên có một số thời điểm xuất hiện các đỉnh tải (spikes) gây ảnh hưởng đến hiệu năng tổng thể.

### Phân tích Nút thắt cổ chai (Bottlenecks)
1. **I/O Subsystem**: Đây là nút thắt cổ chai chính, chiếm hơn 60% tổng thời gian DB Time.
2. **Memory (SGA)**: Buffer Cache đang có dấu hiệu quá tải.

### Kế hoạch Hành động (Action Plan)
* **Ngay lập tức**: Tạo index cho bảng \`TRANSACTIONS\`.
* **Ngắn hạn**: Tăng kích thước \`DB_CACHE_SIZE\`.
* **Dài hạn**: Đánh giá lại kiến trúc lưu trữ (Storage Architecture).
`;

// --- COMPONENTS ---

const TopBar = () => (
  <header className="fixed top-0 left-64 right-0 h-16 bg-surface/80 backdrop-blur-md z-40 flex items-center justify-between px-8 print:hidden">
    <div className="flex items-center gap-4">
      <div className="w-8 h-8 rounded-full bg-primary-container flex items-center justify-center text-on-primary-container font-bold">
        SA
      </div>
      <h1 className="text-lg font-semibold text-on-surface tracking-tight">The Sovereign Architect</h1>
    </div>
    <div className="flex items-center gap-4">
      <button className="p-2 rounded-full hover:bg-surface-container transition-colors text-on-surface-variant">
        <Bell size={20} />
      </button>
      <button className="p-2 rounded-full hover:bg-surface-container transition-colors text-on-surface-variant">
        <User size={20} />
      </button>
    </div>
  </header>
);

const SideNav = ({ activeTab, setActiveTab }: { activeTab: string, setActiveTab: (t: string) => void }) => {
  const navItems = [
    { id: 'dashboard', icon: LayoutDashboard, label: 'Bảng điều khiển' },
    { id: 'analysis', icon: Activity, label: 'Phân tích' },
    { id: 'history', icon: History, label: 'Lịch sử' },
    { id: 'settings', icon: Settings, label: 'Cài đặt' },
  ];

  return (
    <aside className="fixed top-0 left-0 bottom-0 w-64 bg-surface-container-lowest z-50 flex flex-col border-r border-surface-container/50 print:hidden">
      <div className="p-6">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-tertiary flex items-center justify-center text-white font-bold text-xl shadow-lg shadow-primary/20">
            A
          </div>
          <div>
            <h2 className="text-sm font-semibold text-on-surface">Admin User</h2>
            <p className="text-xs text-on-surface-variant">DBA Team Lead</p>
          </div>
        </div>
        
        <button 
          onClick={() => setActiveTab('analysis')}
          className="w-full py-3 px-4 rounded-2xl bg-gradient-to-r from-primary to-primary-dim text-white font-medium flex items-center justify-center gap-2 hover:shadow-lg hover:shadow-primary/30 transition-all mb-8"
        >
          <Activity size={18} />
          Chạy ADDM Mới
        </button>

        <nav className="space-y-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id || (activeTab === 'detail' && item.id === 'history');
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl transition-all ${
                  isActive 
                    ? 'bg-primary-container text-on-primary-container font-medium' 
                    : 'text-on-surface-variant hover:bg-surface-container hover:text-on-surface'
                }`}
              >
                <Icon size={20} className={isActive ? 'text-primary' : ''} />
                {item.label}
              </button>
            );
          })}
        </nav>
      </div>
      
      <div className="mt-auto p-6">
        <div className="text-xs text-on-surface-variant space-y-3">
          <a href="#" className="block hover:text-primary transition-colors">Hỗ trợ</a>
          <a href="#" className="block hover:text-primary transition-colors">Tài liệu hướng dẫn</a>
          <p className="opacity-50 pt-2">v2.4.1 Enterprise</p>
        </div>
      </div>
    </aside>
  );
};

// --- VIEWS ---

const DashboardView = ({ onNavigate }: { onNavigate: (view: string) => void }) => (
  <motion.div 
    initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
    className="space-y-6"
  >
    <div className="flex justify-between items-end mb-8">
      <div>
        <h2 className="text-3xl font-bold text-on-surface tracking-tight">Tổng quan Kiến trúc</h2>
        <p className="text-on-surface-variant mt-1">Hệ thống đang hoạt động ổn định. Đã phân tích 12 báo cáo hôm nay.</p>
      </div>
      <button className="px-4 py-2 rounded-full bg-surface-container-high text-on-surface font-medium flex items-center gap-2 hover:bg-surface-container-highest transition-colors">
        <Download size={18} />
        Xuất Tóm tắt
      </button>
    </div>

    {/* Top Stats Grid */}
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
      <div className="bg-surface-container-lowest p-6 rounded-3xl shadow-sm">
        <p className="text-sm font-medium text-on-surface-variant mb-2">Báo cáo đã xử lý</p>
        <p className="text-4xl font-bold text-on-surface">1,284</p>
        <p className="text-xs text-tertiary mt-2 flex items-center gap-1"><ArrowRight size={12} className="-rotate-45"/> +12% tuần này</p>
      </div>
      <div className="bg-surface-container-lowest p-6 rounded-3xl shadow-sm">
        <p className="text-sm font-medium text-on-surface-variant mb-2">DB đang giám sát</p>
        <p className="text-4xl font-bold text-on-surface">42</p>
        <p className="text-xs text-on-surface-variant mt-2">Trên 3 trung tâm dữ liệu</p>
      </div>
      <div className="bg-surface-container-lowest p-6 rounded-3xl shadow-sm">
        <p className="text-sm font-medium text-on-surface-variant mb-2">Điểm Sức khỏe (TB)</p>
        <div className="flex items-baseline gap-2">
          <p className="text-4xl font-bold text-tertiary">94</p>
          <p className="text-sm text-on-surface-variant">/100</p>
        </div>
        <div className="w-full h-1.5 bg-surface-container mt-3 rounded-full overflow-hidden">
          <div className="h-full bg-tertiary w-[94%] rounded-full"></div>
        </div>
      </div>
      <button 
        onClick={() => onNavigate('analysis')}
        className="bg-primary-container p-6 rounded-3xl flex flex-col justify-center items-center text-center hover:bg-primary-container/80 transition-colors group cursor-pointer shadow-sm"
      >
        <div className="w-12 h-12 rounded-full bg-primary text-white flex items-center justify-center mb-3 group-hover:scale-110 transition-transform shadow-md shadow-primary/20">
          <UploadCloud size={24} />
        </div>
        <p className="font-semibold text-on-primary-container">Tải lên ADDM</p>
        <p className="text-xs text-on-primary-container/70 mt-1">Phân tích báo cáo mới</p>
      </button>
    </div>

    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
      {/* Recent Logs */}
      <div className="lg:col-span-2 space-y-4">
        <h3 className="text-lg font-semibold text-on-surface">Nhật ký Phân tích Gần đây</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {RECENT_LOGS.map((log) => (
            <div 
              key={log.id} 
              onClick={() => onNavigate('detail')}
              className="bg-surface-container-lowest p-5 rounded-3xl cursor-pointer hover:bg-surface-container-low transition-colors shadow-sm border border-transparent hover:border-surface-container"
            >
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-2">
                  <Database size={18} className="text-primary" />
                  <span className="font-medium text-on-surface">{log.id}</span>
                </div>
                {log.status === 'healthy' ? (
                  <CheckCircle2 size={20} className="text-tertiary" />
                ) : (
                  <AlertTriangle size={20} className="text-error" />
                )}
              </div>
              <div className="flex justify-between items-end">
                <div>
                  <p className="text-3xl font-bold text-on-surface">{log.score}</p>
                  <p className="text-xs text-on-surface-variant">Điểm Sức khỏe</p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-semibold text-on-surface">{log.issues}</p>
                  <p className="text-xs text-on-surface-variant">Vấn đề</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Expert Insight */}
      <div className="bg-inverse-surface text-inverse-on-surface p-6 rounded-3xl flex flex-col shadow-lg">
        <div className="flex items-center gap-2 mb-4 text-tertiary-container">
          <Cpu size={20} />
          <h3 className="font-semibold text-surface-container-lowest">Góc nhìn Chuyên gia</h3>
        </div>
        <p className="text-sm leading-relaxed mb-6">
          Dựa trên 42 báo cáo gần đây, chúng tôi nhận thấy xu hướng tăng 15% trong thời gian chờ I/O trên cụm HR_LEGACY. Khuyến nghị kiểm tra cấu hình SAN hoặc xem xét chuyển sang lưu trữ NVMe cho các tablespace có tần suất truy cập cao.
        </p>
        <button 
          onClick={() => onNavigate('detail')}
          className="mt-auto w-full py-3 rounded-2xl bg-surface-container-lowest/10 hover:bg-surface-container-lowest/20 transition-colors text-surface-container-lowest font-medium text-sm"
        >
          Xem Báo cáo Chi tiết
        </button>
      </div>
    </div>
  </motion.div>
);

const AnalysisView = ({ onAnalysisComplete }: { onAnalysisComplete: (result: AnalysisResult, instanceName: string) => void }) => {
  const [file, setFile] = useState<File | null>(null);
  const [instanceName, setInstanceName] = useState('');
  const [notes, setNotes] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0]);
    }
  };

  const handleAnalyze = async () => {
    if (!file) {
      alert("Vui lòng chọn một tệp báo cáo ADDM.");
      return;
    }

    setIsAnalyzing(true);
    try {
      const text = await file.text();
      const result = await analyzeADDMReport(text, instanceName, notes);
      onAnalysisComplete(result, instanceName || file.name);
    } catch (error) {
      console.error(error);
      alert("Có lỗi xảy ra khi phân tích báo cáo. Vui lòng kiểm tra console.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
      className="max-w-4xl mx-auto"
    >
      <div className="mb-8 text-center">
        <h2 className="text-3xl font-bold text-on-surface tracking-tight">Phân tích Báo cáo ADDM</h2>
        <p className="text-on-surface-variant mt-2">Tải lên tệp văn bản báo cáo ADDM của bạn để công cụ AI của chúng tôi phân tích chuyên sâu.</p>
      </div>

      <div className="bg-surface-container-lowest rounded-[2rem] p-8 shadow-sm relative overflow-hidden">
        {isAnalyzing && (
          <div className="absolute inset-0 bg-surface/60 backdrop-blur-sm z-10 flex flex-col items-center justify-center">
            <Loader2 className="w-12 h-12 text-primary animate-spin mb-4" />
            <h3 className="text-xl font-semibold text-on-surface">AI đang phân tích...</h3>
            <p className="text-on-surface-variant mt-2">Vui lòng đợi trong giây lát, chúng tôi đang đọc báo cáo của bạn.</p>
          </div>
        )}

        {/* Upload Area */}
        <input 
          type="file" 
          accept=".txt,.out" 
          className="hidden" 
          ref={fileInputRef} 
          onChange={handleFileChange}
        />
        <div 
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-3xl p-12 flex flex-col items-center justify-center text-center transition-all cursor-pointer group mb-8 ${
            file ? 'border-primary bg-primary-container/10' : 'border-outline-variant/50 bg-surface-container-low/30 hover:bg-primary-container/20 hover:border-primary/30'
          }`}
        >
          <div className="w-16 h-16 rounded-full bg-surface-container-high flex items-center justify-center text-primary mb-4 group-hover:scale-110 transition-transform">
            {file ? <FileText size={32} /> : <UploadCloud size={32} />}
          </div>
          <h3 className="text-lg font-semibold text-on-surface mb-1">
            {file ? file.name : 'Thả Báo cáo ADDM vào đây'}
          </h3>
          <p className="text-sm text-on-surface-variant">
            {file ? `${(file.size / 1024).toFixed(1)} KB` : 'hoặc nhấp để duyệt tệp (.txt, .out)'}
          </p>
        </div>

        {/* Form */}
        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-on-surface mb-2">Instance Cơ sở dữ liệu (Tùy chọn)</label>
            <input 
              type="text" 
              value={instanceName}
              onChange={(e) => setInstanceName(e.target.value)}
              placeholder="VD: ORCL_PROD_01" 
              className="w-full bg-surface-container-low border-none rounded-2xl px-4 py-3 text-on-surface focus:ring-2 focus:ring-primary/20 outline-none transition-all"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-on-surface mb-2">Phạm vi Phân tích / Ghi chú (Tùy chọn)</label>
            <textarea 
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Tập trung vào các vấn đề I/O hoặc các câu lệnh SQL cụ thể..." 
              className="w-full bg-surface-container-low border-none rounded-2xl px-4 py-3 text-on-surface focus:ring-2 focus:ring-primary/20 outline-none transition-all resize-none"
            ></textarea>
          </div>
          
          <button 
            onClick={handleAnalyze}
            disabled={!file || isAnalyzing}
            className={`w-full py-4 rounded-2xl font-semibold text-lg transition-all flex items-center justify-center gap-2 ${
              !file || isAnalyzing 
                ? 'bg-surface-container-high text-on-surface-variant cursor-not-allowed' 
                : 'bg-gradient-to-r from-primary to-primary-dim text-white hover:shadow-lg hover:shadow-primary/30'
            }`}
          >
            <Activity size={20} />
            Bắt đầu Phân tích Kiến trúc
          </button>
        </div>
      </div>

      {/* Recent Submissions */}
      <div className="mt-12">
        <h3 className="text-lg font-semibold text-on-surface mb-4">Các yêu cầu gần đây</h3>
        <div className="bg-surface-container-lowest rounded-3xl overflow-hidden shadow-sm">
          {RECENT_SUBMISSIONS.map((sub, idx) => (
            <div key={idx} className={`flex items-center justify-between p-4 ${idx !== RECENT_SUBMISSIONS.length - 1 ? 'border-b border-surface-container' : ''}`}>
              <div className="flex items-center gap-4">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                  sub.status === 'Completed' ? 'bg-tertiary-container text-on-tertiary-container' : 
                  sub.status === 'Chờ xử lý' ? 'bg-surface-container-high text-on-surface-variant' : 
                  'bg-primary-container text-primary animate-pulse'
                }`}>
                  {sub.status === 'Completed' ? <CheckCircle2 size={20} /> : <Clock size={20} />}
                </div>
                <div>
                  <p className="font-medium text-on-surface">{sub.id}</p>
                  <p className="text-xs text-on-surface-variant">{sub.time}</p>
                </div>
              </div>
              <div className="text-right">
                {sub.score ? (
                  <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-tertiary-container/50 text-tertiary-dim text-xs font-semibold">
                    Điểm: {sub.score}
                  </span>
                ) : (
                  <span className="text-sm text-on-surface-variant">{sub.status}</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  );
};

const ReportDetailView = ({ onNavigate, data, instanceName }: { onNavigate: (view: string) => void, data: AnalysisResult | null, instanceName: string }) => {
  const reportRef = useRef<HTMLDivElement>(null);
  
  // Sử dụng dữ liệu thực tế nếu có, ngược lại dùng dữ liệu mẫu
  const score = data?.score || 70;
  
  const unescapeText = (text: string) => {
    if (!text) return "";
    return text.replace(/\\n/g, '\n').replace(/\\t/g, '\t').replace(/\\"/g, '"');
  };

  const summary = unescapeText(data?.summary || "Báo cáo ADDM chỉ ra các vấn đề hiệu năng đáng kể chủ yếu do tắc nghẽn I/O và các câu lệnh SQL không tối ưu. Thời gian cơ sở dữ liệu (DB Time) bị chi phối bởi các sự kiện chờ liên quan đến đọc vật lý. Cần hành động ngay lập tức để điều chỉnh các truy vấn có tác động cao nhất và xem xét lại cấu hình bộ nhớ cache.");
  const dbTime = data?.dbTimeBreakdown || { ioWait: 65, cpu: 20, concurrency: 15 };
  const findings = data?.findings || MOCK_FINDINGS;
  const detailedAnalysis = unescapeText(data?.detailedAnalysis || MOCK_DETAILED_ANALYSIS);
  const title = instanceName || "ORCL_PRODUCTION_WEST";

  const handleDownloadWord = () => {
    if (!reportRef.current) return;
    
    const header = "<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'><head><meta charset='utf-8'><title>Báo cáo ADDM</title></head><body>";
    const footer = "</body></html>";
    const sourceHTML = header + reportRef.current.innerHTML + footer;
    
    const source = 'data:application/vnd.ms-word;charset=utf-8,' + encodeURIComponent(sourceHTML);
    const fileDownload = document.createElement("a");
    document.body.appendChild(fileDownload);
    fileDownload.href = source;
    fileDownload.download = `ADDM_Report_${title}.doc`;
    fileDownload.click();
    document.body.removeChild(fileDownload);
  };

  return (
    <motion.div 
      ref={reportRef}
      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
      className="space-y-6 print:space-y-4"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-4">
          <button onClick={() => onNavigate('dashboard')} className="p-2 rounded-full hover:bg-surface-container text-on-surface-variant transition-colors print:hidden">
            <ArrowRight size={20} className="rotate-180" />
          </button>
          <div>
            <h2 className="text-3xl font-bold text-on-surface tracking-tight">{title}</h2>
            <div className="flex items-center gap-3 mt-1 text-sm text-on-surface-variant">
              <span className="flex items-center gap-1"><FileText size={14} /> MÃ BÁO CÁO: ADDM-{new Date().toISOString().slice(0,10).replace(/-/g,'')}-001</span>
              <span>•</span>
              <span className="flex items-center gap-1"><Clock size={14} /> KHỞI TẠO: Vừa xong</span>
            </div>
          </div>
        </div>
        <div className="flex gap-3 print:hidden">
          <button onClick={handleDownloadWord} className="px-4 py-2 rounded-full bg-surface-container-lowest text-on-surface font-medium flex items-center gap-2 hover:bg-surface-container-low transition-colors shadow-sm">
            <FileText size={18} />
            Tải Word
          </button>
          <button onClick={() => window.print()} className="px-4 py-2 rounded-full bg-primary text-white font-medium flex items-center gap-2 hover:bg-primary-dim transition-colors shadow-sm">
            <Download size={18} />
            Tải PDF
          </button>
        </div>
      </div>

      {/* Top Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Health Rating */}
        <div className="bg-surface-container-lowest p-6 rounded-3xl flex flex-col justify-center items-center text-center shadow-sm">
          <p className="text-sm font-semibold text-on-surface-variant tracking-wider mb-2">ĐÁNH GIÁ SỨC KHỎE</p>
          <div className="relative w-32 h-32 flex items-center justify-center">
            <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="45" fill="none" stroke="var(--color-surface-container)" strokeWidth="8" />
              <circle 
                cx="50" cy="50" r="45" fill="none" 
                stroke={score >= 80 ? "var(--color-tertiary)" : score >= 60 ? "var(--color-secondary)" : "var(--color-error)"} 
                strokeWidth="8" 
                strokeDasharray="282.7" 
                strokeDashoffset={282.7 - (282.7 * score) / 100} 
                strokeLinecap="round" 
                className="transition-all duration-1000 ease-out"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className={`text-4xl font-bold ${score >= 80 ? "text-tertiary" : score >= 60 ? "text-secondary" : "text-error"}`}>
                {score}
              </span>
              <span className="text-xs text-on-surface-variant">/100</span>
            </div>
          </div>
          <div className={`mt-4 inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium ${
            score >= 80 ? "bg-tertiary-container/30 text-tertiary" : 
            score >= 60 ? "bg-secondary-container/30 text-secondary" : 
            "bg-error-container/30 text-error"
          }`}>
            {score >= 80 ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
            {score >= 80 ? 'Tốt' : score >= 60 ? 'Cảnh báo' : 'Nghiêm trọng'}
          </div>
        </div>

        {/* Executive Summary */}
        <div className="md:col-span-2 bg-surface-container-lowest p-6 rounded-3xl shadow-sm">
          <p className="text-sm font-semibold text-on-surface-variant tracking-wider mb-4">TÓM TẮT ĐIỀU HÀNH</p>
          <p className="text-on-surface leading-relaxed text-sm whitespace-pre-wrap">
            {summary}
          </p>
          
          <div className="mt-6 grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-on-surface-variant mb-1">PHÂN TÍCH THỜI GIAN DB</p>
              <div className="space-y-2">
                <div>
                  <div className="flex justify-between text-xs mb-1"><span className="text-on-surface">I/O Wait</span><span className="font-medium">{dbTime.ioWait}%</span></div>
                  <div className="h-1.5 w-full bg-surface-container rounded-full overflow-hidden"><div className="h-full bg-error" style={{width: `${dbTime.ioWait}%`}}></div></div>
                </div>
                <div>
                  <div className="flex justify-between text-xs mb-1"><span className="text-on-surface">CPU</span><span className="font-medium">{dbTime.cpu}%</span></div>
                  <div className="h-1.5 w-full bg-surface-container rounded-full overflow-hidden"><div className="h-full bg-tertiary" style={{width: `${dbTime.cpu}%`}}></div></div>
                </div>
                <div>
                  <div className="flex justify-between text-xs mb-1"><span className="text-on-surface">Concurrency</span><span className="font-medium">{dbTime.concurrency}%</span></div>
                  <div className="h-1.5 w-full bg-surface-container rounded-full overflow-hidden"><div className="h-full bg-secondary" style={{width: `${dbTime.concurrency}%`}}></div></div>
                </div>
              </div>
            </div>
            <div className="bg-surface-container-low rounded-2xl p-4 flex flex-col justify-center">
              <p className="text-xs text-on-surface-variant mb-2">THÔNG SỐ BÌNH THƯỜNG</p>
              <div className="flex items-center gap-2 text-sm text-on-surface">
                <CheckCircle2 size={16} className="text-tertiary" /> Network Latency
              </div>
              <div className="flex items-center gap-2 text-sm text-on-surface mt-1">
                <CheckCircle2 size={16} className="text-tertiary" /> Redo Log Sync
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Detailed Analysis Section (Markdown) */}
      <div className="bg-surface-container-lowest rounded-3xl shadow-sm p-4 md:p-8 overflow-x-auto">
        <h3 className="text-2xl font-bold text-on-surface mb-6 border-b border-surface-container pb-4">BÀI PHÂN TÍCH CHUYÊN SÂU</h3>
        
        {/* A4 Document Container */}
        <div className="flex justify-center bg-surface-container-low p-4 md:p-8 rounded-2xl">
          <div className="bg-white text-black p-8 md:p-16 shadow-lg max-w-[21cm] w-full min-h-[29.7cm] shrink-0">
            <div className="prose prose-sm max-w-none prose-headings:font-bold prose-headings:text-black prose-p:text-gray-800 prose-p:font-normal prose-p:leading-relaxed prose-a:text-blue-600 prose-strong:font-bold prose-strong:text-black prose-code:text-red-600 prose-pre:bg-gray-100 prose-pre:text-gray-900">
              <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>
                {detailedAnalysis}
              </ReactMarkdown>
            </div>
          </div>
        </div>
      </div>

      {/* Findings Cards */}
      <div className="bg-surface-container-lowest rounded-3xl shadow-sm p-6 md:p-8">
        <h3 className="text-xl font-bold text-on-surface mb-6 border-b border-surface-container pb-4">PHÁT HIỆN CHÍNH & KHUYẾN NGHỊ ADDM</h3>
        
        <div className="grid grid-cols-1 gap-6">
          {findings.map((finding) => (
            <div key={finding.id} className="bg-surface-container-low/30 rounded-2xl border border-surface-container p-5 md:p-6 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-4">
                <div className="flex items-start gap-3">
                  <div className="mt-1 shrink-0">
                    {finding.type === 'error' && <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-error-container/30 text-error"><XCircle size={18}/></span>}
                    {finding.type === 'warning' && <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-secondary-container/50 text-secondary-dim"><AlertTriangle size={18}/></span>}
                    {finding.type === 'healthy' && <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-tertiary-container/30 text-tertiary-dim"><CheckCircle2 size={18}/></span>}
                  </div>
                  <div>
                    <h4 className="text-lg font-bold text-on-surface">{finding.title}</h4>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs font-semibold uppercase tracking-wider text-on-surface-variant">Tác động:</span>
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-surface-container text-on-surface text-xs font-medium">
                        {finding.impact}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="pl-0 sm:pl-11 space-y-4">
                <div className="bg-surface-container-lowest p-4 rounded-xl border border-surface-container/50">
                  <h5 className="text-sm font-bold text-on-surface mb-2 flex items-center gap-2">
                    <ArrowRight size={16} className="text-primary" /> Khuyến nghị hành động
                  </h5>
                  <p className="text-sm text-on-surface-variant whitespace-pre-wrap leading-relaxed">
                    {unescapeText(finding.rec)}
                  </p>
                </div>
                
                {finding.details && (
                  <div className="bg-surface-container-low p-4 rounded-xl border border-surface-container">
                    <h5 className="text-xs font-bold uppercase tracking-wider text-on-surface mb-2">Phân tích chi tiết</h5>
                    <p className="text-sm text-on-surface-variant whitespace-pre-wrap leading-relaxed">
                      {unescapeText(finding.details)}
                    </p>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  );
};

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [currentInstanceName, setCurrentInstanceName] = useState('');

  const handleAnalysisComplete = (result: AnalysisResult, instanceName: string) => {
    setAnalysisResult(result);
    setCurrentInstanceName(instanceName);
    setActiveTab('detail');
  };

  return (
    <div className="min-h-screen bg-surface font-sans text-on-surface flex">
      <SideNav activeTab={activeTab} setActiveTab={setActiveTab} />
      
      <div className="flex-1 ml-64 print:ml-0 flex flex-col min-h-screen">
        <TopBar />
        
        <main className="flex-1 pt-24 print:pt-8 pb-12 px-8 print:px-0 overflow-y-auto print:overflow-visible">
          <AnimatePresence mode="wait">
            {activeTab === 'dashboard' && <DashboardView key="dashboard" onNavigate={setActiveTab} />}
            {activeTab === 'analysis' && <AnalysisView key="analysis" onAnalysisComplete={handleAnalysisComplete} />}
            {activeTab === 'detail' && <ReportDetailView key="detail" onNavigate={setActiveTab} data={analysisResult} instanceName={currentInstanceName} />}
            {activeTab === 'history' && (
              <motion.div key="history" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex items-center justify-center h-full text-on-surface-variant">
                <div className="text-center">
                  <History size={48} className="mx-auto mb-4 opacity-20" />
                  <p>Màn hình Lịch sử đang được xây dựng.</p>
                  <button onClick={() => setActiveTab('detail')} className="mt-4 text-primary hover:underline">Xem ví dụ Chi tiết Báo cáo</button>
                </div>
              </motion.div>
            )}
            {activeTab === 'settings' && (
              <motion.div key="settings" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex items-center justify-center h-full text-on-surface-variant">
                Màn hình Cài đặt đang được xây dựng.
              </motion.div>
            )}
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}
