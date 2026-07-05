// =========================================================================
// 1. KHỞI TẠO & CẤU HÌNH API VÀ FIREBASE
// =========================================================================
// Import các hàm cấu hình Auth và Database từ file core của hệ thống
import { auth, db } from './dashboard-core.js';
// Import các hàm tương tác với Firestore từ CDN của Firebase
import { collection, doc, setDoc, addDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// Khai báo hằng số chứa API Key của Google Gemini (Đã cập nhật Key thực tế)
const GEMINI_API_KEY = "AQ.Ab8RN6KDYMMLfGbBKyL7r_8BoQxsVxxS7zM5p_pK152_EIlnXQ";

// URL endpoint của mô hình gemini-1.5-flash để gọi API tạo text
// Thay dòng khai báo GEMINI_URL cũ của bạn bằng cách này:
const GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=" + encodeURIComponent(GEMINI_API_KEY);
// =========================================================================
// 2. HÀM GỌI API GEMINI (AI GENERATION LOGIC)
// =========================================================================
/**
 * Hàm gọi API Gemini để tạo danh sách câu hỏi trắc nghiệm
 * @param {string} promptText - Nội dung tài liệu người dùng nhập
 * @param {number|string} questionCount - Số lượng câu hỏi muốn tạo
 * @param {string} difficulty - Mức độ khó của đề thi
 * @returns {Promise<Array>} Trả về một mảng chứa các Object câu hỏi
 */
async function generateQuizFromGemini(promptText, questionCount, difficulty) {
    // Xây dựng câu lệnh hệ thống (System Instruction) chặt chẽ để ép AI trả về đúng định dạng
    const systemInstruction = `Bạn là một chuyên gia ra đề thi trắc nghiệm chuyên ngành Kỹ thuật Hình ảnh Y học. Hãy dựa vào nội dung tài liệu được cung cấp để tạo ra đúng ${questionCount} câu hỏi trắc nghiệm ở mức độ ${difficulty}. 
QUY TẮC TỐI THƯỢNG: Chỉ trả về duy nhất một mảng JSON chứa các câu hỏi, KHÔNG có bất kỳ lời giải thích, chào hỏi hay text thừa nào ở đầu/cuối, KHÔNG bọc mảng trong ký tự markdown như \`\`\`json hay \`\`\`. 
Cấu trúc chính xác của mỗi object câu hỏi trong mảng phải là: 
{ 
  "text": "Nội dung câu hỏi ở đây", 
  "options": ["Đáp án A", "Đáp án B", "Đáp án C", "Đáp án D"], 
  "correctAnswer": [Chỉ số index của đáp án đúng, là số nguyên từ 0 đến 3], 
  "explanation": "Giải thích ngắn gọn tại sao đáp án đó đúng" 
}`;

    // Tạo payload (dữ liệu gửi đi) tuân thủ cấu trúc của Google Gemini API
    const requestBody = {
        contents: [{
            parts: [{
                text: promptText // Nội dung người dùng truyền vào
            }]
        }],
        systemInstruction: {
            parts: [{
                text: systemInstruction // Câu lệnh hệ thống đã định nghĩa ở trên
            }]
        },
        // Mẹo nhỏ: Bật tham số này để hướng mô hình trả về JSON chuẩn xác hơn
        generationConfig: {
            responseMimeType: "application/json"
        }
    };

    // Gửi HTTP POST Request tới Gemini API
    const response = await fetch(GEMINI_URL, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify(requestBody)
    });

    // Kiểm tra nếu API lỗi (ví dụ: Hết hạn ngạch, sai key, lỗi mạng...)
    if (!response.ok) {
        throw new Error("Lỗi kết nối tới API Gemini (Mã lỗi: " + response.status + ")");
    }

    // Trích xuất dữ liệu trả về từ API
    const data = await response.json();
    let responseText = data.candidates[0].content.parts[0].text;

    // LÀM SẠCH DỮ LIỆU: Sử dụng Regular Expression (RegEx) để loại bỏ các ký tự Markdown thừa
    // Đề phòng trường hợp AI quên luật và bọc kết quả trong ```json ... ```
    responseText = responseText.replace(/^```json\s*/, '').replace(/\s*```$/, '').trim();

    // Chuyển đổi chuỗi JSON thành mảng JavaScript thực thụ
    const questions = JSON.parse(responseText);

    // Xác thực an toàn: Đảm bảo kết quả là một mảng và có chứa dữ liệu
    if (!Array.isArray(questions) || questions.length === 0) {
        throw new Error("AI không trả về mảng dữ liệu hợp lệ. Vui lòng thử lại!");
    }

    return questions;
}

// =========================================================================
// 3. XỬ LÝ SỰ KIỆN GIAO DIỆN (DOM EVENTS) & LƯU FIRESTORE
// =========================================================================
document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements: Nút bấm
    const btnAutoGenerate = document.getElementById('btnAutoGenerate');
    const closeAiModalBtn = document.getElementById('closeAiModalBtn');
    const btnCancelAi = document.getElementById('btnCancelAi');
    const btnSubmitAiGenerate = document.getElementById('btnSubmitAiGenerate');
    
    // DOM Elements: Khu vực giao diện
    const aiGenerateModal = document.getElementById('aiGenerateModal');
    const aiFormArea = document.getElementById('aiFormArea');
    const aiLoadingSpinner = document.getElementById('aiLoadingSpinner');
    
    // DOM Elements: Đầu vào dữ liệu form
    const aiPromptInput = document.getElementById('aiPromptInput');
    const aiQuestionCount = document.getElementById('aiQuestionCount');
    const aiDifficulty = document.getElementById('aiDifficulty');

    // ----------------------------------------------------
    // Sự kiện 1: Mở Modal khi nhấn nút "Tạo đề tự động"
    // ----------------------------------------------------
    if (btnAutoGenerate) {
        btnAutoGenerate.addEventListener('click', () => {
            aiGenerateModal.classList.add('active'); // Hiển thị modal
        });
    }

    // ----------------------------------------------------
    // Hàm dùng chung: Đóng Modal & Reset Form
    // ----------------------------------------------------
    const closeAndResetModal = () => {
        aiGenerateModal.classList.remove('active'); // Ẩn modal
        // Đợi 300ms (thời gian chạy animation) rồi mới reset dữ liệu để UI không bị giật
        setTimeout(() => {
            aiPromptInput.value = '';
            aiFormArea.style.display = 'block';
            aiLoadingSpinner.style.display = 'none';
        }, 300);
    };

    // ----------------------------------------------------
    // Sự kiện 2: Đóng Modal khi nhấn Nút "Hủy" hoặc dấu "X"
    // ----------------------------------------------------
    if (closeAiModalBtn) closeAiModalBtn.addEventListener('click', closeAndResetModal);
    if (btnCancelAi) btnCancelAi.addEventListener('click', closeAndResetModal);

    // ----------------------------------------------------
    // Sự kiện 3: Xử lý logic chính khi Submit Tạo Đề
    // ----------------------------------------------------
    if (btnSubmitAiGenerate) {
        btnSubmitAiGenerate.addEventListener('click', async () => {
            // Lấy dữ liệu từ các ô nhập liệu
            const prompt = aiPromptInput.value.trim();
            const questionCount = aiQuestionCount.value;
            const difficulty = aiDifficulty.value;
            
            // Bước 1: Validate (Kiểm tra dữ liệu)
            if (!prompt) {
                alert("Bạn chưa nhập nội dung! Vui lòng nhập tài liệu hoặc chủ đề để AI xử lý.");
                aiPromptInput.focus(); // Đưa con trỏ chuột về ô nhập liệu
                return; // Dừng hàm ngay lập tức
            }

            // Bước 2: Chuẩn bị UI (Ẩn form, hiện Spinner chờ)
            aiFormArea.style.display = 'none';
            aiLoadingSpinner.style.display = 'block';
            
            // Vô hiệu hóa nút bấm để tránh người dùng nhấn spam (click nhiều lần)
            btnSubmitAiGenerate.disabled = true;
            btnCancelAi.disabled = true;

            // Bước 3: Khối Try-Catch xử lý Gọi API và Lưu Database
            try {
                // Đợi AI tạo và trả về mảng câu hỏi
                const generatedQuestions = await generateQuizFromGemini(prompt, questionCount, difficulty);
                
                // Khởi tạo mã đề thi ngẫu nhiên duy nhất
                const examId = "AI-" + Date.now();
                
                // Ghi thông tin gói đề thi vào collection "exams"
                await setDoc(doc(db, "exams", examId), {
                    id: examId,
                    technique: "AI Tự Động",
                    level: difficulty,
                    timeLimit: parseInt(questionCount), // Giả định thời gian làm = số câu (1 phút/câu)
                    createdAt: Date.now(),
                    isVip: false,
                    attemptCount: 0
                });

                // Lặp qua mảng câu hỏi, tạo từng Promise để ghi vào collection "questions"
                // Cách dùng Promise.all này giúp lưu hàng loạt câu hỏi cực kỳ nhanh gọn
                const savePromises = generatedQuestions.map((questionObj, index) => {
                    return addDoc(collection(db, "questions"), {
                        examId: examId, // Gắn mã đề để liên kết dữ liệu
                        questionText: questionObj.text,
                        options: questionObj.options,
                        correctAnswer: questionObj.correctAnswer,
                        explanation: questionObj.explanation,
                        order: index + 1 // Lưu thứ tự câu hỏi
                    });
                });

                // Chờ toàn bộ câu hỏi được ghi lên Firestore thành công
                await Promise.all(savePromises);

                // Bước 4: Thành công -> Chuyển hướng người chơi sang trang thi
                aiLoadingSpinner.style.display = 'none';
                closeAndResetModal();
                
                // Chuyển URL sang trang thi (mang theo mã đề trên query string)
                window.location.href = "quiz.html?examId=" + examId;
                
            } catch (error) {
                // Xử lý Lỗi (nếu có ở bất kỳ bước nào trong thẻ try)
                console.error("Lỗi tạo đề AI:", error);
                alert("Có lỗi xảy ra khi tạo đề: " + error.message);
                
                // Phục hồi lại giao diện form để người dùng có thể thử lại
                aiFormArea.style.display = 'block';
                aiLoadingSpinner.style.display = 'none';
                btnSubmitAiGenerate.disabled = false;
                btnCancelAi.disabled = false;
            }
        });
    }
});
