// ==========================================
// MODULE: GIAO DIỆN & POPUP (UI-MODALS)
// ==========================================

export function injectAICSS() {
    const style = document.createElement('style');
    style.innerHTML = `
        .typing-indicator { display: flex; align-items: center; gap: 4px; padding: 8px 12px; background: #f1f5f9; border-radius: 12px; width: fit-content; margin-top: 5px; }
        .typing-indicator span { width: 6px; height: 6px; background-color: #3b82f6; border-radius: 50%; animation: bounce 1.4s infinite ease-in-out both; }
        .typing-indicator span:nth-child(1) { animation-delay: -0.32s; }
        .typing-indicator span:nth-child(2) { animation-delay: -0.16s; }
        @keyframes bounce { 0%, 80%, 100% { transform: scale(0); } 40% { transform: scale(1); } }
        
        .quick-prompt-chip { background: #e0f2fe; color: #0369a1; border: 1px solid #bae6fd; padding: 6px 12px; border-radius: 16px; font-size: 0.8rem; cursor: pointer; white-space: nowrap; transition: 0.2s; font-weight: 500; }
        .quick-prompt-chip:hover { background: #bae6fd; transform: translateY(-1px); box-shadow: 0 2px 5px rgba(0,0,0,0.05); }
        .quick-prompts-container { display: flex; gap: 8px; overflow-x: auto; padding-bottom: 8px; scrollbar-width: none; }
        .quick-prompts-container::-webkit-scrollbar { display: none; }
        
        .scroll-bottom-btn { position: absolute; bottom: 120px; right: 20px; background: rgba(59, 130, 246, 0.9); color: white; border: none; border-radius: 50%; width: 35px; height: 35px; display: none; align-items: center; justify-content: center; cursor: pointer; box-shadow: 0 4px 10px rgba(0,0,0,0.2); z-index: 100; transition: 0.2s; backdrop-filter: blur(4px); }
        .scroll-bottom-btn:hover { background: #2563eb; transform: scale(1.1); }
    `;
    document.head.appendChild(style);
}

export function updateQueryCounterDisplay(queryCounterUI, remaining, maxLimit, tier) {
    if (!queryCounterUI) return;
    queryCounterUI.style.display = 'flex';
    
    let tierColor = '#4ade80'; 
    let tierIcon = '<i class="fa-solid fa-paper-plane"></i>';
    
    if (tier === 'plus') { 
        tierColor = '#60a5fa'; 
        tierIcon = '<i class="fa-solid fa-shield-halved"></i>'; 
    }
    if (tier === 'pro') { 
        tierColor = '#fcd34d'; 
        tierIcon = '<i class="fa-solid fa-crown"></i>'; 
    }

    if (tier === 'pro') {
        queryCounterUI.innerHTML = `<span style="color: ${tierColor};">${tierIcon} PRO</span> <span style="opacity: 0.4; font-weight: 300;">|</span> <span><i class="fa-solid fa-bolt" style="color: #fcd34d;"></i> Không giới hạn</span>`;
    } else {
        if (remaining <= 0) {
            queryCounterUI.innerHTML = `<span style="color: ${tierColor};">${tierIcon} ${tier.toUpperCase()}</span> <span style="opacity: 0.4; font-weight: 300;">|</span> <span style="color: #fca5a5;"><i class="fa-solid fa-bolt"></i> Hết lượt</span>`;
        } else {
            queryCounterUI.innerHTML = `<span style="color: ${tierColor};">${tierIcon} ${tier.toUpperCase()}</span> <span style="opacity: 0.4; font-weight: 300;">|</span> <span><i class="fa-solid fa-bolt" style="color: #fcd34d;"></i> Còn ${remaining}/${maxLimit} lượt</span>`;
        }
    }
}

export function showRemainingQueriesPopup(remaining, maxLimit, tier, uid, toggleSidebarCallback) {
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
        if (isChecked && uid) {
            localStorage.setItem(`hideAiLimitPopup_${uid}`, 'true');
        }
        modal.remove();
        if (toggleSidebarCallback) toggleSidebarCallback();
    };
}

export function showOutOfQueriesPopup(tier) {
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
