import { auth, db } from "./dashboard-core.js";
import { doc, getDoc, setDoc, deleteDoc, updateDoc, writeBatch, onSnapshot, collection, getDocs, query, serverTimestamp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// DOM Elements: Header & State Containers
const headerUserName = document.getElementById('headerUserName');
const state1Waiting = document.getElementById('state1Waiting');
const state2Leaderboard = document.getElementById('state2Leaderboard');

// DOM Elements: State 1 (Phòng Chờ)
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

// DOM Elements: State 2 (Leaderboard)
const leaderboardBody = document.getElementById('leaderboardBody');
const btnEndRoom = document.getElementById('btnEndRoom');
const btnBackToLobby = document.getElementById('btnBackToLobby');
const lbMainTitle = document.getElementById('lbMainTitle');
const lbSubTitle = document.getElementById('lbSubTitle');

// DOM Elements: Modal Mời Bạn
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
let myParticipantStatus = 'waiting'; // waiting, playing, finished

// Cờ kiểm soát luồng UI: Tránh văng lại Leaderboard khi chủ động về phòng chờ
let forceLobbyView = false; 

if (!roomId) {
    alert("Không tìm thấy mã phòng hợp lệ!");
    window.location.href = "dashboard.html";
} else {
    displayRoomId.textContent = roomId;
}

// Chờ trạng thái Đăng nhập sẵn sàng
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

// Sự kiện chủ động quay về phòng chờ
btnBackToLobby.addEventListener('click', () => {
    forceLobbyView = true;
    switchUIState('waiting');
});

// Load bộ đề cho Host
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

// Chuyển đổi giao diện (UI Toggling)
function switchUIState(state) {
    if (state === 'waiting') {
        state1Waiting.style.display = 'block';
        state2Leaderboard.style.display = 'none';
    } else {
        state1Waiting.style.display = 'none';
        state2Leaderboard.style.display = 'block';
    }
}

// Hàm phân tích thời gian an toàn tránh crash
function parseTimeSafely(timeVal) {
    if (typeof timeVal === 'number') return timeVal;
    if (typeof timeVal === 'string') {
        const parts = timeVal.split(':');
        if (parts.length === 2) {
            return parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
        }
    }
    return 999999;
}

async function initLobby() {
    const roomRef = doc(db, 'rooms', roomId);
    const participantRef = doc(db, `rooms/${roomId}/participants/${currentUser.uid}`);
    const participantsColl = collection(db, `rooms/${roomId}/participants`);

    try {
        // 1. KIỂM TRA SỨC CHỨA & KHỞI TẠO TRẠNG THÁI CÁ NHÂN
        const pSnap = await getDoc(participantRef);
        
        if (pSnap.exists()) {
            // ĐÃ TỒN TẠI (Người cũ tải lại trang/rớt mạng): Cho phép tiếp tục và cập nhật lại Avatar/Tên
            await setDoc(participantRef, {
                displayName: currentUser.displayName,
                photoURL: currentUser.photoURL
            }, { merge: true });
            myParticipantStatus = pSnap.data().status || 'waiting';
        } else {
            // CHƯA TỒN TẠI (Người mới): Kiểm tra sức chứa tối đa 50 người
            const currentParticipants = await getDocs(participantsColl);
            if (currentParticipants.size >= 50) {
                alert("Rất tiếc! Phòng thi này đã đạt giới hạn tối đa 50 người tham gia.");
                window.location.href = 'dashboard.html';
                return; // Dừng lập tức luồng code bên dưới, chặn Listeners
            }

            // Phòng còn chỗ: Ghi danh người mới
            await setDoc(participantRef, {
                uid: currentUser.uid,
                displayName: currentUser.displayName,
                photoURL: currentUser.photoURL,
                joinedAt: serverTimestamp(),
                status: 'waiting',
                score: 0,
                timeTaken: '00:00'
            });
            myParticipantStatus = 'waiting';
        }

        // Dọn dẹp data nếu đóng tab khi phòng đang chờ
        window.addEventListener('beforeunload', () => {
            if (currentRoomStatus === 'waiting') {
                deleteDoc(participantRef);
            }
        });

        // 2. LẮNG NGHE REAL-TIME DANH SÁCH PARTICIPANTS
        onSnapshot(participantsColl, (snapshot) => {
            snapshot.forEach(pDoc => {
                if(pDoc.id === currentUser.uid) {
                    myParticipantStatus = pDoc.data().status || 'waiting';
                }
            });

            participantsGrid.innerHTML = '';
            leaderboardBody.innerHTML = '';
            playerCount.textContent = snapshot.size;
            
            const pArray = [];
            snapshot.forEach(doc => pArray.push(doc.data()));
            
            // SẮP XẾP AN TOÀN
            pArray.sort((a, b) => {
                const isAFinished = (a.status === 'finished') ? 1 : 0;
                const isBFinished = (b.status === 'finished') ? 1 : 0;
                if (isAFinished !== isBFinished) {
                    return isBFinished - isAFinished; 
                }

                const scoreA = (typeof a.score === 'number') ? a.score : 0;
                const scoreB = (typeof b.score === 'number') ? b.score : 0;
                if (scoreB !== scoreA) {
                    return scoreB - scoreA; 
                }

                const timeSecA = parseTimeSafely(a.timeTaken);
                const timeSecB = parseTimeSafely(b.timeTaken);
                return timeSecA - timeSecB;
            });

            pArray.forEach(pData => {
                // RENDER STATE 1 (Phòng chờ) - Kèm Badge mini
                let miniBadge = '';
                if (pData.status === 'playing') miniBadge = '<span class="grid-badge grid-badge-playing">Đang thi</span>';
                else if (pData.status === 'finished') miniBadge = '<span class="grid-badge grid-badge-finished">Đã xong</span>';
                else miniBadge = '<span class="grid-badge grid-badge-waiting">Sẵn sàng</span>';

                const card = document.createElement('div');
                card.className = 'participant-card';
                card.innerHTML = `<img src="${pData.photoURL}" alt="avatar" class="participant-avatar"><div class="participant-name">${pData.displayName}</div>${miniBadge}`;
                participantsGrid.appendChild(card);

                // RENDER STATE 2 (Bảng xếp hạng)
                let badgeHTML = '';
                let displayScore = '-';
                let displayTime = '-';

                if (pData.status === 'playing') {
                    badgeHTML = '<span class="badge badge-playing"><i class="fa-solid fa-pen-nib"></i> Đang thi</span>';
                } else if (pData.status === 'finished') {
                    badgeHTML = '<span class="badge badge-finished"><i class="fa-solid fa-check-double"></i> Đã nộp bài</span>';
                    displayScore = `${pData.score || 0} đ`;
                    displayTime = typeof pData.timeTaken === 'string' ? pData.timeTaken : '00:00';
                } else {
                    badgeHTML = '<span class="badge badge-waiting"><i class="fa-solid fa-hourglass-half"></i> Đang chờ</span>';
                }

                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td class="td-user">
                        <img src="${pData.photoURL}" alt="avatar">
                        <span>${pData.displayName}</span>
                    </td>
                    <td>${badgeHTML}</td>
                    <td style="color: #00e5ff; font-weight: 900;">${displayScore}</td>
                    <td>${displayTime}</td>
                `;
                leaderboardBody.appendChild(tr);
            });
        });

        // 3. LẮNG NGHE REAL-TIME DOCUMENT CỦA PHÒNG
        onSnapshot(roomRef, async (docSnap) => {
            if (!docSnap.exists()) {
                alert("Phòng thi này không tồn tại hoặc đã bị đóng!");
                window.location.href = "dashboard.html";
                return;
            }

            const roomData = docSnap.data();
            currentRoomStatus = roomData.status;

            if (roomData.examId) {
                displayExamName.innerHTML = `<i class="fa-solid fa-book"></i> ${roomData.examName || "Đề thi đã chọn"}`;
            } else {
                displayExamName.innerHTML = `<i class="fa-solid fa-circle-dot fa-pulse" style="color: #ffdf00;"></i> Chủ phòng đang chọn đề...`;
            }

            const isHost = (roomData.hostEmail === currentUser.email);
            
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
                waitingText.textContent = roomData.examId ? "Đang chờ chủ phòng bấm nút bắt đầu thi..." : "Đang chờ chủ phòng chọn đề thi...";
            }

            // ĐIỀU HƯỚNG TRẠNG THÁI (KÈM CỜ FORCE LOBBY)
            if (currentRoomStatus === 'waiting') {
                // Khi phòng chuyển về waiting (Reset room), hủy forceLobbyView và show waiting
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
                    // Nếu đã thi xong, chỉ show Leaderboard nếu user không bấm nút "Quay lại phòng chờ"
                    if (!forceLobbyView) {
                        switchUIState('playing');
                    }
                }
            } 
            else if (currentRoomStatus === 'closed') {
                forceLobbyView = false;
                switchUIState('closed');
                lbMainTitle.innerHTML = `<i class="fa-solid fa-flag-checkered"></i> KẾT QUẢ CHUNG CUỘC`;
                lbSubTitle.textContent = "Phòng thi đã chính thức kết thúc";
                if (isHost) btnEndRoom.style.display = 'none';
            }
        });

        // 4. LOGIC BẢNG ĐIỀU KHIỂN CHỦ PHÒNG VÀ RESET DATA HÀNG LOẠT
        selectExamInLobby.addEventListener('change', async () => {
            const selectedExamId = selectExamInLobby.value;
            const selectedExamName = selectedExamId ? selectExamInLobby.options[selectExamInLobby.selectedIndex].text : null;
            try {
                // Đổi đề thi và ép trạng thái phòng về waiting
                await updateDoc(roomRef, { 
                    examId: selectedExamId || null, 
                    examName: selectedExamName,
                    status: 'waiting' 
                });

                // Xóa điểm cũ, ép toàn bộ người chơi về 'waiting'
                const batch = writeBatch(db);
                const pSnapshot = await getDocs(participantsColl);
                pSnapshot.forEach((docItem) => {
                    batch.update(docItem.ref, {
                        status: 'waiting',
                        score: 0,
                        timeTaken: '00:00'
                    });
                });
                await batch.commit();

                // Reset cờ UI để Host thấy phòng chờ chuẩn
                forceLobbyView = false;
            } catch (err) { console.error("Lỗi cập nhật đề & reset phòng:", err); }
        });

        btnStart.addEventListener('click', async () => {
            btnStart.setAttribute('disabled', 'true');
            btnStart.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> ĐANG KHỞI ĐỘNG...';
            try {
                await updateDoc(roomRef, { status: 'playing' });
            } catch (error) {
                console.error("Lỗi:", error);
                btnStart.removeAttribute('disabled');
                btnStart.innerHTML = '<i class="fa-solid fa-rocket"></i> BẮT ĐẦU THI';
            }
        });

        btnEndRoom.addEventListener('click', async () => {
            if (confirm("Bạn có chắc chắn muốn đóng phòng? Những người chưa nộp bài sẽ bị tự động thu bài.")) {
                try {
                    btnEndRoom.disabled = true;
                    btnEndRoom.innerHTML = 'Đang xử lý...';
                    await updateDoc(roomRef, { status: 'closed' });
                } catch (error) {
                    console.error("Lỗi kết thúc phòng:", error);
                    btnEndRoom.disabled = false;
                    btnEndRoom.innerHTML = '<i class="fa-solid fa-flag-checkered"></i> KẾT THÚC PHÒNG THI';
                }
            }
        });

        // 5. XỬ LÝ MODAL & COPY LINK
        btnOpenInviteModal.addEventListener('click', () => { 
            inviteFriendModal.classList.add('active'); 
            inviteEmailInput.focus(); 
        });
        
        closeInviteModalBtn.addEventListener('click', () => { 
            inviteFriendModal.classList.remove('active'); 
            inviteEmailInput.value = ""; 
        });

        btnSendInvite.addEventListener('click', async () => {
            const toEmail = inviteEmailInput.value.trim();
            if (!toEmail) return alert("Nhập Email hợp lệ!");
            try {
                btnSendInvite.disabled = true;
                const notiData = {
                    toEmail: toEmail,
                    fromEmail: currentUser.email,
                    type: 'room_invite',
                    message: `<b>${currentUser.displayName || currentUser.email}</b> đã mời bạn vào phòng thi. Mã phòng: <b style="color:#00e5ff">${roomId}</b>`,
                    roomId: roomId,
                    isRead: false,
                    createdAt: serverTimestamp()
                };
                await setDoc(doc(collection(db, "notifications")), notiData);
                alert(`Đã gửi thành công lời mời tới ${toEmail}!`);
                inviteFriendModal.classList.remove('active');
            } catch (error) { 
                alert("Lỗi khi gửi mời, vui lòng thử lại sau."); 
            } finally { 
                btnSendInvite.disabled = false; 
            }
        });

        btnCopyLink.addEventListener('click', async () => {
            try {
                await navigator.clipboard.writeText(window.location.href);
                const old = btnCopyLink.innerHTML;
                btnCopyLink.innerHTML = '<i class="fa-solid fa-check"></i> Đã sao chép!';
                setTimeout(() => btnCopyLink.innerHTML = old, 2000);
            } catch (err) { 
                alert("Trình duyệt không hỗ trợ tự động sao chép. Hãy tự copy URL thanh địa chỉ nhé."); 
            }
        });

    } catch (error) {
        console.error("Lỗi Lobby:", error);
        alert("Có lỗi xảy ra khi đồng bộ phòng chờ.");
        window.location.href = "dashboard.html";
    }
}
