import { auth, db } from "./dashboard-core.js";
import { doc, getDoc, setDoc, deleteDoc, updateDoc, writeBatch, onSnapshot, collection, getDocs, query, where, serverTimestamp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";

const headerUserName = document.getElementById('headerUserName');
const state1Waiting = document.getElementById('state1Waiting');
const state2Leaderboard = document.getElementById('state2Leaderboard');

const displayRoomId = document.getElementById('displayRoomId');
const displayExamName = document.getElementById('displayExamName');
const btnCopyRoomCode = document.getElementById('btnCopyRoomCode'); 
const participantsGrid = document.getElementById('participantsGrid');
const playerCount = document.getElementById('playerCount');
const btnStart = document.getElementById('btnStart');
const waitingText = document.getElementById('waitingText');
const hostPanel = document.getElementById('hostPanel');
const selectExamInLobby = document.getElementById('selectExamInLobby');
const btnOpenInviteModal = document.getElementById('btnOpenInviteModal');
const btnCopyLink = document.getElementById('btnCopyLink');
const btnLockRoom = document.getElementById('btnLockRoom'); 

let leaderboardBody = document.getElementById('leaderboardBody');
let btnEndRoom = document.getElementById('btnEndRoom');
let btnBackToLobby = document.getElementById('btnBackToLobby');

const inviteFriendModal = document.getElementById('inviteFriendModal');
const closeInviteModalBtn = document.getElementById('closeInviteModalBtn');
const inviteEmailInput = document.getElementById('inviteEmailInput');
const btnSendInvite = document.getElementById('btnSendInvite');

const btnOpenAiModal = document.getElementById('btnOpenAiModal');
const aiGenerateModal = document.getElementById('aiGenerateModal');
const closeAiModalBtn = document.getElementById('closeAiModalBtn');
const btnCancelAi = document.getElementById('btnCancelAi');
const btnSubmitAiGenerate = document.getElementById('btnSubmitAiGenerate');
const aiFormArea = document.getElementById('aiFormArea');
const aiLoadingSpinner = document.getElementById('aiLoadingSpinner');
const aiModalFooter = document.getElementById('aiModalFooter');
const aiPromptInput = document.getElementById('aiPromptInput');
const aiQuestionCount = document.getElementById('aiQuestionCount');
const aiDifficulty = document.getElementById('aiDifficulty');

const urlParams = new URLSearchParams(window.location.search);
const roomId = urlParams.get('roomId');
let currentUser = null;
let isExamsLoaded = false;
let currentRoomStatus = 'waiting';
let myParticipantStatus = 'waiting';
let forceLobbyView = false; 

let currentHostEmail = null;
let currentParticipantsArray = [];
let isKicked = false;
let viewingHistoryMode = false;

// CÁC BIẾN THEO DÕI ĐỂ XEM LẠI BÀI LÀM
let currentActiveExamId = null;
let currentViewedExamId = null;

if (!roomId) {
    alert("Không tìm thấy mã phòng hợp lệ!");
    window.location.href = "dashboard.html";
} else {
    if (displayRoomId) displayRoomId.textContent = roomId;
}

onAuthStateChanged(auth, (user) => {
    if (user) {
        currentUser = {
            uid: user.uid,
            email: user.email,
            displayName: user.displayName || user.email.split('@')[0],
            photoURL: user.photoURL || `https://ui-avatars.com/api/?name=${user.displayName || user.email}&background=random&color=fff`
        };
        if (headerUserName) headerUserName.textContent = currentUser.displayName;
        initLobby(); 
    } else {
        window.location.href = "index.html";
    }
});

btnBackToLobby.addEventListener('click', () => {
    forceLobbyView = true;
    viewingHistoryMode = false;
    currentViewedExamId = currentActiveExamId; // Reset lại mã đề đang xem về vòng hiện tại
    switchUIState('waiting');
    renderUI(); 
});

btnCopyRoomCode.addEventListener('click', async () => {
    try {
        await navigator.clipboard.writeText(roomId);
        alert("Đã sao chép mã phòng!");
    } catch (err) {
        console.error("Lỗi copy:", err);
    }
});

async function loadExamsToDropdown() {
    try {
        const examsRef = collection(db, "exams");
        const snapshot = await getDocs(query(examsRef));
        
        let standardExams = '';
        let aiExams = '';

        snapshot.forEach(docSnap => {
            const data = docSnap.data();
            const examId = docSnap.id;
            const tech = data.technique || 'Tổng hợp';
            const title = data.title || examId;
            const optionHtml = `<option value="${examId}">[${tech}] ${title}</option>`;

            if (data.technique === "AI Tự Động") {
                aiExams += optionHtml;
            } else {
                standardExams += optionHtml;
            }
        });

        selectExamInLobby.innerHTML = `
            <option value="">-- Chọn bộ đề để thi --</option>
            <optgroup label="📋 ĐỀ THI CÓ SẴN TRÊN HỆ THỐNG">
                ${standardExams || '<option disabled>Không có đề sẵn trong hệ thống</option>'}
            </optgroup>
            <optgroup label="✨ ĐỀ THI DO AI TỰ ĐỘNG SOẠN">
                ${aiExams || '<option disabled>Chưa có đề AI nào được tạo</option>'}
            </optgroup>
        `;
        isExamsLoaded = true;
    } catch (error) {
        console.error("Lỗi lấy danh sách đề:", error);
        selectExamInLobby.innerHTML = '<option value="">-- Lỗi tải dữ liệu danh sách đề --</option>';
    }
}

function switchUIState(state) {
    if (state === 'waiting') {
        state1Waiting.style.display = 'block';
        state2Leaderboard.style.display = 'none';
    } else {
        state1Waiting.style.display = 'none';
        state2Leaderboard.style.display = 'block';
    }
}

function parseTimeSafely(timeVal) {
    if (typeof timeVal === 'number') return timeVal;
    if (typeof timeVal === 'string') {
        const parts = timeVal.split(':');
        if (parts.length === 2) return parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
    }
    return 999999;
}

// ==============================================================
// 1. GIAO DIỆN LB NÂNG CAO (LỊCH SỬ + LƯU ẢNH + XEM LẠI BÀI)
// ==============================================================
function enhanceLeaderboardUI() {
    if (document.getElementById('historySidebar')) return;

    const lbCard = document.getElementById('state2Leaderboard');
    const tableContainer = lbCard.querySelector('.table-container');
    
    const wrapper = document.createElement('div');
    wrapper.style.cssText = "display: flex; gap: 20px; align-items: flex-start; flex-wrap: wrap; margin-bottom: 20px;";
    
    // CỘT TRÁI: LỊCH SỬ THI
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
    
    // CỘT PHẢI: BẢNG XẾP HẠNG
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
    
    // WATERMARK (Ẩn, chỉ hiện khi chụp)
    const watermark = document.createElement('div');
    watermark.id = 'lbWatermark';
    watermark.style.cssText = "display: none; text-align: center; margin-top: 20px; font-weight: 900; color: #9ca3af; font-size: 1.2rem; letter-spacing: 1px;";
    watermark.innerHTML = `ĐẤU TRƯỜNG QUIZAPP - MÃ PHÒNG: <span style="color:#084298">${roomId}</span>`;
    rightCol.appendChild(watermark);

    wrapper.appendChild(sidebar);
    wrapper.appendChild(rightCol);
    
    const lbHeader = lbCard.querySelector('.leaderboard-header');
    lbHeader.parentNode.insertBefore(wrapper, lbHeader.nextSibling);

    // BƠM NÚT XEM LẠI BÀI VÀO PHẦN ACTION
    const lbActions = document.querySelector('.lb-actions');
    if (lbActions && !document.getElementById('btnReviewExam')) {
        const btnReview = document.createElement('button');
        btnReview.id = 'btnReviewExam';
        btnReview.className = 'btn-secondary';
        btnReview.style.background = '#6f42c1';
        btnReview.style.marginBottom = '5px'; // Khoảng cách với nút bên dưới
        btnReview.innerHTML = '<i class="fa-solid fa-eye"></i> XEM LẠI BÀI LÀM';
        lbActions.insertBefore(btnReview, document.getElementById('btnBackToLobby'));
        
        // Sự kiện Xem lại bài
        btnReview.addEventListener('click', openReviewModal);
    }

    // BƠM MODAL XEM LẠI BÀI VÀO BODY
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

        // Nút đóng modal
        const closeBtn = document.getElementById('closeReviewModalBtn');
        closeBtn.addEventListener('click', () => document.getElementById('reviewExamModal').classList.remove('active'));
        closeBtn.onmouseover = function() { this.style.background = '#e5e7eb'; this.style.color = '#dc2626'; };
        closeBtn.onmouseout = function() { this.style.background = '#f3f4f6'; this.style.color = '#4b5563'; };
        
        // Đóng khi click ngoài
        document.getElementById('reviewExamModal').addEventListener('click', (e) => {
            if (e.target.id === 'reviewExamModal') e.target.classList.remove('active');
        });
    }

    // Kéo thư viện Html2Canvas
    if (!window.html2canvas) {
        const script = document.createElement('script');
        script.src = "https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js";
        document.head.appendChild(script);
    }

    // Sự kiện Lưu ảnh BXH
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
            link.download = `BangXepHang_${roomId}_${new Date().getTime()}.png`;
            link.href = canvas.toDataURL('image/png');
            link.click();
        } else {
            alert("Đang tải thư viện xử lý ảnh, vui lòng bấm lại sau 2 giây...");
        }
        
        btnDown.style.display = 'block';
        watermarkEl.style.display = 'none';
        captureArea.style.border = '1px solid #e5e7eb';
    });

    // Thêm cột "Hạng"
    const theadTr = tableContainer.querySelector('thead tr');
    if (theadTr && !theadTr.querySelector('.col-rank')) {
        const th = document.createElement('th');
        th.className = 'col-rank';
        th.style.width = '70px';
        th.innerText = 'Hạng';
        theadTr.insertBefore(th, theadTr.firstChild);
    }
}

// ==============================================================
// 2. LOGIC XEM LẠI BÀI LÀM (FETCH FIREBASE & TẠO GIAO DIỆN)
// ==============================================================
async function openReviewModal() {
    if (!currentViewedExamId) {
        alert("Đề thi chưa được thiết lập!"); 
        return;
    }

    const modal = document.getElementById('reviewExamModal');
    const contentArea = document.getElementById('reviewContentArea');
    modal.classList.add('active');
    
    contentArea.innerHTML = '<div style="text-align:center; padding: 50px;"><i class="fa-solid fa-circle-notch fa-spin fa-3x" style="color:#0d6efd"></i><h4 style="margin-top:20px; color:#4b5563;">Đang tải dữ liệu bài làm...</h4></div>';

    try {
        // 1. Kéo dữ liệu kết quả mới nhất của user cho mã đề này
        const rSnap = await getDocs(query(collection(db, "results"), where("email", "==", currentUser.email), where("examId", "==", currentViewedExamId)));
        let results = [];
        rSnap.forEach(d => results.push(d.data()));

        if (results.length === 0) {
            contentArea.innerHTML = '<div style="text-align:center; padding: 40px; color: #dc3545; font-size: 1.1rem; background: #fff; border-radius: 12px;"><b><i class="fa-solid fa-triangle-exclamation" style="font-size: 3rem; margin-bottom: 15px;"></i><br>Bạn chưa có kết quả nộp bài cho lượt thi này!</b><br><small style="color:#6c757d; display:block; margin-top:10px;">Chỉ khi hoàn thành bài thi và nộp bài, bạn mới có thể xem lại đáp án.</small></div>';
            return;
        }

        // Sắp xếp giảm dần theo thời gian để lấy bài thi mới nhất
        results.sort((a,b) => new Date(b.timestamp) - new Date(a.timestamp));
        const latestResult = results[0];
        const savedAnswers = latestResult.savedAnswers || {};

        // 2. Kéo danh sách câu hỏi
        const qSnap = await getDocs(query(collection(db, "questions"), where("examId", "==", currentViewedExamId)));
        let questions = [];
        qSnap.forEach(d => questions.push({id: d.id, ...d.data()}));
        questions.sort((a, b) => a.order - b.order);

        if (questions.length === 0) {
            contentArea.innerHTML = '<div style="text-align:center; padding: 30px; color: red;"><b>Không tìm thấy dữ liệu câu hỏi!</b></div>';
            return;
        }

        // 3. Render giao diện
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

            let optionsHtml = '';
            const opts = q.options || [];
            const labels = ['A','B','C','D', 'E', 'F'];

            opts.forEach((optText, oIdx) => {
                let bg = '#fff';
                let border = '2px solid #e5e7eb';
                let color = '#374151';
                let icon = '';
                let fw = 'normal';

                // Định dạng màu sắc chuẩn: Xanh (Đúng), Đỏ (Sai)
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

            // Giao diện giải thích
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

function renderHistoryLB(historyData) {
    currentViewedExamId = historyData.examId; // Cập nhật ID đang xem để xem lại bài làm
    
    document.getElementById('currentViewTitle').innerText = `Lịch sử thi`;
    document.getElementById('lbExamInfo').innerText = `Mã đề: ${historyData.examName || historyData.examId} | Ngày: ${historyData.createdAt ? historyData.createdAt.toDate().toLocaleString('vi-VN') : 'N/A'}`;
    
    leaderboardBody.innerHTML = '';
    
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
        leaderboardBody.appendChild(tr);
        rank++;
    });
}

function renderUI() {
    participantsGrid.innerHTML = '';
    playerCount.textContent = currentParticipantsArray.length;
    
    const isCurrentUserHost = (currentHostEmail === currentUser.email);

    currentParticipantsArray.forEach(pData => {
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
        if (isCurrentUserHost && pData.uid !== currentUser.uid) {
            kickBtnHTML = `<button class="btn-kick" data-uid="${pData.uid}" title="Đuổi khỏi phòng"><i class="fa-solid fa-xmark"></i></button>`;
        }

        const card = document.createElement('div');
        card.className = 'participant-card';
        card.style.cssText = "background: #ffffff; border: 2px solid #0d6efd; border-radius: 12px; box-shadow: 0 4px 10px rgba(0,0,0,0.15); text-align: center; padding: 12px 8px; position: relative; display: flex; flex-direction: column; align-items: center; transition: transform 0.2s ease, box-shadow 0.2s ease;";
        
        card.onmouseover = () => { card.style.transform = 'translateY(-4px)'; card.style.boxShadow = '0 6px 15px rgba(0,0,0,0.2)'; };
        card.onmouseout = () => { card.style.transform = 'translateY(0)'; card.style.boxShadow = '0 4px 10px rgba(0,0,0,0.15)'; };

        card.innerHTML = `
            ${kickBtnHTML}
            <img src="${pData.photoURL}" alt="avatar" style="width: 55px; height: 55px; border-radius: 50%; border: 2px solid #3b82f6; padding: 2px; object-fit: cover; margin-bottom: 4px;">
            <div style="font-weight: 600; color: #1f2937; margin-top: 8px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; width: 100%; font-size: 0.9rem;" title="${pData.displayName}">${pData.displayName}</div>
            ${miniBadge}
        `;
        participantsGrid.appendChild(card);
    });

    document.querySelectorAll('.btn-kick').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const uidToKick = e.currentTarget.getAttribute('data-uid');
            if (confirm("Bạn có chắc chắn muốn mời người chơi này ra khỏi phòng?")) {
                try {
                    await deleteDoc(doc(db, `rooms/${roomId}/participants/${uidToKick}`));
                } catch (err) { console.error("Lỗi kick:", err); }
            }
        });
    });

    // ==========================================
    // RENDER LEADERBOARD (Top 10 người xuất sắc)
    // ==========================================
    if (viewingHistoryMode) return;

    leaderboardBody.innerHTML = '';
    const titleEl = document.getElementById('currentViewTitle');
    const infoEl = document.getElementById('lbExamInfo');
    const examNameSpan = document.getElementById('displayExamName').innerText;
    
    if(titleEl) titleEl.innerText = 'Lượt thi hiện tại';
    if(infoEl) infoEl.innerText = `Đề thi đang sử dụng: ${examNameSpan}`;

    let rank = 1;
    const top10 = currentParticipantsArray.slice(0, 10);

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
        leaderboardBody.appendChild(tr);
        rank++;
    });
}

async function initLobby() {
    enhanceLeaderboardUI(); 

    const roomRef = doc(db, 'rooms', roomId);
    const participantRef = doc(db, `rooms/${roomId}/participants/${currentUser.uid}`);
    const participantsColl = collection(db, `rooms/${roomId}/participants`);

    try {
        const initRoomSnap = await getDoc(roomRef);
        if (!initRoomSnap.exists()) {
            alert("Phòng thi này không tồn tại!");
            window.location.href = "dashboard.html";
            return;
        }
        const initialRoomData = initRoomSnap.data();
        const pSnap = await getDoc(participantRef);
        
        if (pSnap.exists()) {
            await setDoc(participantRef, { displayName: currentUser.displayName, photoURL: currentUser.photoURL }, { merge: true });
            myParticipantStatus = pSnap.data().status || 'waiting';
        } else {
            if (initialRoomData.isLocked === true) {
                alert("Phòng thi này đã bị khóa bởi Chủ phòng.");
                window.location.href = 'dashboard.html';
                return;
            }

            const currentParticipants = await getDocs(participantsColl);
            if (currentParticipants.size >= 50) {
                alert("Rất tiếc! Phòng thi này đã đạt giới hạn tối đa 50 người tham gia.");
                window.location.href = 'dashboard.html';
                return;
            }

            await setDoc(participantRef, {
                uid: currentUser.uid, displayName: currentUser.displayName, photoURL: currentUser.photoURL,
                joinedAt: serverTimestamp(), status: 'waiting', score: 0, timeTaken: '00:00'
            });
            myParticipantStatus = 'waiting';
        }

        window.addEventListener('beforeunload', () => {
            if (currentRoomStatus === 'waiting' && !isKicked) deleteDoc(participantRef);
        });

        // LẮNG NGHE LỊCH SỬ THI BÊN TRÁI
        const historyColl = collection(db, `rooms/${roomId}/history`);
        onSnapshot(query(historyColl), (snapshot) => {
            const container = document.getElementById('historyListContainer');
            if(!container) return;
            container.innerHTML = '';
            
            const currBtn = document.createElement('div');
            currBtn.className = viewingHistoryMode ? 'history-item' : 'history-item active';
            currBtn.innerHTML = `<b><i class="fa-solid fa-play"></i> Lượt hiện tại</b>`;
            currBtn.onclick = () => {
                document.querySelectorAll('.history-item').forEach(el => el.classList.remove('active'));
                currBtn.classList.add('active');
                viewingHistoryMode = false;
                currentViewedExamId = currentActiveExamId; // Gán lại ID đang xem
                renderUI();
            }
            container.appendChild(currBtn);

            let roundCount = 1;
            snapshot.forEach(doc => {
                const data = doc.data();
                const histBtn = document.createElement('div');
                histBtn.className = 'history-item';
                const dateStr = data.createdAt ? data.createdAt.toDate().toLocaleString('vi-VN') : '';
                histBtn.innerHTML = `<b><i class="fa-solid fa-medal" style="color:#f59e0b"></i> Lượt thi ${roundCount}</b><br><small style="color:#6b7280">${dateStr}</small>`;
                
                histBtn.onclick = () => {
                    document.querySelectorAll('.history-item').forEach(el => el.classList.remove('active'));
                    histBtn.classList.add('active');
                    viewingHistoryMode = true;
                    renderHistoryLB(data);
                }
                container.appendChild(histBtn);
                roundCount++;
            });
        });

        onSnapshot(participantsColl, (snapshot) => {
            let amIInRoom = false;
            currentParticipantsArray = [];
            
            snapshot.forEach(doc => {
                const data = doc.data();
                currentParticipantsArray.push(data);
                if (data.uid === currentUser.uid) {
                    amIInRoom = true;
                    myParticipantStatus = data.status || 'waiting';
                }
            });

            if (!amIInRoom && currentRoomStatus === 'waiting' && !isKicked) {
                isKicked = true;
                alert("Bạn đã bị chủ phòng mời ra ngoài.");
                window.location.href = 'dashboard.html';
                return;
            }

            currentParticipantsArray.sort((a, b) => {
                const isAFinished = (a.status === 'finished') ? 1 : 0;
                const isBFinished = (b.status === 'finished') ? 1 : 0;
                if (isAFinished !== isBFinished) return isBFinished - isAFinished; 

                const scoreA = (typeof a.score === 'number') ? a.score : 0;
                const scoreB = (typeof b.score === 'number') ? b.score : 0;
                if (scoreB !== scoreA) return scoreB - scoreA; 

                const timeSecA = parseTimeSafely(a.timeTaken);
                const timeSecB = parseTimeSafely(b.timeTaken);
                return timeSecA - timeSecB;
            });

            renderUI();
        });

        onSnapshot(roomRef, async (docSnap) => {
            if (!docSnap.exists()) {
                alert("Phòng thi này không tồn tại hoặc đã bị đóng!");
                window.location.href = "dashboard.html";
                return;
            }

            const roomData = docSnap.data();
            currentRoomStatus = roomData.status;
            currentHostEmail = roomData.hostEmail;
            
            currentActiveExamId = roomData.examId;
            if (!viewingHistoryMode) {
                currentViewedExamId = currentActiveExamId;
            }

            if (roomData.examId) {
                displayExamName.innerHTML = `<i class="fa-solid fa-book-open"></i> ${roomData.examName || "Đề thi đã chọn"}`;
            } else {
                displayExamName.innerHTML = `<i class="fa-solid fa-circle-notch fa-spin"></i> Chủ phòng đang cấu hình...`;
            }

            const isHost = (currentHostEmail === currentUser.email);
            
            if (isHost) {
                hostPanel.style.display = 'block';
                waitingText.style.display = 'none';
                
                // ==============================================================
                // CHỦ PHÒNG: ĐIỀU KHIỂN NÚT "TẠO LƯỢT MỚI" VÀ "XEM BXH"
                // ==============================================================
                if (currentRoomStatus === 'playing' || currentRoomStatus === 'closed') {
                    btnEndRoom.style.display = 'block';
                    btnEndRoom.innerHTML = '<i class="fa-solid fa-rotate-right"></i> TẠO LƯỢT THI MỚI';
                    btnEndRoom.style.background = '#dc3545';
                    btnEndRoom.style.color = '#fff';
                    btnEndRoom.disabled = false;

                    selectExamInLobby.setAttribute('disabled', 'true');

                    btnStart.style.display = 'block';
                    btnStart.innerHTML = '<i class="fa-solid fa-trophy"></i> XEM BẢNG XẾP HẠNG';
                    btnStart.style.background = '#0dcaf0'; 
                    btnStart.style.color = '#000';
                    btnStart.removeAttribute('disabled');
                } else { 
                    btnEndRoom.style.display = 'none';
                    selectExamInLobby.removeAttribute('disabled');
                    
                    btnStart.style.display = 'block';
                    btnStart.innerHTML = '<i class="fa-solid fa-play"></i> BẮT ĐẦU THI';
                    btnStart.style.background = '';
                    btnStart.style.color = '';
                    
                    if (roomData.examId) btnStart.removeAttribute('disabled');
                    else btnStart.setAttribute('disabled', 'true');
                }

                if (roomData.isLocked) {
                    btnLockRoom.innerHTML = '<i class="fa-solid fa-lock"></i> Mở khóa';
                    btnLockRoom.style.background = '#ffc107'; 
                    btnLockRoom.setAttribute('data-locked', 'true');
                } else {
                    btnLockRoom.innerHTML = '<i class="fa-solid fa-lock-open"></i> Khóa phòng';
                    btnLockRoom.style.background = '#dc3545'; 
                    btnLockRoom.setAttribute('data-locked', 'false');
                }

                if (!isExamsLoaded) await loadExamsToDropdown();
                if (roomData.examId && selectExamInLobby.value !== roomData.examId) selectExamInLobby.value = roomData.examId;
                else if (!roomData.examId) selectExamInLobby.value = "";

            } else {
                // ==============================================================
                // NGƯỜI CHƠI
                // ==============================================================
                hostPanel.style.display = 'none';
                btnEndRoom.style.display = 'none'; 
                
                if (currentRoomStatus === 'playing' || currentRoomStatus === 'closed') {
                    if (myParticipantStatus === 'finished') {
                        waitingText.style.display = 'none';
                        btnStart.style.display = 'block';
                        btnStart.innerHTML = '<i class="fa-solid fa-trophy"></i> XEM BẢNG XẾP HẠNG';
                        btnStart.style.background = '#0dcaf0'; 
                        btnStart.style.color = '#000';
                        btnStart.removeAttribute('disabled');
                    } else {
                        btnStart.style.display = 'none';
                        waitingText.style.display = 'block';
                        waitingText.textContent = "Bạn đang ở ngoài phòng thi...";
                    }
                } else {
                    btnStart.style.display = 'none';
                    waitingText.style.display = 'block';
                    waitingText.textContent = roomData.examId ? "Đang chờ chủ phòng bắt đầu thi..." : "Đang chờ chủ phòng cấu hình bài thi...";
                }
            }

            renderUI();

            if (currentRoomStatus === 'waiting') {
                forceLobbyView = false;
                switchUIState('waiting');
            } 
            else if (currentRoomStatus === 'playing') {
                if (myParticipantStatus !== 'finished') {
                    if (myParticipantStatus === 'waiting') {
                        await updateDoc(participantRef, { status: 'playing' });
                    }
                    window.location.href = `quiz-room.html?examId=${roomData.examId}&roomId=${roomId}`;
                } else {
                    if (isHost && forceLobbyView === false) {
                        forceLobbyView = true;
                        switchUIState('waiting');
                    } else if (!forceLobbyView) {
                        switchUIState('playing');
                    }
                }
            } 
        });

        // =========================================================================
        // SỰ KIỆN KHI CHỦ PHÒNG CHỌN ĐỀ
        // =========================================================================
        selectExamInLobby.addEventListener('change', async () => {
            const selectedExamId = selectExamInLobby.value;
            const selectedExamName = selectedExamId ? selectExamInLobby.options[selectExamInLobby.selectedIndex].text : null;
            
            if (selectedExamId) {
                btnStart.removeAttribute('disabled');
                displayExamName.innerHTML = `<i class="fa-solid fa-book-open"></i> ${selectedExamName}`;
            } else {
                btnStart.setAttribute('disabled', 'true');
                displayExamName.innerHTML = `<i class="fa-solid fa-circle-notch fa-spin"></i> Chủ phòng đang cấu hình...`;
            }

            try {
                await updateDoc(roomRef, { examId: selectedExamId || null, examName: selectedExamName, status: 'waiting' });
                
                try {
                    const batch = writeBatch(db);
                    const pSnapshot = await getDocs(participantsColl);
                    pSnapshot.forEach((docItem) => {
                        batch.update(docItem.ref, { status: 'waiting', score: 0, timeTaken: '00:00' });
                    });
                    await batch.commit();
                } catch (batchErr) {
                    console.warn("Đã lưu đề thi (Lỗi batch reset điểm không ảnh hưởng giao diện).", batchErr);
                }
                
                forceLobbyView = false;
            } catch (err) { 
                console.error("Lỗi cập nhật phòng:", err); 
                alert("Lỗi: Không thể kết nối tới máy chủ. Vui lòng kiểm tra quyền hoặc kết nối mạng!");
                
                if (!roomData.examId) {
                    btnStart.setAttribute('disabled', 'true');
                    displayExamName.innerHTML = `<i class="fa-solid fa-circle-notch fa-spin"></i> Chủ phòng đang cấu hình...`;
                }
            }
        });

        btnStart.addEventListener('click', async () => {
            if (currentRoomStatus === 'playing' || currentRoomStatus === 'closed') {
                forceLobbyView = false;
                viewingHistoryMode = false;
                switchUIState('playing'); 
                renderUI();
            } else {
                btnStart.setAttribute('disabled', 'true');
                btnStart.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> ĐANG KHỞI ĐỘNG...';
                try {
                    await updateDoc(roomRef, { status: 'playing' });
                } catch (error) {
                    btnStart.removeAttribute('disabled');
                    btnStart.innerHTML = '<i class="fa-solid fa-play"></i> BẮT ĐẦU THI';
                }
            }
        });

        // ==============================================================
        // TẠO LƯỢT THI (ĐÓNG PHÒNG, LƯU LỊCH SỬ, RESET)
        // ==============================================================
        btnEndRoom.addEventListener('click', async () => {
            if (confirm("Xác nhận TẠO LƯỢT THI MỚI?\nHệ thống sẽ thu bài tất cả người đang thi, lưu kết quả hiện tại vào Lịch sử và thiết lập lại phòng.")) {
                btnEndRoom.disabled = true;
                btnEndRoom.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Đang thu bài...';
                try {
                    await updateDoc(roomRef, { status: 'closed' });

                    await new Promise(resolve => setTimeout(resolve, 3000));
                    
                    btnEndRoom.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Đang lưu lịch sử...';

                    const pSnapshot = await getDocs(participantsColl);
                    let finalParticipants = [];
                    pSnapshot.forEach(d => finalParticipants.push(d.data()));

                    finalParticipants.sort((a, b) => {
                        const isAFinished = (a.status === 'finished') ? 1 : 0;
                        const isBFinished = (b.status === 'finished') ? 1 : 0;
                        if (isAFinished !== isBFinished) return isBFinished - isAFinished; 
                        const scoreA = (typeof a.score === 'number') ? a.score : 0;
                        const scoreB = (typeof b.score === 'number') ? b.score : 0;
                        if (scoreB !== scoreA) return scoreB - scoreA; 
                        const timeSecA = parseTimeSafely(a.timeTaken);
                        const timeSecB = parseTimeSafely(b.timeTaken);
                        return timeSecA - timeSecB;
                    });

                    const currentRoomData = (await getDoc(roomRef)).data();
                    await setDoc(doc(collection(db, `rooms/${roomId}/history`)), {
                        examId: currentRoomData.examId || 'N/A',
                        examName: currentRoomData.examName || 'N/A',
                        createdAt: serverTimestamp(),
                        participants: finalParticipants
                    });

                    const batch = writeBatch(db);
                    pSnapshot.forEach((docItem) => {
                        batch.update(docItem.ref, { status: 'waiting', score: 0, timeTaken: '00:00' });
                    });
                    await batch.commit();

                    await updateDoc(roomRef, { status: 'waiting' });
                    
                    forceLobbyView = false;
                    viewingHistoryMode = false;
                    btnEndRoom.disabled = false;
                    
                } catch (error) {
                    console.error("Lỗi làm mới phòng:", error);
                    btnEndRoom.disabled = false;
                    alert("Đã xảy ra lỗi khi tạo lượt mới!");
                }
            }
        });

        // ================= LOGIC TẠO ĐỀ BẰNG AI TRONG LOBBY =================
        function resetAiForm() {
            if (aiPromptInput) aiPromptInput.value = '';
            if (aiFormArea) aiFormArea.style.display = 'block';
            if (aiLoadingSpinner) aiLoadingSpinner.style.display = 'none';
            if (aiModalFooter) aiModalFooter.style.display = 'flex';
        }

        const closeAiModal = () => aiGenerateModal.classList.remove('active');
        
        btnOpenAiModal.addEventListener('click', () => {
            aiGenerateModal.classList.add('active');
            resetAiForm();
        });
        
        if (closeAiModalBtn) closeAiModalBtn.addEventListener('click', closeAiModal);
        if (btnCancelAi) btnCancelAi.addEventListener('click', closeAiModal);
        aiGenerateModal.addEventListener('click', (e) => { if (e.target === aiGenerateModal) closeAiModal(); });

        btnSubmitAiGenerate.addEventListener('click', async () => {
            const prompt = aiPromptInput.value.trim();
            const questionCount = aiQuestionCount.value;
            const difficulty = aiDifficulty.value;

            if (!prompt) return alert("Vui lòng nhập chủ đề cần tạo đề!");

            aiFormArea.style.display = 'none';
            aiModalFooter.style.display = 'none';
            aiLoadingSpinner.style.display = 'block';

            try {
                const strictPrompt = prompt + "\n\nYÊU CẦU BẮT BUỘC: Mỗi câu hỏi trắc nghiệm phải có CHÍNH XÁC 4 ĐÁP ÁN (A, B, C, D). Tuyệt đối không được tạo 5 đáp án.";

                const response = await fetch('/api/generate', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ promptText: strictPrompt, questionCount: questionCount, difficulty: difficulty })
                });

                if (!response.ok) {
                    const errorData = await response.text();
                    throw new Error(`Lỗi gọi API (${response.status}): ${errorData}`);
                }

                const questions = await response.json();
                if (!Array.isArray(questions) || questions.length === 0) throw new Error("AI không tạo được câu hỏi nào.");

                const examId = "AI-" + Math.random().toString(36).substring(2, 8).toUpperCase();

                const savePromises = questions.map((q, i) => {
                    const questionId = `${examId}-Q${i + 1}`;
                    let rawOptions = q.options || q.answers || [];
                    let safeOptions = rawOptions.length > 4 ? rawOptions.slice(0, 4) : rawOptions;
                    let safeCorrectAnswer = q.correctAnswer !== undefined ? q.correctAnswer : (q.correct || 0);
                    if (safeCorrectAnswer > 3) safeCorrectAnswer = 0; 

                    return setDoc(doc(db, "questions", questionId), {
                        examId: examId,
                        text: q.text || q.questionText || q.question || q.content || "Lỗi AI",
                        options: safeOptions,
                        correctAnswer: safeCorrectAnswer,
                        explanation: q.explanation || "Không có giải thích chi tiết",
                        order: i + 1
                    });
                });
                await Promise.all(savePromises);

                await setDoc(doc(db, "exams", examId), {
                    id: examId,
                    technique: "AI Tự Động",
                    title: `Đề AI tạo lúc ${new Date().toLocaleTimeString('vi-VN')}`,
                    level: difficulty === 'easy' ? 'Dễ' : (difficulty === 'hard' ? 'Khó' : 'Trung bình'),
                    timeLimit: parseInt(questionCount), 
                    createdAt: Date.now(),
                    isVip: false,
                    attemptCount: 0,
                    creatorId: auth.currentUser.uid,
                    isPublic: false
                });

                await updateDoc(roomRef, { 
                    examId: examId, 
                    examName: `[AI Tự Động] Đề tạo lúc ${new Date().toLocaleTimeString('vi-VN')}`, 
                    status: 'waiting' 
                });
                
                isExamsLoaded = false;
                await loadExamsToDropdown();
                selectExamInLobby.value = examId;

                alert("Tạo đề AI thành công và đã tự động gán vào phòng!");
                closeAiModal();

            } catch (error) {
                console.error("Lỗi tạo đề thi AI:", error);
                alert("Đã xảy ra lỗi: " + error.message);
                resetAiForm(); 
            }
        });

        btnLockRoom.addEventListener('click', async () => {
            const currentLockedState = btnLockRoom.getAttribute('data-locked') === 'true';
            try {
                await updateDoc(roomRef, { isLocked: !currentLockedState });
            } catch (err) {
                console.error("Lỗi khi thay đổi trạng thái khóa phòng:", err);
            }
        });

        btnOpenInviteModal.addEventListener('click', () => { inviteFriendModal.classList.add('active'); inviteEmailInput.focus(); });
        closeInviteModalBtn.addEventListener('click', () => { inviteFriendModal.classList.remove('active'); inviteEmailInput.value = ""; });

        btnSendInvite.addEventListener('click', async () => {
            const toEmail = inviteEmailInput.value.trim();
            if (!toEmail) return alert("Nhập Email hợp lệ!");
            try {
                btnSendInvite.disabled = true;
                const notiData = {
                    toEmail: toEmail, fromEmail: currentUser.email, type: 'room_invite',
                    message: `<b>${currentUser.displayName || currentUser.email}</b> đã mời bạn vào phòng thi. Mã phòng: <b style="color:#0d6efd">${
