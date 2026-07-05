import { auth, db } from "./dashboard-core.js";
import { doc, setDoc, deleteDoc, updateDoc, onSnapshot, collection } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// Lấy DOM Elements
const headerUserName = document.getElementById('headerUserName');
const displayRoomId = document.getElementById('displayRoomId');
const displayExamName = document.getElementById('displayExamName');
const participantsGrid = document.getElementById('participantsGrid');
const playerCount = document.getElementById('playerCount');
const btnStart = document.getElementById('btnStart');
const waitingText = document.getElementById('waitingText');

// Trích xuất roomId từ URL
const urlParams = new URLSearchParams(window.location.search);
const roomId = urlParams.get('roomId');

let currentUser = null;
let currentExamId = null;

if (!roomId) {
    alert("Không tìm thấy mã phòng hợp lệ!");
    window.location.href = "dashboard.html";
} else {
    displayRoomId.textContent = roomId;
}

// Lắng nghe trạng thái đăng nhập
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
        window.location.href = "login.html"; // Chuyển về login nếu chưa đăng nhập
    }
});

async function initLobby() {
    const roomRef = doc(db, 'rooms', roomId);
    const participantRef = doc(db, `rooms/${roomId}/participants/${currentUser.uid}`);

    try {
        // 1. Thêm user vào subcollection participants
        await setDoc(participantRef, {
            uid: currentUser.uid,
            displayName: currentUser.displayName,
            photoURL: currentUser.photoURL,
            joinedAt: new Date()
        });

        // Xóa user khỏi phòng nếu đóng tab/trình duyệt
        window.addEventListener('beforeunload', () => {
            deleteDoc(participantRef);
        });

        // 2. Lắng nghe document của Phòng (rooms/{roomId})
        onSnapshot(roomRef, (docSnap) => {
            if (docSnap.exists()) {
                const roomData = docSnap.data();
                currentExamId = roomData.examId;
                displayExamName.innerHTML = `<i class="fa-solid fa-book"></i> ${roomData.examName || "Đề thi không xác định"}`;

                // Kiểm tra xem User hiện tại có phải Chủ phòng không
                if (roomData.hostEmail === currentUser.email) {
                    btnStart.style.display = 'block';
                    waitingText.style.display = 'none';
                } else {
                    btnStart.style.display = 'none';
                    waitingText.style.display = 'block';
                }

                // Nếu chủ phòng đã bấm bắt đầu thi -> Chuyển hướng
                if (roomData.status === 'playing') {
                    window.location.href = `quiz.html?examId=${currentExamId}&roomId=${roomId}`;
                }
            } else {
                alert("Phòng thi không tồn tại hoặc đã bị đóng!");
                window.location.href = "dashboard.html";
            }
        });

        // 3. Lắng nghe subcollection participants để vẽ Avatar lên Grid
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

        // 4. Bắt sự kiện Chủ phòng click "BẮT ĐẦU THI"
        btnStart.addEventListener('click', async () => {
            btnStart.disabled = true;
            btnStart.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> ĐANG CHUẨN BỊ...';
            try {
                await updateDoc(roomRef, { status: 'playing' });
                // Document updated -> onSnapshot sẽ tự động trigger và chuyển hướng mọi người
            } catch (error) {
                console.error("Lỗi khi bắt đầu phòng:", error);
                btnStart.disabled = false;
                btnStart.innerHTML = '<i class="fa-solid fa-rocket"></i> BẮT ĐẦU THI';
            }
        });

    } catch (error) {
        console.error("Lỗi khi vào phòng:", error);
        alert("Không thể tham gia phòng lúc này.");
    }
}