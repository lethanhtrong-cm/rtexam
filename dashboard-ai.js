import { auth, db } from './dashboard-core.js';
import { collection, addDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

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
        btnSubmitAiGenerate.addEventListener('click', () => {
            const prompt = aiPromptInput.value.trim();
            
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

            // Giả lập độ trễ khi kết nối API (3 giây)
            setTimeout(() => {
                // Phục hồi lại giao diện sau khi giả lập xong
                aiFormArea.style.display = 'block';
                aiLoadingSpinner.style.display = 'none';
                btnSubmitAiGenerate.disabled = false;
                btnCancelAi.disabled = false;
                
                // Hiển thị thông báo và đóng Modal
                alert("Tính năng AI đang được kết nối API!");
                closeAndResetModal();
            }, 3000);
        });
    }
});
