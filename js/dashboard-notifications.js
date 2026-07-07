import { auth, db } from "./dashboard-core.js";
import { collection, query, where, onSnapshot, doc, updateDoc, orderBy } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// Khởi tạo các Element giao diện sau khi Component đã tải
document.addEventListener('ComponentsLoaded', () => {
    const bellToggle = document.getElementById('bellToggle');
    const notiDropdown = document.getElementById('notiDropdown');

    if (bellToggle && notiDropdown) {
        bellToggle.addEventListener('click', (e) => {
            if (e.target.closest('.notification-dropdown')) return; 
            notiDropdown.classList.toggle('show');
        });

        document.addEventListener('click', (e) => {
            if (!bellToggle.contains(e.target)) {
                notiDropdown.classList.remove('show');
            }
        });
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
    const notiListContainer = document.getElementById('notiListContainer');
    const notiBadgeCount = document.getElementById('notiBadgeCount');

    if (!notiListContainer || !notiBadgeCount) return;

    const notiRef = collection(db, "notifications");
    
    const q = query(
        notiRef, 
        where("toEmail", "==", userEmail),
        orderBy("createdAt", "desc")
    );

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

            let timeString = 'Vừa xong';
            if (data.createdAt) {
                const date = data.createdAt.toDate();
                timeString = date.toLocaleTimeString('vi-VN', {hour: '2-digit', minute:'2-digit'}) + ' ' + date.toLocaleDateString('vi-VN');
            }

            const itemClass = data.isRead ? 'noti-item' : 'noti-item unread';
            const html = `
                <div class="${itemClass}" data-id="${id}" style="cursor: pointer; transition: background 0.2s;">
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

        if (unreadCount > 0) {
            notiBadgeCount.textContent = unreadCount > 99 ? '99+' : unreadCount;
            notiBadgeCount.style.display = 'block';
        } else {
            notiBadgeCount.style.display = 'none';
        }

        document.querySelectorAll('.noti-item').forEach(item => {
            item.addEventListener('click', async () => {
                const notiId = item.getAttribute('data-id');
                const notiDataDoc = snapshot.docs.find(d => d.id === notiId);
                const notiData = notiDataDoc ? notiDataDoc.data() : null;

                if (item.classList.contains('unread')) {
                    try {
                        const docRef = doc(db, 'notifications', notiId);
                        await updateDoc(docRef, { isRead: true });
                    } catch (error) {
                        console.error("Lỗi cập nhật thông báo:", error);
                    }
                }

                if (notiData && notiData.type === 'room_invite' && notiData.roomId) {
                    window.location.href = `lobby.html?roomId=${notiData.roomId}`;
                }
            });
        });
    });
}
