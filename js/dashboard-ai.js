import { auth, db } from "./dashboard-core.js";
import { doc, setDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// =========================================================================
// CHỜ GIAO DIỆN TẢI XONG MỚI GẮN SỰ KIỆN ĐỂ TRÁNH LỖI NULL
// =========================================================================
document.addEventListener('ComponentsLoaded', () => {

    // 1. Khai báo DOM Elements
    const btnAutoGenerate = document.getElementById('btnAutoGenerate');
    const aiGenerateModal = document.getElementById('aiGenerateModal');
    const closeAiModalBtn = document.getElementById('closeAiModalBtn');
    const btnCancelAi = document.getElementById('btnCancelAi');
    const btnSubmitAiGenerate = document.getElementById('btnSubmitAiGenerate');

    const aiFormArea = document.getElementById('aiFormArea');
    const aiLoadingSpinner = document.getElementById('aiLoadingSpinner');
    const aiSuccessArea = document.getElementById('aiSuccessArea');
    const aiModalFooter = document.getElementById('aiModalFooter');

    const aiPromptInput = document.getElementById('aiPromptInput');
    const aiQuestionCount = document.getElementById('aiQuestionCount');
    const aiDifficulty = document.getElementById('aiDifficulty');
    const generatedAiExamCode = document.getElementById('generatedAiExamCode');

    const btnCancelGoToQuiz = document.getElementById('btnCancelGoToQuiz');
    const btnGoToQuiz = document.getElementById('btnGoToQuiz');

    let currentGeneratedExamId = null;

    // 2. Hàm Reset Form về trạng thái ban đầu
    function resetAiForm() {
        if (aiPromptInput) aiPromptInput.value = '';
        if (aiQuestionCount) aiQuestionCount.value = '10';
        if (aiDifficulty) aiDifficulty.value = 'medium'; 
        
        if (aiFormArea) aiFormArea.style.display = 'block';
        if (aiLoadingSpinner) aiLoadingSpinner.style.display = 'none';
        if (aiSuccessArea) aiSuccessArea.style.display = 'none';
        
        if (aiModalFooter) aiModalFooter.style.display = 'flex';
    }

    // 3. Sự kiện Đóng/Mở Modal
    if (btnAutoGenerate) {
        btnAutoGenerate.addEventListener('click', () => {
            aiGenerateModal.classList.add('active');
            resetAiForm();
        });
    }

    const closeAiModal = () => aiGenerateModal.classList.remove('active');
    if (closeAiModalBtn) closeAiModalBtn.addEventListener('click', closeAiModal);
    if (btnCancelAi) btnCancelAi.addEventListener('click', closeAiModal);

    if (aiGenerateModal) {
        aiGenerateModal.addEventListener('click', (e) => {
            if (e.target === aiGenerateModal) closeAiModal();
        });
    }

    // =========================================================================
    // 4. LOGIC GỌI API (VERCEL) & LƯU VÀO FIRESTORE 
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

            aiFormArea.style.display = 'none';
            aiModalFooter.style.display = 'none';
            aiLoadingSpinner.style.display = 'block';

            try {
                // GỌI API VERCEL
                const response = await fetch('/api/generate', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
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

                const questions = await response.json();
                
                if (!Array.isArray(questions) || questions.length === 0) {
                    throw new Error("AI không tạo được câu hỏi nào hoặc dữ liệu trả về bị sai cấu trúc.");
                }

                currentGeneratedExamId = "AI-" + Math.random().toString(36).substring(2, 8).toUpperCase();

                // LƯU CÂU HỎI VÀO FIRESTORE
                const savePromises = questions.map((q, i) => {
                    const questionId = `${currentGeneratedExamId}-Q${i + 1}`;
                    return setDoc(doc(db, "questions", questionId), {
                        examId: currentGeneratedExamId,
                        text: q.text || q.questionText || q.question || q.content || "Lỗi: AI không có nội dung",
                        options: q.options || q.answers || [],
                        correctAnswer: q.correctAnswer !== undefined ? q.correctAnswer : (q.correct || 0),
                        explanation: q.explanation || "Không có giải thích chi tiết",
                        order: i + 1
                    });
                });

                await Promise.all(savePromises);

                // GHI THÔNG TIN ĐỀ THI VÀO FIRESTORE
                await setDoc(doc(db, "exams", currentGeneratedExamId), {
                    id: currentGeneratedExamId,
                    technique: "AI Tự Động",
                    level: difficulty === 'easy' ? 'Dễ' : (difficulty === 'hard' ? 'Khó' : 'Trung bình'),
                    timeLimit: parseInt(questionCount), 
                    createdAt: Date.now(),
                    isVip: false,
                    attemptCount: 0,
                    creatorId: auth.currentUser.uid,
                    isPublic: false
                });

                // HIỂN THỊ GIAO DIỆN CHÚC MỪNG
                aiLoadingSpinner.style.display = 'none';
                aiSuccessArea.style.display = 'block';
                generatedAiExamCode.textContent = currentGeneratedExamId;

            } catch (error) {
                console.error("Lỗi tạo đề thi AI:", error);
                alert("Đã xảy ra lỗi trong quá trình tạo đề bằng AI: " + error.message);
                resetAiForm(); 
            }
        });
    }

    // =========================================================================
    // 5. SỰ KIỆN Ở MÀN HÌNH CHÚC MỪNG (LƯU ĐỀ & THI NGAY)
    // =========================================================================
    if (btnCancelGoToQuiz) {
        btnCancelGoToQuiz.addEventListener('click', () => {
            closeAiModal();
            if (typeof window.loadAggregatedExamData === 'function') {
                window.loadAggregatedExamData();
            } else {
                location.reload(); 
            }
        });
    }

    if (btnGoToQuiz) {
        btnGoToQuiz.addEventListener('click', () => {
            // ĐẨY NGƯỜI DÙNG SANG TAB MỚI KHI BẤM "BẮT ĐẦU THI NGAY"
            const targetUrl = `quiz.html?examId=${currentGeneratedExamId}`;
            window.open(targetUrl, '_blank');
        });
    }

});
