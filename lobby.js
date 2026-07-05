import { auth, db } from "./dashboard-core.js";
import { doc, getDoc, setDoc, deleteDoc, updateDoc, onSnapshot, collection, getDocs, query, serverTimestamp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

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
        // playing hoặc closed sẽ hiện Bảng xếp hạng
        state1Waiting.style.display = 'none';
        state2Leaderboard.style.display = 'block';
    }
}

async function initLobby() {
    const roomRef = doc(db, 'rooms', roomId);
    const participantRef = doc(db, `rooms/${roomId}/participants/${currentUser.uid}`);

    try {
        // 1. KIỂM TRA TRẠNG THÁI CÁ NHÂN (TRÁNH GHI ĐÈ KHI NỘP BÀI QUAY LẠI)
        const pSnap = await getDoc(participantRef);
        if (!pSnap.exists()) {
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
        } else {
            myParticipantStatus = pSnap.data().status || 'waiting';
        }

        // Xóa thông tin khỏi phòng chỉ khi phòng đang 'waiting'. Nếu đang 'playing', việc chuyển hướng đi thi sẽ bị tính là unload trang, ta KHÔNG ĐƯỢC xóa data.
        window.addEventListener('beforeunload', () => {
            if (currentRoomStatus === 'waiting') {
                deleteDoc(participantRef);
            }
        });

        // 2. LẮNG NGHE REAL-TIME DOCUMENT CỦA PHÒNG (rooms/{roomId})
        onSnapshot(roomRef, async (docSnap) => {
            if (!docSnap.exists()) {
                alert("Phòng thi này không tồn tại hoặc đã bị đóng!");
                window.location.href = "dashboard.html";
                return;
            }

            const roomData = docSnap.data();
            currentRoomStatus = roomData.status;

            // Xử lý UI tên đề thi (Trạng thái 1)
            if (roomData.examId) {
                displayExamName.innerHTML = `<i class="fa-solid fa-book"></i> ${roomData.examName || "Đề thi đã chọn"}`;
            } else {
                displayExamName.innerHTML = `<i class="fa-solid fa-circle-dot fa-pulse" style="color: #ffdf00;"></i> Chủ phòng đang chọn đề...`;
            }

            // PHÂN QUYỀN UI CHO HOST
            const isHost = (roomData.hostEmail === currentUser.email);
            if (isHost) {
                hostPanel.style.display = 'block';
                btnStart.style.display = 'block';
                waitingText.style.display = 'none';
                if (currentRoomStatus === 'playing') {
                    btnEndRoom.style.display = 'block';
                } else {
                    btnEndRoom.style.display = 'none';
                }

                await loadExamsToDropdown();
                if (roomData.examId && selectExamInLobby.value !== roomData.examId) {
                    selectExamInLobby.value = roomData.examId;
                } else if (!roomData.examId) {
                    selectExamInLobby.value = "";
                }

                if (roomData.examId) {
                    btnStart.removeAttribute('disabled');
                } else {
                    btnStart.setAttribute('disabled', 'true');
                }
            } else {
                hostPanel.style.display = 'none';
                btnStart.style.display = 'none';
                waitingText.style.display = 'block';
                btnEndRoom.style.display = 'none';
                waitingText.textContent = roomData.examId ? "Đang chờ chủ phòng bấm nút bắt đầu thi..." : "Đang chờ chủ phòng chọn đề thi...";
            }

            // ---------- XỬ LÝ ĐIỀU HƯỚNG VÀ BẪY VÒNG LẶP ----------
            if (currentRoomStatus === 'waiting') {
                switchUIState('waiting');
            } 
            else if (currentRoomStatus === 'playing') {
                // Nếu mình chưa thi xong -> Bắt đi thi
                if (myParticipantStatus !== 'finished') {
                    // Update trạng thái mình thành playing trước khi đi thi để người khác thấy
                    if (myParticipantStatus === 'waiting') {
                        await updateDoc(participantRef, { status: 'playing' });
                    }
                    window.location.href = `quiz.html?examId=${roomData.examId}&roomId=${roomId}`;
                } else {
                    // Đã thi xong -> Hiện Bảng xếp hạng trực tiếp (Lobby Trạng thái 2)
                    switchUIState('playing');
                }
            } 
            else if (currentRoomStatus === 'closed') {
                // Đóng phòng -> Hiện bảng chung cuộc
                switchUIState('closed');
                lbMainTitle.innerHTML = `<i class="fa-solid fa-flag-checkered"></i> KẾT QUẢ CHUNG CUỘC`;
                lbSubTitle.textContent = "Phòng thi đã chính thức kết thúc";
                if (isHost) btnEndRoom.style.display = 'none';
            }
        });

        // 3. LẮNG NGHE REAL-TIME SUBCOLLECTION PARTICIPANTS (ĐỔ DATA UI)
        const participantsColl = collection(db, `rooms/${roomId}/participants`);
        onSnapshot(participantsColl, (snapshot) => {
            // Cập nhật biến trạng thái cá nhân local (Để bẫy vòng lặp hoạt động chính xác)
            snapshot.forEach(pDoc => {
                if(pDoc.id === currentUser.uid) {
                    myParticipantStatus = pDoc.data().status || 'waiting';
                }
            });

            // 3.1. Đổ Data vào Trạng thái 1 (Grid Avatar)
            participantsGrid.innerHTML = '';
            playerCount.textContent = snapshot.size;

            // 3.2. Đổ Data vào Trạng thái 2 (Leaderboard)
            leaderboardBody.innerHTML = '';
            
            // Sắp xếp mảng để render Bảng xếp hạng: Điểm giảm dần, Thời gian tăng dần
            const pArray = [];
            snapshot.forEach(doc => pArray.push(doc.data()));
            pArray.sort((a, b) => {
                if ((b.score || 0) !== (a.score || 0)) {
                    return (b.score || 0) - (a.score || 0); // Điểm cao xếp trên
                }
                // Nếu bằng điểm, so sánh thời gian (Ai nhanh hơn lên trên). Lưu ý chuỗi mm:ss cần convert để so sánh chuẩn
                return (a.timeTaken || '99:99').localeCompare(b.timeTaken || '99:99'); 
            });

            pArray.forEach(pData => {
                // Render Avatar Grid (State 1)
                const card = document.createElement('div');
                card.className = 'participant-card';
                card.innerHTML = `<img src="${pData.photoURL}" alt="avatar" class="participant-avatar"><div class="participant-name">${pData.displayName}</div>`;
                participantsGrid.appendChild(card);

                // Render Table Row (State 2)
                let badgeHTML = '';
                let displayScore = '-';
                let displayTime = '-';

                if (pData.status === 'playing') {
                    badgeHTML = '<span class="badge badge-playing"><i class="fa-solid fa-pen-nib"></i> Đang thi</span>';
                } else if (pData.status === 'finished') {
                    badgeHTML = '<span class="badge badge-finished"><i class="fa-solid fa-check-double"></i> Đã nộp bài</span>';
                    displayScore = `${pData.score || 0} đ`;
                    displayTime = pData.timeTaken || '00:00';
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

        // 4. LOGIC XỬ LÝ SỰ KIỆN TRÊN BẢNG ĐIỀU KHIỂN CỦA CHỦ PHÒNG
        selectExamInLobby.addEventListener('change', async () => {
            const selectedExamId = selectExamInLobby.value;
            const selectedExamName = selectedExamId ? selectExamInLobby.options[selectExamInLobby.selectedIndex].text : null;
            try {
                await updateDoc(roomRef, { examId: selectedExamId || null, examName: selectedExamName });
            } catch (err) { console.error("Lỗi cập nhật đề:", err); }
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

        // Nút Kết Thúc Phòng Thi
        btnEndRoom.addEventListener('click', async () => {
            if (confirm("Bạn có chắc chắn muốn đóng phòng? Những người chưa nộp bài sẽ bị tự động thu bài.")) {
                try {
                    btnEndRoom.disabled = true;
                    btnEndRoom.innerHTML = 'Đang xử lý...';
                    await updateDoc(roomRef, { status: 'closed' });
                } catch (error) {
                    console.error("Lỗi kết thúc phòng:", error);
                    btnEndRoom.disabled = false;
                }
            }
        });

        // Modals & Links
        btnOpenInviteModal.addEventListener('click', () => { inviteFriendModal.classList.add('active'); inviteEmailInput.focus(); });
        closeInviteModalBtn.addEventListener('click', () => { inviteFriendModal.classList.remove('active'); inviteEmailInput.value = ""; });

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
                alert(`Đã gửi thành công!`);
                inviteFriendModal.classList.remove('active');
            } catch (error) { alert("Lỗi khi gửi mời."); } 
            finally { btnSendInvite.disabled = false; }
        });

        btnCopyLink.addEventListener('click', async () => {
            try {
                await navigator.clipboard.writeText(window.location.href);
                const old = btnCopyLink.innerHTML;
                btnCopyLink.innerHTML = '<i class="fa-solid fa-check"></i> Đã sao chép!';
                setTimeout(() => btnCopyLink.innerHTML = old, 2000);
            } catch (err) { alert("Hãy tự copy URL trình duyệt."); }
        });

    } catch (error) {
        console.error("Lỗi Lobby:", error);
        alert("Có lỗi xảy ra khi đồng bộ.");
        window.location.href = "dashboard.html";
    }
}
