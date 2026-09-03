import { auth, db } from "./dashboard-core.js";
import { doc, updateDoc, increment, getDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// ĐÃ SỬA: Import 2 module vừa được chia nhỏ
import { injectAICSS, updateQueryCounterDisplay, showRemainingQueriesPopup, showOutOfQueriesPopup } from "./dashboard-ai/ui-modals.js";
import { appendMessage, saveChatHistory, loadChatHistory } from "./dashboard-ai/chat-logic.js";

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
    let globalAiTier = 'free'; 
    let isFullscreen = false;
    let savedSidebarWidth = '';

    // Khởi tạo giao diện CSS
    injectAICSS();

    // ==========================================
    // TÍNH NĂNG: BỘ ĐẾM KÝ TỰ & GỢI Ý CÂU HỎI
    // ==========================================
    const charCounter = document.createElement('div');
    charCounter.id = 'aiCharCounter';
    charCounter.style.cssText = "font-size: 0.8rem; color: #64748b; text-align: right; margin-top: 6px; padding-right: 5px; display: none; font-weight: 600; transition: color 0.2s;";
    charCounter.innerText = "0/1000";

    const quickPromptsWrapper = document.createElement('div');
    quickPromptsWrapper.style.cssText = "padding: 5px 15px; margin-bottom: 2px; border-top: 1px solid #e2e8f0; background: #f8fafc;";
    const promptsContainer = document.createElement('div');
    promptsContainer.className = 'quick-prompts-container';
    
    const prompts = [
        "Phân tích ưu điểm CT đếm Photon",
        "So sánh xung T1W và T2W",
        "Giải thích cơ chế ảnh CCTA"
    ];
    
    prompts.forEach(p => {
        const chip = document.createElement('button');
        chip.className = 'quick-prompt-chip';
        chip.innerText = p;
        chip.addEventListener('click', (e) => {
            e.preventDefault();
            aiChatInput.value = p;
            updateCharCounterUI();
            aiChatInput.focus();
        });
        promptsContainer.appendChild(chip);
    });
    quickPromptsWrapper.appendChild(promptsContainer);

    if (aiChatInput && aiChatInput.parentNode) {
        aiChatInput.setAttribute('maxlength', '1000');
        const inputContainer = aiChatInput.parentNode;
        if (inputContainer && inputContainer.parentNode) {
            inputContainer.parentNode.insertBefore(quickPromptsWrapper, inputContainer);
        }
        inputContainer.insertBefore(charCounter, aiChatInput.nextSibling);
        aiChatInput.addEventListener('input', updateCharCounterUI);
    }

    function updateCharCounterUI() {
        if (!aiChatInput || !charCounter) return;
        const textLen = aiChatInput.value.trim().length;
        
        if (globalAiTier === 'pro') {
            charCounter.style.display = 'none';
            if (btnSendAi) btnSendAi.disabled = false;
        } else {
            charCounter.style.display = 'block';
            if (textLen > 1000) {
                charCounter.style.color = '#ef4444'; 
                charCounter.innerText = `${textLen}/1000 (Vượt giới hạn)`;
                if (btnSendAi) btnSendAi.disabled = true; 
            } else {
                charCounter.style.color = '#64748b'; 
                charCounter.innerText = `${textLen}/1000`;
                if (btnSendAi) btnSendAi.disabled = false; 
            }
        }
    }

    // ==========================================
    // TÍNH NĂNG: CUỘN XUỐNG CUỐI
    // ==========================================
    const scrollBtn = document.createElement('button');
    scrollBtn.className = 'scroll-bottom-btn';
    scrollBtn.innerHTML = '<i class="fa-solid fa-arrow-down"></i>';
    if (aiSidebar) {
        aiSidebar.appendChild(scrollBtn);
    }
    if (aiChatBox) {
        aiChatBox.addEventListener('scroll', () => {
            if (aiChatBox.scrollHeight - aiChatBox.scrollTop - aiChatBox.clientHeight > 150) {
                scrollBtn.style.display = 'flex';
            } else {
                scrollBtn.style.display = 'none';
            }
        });
    }
    scrollBtn.addEventListener('click', (e) => {
        e.preventDefault();
        aiChatBox.scrollTo({ top: aiChatBox.scrollHeight, behavior: 'smooth' });
    });

    // ==========================================
    // CÁC NÚT TRÊN HEADER SIDEBAR
    // ==========================================
    const queryCounterUI = document.createElement('div');
    queryCounterUI.id = 'aiQueryCounterUI';
    queryCounterUI.style.cssText = "font-size: 0.85rem; padding: 5px 12px; border-radius: 20px; display: none; align-items: center; gap: 8px; font-weight: 700; margin-left: auto; background: rgba(255, 255, 255, 0.15); border: 1px solid rgba(255, 255, 255, 0.3); color: white; white-space: nowrap; flex-shrink: 0;";

    const clearChatBtn = document.createElement('button');
    clearChatBtn.id = 'clearAiChatBtn';
    clearChatBtn.title = 'Làm mới phiên trò chuyện';
    clearChatBtn.innerHTML = '<i class="fa-solid fa-broom"></i>';
    clearChatBtn.style.cssText = "background: transparent; border: none; color: white; font-size: 1.1rem; cursor: pointer; padding: 5px; display: flex; align-items: center; justify-content: center; transition: 0.2s; flex-shrink: 0;";
    
    clearChatBtn.addEventListener('mouseenter', () => clearChatBtn.style.color = '#cbd5e1');
    clearChatBtn.addEventListener('mouseleave', () => clearChatBtn.style.color = 'white');
    clearChatBtn.addEventListener('click', () => {
        if (confirm("Bạn có chắc chắn muốn làm mới phiên? Lịch sử hiện tại sẽ bị xóa để giúp AI phân tích câu hỏi mới nhanh và chính xác hơn.")) {
            chatHistory = [];
            saveLocalHistory();
            if (aiChatBox) aiChatBox.innerHTML = '';
            appendMsg('ai', "💡 *Ghi chú hệ thống: Đã làm mới bộ nhớ. Hãy đặt câu hỏi mới cho tôi nhé!*");
        }
    });

    const fullscreenAiBtn = document.createElement('button');
    fullscreenAiBtn.id = 'fullscreenAiBtn';
    fullscreenAiBtn.title = 'Phóng to / Thu nhỏ';
    fullscreenAiBtn.innerHTML = '<i class="fa-solid fa-expand"></i>';
    fullscreenAiBtn.style.cssText = "background: transparent; border: none; color: white; font-size: 1.1rem; cursor: pointer; padding: 5px; display: flex; align-items: center; justify-content: center; transition: 0.2s; flex-shrink: 0;";
    
    fullscreenAiBtn.addEventListener('mouseenter', () => fullscreenAiBtn.style.color = '#cbd5e1');
    fullscreenAiBtn.addEventListener('mouseleave', () => fullscreenAiBtn.style.color = 'white');

    fullscreenAiBtn.addEventListener('click', () => {
        if (!isFullscreen) {
            savedSidebarWidth = aiSidebar.style.width;
            aiSidebar.style.width = '100vw';
            aiSidebar.style.zIndex = '100000'; 
            if (mainContentWrap) mainContentWrap.style.marginRight = '0';
            fullscreenAiBtn.innerHTML = '<i class="fa-solid fa-compress"></i>';
            isFullscreen = true;
        } else {
            aiSidebar.style.width = savedSidebarWidth || '550px';
            aiSidebar.style.zIndex = ''; 
            if (mainContentWrap) mainContentWrap.style.marginRight = savedSidebarWidth || '550px';
            fullscreenAiBtn.innerHTML = '<i class="fa-solid fa-expand"></i>';
            isFullscreen = false;
        }
    });

    if (closeAiSidebarBtn && closeAiSidebarBtn.parentNode) {
        const sidebarHeader = closeAiSidebarBtn.parentNode;
        sidebarHeader.insertBefore(queryCounterUI, closeAiSidebarBtn);
        sidebarHeader.insertBefore(clearChatBtn, closeAiSidebarBtn);
        sidebarHeader.insertBefore(fullscreenAiBtn, closeAiSidebarBtn);
        
        sidebarHeader.style.display = 'flex';
        sidebarHeader.style.alignItems = 'center';
        sidebarHeader.style.flexWrap = 'nowrap';
        sidebarHeader.style.gap = '8px'; 
        
        Array.from(sidebarHeader.children).forEach(child => {
            child.style.flexShrink = '0';
            child.style.whiteSpace = 'nowrap';
        });
    }

    // ==========================================
    // ĐỒNG BỘ REAL-TIME TỪ FIREBASE
    // ==========================================
    let unsubscribeUser = null;

    document.addEventListener('authReady', (e) => {
        const user = e.detail.user || auth.currentUser;
        if (!user) return;
        
        if (unsubscribeUser) unsubscribeUser(); 
        
        unsubscribeUser = onSnapshot(doc(db, "users", user.uid), (docSnap) => {
            if (docSnap.exists()) {
                const userData = docSnap.data();
                const tier = userData.vipTier || 'free';
                globalAiTier = tier; 
                updateCharCounterUI(); 

                let maxLimit = 1; 
                if (tier === 'plus') maxLimit = 5; 
                if (tier === 'pro') maxLimit = Infinity;

                let usedCount = 0;
                const todayStr = new Date().toLocaleDateString('en-CA');
                if (userData.aiLastUsedDate === todayStr) {
                    usedCount = userData.aiDailyCount || 0;
                }

                const remaining = maxLimit - usedCount;
                updateQueryCounterDisplay(queryCounterUI, remaining, maxLimit, tier);
            }
        });
    });

    // ==========================================
    // HÀM HELPER WRAPPER MODULE
    // ==========================================
    function saveLocalHistory() {
        saveChatHistory(auth.currentUser?.uid, chatHistory);
    }
    function appendMsg(sender, text) {
        appendMessage(sender, text, aiChatBox);
    }

    if (btnAutoGenerate) {
        btnAutoGenerate.innerHTML = '<i class="fa-solid fa-robot"></i> Trợ lý AI';
    }

    // ==========================================
    // THAY ĐỔI KÍCH THƯỚC SIDEBAR
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
            if (isFullscreen) return; 
            isResizing = true;
            document.body.style.cursor = 'col-resize';
            e.preventDefault(); 
        });

        document.addEventListener('mousemove', (e) => {
            if (!isResizing || isFullscreen) return; 
            let newWidth = window.innerWidth - e.clientX;
            
            let minWidth = window.innerWidth <= 570 ? window.innerWidth : 550;
            if (newWidth < minWidth) newWidth = minWidth;
            if (newWidth > window.innerWidth * 0.9) newWidth = window.innerWidth * 0.9;
            
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

    // ==========================================
    // LOGIC ĐÓNG/MỞ SIDEBAR
    // ==========================================
    function toggleSidebar() {
        if (!aiSidebar) return;
        
        if (aiSidebar.classList.contains('active')) {
            aiSidebar.classList.remove('active');
            
            if (isFullscreen) {
                isFullscreen = false;
                fullscreenAiBtn.innerHTML = '<i class="fa-solid fa-expand"></i>';
                aiSidebar.style.zIndex = '';
                aiSidebar.style.width = savedSidebarWidth || '550px';
            }

            let currentWidth = aiSidebar.offsetWidth;
            aiSidebar.style.right = `-${currentWidth + 20}px`; 
            if (mainContentWrap) mainContentWrap.style.marginRight = '0';

        } else {
            let minWidth = window.innerWidth <= 570 ? window.innerWidth : 550;
            let currentWidth = aiSidebar.offsetWidth;
            
            if (!currentWidth || currentWidth < minWidth) {
                currentWidth = minWidth;
                aiSidebar.style.width = `${currentWidth}px`;
            }

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
                hintDiv.innerHTML = '<i class="fa-solid fa-arrows-left-right" style="color: #0ea5e9; margin-right: 5px;"></i> <b>Mẹo:</b> Dùng nút chổi <i class="fa-solid fa-broom" style="color: #3b82f6;"></i> ở phía trên để xóa lịch sử, giúp AI chạy nhanh và tiết kiệm tài nguyên nhé!';
                
                aiChatBox.appendChild(hintDiv);
                
                const loadedHistory = loadChatHistory(auth.currentUser?.uid, aiChatBox);
                if (loadedHistory && loadedHistory.length > 0) {
                    chatHistory = loadedHistory;
                }
                
                isFirstOpen = false;
            }
        }
    }

    if (closeAiSidebarBtn) closeAiSidebarBtn.addEventListener('click', toggleSidebar);

    // ==========================================
    // KIỂM TRA QUYỀN TRƯỚC KHI MỞ
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
                    globalAiTier = tier; 
                    updateCharCounterUI(); 

                    let maxLimit = 1; 
                    if (tier === 'plus') maxLimit = 5; 
                    if (tier === 'pro') maxLimit = Infinity;

                    let usedCount = 0;
                    const todayStr = new Date().toLocaleDateString('en-CA');
                    if (userData.aiLastUsedDate === todayStr) {
                        usedCount = userData.aiDailyCount || 0;
                    }

                    const remaining = maxLimit - usedCount;
                    updateQueryCounterDisplay(queryCounterUI, remaining, maxLimit, tier);

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
                            showRemainingQueriesPopup(remaining, maxLimit, tier, auth.currentUser.uid, toggleSidebar);
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
                    globalAiTier = tier; 
                    updateCharCounterUI(); 
                    
                    isUserPro = (tier === 'pro');
                    if (tier === 'plus') maxLimit = 5; 
                    if (tier === 'pro') maxLimit = Infinity;
                    
                    if (!isUserPro) {
                        const lastDate = userData.aiLastUsedDate || '';
                        currentAiCount = (lastDate === todayStr) ? (userData.aiDailyCount || 0) : 0;
                        
                        if (currentAiCount >= maxLimit) {
                            alert("Bạn đã hết lượt hỏi AI trong ngày hôm nay!");
                            btnSendAi.disabled = false;
                            updateQueryCounterDisplay(queryCounterUI, 0, maxLimit, tier);
                            return; 
                        }
                    }
                }
            } catch (err) {
                console.error("Lỗi kiểm tra quyền hạn AI:", err);
            }

            appendMsg('user', prompt);
            aiChatInput.value = '';
            updateCharCounterUI(); 
            btnSendAi.disabled = false;

            chatHistory.push({
                role: "user",
                parts: [{ text: prompt }]
            });
            saveLocalHistory(); 

            const loadingId = 'loading-' + Date.now();
            appendMsg('ai', `<div id="${loadingId}" class="typing-indicator"><span></span><span></span><span></span></div>`);

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
                if (loadingEl && loadingEl.parentNode) {
                    loadingEl.parentNode.remove();
                }

                if (!response.ok) {
                    chatHistory.pop(); 
                    saveLocalHistory(); 
                    const errorData = await response.text();
                    if (response.status === 429 || errorData.includes('RESOURCE_EXHAUSTED') || errorData.includes('depleted')) {
                        throw new Error("Hệ thống Trợ lý AI đang quá tải hoặc hết hạn mức tài nguyên trong ngày. Vui lòng thử lại sau!");
                    }
                    throw new Error(`Lỗi hệ thống (${response.status}). Vui lòng liên hệ Admin.`);
                }

                const data = await response.json();
                const aiResponseText = data.response || "Lỗi không nhận được phản hồi.";
                
                appendMsg('ai', aiResponseText);

                chatHistory.push({
                    role: "model",
                    parts: [{ text: aiResponseText }]
                });

                if (chatHistory.length > 6) {
                    chatHistory = chatHistory.slice(-6);
                }

                saveLocalHistory(); 

                if (usedTokens > 0) {
                    try {
                        let updateData = { totalTokensUsed: increment(usedTokens) };
                        if (!isUserPro) {
                            updateData.aiDailyCount = currentAiCount + 1;
                            updateData.aiLastUsedDate = todayStr;
                            
                            updateQueryCounterDisplay(queryCounterUI, maxLimit - (currentAiCount + 1), maxLimit, globalAiTier);
                        }
                        await updateDoc(doc(db, "users", auth.currentUser.uid), updateData);
                        
                        if (!isUserPro && (currentAiCount + 1 >= maxLimit)) {
                            setTimeout(() => appendMsg('ai', "💡 *Ghi chú hệ thống: Bạn đã sử dụng hết lượt hỏi AI miễn phí trong ngày hôm nay.*"), 1000);
                        }
                    } catch (tokenErr) {
                        console.warn("Chưa thể cập nhật Token cho User:", tokenErr);
                    }
                }

            } catch (error) {
                console.error("Lỗi AI Chat:", error);
                const loadingEl = document.getElementById(loadingId);
                if (loadingEl && loadingEl.parentNode) {
                    loadingEl.parentNode.remove();
                }
                appendMsg('ai error', "Lỗi kết nối AI: " + error.message);
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
