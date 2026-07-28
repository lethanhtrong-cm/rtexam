// ==========================================
// FILE: admin-user/admin-users-notify.js
// QUẢN LÝ GIAO DIỆN MODAL VÀ LOGIC GỬI THÔNG BÁO
// ==========================================
import { db, showToast } from '../admin-core.js';
import { 
    collection, addDoc, serverTimestamp 
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

export function openNotificationModal(targetEmail) {
    const modal = document.getElementById('notification-modal');
    if (!modal) {
        showToast("Lỗi: Giao diện Modal thông báo chưa tải xong!", "error");
        return;
    }
    
    let displayTarget = targetEmail;
    if (targetEmail.includes(',') && targetEmail.length > 30) {
        const count = targetEmail.split(',').length;
        displayTarget = `${count} TÀI KHOẢN ĐÃ CHỌN`;
    } else if (targetEmail === 'ALL') {
        displayTarget = 'TẤT CẢ HỌC VIÊN (HỆ THỐNG)';
    }

    document.getElementById('notify-target-display').innerText = displayTarget;
    document.getElementById('notify-target-value').value = targetEmail;
    document.getElementById('notifyTitle').value = '';
    document.getElementById('notifyMessage').value = '';
    
    modal.style.display = 'block';
}

export async function sendNotification(cachedUsers, selectedUserIds, onSuccessCallback) {
    const target = document.getElementById('notify-target-value').value;
    const title = document.getElementById('notifyTitle').value.trim();
    const message = document.getElementById('notifyMessage').value.trim();
    const btnSend = document.getElementById('btnSendNotification');

    if (!title || !message) {
        showToast("Vui lòng nhập đầy đủ tiêu đề và nội dung thông báo!", "error");
        return;
    }

    btnSend.disabled = true;
    btnSend.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Đang gửi...';

    try {
        const notificationsRef = collection(db, "notifications");
        
        if (target === 'ALL') {
            const activeUsers = cachedUsers.filter(u => !u.isBanned);
            const promises = activeUsers.map(user => {
                return addDoc(notificationsRef, {
                    toEmail: user.email, title: title, message: message, status: 'unread', type: 'system_broadcast', timestamp: serverTimestamp()
                });
            });
            await Promise.all(promises);
            showToast(`Đã gửi thông báo hàng loạt đến ${activeUsers.length} tài khoản!`, "success");
        } 
        else if (target.includes(',')) {
            const emails = target.split(',').map(e => e.trim());
            const promises = emails.map(email => {
                return addDoc(notificationsRef, {
                    toEmail: email, title: title, message: message, status: 'unread', type: 'admin_bulk', timestamp: serverTimestamp()
                });
            });
            await Promise.all(promises);
            showToast(`Đã gửi thông báo cho ${emails.length} tài khoản được chọn!`, "success");
        }
        else {
            await addDoc(notificationsRef, {
                toEmail: target, title: title, message: message, status: 'unread', type: 'admin_direct', timestamp: serverTimestamp()
            });
            showToast(`Đã gửi thông báo riêng tư cho ${target} thành công!`, "success");
        }

        document.getElementById('notification-modal').style.display = 'none';
        
        if (typeof onSuccessCallback === 'function') {
            onSuccessCallback();
        }

    } catch (error) {
        console.error("Lỗi khi gửi thông báo:", error);
        showToast("Có lỗi xảy ra khi ghi dữ liệu lên Firebase", "error");
    } finally {
        btnSend.disabled = false;
        btnSend.innerHTML = '<i class="fa-solid fa-paper-plane"></i> Gửi Ngay';
    }
}
