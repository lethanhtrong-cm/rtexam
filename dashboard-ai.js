import { auth, db } from "./dashboard-core.js";
import { doc, setDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

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
// LOGIC GỌI API (VERCEL) & LƯU VÀO FIRESTORE (ĐÃ BỔ SUNG PHÂN QUYỀN)
// =========================================================================
btnSubmitAiGenerate.addEventListener('click', async () => {
    const prompt = aiPromptInput.value.trim();
    const questionCount = aiQuestionCount.value;
    const difficulty = aiDifficulty.value;

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
        // --- 1. GỌI API VERCEL ĐỂ TẠO ĐỀ ---
        const response = await fetch('/api/generate', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                prompt: prompt,
                questionCount: questionCount,
                difficulty: difficulty
            })
        });

        if (!response.ok) {
            throw new Error(`Lỗi gọi API: ${response.status}`);
        }

        const data = await response.json();
        
        // Lấy danh sách câu hỏi từ API trả về
        const questions = data.questions || [];
        if (questions.length === 0) {
            throw new Error("AI không tạo được câu hỏi nào.");
        }

        // --- 2. TẠO ID ĐỀ THI ---
        const examId = "AI-" + Math.random().toString(36).substring(2, 8).toUpperCase();

        // --- 3. LƯU TỪNG CÂU HỎI VÀO COLLECTION "questions" ---
        for (let i = 0; i < questions.length; i++) {
            const q = questions[i];
            const questionId = `${examId}-Q${i + 1}`;
            await setDoc(doc(db, "questions", questionId), {
                examId: examId,
                questionText: q.questionText || q.question || "",
                options: q.options || q.answers || [],
                correctAnswer: q.correctAnswer || q.correct || "",
                explanation: q.explanation || "Không có giải thích",
                order: i + 1
            });
        }

        // --- 4. GHI THÔNG TIN GÓI ĐỀ THI VÀO COLLECTION "exams" ---
        await setDoc(doc(db, "exams", examId), {
            id: examId,
            technique: "AI Tự Động",
            level: difficulty === 'easy' ? 'Dễ' : (difficulty === 'hard' ? 'Khó' : 'Trung bình'),
            timeLimit: parseInt(questionCount), 
            createdAt: Date.now(),
            isVip: false,
            attemptCount: 0,
            
            // BỔ SUNG 2 DÒNG NÀY VÀO LÀ ĐỦ:
            creatorId: auth.currentUser.uid,
            isPublic: false
        });

        // Hoàn thành
        closeAiModal();
        alert(`Tạo đề thi thành công! Mã đề của bạn là: ${examId}`);
        
        // Tải lại giao diện danh sách đề thi (Nó sẽ tự query bằng OR bên dashboard-exams.js)
        if (typeof window.loadAggregatedExamData === 'function') {
            window.loadAggregatedExamData();
        } else {
            location.reload(); 
        }

    } catch (error) {
        console.error("Lỗi tạo đề thi AI:", error);
        alert("Đã xảy ra lỗi trong quá trình tạo đề bằng AI. Vui lòng thử lại!");
        resetAiForm();
    }
});
