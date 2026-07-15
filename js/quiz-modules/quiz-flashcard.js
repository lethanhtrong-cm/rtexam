import { doc, getDoc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

let aiFlashcardsData = [];
let currentFlashcardIndex = 0;

export function initFlashcard(db, getContext) {
    const fcModal = document.getElementById('flashcard-modal');
    const fcLoading = document.getElementById('flashcard-loading');
    const fcWorkspace = document.getElementById('flashcard-workspace');
    const fcScene = document.getElementById('fc-scene');
    const fcFrontText = document.getElementById('fc-front-text');
    const fcBackText = document.getElementById('fc-back-text');
    const fcProgressText = document.getElementById('fc-progress-text');
    const btnFcPrev = document.getElementById('btn-fc-prev');
    const btnFcNext = document.getElementById('btn-fc-next');
    const btnCreateFlashcard = document.getElementById('btn-create-flashcard');

    if (!btnCreateFlashcard || !fcModal) return null;

    btnCreateFlashcard.addEventListener('click', async () => {
        const ctx = getContext();
        document.getElementById('result-modal').classList.remove('active'); 
        fcModal.classList.add('active');
        
        const examCodeDisplay = document.getElementById('fc-exam-code-display');
        if (examCodeDisplay) examCodeDisplay.innerText = "Mã đề: " + ctx.currentExamId;
        
        if (aiFlashcardsData.length > 0) {
            renderCurrentFlashcard();
            fcLoading.style.display = 'none';
            fcWorkspace.style.display = 'block';
            return;
        }

        fcLoading.style.display = 'block';
        fcWorkspace.style.display = 'none';

        try {
            // 1. KIỂM TRA BỘ NHỚ ĐỆM CACHE FIRESTORE
            const flashcardRef = doc(db, "flashcards", ctx.currentExamId);
            const flashcardSnap = await getDoc(flashcardRef);

            if (flashcardSnap.exists()) {
                console.log("Tìm thấy Flashcard trong Cache!");
                aiFlashcardsData = flashcardSnap.data().cards;
                
                if (aiFlashcardsData && aiFlashcardsData.length > 0) {
                    currentFlashcardIndex = 0;
                    renderCurrentFlashcard();
                    fcLoading.style.display = 'none';
                    fcWorkspace.style.display = 'block';
                    return;
                }
            }

            // 2. NẾU CHƯA CÓ TRONG CACHE -> GỌI API GEMINI
            console.log("Đang tổng hợp Flashcard mới...");
            let promptString = ctx.questions.map((q, idx) => {
                const correctOpt = q.options ? q.options[q.correctAnswer] : '';
                return `[Câu ${idx + 1}] Hỏi: ${q.text} | Đáp án đúng: ${correctOpt} | Giải thích: ${q.explanation || 'Không có'}`;
            }).join('\n\n');

            const response = await fetch('/api/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ promptText: promptString, action: 'flashcard' })
            });

            if (!response.ok) throw new Error("Lỗi khi kết nối với AI Backend.");
            
            aiFlashcardsData = await response.json();
            if (!Array.isArray(aiFlashcardsData) || aiFlashcardsData.length === 0) {
                throw new Error("AI không thể tạo Flashcard từ đề thi này.");
            }

            // 3. LƯU KẾT QUẢ VÀO FIRESTORE ĐỂ CÁC LẦN SAU DÙNG LẠI
            await setDoc(flashcardRef, {
                examId: ctx.currentExamId,
                cards: aiFlashcardsData,
                createdBy: ctx.currentUser ? ctx.currentUser.email : "system",
                createdAt: serverTimestamp()
            });

            currentFlashcardIndex = 0;
            renderCurrentFlashcard();
            
            fcLoading.style.display = 'none';
            fcWorkspace.style.display = 'block';

        } catch (error) {
            console.error("Flashcard Error:", error);
            fcModal.classList.remove('active');
            if (ctx.currentMode !== 'flashcard') {
                document.getElementById('result-modal').classList.add('active'); 
            }
            ctx.showToast("Lỗi khi tạo Flashcard: " + error.message);
        }
    });

    function renderCurrentFlashcard() {
        if (aiFlashcardsData.length === 0) return;
        
        fcScene.classList.remove('is-flipped');
        
        setTimeout(() => {
            const card = aiFlashcardsData[currentFlashcardIndex];
            fcFrontText.innerText = card.front || "Nội dung mặt trước trống";
            fcBackText.innerText = card.back || "Nội dung mặt sau trống";
            fcProgressText.innerText = `${currentFlashcardIndex + 1} / ${aiFlashcardsData.length}`;
            
            btnFcPrev.disabled = currentFlashcardIndex === 0;
            btnFcNext.disabled = currentFlashcardIndex === aiFlashcardsData.length - 1;
            btnFcPrev.style.opacity = btnFcPrev.disabled ? "0.3" : "1";
            btnFcNext.style.opacity = btnFcNext.disabled ? "0.3" : "1";
        }, 150); 
    }

    fcScene.addEventListener('click', () => fcScene.classList.toggle('is-flipped'));

    btnFcNext.addEventListener('click', () => {
        if (currentFlashcardIndex < aiFlashcardsData.length - 1) {
            currentFlashcardIndex++;
            renderCurrentFlashcard();
        }
    });

    btnFcPrev.addEventListener('click', () => {
        if (currentFlashcardIndex > 0) {
            currentFlashcardIndex--;
            renderCurrentFlashcard();
        }
    });

    document.getElementById('close-flashcard-btn').addEventListener('click', () => {
        const ctx = getContext();
        fcModal.classList.remove('active');
        if (ctx.currentMode === 'flashcard') {
            window.close(); 
            ctx.returnToLobbyOrDashboard(); 
        } else {
            document.getElementById('result-modal').classList.add('active'); 
        }
    });

    // Trả về hàm cho bên ngoài gọi (Trigger click ẩn)
    return {
        triggerCreate: () => btnCreateFlashcard.click()
    };
}
