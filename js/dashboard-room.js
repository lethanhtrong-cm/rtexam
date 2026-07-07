import { auth, db } from "./dashboard-core.js";
import { collection, setDoc, doc, serverTimestamp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// DOM Elements
const btnOpenCreateRoom = document.getElementById('btnOpenCreateRoom');
const modalCreateRoom = document.getElementById('createRoomModal');
const btnCloseCreateRoom = document.getElementById('closeCreateRoomBtn');
const btnSubmitCreateRoom = document.getElementById('btnSubmitCreateRoom'); // Nút "Tạo phòng mới"

// 1. Logic Mở/Đóng Modal (Giữ lại nếu bạn vẫn muốn giữ cấu trúc giao diện cũ)
if (btnOpenCreateRoom) {
    btnOpenCreateRoom.addEventListener('click', () => {
        if (modalCreateRoom) modalCreateRoom.classList.add('active');
    });
}
if (btnCloseCreateRoom) {
    btnCloseCreateRoom.addEventListener('click', () => {
        if (modalCreateRoom) modalCreateRoom.classList.remove('active');
    });
}

// 2. Thao tác Tạo phòng siêu tốc & Tự động điều hướng vào Lobby
const handleCreateRoomInstant = async () => {
    const user = auth.currentUser;

    if (!user || !user.email) {
        alert("Tính năng yêu cầu đăng nhập bắt buộc. Không áp dụng cho tài khoản Khách (Guest).");
        return;
    }

    try {
        if (btnSubmitCreateRoom) {
            btnSubmitCreateRoom.disabled = true;
            btnSubmitCreateRoom.textContent = "Đang khởi tạo phòng...";
        }

        // Sinh mã ngẫu nhiên dạng ROOM-XXXXXX
        const randomStr = Math.random().toString(36).substring(2, 8).toUpperCase();
        const roomCode = `ROOM-${randomStr}`;

        // Cấu trúc dữ liệu tối giản: examId ban đầu đặt bằng null
        const roomData = {
            roomId: roomCode,
            examId: null,
            examName: null,
            hostEmail: user.email,
            status: 'waiting',
            createdAt: serverTimestamp()
        };

        // Lưu document với ID chính là mã phòng
        await setDoc(doc(db, "rooms", roomCode), roomData);

        // Lập tức nhảy thẳng sang trang lobby kèm tham số mã phòng
        window.location.href = `lobby.html?roomId=${roomCode}`;

    } catch (error) {
        console.error("Lỗi khi tạo phòng thi nhanh:", error);
        alert("Đã xảy ra lỗi khi tạo phòng thi. Vui lòng thử lại.");
        if (btnSubmitCreateRoom) {
            btnSubmitCreateRoom.disabled = false;
            btnSubmitCreateRoom.textContent = "Tạo phòng mới";
        }
    }
};

// Gắn sự kiện cho nút Submit tạo phòng
if (btnSubmitCreateRoom) {
    btnSubmitCreateRoom.addEventListener('click', handleCreateRoomInstant);
}
