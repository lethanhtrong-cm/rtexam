import { db } from "../dashboard-core.js";
import { doc, deleteDoc, getDocs, query, collection, where } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { state } from "./lobby-state.js";

// GOM TOÀN BỘ DOM SELECTOR VÀO 1 OBJECT ĐỂ DỄ QUẢN LÝ
export const UI = {
    headerUserName: document.getElementById('headerUserName'),
    state1Waiting: document.getElementById('state1Waiting'),
    state2Leaderboard: document.getElementById('state2Leaderboard'),
    displayRoomId: document.getElementById('displayRoomId'),
    displayExamName: document.getElementById('displayExamName'),
    btnCopyRoomCode: document.getElementById('btnCopyRoomCode'),
    participantsGrid: document.getElementById('participantsGrid'),
    playerCount: document.getElementById('playerCount'),
    btnStart: document.getElementById('btnStart'),
    waitingText: document.getElementById('waitingText'),
    hostPanel: document.getElementById('hostPanel'),
    selectExamInLobby: document.getElementById('selectExamInLobby'),
    btnOpenInviteModal: document.getElementById('btnOpenInviteModal'),
    btnCopyLink: document.getElementById('btnCopyLink'),
    btnLockRoom: document.getElementById('btnLockRoom'),
    leaderboardBody: document.getElementById('leaderboardBody'),
    btnEndRoom: document.getElementById('btnEndRoom'),
    btnBackToLobby: document.getElementById('btnBackToLobby'),
    inviteFriendModal: document.getElementById('inviteFriendModal'),
    closeInviteModalBtn: document.getElementById('closeInviteModalBtn'),
    inviteEmailInput: document.getElementById('inviteEmailInput'),
    btnSendInvite: document.getElementById('btnSendInvite'),
    btnOpenAiModal: document.getElementById('btnOpenAiModal'),
    aiGenerateModal: document.getElementById('aiGenerateModal'),
    closeAiModalBtn: document.getElementById('closeAiModalBtn'),
    btnCancelAi: document.getElementById('btnCancelAi'),
    btnSubmitAiGenerate: document.getElementById('btnSubmitAiGenerate'),
    aiFormArea: document.getElementById('aiFormArea'),
    aiLoadingSpinner: document.getElementById('aiLoadingSpinner'),
    aiModalFooter: document.getElementById('aiModalFooter'),
    aiPromptInput: document.getElementById('aiPromptInput'),
    aiQuestionCount: document.getElementById('aiQuestionCount'),
    aiDifficulty: document.getElementById('aiDifficulty')
};

export function switchUIState(uiState) {
    if (uiState === 'waiting') {
        UI.state1Waiting.style.display = 'block';
        UI.state2Leaderboard.style.display = 'none';
    } else {
        UI.state1Waiting.style.display = 'none';
        UI.state2Leaderboard.style.display = 'block';
    }
}

export function resetAiForm() {
    if (UI.aiPromptInput) UI.aiPromptInput.value = '';
    if (UI.aiFormArea) UI.aiFormArea.style.display = 'block';
    if (UI.aiLoadingSpinner) UI.aiLoadingSpinner.style.display = 'none';
    if (UI.aiModalFooter) UI.aiModalFooter.style.display = 'flex';
}

export function enhanceLeaderboardUI() {
    if (document.getElementById('historySidebar')) return;

    // =========================================================================
    // FIX MẠNH TAY: TRUY TÌM VÀ NỚI LỎNG KHUNG CHA ĐANG BÓP NGHẸT GIAO DIỆN
    // =========================================================================
    if (UI.state2Leaderboard) {
        let parentEl = UI.state2Leaderboard.parentElement;
        while (parentEl && parentEl.tagName !== 'BODY') {
            // Nới lỏng bất kỳ thẻ cha nào có class container hoặc đang bị khóa width
            if (parentEl.classList.contains('container') || parentEl.classList.contains('main-content')) {
                parentEl.style.maxWidth = '1200px';
                parentEl.style.width = '95%';
                parentEl.style.transition = 'max-width 0.4s ease';
            }
            parentEl = parentEl.parentElement;
        }
        UI.state2Leaderboard.style.maxWidth = '100%';
        UI.state2Leaderboard.style.width = '100%';
    }

    // CSS INJECTION: NÂNG CẤP GIAO DIỆN BẢNG XẾP HẠNG MỞ RỘNG VÀ THANH THOÁT
    if (!document.getElementById('sleek-lb-styles')) {
        const customStyle = document.createElement('style');
        customStyle.id = 'sleek-lb-styles';
        customStyle.innerHTML = `
            #historySidebar {
                background: #ffffff !important;
                border: 1px solid #e2e8f0 !important;
                box-shadow: 0 4px 15px -3px rgba(0,0,0,0.03) !important;
                border-radius: 16px !important;
            }
            #lbCaptureArea {
                background: #ffffff !important;
                border: 1px solid #e2e8f0 !important;
                box-shadow: 0 4px 15px -3px rgba(0,0,0,0.03) !important;
                border-radius: 16px !important;
                overflow-x: auto !important; /* Đảm bảo không vỡ bảng khi thu nhỏ */
            }
            
            /* Lịch sử thi Sidebar */
            .history-item { 
                padding: 14px 16px !important; margin-bottom: 8px !important; background: #f8fafc !important; 
                border: 1px solid transparent !important; border-radius: 10px !important; cursor: pointer !important; 
                transition: all 0.2s ease !important; color: #475569 !important;
            }
            .history-item:hover { background: #f1f5f9 !important; border-color: #cbd5e1 !important; }
            .history-item.active { 
                background: #eff6ff !important; border-color: #bfdbfe !important; color: #1d4ed8 !important; 
                box-shadow: 0 2px 4px rgba(59, 130, 246, 0.1) !important;
            }
            
            /* Dàn khu vực nút bấm hài hòa */
            .lb-actions {
                display: flex !important;
                flex-direction: row !important;
                flex-wrap: wrap !important;
                justify-content: center !important;
                gap: 16px !important;
                margin-top: 30px !important;
                padding-top: 25px !important;
                border-top: 1px dashed #e2e8f0 !important;
            }
            .lb-actions button {
                margin: 0 !important;
                padding: 12px 24px !important;
                border-radius: 12px !important;
                font-weight: 700 !important;
                font-size: 0.95rem !important;
                border: none !important;
                cursor: pointer !important;
                transition: all 0.2s ease !important;
                display: flex !important;
                align-items: center !important;
                gap: 8px !important;
                width: auto !important; 
            }
            .lb-actions button:hover {
                transform: translateY(-2px) !important;
                box-shadow: 0 6px 15px rgba(0,0,0,0.08) !important;
            }

            /* Tone màu Pastel chuyên nghiệp cho Buttons */
            #btnEndRoom { background: #fff1f2 !important; color: #e11d48 !important; border: 1px solid #fecdd3 !important; }
            #btnEndRoom:hover { background: #ffe4e6 !important; }
            #btnReviewExam { background: #eff6ff !important; color: #2563eb !important; border: 1px solid #bfdbfe !important; }
            #btnReviewExam:hover { background: #dbeafe !important; }
            #btnBackToLobby { background: #f8fafc !important; color: #475569 !important; border: 1px solid #e2e8f0 !important; }
            #btnBackToLobby:hover { background: #f1f5f9 !important; color: #0f172a !important;}

            /* ==============================================================
               TỐI ƯU TABLE BẢNG XẾP HẠNG (THANH THOÁT, KHÔNG RỚT DÒNG)
               ============================================================== */
            .leaderboard-table { 
                width: 100% !important; 
                min-width: 650px !important; /* Ép bảng giãn rộng */
                border-collapse: collapse !important; 
                margin-top: 10px !important; 
            }
            
            /* Header Table */
            .leaderboard-table th { 
                background: transparent !important; 
                color: #64748b !important; 
                font-weight: 700 !important; 
                text-transform: uppercase !important; 
                font-size: 0.85rem !important; 
                letter-spacing: 0.5px !important; 
                border-bottom: 2px solid #e2e8f0 !important; 
                padding: 16px 12px !important; 
                text-align: center !important; 
            }
            .leaderboard-table th:nth-child(2) { text-align: left !important; padding-left: 20px !important; } 

            /* Body Table */
            .leaderboard-table td { 
                vertical-align: middle !important; 
                padding: 16px 12px !important; 
                border-bottom: 1px solid #f1f5f9 !important; 
                color: #475569 !important; 
                font-weight: 600 !important; 
                text-align: center !important; 
                transition: background 0.2s ease !important;
            }
            .leaderboard-table tbody tr:hover td { background-color: #f8fafc !important; }

            /* Định dạng Cột User (TUYỆT ĐỐI CHỐNG RỚT DÒNG) */
            .leaderboard-table .td-user { 
                text-align: left !important; 
                display: flex !important; 
                align-items: center !important; 
                gap: 14px !important; 
                border-bottom: none !important; 
                min-width: 250px !important; 
            }
            .leaderboard-table tbody tr { border-bottom: 1px solid #f1f5f9 !important; } 
            .leaderboard-table tbody tr:last-child { border-bottom: none !important; }
            
            .leaderboard-table .td-user span { 
                font-weight: 700 !important; 
                color: #0f172a !important; 
                font-size: 1.05rem !important; 
                white-space: nowrap !important; /* Cấm xuống dòng */
                flex-shrink: 0 !important;      /* Cấm co rút chữ */
            }
            .leaderboard-table .td-user img { 
                width: 42px !important; 
                height: 42px !important; 
                border-radius: 50% !important; 
                object-fit: cover !important; 
                border: 2px solid #ffffff !important; 
                box-shadow: 0 2px 6px rgba(0,0,0,0.1) !important; 
                flex-shrink: 0 !important;
            }

            /* Định dạng Hạng, Điểm số, Thời gian */
            .col-rank { width: 70px !important; text-align: center !important; }
            .rank-badge { width: 34px; height: 34px; display: flex; justify-content: center; align-items: center; border-radius: 50%; font-weight: 900; margin: 0 auto; font-size: 0.95rem; }
            .score-text { color: #2563eb !important; font-weight: 900 !important; font-size: 1.1rem !important; }
        `;
        document.head.appendChild(customStyle);
    }

    const tableContainer = UI.state2Leaderboard.querySelector('.table-container');
    const wrapper = document.createElement('div');
    // Tăng gap giữa 2 cột
    wrapper.style.cssText = "display: flex; gap: 24px; align-items: flex-start; flex-wrap: wrap; margin-bottom: 20px;";
    
    const sidebar = document.createElement('div');
    sidebar.id = 'historySidebar';
    // Đặt width cố định cho sidebar để chừa chỗ cho Table
    sidebar.style.cssText = "flex: 1; min-width: 250px; max-width: 280px; padding: 24px;";
    sidebar.innerHTML = `
        <h4 style="margin-top: 0; margin-bottom: 18px; font-weight: 800; color: #1e293b; font-size: 1.1rem; display: flex; align-items: center; gap: 8px;"><i class="fa-solid fa-clock-rotate-left" style="color: #64748b;"></i> Lịch sử lượt thi</h4>
        <div id="historyListContainer" style="display: flex; flex-direction: column; max-height: 500px; overflow-y: auto; padding-right: 5px;">
            <div style="text-align: center; color: #94a3b8; font-size: 0.9rem; padding: 20px 0;">Chưa có lịch sử</div>
        </div>
    `;
    
    const rightCol = document.createElement('div');
    rightCol.id = 'lbCaptureArea';
    // Ép cột phải bung rộng ra (Flex: 4)
    rightCol.style.cssText = "flex: 4; min-width: 600px; padding: 30px;";
    rightCol.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 25px;">
            <div>
                <h4 style="font-weight: 800; color: #0f172a; font-size: 1.3rem; margin: 0; text-transform: uppercase;" id="currentViewTitle">Lượt thi hiện tại</h4>
                <div id="lbExamInfo" style="color: #64748b; font-weight: 500; margin-top: 6px; font-size: 0.95rem;">Đang cập nhật...</div>
            </div>
            <button id="btnDownloadLb" style="background: #ffffff; color: #0ea5e9; border: 1px solid #7dd3fc; padding: 10px 18px; border-radius: 10px; font-weight: 700; font-size: 0.9rem; cursor: pointer; transition: 0.2s; display: flex; align-items: center; gap: 8px;"><i class="fa-solid fa-download"></i> LƯU ẢNH</button>
        </div>
    `;
    
    rightCol.appendChild(tableContainer);
    
    const watermark = document.createElement('div');
    watermark.id = 'lbWatermark';
    watermark.style.cssText = "display: none; text-align: center; margin-top: 25px; font-weight: 800; color: #cbd5e1; font-size: 1.1rem; letter-spacing: 2px;";
    watermark.innerHTML = `QUIZAPP - MÃ PHÒNG: <span style="color:#94a3b8">${state.roomId}</span>`;
    rightCol.appendChild(watermark);

    wrapper.appendChild(sidebar);
    wrapper.appendChild(rightCol);
    
    const lbHeader = UI.state2Leaderboard.querySelector('.leaderboard-header');
    lbHeader.parentNode.insertBefore(wrapper, lbHeader.nextSibling);

    const lbActions = document.querySelector('.lb-actions');
    if (lbActions && !document.getElementById('btnReviewExam')) {
        const btnReview = document.createElement('button');
        btnReview.id = 'btnReviewExam';
        btnReview.innerHTML = '<i class="fa-solid fa-eye"></i> XEM LẠI BÀI LÀM';
        lbActions.insertBefore(btnReview, UI.btnBackToLobby);
        btnReview.addEventListener('click', openReviewModal);
    }

    if (!document.getElementById('reviewExamModal')) {
        const modalHtml = `
        <div class="modal" id="reviewExamModal" style="z-index: 10000; padding-top: 2vh; background: rgba(15, 23, 42, 0.7); backdrop-filter: blur(5px);">
            <div class="modal-content" style="max-width: 800px; width: 95%; height: 92vh; display: flex; flex-direction: column; padding: 0; background: #f8fafc; overflow: hidden; border-radius: 16px; border: none;">
                <div style="padding: 18px 24px; background: #ffffff; border-bottom: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center; z-index: 10;">
                    <h3 style="margin: 0; color: #0f172a; font-weight: 800; font-size: 1.25rem;"><i class="fa-solid fa-file-signature" style="color:#3b82f6;"></i> CHI TIẾT BÀI LÀM</h3>
                    <button
