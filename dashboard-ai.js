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
if (btnAutoGenerate) {
    btnAutoGenerate.addEventListener('click', () => {
        aiGenerateModal.classList.add('active');
        resetAiForm();
    });
}

// Đóng Modal
const closeAiModal = () => aiGenerateModal.classList.remove('active');
if (closeAiModalBtn) closeAiModalBtn.addEventListener('click', closeAiModal);
if (btnCancelAi) btnCancelAi.addEventListener('click', closeAiModal);

// Đóng khi click ra ngoài vùng mờ
if (aiGenerateModal) {
    aiGenerateModal.addEventListener('click', (e) => {
        if (e.target === aiGenerateModal) closeAiModal();
    });
}

function resetAiForm() {
    if (aiPromptInput) aiPromptInput.value = '';
    if (aiQuestionCount) aiQuestionCount.value = '10';
    if (aiDifficulty) aiDifficulty.value = 'medium'; 
    if (aiFormArea) aiFormArea.style.display = 'block';
    if (aiLoadingSpinner) aiLoadingSpinner.style.display = 'none';
}

// =========================================================================
// LOGIC GỌI API (VERCEL) & LƯU VÀO FIRESTORE (ĐÃ BỔ SUNG PHÂN QUYỀN)
// =========================================================================
if (btnSubmitAiGenerate) {
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
            // Gọi lên serverless function của Vercel (đã sửa payload thành promptText)
            const response = await fetch('/api/generate', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    promptText: prompt, 
                    questionCount: questionCount,
                    difficulty: difficulty
                })
            });

            if (!response.ok) {
                const errorData = await response.text();
                throw new Error(`Lỗi gọi API (${response.status}): ${errorData}`);
            }

            // Hứng trực tiếp mảng câu hỏi từ Vercel trả về
            const questions = await response.json();
            
            if (!Array.isArray(questions) || questions.length === 0) {
                throw new Error("AI không tạo được câu hỏi nào hoặc dữ liệu trả về bị sai cấu trúc.");
            }

            // --- 2. TẠO ID ĐỀ THI ---
            const examId = "AI-" + Math.random().toString(36).substring(2, 8).toUpperCase();

            // --- 3. LƯU TỪNG CÂU HỎI VÀO COLLECTION "questions" ---
            // Lặp qua mảng câu hỏi và lưu vào Firestore
            const savePromises = questions.map((q, i) => {
                const questionId = `${examId}-Q${i + 1}`;
                return setDoc(doc(db, "questions", questionId), {
                    examId: examId,
                    // Bọc thép dữ liệu: Quét mọi tên key mà AI có thể trả về để khớp với file quiz.html
                    text: q.text || q.questionText || q.question || q.content || "Lỗi: AI không có nội dung",
                    options: q.options || q.answers || [],
                    correctAnswer: q.correctAnswer !== undefined ? q.correctAnswer : (q.correct || 0),
                    explanation: q.explanation || "Không có giải thích chi tiết",
                    order: i + 1
                });
            });

            // Chờ lưu toàn bộ câu hỏi xong
            await Promise.all(savePromises);

            // --- 4. GHI THÔNG TIN GÓI ĐỀ THI VÀO COLLECTION "exams" ---
            await setDoc(doc(db, "exams", examId), {
                id: examId,
                technique: "AI Tự Động",
                level: difficulty === 'easy' ? 'Dễ' : (difficulty === 'hard' ? 'Khó' : 'Trung bình'),
                timeLimit: parseInt(questionCount), 
                createdAt: Date.now(),
                isVip: false,
                attemptCount: 0,
                
                // Phân quyền hiển thị: Đề này chỉ mình người tạo thấy
                creatorId: auth.currentUser.uid,
                isPublic: false
            });

            // Hoàn thành
            closeAiModal();
            
            // Chuyển hướng thẳng vào trang thi và mang theo mã đề
            window.location.href = `quiz.html?examId=${examId}`;
            
            // Tải lại giao diện danh sách đề thi trên Dashboard
            if (typeof window.loadAggregatedExamData === 'function') {
                window.loadAggregatedExamData();
            } else {
                location.reload(); 
            }

        } catch (error) {
            console.error("Lỗi tạo đề thi AI:", error);
            alert("Đã xảy ra lỗi trong quá trình tạo đề bằng AI: " + error.message);
            resetAiForm();
        }
    });
}
