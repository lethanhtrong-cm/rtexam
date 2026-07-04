import { auth, db } from "./dashboard-core.js";
import { collection, query, where, onSnapshot, doc, updateDoc, orderBy } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// Khởi tạo các Element giao diện
const bellToggle = document.getElementById('bellToggle');
const notiDropdown = document.getElementById('notiDropdown');
const notiBadgeCount = document.getElementById('notiBadgeCount');
const notiListContainer = document.getElementById('notiListContainer');

// Lắng nghe đóng mở dropdown chuông
bellToggle.addEventListener('click', (e) => {
    // Không đóng dropdown nếu bấm bên trong chính nó
    if (e.target.closest('.notification-dropdown')) return; 
    notiDropdown.classList.toggle('show');
});

// Click ra ngoài thì đóng dropdown
document.addEventListener('click', (e) => {
    if (!bellToggle.contains(e.target)) {
        notiDropdown.classList.remove('show');
    }
});

// Chờ user đăng nhập để query Firestore
document.addEventListener('authReady', (e) => {
    const user = e.detail ? e.detail.user : auth.currentUser;
    if (user && user.email) {
        initNotifications(user.email);
    }
});

function initNotifications(userEmail) {
    const notiRef = collection(db, "notifications");
    
    // Query lấy thông báo của user này, sắp xếp thời gian
    const q = query(
        notiRef, 
        where("toEmail", "==", userEmail),
        orderBy("createdAt", "desc")
    );

    // Lắng nghe Real-time
    onSnapshot(q, (snapshot) => {
        let unreadCount = 0;
        notiListContainer.innerHTML = '';

        if (snapshot.empty) {
            notiListContainer.innerHTML = '<div class="noti-empty">Bạn chưa có thông báo nào.</div>';
            notiBadgeCount.style.display = 'none';
            return;
        }

        snapshot.forEach((docSnapshot) => {
            const data = docSnapshot.data();
            const id = docSnapshot.id;
            
            if (!data.isRead) {
                unreadCount++;
            }

            // Định dạng thời gian
            let timeString = 'Vừa xong';
            if (data.createdAt) {
                const date = data.createdAt.toDate();
                timeString = date.toLocaleTimeString('vi-VN', {hour: '2-digit', minute:'2-digit'}) + ' ' + date.toLocaleDateString('vi-VN');
            }

            // Dựng HTML cho từng thông báo
            const itemClass = data.isRead ? 'noti-item' : 'noti-item unread';
            const html = `
                <div class="${itemClass}" data-id="${id}">
                    <div class="noti-icon">
                        <i class="fa-solid ${data.type === 'room_invite' ? 'fa-envelope-open-text' : 'fa-bell'}"></i>
                    </div>
                    <div class="noti-content">
                        <div class="noti-text">
                            ${data.message || 'Bạn có một thông báo mới.'}
                        </div>
                        <div class="noti-time">${timeString}</div>
                    </div>
                </div>
            `;
            notiListContainer.insertAdjacentHTML('beforeend', html);
        });

        // Cập nhật Badge đỏ
        if (unreadCount > 0) {
            notiBadgeCount.textContent = unreadCount > 99 ? '99+' : unreadCount;
            notiBadgeCount.style.display = 'block';
        } else {
            notiBadgeCount.style.display = 'none';
        }

        // Gắn sự kiện click đánh dấu đã đọc
        document.querySelectorAll('.noti-item').forEach(item => {
            item.addEventListener('click', async () => {
                const notiId = item.getAttribute('data-id');
                if (item.classList.contains('unread')) {
                    try {
                        const docRef = doc(db, 'notifications', notiId);
                        await updateDoc(docRef, { isRead: true });
                        // Click vào lời mời phòng thi có thể auto chuyển hướng tại đây nếu muốn
                    } catch (error) {
                        console.error("Lỗi cập nhật thông báo:", error);
                    }
                }
            });
        });
    });
}