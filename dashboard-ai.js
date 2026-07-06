import { auth, db } from "./dashboard-core.js";
// Khai báo các hàm Firestore cần thiết
import { collection, doc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// =========================================================================
// QUẢN LÝ UI - MODAL TẠO ĐỀ AI
// =========================================================================
const btnAutoGenerate = document.getElementById('btnAutoGenerate');
const aiGenerateModal = document.getElementById('aiGenerateModal');
const closeAiModalBtn = document.getElementById('closeAiModalBtn');
const btnCancelAi = document.getElementById('btnCancelAi');
const btnSubmitAiGenerate = document.getElementById('btnSubmitAiGenerate');

const aiFormArea = document.getElementById('aiFormArea');
const aiLoadingSpinner = document.getElementById('aiLoadingSpinner');
const aiPromptInput = document.getElementById('aiPromptInput');
const aiQuestionCount = document.getElementById('aiQuestionCount');
const aiDifficulty = document.getElementById('aiDifficulty');

// Mở Modal
btnAutoGenerate.addEventListener('click', () => {
    aiGenerateModal.classList.add('active');
    resetAiForm();
});

// Đóng Modal
const closeAiModal = () => aiGenerateModal.classList.remove('active');
closeAiModalBtn.addEventListener('click', closeAiModal);
btnCancelAi.addEventListener('click', closeAiModal);

// Đóng khi click ra ngoài vùng mờ
aiGenerateModal.addEventListener('click', (e) => {
    if (e.target === aiGenerateModal) closeAiModal();
});

function resetAiForm() {
    aiPromptInput.value = '';
    aiQuestionCount.value = '10';
    aiDifficulty.value = 'medium';
    aiFormArea.style.display = 'block';
    aiLoadingSpinner.style.display = 'none';
}

// =========================================================================
// LOGIC GỌI AI & LƯU VÀO FIRESTORE (PHÂN QUYỀN HIỂN THỊ)
// =========================================================================
btnSubmitAiGenerate.addEventListener('click', async () => {
    const prompt = aiPromptInput.value.trim();
    if (!prompt) {
        alert("Vui lòng nhập chủ đề hoặc tài liệu cần tạo đề!");
        return;
    }

    if (!auth.currentUser) {
        alert("Vui lòng đăng nhập để sử dụng tính năng AI!");
        return;
    }

    // Hiển thị Spinner
    aiFormArea.style.display = 'none';
    aiLoadingSpinner.style.display = 'block';

    try {
        // --- 1. Gọi API AI tại đây (Mô phỏng logic tạo đề) ---
        // Giả sử sau khi gọi API thành công, bạn có 1 mã đề và danh sách câu hỏi
        const examId = "AI-" + Math.random().toString(36).substring(2, 8).toUpperCase();
        
        // Mô phỏng thời gian chờ API AI trả về
        await new Promise(resolve => setTimeout(resolve, 2000)); 

        // --- 2. LƯU THÔNG TIN ĐỀ THI VÀO COLLECTION 'exams' ---
        const examConfigRef = doc(db, "exams", examId);
        
        // THÔNG TIN BẢO MẬT & PHÂN QUYỀN ĐƯỢC CẬP NHẬT Ở ĐÂY
        const examData = {
            title: `Đề AI: ${prompt.substring(0, 30)}...`,
            timeLimit: parseInt(aiQuestionCount.value) > 15 ? 30 : 15,
            level: translateDifficulty(aiDifficulty.value),
            technique: "Hỗn hợp", // Hoặc phân tích từ AI
            isVip: false,
            attemptCount: 0,
            createdAt: serverTimestamp(),

            // [QUAN TRỌNG] - Phân quyền hiển thị
            creatorId: auth.currentUser.uid, // Gắn ID người tạo để query
            isPublic: false                  // Đánh dấu đề riêng tư (chỉ người tạo mới thấy)
        };
        await setDoc(examConfigRef, examData);

        // --- 3. Lưu mảng câu hỏi vào collection 'questions' (ví dụ) ---
        // await setDoc(doc(db, "questions", examId), { ... })

        // Hoàn thành
        closeAiModal();
        alert(`Tạo đề thi thành công! Mã đề của bạn là: ${examId}`);
        
        // Reload lại danh sách đề thi trên Dashboard (Hàm loadAggregatedExamData sẽ tự query bằng OR)
        if (typeof window.loadAggregatedExamData === 'function') {
            window.loadAggregatedExamData();
        } else {
            // Tải lại trang nếu cần
            location.reload(); 
        }

    } catch (error) {
        console.error("Lỗi tạo đề thi AI:", error);
        alert("Đã xảy ra lỗi trong quá trình tạo đề. Vui lòng thử lại!");
        resetAiForm();
    }
});

function translateDifficulty(val) {
    if (val === 'easy') return 'Dễ';
    if (val === 'hard') return 'Khó';
    return 'Trung bình';
}
