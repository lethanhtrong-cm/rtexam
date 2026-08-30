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

    // ==========================================
    // TÍNH NĂNG 1: THAY ĐỔI KÍCH THƯỚC SIDEBAR
    // ==========================================
    if (aiSidebar) {
        // Tạo thanh kéo (resizer) ở viền trái
        const resizer = document.createElement('div');
        resizer.style.width = '6px';
        resizer.style.height = '100%';
        resizer.style.position = 'absolute';
        resizer.style.top = '0';
        resizer.style.left = '0';
        resizer.style.cursor = 'col-resize';
        resizer.style.backgroundColor = 'transparent';
        resizer.style.zIndex = '10000';
        resizer.style.transition = 'background-color 0.2s';
        
        // Hiệu ứng hover cho thanh kéo
        resizer.addEventListener('mouseenter', () => resizer.style.backgroundColor = '#cbd5e1');
        resizer.addEventListener('mouseleave', () => resizer.style.backgroundColor = 'transparent');
        
        aiSidebar.appendChild(resizer);

        let isResizing = false;

        resizer.addEventListener('mousedown', (e) => {
            isResizing = true;
            document.body.style.cursor = 'col-resize';
            e.preventDefault(); // Ngăn hiện tượng bôi đen text khi kéo chuột
        });

        document.addEventListener('mousemove', (e) => {
            if (!isResizing) return;
            // Tính toán độ rộng mới = Tổng chiều rộng màn hình - Tọa độ X của chuột
            let newWidth = window.innerWidth - e.clientX;
            
            // Giới hạn độ rộng (tối thiểu 320px, tối đa 80% màn hình)
            if (newWidth < 320) newWidth = 320;
            if (newWidth > window.innerWidth * 0.8) newWidth = window.innerWidth * 0.8;
            
            aiSidebar.style.width = `${newWidth}px`;
            
            // Nếu đang mở, đẩy mainContentWrap theo kích thước mới
            if (aiSidebar.classList.contains('active') && mainContentWrap) {
                mainContentWrap.style.marginRight = `${newWidth}px`;
            }
        });

        document.addEventListener('mouseup', () => {
            if (isResizing) {
                isResizing = false;
                document.body.style.cursor = 'default';
            }
        });
    }

    // Logic Đóng/Mở Slide-bar cập nhật theo chiều rộng động
    function toggleSidebar() {
        if (!aiSidebar) return;
        // Lấy chiều rộng hiện tại (hoặc 400 mặc định)
        const currentWidth = aiSidebar.offsetWidth || 400;
        
        if (aiSidebar.classList.contains('active')) {
            aiSidebar.classList.remove('active');
            aiSidebar.style.right = `-${currentWidth + 20}px`; // Đẩy ra ngoài màn hình
            if (mainContentWrap) mainContentWrap.style.marginRight = '0';
        } else {
            aiSidebar.classList.add('active');
            aiSidebar.style.right = '0';
            if (mainContentWrap) mainContentWrap.style.marginRight = `${currentWidth}px`;
        }
    }

    if (btnAutoGenerate) btnAutoGenerate.addEventListener('click', toggleSidebar);
    if (closeAiSidebarBtn) closeAiSidebarBtn.addEventListener('click', toggleSidebar);

    // Hàm chuyển đổi định dạng Markdown đơn giản
    function parseMarkdown(text) {
        let html = text;
        html = html.replace(/^#### (.*$)/gim, '<h4>$1</h4>');
        html = html.replace(/^### (.*$)/gim, '<h3>$1</h3>');
        html = html.replace(/^## (.*$)/gim, '<h2>$1</h2>');
        html = html.replace(/^# (.*$)/gim, '<h1>$1</h1>');
        html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        html = html.replace(/^\* (.*$)/gim, '<li>$1</li>');
        html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');
        html = html.replace(/\n/g, '<br>');
        return html;
    }

    // Hàm render tin nhắn
    function appendMessage(sender, text) {
        if (!aiChatBox) return;
        const msgDiv = document.createElement('div');
        msgDiv.className = `chat-message ${sender}`;
        msgDiv.style.position = 'relative'; // Cần thiết để neo nút Copy
        
        // Chỉ xử lý với tin nhắn hoàn thiện của AI
        if (sender === 'ai' && !text.includes('Đang suy nghĩ')) {
            msgDiv.innerHTML = parseMarkdown(text);
            msgDiv.style.paddingRight = '35px'; // Tránh chữ đè lên nút copy
            
            // ==========================================
            // TÍNH NĂNG 2: NÚT COPY CHO AI
            // ==========================================
            const copyBtn = document.createElement('button');
            copyBtn.innerHTML = '<i class="fa-regular fa-copy"></i>';
            copyBtn.title = "Sao chép câu trả lời";
            
            // Chỉnh style trực tiếp cho nút copy
            Object.assign(copyBtn.style, {
                position: 'absolute',
                top: '8px',
                right: '8px',
                background: 'transparent',
                border: 'none',
                color: '#64748b',
                cursor: 'pointer',
                fontSize: '1rem',
                transition: 'color 0.2s'
            });
            
            copyBtn.addEventListener('mouseenter', () => copyBtn.style.color = '#084298');
            copyBtn.addEventListener('mouseleave', () => copyBtn.style.color = '#64748b');

            // Xử lý sự kiện khi bấm Copy
            copyBtn.addEventListener('click', async () => {
                try {
                    // Copy văn bản text thô ban đầu (chưa bị biến thành thẻ HTML)
                    await navigator.clipboard.writeText(text); 
                    
                    // Đổi icon thành dấu Check để báo thành công
                    copyBtn.innerHTML = '<i class="fa-solid fa-check" style="color: #10b981;"></i>';
                    
                    // Trả lại icon cũ sau 2 giây
                    setTimeout(() => {
                        copyBtn.innerHTML = '<i class="fa-regular fa-copy"></i>';
                    }, 2000);
                } catch (err) {
                    console.error('Lỗi khi copy:', err);
                }
            });

            msgDiv.appendChild(copyBtn);
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
