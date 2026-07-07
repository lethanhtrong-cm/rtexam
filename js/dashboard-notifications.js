import { auth, db } from "./dashboard-core.js";
import { collection, query, where, onSnapshot, doc, updateDoc, orderBy } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// =========================================================================
// 1. GẮN SỰ KIỆN CLICK CHUÔNG SAU KHI GIAO DIỆN ĐÃ TẢI XONG
// =========================================================================
document.addEventListener('ComponentsLoaded', () => {
    const bellToggle = document.getElementById('bellToggle');
    const notiDropdown = document.getElementById('notiDropdown');

    if (bellToggle && notiDropdown) {
        bellToggle.addEventListener('click', (e) => {
            e.stopPropagation(); // Ngăn click truyền ra ngoài
            notiDropdown.classList.toggle('show');
        });

        // Click ra ngoài vùng dropdown thì tự động đóng lại
        document.addEventListener('click', (e) => {
            if (!bellToggle.contains(e.target) && !notiDropdown.contains(e.target)) {
                notiDropdown.classList.remove('show');
            }
        });
    }
});

// =========================================================================
// 2. LẤY THÔNG BÁO REAL-TIME TỪ FIREBASE
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
    
    // Query lấy thông báo của user này, sắp xếp thời gian mới nhất lên đầu
    const q = query(
        notiRef, 
        where("toEmail", "==", userEmail),
        orderBy("createdAt", "desc")
    );

    // Lắng nghe Real-time từ Firestore
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

            const itemClass = data.isRead ? 'noti-item' : 'noti-item unread';
            const html = `
                <div class="${itemClass}" data-id="${id}" style="cursor: pointer; transition: background 0.2s;">
                    <div class="noti-icon">
                        <i class="fa-solid ${data.type === 'room_invite' ? 'fa-envelope-open-text' : 'fa-bell'}"></i>
                    </div>
                    <div class="noti-content">
                        <div class="noti-text">
                            ${data.message || `<b>${data.fromEmail}</b> đã chia sẻ đề thi <b>${data.examId}</b> với bạn.`}
                        </div>
                        <div class="noti-time">${timeString}</div>
                    </div>
                </div>
            `;
            notiListContainer.insertAdjacentHTML('beforeend', html);
        });

        // Cập nhật số đếm trên quả chuông màu đỏ
        if (unreadCount > 0) {
            notiBadgeCount.textContent = unreadCount > 99 ? '99+' : unreadCount;
            notiBadgeCount.style.display = 'block';
        } else {
            notiBadgeCount.style.display = 'none';
        }

        // Sự kiện click vào một thông báo cụ thể
        document.querySelectorAll('.noti-item').forEach(item => {
            item.addEventListener('click', async () => {
                const notiId = item.getAttribute('data-id');
                const notiDataDoc = snapshot.docs.find(d => d.id === notiId);
                const notiData = notiDataDoc ? notiDataDoc.data() : null;

                // Đánh dấu đã đọc trên database
                if (item.classList.contains('unread')) {
                    try {
                        const docRef = doc(db, 'notifications', notiId);
                        await updateDoc(docRef, { isRead: true }); // Dùng chung trường isRead thay vì status
                    } catch (error) {
                        console.error("Lỗi cập nhật thông báo:", error);
                    }
                }

                // Chuyển hướng
                if (notiData) {
                    if (notiData.type === 'room_invite' && notiData.roomId) {
                        window.location.href = `lobby.html?roomId=${notiData.roomId}`;
                    } else if (notiData.examId) {
                        window.location.href = `quiz.html?examId=${notiData.examId}`;
                    }
                }
            });
        });
    });
}
