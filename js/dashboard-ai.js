import { auth, db } from "./dashboard-core.js";
import { doc, updateDoc, increment } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

document.addEventListener('ComponentsLoaded', () => {

    const btnAutoGenerate = document.getElementById('btnAutoGenerate');
    const mainContentWrap = document.getElementById('main-content-wrap'); 
    
    const aiSidebar = document.getElementById('aiSidebar');
    const closeAiSidebarBtn = document.getElementById('closeAiSidebarBtn');
    const aiChatBox = document.getElementById('aiChatBox');
    const aiChatInput = document.getElementById('aiChatInput');
    const btnSendAi = document.getElementById('btnSendAi');

    // Khởi tạo mảng lưu lịch sử trò chuyện
    let chatHistory = [];

    // Cập nhật lại UI nút bấm
    if (btnAutoGenerate) {
        btnAutoGenerate.innerHTML = '<i class="fa-solid fa-robot"></i> Trợ lý AI';
    }

    // Logic Đóng/Mở Slide-bar (Push Content)
    function toggleSidebar() {
        if (!aiSidebar) return;
        if (aiSidebar.classList.contains('active')) {
            aiSidebar.classList.remove('active');
            aiSidebar.style.right = '-400px';
            if (mainContentWrap) mainContentWrap.style.marginRight = '0';
        } else {
            aiSidebar.classList.add('active');
            aiSidebar.style.right = '0';
            if (mainContentWrap) mainContentWrap.style.marginRight = '400px';
        }
    }

    if (btnAutoGenerate) btnAutoGenerate.addEventListener('click', toggleSidebar);
    if (closeAiSidebarBtn) closeAiSidebarBtn.addEventListener('click', toggleSidebar);

    // Hàm chuyển đổi định dạng Markdown đơn giản (loại bỏ dấu * thừa)
    function parseMarkdown(text) {
        let html = text;
        // Xử lý tiêu đề (Headings)
        html = html.replace(/^#### (.*$)/gim, '<h4>$1</h4>');
        html = html.replace(/^### (.*$)/gim, '<h3>$1</h3>');
        html = html.replace(/^## (.*$)/gim, '<h2>$1</h2>');
        html = html.replace(/^# (.*$)/gim, '<h1>$1</h1>');
        // Xử lý in đậm
        html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        // Xử lý gạch đầu dòng (List)
        html = html.replace(/^\* (.*$)/gim, '<li>$1</li>');
        // Xử lý in nghiêng
        html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');
        // Xử lý ngắt dòng
        html = html.replace(/\n/g, '<br>');
        return html;
    }

    // Hàm render tin nhắn
    function appendMessage(sender, text) {
        if (!aiChatBox) return;
        const msgDiv = document.createElement('div');
        msgDiv.className = `chat-message ${sender}`;
        
        // Render có xử lý Markdown cho AI, không xử lý với Loader
        if (sender === 'ai' && !text.includes('Đang suy nghĩ')) {
            msgDiv.innerHTML = parseMarkdown(text);
        } else {
            msgDiv.innerHTML = text.replace(/\n/g, '<br>');
        }
        
        aiChatBox.appendChild(msgDiv);
        aiChatBox.scrollTop = aiChatBox.scrollHeight;
    }

    // Luồng Chat & Xử lý API
    if (btnSendAi) {
        btnSendAi.addEventListener('click', async () => {
            const prompt = aiChatInput.value.trim();
            if (!prompt) return;

            if (!auth.currentUser) {
                alert("Vui lòng đăng nhập để sử dụng Trợ lý AI!");
                return;
            }

            appendMessage('user', prompt);
            aiChatInput.value = '';

            // Cập nhật câu hỏi vào lịch sử (chuẩn cấu trúc API Gemini)
            chatHistory.push({
                role: "user",
                parts: [{ text: prompt }]
            });

            const loadingId = 'loading-' + Date.now();
            appendMessage('ai', `<span id="${loadingId}"><i class="fa-solid fa-circle-notch fa-spin"></i> Đang suy nghĩ...</span>`);

            try {
                const response = await fetch('/api/generate', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    // Gửi toàn bộ mảng lịch sử thay vì 1 câu prompt đơn
                    body: JSON.stringify({
                        history: chatHistory
                    })
                });

                const usedTokens = parseInt(response.headers.get('X-Token-Usage')) || 0; 
                
                const loadingEl = document.getElementById(loadingId);
                if (loadingEl) loadingEl.parentNode.remove();

                if (!response.ok) {
                    // Nếu lỗi, rút câu vừa hỏi ra khỏi lịch sử để tránh làm hỏng luồng chat
                    chatHistory.pop();
                    const errorData = await response.text();
                    if (response.status === 429 || errorData.includes('RESOURCE_EXHAUSTED') || errorData.includes('depleted')) {
                        throw new Error("Hệ thống Trợ lý AI đang quá tải hoặc hết hạn mức tài nguyên trong ngày. Vui lòng thử lại sau!");
                    }
                    throw new Error(`Lỗi hệ thống (${response.status}). Vui lòng liên hệ Admin.`);
                }

                const data = await response.json();
                const aiResponseText = data.response || "Lỗi không nhận được phản hồi.";
                
                appendMessage('ai', aiResponseText);

                // Lưu câu trả lời của AI vào lịch sử để duy trì mạch truyện
                chatHistory.push({
                    role: "model",
                    parts: [{ text: aiResponseText }]
                });

                // Vẫn giữ cơ chế lưu số Token đã dùng
                if (usedTokens > 0) {
                    try {
                        await updateDoc(doc(db, "users", auth.currentUser.uid), {
                            totalTokensUsed: increment(usedTokens)
                        });
                    } catch (tokenErr) {
                        console.warn("Chưa thể cập nhật Token cho User:", tokenErr);
                    }
                }

            } catch (error) {
                console.error("Lỗi AI Chat:", error);
                const loadingEl = document.getElementById(loadingId);
                if (loadingEl) loadingEl.parentNode.remove();
                appendMessage('ai error', "Lỗi kết nối AI: " + error.message);
            }
        });

        // Hỗ trợ nhấn Enter để gửi
        if (aiChatInput) {
            aiChatInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    btnSendAi.click();
                }
            });
        }
    }
});
