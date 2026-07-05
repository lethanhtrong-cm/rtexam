import { auth, db } from "./dashboard-core.js";
import { doc, getDoc, setDoc, deleteDoc, updateDoc, writeBatch, onSnapshot, collection, getDocs, query, serverTimestamp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// DOM Elements
const headerUserName = document.getElementById('headerUserName');
const state1Waiting = document.getElementById('state1Waiting');
const state2Leaderboard = document.getElementById('state2Leaderboard');

const displayRoomId = document.getElementById('displayRoomId');
const displayExamName = document.getElementById('displayExamName');
const participantsGrid = document.getElementById('participantsGrid');
const playerCount = document.getElementById('playerCount');
const btnStart = document.getElementById('btnStart');
const waitingText = document.getElementById('waitingText');
const hostPanel = document.getElementById('hostPanel');
const selectExamInLobby = document.getElementById('selectExamInLobby');
const btnOpenInviteModal = document.getElementById('btnOpenInviteModal');
const btnCopyLink = document.getElementById('btnCopyLink');

const leaderboardBody = document.getElementById('leaderboardBody');
const btnEndRoom = document.getElementById('btnEndRoom');
const btnBackToLobby = document.getElementById('btnBackToLobby');

const inviteFriendModal = document.getElementById('inviteFriendModal');
const closeInviteModalBtn = document.getElementById('closeInviteModalBtn');
const inviteEmailInput = document.getElementById('inviteEmailInput');
const btnSendInvite = document.getElementById('btnSendInvite');

// Biến toàn cục
const urlParams = new URLSearchParams(window.location.search);
const roomId = urlParams.get('roomId');
let currentUser = null;
let isExamsLoaded = false;
let currentRoomStatus = 'waiting';
let myParticipantStatus = 'waiting';
let forceLobbyView = false; 

// Biến phụ trợ render UI chung
let currentHostEmail = null;
let currentParticipantsArray = [];
let isKicked = false;

if (!roomId) {
    alert("Không tìm thấy mã phòng hợp lệ!");
    window.location.href = "dashboard.html";
} else {
    displayRoomId.textContent = roomId;
}

document.addEventListener('authReady', (e) => {
    const user = e.detail ? e.detail.user : auth.currentUser;
    if (user) {
        currentUser = {
            uid: user.uid,
            email: user.email,
            displayName: user.displayName || user.email.split('@')[0],
            photoURL: user.photoURL || `https://ui-avatars.com/api/?name=${user.displayName || user.email}&background=random&color=fff`
        };
        headerUserName.textContent = currentUser.displayName;
        initLobby();
    } else {
        window.location.href = "login.html";
    }
});

btnBackToLobby.addEventListener('click', () => {
    forceLobbyView = true;
    switchUIState('waiting');
});

async function loadExamsToDropdown() {
    if (isExamsLoaded) return;
    try {
        const examsRef = collection(db, "exams");
        const snapshot = await getDocs(query(examsRef));
        selectExamInLobby.innerHTML = '<option value="">-- Chọn bộ đề để thi --</option>';
        snapshot.forEach(docSnap => {
            const data = docSnap.data();
            const tech = data.technique || 'General';
            selectExamInLobby.innerHTML += `<option value="${docSnap.id}">[${tech}] ${data.title}</option>`;
        });
        isExamsLoaded = true;
    } catch (error) {
        console.error("Lỗi lấy danh sách đề:", error);
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

// HÀM RENDER CHUNG ĐỂ BẢO ĐẢM TÍNH ĐỒNG BỘ UI
function renderUI() {
    participantsGrid.innerHTML = '';
    leaderboardBody.innerHTML = '';
    playerCount.textContent = currentParticipantsArray.length;
    
    const isCurrentUserHost = (currentHostEmail === currentUser.email);

    currentParticipantsArray.forEach(pData => {
        // --- 1. RENDER STATE 1 (Phòng chờ) - UI Thẻ hiện đại ---
        let badgeBg, badgeColor, badgeText;
        if (pData.status === 'playing') {
            badgeBg = '#fef3c7'; badgeColor = '#d97706'; badgeText = 'Đang thi';
        } else if (pData.status === 'finished') {
            badgeBg = '#d1fae5'; badgeColor = '#059669'; badgeText = 'Đã xong';
        } else {
            badgeBg = '#e0f2fe'; badgeColor = '#0369a1'; badgeText = 'Sẵn sàng';
        }
        
        let miniBadge = `<span style="background: ${badgeBg}; color: ${badgeColor}; padding: 4px 8px; border-radius: 9999px; font-size: 0.7rem; font-weight: 700; text-transform: uppercase; margin-top: 8px; display: inline-block;">${badgeText}</span>`;

        // Nút Kick: Góc trên bên phải thẻ
        let kickBtnHTML = '';
        if (isCurrentUserHost && pData.uid !== currentUser.uid) {
            kickBtnHTML = `<button class="btn-kick" data-uid="${pData.uid}" title="Đuổi khỏi phòng" style="position: absolute; top: 6px; right: 6px; width: 24px; height: 24px; border-radius: 50%; background: #dc3545; color: white; border: none; font-size: 0.8rem; cursor: pointer; display: flex; align-items: center; justify-content: center; z-index: 10;"><i class="fa-solid fa-xmark"></i></button>`;
        }

        const card = document.createElement('div');
        // Thêm các inline styles để ép thiết kế mà không cần đổi CSS gốc
        card.className = 'participant-card';
        card.style.cssText = "background: #ffffff; border: 1px solid #e5e7eb; border-radius: 12px; box-shadow: 0 2px 4px rgba(0,0,0,0.05); text-align: center; padding: 16px 8px; position: relative; display: flex; flex-direction: column; align-items: center; transition: transform 0.2s ease, box-shadow 0.2s ease;";
        
        // Hiệu ứng Hover nổi lên
        card.onmouseover = () => { card.style.transform = 'translateY(-4px)'; card.style.boxShadow = '0 6px 12px rgba(0,0,0,0.1)'; };
        card.onmouseout = () => { card.style.transform = 'translateY(0)'; card.style.boxShadow = '0 2px 4px rgba(0,0,0,0.05)'; };

        card.innerHTML = `
            ${kickBtnHTML}
            <img src="${pData.photoURL}" alt="avatar" style="width: 55px; height: 55px; border-radius: 50%; border: 2px solid #3b82f6; padding: 2px; object-fit: cover; margin-bottom: 4px;">
            <div style="font-weight: 600; color: #1f2937; margin-top: 6px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; width: 100%; font-size: 0.9rem;" title="${pData.displayName}">${pData.displayName}</div>
            ${miniBadge}
        `;
        participantsGrid.appendChild(card);

        // --- 2. RENDER STATE 2 (Bảng xếp hạng) ---
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
            <td class="td-user"><img src="${pData.photoURL}" alt="avatar"><span>${pData.displayName}</span></td>
            <td>${badgeHTML}</td>
            <td style="color: #0d6efd; font-weight: 800;">${displayScore}</td>
            <td>${displayTime}</td>
        `;
        leaderboardBody.appendChild(tr);
    });

    // GẮN SỰ KIỆN CHO CÁC NÚT KICK VỪA TẠO
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
}


async function initLobby() {
    const roomRef = doc(db, 'rooms', roomId);
    const participantRef = doc(db, `rooms/${roomId}/participants/${currentUser.uid}`);
    const participantsColl = collection(db, `rooms/${roomId}/participants`);

    try {
        // KIỂM TRA SỨC CHỨA & KHỞI TẠO TRẠNG THÁI
        const pSnap = await getDoc(participantRef);
        if (pSnap.exists()) {
            await setDoc(participantRef, { displayName: currentUser.displayName, photoURL: currentUser.photoURL }, { merge: true });
            myParticipantStatus = pSnap.data().status || 'waiting';
        } else {
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

        // LẮNG NGHE PARTICIPANTS (VẼ DANH SÁCH & BẪY KICK)
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

            // BẪY KICK: Nếu không tìm thấy mình trong DB, phòng đang mở và chưa bị kick
            if (!amIInRoom && currentRoomStatus === 'waiting' && !isKicked) {
                isKicked = true;
                alert("Bạn đã bị chủ phòng mời ra ngoài.");
                window.location.href = 'dashboard.html';
                return;
            }

            // SẮP XẾP AN TOÀN
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

        // LẮNG NGHE ROOM (CÀI ĐẶT HOST & ĐIỀU HƯỚNG)
        onSnapshot(roomRef, async (docSnap) => {
            if (!docSnap.exists()) {
                alert("Phòng thi này không tồn tại hoặc đã bị đóng!");
                window.location.href = "dashboard.html";
                return;
            }

            const roomData = docSnap.data();
            currentRoomStatus = roomData.status;
            currentHostEmail = roomData.hostEmail; // Lưu toàn cục cho hàm renderUI

            if (roomData.examId) {
                displayExamName.innerHTML = `<i class="fa-solid fa-book-open"></i> ${roomData.examName || "Đề thi đã chọn"}`;
            } else {
                displayExamName.innerHTML = `<i class="fa-solid fa-circle-notch fa-spin"></i> Chủ phòng đang chọn đề...`;
            }

            const isHost = (currentHostEmail === currentUser.email);
            
            if (isHost) {
                hostPanel.style.display = 'block';
                btnStart.style.display = 'block';
                waitingText.style.display = 'none';
                
                if (currentRoomStatus === 'playing') btnEndRoom.style.display = 'block';
                else btnEndRoom.style.display = 'none';

                await loadExamsToDropdown();
                if (roomData.examId && selectExamInLobby.value !== roomData.examId) {
                    selectExamInLobby.value = roomData.examId;
                } else if (!roomData.examId) {
                    selectExamInLobby.value = "";
                }

                if (roomData.examId) btnStart.removeAttribute('disabled');
                else btnStart.setAttribute('disabled', 'true');
            } else {
                hostPanel.style.display = 'none';
                btnStart.style.display = 'none';
                waitingText.style.display = 'block';
                btnEndRoom.style.display = 'none'; 
                waitingText.textContent = roomData.examId ? "Đang chờ chủ phòng bắt đầu thi..." : "Đang chờ chủ phòng chọn đề thi...";
            }

            // Gọi lại render để nhỡ Host load chậm thì nút kick vẫn hiện sau đó
            renderUI();

            // ĐIỀU HƯỚNG TRẠNG THÁI
            if (currentRoomStatus === 'waiting') {
                forceLobbyView = false;
                switchUIState('waiting');
            } 
            else if (currentRoomStatus === 'playing') {
                if (myParticipantStatus !== 'finished') {
                    if (myParticipantStatus === 'waiting') {
                        await updateDoc(participantRef, { status: 'playing' });
                    }
                    window.location.href = `quiz.html?examId=${roomData.examId}&roomId=${roomId}`;
                } else {
                    if (!forceLobbyView) switchUIState('playing');
                }
            } 
            else if (currentRoomStatus === 'closed') {
                forceLobbyView = false;
                switchUIState('closed');
                if (isHost) btnEndRoom.style.display = 'none';
            }
        });

        // LOGIC CHỦ PHÒNG (ĐỔI ĐỀ, START, END)
        selectExamInLobby.addEventListener('change', async () => {
            const selectedExamId = selectExamInLobby.value;
            const selectedExamName = selectedExamId ? selectExamInLobby.options[selectExamInLobby.selectedIndex].text : null;
            try {
                await updateDoc(roomRef, { examId: selectedExamId || null, examName: selectedExamName, status: 'waiting' });
                
                const batch = writeBatch(db);
                const pSnapshot = await getDocs(participantsColl);
                pSnapshot.forEach((docItem) => {
                    batch.update(docItem.ref, { status: 'waiting', score: 0, timeTaken: '00:00' });
                });
                await batch.commit();
                forceLobbyView = false;
            } catch (err) { console.error("Lỗi reset phòng:", err); }
        });

        btnStart.addEventListener('click', async () => {
            btnStart.setAttribute('disabled', 'true');
            btnStart.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> ĐANG KHỞI ĐỘNG...';
            try {
                await updateDoc(roomRef, { status: 'playing' });
            } catch (error) {
                btnStart.removeAttribute('disabled');
                btnStart.innerHTML = '<i class="fa-solid fa-play"></i> BẮT ĐẦU THI';
            }
        });

        btnEndRoom.addEventListener('click', async () => {
            if (confirm("Bạn có chắc chắn muốn đóng phòng? Những người chưa nộp bài sẽ bị tự động thu bài.")) {
                try {
                    btnEndRoom.disabled = true;
                    btnEndRoom.innerHTML = 'Đang xử lý...';
                    await updateDoc(roomRef, { status: 'closed' });
                } catch (error) {
                    btnEndRoom.disabled = false;
                    btnEndRoom.innerHTML = '<i class="fa-solid fa-flag-checkered"></i> KẾT THÚC PHÒNG';
                }
            }
        });

        // MODAL & COPY LINK
        btnOpenInviteModal.addEventListener('click', () => { inviteFriendModal.classList.add('active'); inviteEmailInput.focus(); });
        closeInviteModalBtn.addEventListener('click', () => { inviteFriendModal.classList.remove('active'); inviteEmailInput.value = ""; });

        btnSendInvite.addEventListener('click', async () => {
            const toEmail = inviteEmailInput.value.trim();
            if (!toEmail) return alert("Nhập Email hợp lệ!");
            try {
                btnSendInvite.disabled = true;
                const notiData = {
                    toEmail: toEmail, fromEmail: currentUser.email, type: 'room_invite',
                    message: `<b>${currentUser.displayName || currentUser.email}</b> đã mời bạn vào phòng thi. Mã phòng: <b style="color:#0d6efd">${roomId}</b>`,
                    roomId: roomId, isRead: false, createdAt: serverTimestamp()
                };
                await setDoc(doc(collection(db, "notifications")), notiData);
                alert(`Đã gửi lời mời tới ${toEmail}!`);
                inviteFriendModal.classList.remove('active');
            } catch (error) { alert("Lỗi khi gửi mời."); } 
            finally { btnSendInvite.disabled = false; }
        });

        btnCopyLink.addEventListener('click', async () => {
            try {
                await navigator.clipboard.writeText(window.location.href);
                const old = btnCopyLink.innerHTML;
                btnCopyLink.innerHTML = '<i class="fa-solid fa-check"></i> Đã copy!';
                setTimeout(() => btnCopyLink.innerHTML = old, 2000);
            } catch (err) { alert("Hãy tự copy URL thanh địa chỉ nhé."); }
        });

    } catch (error) {
        console.error("Lỗi Lobby:", error);
        alert("Có lỗi xảy ra khi đồng bộ phòng chờ.");
        window.location.href = "dashboard.html";
    }
}
