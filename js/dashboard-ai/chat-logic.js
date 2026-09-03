// ==========================================
// MODULE: XỬ LÝ CHUỖI & LỊCH SỬ (CHAT-LOGIC)
// ==========================================

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

export function appendMessage(sender, text, aiChatBox) {
    if (!aiChatBox) return;

    if (sender === 'ai' && !text.includes('typing-indicator') && !text.includes('Đang suy nghĩ')) {
        const wrapperDiv = document.createElement('div');
        wrapperDiv.style.display = 'flex';
        wrapperDiv.style.flexDirection = 'column';
        wrapperDiv.style.alignSelf = 'flex-start';
        wrapperDiv.style.maxWidth = '100%'; 
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

const getHistoryKey = (uid) => uid ? `ai_chat_history_${uid}` : 'ai_chat_history_guest';

export function saveChatHistory(uid, chatHistory) {
    localStorage.setItem(getHistoryKey(uid), JSON.stringify(chatHistory));
}

export function loadChatHistory(uid, aiChatBox) {
    const saved = localStorage.getItem(getHistoryKey(uid));
    if (saved) {
        try {
            const parsed = JSON.parse(saved);
            if (Array.isArray(parsed) && parsed.length > 0) {
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
                    appendMessage(sender, msg.parts[0].text, aiChatBox);
                });
                
                return parsed;
            }
        } catch(e) { 
            console.error("Lỗi tải lịch sử chat:", e); 
        }
    }
    return [];
}
