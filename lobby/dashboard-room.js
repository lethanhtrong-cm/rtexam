import { auth, db } from "./dashboard-core.js";
import { collection, addDoc, setDoc, doc, getDocs, query, serverTimestamp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// DOM Elements - Modal Tạo Phòng
const btnOpenCreateRoom = document.getElementById('btnOpenCreateRoom');
const modalCreateRoom = document.getElementById('createRoomModal');
const btnCloseCreateRoom = document.getElementById('closeCreateRoomBtn');
const selectExamForRoom = document.getElementById('selectExamForRoom');
const btnSubmitCreateRoom = document.getElementById('btnSubmitCreateRoom');

const roomCreatedArea = document.getElementById('roomCreatedArea');
const generatedRoomCode = document.getElementById('generatedRoomCode');
const btnOpenInviteModal = document.getElementById('btnOpenInviteModal');

// Thêm biến để chứa nút "Vào phòng chờ" (sẽ tự động tạo nếu HTML chưa có)
let btnEnterLobby = document.getElementById('btnEnterLobby');

// DOM Elements - Modal Mời Bạn Bè
const modalInvite = document.getElementById('inviteFriendModal');
const btnCloseInviteModal = document.getElementById('closeInviteModalBtn');
const inviteEmailInput = document.getElementById('inviteEmailInput');
const btnSendInvite = document.getElementById('btnSendInvite');

// Biến lưu mã phòng hiện tại đang thao tác
let currentActiveRoomCode = "";

// 1. Logic Mở/Đóng Modal
btnOpenCreateRoom.addEventListener('click', async () => {
    modalCreateRoom.classList.add('active');
    // Load danh sách đề thi vào Select
    await loadExamsToSelect();
    
    // Reset UI Modal
    roomCreatedArea.style.display = 'none';
    btnOpenInviteModal.style.display = 'none';
    btnSubmitCreateRoom.style.display = 'block';
    if (btnEnterLobby) btnEnterLobby.style.display = 'none';
});

btnCloseCreateRoom.addEventListener('click', () => modalCreateRoom.classList.remove('active'));
btnOpenInviteModal.addEventListener('click', () => {
    modalCreateRoom.classList.remove('active');
    modalInvite.classList.add('active');
});
btnCloseInviteModal.addEventListener('click', () => modalInvite.classList.remove('active'));

// 2. Load danh sách đề từ Database
async function loadExamsToSelect() {
    try {
        const examsRef = collection(db, "exams");
        const snapshot = await getDocs(query(examsRef));
        
        selectExamForRoom.innerHTML = '<option value="">-- Chọn bộ đề để thi --</option>';
        snapshot.forEach(doc => {
            const data = doc.data();
            selectExamForRoom.innerHTML += `<option value="${doc.id}">[${data.technique || 'General'}] ${data.title}</option>`;
        });
    } catch (error) {
        console.error("Lỗi lấy danh sách đề thi:", error);
        selectExamForRoom.innerHTML = '<option value="">Lỗi kết nối dữ liệu</option>';
    }
}

// 3. Xử lý logic Tạo phòng thi
btnSubmitCreateRoom.addEventListener('click', async () => {
    const selectedExamId = selectExamForRoom.value;
    const user = auth.currentUser;

    if (!selectedExamId) {
        alert("Vui lòng chọn một bộ đề!");
        return;
    }

    if (!user || !user.email) {
        alert("Tính năng yêu cầu đăng nhập bắt buộc. Không áp dụng cho tài khoản Khách (Guest).");
        return;
    }

    try {
        btnSubmitCreateRoom.disabled = true;
        btnSubmitCreateRoom.textContent = "Đang tạo...";

        // Sinh mã ngẫu nhiên dạng ROOM-XXXXXX
        const randomStr = Math.random().toString(36).substring(2, 8).toUpperCase();
        const roomCode = `ROOM-${randomStr}`;

        // Lưu vào Firestore collection `rooms`. Dùng setDoc để document ID chính là mã phòng
        const roomData = {
            roomId: roomCode,
            examId: selectedExamId,
            hostEmail: user.email,
            status: 'waiting', // waiting, active, closed
            createdAt: serverTimestamp()
        };

        await setDoc(doc(db, "rooms", roomCode), roomData);

        // Hiển thị UI thành công
        currentActiveRoomCode = roomCode;
        generatedRoomCode.textContent = roomCode;
        
        btnSubmitCreateRoom.style.display = 'none';
        roomCreatedArea.style.display = 'block';
        btnOpenInviteModal.style.display = 'inline-block';

        // Tạo/Hiển thị nút "Vào phòng chờ ngay"
        if (!btnEnterLobby) {
            btnEnterLobby = document.createElement('button');
            btnEnterLobby.id = 'btnEnterLobby';
            btnEnterLobby.textContent = '🚀 Vào phòng chờ ngay';
            // Style cơ bản để nổi bật
            btnEnterLobby.style.padding = '10px 20px';
            btnEnterLobby.style.marginLeft = '10px';
            btnEnterLobby.style.backgroundColor = '#28a745';
            btnEnterLobby.style.color = '#fff';
            btnEnterLobby.style.border = 'none';
            btnEnterLobby.style.borderRadius = '5px';
            btnEnterLobby.style.cursor = 'pointer';
            btnEnterLobby.style.fontWeight = 'bold';
            roomCreatedArea.appendChild(btnEnterLobby);
        }
        btnEnterLobby.style.display = 'inline-block';
        
        // Sự kiện chuyển hướng cho Chủ phòng
        btnEnterLobby.onclick = () => {
            window.location.href = `lobby.html?roomId=${currentActiveRoomCode}`;
        };

    } catch (error) {
        console.error("Lỗi khi tạo phòng thi:", error);
        alert("Đã xảy ra lỗi. Vui lòng thử lại.");
    } finally {
        btnSubmitCreateRoom.disabled = false;
        btnSubmitCreateRoom.textContent = "Tạo phòng & Lấy mã";
    }
});

// 4. Xử lý logic Mời bạn bè (Gửi Noti)
btnSendInvite.addEventListener('click', async () => {
    const toEmail = inviteEmailInput.value.trim();
    const user = auth.currentUser;

    if (!toEmail) {
        alert("Vui lòng nhập Email hợp lệ.");
        return;
    }

    try {
        btnSendInvite.disabled = true;
        btnSendInvite.textContent = "Đang gửi...";

        const notiData = {
            toEmail: toEmail,
            fromEmail: user.email,
            type: 'room_invite',
            message: `<b>${user.displayName || user.email}</b> đã mời bạn vào phòng thi cá nhân. Mã phòng: <b style="color:var(--primary-blue)">${currentActiveRoomCode}</b>`,
            roomId: currentActiveRoomCode, // Sửa thành roomId để khớp với logic check bên file notification
            isRead: false,
            createdAt: serverTimestamp()
        };

        await addDoc(collection(db, "notifications"), notiData);
        
        alert("Đã gửi lời mời thành công!");
        inviteEmailInput.value = "";
        modalInvite.classList.remove('active');

    } catch (error) {
        console.error("Lỗi khi gửi lời mời:", error);
        alert("Lỗi khi gửi lời mời.");
    } finally {
        btnSendInvite.disabled = false;
        btnSendInvite.textContent = "Gửi lời mời ngay";
    }
});
