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

    const tableContainer = UI.state2Leaderboard.querySelector('.table-container');
    const wrapper = document.createElement('div');
    wrapper.style.cssText = "display: flex; gap: 20px; align-items: flex-start; flex-wrap: wrap; margin-bottom: 20px;";
    
    const sidebar = document.createElement('div');
    sidebar.id = 'historySidebar';
    sidebar.style.cssText = "flex: 1; min-width: 250px; background: #f8f9fa; border-radius: 12px; border: 1px solid #e5e7eb; padding: 20px;";
    sidebar.innerHTML = `
        <style>
            .history-item { padding: 12px; margin-bottom: 10px; background: #fff; border: 1px solid #ced4da; border-radius: 8px; cursor: pointer; transition: 0.2s; box-shadow: 0 2px 4px rgba(0,0,0,0.02); }
            .history-item:hover { background: #e9ecef; }
            .history-item.active { background: #cfe2ff; border-color: #0d6efd; color: #084298; font-weight: bold; transform: translateX(5px); }
        </style>
        <h4 style="margin-bottom: 15px; font-weight: 800; color: #4b5563; font-size: 1.1rem; border-bottom: 2px solid #e5e7eb; padding-bottom: 10px;"><i class="fa-solid fa-clock-rotate-left"></i> Lịch sử lượt thi</h4>
        <div id="historyListContainer" style="display: flex; flex-direction: column; gap: 5px; max-height: 500px; overflow-y: auto; padding-right: 5px;">
            <div style="text-align: center; color: #6b7280; font-size: 0.9rem;">Chưa có lịch sử</div>
        </div>
    `;
    
    const rightCol = document.createElement('div');
    rightCol.id = 'lbCaptureArea';
    rightCol.style.cssText = "flex: 3; min-width: 300px; background: #ffffff; border-radius: 12px; border: 1px solid #e5e7eb; padding: 20px; position: relative;";
    rightCol.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; border-bottom: 2px solid #f3f4f6; padding-bottom: 15px;">
            <div>
                <h4 style="font-weight: 900; color: #ea580c; font-size: 1.4rem; margin: 0; text-transform: uppercase;" id="currentViewTitle">Lượt thi hiện tại</h4>
                <div id="lbExamInfo" style="color: #6b7280; font-weight: 600; margin-top: 5px; font-size: 0.95rem;">Đang cập nhật...</div>
            </div>
            <button id="btnDownloadLb" style="background: #0dcaf0; color: #000; border: none; padding: 10px 20px; border-radius: 8px; font-weight: 800; cursor: pointer; transition: 0.2s; box-shadow: 0 4px 0 #0aa2c0;"><i class="fa-solid fa-download"></i> LƯU ẢNH</button>
        </div>
    `;
    
    rightCol.appendChild(tableContainer);
    
    const watermark = document.createElement('div');
    watermark.id = 'lbWatermark';
    watermark.style.cssText = "display: none; text-align: center; margin-top: 20px; font-weight: 900; color: #9ca3af; font-size: 1.2rem; letter-spacing: 1px;";
    watermark.innerHTML = `ĐẤU TRƯỜNG QUIZAPP - MÃ PHÒNG: <span style="color:#084298">${state.roomId}</span>`;
    rightCol.appendChild(watermark);

    wrapper.appendChild(sidebar);
    wrapper.appendChild(rightCol);
    
    const lbHeader = UI.state2Leaderboard.querySelector('.leaderboard-header');
    lbHeader.parentNode.insertBefore(wrapper, lbHeader.nextSibling);

    const lbActions = document.querySelector('.lb-actions');
    if (lbActions && !document.getElementById('btnReviewExam')) {
        const btnReview = document.createElement('button');
        btnReview.id = 'btnReviewExam';
        btnReview.className = 'btn-secondary';
        btnReview.style.background = '#6f42c1';
        btnReview.style.marginBottom = '5px'; 
        btnReview.innerHTML = '<i class="fa-solid fa-eye"></i> XEM LẠI BÀI LÀM';
        lbActions.insertBefore(btnReview, UI.btnBackToLobby);
        btnReview.addEventListener('click', openReviewModal);
    }

    if (!document.getElementById('reviewExamModal')) {
        const modalHtml = `
        <div class="modal" id="reviewExamModal" style="z-index: 10000; padding-top: 2vh; background: rgba(0,0,0,0.6); backdrop-filter: blur(4px);">
            <div class="modal-content" style="max-width: 800px; width: 95%; height: 92vh; display: flex; flex-direction: column; padding: 0; background: #f4f6f8; overflow: hidden;">
                <div style="padding: 15px 20px; background: #ffffff; border-bottom: 1px solid #e5e7eb; display: flex; justify-content: space-between; align-items: center; box-shadow: 0 2px 4px rgba(0,0,0,0.05); z-index: 10;">
                    <h3 style="margin: 0; color: #084298; font-weight: 900; font-size: 1.3rem;"><i class="fa-solid fa-file-signature"></i> CHI TIẾT BÀI LÀM</h3>
                    <button id="closeReviewModalBtn" style="background: #f3f4f6; border: none; width: 35px; height: 35px; border-radius: 50%; font-size: 1.2rem; cursor: pointer; color: #4b5563; transition: 0.2s;"><i class="fa-solid fa-xmark"></i></button>
                </div>
                <div id="reviewContentArea" style="padding: 20px; overflow-y: auto; text-align: left; flex: 1; scroll-behavior: smooth;">
                </div>
            </div>
        </div>
        `;
        document.body.insertAdjacentHTML('beforeend', modalHtml);

        const closeBtn = document.getElementById('closeReviewModalBtn');
        closeBtn.addEventListener('click', () => document.getElementById('reviewExamModal').classList.remove('active'));
        closeBtn.onmouseover = function() { this.style.background = '#e5e7eb'; this.style.color = '#dc2626'; };
        closeBtn.onmouseout = function() { this.style.background = '#f3f4f6'; this.style.color = '#4b5563'; };
        
        document.getElementById('reviewExamModal').addEventListener('click', (e) => {
            if (e.target.id === 'reviewExamModal') e.target.classList.remove('active');
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
        
        if (window.html2canvas) {
            const canvas = await html2canvas(captureArea, { scale: 2, backgroundColor: '#ffffff', useCORS: true });
            const link = document.createElement('a');
            link.download = `BangXepHang_${state.roomId}_${new Date().getTime()}.png`;
            link.href = canvas.toDataURL('image/png');
            link.click();
        } else {
            alert("Đang tải thư viện xử lý ảnh, vui lòng bấm lại sau 2 giây...");
        }
        
        btnDown.style.display = 'block';
        watermarkEl.style.display = 'none';
        captureArea.style.border = '1px solid #e5e7eb';
    });

    const theadTr = tableContainer.querySelector('thead tr');
    if (theadTr && !theadTr.querySelector('.col-rank')) {
        const th = document.createElement('th');
        th.className = 'col-rank';
        th.style.width = '70px';
        th.innerText = 'Hạng';
        theadTr.insertBefore(th, theadTr.firstChild);
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
    
    contentArea.innerHTML = '<div style="text-align:center; padding: 50px;"><i class="fa-solid fa-circle-notch fa-spin fa-3x" style="color:#0d6efd"></i><h4 style="margin-top:20px; color:#4b5563;">Đang tải dữ liệu bài làm...</h4></div>';

    try {
        const rSnap = await getDocs(query(collection(db, "results"), where("email", "==", state.currentUser.email), where("examId", "==", state.currentViewedExamId)));
        let results = [];
        rSnap.forEach(d => results.push(d.data()));

        if (results.length === 0) {
            contentArea.innerHTML = '<div style="text-align:center; padding: 40px; color: #dc3545; font-size: 1.1rem; background: #fff; border-radius: 12px;"><b><i class="fa-solid fa-triangle-exclamation" style="font-size: 3rem; margin-bottom: 15px;"></i><br>Bạn chưa có kết quả nộp bài cho lượt thi này!</b><br><small style="color:#6c757d; display:block; margin-top:10px;">Chỉ khi hoàn thành bài thi và nộp bài, bạn mới có thể xem lại đáp án.</small></div>';
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
            contentArea.innerHTML = '<div style="text-align:center; padding: 30px; color: red;"><b>Không tìm thấy dữ liệu câu hỏi!</b></div>';
            return;
        }

        let html = `
            <div style="background: linear-gradient(135deg, #e0c3fc 0%, #8ec5fc 100%); padding: 20px; border-radius: 12px; margin-bottom: 25px; box-shadow: 0 4px 10px rgba(0,0,0,0.05); color: #1e1b4b; text-align: center;">
                <h2 style="margin: 0 0 5px 0; font-weight: 900;">ĐIỂM SỐ CỦA BẠN: <span style="color: #ea580c; font-size: 1.5em; background: #fff; padding: 2px 15px; border-radius: 20px;">${latestResult.score}</span></h2>
                <p style="margin: 0; font-weight: 600; opacity: 0.8;">Trả lời đúng: ${latestResult.correctCount}/${latestResult.totalQuestions} câu</p>
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
                let bg = '#fff';
                let border = '2px solid #e5e7eb';
                let color = '#374151';
                let icon = '';
                let fw = 'normal';

                if (oIdx === correctAns) {
                    bg = '#d1fae5'; border = '2px solid #10b981'; color = '#065f46'; fw = 'bold';
                    icon = '<i class="fa-solid fa-check-circle" style="color: #10b981; font-size: 1.2rem; float: right;"></i>';
                } else if (oIdx === userAns && userAns !== correctAns) {
                    bg = '#fee2e2'; border = '2px solid #ef4444'; color = '#991b1b'; fw = 'bold';
                    icon = '<i class="fa-solid fa-circle-xmark" style="color: #ef4444; font-size: 1.2rem; float: right;"></i>';
                }

                optionsHtml += `
                    <div style="padding: 12px 15px; margin-bottom: 10px; background: ${bg}; border: ${border}; border-radius: 8px; color: ${color}; font-weight: ${fw}; display: flex; justify-content: space-between; align-items: center;">
                        <div style="flex: 1;"><span style="display:inline-block; width: 25px; font-weight:900;">${labels[oIdx] !== undefined ? labels[oIdx] : oIdx}.</span> ${optText}</div>
                        <div>${icon}</div>
                    </div>
                `;
            });

            let explanationHtml = '';
            if (q.explanation && q.explanation.trim() !== '' && q.explanation.toLowerCase() !== 'không có giải thích chi tiết') {
                explanationHtml = `
                    <div style="margin-top: 15px; padding: 15px; background: #fef3c7; border-left: 4px solid #f59e0b; border-radius: 6px; font-size: 0.95rem; color: #92400e;">
                        <b style="color: #b45309;"><i class="fa-solid fa-lightbulb"></i> Giải thích:</b><br>${q.explanation}
                    </div>
                `;
            }

            let statusBadge = '';
            if (isUnanswered) {
                statusBadge = '<span style="background: #f3f4f6; color: #4b5563; padding: 3px 8px; border-radius: 4px; font-size: 0.8rem; font-weight: bold; margin-left: 10px;">Chưa chọn</span>';
            } else if (userAns === correctAns) {
                statusBadge = '<span style="background: #d1fae5; color: #065f46; padding: 3px 8px; border-radius: 4px; font-size: 0.8rem; font-weight: bold; margin-left: 10px;">Đúng</span>';
            } else {
                statusBadge = '<span style="background: #fee2e2; color: #991b1b; padding: 3px 8px; border-radius: 4px; font-size: 0.8rem; font-weight: bold; margin-left: 10px;">Sai</span>';
            }

            html += `
                <div style="background: #fff; padding: 25px; border-radius: 12px; margin-bottom: 20px; box-shadow: 0 4px 6px rgba(0,0,0,0.02); border: 1px solid #f3f4f6;">
                    <h4 style="margin: 0 0 15px 0; color: #1f2937; font-weight: 800; font-size: 1.1rem; line-height: 1.5;">
                        <span style="background: #3b82f6; color: #fff; padding: 4px 10px; border-radius: 6px; font-size: 0.9rem; margin-right: 8px;">Câu ${idx+1}</span>
                        ${q.text}
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
        contentArea.innerHTML = '<div style="text-align:center; padding: 30px; color: red;"><b>Có lỗi xảy ra khi tải dữ liệu. Vui lòng thử lại!</b></div>';
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
        let badgeHTML = '<span class="badge badge-finished"><i class="fa-solid fa-check"></i> Đã nộp bài</span>';
        let displayScore = `${pData.score || 0} đ`;
        let displayTime = typeof pData.timeTaken === 'string' ? pData.timeTaken : '00:00';

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><span style="background: ${rank<=3 ? '#ffc107' : '#e9ecef'}; padding: 5px 10px; border-radius: 50%; font-weight: bold; color: ${rank<=3 ? '#000' : '#4b5563'};">#${rank}</span></td>
            <td class="td-user"><img src="${pData.photoURL}" alt="avatar"><span>${pData.displayName}</span></td>
            <td>${badgeHTML}</td>
            <td style="color: #0d6efd; font-weight: 800;">${displayScore}</td>
            <td>${displayTime}</td>
        `;
        UI.leaderboardBody.appendChild(tr);
        rank++;
    });
}

export function renderUI() {
    UI.participantsGrid.innerHTML = '';
    UI.playerCount.textContent = state.currentParticipantsArray.length;
    
    const isCurrentUserHost = (state.currentHostEmail === state.currentUser.email);

    state.currentParticipantsArray.forEach(pData => {
        let badgeBg, badgeColor, badgeText;
        if (pData.status === 'playing') {
            badgeBg = '#fef3c7'; badgeColor = '#d97706'; badgeText = 'Đang thi';
        } else if (pData.status === 'finished') {
            badgeBg = '#d1fae5'; badgeColor = '#059669'; badgeText = 'Đã xong';
        } else {
            badgeBg = '#e0f2fe'; badgeColor = '#0369a1'; badgeText = 'Sẵn sàng';
        }
        
        let miniBadge = `<span style="background: ${badgeBg}; color: ${badgeColor}; padding: 4px 8px; border-radius: 9999px; font-size: 0.7rem; font-weight: 700; text-transform: uppercase; margin-top: 8px; display: inline-block;">${badgeText}</span>`;

        let kickBtnHTML = '';
        if (isCurrentUserHost && pData.uid !== state.currentUser.uid) {
            kickBtnHTML = `<button class="btn-kick" data-uid="${pData.uid}" title="Đuổi khỏi phòng"><i class="fa-solid fa-xmark"></i></button>`;
        }

        const card = document.createElement('div');
        card.className = 'participant-card';
        card.style.cssText = "background: #ffffff; border: 2px solid #0d6efd; border-radius: 12px; box-shadow: 0 4px 10px rgba(0,0,0,0.15); text-align: center; padding: 12px 8px; position: relative; display: flex; flex-direction: column; align-items: center; transition: transform 0.2s ease, box-shadow 0.2s ease;";
        
        card.onmouseover = () => { card.style.transform = 'translateY(-4px)'; card.style.boxShadow = '0 6px 15px rgba(0,0,0,0.2)'; };
        card.onmouseout = () => { card.style.transform = 'translateY(0)'; card.style.boxShadow = '0 4px 10px rgba(0,0,0,0.15)'; };

        // Tạo nhãn Chủ phòng nếu UID trùng khớp
        let hostBadgeHTML = '';
        if (pData.uid === state.currentHostUid) {
            hostBadgeHTML = `<div style="position: absolute; top: -10px; left: 50%; transform: translateX(-50%); background: linear-gradient(135deg, #f59e0b, #ea580c); color: white; font-size: 0.65rem; font-weight: 900; padding: 4px 10px; border-radius: 12px; box-shadow: 0 2px 4px rgba(234, 88, 12, 0.4); z-index: 10; white-space: nowrap;"><i class="fa-solid fa-crown"></i> CHỦ PHÒNG</div>`;
        }

        card.innerHTML = `
            ${kickBtnHTML}
            ${hostBadgeHTML}
            <img src="${pData.photoURL}" alt="avatar" style="width: 55px; height: 55px; border-radius: 50%; border: 2px solid #3b82f6; padding: 2px; object-fit: cover; margin-bottom: 4px;">
            <div style="font-weight: 600; color: #1f2937; margin-top: 8px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; width: 100%; font-size: 0.9rem;" title="${pData.displayName}">${pData.displayName}</div>
            ${miniBadge}
        `;
        UI.participantsGrid.appendChild(card);
    });

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

    if (state.viewingHistoryMode) return;

    UI.leaderboardBody.innerHTML = '';
    const titleEl = document.getElementById('currentViewTitle');
    const infoEl = document.getElementById('lbExamInfo');
    const examNameSpan = document.getElementById('displayExamName').innerText;
    
    if(titleEl) titleEl.innerText = 'Lượt thi hiện tại';
    if(infoEl) infoEl.innerText = `Đề thi đang sử dụng: ${examNameSpan}`;

    let rank = 1;
    const top10 = state.currentParticipantsArray.slice(0, 10);

    top10.forEach(pData => {
        let badgeHTML = '';
        let displayScore = '-';
        let displayTime = '-';

        if (pData.status === 'playing') {
            badgeHTML = '<span class="badge badge-playing"><i class="fa-solid fa-pen"></i> Đang thi</span>';
        } else if (pData.status === 'finished') {
            badgeHTML = '<span class="badge badge-finished"><i class="fa-solid fa-check"></i> Đã nộp bài</span>';
            displayScore = `${pData.score || 0} đ`;
            displayTime = typeof pData.timeTaken === 'string' ? pData.timeTaken : '00:00';
        } else {
            badgeHTML = '<span class="badge badge-waiting"><i class="fa-solid fa-clock"></i> Đang chờ</span>';
        }

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><span style="background: ${rank<=3 ? '#ffc107' : '#e9ecef'}; padding: 5px 10px; border-radius: 50%; font-weight: bold; color: ${rank<=3 ? '#000' : '#4b5563'};">#${rank}</span></td>
            <td class="td-user"><img src="${pData.photoURL}" alt="avatar"><span>${pData.displayName}</span></td>
            <td>${badgeHTML}</td>
            <td style="color: #0d6efd; font-weight: 800;">${displayScore}</td>
            <td>${displayTime}</td>
        `;
        UI.leaderboardBody.appendChild(tr);
        rank++;
    });
}
