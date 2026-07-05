import { auth, db } from './dashboard-core.js';
import { collection, addDoc, doc, setDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// ==========================================
// 1. CẤU HÌNH API GEMINI
// ==========================================
const GEMINI_API_KEY = "AQ.Ab8RN6KDYMMLfGbBKyL7r_8BoQxsVxxS7zM5p_pK152_EIlnXQ";
const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=" + GEMINI_API_KEY;

// ==========================================
// 2. HÀM GỌI API VÀ LƯU DỮ LIỆU
// ==========================================
async function generateQuizFromAI(promptText, questionCount, difficulty) {
    const systemInstruction = `Bạn là một chuyên gia ra đề thi trắc nghiệm Y khoa. Hãy dựa vào nội dung sau để tạo ra đúng ${questionCount} câu hỏi trắc nghiệm ở mức độ ${difficulty}. 
QUY TẮC TỐI THƯỢNG: Chỉ trả về duy nhất một mảng JSON chuẩn, KHÔNG có text giải thích thừa, KHÔNG bọc trong markdown (\`\`\`json). 
Cấu trúc mỗi object trong mảng phải là: 
{ 
  "text": "Nội dung câu hỏi", 
  "options": ["Đáp án A", "Đáp án B", "Đáp án C", "Đáp án D"], 
  "correctAnswer": [chỉ số index từ 0 đến 3 của đáp án đúng], 
  "explanation": "Giải thích ngắn gọn tại sao đúng" 
}`;

    const requestBody = {
        contents: [{
            parts: [{
                text: promptText
            }]
        }],
        systemInstruction: {
            parts: [{
                text: systemInstruction
            }]
        },
        generationConfig: {
            responseMimeType: "application/json" // Ép hệ thống ưu tiên trả về JSON
        }
    };

    // 1. Gửi request lên Gemini API
    const response = await fetch(GEMINI_API_URL, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
        throw new Error("Lỗi kết nối tới API Gemini (Mã lỗi: " + response.status + ")");
    }

    const data = await response.json();
    let responseText = data.candidates[0].content.parts[0].text;

    // 2. Xử lý text để chống lỗi Markdown (Đề phòng AI vẫn vô tình bọc ```json)
    responseText = responseText.replace(/^```json\s*/, '').replace(/\s*```$/, '').trim();

    const questions = JSON.parse(responseText);

    if (!Array.isArray(questions) || questions.length === 0) {
        throw new Error("Dữ liệu trả về không đúng định dạng mảng hoặc bị rỗng.");
    }

    // 3. Tạo mã đề thi
    const examId = "AI-" + Date.now();
    
    // 4. Ghi thông tin đề thi vào collection "exams"
    await setDoc(doc(db, "exams", examId), {
        id: examId,
        technique: "AI Generate",
        level: difficulty,
        timeLimit: parseInt(questionCount), // Số câu hỏi cũng có thể coi là giới hạn thời gian (VD: 1 câu 1 phút)
        isVip: false,
        createdAt: new Date().toISOString()
    });

    // 5. Ghi danh sách câu hỏi vào collection "questions"
    const questionPromises = questions.map((q, index) => {
        return addDoc(collection(db, "questions"), {
            examId: examId,
            questionText: q.text,
            options: q.options,
            correctAnswer: q.correctAnswer,
            explanation: q.explanation,
            order: index + 1
        });
    });

    // Chạy song song tất cả các request đẩy câu hỏi lên Firestore
    await Promise.all(questionPromises);

    return examId;
}

// ==========================================
// 3. LOGIC XỬ LÝ UI MODAL & SỰ KIỆN
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    // Các phần tử DOM liên quan đến tính năng AI
    const btnAutoGenerate = document.getElementById('btnAutoGenerate');
    const aiGenerateModal = document.getElementById('aiGenerateModal');
    const closeAiModalBtn = document.getElementById('closeAiModalBtn');
    const btnCancelAi = document.getElementById('btnCancelAi');
    const btnSubmitAiGenerate = document.getElementById('btnSubmitAiGenerate');
    
    // Các phần tử bên trong Form
    const aiFormArea = document.getElementById('aiFormArea');
    const aiLoadingSpinner = document.getElementById('aiLoadingSpinner');
    const aiPromptInput = document.getElementById('aiPromptInput');
    const aiQuestionCount = document.getElementById('aiQuestionCount');
    const aiDifficulty = document.getElementById('aiDifficulty');

    // Mở Modal khi click vào nút "Tạo đề tự động"
    if (btnAutoGenerate) {
        btnAutoGenerate.addEventListener('click', () => {
            aiGenerateModal.classList.add('active');
        });
    }

    // Hàm đóng Modal và khôi phục trạng thái ban đầu của Form
    const closeAndResetModal = () => {
        aiGenerateModal.classList.remove('active');
        
        // Đợi hiệu ứng đóng modal (300ms) trước khi xóa dữ liệu để tránh giật UI
        setTimeout(() => {
            aiPromptInput.value = '';
            aiQuestionCount.value = '10';
            aiDifficulty.value = 'easy';
            aiFormArea.style.display = 'block';
            aiLoadingSpinner.style.display = 'none';
        }, 300);
    };

    // Lắng nghe sự kiện đóng Modal
    if (closeAiModalBtn) closeAiModalBtn.addEventListener('click', closeAndResetModal);
    if (btnCancelAi) btnCancelAi.addEventListener('click', closeAndResetModal);

    // Logic xử lý khi Submit yêu cầu tạo đề
    if (btnSubmitAiGenerate) {
        btnSubmitAiGenerate.addEventListener('click', async () => {
            const prompt = aiPromptInput.value.trim();
            const questionCount = aiQuestionCount.value;
            const difficulty = aiDifficulty.value;
            
            // Kiểm tra nhập liệu
            if (!prompt) {
                alert("Vui lòng nhập chủ đề hoặc dán tài liệu để AI có thể phân tích!");
                return;
            }

            // Ẩn form nhập liệu, hiện hiệu ứng Loading
            aiFormArea.style.display = 'none';
            aiLoadingSpinner.style.display = 'block';
            
            // Vô hiệu hóa nút bấm để tránh click nhiều lần
            btnSubmitAiGenerate.disabled = true;
            btnCancelAi.disabled = true;

            try {
                // Gọi tới hàm API AI thực tế
                const examId = await generateQuizFromAI(prompt, questionCount, difficulty);
                
                // Phục hồi lại giao diện sau khi tạo xong
                aiFormArea.style.display = 'block';
                aiLoadingSpinner.style.display = 'none';
                btnSubmitAiGenerate.disabled = false;
                btnCancelAi.disabled = false;
                
                // Hiển thị thông báo thành công và đóng Modal
                alert("Tạo đề tự động thành công!\nMã đề của bạn là: " + examId);
                closeAndResetModal();
                
            } catch (error) {
                console.error("Lỗi tạo đề AI:", error);
                alert("Đã xảy ra lỗi trong quá trình tạo đề: " + error.message);
                
                // Phục hồi lại giao diện để người dùng có thể thử lại
                aiFormArea.style.display = 'block';
                aiLoadingSpinner.style.display = 'none';
                btnSubmitAiGenerate.disabled = false;
                btnCancelAi.disabled = false;
            }
        });
    }
});
