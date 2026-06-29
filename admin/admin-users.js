// admin-users.js
import { db, showToast } from './admin-core.js';
import { 
    collection, onSnapshot, doc, updateDoc, query, where, getDocs 
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// Bộ nhớ đệm lưu trữ danh sách người dùng realtime từ Firestore
let cachedUsers = [];

// Các biến trạng thái bộ lọc tìm kiếm học viên toàn cục
let currentSearchQuery = "";
let currentFilterStatus = "all";

// =========================================================================
// 1. LẮNG NGHE DỮ LIỆU REAL-TIME TỪ FIRESTORE (ONSNAPSHOT)
// =========================================================================
export function initRealtimeUserListener() {
    const tbody = document.getElementById('usersTableBody');
    if (!tbody) return;

    // Thiết lập onSnapshot lắng nghe trực tiếp sự thay đổi của collection "users"
    onSnapshot(collection(db, "users"), (snapshot) => {
        cachedUsers = [];
        
        // Khai báo đầy đủ các biến đếm ngay đầu callback của onSnapshot
        let totalUsersCount = 0;
        let totalVipsCount = 0;
        let totalOnlineCount = 0;

        snapshot.forEach((docSnap) => {
            const user = docSnap.data();
            const userId = docSnap.id;
            const email = user.email || 'Chưa cập nhật';
            const isVip = user.isVip || false;
            const isBanned = user.isBanned || false;
            const isOnline = user.isOnline || false; // Trạng thái trực tuyến của học viên

            // Tăng tiến các biến đếm đã được khai báo chuẩn xác
            totalUsersCount++;
            if (isVip) totalVipsCount++; 
            if (isOnline && !isBanned) totalOnlineCount++; 

            // Phân loại trạng thái phục vụ bộ lọc Frontend nhanh chóng
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

        // Đồng bộ số liệu Real-time lên chính xác các thẻ Stats Cards ngoài giao diện HTML
        const totalUsersEl = document.getElementById('totalUsers');
        const totalVipUsersEl = document.getElementById('totalVipUsers');
        const totalOnlineUsersEl = document.getElementById('totalOnlineUsers');

        if (totalUsersEl) totalUsersEl.innerText = totalUsersCount;
        if (totalVipUsersEl) totalVipUsersEl.innerText = totalVipsCount;
        if (totalOnlineUsersEl) totalOnlineUsersEl.innerText = totalOnlineCount;

        // Tiến hành render kết xuất lại danh sách học viên ra bảng giao diện
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

// =========================================================================
// 2. HÀM KẾT XUẤT DANH SÁCH USER (TINH CHỈNH NÚT BẤM TINH TẾ)
// =========================================================================
export function renderUserList() {
    const tbody = document.getElementById('usersTableBody');
    if (!tbody) return;

    // Lọc dữ liệu bộ nhớ đệm theo từ khóa tìm kiếm và tình trạng bộ lọc dropdown
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

        // Tách chữ cái đầu tiên của địa chỉ Email để hiển thị Avatar vòng tròn đại diện
        const firstLetter = user.email.charAt(0);

        // Chuẩn hóa cấu trúc style và text cho hệ thống nút bấm hành động nâng cấp độc lập
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
                <div class="user-action-group" style="display: flex; gap: 6px; justify-content: center; flex-wrap: nowrap;">
                    
                    <button class="btn-user-action ${vipBtnClass} btn-toggle-vip" data-id="${user.userId}" data-vip="${user.isVip}" 
                            style="padding: 5px 10px; font-size: 12px; border-radius: 6px; display: inline-flex; align-items: center; gap: 4px; border: none; font-weight: 700; cursor: pointer; color: white;">
                        ${vipBtnText}
                    </button>
                    
                    <button class="btn-user-action btn-user-history btn-history" data-email="${user.email}" 
                            style="padding: 5px 10px; font-size: 12px; border-radius: 6px; display: inline-flex; align-items: center; gap: 4px; border: none; font-weight: 700; cursor: pointer; color: white; background-color: #3b82f6;">
                        📊 Lịch Sử
                    </button>
                    
                    <button class="btn-user-action ${banBtnClass} btn-toggle-ban" data-id="${user.userId}" data-banned="${user.isBanned}" 
                            style="padding: 5px 10px; font-size: 12px; border-radius: 6px; display: inline-flex; align-items: center; gap: 4px; border: none; font-weight: 700; cursor: pointer; color: white;">
                        ${banBtnText}
                    </button>
                </div>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

// Tạo bảng màu cố định tinh tế phối cho Avatar theo ký tự chữ cái đầu của Email
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

// =========================================================================
// 4. ĐĂNG KÝ CÁC SỰ KIỆN KHỞI TẠO BAN ĐẦU
// =========================================================================
document.addEventListener('DOMContentLoaded', () => {
    // Kích hoạt trình kết nối lắng nghe Real-time Firestore ngay khi DOM sẵn sàng
    initRealtimeUserListener();

    // Lắng nghe sự kiện tìm kiếm nhập ký tự Email học viên
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            currentSearchQuery = e.target.value.trim().toLowerCase();
            renderUserList(); // Chạy bộ lọc mượt mà cục bộ từ bộ nhớ đệm cachedUsers
        });
    }

    // Lắng nghe sự kiện thay đổi dropdown lọc phân loại người dùng
    const filterSelect = document.getElementById('filterSelect');
    if (filterSelect) {
        filterSelect.addEventListener('change', (e) => {
            currentFilterStatus = e.target.value;
            renderUserList();
        });
    }

    // Cơ chế Event Delegation xử lý tập trung toàn bộ hành động click trên thân bảng học viên
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

    // Cơ chế đóng cửa sổ Modal xem lịch sử điểm thi
    const closeHistoryBtn = document.getElementById('closeHistoryModalBtn');
    if (closeHistoryBtn) {
        closeHistoryBtn.onclick = () => {
            document.getElementById('historyModal').style.display = "none";
        };
    }
});
