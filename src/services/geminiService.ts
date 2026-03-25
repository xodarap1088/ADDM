import { GoogleGenAI, Type } from "@google/genai";

// Khởi tạo Gemini với API Key từ biến môi trường
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export interface AnalysisResult {
  score: number;
  summary: string;
  detailedAnalysis: string;
  dbTimeBreakdown: {
    ioWait: number;
    cpu: number;
    concurrency: number;
  };
  findings: Array<{
    id: number;
    type: 'error' | 'warning' | 'healthy';
    title: string;
    impact: string;
    rec: string;
    details: string;
  }>;
}

export async function analyzeADDMReport(reportText: string, instanceName: string, notes: string): Promise<AnalysisResult> {
  const prompt = `
    Bạn là một Chuyên gia Quản trị Cơ sở dữ liệu Oracle (Expert Oracle DBA) với hơn 20 năm kinh nghiệm. 
    Hãy phân tích nội dung báo cáo ADDM (Automatic Database Diagnostic Monitor) sau đây một cách CỰC KỲ CHI TIẾT VÀ CHUYÊN SÂU.
    
    Tên Instance: ${instanceName || 'Không xác định'}
    Ghi chú bổ sung từ người dùng: ${notes || 'Không có'}

    Nhiệm vụ của bạn:
    1. Trích xuất các phát hiện (findings) chính từ báo cáo. Đối với mỗi phát hiện, cung cấp tiêu đề, tác động, khuyến nghị ngắn gọn, và MỘT PHẦN PHÂN TÍCH CHI TIẾT (details) giải thích sâu về nguyên nhân gốc rễ, các SQL ID liên quan, và các bước khắc phục cụ thể.
    2. Tính toán điểm sức khỏe tổng thể (từ 0-100, trong đó 100 là hoàn hảo. Trừ điểm dựa trên mức độ nghiêm trọng của các vấn đề).
    3. Viết một đoạn tóm tắt điều hành (executive summary) ngắn gọn, chuyên nghiệp bằng tiếng Việt.
    4. Viết một BÀI PHÂN TÍCH CHUYÊN SÂU (detailedAnalysis) bằng Markdown. Bài phân tích này phải CỰC KỲ CHI TIẾT, độ dài tương đương 5 đến 6 trang A4 (khoảng 2500 - 3500 từ). Bao gồm:
       - Đánh giá tổng quan về hệ thống và đặc tả tải (Load profile).
       - Phân tích sâu về các nút thắt cổ chai (Bottlenecks) chính (I/O, CPU, Memory, Concurrency, Network).
       - Phân tích chi tiết các câu lệnh SQL tốn tài nguyên nhất (Top SQLs), lý do tại sao chúng chậm (thiếu index, full table scan, v.v.).
       - Đánh giá cấu hình Instance (SGA, PGA, tham số khởi tạo).
       - Kế hoạch hành động (Action Plan) chi tiết theo từng giai đoạn (Ngay lập tức, Ngắn hạn, Dài hạn).
       - Cung cấp các kịch bản (scripts) hoặc lệnh SQL cụ thể (ví dụ: tạo index, gather statistics, alter system) để khắc phục vấn đề.
       - LƯU Ý VỀ ĐỊNH DẠNG: Chỉ bôi đậm (bold) các vấn đề chính, các chỉ mục quan trọng hoặc từ khóa cần chú ý. Không bôi đậm toàn bộ câu hoặc đoạn văn.
    5. Ước tính hoặc trích xuất tỷ lệ phần trăm phân bổ DB Time (I/O Wait, CPU, Concurrency). Tổng phải là 100%.

    Nội dung báo cáo ADDM:
    """
    ${reportText.substring(0, 35000)}
    """
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3.1-pro-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            score: { type: Type.INTEGER, description: "Điểm sức khỏe tổng thể từ 0-100" },
            summary: { type: Type.STRING, description: "Tóm tắt điều hành bằng tiếng Việt (ngắn gọn)" },
            detailedAnalysis: { type: Type.STRING, description: "Bài phân tích chuyên sâu bằng Markdown, độ dài 5-6 trang A4 (rất chi tiết, có code SQL)" },
            dbTimeBreakdown: {
              type: Type.OBJECT,
              properties: {
                ioWait: { type: Type.INTEGER, description: "Phần trăm DB Time cho I/O Wait" },
                cpu: { type: Type.INTEGER, description: "Phần trăm DB Time cho CPU" },
                concurrency: { type: Type.INTEGER, description: "Phần trăm DB Time cho Concurrency" }
              },
              required: ["ioWait", "cpu", "concurrency"]
            },
            findings: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  type: { type: Type.STRING, description: "Phải là 'error', 'warning', hoặc 'healthy'" },
                  title: { type: Type.STRING, description: "Tiêu đề của phát hiện bằng tiếng Việt" },
                  impact: { type: Type.STRING, description: "Mô tả tác động, ví dụ: '14.2% DB Time'" },
                  rec: { type: Type.STRING, description: "Khuyến nghị khắc phục bằng tiếng Việt (ngắn gọn)" },
                  details: { type: Type.STRING, description: "Phân tích chi tiết về phát hiện này, nguyên nhân và cách xử lý cụ thể" }
                },
                required: ["type", "title", "impact", "rec", "details"]
              }
            }
          },
          required: ["score", "summary", "detailedAnalysis", "dbTimeBreakdown", "findings"]
        }
      }
    });

    const jsonStr = response.text || "{}";
    const data = JSON.parse(jsonStr);
    
    // Đảm bảo các findings có ID
    if (data.findings && Array.isArray(data.findings)) {
      data.findings = data.findings.map((f: any, i: number) => ({ ...f, id: i + 1 }));
    }

    return data as AnalysisResult;
  } catch (error) {
    console.error("Lỗi khi gọi Gemini API:", error);
    throw new Error("Không thể phân tích báo cáo. Vui lòng thử lại.");
  }
}
