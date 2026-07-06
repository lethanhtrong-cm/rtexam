// =========================================================================
// 1. KHỞI TẠO & CẤU HÌNH API VÀ FIREBASE
// =========================================================================
// Import các hàm cấu hình Auth và Database từ file core của hệ thống
import { auth, db } from './dashboard-core.js';
// Import các hàm tương tác với Firestore từ CDN của Firebase
import { collection, doc, setDoc, addDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// ĐÃ XÓA KHAI BÁO API KEY BẢO MẬT Ở FRONTEND - CHUYỂN SANG BACKEND VERCEL

// =========================================================================
// 2. HÀM GỌI API GEMINI (AI GENERATION LOGIC - ĐÃ CHUYỂN QUA BACKEND)
// =========================================================================
/**
 * Hàm gọi API Gemini thông qua Serverless Backend (Vercel) để tạo đề
 * @param {string} promptText - Nội dung tài liệu người dùng nhập
 * @param {number|string} questionCount - Số lượng câu hỏi muốn tạo
 * @param {string} difficulty - Mức độ khó của đề thi
 * @returns {Promise<Array>} Trả về một mảng chứa các Object câu hỏi
 */
async function generateQuizFromGemini(promptText, questionCount, difficulty) {
    // Giao diện web bây giờ chỉ gọi đến "căn phòng kín" /api/generate
    const response = await fetch('/api/generate', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            promptText: promptText,
            questionCount: questionCount,
            difficulty: difficulty
        })
    });

    if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || "Lỗi máy chủ nội bộ");
    }

    const questions = await response.json();
    
    if (!Array.isArray(questions) || questions.length === 0) {
        throw new Error("AI không trả về mảng dữ liệu hợp lệ.");
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
            
            // Khôi phục lại trạng thái của nút
            if (btnSubmitAiGenerate) btnSubmitAiGenerate.disabled = false;
            if (btnCancelAi) btnCancelAi.disabled = false;
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
                // Đợi AI tạo và trả về mảng câu hỏi (Bây giờ gọi qua Serverless Vercel)
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
                const savePromises = generatedQuestions.map((questionObj, index) => {
                    return addDoc(collection(db, "questions"), {
                        examId: examId,
                        // Bọc thép dữ liệu: Quét mọi tên key mà AI có thể trả về
                        questionText: questionObj.text || questionObj.question || questionObj.content || "Lỗi: AI không trả về nội dung câu hỏi",
                        options: questionObj.options || [],
                        correctAnswer: questionObj.correctAnswer || 0,
                        explanation: questionObj.explanation || "Không có giải thích",
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
