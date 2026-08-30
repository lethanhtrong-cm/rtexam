import { auth, db } from "./dashboard-core.js";
import { doc, updateDoc, increment, getDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

document.addEventListener('ComponentsLoaded', () => {

    const btnAutoGenerate = document.getElementById('btnAutoGenerate');
    const mainContentWrap = document.getElementById('main-content-wrap'); 
    
    const aiSidebar = document.getElementById('aiSidebar');
    const closeAiSidebarBtn = document.getElementById('closeAiSidebarBtn');
    const aiChatBox = document.getElementById('aiChatBox');
    const aiChatInput = document.getElementById('aiChatInput');
    const btnSendAi = document.getElementById('btnSendAi');

    let chatHistory = [];
    let isFirstOpen = true;
    let globalAiTier = 'free'; // Biến toàn cục lưu trữ hạng tài khoản hiện tại cho module AI

    // ==========================================
    // TÍNH NĂNG: BỘ ĐẾM KÝ TỰ REAL-TIME
    // ==========================================
    const charCounter = document.createElement('div');
    charCounter.id = 'aiCharCounter';
    charCounter.style.cssText = "font-size: 0.8rem; color: #64748b; text-align: right; margin-top: 6px; padding-right: 5px; display: none; font-weight: 600; transition: color 0.2s;";
    charCounter.innerText = "0/1000";
    
    if (aiChatInput && aiChatInput.parentNode) {
        // Chèn bộ đếm ngay dưới ô nhập liệu
        aiChatInput.parentNode.insertBefore(charCounter, aiChatInput.nextSibling);
        
        // Lắng nghe sự kiện gõ phím
        aiChatInput.addEventListener('input', updateCharCounterUI);
    }

    function updateCharCounterUI() {
        if (!aiChatInput || !charCounter) return;
        const textLen = aiChatInput.value.trim().length;
        
        if (globalAiTier === 'pro') {
            // PRO: Ẩn bộ đếm, không giới hạn
            charCounter.style.display = 'none';
            if (btnSendAi) btnSendAi.disabled = false;
        } else {
            // FREE / PLUS: Hiển thị bộ đếm và kiểm tra
            charCounter.style.display = 'block';
            if (textLen > 1000) {
                charCounter.style.color = '#ef4444'; // Màu đỏ cảnh báo
                charCounter.innerText = `${textLen}/1000 (Vượt giới hạn)`;
                if (btnSendAi) btnSendAi.disabled = true; // Khóa nút gửi
            } else {
                charCounter.style.color = '#64748b'; // Màu xám bình thường
                charCounter.innerText = `${textLen}/1000`;
                if (btnSendAi) btnSendAi.disabled = false; // Mở khóa nút gửi
            }
        }
    }

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

    if (btnAutoGenerate) {
        btnAutoGenerate.innerHTML = '<i class="fa-solid fa-robot"></i> Trợ lý AI';
    }

    // ==========================================
    // TÍNH NĂNG: THAY ĐỔI KÍCH THƯỚC SIDEBAR
    // ==========================================
    if (aiSidebar) {
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
                loadChatHistory();
                isFirstOpen = false;
            }
        }
    }

    // ==========================================
    // POPUP UI FUNCTIONS
    // ==========================================
    function showRemainingQueriesPopup(remaining, maxLimit, tier) {
        const existingModal = document.getElementById('aiLimitInfoModal');
        if (existingModal) existingModal.remove();

        const popupHTML = `
            <div class="custom-modal-overlay" id="aiLimitInfoModal" style="display: flex; position: fixed; top: 0; left: 0; width: 100%; height: 100%; z-index: 100000; background: rgba(15, 23, 42, 0.7); backdrop-filter: blur(5px); justify-content: center; align-items: center;">
                <div class="custom-modal-content" style="max-width: 400px; width: 90%; background: #fff; border-radius: 16px; padding: 25px; text-align: center; box-shadow: 0 10px 30px rgba(0,0,0,0.2); animation: popIn 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);">
                    <div style="width: 60px; height: 60px; background: #eff6ff; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 15px;">
                        <i class="fa-solid fa-robot" style="font-size: 2rem; color: #3b82f6;"></i>
                    </div>
                    <h3 style="margin: 0 0 10px 0; color: #1e293b; font-size: 1.4rem;">Trợ lý AI Học thuật</h3>
                    <p style="color: #475569; font-size: 1rem; margin-bottom: 20px;">
                        Tài khoản <strong>${tier.toUpperCase()}</strong> của bạn còn <strong style="color: #2563eb; font-size: 1.2rem;">${remaining}</strong>/${maxLimit} lượt hỏi trong ngày hôm nay.
                    </p>
                    <div style="text-align: left; margin-bottom: 20px; font-size: 0.9rem; color: #64748b; display: flex; align-items: center; justify-content: center; gap: 8px;">
                        <input type="checkbox" id="chkHideAiPopup" style="cursor: pointer; width: 16px; height: 16px;">
                        <label for="chkHideAiPopup" style="cursor: pointer;">Không hiển thị lại thông báo này</label>
                    </div>
                    <div style="display: flex; gap: 10px;">
                        <button id="btnCancelAiPopup" style="flex: 1; padding: 12px; border-radius: 8px; border: 1px solid #cbd5e1; background: #fff; color: #475569; font-weight: 600; cursor: pointer; transition: 0.2s;">Hủy</button>
                        <button id="btnContinueAiPopup" style="flex: 1; padding: 12px; border-radius: 8px; border: none; background: #3b82f6; color: #fff; font-weight: 600; cursor: pointer; transition: 0.2s; box-shadow: 0 4px 10px rgba(59, 130, 246, 0.3);">Tiếp tục</button>
                    </div>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', popupHTML);

        const modal = document.getElementById('aiLimitInfoModal');
        document.getElementById('btnCancelAiPopup').onclick = () => modal.remove();
        document.getElementById('btnContinueAiPopup').onclick = () => {
            const isChecked = document.getElementById('chkHideAiPopup').checked;
            if (isChecked) {
                localStorage.setItem(`hideAiLimitPopup_${auth.currentUser.uid}`, 'true');
            }
            modal.remove();
            toggleSidebar();
        };
    }

    function showOutOfQueriesPopup(tier) {
        const existingModal = document.getElementById('aiOutOfQueriesModal');
        if (existingModal) existingModal.remove();

        const popupHTML = `
            <div class="custom-modal-overlay" id="aiOutOfQueriesModal" style="display: flex; position: fixed; top: 0; left: 0; width: 100%; height: 100%; z-index: 100000; background: rgba(15, 23, 42, 0.7); backdrop-filter: blur(5px); justify-content: center; align-items: center;">
                <div class="custom-modal-content" style="max-width: 400px; width: 90%; background: #fff; border-radius: 16px; padding: 25px; text-align: center; box-shadow: 0 10px 30px rgba(0,0,0,0.2); animation: popIn 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);">
                    <div style="width: 60px; height: 60px; background: #fef2f2; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 15px;">
                        <i class="fa-solid fa-clock-rotate-left" style="font-size: 2rem; color: #ef4444;"></i>
                    </div>
                    <h3 style="margin: 0 0 10px 0; color: #1e293b; font-size: 1.4rem;">Đã hết lượt hỏi hôm nay</h3>
                    <p style="color: #475569; font-size: 1rem; margin-bottom: 20px; line-height: 1.5;">
                        Tài khoản <strong>${tier.toUpperCase()}</strong> đã dùng hết số lượt hỏi AI. Hệ thống sẽ cấp lại lượt mới vào ngày mai. Hãy nâng cấp gói PRO để sử dụng không giới hạn!
                    </p>
                    <div style="display: flex; gap: 10px;">
                        <button id="btnCloseAiOutOfQueries" style="flex: 1; padding: 12px; border-radius: 8px; border: 1px solid #cbd5e1; background: #fff; color: #475569; font-weight: 600; cursor: pointer;">Đóng</button>
                        <button id="btnUpgradeAiOutOfQueries" style="flex: 1; padding: 12px; border-radius: 8px; border: none; background: linear-gradient(135deg, #f59e0b, #d97706); color: #fff; font-weight: 600; cursor: pointer; box-shadow: 0 4px 10px rgba(245, 158, 11, 0.3);"><i class="fa-solid fa-crown"></i> Nâng cấp ngay</button>
                    </div>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', popupHTML);

        const modal = document.getElementById('aiOutOfQueriesModal');
        document.getElementById('btnCloseAiOutOfQueries').onclick = () => modal.remove();
        document.getElementById('btnUpgradeAiOutOfQueries').onclick = () => {
            modal.remove();
            document.getElementById('btnUpgradeHeader')?.click(); 
        };
    }

    // ==========================================
    // KIỂM TRA QUYỀN TRƯỚC KHI MỞ SIDEBAR
    // ==========================================
    if (btnAutoGenerate) {
        btnAutoGenerate.addEventListener('click', async (e) => {
            e.preventDefault();
            
            if (aiSidebar && aiSidebar.classList.contains('active')) {
                toggleSidebar();
                return;
            }

            if (!auth.currentUser) {
                alert("Vui lòng đăng nhập để sử dụng Trợ lý AI!");
                return;
            }

            const btnOriginalText = btnAutoGenerate.innerHTML;
            btnAutoGenerate.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Kiểm tra...';

            try {
                const userSnap = await getDoc(doc(db, "users", auth.currentUser.uid));
                btnAutoGenerate.innerHTML = btnOriginalText;

                if (userSnap.exists()) {
                    const userData = userSnap.data();
                    const tier = userData.vipTier || 'free';
                    globalAiTier = tier; // Cập nhật biến toàn cục
                    updateCharCounterUI(); // Cập nhật ngay bộ đếm ký tự

                    let maxLimit = 1; 
                    if (tier === 'plus') maxLimit = 3;
                    if (tier === 'pro') maxLimit = Infinity;

                    let usedCount = 0;
                    const todayStr = new Date().toLocaleDateString('en-CA');
                    if (userData.aiLastUsedDate === todayStr) {
                        usedCount = userData.aiDailyCount || 0;
                    }

                    const remaining = maxLimit - usedCount;

                    if (tier === 'pro') {
                        toggleSidebar();
                        return;
                    }

                    if (remaining <= 0) {
                        showOutOfQueriesPopup(tier);
                    } else {
                        const hidePopupPref = localStorage.getItem(`hideAiLimitPopup_${auth.currentUser.uid}`);
                        if (hidePopupPref === 'true') {
                            toggleSidebar();
                        } else {
                            showRemainingQueriesPopup(remaining, maxLimit, tier);
                        }
                    }
                } else {
                    alert("Không tìm thấy dữ liệu người dùng!");
                }
            } catch (error) {
                console.error("Lỗi kiểm tra quyền hạn AI:", error);
                btnAutoGenerate.innerHTML = btnOriginalText;
                alert("Đã xảy ra lỗi kiểm tra hệ thống. Vui lòng thử lại!");
            }
        });
    }

    if (closeAiSidebarBtn) closeAiSidebarBtn.addEventListener('click', toggleSidebar);

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

    function appendMessage(sender, text) {
        if (!aiChatBox) return;

        if (sender === 'ai' && !text.includes('Đang suy nghĩ')) {
            const wrapperDiv = document.createElement('div');
            wrapperDiv.style.display = 'flex';
            wrapperDiv.style.flexDirection = 'column';
            wrapperDiv.style.alignSelf = 'flex-start';
            wrapperDiv.style.maxWidth = '85%';
            wrapperDiv.style.marginBottom = '15px';

            const msgDiv = document.createElement('div');
            msgDiv.className = `chat-message ${sender}`;
            msgDiv.style.marginBottom = '4px'; 
            msgDiv.style.maxWidth = '100%'; 
            msgDiv.innerHTML = parseMarkdown(text);
            
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

            actionRow.appendChild(copyBtn);
            wrapperDiv.appendChild(msgDiv);
            wrapperDiv.appendChild(actionRow);
            aiChatBox.appendChild(wrapperDiv);

        } else {
            const msgDiv = document.createElement('div');
            msgDiv.className = `chat-message ${sender}`;
            msgDiv.innerHTML = text.replace(/\n/g, '<br>');
            aiChatBox.appendChild(msgDiv);
        }
        
        aiChatBox.scrollTop = aiChatBox.scrollHeight;
    }

    // ==========================================
    // LUỒNG CHAT & CALL API
    // ==========================================
    if (btnSendAi) {
        btnSendAi.addEventListener('click', async () => {
            const prompt = aiChatInput.value.trim();
            if (!prompt) return;

            if (!auth.currentUser) {
                alert("Vui lòng đăng nhập để sử dụng Trợ lý AI!");
                return;
            }

            // Chặn gửi nếu Free/Plus nhập quá giới hạn
            if (globalAiTier !== 'pro' && prompt.length > 1000) {
                alert("Câu hỏi của bạn quá dài (vượt quá 1.000 ký tự). Vui lòng tóm tắt lại nội dung để gửi!");
                return;
            }

            btnSendAi.disabled = true;
            let currentAiCount = 0;
            let todayStr = new Date().toLocaleDateString('en-CA');
            let isUserPro = false;
            let maxLimit = 1; 

            try {
                const userSnap = await getDoc(doc(db, "users", auth.currentUser.uid));
                if (userSnap.exists()) {
                    const userData = userSnap.data();
                    const tier = userData.vipTier || 'free';
                    globalAiTier = tier; // Cập nhật lại đề phòng user vừa nâng cấp
                    updateCharCounterUI(); 
                    
                    isUserPro = (tier === 'pro');
                    if (tier === 'plus') maxLimit = 3;
                    if (tier === 'pro') maxLimit = Infinity;
                    
                    if (!isUserPro) {
                        const lastDate = userData.aiLastUsedDate || '';
                        currentAiCount = (lastDate === todayStr) ? (userData.aiDailyCount || 0) : 0;
                        
                        if (currentAiCount >= maxLimit) {
                            alert("Bạn đã hết lượt hỏi AI trong ngày hôm nay!");
                            btnSendAi.disabled = false;
                            return; 
                        }
                    }
                }
            } catch (err) {
                console.error("Lỗi kiểm tra quyền hạn AI:", err);
            }

            appendMessage('user', prompt);
            aiChatInput.value = '';
            updateCharCounterUI(); // Reset bộ đếm về 0 sau khi gửi
            btnSendAi.disabled = false;

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
                    chatHistory.pop(); 
                    saveChatHistory(); 
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

                if (chatHistory.length > 6) {
                    chatHistory = chatHistory.slice(-6);
                }

                saveChatHistory(); 

                if (usedTokens > 0) {
                    try {
                        let updateData = { totalTokensUsed: increment(usedTokens) };
                        if (!isUserPro) {
                            updateData.aiDailyCount = currentAiCount + 1;
                            updateData.aiLastUsedDate = todayStr;
                        }
                        await updateDoc(doc(db, "users", auth.currentUser.uid), updateData);
                        
                        if (!isUserPro && (currentAiCount + 1 >= maxLimit)) {
                            setTimeout(() => appendMessage('ai', "💡 *Ghi chú hệ thống: Bạn đã sử dụng hết lượt hỏi AI miễn phí trong ngày hôm nay.*"), 1000);
                        }
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
