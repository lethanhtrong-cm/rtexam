import { auth, db } from "./dashboard-core.js";
import { collection, query, where, onSnapshot, doc, updateDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// =========================================================================
// 1. XỬ LÝ GIAO DIỆN DROPDOWN (CLICK CHUÔNG)
// =========================================================================
document.addEventListener('DOMContentLoaded', () => {
    const bellToggle = document.getElementById('bellToggle');
    const notiDropdown = document.getElementById('notiDropdown');

    if (bellToggle && notiDropdown) {
        // Toggle khi click vào chuông
        bellToggle.addEventListener('click', (e) => {
            e.stopPropagation(); 
            notiDropdown.classList.toggle('show');
            
            // Nếu menu avatar đang mở thì đóng nó lại
            const userDropdown = document.getElementById('userDropdown');
            if (userDropdown) userDropdown.classList.remove('show');
        });

        // Click ra ngoài thì đóng thông báo
        document.addEventListener('click', (e) => {
            if (!bellToggle.contains(e.target) && !notiDropdown.contains(e.target)) {
                notiDropdown.classList.remove('show');
            }
        });

        // Không đóng khi click vào bên trong bảng thông báo
        notiDropdown.addEventListener('click', (e) => e.stopPropagation());
    }
});

// =========================================================================
// 2. LẮNG NGHE DỮ LIỆU THÔNG BÁO TỪ FIREBASE (REAL-TIME)
// =========================================================================
document.addEventListener('authReady', (e) => {
    const user = e.detail ? e.detail.user : auth.currentUser;
    if (user && user.email) {
        initNotifications(user.email);
    }
});

function initNotifications(userEmail) {
    const notiListContainer = document.getElementById('notiListContainer');
    const notiBadgeCount = document.getElementById('notiBadgeCount');

    if (!notiListContainer || !notiBadgeCount) return;

    const notiRef = collection(db, "notifications");
    // Chỉ lọc theo email người nhận (Không dùng orderBy để tránh lỗi thiếu Index của Firebase)
    const q = query(notiRef, where("toEmail", "==", userEmail));

    onSnapshot(q, (snapshot) => {
        let unreadCount = 0;
        let htmlContent = '';

        if (snapshot.empty) {
            notiListContainer.innerHTML = '<div class="noti-empty">Bạn chưa có thông báo nào.</div>';
            notiBadgeCount.style.display = 'none';
            return;
        }

        // Tạo mảng để sắp xếp thời gian thủ công tại Client
        const notiArray = [];
        snapshot.forEach(doc => {
            notiArray.push({ id: doc.id, ...doc.data() });
        });
        
        // Sắp xếp mới nhất lên đầu
        notiArray.sort((a, b) => {
            const timeA = a.createdAt ? (typeof a.createdAt.toMillis === 'function' ? a.createdAt.toMillis() : new Date(a.createdAt).getTime()) : (a.timestamp ? new Date(a.timestamp).getTime() : 0);
            const timeB = b.createdAt ? (typeof b.createdAt.toMillis === 'function' ? b.createdAt.toMillis() : new Date(b.createdAt).getTime()) : (b.timestamp ? new Date(b.timestamp).getTime() : 0);
            return timeB - timeA;
        });

        notiArray.forEach((data) => {
            // Kiểm tra trạng thái chưa đọc (Hỗ trợ cả chuẩn cũ và chuẩn mới)
            const isUnread = (data.status === 'unread') || (data.isRead === false) || (data.status === undefined && data.isRead === undefined);
            
            if (isUnread) unreadCount++;

            // Hiển thị thời gian
            let timeString = 'Vừa xong';
            if (data.createdAt || data.timestamp) {
                const ts = data.createdAt ? (typeof data.createdAt.toDate === 'function' ? data.createdAt.toDate() : new Date(data.createdAt)) : new Date(data.timestamp);
                timeString = ts.toLocaleTimeString('vi-VN', {hour: '2-digit', minute:'2-digit'}) + ' ' + ts.toLocaleDateString('vi-VN');
            }

            const itemClass = isUnread ? 'noti-item unread' : 'noti-item';
            
            // Tùy biến Nội dung & Icon dựa theo loại thông báo
            let iconStr = '<i class="fa-solid fa-bell"></i>';
            let messageStr = data.message || 'Bạn có một thông báo mới.';
            
            // Nếu là thông báo CHIA SẺ ĐỀ THI
            if (data.examId) {
                iconStr = '<i class="fa-solid fa-envelope-open-text"></i>';
                messageStr = `<b>${data.fromEmail || "Một người bạn"}</b> vừa chia sẻ cho bạn đề thi <b>${data.examId}</b>`;
            } 
            // Nếu là thông báo MỜI VÀO PHÒNG
            else if (data.type === 'room_invite') {
                iconStr = '<i class="fa-solid fa-people-roof"></i>';
            }

            // Render HTML
            htmlContent += `
                <div class="${itemClass}" onclick="handleNotificationClick('${data.id}', '${data.examId || ''}', '${data.roomId || ''}')">
                    <div class="noti-icon">${iconStr}</div>
                    <div class="noti-content">
                        <div class="noti-text">${messageStr}</div>
                        <div class="noti-time">${timeString}</div>
                    </div>
                </div>
            `;
        });

        // Đổ HTML vào UI
        notiListContainer.innerHTML = htmlContent;

        // Cập nhật số đếm
        if (unreadCount > 0) {
            notiBadgeCount.textContent = unreadCount > 99 ? '99+' : unreadCount;
            notiBadgeCount.style.display = 'block';
        } else {
            notiBadgeCount.style.display = 'none';
        }
    });
}

// =========================================================================
// 3. HÀM XỬ LÝ KHI CLICK VÀO 1 DÒNG THÔNG BÁO
// =========================================================================
window.handleNotificationClick = async function(notiId, examId, roomId) {
    try {
        const notiDocRef = doc(db, "notifications", notiId);
        
        // Đánh dấu đã đọc (Lưu cả 2 chuẩn để tương thích)
        await updateDoc(notiDocRef, {
            status: "read",
            isRead: true
        });

        // Phân luồng chuyển hướng
        if (examId) {
            window.location.href = `quiz.html?examId=${examId}`;
        } else if (roomId) {
            window.location.href = `lobby.html?roomId=${roomId}`;
        }
    } catch (error) {
        console.error("Lỗi khi đọc thông báo:", error);
    }
};
