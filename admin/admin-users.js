// admin-users.js
import { db, showToast } from './admin-core.js';
import { 
    collection, getDocs, doc, updateDoc, query, where 
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// =========================================================================
// 1. TẢI VÀ THỐNG KÊ DANH SÁCH NGƯỜI DÙNG
// =========================================================================
export async function loadUsers() {
    const tbody = document.getElementById('usersTableBody');
    if (!tbody) return;

    try {
        tbody.innerHTML = '<tr><td colspan="4" class="loading-text">⏳ Đang tải dữ liệu từ Firestore...</td></tr>';
        
        const usersCol = collection(db, "users");
        const userSnapshot = await getDocs(usersCol);
        
        let totalUsers = 0;
        let totalVips = 0;
        let htmlContent = '';

        if (userSnapshot.empty) {
            tbody.innerHTML = '<tr><td colspan="4" class="loading-text">Chưa có dữ liệu người dùng nào.</td></tr>';
            document.getElementById('totalUsers').innerText = 0;
            document.getElementById('totalVipUsers').innerText = 0;
            return;
        }

        userSnapshot.forEach((docSnap) => {
            const user = docSnap.data();
            const userId = docSnap.id;
            const email = user.email || 'Chưa cập nhật';
            const isVip = user.isVip || false;
            const isBanned = user.isBanned || false;

            totalUsers++;
            // Nếu bị khóa (Banned) thì không tính là VIP đang hoạt động
            if (isVip && !isBanned) totalVips++; 

            // Thiết lập trạng thái giao diện (Ưu tiên hiển thị trạng thái Bị Khóa)
            let badgeClass = 'badge-normal';
            let badgeText = 'Thường';
            let statusKey = 'normal'; // Dùng cho bộ lọc frontend

            if (isBanned) {
                badgeClass = 'badge-banned';
                badgeText = 'Bị Khóa';
                statusKey = 'banned';
            } else if (isVip) {
                badgeClass = 'badge-vip';
                badgeText = 'VIP 👑';
                statusKey = 'vip';
            }

            // Thiết lập class và text cho nút Khóa/Mở khóa
            const banBtnClass = isBanned ? 'btn-unban' : 'btn-ban';
            const banBtnText = isBanned ? 'Mở Khóa' : 'Khóa TK';

            // Khởi tạo dòng TR (Tích hợp attribute data-email và data-status để lọc)
            htmlContent += `
                <tr class="user-row" data-email="${email.toLowerCase()}" data-status="${statusKey}">
                    <td class="text-center">${totalUsers}</td>
                    <td><strong>${email}</strong></td>
                    <td class="text-center"><span class="badge ${badgeClass}">${badgeText}</span></td>
                    <td class="text-center">
                        <div class="action-buttons">
                            <button class="btn-sm btn-toggle-vip" data-id="${userId}" data-vip="${isVip}">
                                ${isVip ? 'Tắt VIP' : 'Bật VIP'}
                            </button>
                            <button class="btn-sm btn-history" data-email="${email}">
                                Xem Lịch Sử
                            </button>
                            <button class="btn-sm ${banBtnClass} btn-toggle-ban" data-id="${userId}" data-banned="${isBanned}">
                                ${banBtnText}
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        });

        tbody.innerHTML = htmlContent;
        document.getElementById('totalUsers').innerText = totalUsers;
        document.getElementById('totalVipUsers').innerText = totalVips;

        // Chạy lại bộ lọc đề phòng trường hợp admin đang gõ từ khóa tìm kiếm
        filterTable();

    } catch (error) {
        console.error("Lỗi khi tải users: ", error);
        tbody.innerHTML = '<tr><td colspan="4" class="loading-text" style="color:red">❌ Lỗi tải dữ liệu người dùng.</td></tr>';
        showToast("Không thể tải danh sách người dùng", "error");
    }
}

// =========================================================================
// 2. BỘ LỌC TÌM KIẾM THEO TỪ KHÓA & TRẠNG THÁI (FRONTEND REALTIME)
// =========================================================================
function filterTable() {
    const searchInput = document.getElementById('searchInput');
    const filterSelect = document.getElementById('filterSelect');
    if (!searchInput || !filterSelect) return;

    const searchText = searchInput.value.toLowerCase();
    const filterStatus = filterSelect.value;
    const rows = document.querySelectorAll('.user-row');

    rows.forEach(row => {
        const email = row.dataset.email || '';
        const status = row.dataset.status || '';

        const matchSearch = email.includes(searchText);
        const matchStatus = (filterStatus === 'all') || (status === filterStatus);

        if (matchSearch && matchStatus) {
            row.style.display = '';
        } else {
            row.style.display = 'none';
        }
    });
}

// =========================================================================
// 3. CÁC HÀM XỬ LÝ SỰ KIỆN (VIP, BAN/UNBAN, XEM LỊCH SỬ THI)
// =========================================================================
async function handleToggleVip(userId, currentVipStatus) {
    try {
        const userRef = doc(db, "users", userId);
        const newVipStatus = !currentVipStatus;
        
        await updateDoc(userRef, { isVip: newVipStatus });
        showToast(`Đã ${newVipStatus ? 'cấp' : 'hủy'} quyền VIP thành công!`, "success");
        loadUsers();
    } catch (error) {
        console.error("Lỗi khi cập nhật VIP: ", error);
        showToast("Lỗi khi cập nhật trạng thái VIP", "error");
    }
}

async function handleToggleBan(userId, currentBannedStatus) {
    const actionText = currentBannedStatus ? 'mở khóa' : 'khóa';
    if (!confirm(`Bạn có chắc chắn muốn ${actionText} tài khoản này không?`)) return;

    try {
        const userRef = doc(db, "users", userId);
        const newBannedStatus = !currentBannedStatus;
        
        await updateDoc(userRef, { isBanned: newBannedStatus });
        showToast(`Đã ${actionText} tài khoản thành công!`, "success");
        loadUsers();
    } catch (error) {
        console.error("Lỗi khi khóa/mở khóa TK: ", error);
        showToast("Lỗi khi cập nhật trạng thái Khóa", "error");
    }
}

async function handleViewHistory(userEmail) {
    const modal = document.getElementById('historyModal');
    const historyBody = document.getElementById('historyTableBody');
    const modalTitle = document.getElementById('modalTitle');
    
    if (!modal || !historyBody) return;
    
    modalTitle.innerText = `Lịch sử thi: ${userEmail}`;
    historyBody.innerHTML = '<tr><td colspan="3" class="loading-text">⏳ Đang tìm kiếm kết quả thi...</td></tr>';
    modal.style.display = "block";

    try {
        const resultsRef = collection(db, "results");
        const q = query(resultsRef, where("email", "==", userEmail));
        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
            historyBody.innerHTML = '<tr><td colspan="3" class="empty-message">Người dùng này chưa tham gia lượt thi nào.</td></tr>';
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
        console.error("Lỗi khi lấy lịch sử thi: ", error);
        historyBody.innerHTML = '<tr><td colspan="3" class="empty-message" style="color:red">❌ Lỗi tải dữ liệu lịch sử thi.</td></tr>';
    }
}

// =========================================================================
// 4. LẮNG NGHE SỰ KIỆN BAN ĐẦU
// =========================================================================
document.addEventListener('DOMContentLoaded', () => {
    loadUsers();

    // Sự kiện gõ từ khóa & đổi dropdown lọc dữ liệu
    const searchInput = document.getElementById('searchInput');
    const filterSelect = document.getElementById('filterSelect');
    if (searchInput) searchInput.addEventListener('input', filterTable);
    if (filterSelect) filterSelect.addEventListener('change', filterTable);

    // Sử dụng Event Delegation tối ưu hóa sự kiện Click cho bảng User
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

    // Sự kiện đóng Modal Lịch sử
    const closeHistoryBtn = document.getElementById('closeHistoryModalBtn');
    if (closeHistoryBtn) {
        closeHistoryBtn.onclick = () => {
            document.getElementById('historyModal').style.display = "none";
        };
    }
});