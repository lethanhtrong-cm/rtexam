import { auth, db } from "./dashboard-core.js";
import { collection, query, where, onSnapshot, doc, updateDoc, orderBy } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// =========================================================================
// 1. GẮN SỰ KIỆN ĐÓNG MỞ CHUÔNG SAU KHI GIAO DIỆN SẴN SÀNG
// =========================================================================
document.addEventListener('ComponentsLoaded', () => {
    const bellToggle = document.getElementById('bellToggle');
    const notiDropdown = document.getElementById('notiDropdown');

    if (bellToggle && notiDropdown) {
        bellToggle.addEventListener('click', (e) => {
            e.stopPropagation();
            if (e.target.closest('.notification-dropdown')) return; 
            notiDropdown.classList.toggle('show');
        });

        document.addEventListener('click', (e) => {
            if (!bellToggle.contains(e.target) && !notiDropdown.contains(e.target)) {
                notiDropdown.classList.remove('show');
            }
        });
    }
});

// =========================================================================
// 2. LẮNG NGHE REAL-TIME KHI USER ĐĂNG NHẬP
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
    
    // Lấy thông báo theo email người nhận, sắp xếp theo thời gian gửi (timestamp)
    const q = query(
        notiRef, 
        where("toEmail", "==", userEmail),
        orderBy("timestamp", "desc")
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
            
            // Theo đúng logic của bạn: kiểm tra trường status là 'unread'
            if (data.status === 'unread') {
                unreadCount++;
            }

            let timeString = 'Vừa xong';
            if (data.timestamp) {
                const date = data.timestamp.toDate();
                timeString = date.toLocaleTimeString('vi-VN', {hour: '2-digit', minute:'2-digit'}) + ' ' + date.toLocaleDateString('vi-VN');
            }

            const itemClass = data.status === 'unread' ? 'noti-item unread' : 'noti-item';
            const html = `
                <div class="${itemClass}" data-id="${id}" style="cursor: pointer; transition: background 0.2s;">
                    <div class="noti-icon">
                        <i class="fa-solid ${data.type === 'room_invite' ? 'fa-envelope-open-text' : 'fa-share-nodes'}"></i>
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

        // Cập nhật số đếm chuông
        if (unreadCount > 0) {
            notiBadgeCount.textContent = unreadCount > 99 ? '99+' : unreadCount;
            notiBadgeCount.style.display = 'block';
        } else {
            notiBadgeCount.style.display = 'none';
        }

        // Xử lý sự kiện khi bấm vào thông báo
        document.querySelectorAll('.noti-item').forEach(item => {
            item.addEventListener('click', async () => {
                const notiId = item.getAttribute('data-id');
                const notiDataDoc = snapshot.docs.find(d => d.id === notiId);
                const notiData = notiDataDoc ? notiDataDoc.data() : null;

                if (item.classList.contains('unread')) {
                    try {
                        const docRef = doc(db, 'notifications', notiId);
                        // Cập nhật status thành 'read'
                        await updateDoc(docRef, { status: 'read' });
                    } catch (error) {
                        console.error("Lỗi cập nhật thông báo:", error);
                    }
                }

                // Chuyển hướng người dùng sang trang thi
                if (notiData && notiData.examId) {
                    window.location.href = `quiz.html?examId=${notiData.examId}`;
                }
            });
        });
    }, (error) => {
        console.error("Lỗi khi lắng nghe thông báo Realtime:", error);
    });
}
