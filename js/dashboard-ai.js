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
    let isFirstOpen = true;

    // ==========================================
    // TÍNH NĂNG: LƯU & TẢI LỊCH SỬ TRÒ CHUYỆN
    // ==========================================
    const getHistoryKey = () => auth.currentUser ? `ai_chat_history_${auth.currentUser.uid}` : 'ai_chat_history_guest';
    
    function saveChatHistory() {
        localStorage.setItem(getHistoryKey(), JSON.stringify(chatHistory));
    }

    function loadChatHistory() {
        const saved = localStorage.getItem(getHistoryKey());
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                if (Array.isArray(parsed) && parsed.length > 0) {
                    chatHistory = parsed;
                    
                    const divider = document.createElement('div');
                    divider.style.textAlign = 'center';
                    divider.style.margin = '15px 0';
                    divider.style.fontSize = '0.85rem';
                    divider.style.color = '#94a3b8';
                    divider.style.fontStyle = 'italic';
                    divider.innerHTML = '--- Lịch sử trò chuyện trước đó ---';
                    aiChatBox.appendChild(divider);

                    // Khôi phục lại các tin nhắn cũ
                    parsed.forEach(msg => {
                        const sender = msg.role === 'user' ? 'user' : 'ai';
                        appendMessage(sender, msg.parts[0].text);
                    });
                }
            } catch(e) { 
                console.error("Lỗi tải lịch sử chat:", e); 
            }
        }
    }

    // Cập nhật lại UI nút bấm
    if (btnAutoGenerate) {
        btnAutoGenerate.innerHTML = '<i class="fa-solid fa-robot"></i> Trợ lý AI';
    }

    // ==========================================
    // TÍNH NĂNG: THAY ĐỔI KÍCH THƯỚC SIDEBAR
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
            e.preventDefault(); 
        });

        document.addEventListener('mousemove', (e) => {
            if (!isResizing) return;
            let newWidth = window.innerWidth - e.clientX;
            
            // Giới hạn độ rộng (tối thiểu 320px, tối đa 80% màn hình)
            if (newWidth < 320) newWidth = 320;
            if (newWidth > window.innerWidth * 0.8) newWidth = window.innerWidth * 0.8;
            
            aiSidebar.style.width = `${newWidth}px`;
            
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

    // Logic Đóng/Mở Slide-bar
    function toggleSidebar() {
        if (!aiSidebar) return;
        const currentWidth = aiSidebar.offsetWidth || 400;
        
        if (aiSidebar.classList.contains('active')) {
            aiSidebar.classList.remove('active');
            aiSidebar.style.right = `-${currentWidth + 20}px`; 
            if (mainContentWrap) mainContentWrap.style.marginRight = '0';
        } else {
            aiSidebar.classList.add('active');
            aiSidebar.style.right = '0';
            if (mainContentWrap) mainContentWrap.style.marginRight = `${currentWidth}px`;
            
            // Lần đầu tiên mở sidebar: Thêm mẹo và load lịch sử
            if (isFirstOpen) {
                const hintDiv = document.createElement('div');
                hintDiv.style.backgroundColor = '#e0f2fe';
                hintDiv.style.color = '#0369a1';
                hintDiv.style.padding = '12px 16px';
                hintDiv.style.margin = '10px 20px 20px 20px'; 
                hintDiv.style.borderRadius = '8px';
                hintDiv.style.fontSize = '0.85rem';
                hintDiv.style.lineHeight = '1.4';
                hintDiv.style.border = '1px solid #bae6fd';
                hintDiv.innerHTML = '<i class="fa-solid fa-arrows-left-right" style="color: #0ea5e9; margin-right: 5px;"></i> <b>Mẹo nhỏ:</b> Bạn có thể nhấn giữ và kéo viền bên trái của cửa sổ này để thay đổi kích thước theo ý thích nhé!';
                
                aiChatBox.appendChild(hintDiv);
                
                // Tải lịch sử ngay sau khi hiển thị mẹo
                loadChatHistory();
                isFirstOpen = false;
            }
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

        // Xử lý riêng cho AI để tách nút Copy xuống bên dưới
        if (sender === 'ai' && !text.includes('Đang suy nghĩ')) {
            // Wrapper chứa cả khung chat và nút copy
            const wrapperDiv = document.createElement('div');
            wrapperDiv.style.display = 'flex';
            wrapperDiv.style.flexDirection = 'column';
            wrapperDiv.style.alignSelf = 'flex-start'; // Căn lề trái
            wrapperDiv.style.maxWidth = '85%';
            wrapperDiv.style.marginBottom = '15px';

            // Khung chat chính
            const msgDiv = document.createElement('div');
            msgDiv.className = `chat-message ${sender}`;
            msgDiv.style.marginBottom = '4px'; // Khoảng cách nhỏ với nút Copy bên dưới
            msgDiv.style.maxWidth = '100%'; // Chiếm hết bề ngang của wrapper
            msgDiv.innerHTML = parseMarkdown(text);
            
            // Khu vực chứa nút chức năng (bên dưới ngoài khung chat)
            const actionRow = document.createElement('div');
            actionRow.style.paddingLeft = '5px';
            
            const copyBtn = document.createElement('button');
            copyBtn.innerHTML = '<i class="fa-regular fa-copy"></i> Sao chép';
            
            Object.assign(copyBtn.style, {
                background: 'transparent',
                border: 'none',
                color: '#64748b',
                cursor: 'pointer',
                fontSize: '0.85rem',
                transition: 'color 0.2s',
                display: 'flex',
                alignItems: 'center',
                gap: '5px'
            });
            
            copyBtn.addEventListener('mouseenter', () => copyBtn.style.color = '#084298');
            copyBtn.addEventListener('mouseleave', () => copyBtn.style.color = '#64748b');

            copyBtn.addEventListener('click', async () => {
                try {
                    // Loại bỏ hoàn toàn dấu sao (*) và dấu thăng (#) trước khi copy
                    const cleanText = text.replace(/[*#]/g, ''); 
                    
                    await navigator.clipboard.writeText(cleanText); 
                    copyBtn.innerHTML = '<i class="fa-solid fa-check" style="color: #10b981;"></i> Đã chép';
                    setTimeout(() => {
                        copyBtn.innerHTML = '<i class="fa-regular fa-copy"></i> Sao chép';
                    }, 2000);
                } catch (err) {
                    console.error('Lỗi khi copy:', err);
                }
            });

            // Gắn vào Wrapper
            actionRow.appendChild(copyBtn);
            wrapperDiv.appendChild(msgDiv);
            wrapperDiv.appendChild(actionRow);
            
            aiChatBox.appendChild(wrapperDiv);

        } else {
            // Xử lý mặc định cho User hoặc thông báo "Đang suy nghĩ..."
            const msgDiv = document.createElement('div');
            msgDiv.className = `chat-message ${sender}`;
            msgDiv.innerHTML = text.replace(/\n/g, '<br>');
            aiChatBox.appendChild(msgDiv);
        }
        
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

            chatHistory.push({
                role: "user",
                parts: [{ text: prompt }]
            });
            saveChatHistory(); 

            const loadingId = 'loading-' + Date.now();
            appendMessage('ai', `<span id="${loadingId}"><i class="fa-solid fa-circle-notch fa-spin"></i> Đang suy nghĩ...</span>`);

            try {
                const response = await fetch('/api/generate', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        history: chatHistory
                    })
                });

                const usedTokens = parseInt(response.headers.get('X-Token-Usage')) || 0; 
                
                const loadingEl = document.getElementById(loadingId);
                if (loadingEl) loadingEl.parentNode.remove();

                if (!response.ok) {
                    chatHistory.pop(); // Xóa lỗi ra khỏi lịch sử
                    saveChatHistory(); // Cập nhật lại
                    const errorData = await response.text();
                    if (response.status === 429 || errorData.includes('RESOURCE_EXHAUSTED') || errorData.includes('depleted')) {
                        throw new Error("Hệ thống Trợ lý AI đang quá tải hoặc hết hạn mức tài nguyên trong ngày. Vui lòng thử lại sau!");
                    }
                    throw new Error(`Lỗi hệ thống (${response.status}). Vui lòng liên hệ Admin.`);
                }

                const data = await response.json();
                const aiResponseText = data.response || "Lỗi không nhận được phản hồi.";
                
                appendMessage('ai', aiResponseText);

                chatHistory.push({
                    role: "model",
                    parts: [{ text: aiResponseText }]
                });

                // Giới hạn bộ nhớ: Chỉ giữ lại 6 tin nhắn (3 vòng hỏi-đáp) mới nhất để tiết kiệm chi phí API
                if (chatHistory.length > 6) {
                    chatHistory = chatHistory.slice(-6);
                }

                saveChatHistory(); // Lưu ngay khi AI trả lời thành công

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
