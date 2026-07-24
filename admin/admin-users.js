import { db, showToast } from './admin-core.js';
import { 
    collection, onSnapshot, doc, updateDoc, query, where, getDocs, addDoc, serverTimestamp 
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

let cachedUsers = [];
let currentSearchQuery = "";
let currentFilterStatus = "all";

// Biến lưu trữ danh sách đang chờ duyệt VIP
let pendingVIPRequests = new Set(); 

export function initRealtimePaymentListener() {
    onSnapshot(collection(db, "payment_requests"), (snapshot) => {
        pendingVIPRequests.clear();
        snapshot.forEach((docSnap) => {
            const data = docSnap.data();
            if (data.status === "pending") {
                pendingVIPRequests.add(data.uid);
            }
        });
        renderUserList(); 
    }, (error) => {
        console.error("Lỗi khi tải yêu cầu thanh toán:", error);
    });
}

export function initRealtimeUserListener() {
    const tbody = document.getElementById('usersTableBody');
    if (!tbody) return;

    onSnapshot(collection(db, "users"), (snapshot) => {
        cachedUsers = [];
        
        let totalUsersCount = 0;
        let totalVipsCount = 0;
        let totalOnlineCount = 0;

        snapshot.forEach((docSnap) => {
            const user = docSnap.data();
            const userId = docSnap.id;
            const email = user.email || 'Chưa cập nhật';
            const isVip = user.isVip || false;
            const isBanned = user.isBanned || false;
            const isOnline = user.isOnline || false; 
            // Lấy lượng token đã dùng
            const totalTokensUsed = user.totalTokensUsed || 0;

            totalUsersCount++;
            if (isVip) totalVipsCount++; 
            if (isOnline && !isBanned) totalOnlineCount++; 

            let statusKey = 'normal';
            if (isBanned) statusKey = 'banned';
            else if (isVip) statusKey = 'vip';

            cachedUsers.push({
                userId: userId,
                email: email,
                isVip: isVip,
                isBanned: isBanned,
                isOnline: isOnline,
                statusKey: statusKey,
                totalTokensUsed: totalTokensUsed
            });
        });

        const totalUsersEl = document.getElementById('totalUsers');
        const totalVipUsersEl = document.getElementById('totalVipUsers');
        const totalOnlineUsersEl = document.getElementById('totalOnlineUsers');

        if (totalUsersEl) totalUsersEl.innerText = totalUsersCount;
        if (totalVipUsersEl) totalVipUsersEl.innerText = totalVipsCount;
        if (totalOnlineUsersEl) totalOnlineUsersEl.innerText = totalOnlineCount;

        renderUserList();
    }, (error) => {
        console.error("Lỗi kết nối Firestore Real-time:", error);
        tbody.innerHTML = `
            <tr>
                <td colspan="4" class="loading-text" style="color: #ef4444; font-weight: 500;">
                    ❌ Có lỗi xảy ra khi tải dữ liệu từ Cloud Firestore.<br>
                    <span style="font-size: 12px; color: #64748b;">Vui lòng kiểm tra lại cấu hình Security Rules hoặc kết nối mạng.</span>
                </td>
            </tr>
        `;
        showToast("Không thể đồng bộ danh sách học viên Real-time", "error");
    });
}

export function renderUserList() {
    const tbody = document.getElementById('usersTableBody');
    if (!tbody) return;

    const filteredUsers = cachedUsers.filter(user => {
        const matchSearch = !currentSearchQuery || user.email.toLowerCase().includes(currentSearchQuery);
        const matchStatus = currentFilterStatus === "all" || user.statusKey === currentFilterStatus;
        return matchSearch && matchStatus;
    });

    tbody.innerHTML = '';
    let stt = 1;

    if (filteredUsers.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" class="empty-message">Không tìm thấy thành viên nào khớp với điều kiện tìm kiếm.</td></tr>';
        return;
    }

    filteredUsers.forEach(user => {
        let badgeClass = 'badge-normal';
        let badgeText = 'Thường';

        if (user.isBanned) {
            badgeClass = 'badge-banned';
            badgeText = 'Bị Khóa';
        } else if (user.isVip) {
            badgeClass = 'badge-vip';
            badgeText = 'VIP 👑';
        }

        const firstLetter = user.email.charAt(0);
        
        // Cảnh báo thanh toán
        const hasPendingRequest = pendingVIPRequests.has(user.userId);
        const pendingBadge = hasPendingRequest 
            ? `<span style="background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); color: white; margin-left: 8px; font-size: 11px; padding: 2px 8px; border-radius: 12px; font-weight: bold; box-shadow: 0 2px 4px rgba(239, 68, 68, 0.4); animation: pulse 2s infinite;">💸 Báo Đã CK</span>` 
            : '';

        // TÍNH TOÁN CHI PHÍ AI (Quy đổi VNĐ: 1M Token = ~19.740 VNĐ)
        const costVND = Math.round((user.totalTokensUsed / 1000000) * 42638);
        const costBadgeHtml = user.totalTokensUsed > 0 
            ? `<div style="font-size: 11.5px; color: #059669; font-weight: 700; margin-top: 4px; display: inline-block; background: #d1fae5; padding: 2px 8px; border-radius: 6px;"><i class="fa-solid fa-microchip"></i> Đã dùng AI: ${costVND.toLocaleString('vi-VN')} đ</div>` 
            : '';

        // CẤU HÌNH GIAO DIỆN NÚT BẤM HIỆN ĐẠI
        const vipBtnClass = user.isVip ? 'btn-user-vip-off' : 'btn-user-vip-on';
        const vipBtnText = user.isVip ? '💎 Tắt VIP' : '👑 Kích VIP';
        const banBtnClass = user.isBanned ? 'btn-user-unban' : 'btn-user-ban';
        const banBtnText = user.isBanned ? '🔓 Mở Khóa' : '🚫 Khóa TK';

        // CSS inline cho các nút
        const baseBtnStyle = "padding: 6px 12px; font-size: 12.5px; border-radius: 8px; display: inline-flex; align-items: center; gap: 5px; border: none; font-weight: 600; cursor: pointer; transition: all 0.2s ease; color: white;";
        const notifyStyle = `${baseBtnStyle} background: linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%); box-shadow: 0 2px 5px rgba(139,92,246,0.3);`;
        
        const vipStyle = user.isVip 
            ? `${baseBtnStyle} background: #94a3b8; box-shadow: 0 2px 5px rgba(148,163,184,0.3);` 
            : `${baseBtnStyle} background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); box-shadow: 0 2px 5px rgba(245,158,11,0.3);`; 
            
        const historyStyle = `${baseBtnStyle} background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); box-shadow: 0 2px 5px rgba(59,130,246,0.3);`;
        
        const banStyle = user.isBanned
            ? `${baseBtnStyle} background: linear-gradient(135deg, #10b981 0%, #059669 100%); box-shadow: 0 2px 5px rgba(16,185,129,0.3);` 
            : `${baseBtnStyle} background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); box-shadow: 0 2px 5px rgba(239,68,68,0.3);`; 
            
        const hoverEffect = `onmouseover="this.style.transform='translateY(-1.5px)'" onmouseout="this.style.transform='translateY(0)'"`;

        const tr = document.createElement('tr');
        tr.className = 'user-row';
        tr.style.transition = "background-color 0.2s ease";
        
        tr.style.backgroundColor = hasPendingRequest ? '#fff1f2' : 'transparent';
        tr.onmouseover = () => tr.style.backgroundColor = hasPendingRequest ? '#ffe4e6' : '#f8fafc';
        tr.onmouseout = () => tr.style.backgroundColor = hasPendingRequest ? '#fff1f2' : 'transparent';
        
        tr.innerHTML = `
            <td class="text-center" style="font-weight: 600; color: #64748b;">${stt++}</td>
            <td>
                <div class="user-email-cell">
                    <div class="user-avatar-placeholder" style="background-color: ${getAvatarColor(firstLetter)};">
                        ${firstLetter}
                    </div>
                    <div>
                        <div style="font-weight: 600; color: #0f172a; font-size: 14px; display: flex; align-items: center;">
                            ${user.email} ${pendingBadge}
                        </div>
                        ${costBadgeHtml}
                    </div>
                </div>
            </td>
            <td class="text-center"><span class="badge ${badgeClass}" style="box-shadow: 0 1px 2px rgba(0,0,0,0.05);">${badgeText}</span></td>
            <td class="text-center">
                <div class="user-action-group" style="display: flex; gap: 8px; justify-content: center; flex-wrap: nowrap;">
                    <button class="btn-user-action btn-notify-user" data-email="${user.email}" style="${notifyStyle}" ${hoverEffect} title="Gửi thông báo riêng">
                        🔔 Gửi
                    </button>
                    <button class="btn-user-action ${vipBtnClass} btn-toggle-vip" data-id="${user.userId}" data-vip="${user.isVip}" style="${vipStyle}" ${hoverEffect}>
                        ${vipBtnText}
                    </button>
                    <button class="btn-user-action btn-user-history btn-history" data-email="${user.email}" style="${historyStyle}" ${hoverEffect}>
                        📊 Lịch Sử
                    </button>
                    <button class="btn-user-action ${banBtnClass} btn-toggle-ban" data-id="${user.userId}" data-banned="${user.isBanned}" style="${banStyle}" ${hoverEffect}>
                        ${banBtnText}
                    </button>
                </div>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function getAvatarColor(letter) {
    const charCode = letter.toUpperCase().charCodeAt(0) || 65;
    const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#14b8a6'];
    return colors[charCode % colors.length];
}

async function handleToggleVip(userId, currentVipStatus) {
    try {
        const userRef = doc(db, "users", userId);
        const newVipStatus = !currentVipStatus;
        await updateDoc(userRef, { isVip: newVipStatus });
        
        if (newVipStatus) {
            const q = query(collection(db, "payment_requests"), where("uid", "==", userId), where("status", "==", "pending"));
            const snapshot = await getDocs(q);
            snapshot.forEach(async (docSnap) => {
                await updateDoc(docSnap.ref, { status: "completed" });
            });
        }

        showToast(`Đã ${newVipStatus ? 'kích hoạt' : 'hủy quyền'} tài khoản VIP thành công!`, "success");
    } catch (error) {
        console.error("Lỗi cập nhật VIP:", error);
        showToast("Lỗi khi cập nhật trạng thái quyền VIP", "error");
    }
}

async function handleToggleBan(userId, currentBannedStatus) {
    const actionText = currentBannedStatus ? 'mở khóa' : 'khóa vĩnh viễn';
    if (!confirm(`Hệ thống cảnh báo: Bạn có chắc chắn thực hiện lệnh ${actionText} tài khoản học viên này không?`)) return;

    try {
        const userRef = doc(db, "users", userId);
        const newBannedStatus = !currentBannedStatus;
        await updateDoc(userRef, { isBanned: newBannedStatus });
        showToast(`Đã thực thi lệnh ${currentBannedStatus ? 'mở khóa' : 'khóa'} tài khoản thành công!`, "success");
    } catch (error) {
        console.error("Lỗi thay đổi trạng thái khóa:", error);
        showToast("Lỗi thay đổi trạng thái khóa tài khoản", "error");
    }
}

async function handleViewHistory(userEmail) {
    const modal = document.getElementById('historyModal');
    const historyBody = document.getElementById('historyTableBody');
    const modalTitle = document.getElementById('modalTitle');
    
    if (!modal || !historyBody) return;
    
    modalTitle.innerText = `📊 KẾT QUẢ THI: ${userEmail}`;
    historyBody.innerHTML = '<tr><td colspan="3" class="loading-text">⏳ Đang truy vấn cơ sở dữ liệu kết quả thi...</td></tr>';
    modal.style.display = "block";

    try {
        const resultsRef = collection(db, "results");
        const q = query(resultsRef, where("email", "==", userEmail));
        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
            historyBody.innerHTML = '<tr><td colspan="3" class="empty-message">Thành viên này chưa làm bài thi trắc nghiệm nào trên hệ thống.</td></tr>';
            return;
        }

        let htmlContent = '';
        querySnapshot.forEach((docSnap) => {
            const data = docSnap.data();
            const examCode = data.examCode || data.quizId || 'Không rõ';
            const score = data.score !== undefined ? data.score : 'N/A';
            
            let timeStr = 'Không rõ';
            if (data.timestamp) {
                if (typeof data.timestamp.toDate === 'function') {
                    timeStr = data.timestamp.toDate().toLocaleString('vi-VN');
                } else {
                    timeStr = new Date(data.timestamp).toLocaleString('vi-VN');
                }
            }

            htmlContent += `
                <tr>
                    <td><strong>${examCode}</strong></td>
                    <td class="text-center"><strong style="color: #ef4444; font-size: 15px;">${score}</strong></td>
                    <td style="color: #64748b; font-size: 13px;">${timeStr}</td>
                </tr>
            `;
        });

        historyBody.innerHTML = htmlContent;

    } catch (error) {
        console.error("Lỗi tải lịch sử results:", error);
        historyBody.innerHTML = '<tr><td colspan="3" class="empty-message" style="color:red">❌ Thất bại khi truy vấn lịch sử bài làm học viên.</td></tr>';
    }
}

// MỞ MODAL THÔNG BÁO
function openNotificationModal(targetEmail) {
    const modal = document.getElementById('notification-modal');
    if (!modal) {
        showToast("Lỗi: Giao diện Modal thông báo chưa tải xong!", "error");
        return;
    }
    
    document.getElementById('notify-target-display').innerText = targetEmail === 'ALL' ? 'TẤT CẢ HỌC VIÊN (HỆ THỐNG)' : targetEmail;
    document.getElementById('notify-target-value').value = targetEmail;
    document.getElementById('notifyTitle').value = '';
    document.getElementById('notifyMessage').value = '';
    
    modal.style.display = 'block';
}

// XỬ LÝ GỬI THÔNG BÁO
async function sendNotification() {
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
        
        // NẾU LÀ GỬI BROADCAST (TOÀN HỆ THỐNG)
        if (target === 'ALL') {
            const activeUsers = cachedUsers.filter(u => !u.isBanned);
            
            const promises = activeUsers.map(user => {
                return addDoc(notificationsRef, {
                    toEmail: user.email,
                    title: title,
                    message: message,
                    status: 'unread',
                    type: 'system_broadcast',
                    timestamp: serverTimestamp()
                });
            });
            await Promise.all(promises);
            showToast(`Đã gửi thông báo hàng loạt đến ${activeUsers.length} tài khoản thành công!`, "success");
        } 
        // NẾU LÀ GỬI CÁ NHÂN
        else {
            await addDoc(notificationsRef, {
                toEmail: target,
                title: title,
                message: message,
                status: 'unread',
                type: 'admin_direct',
                timestamp: serverTimestamp()
            });
            showToast(`Đã gửi thông báo riêng tư cho ${target} thành công!`, "success");
        }

        document.getElementById('notification-modal').style.display = 'none';
    } catch (error) {
        console.error("Lỗi khi gửi thông báo:", error);
        showToast("Có lỗi xảy ra khi ghi dữ liệu lên Firebase", "error");
    } finally {
        btnSend.disabled = false;
        btnSend.innerHTML = '<i class="fa-solid fa-paper-plane"></i> Gửi Ngay';
    }
}

document.addEventListener('componentsLoaded', () => {
    initRealtimeUserListener();
    initRealtimePaymentListener();

    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            currentSearchQuery = e.target.value.trim().toLowerCase();
            renderUserList(); 
        });
    }

    const filterSelect = document.getElementById('filterSelect');
    if (filterSelect) {
        filterSelect.addEventListener('change', (e) => {
            currentFilterStatus = e.target.value;
            renderUserList();
        });
    }

    // TỰ ĐỘNG CHÈN NÚT "GỬI TOÀN HỆ THỐNG"
    const toolbar = document.querySelector('.toolbar-user-modern');
    if (toolbar && !document.getElementById('btnNotifyAll')) {
        const notifyAllBtn = document.createElement('button');
        notifyAllBtn.id = 'btnNotifyAll';
        notifyAllBtn.className = 'btn-modern-action';
        notifyAllBtn.style.cssText = 'background: linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%); color: white; border: none; padding: 12px 20px; border-radius: 10px; font-weight: bold; cursor: pointer; white-space: nowrap; transition: 0.2s; box-shadow: 0 4px 10px rgba(139, 92, 246, 0.3);';
        notifyAllBtn.innerHTML = '<i class="fa-solid fa-bell-ring"></i> Gửi TB Toàn Hệ Thống';
        notifyAllBtn.onmouseover = () => notifyAllBtn.style.transform = 'translateY(-2px)';
        notifyAllBtn.onmouseout = () => notifyAllBtn.style.transform = 'translateY(0)';
        notifyAllBtn.onclick = () => openNotificationModal('ALL');
        toolbar.appendChild(notifyAllBtn);
    }

    const usersBody = document.getElementById('usersTableBody');
    if (usersBody) {
        usersBody.addEventListener('click', (e) => {
            const notifyBtn = e.target.closest('.btn-notify-user');
            if (notifyBtn) return openNotificationModal(notifyBtn.dataset.email);

            const vipBtn = e.target.closest('.btn-toggle-vip');
            if (vipBtn) return handleToggleVip(vipBtn.dataset.id, vipBtn.dataset.vip === 'true');

            const banBtn = e.target.closest('.btn-toggle-ban');
            if (banBtn) return handleToggleBan(banBtn.dataset.id, banBtn.dataset.banned === 'true');

            const historyBtn = e.target.closest('.btn-history');
            if (historyBtn) return handleViewHistory(historyBtn.dataset.email);
        });
    }

    const closeHistoryBtn = document.getElementById('closeHistoryModalBtn');
    if (closeHistoryBtn) {
        closeHistoryBtn.onclick = () => {
            document.getElementById('historyModal').style.display = "none";
        };
    }

    const closeNotifyBtn = document.getElementById('close-notification-modal');
    if (closeNotifyBtn) {
        closeNotifyBtn.onclick = () => {
            document.getElementById('notification-modal').style.display = 'none';
        };
    }
    
    const sendNotifyBtn = document.getElementById('btnSendNotification');
    if (sendNotifyBtn) {
        sendNotifyBtn.onclick = sendNotification;
    }
});
