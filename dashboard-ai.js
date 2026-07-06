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

// Hàm dọn dẹp form mỗi lần mở lại
function resetAiForm() {
    if (aiPromptInput) aiPromptInput.value = '';
    if (aiQuestionCount) aiQuestionCount.value = '10';
    if (aiDifficulty) aiDifficulty.value = 'medium'; 
    if (aiFormArea) aiFormArea.style.display = 'block';
    if (aiLoadingSpinner) aiLoadingSpinner.style.display = 'none';
    
    // Dọn dẹp giao diện chúc mừng thành công (nếu có từ lần tạo trước)
    const successArea = document.getElementById('aiSuccessArea');
    if (successArea) successArea.remove();
}

// =========================================================================
// LOGIC GỌI API (VERCEL) & LƯU VÀO FIRESTORE 
// =========================================================================
if (btnSubmitAiGenerate) {
    btnSubmitAiGenerate.addEventListener('click', async () => {
        const prompt = aiPromptInput.value.trim();
        const questionCount = aiQuestionCount.value;
        const difficulty = aiDifficulty.value;

        // 1. Kiểm tra dữ liệu đầu vào
        if (!prompt) {
            alert("Vui lòng nhập chủ đề hoặc tài liệu cần tạo đề!");
            return;
        }

        if (!auth.currentUser) {
            alert("Vui lòng đăng nhập để sử dụng tính năng AI!");
            return;
        }

        // 2. Chuyển đổi UI sang trạng thái Loading chờ AI xử lý
        aiFormArea.style.display = 'none';
        aiLoadingSpinner.style.display = 'block';

        try {
            // --- 3. GỌI API VERCEL ĐỂ TẠO ĐỀ ---
            const response = await fetch('/api/generate', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    promptText: prompt, // Phải gửi đúng biến promptText cho Vercel nhận diện
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

            // --- 4. TẠO ID ĐỀ THI ---
            const examId = "AI-" + Math.random().toString(36).substring(2, 8).toUpperCase();

            // --- 5. LƯU TỪNG CÂU HỎI VÀO COLLECTION "questions" ---
            const savePromises = questions.map((q, i) => {
                const questionId = `${examId}-Q${i + 1}`;
                return setDoc(doc(db, "questions", questionId), {
                    examId: examId,
                    // Bọc thép dữ liệu: Quét mọi tên biến AI có thể nhả ra
                    text: q.text || q.questionText || q.question || q.content || "Lỗi: AI không có nội dung",
                    options: q.options || q.answers || [],
                    correctAnswer: q.correctAnswer !== undefined ? q.correctAnswer : (q.correct || 0),
                    explanation: q.explanation || "Không có giải thích chi tiết",
                    order: i + 1
                });
            });

            // Chờ lưu toàn bộ câu hỏi lên Firestore thành công
            await Promise.all(savePromises);

            // --- 6. GHI THÔNG TIN GÓI ĐỀ THI VÀO COLLECTION "exams" ---
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

            // --- 7. TẠO GIAO DIỆN LỰA CHỌN: "BẮT ĐẦU THI" HOẶC "LƯU ĐỀ" ---
            aiLoadingSpinner.style.display = 'none'; // Tắt vòng xoay chờ

            // Tạo khung giao diện chúc mừng
            const successArea = document.createElement('div');
            successArea.id = 'aiSuccessArea';
            successArea.innerHTML = `
                <div style="text-align: center; padding: 20px 0; animation: fadeIn 0.4s ease;">
                    <div style="font-size: 60px; margin-bottom: 10px;">🎉</div>
                    <h3 style="color: #1f2937; margin-bottom: 10px;">Tạo đề thi thành công!</h3>
                    <p style="color: #6b7280; margin-bottom: 25px;">Mã đề của bạn là: <strong style="color: #10b981;">${examId}</strong></p>
                    <div style="display: flex; gap: 15px; justify-content: center;">
                        <button id="btnCancelGoToQuiz" style="flex: 1; padding: 12px; border-radius: 8px; border: 1px solid #d1d5db; background: #f9fafb; color: #4b5563; font-weight: bold; cursor: pointer; transition: background 0.2s;">
                            Lưu đề
                        </button>
                        <button id="btnGoToQuiz" style="flex: 1; padding: 12px; border-radius: 8px; border: none; background: #10b981; color: white; font-weight: bold; cursor: pointer; box-shadow: 0 4px 10px rgba(16, 185, 129, 0.3); transition: transform 0.2s;">
                            Bắt đầu thi ngay
                        </button>
                    </div>
                </div>
            `;
            
            // Chèn khung này vào bên trong Modal (Ngay chỗ Form đã bị ẩn)
            aiFormArea.parentNode.appendChild(successArea);

            // Xử lý Sự kiện Nút "Lưu đề"
            document.getElementById('btnCancelGoToQuiz').onclick = () => {
                closeAiModal(); // Đóng popup
                // Cập nhật lại danh sách đề thi dưới nền để hiển thị ngay đề vừa tạo
                if (typeof window.loadAggregatedExamData === 'function') {
                    window.loadAggregatedExamData();
                } else {
                    location.reload(); 
                }
            };

            // Xử lý Sự kiện Nút "Bắt đầu thi ngay"
            document.getElementById('btnGoToQuiz').onclick = () => {
                // Đẩy người dùng thẳng vào phòng thi, mang theo mã đề thi
                window.location.href = `quiz.html?examId=${examId}`;
            };

        } catch (error) {
            console.error("Lỗi tạo đề thi AI:", error);
            alert("Đã xảy ra lỗi trong quá trình tạo đề bằng AI: " + error.message);
            resetAiForm(); // Nếu lỗi thì khôi phục lại Form nhập liệu để thử lại
        }
    });
}
