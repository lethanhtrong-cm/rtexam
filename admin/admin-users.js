// admin-users.js
import { db, showToast } from './admin-core.js';
import { 
    collection, onSnapshot, doc, updateDoc, query, where, getDocs 
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// Bộ nhớ đệm lưu trữ danh sách người dùng realtime từ Firestore
let cachedUsers = [];

// Các biến trạng thái bộ lọc tìm kiếm học viên
let currentSearchQuery = "";
let currentFilterStatus = "all";

// =========================================================================
// 1. LẮNG NGHE DỮ LIỆU REAL-TIME TỪ FIRESTORE (ONSNAPSHOT)
// =========================================================================
export function initRealtimeUserListener() {
    const tbody = document.getElementById('usersTableBody');
    if (!tbody) return;

    // Thiết lập onSnapshot lắng nghe trực tiếp collection "users"
    onSnapshot(collection(db, "users"), (snapshot) => {
        cachedUsers = [];
        
        let totalUsersCount = 0;
        let totalVipCount = 0;
        let totalOnlineCount = 0;

        snapshot.forEach((docSnap) => {
            const user = docSnap.data();
            const userId = docSnap.id;
            const email = user.email || 'Chưa cập nhật';
            const isVip = user.isVip || false;
            const isBanned = user.isBanned || false;
            const isOnline = user.isOnline || false; // Trường trạng thái trực tuyến giả định

            totalUsersCount++;
            if (isVip && !isBanned) totalVipsCount++; // VIP hoạt động (không bị khóa)
            if (isVip) totalVipCount++;
            if (isOnline && !isBanned) totalOnlineCount++; // Đếm số người đang online thật

            // Phân loại trạng thái phục vụ bộ lọc Frontend
            let statusKey = 'normal';
            if (isBanned) statusKey = 'banned';
            else if (isVip) statusKey = 'vip';

            cachedUsers.push({
                userId: userId,
                email: email,
                isVip: isVip,
                isBanned: isBanned,
                isOnline: isOnline,
                statusKey: statusKey
            });
        });

        // Cập nhật số liệu Real-time lên 3 thẻ Stats Cards ngoài giao diện HTML
        const totalUsersEl = document.getElementById('totalUsers');
        const totalVipUsersEl = document.getElementById('totalVipUsers');
        const totalOnlineUsersEl = document.getElementById('totalOnlineUsers');

        if (totalUsersEl) totalUsersEl.innerText = totalUsersCount;
        if (totalVipUsersEl) totalVipUsersEl.innerText = totalVipCount;
        if (totalOnlineUsersEl) totalOnlineUsersEl.innerText = totalOnlineCount;

        // Tiến hành render vẽ lại bảng dữ liệu học viên
        renderUserList();
    }, (error) => {
        console.error("Lỗi lắng nghe dữ liệu users Real-time:", error);
        tbody.innerHTML = '<tr><td colspan="4" class="loading-text" style="color:red">❌ Lỗi kết nối đồng bộ học viên Real-time.</td></tr>';
    });
}

// =========================================================================
// 2. HÀM KẾT XUẤT DANH SÁCH USER (BỔ SUNG AVATAR & MODERN BUTTONS)
// =========================================================================
export function renderUserList() {
    const tbody = document.getElementById('usersTableBody');
    if (!tbody) return;

    // Lọc dữ liệu bộ nhớ đệm theo từ khóa tìm kiếm và trạng thái dropdown
    const filteredUsers = cachedUsers.filter(user => {
        const matchSearch = !currentSearchQuery || user.email.toLowerCase().includes(currentSearchQuery);
        const matchStatus = currentFilterStatus === "all" || user.statusKey === currentFilterStatus;
        return matchSearch && matchStatus;
    });

    tbody.innerHTML = '';
    let stt = 1;

    if (filteredUsers.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" class="empty-message">Không tìm thấy học viên nào khớp với bộ lọc hiện tại.</td></tr>';
        return;
    }

    // Vòng lặp render chuỗi HTML mới có chứa cấu trúc Avatar và nút bấm cao cấp
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

        // Tách chữ cái đầu tiên của Email để làm ký tự đại diện cho hình Avatar hình tròn
        const firstLetter = user.email.charAt(0);

        // Thiết lập trạng thái hiển thị và màu sắc riêng biệt cho hệ thống nút bấm hành động mới
        const vipBtnClass = user.isVip ? 'btn-user-vip-off' : 'btn-user-vip-on';
        const vipBtnText = user.isVip ? '💎 Tắt VIP' : '👑 Kích VIP';
        const banBtnClass = user.isBanned ? 'btn-user-unban' : 'btn-user-ban';
        const banBtnText = user.isBanned ? '🔓 Mở Khóa' : '🚫 Khóa TK';

        const tr = document.createElement('tr');
        tr.className = 'user-row';
        
        tr.innerHTML = `
            <td class="text-center" style="font-weight: 600; color: #64748b;">${stt++}</td>
            <td>
                <div class="user-email-cell">
                    <div class="user-avatar-placeholder" style="background-color: ${getAvatarColor(firstLetter)};">
                        ${firstLetter}
                    </div>
                    <div style="font-weight: 600; color: #0f172a;">${user.email}</div>
                </div>
            </td>
            <td class="text-center"><span class="badge ${badgeClass}">${badgeText}</span></td>
            <td class="text-center">
                <div class="user-action-group">
                    <button class="btn-user-action ${vipBtnClass} btn-toggle-vip" data-id="${user.userId}" data-vip="${user.isVip}">
                        ${vipBtnText}
                    </button>
                    <button class="btn-user-action btn-user-history btn-history" data-email="${user.email}">
                        📊 Lịch Sử
                    </button>
                    <button class="btn-user-action ${banBtnClass} btn-toggle-ban" data-id="${user.userId}" data-banned="${user.isBanned}">
                        ${banBtnText}
                    </button>
                </div>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

// Hàm phụ hỗ trợ tạo màu nền ngẫu nhiên/cố định cho Avatar theo chữ cái đầu của email
function getAvatarColor(letter) {
    const charCode = letter.toUpperCase().charCodeAt(0) || 65;
    const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#14b8a6'];
    return colors[charCode % colors.length];
}

// =========================================================================
// 3. XỬ LÝ NGHIỆP VỤ TÀI KHOẢN (VIP, LOCK/BAN, XEM LỊCH SỬ THI)
// =========================================================================
async function handleToggleVip(userId, currentVipStatus) {
    try {
        const userRef = doc(db, "users", userId);
        const newVipStatus = !currentVipStatus;
        await updateDoc(userRef, { isVip: newVipStatus });
        showToast(`Đã ${newVipStatus ? 'kích hoạt' : 'hủy quyền'} tài khoản VIP thành công!`, "success");
        // Không cần gọi load lại, onSnapshot tự động cập nhật UI realtime
    } catch (error) {
        showToast("Lỗi cập nhật trạng thái quyền VIP học viên", "error");
    }
}

async function handleToggleBan(userId, currentBannedStatus) {
    const actionText = currentBannedStatus ? 'mở khóa' : 'khóa viễn viễn';
    if (!confirm(`Hệ thống cảnh báo: Bạn có chắc chắn muốn thực hiện lệnh ${actionText} tài khoản học sinh này?`)) return;

    try {
        const userRef = doc(db, "users", userId);
        const newBannedStatus = !currentBannedStatus;
        await updateDoc(userRef, { isBanned: newBannedStatus });
        showToast(`Đã thực thi lệnh ${currentBannedStatus ? 'mở khóa' : 'khóa'} tài khoản học viên!`, "success");
    } catch (error) {
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
            historyBody.innerHTML = '<tr><td colspan="3" class="empty-message">Học viên này chưa thực hiện bài thi trắc nghiệm nào trên hệ thống.</td></tr>';
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
        console.error("Lỗi khi truy vấn kết quả thi results:", error);
        historyBody.innerHTML = '<tr><td colspan="3" class="empty-message" style="color:red">❌ Thất bại khi tải lịch sử bài làm.</td></tr>';
    }
}

// =========================================================================
// 4. ĐĂNG KÝ CÁC SỰ KIỆN KHỞI TẠO BAN ĐẦU
// =========================================================================
document.addEventListener('DOMContentLoaded', () => {
    // Khởi động trình kết nối Real-time lắng nghe tự động Firestore
    initRealtimeUserListener();

    // Sự kiện nhập từ khóa tìm kiếm Email thành viên
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            currentSearchQuery = e.target.value.trim().toLowerCase();
            renderUserList(); // Chạy bộ lọc cục bộ tức thì
        });
    }

    // Sự kiện thay đổi dropdown phân loại trạng thái học viên
    const filterSelect = document.getElementById('filterSelect');
    if (filterSelect) {
        filterSelect.addEventListener('change', (e) => {
            currentFilterStatus = e.target.value;
            renderUserList();
        });
    }

    // Áp dụng kỹ thuật Event Delegation (Ủy quyền sự kiện) trên bảng danh sách User
    const usersBody = document.getElementById('usersTableBody');
    if (usersBody) {
        usersBody.addEventListener('click', (e) => {
            const vipBtn = e.target.closest('.btn-toggle-vip');
            if (vipBtn) return handleToggleVip(vipBtn.dataset.id, vipBtn.dataset.vip === 'true');

            const banBtn = e.target.closest('.btn-toggle-ban');
            if (banBtn) return handleToggleBan(banBtn.dataset.id, banBtn.dataset.banned === 'true');

            const historyBtn = e.target.closest('.btn-history');
            if (historyBtn) return handleViewHistory(historyBtn.dataset.email);
        });
    }

    // Sự kiện đóng Modal xem lịch sử điểm thi của học sinh
    const closeHistoryBtn = document.getElementById('closeHistoryModalBtn');
    if (closeHistoryBtn) {
        closeHistoryBtn.onclick = () => {
            document.getElementById('historyModal').style.display = "none";
        };
    }
});
