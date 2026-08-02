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

    if (UI.state2Leaderboard) {
        let parentEl = UI.state2Leaderboard.parentElement;
        while (parentEl && parentEl.tagName !== 'BODY') {
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

    if (!document.getElementById('sleek-lb-styles')) {
        const customStyle = document.createElement('style');
        customStyle.id = 'sleek-lb-styles';
        customStyle.innerHTML = `
            #historySidebar { background: #ffffff !important; border: 1px solid #e2e8f0 !important; box-shadow: 0 4px 15px -3px rgba(0,0,0,0.03) !important; border-radius: 16px !important; }
            #lbCaptureArea { background: #ffffff !important; border: 1px solid #e2e8f0 !important; box-shadow: 0 4px 15px -3px rgba(0,0,0,0.03) !important; border-radius: 16px !important; overflow-x: auto !important; }
            .history-item { padding: 14px 16px !important; margin-bottom: 8px !important; background: #f8fafc !important; border: 1px solid transparent !important; border-radius: 10px !important; cursor: pointer !important; transition: all 0.2s ease !important; color: #475569 !important; }
            .history-item:hover { background: #f1f5f9 !important; border-color: #cbd5e1 !important; }
            .history-item.active { background: #eff6ff !important; border-color: #bfdbfe !important; color: #1d4ed8 !important; box-shadow: 0 2px 4px rgba(59, 130, 246, 0.1) !important; }
            .lb-actions { display: flex !important; flex-direction: row !important; flex-wrap: wrap !important; justify-content: center !important; gap: 16px !important; margin-top: 30px !important; padding-top: 25px !important; border-top: 1px dashed #e2e8f0 !important; }
            .lb-actions button { margin: 0 !important; padding: 12px 24px !important; border-radius: 12px !important; font-weight: 700 !important; font-size: 0.95rem !important; border: none !important; cursor: pointer !important; transition: all 0.2s ease !important; display: flex !important; align-items: center !important; gap: 8px !important; width: auto !important; }
            .lb-actions button:hover { transform: translateY(-2px) !important; box-shadow: 0 6px 15px rgba(0,0,0,0.08) !important; }
            #btnEndRoom { background: #fff1f2 !important; color: #e11d48 !important; border: 1px solid #fecdd3 !important; }
            #btnEndRoom:hover { background: #ffe4e6 !important; }
            #btnReviewExam { background: #eff6ff !important; color: #2563eb !important; border: 1px solid #bfdbfe !important; }
            #btnReviewExam:hover { background: #dbeafe !important; }
            #btnBackToLobby { background: #f8fafc !important; color: #475569 !important; border: 1px solid #e2e8f0 !important; }
            #btnBackToLobby:hover { background: #f1f5f9 !important; color: #0f172a !important;}
            .leaderboard-table { width: 100% !important; min-width: 650px !important; border-collapse: collapse !important; margin-top: 10px !important; }
            .leaderboard-table th { background: transparent !important; color: #64748b !important; font-weight: 700 !important; text-transform: uppercase !important; font-size: 0.85rem !important; letter-spacing: 0.5px !important; border-bottom: 2px solid #e2e8f0 !important; padding: 16px 12px !important; text-align: center !important; }
            .leaderboard-table th:nth-child(2) { text-align: left !important; padding-left: 20px !important; } 
            .leaderboard-table td { vertical-align: middle !important; padding: 16px 12px !important; border-bottom: 1px solid #f1f5f9 !important; color: #475569 !important; font-weight: 600 !important; text-align: center !important; transition: background 0.2s ease !important; }
            .leaderboard-table tbody tr:hover td { background-color: #f8fafc !important; }
            .leaderboard-table .td-user { text-align: left !important; display: flex !important; align-items: center !important; gap: 14px !important; border-bottom: none !important; min-width: 250px !important; }
            .leaderboard-table tbody tr { border-bottom: 1px solid #f1f5f9 !important; } 
            .leaderboard-table tbody tr:last-child { border-bottom: none !important; }
            .leaderboard-table .td-user span { font-weight: 700 !important; color: #0f172a !important; font-size: 1.05rem !important; white-space: nowrap !important; flex-shrink: 0 !important; }
            .leaderboard-table .td-user img { width: 42px !important; height: 42px !important; border-radius: 50% !important; object-fit: cover !important; border: 2px solid #ffffff !important; box-shadow: 0 2px 6px rgba(0,0,0,0.1) !important; flex-shrink: 0 !important; }
            .col-rank { width: 70px !important; text-align: center !important; }
            .rank-badge { width: 34px; height: 34px; display: flex; justify-content: center; align-items: center; border-radius: 50%; font-weight: 900; margin: 0 auto; font-size: 0.95rem; }
            .score-text { color: #2563eb !important; font-weight: 900 !important; font-size: 1.1rem !important; }
        `;
        document.head.appendChild(customStyle);
    }

    const tableContainer = UI.state2Leaderboard.querySelector('.table-container');
    const wrapper = document.createElement('div');
    wrapper.style.cssText = "display: flex; gap: 24px; align-items: flex-start; flex-wrap: wrap; margin-bottom: 20px;";
    
    const sidebar = document.createElement('div');
    sidebar.id = 'historySidebar';
    sidebar.style.cssText = "flex: 1; min-width: 250px; max-width: 280px; padding: 24px;";
    sidebar.innerHTML = `
        <h4 style="margin-top: 0; margin-bottom: 18px; font-weight: 800; color: #1e293b; font-size: 1.1rem; display: flex; align-items: center; gap: 8px;"><i class="fa-solid fa-clock-rotate-left" style="color: #64748b;"></i> Lịch sử lượt thi</h4>
        <div id="historyListContainer" style="display: flex; flex-direction: column; max-height: 500px; overflow-y: auto; padding-right: 5px;">
            <div style="text-align: center; color: #94a3b8; font-size: 0.9rem; padding: 20px 0;">Chưa có lịch sử</div>
        </div>
    `;
    
    const rightCol = document.createElement('div');
    rightCol.id = 'lbCaptureArea';
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
                    <button id="closeReviewModalBtn" style="background: #f1f5f9; border: none; width: 36px; height: 36px; border-radius: 50%; font-size: 1.1rem; cursor: pointer; color: #64748b; transition: 0.2s;"><i class="fa-solid fa-xmark"></i></button>
                </div>
                <div id="reviewContentArea" style="padding: 24px; overflow-y: auto; text-align: left; flex: 1; scroll-behavior: smooth;">
                </div>
            </div>
        </div>
        `;
        document.body.insertAdjacentHTML('beforeend', modalHtml);

        const closeBtn = document.getElementById('closeReviewModalBtn');
        closeBtn.addEventListener('click', () => document.getElementById('reviewExamModal').classList.remove('active'));
        closeBtn.onmouseover = function() { this.style.background = '#fee2e2'; this.style.color = '#e11d48'; };
        closeBtn.onmouseout = function() { this.style.background = '#f1f5f9'; this.style.color = '#64748b'; };
        
        document.getElementById('reviewExamModal').addEventListener('click', (e) => {
            if (e.target.id === 'reviewExamModal') e.target.classList.remove('active');
        });
    }

    if (!document.getElementById('liveViewModal')) {
        const liveModalHtml = `
        <div class="modal" id="liveViewModal" style="z-index: 10000; padding-top: 5vh; background: rgba(15, 23, 42, 0.7); backdrop-filter: blur(5px);">
            <div class="modal-content" style="max-width: 650px; width: 95%; max-height: 85vh; display: flex; flex-direction: column; padding: 0; background: #f8fafc; overflow: hidden; border-radius: 16px; border: none;">
                <div style="padding: 18px 24px; background: #ffffff; border-bottom: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center; z-index: 10;">
                    <h3 style="margin: 0; color: #0f172a; font-weight: 800; font-size: 1.25rem;"><i class="fa-solid fa-satellite-dish" style="color:#ef4444;"></i> GIÁM SÁT TRỰC TIẾP</h3>
                    <button id="closeLiveViewBtn" style="background: #f1f5f9; border: none; width: 36px; height: 36px; border-radius: 50%; font-size: 1.1rem; cursor: pointer; color: #64748b; transition: 0.2s;"><i class="fa-solid fa-xmark"></i></button>
                </div>
                <div id="liveViewContent" style="padding: 24px; overflow-y: auto; text-align: left; flex: 1; scroll-behavior: smooth;">
                </div>
            </div>
        </div>
        `;
        document.body.insertAdjacentHTML('beforeend', liveModalHtml);

        const closeBtn = document.getElementById('closeLiveViewBtn');
        closeBtn.addEventListener('click', () => {
             document.getElementById('liveViewModal').classList.remove('active');
             state.currentlyViewingLiveUid = null;
             state.liveViewViewingIdx = null; // Xóa trạng thái xem khi đóng Modal
        });
        closeBtn.onmouseover = function() { this.style.background = '#fee2e2'; this.style.color = '#e11d48'; };
        closeBtn.onmouseout = function() { this.style.background = '#f1f5f9'; this.style.color = '#64748b'; };

        document.getElementById('liveViewModal').addEventListener('click', (e) => {
            if (e.target.id === 'liveViewModal') {
                e.target.classList.remove('active');
                state.currentlyViewingLiveUid = null;
                state.liveViewViewingIdx = null; 
            }
        });
    }

    if (!window.html2canvas) {
        const script = document.createElement('script');
        script.src = "https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js";
        document.head.appendChild(script);
    }

    document.getElementById('btnDownloadLb').addEventListener('click', async () => {
        const captureArea = document.getElementById('lbCaptureArea');
        const watermarkEl = document.getElementById('lbWatermark');
        const btnDown = document.getElementById('btnDownloadLb');
        
        btnDown.style.display = 'none';
        watermarkEl.style.display = 'block';
        captureArea.style.border = 'none'; 
        captureArea.style.boxShadow = 'none';
        
        if (window.html2canvas) {
            const canvas = await html2canvas(captureArea, { scale: 2, backgroundColor: '#ffffff', useCORS: true });
            const link = document.createElement('a');
            link.download = `BangXepHang_${state.roomId}_${new Date().getTime()}.png`;
            link.href = canvas.toDataURL('image/png');
            link.click();
        } else {
            alert("Đang tải thư viện xử lý ảnh, vui lòng bấm lại sau 2 giây...");
        }
        
        btnDown.style.display = 'flex';
        watermarkEl.style.display = 'none';
        captureArea.style.border = '1px solid #e2e8f0';
        captureArea.style.boxShadow = '0 4px 15px -3px rgba(0,0,0,0.03)';
    });

    const theadTr = tableContainer.querySelector('thead tr');
    if (theadTr && !theadTr.querySelector('.col-rank')) {
        const th = document.createElement('th');
        th.className = 'col-rank';
        th.innerText = 'HẠNG';
        theadTr.insertBefore(th, theadTr.firstChild);
    }
}

export async function openLiveView(uid) {
    state.currentlyViewingLiveUid = uid;
    state.liveViewViewingIdx = null; // Khởi tạo: Mặc định xem câu học viên đang làm
    
    const modal = document.getElementById('liveViewModal');
    modal.classList.add('active');
    document.getElementById('liveViewContent').innerHTML = '<div style="text-align:center; padding: 50px;"><i class="fa-solid fa-circle-notch fa-spin fa-3x" style="color:#ef4444"></i><br><h4 style="color:#64748b; margin-top:20px;">Đang thiết lập kết nối trực tiếp...</h4></div>';

    if (!state.liveQuestions || state.liveQuestionsExamId !== state.currentActiveExamId) {
        try {
            const qSnap = await getDocs(query(collection(db, "questions"), where("examId", "==", state.currentActiveExamId)));
            let questions = [];
            qSnap.forEach(d => questions.push({id: d.id, ...d.data()}));
            questions.sort((a, b) => a.order - b.order);
            state.liveQuestions = questions;
            state.liveQuestionsExamId = state.currentActiveExamId;
        } catch (err) {
            console.error("Lỗi tải câu hỏi:", err);
        }
    }
    updateLiveViewModal();
}

export function updateLiveViewModal() {
    if (!state.currentlyViewingLiveUid) return;
    const modal = document.getElementById('liveViewModal');
    if (!modal || !modal.classList.contains('active')) return;

    const pData = state.currentParticipantsArray.find(p => p.uid === state.currentlyViewingLiveUid);
    if (!pData) {
        document.getElementById('liveViewContent').innerHTML = '<div style="text-align:center; color:#ef4444; padding:30px;"><b>Học viên đã rời phòng.</b></div>';
        return;
    }

    if (pData.status !== 'playing') {
         document.getElementById('liveViewContent').innerHTML = `<div style="text-align:center; color:#64748b; padding:30px; font-size: 1.1rem;"><b>Học viên hiện không ở trạng thái làm bài.</b><br><small>Trạng thái hiện tại: ${pData.status}</small></div>`;
         return;
    }

    const actualCurrentQIdx = pData.currentQuestionIndex || 0; // Câu học viên ĐANG LÀM
    const viewingQIdx = state.liveViewViewingIdx !== null ? state.liveViewViewingIdx : actualCurrentQIdx; // Câu Giám thị MUỐN XEM
    const liveAnswers = pData.liveAnswers || {};
    const questions = state.liveQuestions || [];

    if (questions.length === 0) {
        document.getElementById('liveViewContent').innerHTML = '<div style="text-align:center; color:#ef4444; padding:30px;"><b>Không thể tải nội dung câu hỏi.</b></div>';
        return;
    }

    const q = questions[viewingQIdx];
    if(!q) return;

    const selectedOptIdx = liveAnswers[viewingQIdx];

    // Tạo bảng Palette có thể CLICK được
    let paletteHtml = '<div style="display:flex; flex-wrap:wrap; gap:6px; margin-bottom: 20px; max-height: 140px; overflow-y:auto; padding-right:5px;">';
    questions.forEach((_, i) => {
        let isAnswered = liveAnswers[i] !== undefined;
        let bg = isAnswered ? '#10b981' : '#f1f5f9';
        let color = isAnswered ? 'white' : '#64748b';
        
        let border = i === actualCurrentQIdx ? '2px solid #ef4444' : '2px solid transparent'; // Viền đỏ: Vị trí của Học viên
        if (i === viewingQIdx && viewingQIdx !== actualCurrentQIdx) {
            border = '2px solid #3b82f6'; // Viền xanh: Vị trí Giám thị đang chủ động xem
        }
        
        paletteHtml += `<button class="live-palette-btn" data-idx="${i}" style="width:32px; height:32px; border-radius:6px; background:${bg}; color:${color}; border:${border}; display:flex; align-items:center; justify-content:center; font-size:0.85rem; font-weight:bold; box-shadow: 0 1px 2px rgba(0,0,0,0.05); cursor: pointer; transition: 0.2s;">${i+1}</button>`;
    });
    paletteHtml += '</div>';

    let optionsHtml = '';
    const labels = ['A','B','C','D','E','F'];
    (q.options || []).forEach((optText, oIdx) => {
         let isSelected = oIdx === selectedOptIdx;
         let bg = isSelected ? '#eff6ff' : '#ffffff';
         let border = isSelected ? '2px solid #3b82f6' : '1px solid #e2e8f0';
         let fw = isSelected ? '800' : '500';
         let color = isSelected ? '#1d4ed8' : '#334155';
         optionsHtml += `
             <div style="padding: 14px 16px; margin-bottom: 10px; border-radius: 10px; background: ${bg}; border: ${border}; font-weight: ${fw}; color: ${color}; transition: 0.2s;">
                 <span style="display:inline-block; width: 25px;">${labels[oIdx]}.</span> ${optText}
             </div>
         `;
    });

    let syncBtnHtml = '';
    let viewingText = `Đang ở câu ${actualCurrentQIdx + 1}/${questions.length}`;
    
    // Nếu Giám thị đang xem câu khác, hiện nút để quay về theo dõi Học viên
    if (viewingQIdx !== actualCurrentQIdx) {
        viewingText = `Học viên đang ở câu ${actualCurrentQIdx + 1}`;
        syncBtnHtml = `<button id="btnSyncLive" style="margin-left: 10px; padding: 4px 12px; background: #ffffff; color: #ef4444; border: 1px solid #fca5a5; border-radius: 8px; font-size: 0.8rem; cursor: pointer; font-weight: 700; display: inline-flex; align-items: center; gap: 6px; box-shadow: 0 2px 4px rgba(239, 68, 68, 0.1);"><i class="fa-solid fa-location-crosshairs"></i> Về Live</button>`;
    }

    let html = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 20px; padding-bottom: 15px; border-bottom: 1px dashed #cbd5e1;">
            <h4 style="margin:0; color:#0f172a; display:flex; align-items:center; gap:10px;"><img src="${pData.photoURL}" style="width:40px; height:40px; border-radius:50%; border:2px solid #e2e8f0; object-fit:cover;"> <span>${pData.displayName}</span></h4>
            <div style="display: flex; align-items: center;">
                <span style="background:#fef2f2; color:#ef4444; padding:6px 12px; border-radius:12px; font-size:0.85rem; font-weight:800; box-shadow: 0 2px 4px rgba(239,68,68,0.1);"><i class="fa-solid fa-tower-broadcast"></i> ${viewingText}</span>
                ${syncBtnHtml}
            </div>
        </div>
        ${paletteHtml}
        <div style="background: white; padding: 22px; border-radius: 14px; border: 1px solid #e2e8f0; box-shadow: 0 4px 10px rgba(0,0,0,0.03);">
            <h5 style="margin: 0 0 18px 0; color:#0f172a; font-size: 1.05rem; line-height: 1.6;">
                <span style="background:#f1f5f9; color:#475569; padding:4px 10px; border-radius:6px; font-size:0.85rem; margin-right:8px; border: 1px solid #e2e8f0;">${viewingQIdx === actualCurrentQIdx ? 'Câu ' : 'Xem lại câu '}${viewingQIdx + 1}</span> ${q.text}
            </h5>
            <div>
                ${optionsHtml}
            </div>
        </div>
    `;
    
    document.getElementById('liveViewContent').innerHTML = html;

    // Gắn sự kiện click cho các nút Palette
    document.querySelectorAll('.live-palette-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            state.liveViewViewingIdx = parseInt(e.currentTarget.getAttribute('data-idx'));
            updateLiveViewModal(); // Gọi lại hàm để render ngay lập tức
        });
    });

    // Gắn sự kiện click cho nút "Về Live"
    const syncBtn = document.getElementById('btnSyncLive');
    if (syncBtn) {
        syncBtn.addEventListener('click', () => {
            state.liveViewViewingIdx = null; // Hủy trạng thái xem riêng để bám theo học viên
            updateLiveViewModal();
        });
    }
}


export async function openReviewModal() {
    if (!state.currentViewedExamId) {
        alert("Đề thi chưa được thiết lập!"); 
        return;
    }

    const modal = document.getElementById('reviewExamModal');
    const contentArea = document.getElementById('reviewContentArea');
    modal.classList.add('active');
    
    contentArea.innerHTML = '<div style="text-align:center; padding: 50px;"><i class="fa-solid fa-circle-notch fa-spin fa-3x" style="color:#3b82f6"></i><h4 style="margin-top:20px; color:#64748b;">Đang tải dữ liệu bài làm...</h4></div>';

    try {
        const rSnap = await getDocs(query(collection(db, "results"), where("email", "==", state.currentUser.email), where("examId", "==", state.currentViewedExamId)));
        let results = [];
        rSnap.forEach(d => results.push(d.data()));

        if (results.length === 0) {
            contentArea.innerHTML = '<div style="text-align:center; padding: 40px; color: #dc3545; font-size: 1.1rem; background: #fff; border-radius: 12px; box-shadow: 0 2px 4px rgba(0,0,0,0.02);"><b><i class="fa-solid fa-triangle-exclamation" style="font-size: 3rem; margin-bottom: 15px;"></i><br>Bạn chưa có kết quả nộp bài cho lượt thi này!</b><br><small style="color:#64748b; display:block; margin-top:10px;">Chỉ khi hoàn thành bài thi và nộp bài, bạn mới có thể xem lại đáp án.</small></div>';
            return;
        }

        results.sort((a,b) => new Date(b.timestamp) - new Date(a.timestamp));
        const latestResult = results[0];
        const savedAnswers = latestResult.savedAnswers || {};

        const qSnap = await getDocs(query(collection(db, "questions"), where("examId", "==", state.currentViewedExamId)));
        let questions = [];
        qSnap.forEach(d => questions.push({id: d.id, ...d.data()}));
        questions.sort((a, b) => a.order - b.order);

        if (questions.length === 0) {
            contentArea.innerHTML = '<div style="text-align:center; padding: 30px; color: #ef4444;"><b>Không tìm thấy dữ liệu câu hỏi!</b></div>';
            return;
        }

        let html = `
            <div style="background: linear-gradient(135deg, #e0c3fc 0%, #8ec5fc 100%); padding: 24px; border-radius: 16px; margin-bottom: 25px; box-shadow: 0 4px 10px rgba(0,0,0,0.05); color: #1e1b4b; text-align: center; border: 1px solid rgba(255,255,255,0.5);">
                <h2 style="margin: 0 0 8px 0; font-weight: 900; font-size: 1.5rem;">ĐIỂM SỐ: <span style="color: #ea580c; font-size: 1.4em; background: #fff; padding: 4px 18px; border-radius: 20px; box-shadow: 0 2px 4px rgba(0,0,0,0.05);">${latestResult.score}</span></h2>
                <p style="margin: 0; font-weight: 600; opacity: 0.85;">Trả lời đúng: ${latestResult.correctCount}/${latestResult.totalQuestions} câu</p>
            </div>
        `;

        questions.forEach((q, idx) => {
            const userAns = savedAnswers[idx];
            const correctAns = q.correctAnswer;
            let isUnanswered = userAns === undefined;

            if (isUnanswered) return;

            let optionsHtml = '';
            const opts = q.options || [];
            const labels = ['A','B','C','D', 'E', 'F'];

            opts.forEach((optText, oIdx) => {
                let bg = '#ffffff';
                let border = '2px solid #e2e8f0';
                let color = '#334155';
                let icon = '';
                let fw = 'normal';

                if (oIdx === correctAns) {
                    bg = '#ecfdf5'; border = '2px solid #10b981'; color = '#065f46'; fw = '700';
                    icon = '<i class="fa-solid fa-check-circle" style="color: #10b981; font-size: 1.2rem; float: right;"></i>';
                } else if (oIdx === userAns && userAns !== correctAns) {
                    bg = '#fef2f2'; border = '2px solid #ef4444'; color = '#991b1b'; fw = '700';
                    icon = '<i class="fa-solid fa-circle-xmark" style="color: #ef4444; font-size: 1.2rem; float: right;"></i>';
                }

                optionsHtml += `
                    <div style="padding: 14px 16px; margin-bottom: 10px; background: ${bg}; border: ${border}; border-radius: 10px; color: ${color}; font-weight: ${fw}; display: flex; justify-content: space-between; align-items: center; transition: 0.2s;">
                        <div style="flex: 1; line-height: 1.4;"><span style="display:inline-block; width: 28px; font-weight:800;">${labels[oIdx] !== undefined ? labels[oIdx] : oIdx}.</span> ${optText}</div>
                        <div>${icon}</div>
                    </div>
                `;
            });

            let explanationHtml = '';
            if (q.explanation && q.explanation.trim() !== '' && q.explanation.toLowerCase() !== 'không có giải thích chi tiết') {
                explanationHtml = `
                    <div style="margin-top: 16px; padding: 16px; background: #fffbeb; border-left: 4px solid #10b981; border-radius: 8px; font-size: 0.95rem; color: #065f46; box-shadow: 0 1px 2px rgba(0,0,0,0.02);">
                        <b style="color: #047857;"><i class="fa-solid fa-lightbulb"></i> Giải thích:</b><br><div style="margin-top: 6px; line-height: 1.5;">${q.explanation}</div>
                    </div>
                `;
            }

            let statusBadge = '';
            if (isUnanswered) {
                statusBadge = '<span style="background: #f1f5f9; color: #475569; padding: 4px 10px; border-radius: 6px; font-size: 0.8rem; font-weight: 700; margin-left: 12px; display: inline-flex; align-items: center; gap: 4px;"><i class="fa-solid fa-minus"></i> Chưa chọn</span>';
            } else if (userAns === correctAns) {
                statusBadge = '<span style="background: #d1fae5; color: #059669; padding: 4px 10px; border-radius: 6px; font-size: 0.8rem; font-weight: 700; margin-left: 12px; display: inline-flex; align-items: center; gap: 4px;"><i class="fa-solid fa-check"></i> Đúng</span>';
            } else {
                statusBadge = '<span style="background: #fee2e2; color: #e11d48; padding: 4px 10px; border-radius: 6px; font-size: 0.8rem; font-weight: 700; margin-left: 12px; display: inline-flex; align-items: center; gap: 4px;"><i class="fa-solid fa-xmark"></i> Sai</span>';
            }

            html += `
                <div style="background: #ffffff; padding: 24px; border-radius: 14px; margin-bottom: 20px; box-shadow: 0 2px 8px rgba(0,0,0,0.03); border: 1px solid #e2e8f0;">
                    <h4 style="margin: 0 0 18px 0; color: #0f172a; font-weight: 700; font-size: 1.05rem; line-height: 1.6; display: flex; align-items: center; flex-wrap: wrap;">
                        <span style="background: #f1f5f9; color: #334155; padding: 4px 12px; border-radius: 8px; font-size: 0.9rem; margin-right: 12px; border: 1px solid #e2e8f0;">Câu ${idx+1}</span>
                        <span style="flex: 1;">${q.text}</span>
                        ${statusBadge}
                    </h4>
                    <div>${optionsHtml}</div>
                    ${explanationHtml}
                </div>
            `;
        });

        contentArea.innerHTML = html;
    } catch (error) {
        console.error("Lỗi xem lại bài:", error);
        contentArea.innerHTML = '<div style="text-align:center; padding: 30px; color: #ef4444;"><b>Có lỗi xảy ra khi tải dữ liệu. Vui lòng thử lại!</b></div>';
    }
}

export function renderHistoryLB(historyData) {
    state.currentViewedExamId = historyData.examId; 
    
    document.getElementById('currentViewTitle').innerText = `Lịch sử thi`;
    document.getElementById('lbExamInfo').innerText = `Mã đề: ${historyData.examName || historyData.examId} | Ngày: ${historyData.createdAt ? historyData.createdAt.toDate().toLocaleString('vi-VN') : 'N/A'}`;
    
    UI.leaderboardBody.innerHTML = '';
    
    let rank = 1;
    const top10 = historyData.participants.slice(0, 10);
    
    top10.forEach(pData => {
        let displayScore = `${pData.score || 0} đ`;
        let displayTime = typeof pData.timeTaken === 'string' ? pData.timeTaken : '00:00';

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td class="col-rank"><div class="rank-badge" style="background: ${rank<=3 ? '#fef08a' : '#f1f5f9'}; color: ${rank<=3 ? '#a16207' : '#64748b'};">#${rank}</div></td>
            <td class="td-user"><img src="${pData.photoURL}" alt="avatar"><span>${pData.displayName}</span></td>
            <td><span style="background: #ecfdf5; color: #059669; border-radius: 6px; padding: 6px 12px; font-weight: 700; font-size: 0.85rem; display: inline-flex; align-items: center; gap: 6px;"><i class="fa-solid fa-check"></i> Đã nộp bài</span></td>
            <td class="score-text">${displayScore}</td>
            <td>${displayTime}</td>
        `;
        UI.leaderboardBody.appendChild(tr);
        rank++;
    });
}

export function renderUI() {
    UI.participantsGrid.innerHTML = '';
    UI.playerCount.textContent = state.currentParticipantsArray.length;
    
    // Tự động tìm đoạn giới hạn hiển thị cũ (/50) và đổi thành (/100) trên giao diện HTML
    if (UI.playerCount.parentNode) {
        UI.playerCount.parentNode.childNodes.forEach(node => {
            if (node.nodeType === Node.TEXT_NODE) {
                if (node.nodeValue.includes('/50')) node.nodeValue = node.nodeValue.replace('/50', '/100');
                if (node.nodeValue.includes('/ 50')) node.nodeValue = node.nodeValue.replace('/ 50', '/ 100');
            }
        });
    }

    const isCurrentUserHost = (state.currentHostEmail === state.currentUser.email);

    // =====================================================================
    // Ẩn nút Xem Lại Bài Làm nếu Vai trò là Giám thị
    // =====================================================================
    const btnReviewExam = document.getElementById('btnReviewExam');
    if (btnReviewExam) {
        if (isCurrentUserHost && state.currentHostRole === 'proctor') {
            btnReviewExam.style.setProperty('display', 'none', 'important'); 
        } else {
            btnReviewExam.style.setProperty('display', 'flex', 'important');
        }
    }
    // =====================================================================

    // =====================================================================
    // LOGIC PHÂN TRANG (PAGINATION) CHO DANH SÁCH NGƯỜI CHƠI
    // =====================================================================
    state.currentPage = state.currentPage || 1;
    state.pageSize = state.pageSize || 50; 
    
    const totalParticipants = state.currentParticipantsArray.length;
    const totalPages = Math.ceil(totalParticipants / state.pageSize) || 1;
    if (state.currentPage > totalPages) state.currentPage = totalPages;

    const startIndex = (state.currentPage - 1) * state.pageSize;
    const endIndex = startIndex + state.pageSize;
    const paginatedParticipants = state.currentParticipantsArray.slice(startIndex, endIndex);

    // Render danh sách dựa trên biến paginatedParticipants thay vì render tất cả
    paginatedParticipants.forEach(pData => {
        let badgeBg, badgeColor, badgeText, badgeIcon;
        let progressHTML = '';

        if (pData.uid === state.currentHostUid && state.currentHostRole === 'proctor') {
            badgeBg = '#fef3c7'; badgeColor = '#b45309'; badgeText = 'Giám thị'; badgeIcon = '<i class="fa-solid fa-eye"></i>';
        } else if (pData.status === 'playing') {
            badgeBg = '#fff7ed'; badgeColor = '#d97706'; badgeText = 'Đang thi'; badgeIcon = '<i class="fa-solid fa-pen"></i>';
            if (pData.totalQuestions) {
                const answered = pData.answeredCount || 0;
                const percent = Math.round((answered / pData.totalQuestions) * 100);
                progressHTML = `
                    <div style="width: 100%; background-color: #f1f5f9; border-radius: 999px; height: 6px; margin-top: 10px; overflow: hidden; box-shadow: inset 0 1px 2px rgba(0,0,0,0.05);">
                        <div style="background: linear-gradient(90deg, #3b82f6, #60a5fa); height: 100%; width: ${percent}%; transition: width 0.4s cubic-bezier(0.4, 0, 0.2, 1);"></div>
                    </div>
                    <div style="font-size: 0.7rem; color: #64748b; margin-top: 4px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">Đã làm: <span style="color:#0f172a;">${answered}/${pData.totalQuestions}</span></div>
                `;
            }
        } else if (pData.status === 'finished') {
            badgeBg = '#ecfdf5'; badgeColor = '#059669'; badgeText = 'Đã nộp'; badgeIcon = '<i class="fa-solid fa-check"></i>';
        } else {
            badgeBg = '#f0f9ff'; badgeColor = '#0284c7'; badgeText = 'Sẵn sàng'; badgeIcon = '';
        }
        
        let miniBadge = `<span style="background: ${badgeBg}; color: ${badgeColor}; padding: 4px 10px; border-radius: 12px; font-size: 0.75rem; font-weight: 700; text-transform: uppercase; margin-top: 4px; display: inline-flex; align-items: center; gap: 4px;">${badgeIcon} ${badgeText}</span>`;

        let kickBtnHTML = '';
        if (isCurrentUserHost && pData.uid !== state.currentUser.uid) {
            kickBtnHTML = `<button class="btn-kick" data-uid="${pData.uid}" title="Đuổi khỏi phòng" style="position:absolute; top: 8px; right: 8px; background: #fee2e2; color: #ef4444; border: none; width: 24px; height: 24px; border-radius: 50%; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: 0.2s;"><i class="fa-solid fa-xmark"></i></button>`;
        }

        let hostBadgeHTML = '';
        if (pData.uid === state.currentHostUid) {
            hostBadgeHTML = `<div style="position: absolute; bottom: -12px; left: 50%; transform: translateX(-50%); background: linear-gradient(135deg, #f59e0b, #ea580c); color: white; font-size: 0.7rem; font-weight: 800; padding: 4px 12px; border-radius: 12px; box-shadow: 0 4px 6px rgba(234, 88, 12, 0.3); z-index: 10; white-space: nowrap; letter-spacing: 0.5px;"><i class="fa-solid fa-crown" style="margin-right: 4px;"></i> CHỦ PHÒNG</div>`;
        }

        let liveBtnHTML = '';
        if (isCurrentUserHost && state.currentHostRole === 'proctor' && pData.status === 'playing') {
            liveBtnHTML = `<button class="btn-live-view" data-uid="${pData.uid}" style="margin-top:12px; width:100%; padding: 8px; background:#eff6ff; color:#2563eb; border:1px solid #bfdbfe; border-radius:8px; font-weight:bold; cursor:pointer; transition:0.2s;" onmouseover="this.style.background='#dbeafe'" onmouseout="this.style.background='#eff6ff'"><i class="fa-solid fa-satellite-dish" style="margin-right:5px; color:#ef4444;"></i> Xem Live</button>`;
        }

        const card = document.createElement('div');
        card.className = 'participant-card';
        card.style.cssText = "background: #ffffff; border: 1px solid #e2e8f0; border-radius: 14px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); text-align: center; padding: 18px 10px; position: relative; display: flex; flex-direction: column; align-items: center; transition: all 0.2s ease;";
        
        card.onmouseover = () => { card.style.transform = 'translateY(-4px)'; card.style.boxShadow = '0 10px 15px -3px rgba(0,0,0,0.1)'; card.style.borderColor = '#cbd5e1'; };
        card.onmouseout = () => { card.style.transform = 'translateY(0)'; card.style.boxShadow = '0 4px 6px -1px rgba(0,0,0,0.05)'; card.style.borderColor = '#e2e8f0'; };

        card.innerHTML = `
            ${kickBtnHTML}
            <img src="${pData.photoURL}" alt="avatar" style="width: 64px; height: 64px; border-radius: 50%; border: 3px solid #e0f2fe; padding: 2px; object-fit: cover; margin-bottom: 12px;">
            <div style="font-weight: 700; color: #0f172a; margin-bottom: 6px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; width: 100%; font-size: 0.95rem;" title="${pData.displayName}">${pData.displayName}</div>
            ${miniBadge}
            ${progressHTML}
            ${liveBtnHTML}
            ${hostBadgeHTML}
        `;
        UI.participantsGrid.appendChild(card);
    });

    // Sinh giao diện phân trang phía dưới Grid
    let paginationContainer = document.getElementById('participants-pagination');
    if (!paginationContainer) {
        paginationContainer = document.createElement('div');
        paginationContainer.id = 'participants-pagination';
        paginationContainer.style.cssText = "display: flex; justify-content: space-between; align-items: center; margin-top: 15px; padding: 12px 20px; background: #ffffff; border-radius: 10px; border: 1px solid #e2e8f0; box-shadow: 0 2px 4px rgba(0,0,0,0.02);";
        // Chèn Element phân trang vào ngay sau thẻ participantsGrid
        UI.participantsGrid.parentNode.insertBefore(paginationContainer, UI.participantsGrid.nextSibling);
    }

    paginationContainer.innerHTML = `
        <div style="display:flex; align-items:center; gap: 10px;">
            <label style="font-size: 0.9rem; font-weight: 700; color: #475569;"><i class="fa-solid fa-list-ol" style="color:#3b82f6;"></i> Số người/trang:</label>
            <select id="pageSizeSelect" style="padding: 6px 12px; border-radius: 8px; border: 1px solid #cbd5e1; outline: none; font-weight: 700; color: #0f172a; cursor: pointer;">
                <option value="10" ${state.pageSize === 10 ? 'selected' : ''}>10</option>
                <option value="20" ${state.pageSize === 20 ? 'selected' : ''}>20</option>
                <option value="30" ${state.pageSize === 30 ? 'selected' : ''}>30</option>
                <option value="40" ${state.pageSize === 40 ? 'selected' : ''}>40</option>
                <option value="50" ${state.pageSize === 50 ? 'selected' : ''}>50</option>
                <option value="100" ${state.pageSize === 100 ? 'selected' : ''}>100</option>
            </select>
        </div>
        <div style="display:flex; gap: 8px; align-items: center;">
            <button id="btnPrevPage" ${state.currentPage === 1 ? 'disabled' : ''} style="padding: 8px 14px; border: 1px solid #cbd5e1; border-radius: 8px; background: ${state.currentPage === 1 ? '#f8fafc' : '#ffffff'}; color: ${state.currentPage === 1 ? '#94a3b8' : '#3b82f6'}; cursor: ${state.currentPage === 1 ? 'not-allowed' : 'pointer'}; font-weight:bold; transition: 0.2s; box-shadow: ${state.currentPage === 1 ? 'none' : '0 2px 4px rgba(0,0,0,0.05)'};"><i class="fa-solid fa-chevron-left"></i> Trước</button>
            
            <span style="font-weight: 800; color: #0f172a; font-size: 0.95rem; padding: 0 15px; background: #f1f5f9; border-radius: 20px; padding: 4px 15px; border: 1px solid #e2e8f0;">${state.currentPage} / ${totalPages}</span>
            
            <button id="btnNextPage" ${state.currentPage === totalPages ? 'disabled' : ''} style="padding: 8px 14px; border: 1px solid #cbd5e1; border-radius: 8px; background: ${state.currentPage === totalPages ? '#f8fafc' : '#ffffff'}; color: ${state.currentPage === totalPages ? '#94a3b8' : '#3b82f6'}; cursor: ${state.currentPage === totalPages ? 'not-allowed' : 'pointer'}; font-weight:bold; transition: 0.2s; box-shadow: ${state.currentPage === totalPages ? 'none' : '0 2px 4px rgba(0,0,0,0.05)'};">Sau <i class="fa-solid fa-chevron-right"></i></button>
        </div>
    `;

    // Lắng nghe sự kiện chuyển trang và đổi số lượng hiển thị
    document.getElementById('pageSizeSelect').addEventListener('change', (e) => {
        state.pageSize = parseInt(e.target.value);
        state.currentPage = 1;
        renderUI();
    });
    document.getElementById('btnPrevPage').addEventListener('click', () => {
        if (state.currentPage > 1) { state.currentPage--; renderUI(); }
    });
    document.getElementById('btnNextPage').addEventListener('click', () => {
        if (state.currentPage < totalPages) { state.currentPage++; renderUI(); }
    });
    // =====================================================================


    document.querySelectorAll('.btn-kick').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const uidToKick = e.currentTarget.getAttribute('data-uid');
            if (confirm("Bạn có chắc chắn muốn mời người chơi này ra khỏi phòng?")) {
                try {
                    await deleteDoc(doc(db, `rooms/${state.roomId}/participants/${uidToKick}`));
                } catch (err) { console.error("Lỗi kick:", err); }
            }
        });
    });

    document.querySelectorAll('.btn-live-view').forEach(btn => {
        btn.addEventListener('click', (e) => {
            openLiveView(e.currentTarget.getAttribute('data-uid'));
        });
    });

    if (state.viewingHistoryMode) return;

    UI.leaderboardBody.innerHTML = '';
    const titleEl = document.getElementById('currentViewTitle');
    const infoEl = document.getElementById('lbExamInfo');
    const examNameSpan = document.getElementById('displayExamName').innerText;
    
    if(titleEl) titleEl.innerText = 'Lượt thi hiện tại';
    if(infoEl) infoEl.innerText = `Đề thi đang sử dụng: ${examNameSpan}`;

    let rank = 1;
    // Bảng xếp hạng luôn dùng mảng gốc, không ảnh hưởng bởi việc phân trang
    const top10 = state.currentParticipantsArray.slice(0, 10);

    top10.forEach(pData => {
        let badgeBg, badgeColor, badgeText, badgeIcon;
        let displayScore = '-';
        let displayTime = '-';

        if (pData.uid === state.currentHostUid && state.currentHostRole === 'proctor') {
            badgeBg = '#fef3c7'; badgeColor = '#b45309'; badgeText = 'Giám thị'; badgeIcon = '<i class="fa-solid fa-eye"></i>';
        } else if (pData.status === 'playing') {
            badgeBg = '#fff7ed'; badgeColor = '#d97706'; badgeText = 'Đang thi'; badgeIcon = '<i class="fa-solid fa-pen"></i>';
        } else if (pData.status === 'finished') {
            badgeBg = '#ecfdf5'; badgeColor = '#059669'; badgeText = 'Đã nộp bài'; badgeIcon = '<i class="fa-solid fa-check"></i>';
            displayScore = `${pData.score || 0} đ`;
            displayTime = typeof pData.timeTaken === 'string' ? pData.timeTaken : '00:00';
        } else {
            badgeBg = '#f8fafc'; badgeColor = '#64748b'; badgeText = 'Đang chờ'; badgeIcon = '<i class="fa-solid fa-clock"></i>';
        }
        
        let badgeHTML = `<span style="background: ${badgeBg}; color: ${badgeColor}; border-radius: 6px; padding: 6px 12px; font-weight: 700; font-size: 0.85rem; display: inline-flex; align-items: center; gap: 6px;">${badgeIcon} ${badgeText}</span>`;

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td class="col-rank"><div class="rank-badge" style="background: ${rank<=3 ? '#fef08a' : '#f1f5f9'}; color: ${rank<=3 ? '#a16207' : '#64748b'};">#${rank}</div></td>
            <td class="td-user"><img src="${pData.photoURL}" alt="avatar"><span>${pData.displayName}</span></td>
            <td>${badgeHTML}</td>
            <td class="score-text">${displayScore}</td>
            <td>${displayTime}</td>
        `;
        UI.leaderboardBody.appendChild(tr);
        rank++;
    });

    if (state.currentlyViewingLiveUid) {
        updateLiveViewModal();
    }
}
