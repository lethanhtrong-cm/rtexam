import { auth, db } from "./dashboard-core.js";
import { collection, query, where, onSnapshot, doc, updateDoc, orderBy } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// Khai báo mảng lưu trữ các ID thông báo chưa đọc
let unreadNotiIds = [];

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

            // TỰ ĐỘNG ĐÁNH DẤU "ĐÃ ĐỌC" KHI MỞ CHUÔNG THÔNG BÁO
            if (notiDropdown.classList.contains('show') && unreadNotiIds.length > 0) {
                unreadNotiIds.forEach(id => {
                    updateDoc(doc(db, 'notifications', id), { status: 'read' }).catch(err => console.error(err));
                });
                unreadNotiIds = []; // Làm rỗng mảng sau khi xử lý
                
                // Ẩn lập tức huy hiệu số màu đỏ trên UI
                const notiBadgeCount = document.getElementById('notiBadgeCount');
                if (notiBadgeCount) notiBadgeCount.style.display = 'none'; 
            }
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
    
    // Lấy thông báo theo email người nhận, sắp xếp theo thời gian
    const q = query(
        notiRef, 
        where("toEmail", "==", userEmail),
        orderBy("timestamp", "desc")
    );

    onSnapshot(q, (snapshot) => {
        let unreadCount = 0;
        unreadNotiIds = []; // Reset mảng mỗi khi có dữ liệu mới
        notiListContainer.innerHTML = '';

        if (snapshot.empty) {
            notiListContainer.innerHTML = '<div class="noti-empty">Bạn chưa có thông báo nào.</div>';
            notiBadgeCount.style.display = 'none';
            return;
        }

        snapshot.forEach((docSnapshot) => {
            const data = docSnapshot.data();
            const id = docSnapshot.id;
            
            if (data.status === 'unread') {
                unreadCount++;
                unreadNotiIds.push(id); // Đưa ID chưa đọc vào mảng
            }

            let timeString = 'Vừa xong';
            if (data.timestamp) {
                const date = data.timestamp.toDate();
                timeString = date.toLocaleTimeString('vi-VN', {hour: '2-digit', minute:'2-digit'}) + ' ' + date.toLocaleDateString('vi-VN');
            }

            const itemClass = data.status === 'unread' ? 'noti-item unread' : 'noti-item';
            
            // XỬ LÝ NỘI DUNG VÀ ICON TÙY THEO LOẠI THÔNG BÁO
            let iconHtml = '';
            let textHtml = '';

            if (data.type === 'admin_reply') {
                iconHtml = '<i class="fa-solid fa-comment-dots" style="color: #3b82f6;"></i>';
                textHtml = `<b>Admin</b> đã phản hồi báo cáo lỗi câu hỏi của bạn.`;
            } else if (data.type === 'system_broadcast' || data.type === 'admin_direct') {
                // XỬ LÝ THÔNG BÁO MỚI TỪ TRANG ADMIN (HỆ THỐNG / CÁ NHÂN)
                const iconColor = data.type === 'system_broadcast' ? '#8b5cf6' : '#f59e0b';
                const iconClass = data.type === 'system_broadcast' ? 'fa-bullhorn' : 'fa-bell';
                iconHtml = `<i class="fa-solid ${iconClass}" style="color: ${iconColor};"></i>`;
                textHtml = `<b>${data.title || 'Thông báo từ Hệ thống'}</b><br><span style="font-size: 0.9em; opacity: 0.8;">${data.message || ''}</span>`;
            } else if (data.type === 'room_invite') {
                iconHtml = '<i class="fa-solid fa-envelope-open-text" style="color: #10b981;"></i>';
                textHtml = data.message || `<b>${data.fromEmail}</b> đã mời bạn vào phòng.`;
            } else {
                iconHtml = '<i class="fa-solid fa-share-nodes"></i>';
                textHtml = data.message || `<b>${data.fromEmail}</b> đã chia sẻ đề thi <b>${data.examId}</b> với bạn.`;
            }

            const html = `
                <div class="${itemClass}" data-id="${id}" style="cursor: pointer; transition: background 0.2s;">
                    <div class="noti-icon">
                        ${iconHtml}
                    </div>
                    <div class="noti-content">
                        <div class="noti-text" style="line-height: 1.4;">
                            ${textHtml}
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

        // ===================================================================
        // XỬ LÝ SỰ KIỆN CLICK THÔNG BÁO (Tích hợp logic Admin Reply)
        // ===================================================================
        document.querySelectorAll('.noti-item').forEach(item => {
            item.addEventListener('click', async () => {
                const notiId = item.getAttribute('data-id');
                // Lấy toàn bộ data gốc từ snapshot (Tuyệt đối an toàn không lo escape HTML)
                const notiDataDoc = snapshot.docs.find(d => d.id === notiId);
                const notiData = notiDataDoc ? notiDataDoc.data() : null;

                // 1. Cập nhật trạng thái thành đã đọc (chung cho mọi loại thông báo)
                if (item.classList.contains('unread')) {
                    try {
                        const docRef = doc(db, 'notifications', notiId);
                        await updateDoc(docRef, { status: 'read' });
                    } catch (error) {
                        console.error("Lỗi cập nhật thông báo:", error);
                    }
                }

                // 2. Phân loại chuyển hướng hoặc hiển thị Popup
                if (notiData) {
                    if (notiData.type === 'admin_reply') {
                        // Gọi hàm hiển thị Modal phản hồi từ Admin
                        window.openAdminReplyModal(notiData.adminMessage);
                    } 
                    else if (notiData.type === 'system_broadcast' || notiData.type === 'admin_direct') {
                        // Gọi hàm hiển thị Modal nội dung thông báo chung
                        const displayMsg = `[${notiData.title}]\n\n${notiData.message}`;
                        window.openAdminReplyModal(displayMsg);
                    }
                    else if (notiData.type === 'room_invite' || notiData.roomId) {
                        window.location.href = `lobby.html?roomId=${notiData.roomId}`;
                    } 
                    else if (notiData.examId) {
                        window.location.href = `quiz.html?examId=${notiData.examId}`;
                    }
                }
            });
        });
    }, (error) => {
        console.error("Lỗi khi lắng nghe thông báo Realtime:", error);
    });
}

// =========================================================================
// 3. HÀM TOÀN CỤC: MỞ MODAL ĐỌC PHẢN HỒI / THÔNG BÁO CỦA ADMIN
// =========================================================================
window.openAdminReplyModal = function(message) {
    const modal = document.getElementById('user-admin-reply-modal');
    const msgContainer = document.getElementById('user-admin-message');
    
    if (modal && msgContainer) {
        // Gán message an toàn (innerText chống XSS và giữ nguyên form, xuống dòng)
        msgContainer.innerText = message || "Không có nội dung.";
        modal.style.display = 'block';
    } else {
        console.error("Không tìm thấy HTML của Modal hiển thị thông báo.");
        // Fallback dùng Alert nếu dev quên chèn HTML Modal
        alert("Thông báo hệ thống:\n\n" + message);
    }
}
