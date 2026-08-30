import { auth, db } from "./dashboard-core.js";
import { doc, updateDoc, increment } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

document.addEventListener('ComponentsLoaded', () => {

    const btnAutoGenerate = document.getElementById('btnAutoGenerate');
    const mainContentWrap = document.getElementById('main-content-wrap'); // Đảm bảo bạn bọc toàn bộ body vào thẻ id này
    
    // Yêu cầu bạn bổ sung các DOM này vào HTML
    const aiSidebar = document.getElementById('aiSidebar');
    const closeAiSidebarBtn = document.getElementById('closeAiSidebarBtn');
    const aiChatBox = document.getElementById('aiChatBox');
    const aiChatInput = document.getElementById('aiChatInput');
    const btnSendAi = document.getElementById('btnSendAi');

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

    // Hàm render tin nhắn
    function appendMessage(sender, text) {
        if (!aiChatBox) return;
        const msgDiv = document.createElement('div');
        msgDiv.className = `chat-message ${sender}`; // CSS cần định dạng 'user' và 'ai'
        
        // Render đơn giản (Nên dùng thư viện marked.js để render Markdown trên thực tế)
        msgDiv.innerHTML = text.replace(/\n/g, '<br>');
        
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

            const loadingId = 'loading-' + Date.now();
            appendMessage('ai', `<span id="${loadingId}"><i class="fa-solid fa-circle-notch fa-spin"></i> Đang suy nghĩ...</span>`);

            try {
                const response = await fetch('/api/generate', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        promptText: prompt,
                        action: 'chat' // Kích hoạt nhánh xử lý văn bản
                    })
                });

                const usedTokens = parseInt(response.headers.get('X-Token-Usage')) || 0; 
                
                const loadingEl = document.getElementById(loadingId);
                if (loadingEl) loadingEl.parentNode.remove();

                if (!response.ok) {
                    const errorData = await response.text();
                    throw new Error(`Lỗi gọi API (${response.status}): ${errorData}`);
                }

                const data = await response.json();
                appendMessage('ai', data.response || "Lỗi không nhận được phản hồi.");

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
