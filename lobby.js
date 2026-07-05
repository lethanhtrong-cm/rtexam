import { auth, db } from "./dashboard-core.js";
import { doc, setDoc, deleteDoc, updateDoc, onSnapshot, collection, getDocs, query, serverTimestamp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// DOM Elements thông tin chung
const headerUserName = document.getElementById('headerUserName');
const displayRoomId = document.getElementById('displayRoomId');
const displayExamName = document.getElementById('displayExamName');
const participantsGrid = document.getElementById('participantsGrid');
const playerCount = document.getElementById('playerCount');
const btnStart = document.getElementById('btnStart');
const waitingText = document.getElementById('waitingText');

// Bảng điều khiển của Host
const hostPanel = document.getElementById('hostPanel');
const selectExamInLobby = document.getElementById('selectExamInLobby');
const btnOpenInviteModal = document.getElementById('btnOpenInviteModal');
const btnCopyLink = document.getElementById('btnCopyLink');

// Modal Mời Bạn Bè
const inviteFriendModal = document.getElementById('inviteFriendModal');
const closeInviteModalBtn = document.getElementById('closeInviteModalBtn');
const inviteEmailInput = document.getElementById('inviteEmailInput');
const btnSendInvite = document.getElementById('btnSendInvite');

// Trích xuất roomId từ URL tham số
const urlParams = new URLSearchParams(window.location.search);
const roomId = urlParams.get('roomId');

let currentUser = null;
let isExamsLoaded = false;

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

// Hàm tải danh sách Đề thi đổ vào Dropdown (Chỉ gọi nếu user là Host)
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
        console.error("Lỗi lấy danh sách đề thi tại Lobby:", error);
        selectExamInLobby.innerHTML = '<option value="">Lỗi kết nối dữ liệu bộ đề</option>';
    }
}

async function initLobby() {
    const roomRef = doc(db, 'rooms', roomId);
    const participantRef = doc(db, `rooms/${roomId}/participants/${currentUser.uid}`);

    try {
        // 1. Thêm thông tin bản thân vào Subcollection participants
        await setDoc(participantRef, {
            uid: currentUser.uid,
            displayName: currentUser.displayName,
            photoURL: currentUser.photoURL,
            joinedAt: new Date()
        });

        // Xóa thông tin khỏi phòng thi nếu vô tình đóng Tab hoặc Reload
        window.addEventListener('beforeunload', () => {
            deleteDoc(participantRef);
        });

        // 2. LẮNG NGHE REAL-TIME DOCUMENT CỦA PHÒNG (rooms/{roomId})
        onSnapshot(roomRef, async (docSnap) => {
            if (!docSnap.exists()) {
                alert("Phòng thi này không tồn tại hoặc đã bị hủy bởi chủ phòng!");
                window.location.href = "dashboard.html";
                return;
            }

            const roomData = docSnap.data();

            // Hiển thị Real-time Tên Đề thi đang chọn
            if (roomData.examId) {
                displayExamName.innerHTML = `<i class="fa-solid fa-book"></i> ${roomData.examName || "Đề thi đã chọn"}`;
            } else {
                displayExamName.innerHTML = `<i class="fa-solid fa-circle-dot fa-pulse" style="color: #ffdf00;"></i> Chủ phòng đang chọn đề...`;
            }

            // PHÂN QUYỀN UI GIỮA HOST VÀ GUEST
            if (roomData.hostEmail === currentUser.email) {
                // KỊCH BẢN PHÍA CHỦ PHÒNG
                hostPanel.style.display = 'block';
                btnStart.style.display = 'block';
                waitingText.style.display = 'none';

                // Tải danh sách bộ đề đề cấu hình công khai
                await loadExamsToDropdown();

                // Đồng bộ ngược giá trị dropdown nếu FireStore thay đổi
                if (roomData.examId && selectExamInLobby.value !== roomData.examId) {
                    selectExamInLobby.value = roomData.examId;
                } else if (!roomData.examId) {
                    selectExamInLobby.value = "";
                }

                // LUẬT TỐI THƯỢNG: Chỉ kích hoạt nút Bắt Đầu khi examId khác null
                if (roomData.examId) {
                    btnStart.removeAttribute('disabled');
                } else {
                    btnStart.setAttribute('disabled', 'true');
                }

            } else {
                // KỊCH BẢN PHÍA KHÁCH THAM GIA
                hostPanel.style.display = 'none';
                btnStart.style.display = 'none';
                waitingText.style.display = 'block';

                if (roomData.examId) {
                    waitingText.textContent = "Đang chờ chủ phòng bấm nút bắt đầu thi...";
                } else {
                    waitingText.textContent = "Đang chờ chủ phòng chọn đề thi...";
                }
            }

            // CHUYỂN HƯỚNG SANG TRANG QUIZ NẾU TRẠNG THÁI ĐỔI THÀNH PLAYING
            if (roomData.status === 'playing') {
                window.location.href = `quiz.html?examId=${roomData.examId}&roomId=${roomId}`;
            }
        });

        // 3. LẮNG NGHE REAL-TIME SUBCOLLECTION PARTICIPANTS VẼ LIST AVATAR
        const participantsColl = collection(db, `rooms/${roomId}/participants`);
        onSnapshot(participantsColl, (snapshot) => {
            participantsGrid.innerHTML = '';
            playerCount.textContent = snapshot.size;

            snapshot.forEach(pDoc => {
                const pData = pDoc.data();
                const card = document.createElement('div');
                card.className = 'participant-card';
                card.innerHTML = `
                    <img src="${pData.photoURL}" alt="avatar" class="participant-avatar">
                    <div class="participant-name">${pData.displayName}</div>
                `;
                participantsGrid.appendChild(card);
            });
        });

        // 4. LOGIC XỬ LÝ SỰ KIỆN TRÊN BẢNG ĐIỀU KHIỂN CỦA CHỦ PHÒNG
        // 4.1. Sự kiện Host thay đổi Đề thi trên Dropdown -> Sync lên Database
        selectExamInLobby.addEventListener('change', async () => {
            const selectedExamId = selectExamInLobby.value;
            let selectedExamName = "";
            
            if (selectedExamId) {
                selectedExamName = selectExamInLobby.options[selectExamInLobby.selectedIndex].text;
            }

            try {
                await updateDoc(roomRef, {
                    examId: selectedExamId || null,
                    examName: selectedExamId ? selectedExamName : null
                });
            } catch (err) {
                console.error("Lỗi cập nhật đề thi:", err);
            }
        });

        // 4.2. Sự kiện Chủ phòng bấm nút "BẮT ĐẦU THI"
        btnStart.addEventListener('click', async () => {
            btnStart.setAttribute('disabled', 'true');
            btnStart.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> ĐANG KHỞI ĐỘNG TRẬN ĐẤU...';
            try {
                await updateDoc(roomRef, { status: 'playing' });
            } catch (error) {
                console.error("Lỗi khởi động trận đấu:", error);
                btnStart.removeAttribute('disabled');
                btnStart.innerHTML = '<i class="fa-solid fa-rocket"></i> BẮT ĐẦU THI';
            }
        });

        // 4.3. Logic đóng/mở và xử lý gửi thông báo "Mời bạn bè"
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
            if (!toEmail) {
                alert("Vui lòng điền Email người nhận hợp lệ!");
                return;
            }

            try {
                btnSendInvite.disabled = true;
                btnSendInvite.textContent = "Đang gửi...";

                const notiData = {
                    toEmail: toEmail,
                    fromEmail: currentUser.email,
                    type: 'room_invite',
                    message: `<b>${currentUser.displayName || currentUser.email}</b> đã mời bạn vào phòng thi cá nhân. Mã phòng: <b style="color:#00e5ff">${roomId}</b>`,
                    roomId: roomId,
                    isRead: false,
                    createdAt: serverTimestamp()
                };

                // Tạo tự động một bản ghi thông báo mới trong Firestore
                await setDoc(doc(collection(db, "notifications")), notiData);
                
                alert(`Đã gửi lời mời thành công đến tài khoản: ${toEmail}`);
                inviteEmailInput.value = "";
                inviteFriendModal.classList.remove('active');
            } catch (error) {
                console.error("Lỗi khi gửi Notification mời:", error);
                alert("Không thể gửi lời mời vào lúc này.");
            } finally {
                btnSendInvite.disabled = false;
                btnSendInvite.textContent = "Gửi lời mời ngay";
            }
        });

        // 4.4. Logic nút "Sao chép Link" phòng chờ
        btnCopyLink.addEventListener('click', async () => {
            try {
                await navigator.clipboard.writeText(window.location.href);
                const oldHTML = btnCopyLink.innerHTML;
                btnCopyLink.innerHTML = '<i class="fa-solid fa-check"></i> Đã sao chép!';
                btnCopyLink.style.backgroundColor = '#2ecc71';
                setTimeout(() => {
                    btnCopyLink.innerHTML = oldHTML;
                    btnCopyLink.style.backgroundColor = '';
                }, 2000);
            } catch (err) {
                console.error("Lỗi sao chép link:", err);
                alert("Không hỗ trợ tự sao chép, bạn hãy tự copy thanh địa chỉ URL trình duyệt.");
            }
        });

    } catch (error) {
        console.error("Khởi động Phòng chờ thất bại:", error);
        alert("Có lỗi xảy ra khi đồng bộ phòng chờ.");
        window.location.href = "dashboard.html";
    }
}
