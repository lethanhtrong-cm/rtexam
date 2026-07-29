// ==========================================
// FILE: admin-user/admin-users.js
// QUẢN LÝ GIAO DIỆN CHÍNH, BẢNG VÀ LOGIC TỔNG HỢP
// ==========================================
import { db, showToast } from '../admin-core.js';
import { 
    collection, onSnapshot, doc, updateDoc, query, where, getDocs
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// IMPORT CÁC MODULE ĐÃ ĐƯỢC PHÂN TÁCH (Cùng thư mục admin-user)
import { getCostBadgeHtml } from './admin-billing.js';
import { handleViewHistory } from './admin-history.js';
import { openNotificationModal, sendNotification } from './admin-users-notify.js';

let cachedUsers = [];
let currentSearchQuery = "";
let currentFilterStatus = "all";
let isUserListLoaded = false; // CỜ CACHE CHỐNG TRÀN QUOTA DỮ LIỆU USER

let currentPage = 1;
const itemsPerPage = 20;
let selectedUserIds = new Set(); 
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
        if (isUserListLoaded) renderUserList(); 
    }, (error) => {
        console.error("Lỗi khi tải yêu cầu thanh toán:", error);
    });
}

function formatDateTime(timestamp) {
    if (!timestamp) return '---';
    const date = (typeof timestamp.toDate === 'function') ? timestamp.toDate() : new Date(timestamp);
    if (isNaN(date.getTime())) return '---';
    return date.toLocaleDateString('vi-VN') + ' ' + date.toLocaleTimeString('vi-VN', {hour: '2-digit', minute:'2-digit'});
}

// Bổ sung tham số forceRefresh để phân luồng tải
export async function loadUserList(forceRefresh = false) {
    const tbody = document.getElementById('usersTableBody');
    if (!tbody) return;

    // NẾU KHÔNG ÉP TẢI LẠI VÀ ĐÃ CÓ DATA -> VẼ LUÔN TỪ CACHE, KHÔNG ĐỌC DB
    if (!forceRefresh && isUserListLoaded) {
        renderUserList();
        return;
    }

    tbody.innerHTML = '<tr><td colspan="5" class="loading-text">⏳ Đang tải dữ liệu học viên...</td></tr>';

    try {
        const snapshot = await getDocs(collection(db, "users"));
        cachedUsers = [];
        
        let totalUsersCount = 0;
        let totalVipsCount = 0;

        snapshot.forEach((docSnap) => {
            const user = docSnap.data();
            const userId = docSnap.id;
            const email = user.email || 'Chưa cập nhật';
            const isVip = user.isVip || false;
            const isBanned = user.isBanned || false;
            
            const isOnline = (user.isOnline === true || user.isOnline === "true"); 
            const totalTokensUsed = user.totalTokensUsed || 0;
            const examStatus = user.examStatus || 'none'; // ĐỌC TRẠNG THÁI THI TỪ DB

            // Xử lý bù đắp ngày giờ (Fix lỗi acc cũ)
            let createdAtRaw = user.firstLogin || user.creationTime || user.createdAt || user.timestamp;
            if (!createdAtRaw) {
                createdAtRaw = Date.now();
                updateDoc(doc(db, "users", userId), { createdAt: createdAtRaw }).catch(e=>e);
            }
            let createdAtMs = (typeof createdAtRaw.toDate === 'function') ? createdAtRaw.toDate().getTime() : new Date(createdAtRaw).getTime();

            totalUsersCount++;
            if (isVip) totalVipsCount++; 

            let statusKey = 'normal';
            if (isBanned) statusKey = 'banned';
            else if (isVip) statusKey = 'vip';

            cachedUsers.push({
                userId: userId,
                email: email,
                isVip: isVip,
                isBanned: isBanned,
                isOnline: isOnline,
                examStatus: examStatus, // LƯU VÀO CACHE BỘ NHỚ TẠM
                statusKey: statusKey,
                totalTokensUsed: totalTokensUsed,
                createdAtMs: createdAtMs, 
                createdAt: createdAtRaw,
                vipActivationDate: user.vipActivationDate || null,
                vipExpirationDate: user.vipExpirationDate || null
            });
        });

        const totalUsersEl = document.getElementById('totalUsers');
        const totalVipUsersEl = document.getElementById('totalVipUsers');

        if (totalUsersEl) totalUsersEl.innerText = totalUsersCount;
        if (totalVipUsersEl) totalVipUsersEl.innerText = totalVipsCount;

        isUserListLoaded = true; // Lưu cờ thành công
        selectedUserIds.clear();
        currentPage = 1;
        injectTableHeadersAndToolbar(); 
        
        renderUserList();
    } catch (error) {
        console.error("Lỗi kết nối Firestore khi tải danh sách người dùng:", error);
        isUserListLoaded = false;
        tbody.innerHTML = `
            <tr>
                <td colspan="5" class="loading-text" style="color: #ef4444; font-weight: 500;">
                    ❌ Có lỗi xảy ra khi tải dữ liệu từ Cloud Firestore.<br>
                    <span style="font-size: 12px; color: #64748b;">Vui lòng kiểm tra kết nối mạng hoặc Quota Firebase.</span>
                </td>
            </tr>
        `;
        showToast("Không thể tải danh sách học viên", "error");
    }
}

function injectTableHeadersAndToolbar() {
    const table = document.querySelector('#usersTableBody').closest('table');
    const theadTr = table.querySelector('thead tr');
    
    if (theadTr && !theadTr.querySelector('.th-bulk-checkbox')) {
        const th = document.createElement('th');
        th.className = 'text-center th-bulk-checkbox';
        th.style.width = '5%';
        th.innerHTML = '<input type="checkbox" id="selectAllUsers" style="cursor:pointer; transform: scale(1.2);">';
        theadTr.insertBefore(th, theadTr.firstChild);

        const ths = theadTr.querySelectorAll('th');
        if(ths.length > 1) ths[1].style.width = '5%'; 
        if(ths.length > 2) ths[2].style.width = '40%';
        if(ths.length > 3) ths[3].style.width = '15%';
        if(ths.length > 4) ths[4].style.width = '35%';
    }

    const selectAllCb = document.getElementById('selectAllUsers');
    if (selectAllCb) {
        selectAllCb.onclick = (e) => {
            const isChecked = e.target.checked;
            const checkboxes = document.querySelectorAll('.user-row-checkbox');
            checkboxes.forEach(cb => {
                cb.checked = isChecked;
                if (isChecked) selectedUserIds.add(cb.dataset.id);
                else selectedUserIds.delete(cb.dataset.id);
            });
            updateBulkActionBar();
        };
    }

    const tableContainer = table.closest('.table-container');
    if (tableContainer && !document.getElementById('bulk-action-bar')) {
        const bulkBar = document.createElement('div');
        bulkBar.id = 'bulk-action-bar';
        bulkBar.style.cssText = 'display: none; justify-content: space-between; align-items: center; background: #eff6ff; padding: 10px 15px; border-radius: 8px; margin-bottom: 15px; border: 1px solid #bfdbfe; box-shadow: 0 2px 4px rgba(0,0,0,0.02);';
        
        bulkBar.innerHTML = `
            <div style="font-weight: 600; color: #1e3a8a; font-size: 14px;">
                Đã chọn: <span id="bulk-selected-count" style="color: #ef4444; font-size: 16px;">0</span> tài khoản
            </div>
            <div style="display: flex; gap: 10px;">
                <button id="btnBulkNotify" class="btn-modern-action" style="background: #8b5cf6; color: white; border: none; padding: 6px 12px; border-radius: 6px; cursor: pointer; font-size: 12.5px;"><i class="fa-solid fa-bell"></i> TB Hàng Loạt</button>
                <button id="btnBulkVip" class="btn-modern-action" style="background: #f59e0b; color: white; border: none; padding: 6px 12px; border-radius: 6px; cursor: pointer; font-size: 12.5px;"><i class="fa-solid fa-crown"></i> Kích VIP Loạt</button>
                <button id="btnBulkBan" class="btn-modern-action" style="background: #ef4444; color: white; border: none; padding: 6px 12px; border-radius: 6px; cursor: pointer; font-size: 12.5px;"><i class="fa-solid fa-ban"></i> Khóa Loạt</button>
            </div>
        `;
        tableContainer.parentNode.insertBefore(bulkBar, tableContainer);

        document.getElementById('btnBulkVip').onclick = () => handleBulkAction('vip');
        document.getElementById('btnBulkBan').onclick = () => handleBulkAction('ban');
        document.getElementById('btnBulkNotify').onclick = () => handleBulkAction('notify');
    }
}

function updateBulkActionBar() {
    const bulkBar = document.getElementById('bulk-action-bar');
    const countEl = document.getElementById('bulk-selected-count');
    if (bulkBar && countEl) {
        if (selectedUserIds.size > 0) {
            bulkBar.style.display = 'flex';
            countEl.innerText = selectedUserIds.size;
        } else {
            bulkBar.style.display = 'none';
        }
    }
}

export function renderUserList() {
    const tbody = document.getElementById('usersTableBody');
    if (!tbody) return;

    let sortedUsers = [...cachedUsers].sort((a, b) => b.createdAtMs - a.createdAtMs);

    const filteredUsers = sortedUsers.filter(user => {
        const matchSearch = !currentSearchQuery || user.email.toLowerCase().includes(currentSearchQuery);
        const matchStatus = currentFilterStatus === "all" || user.statusKey === currentFilterStatus;
        return matchSearch && matchStatus;
    });

    tbody.innerHTML = '';
    const selectAllCb = document.getElementById('selectAllUsers');
    if (selectAllCb) selectAllCb.checked = false; 
    
    if (filteredUsers.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="empty-message">Không tìm thấy thành viên nào khớp với điều kiện tìm kiếm.</td></tr>';
        renderPagination(0);
        return;
    }

    const totalItems = filteredUsers.length;
    const totalPages = Math.ceil(totalItems / itemsPerPage);
    if (currentPage < 1) currentPage = 1;
    if (currentPage > totalPages) currentPage = totalPages;

    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const paginatedUsers = filteredUsers.slice(startIndex, endIndex);

    let stt = startIndex + 1;

    paginatedUsers.forEach(user => {
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
        
        const onlineStatusHtml = user.isOnline 
            ? `<span title="Đang trực tuyến" style="display: inline-block; width: 10px; height: 10px; background-color: #10b981; border-radius: 50%; margin-left: 8px; box-shadow: 0 0 6px rgba(16,185,129,0.5);"></span>` 
            : `<span title="Ngoại tuyến" style="display: inline-block; width: 10px; height: 10px; background-color: #cbd5e1; border-radius: 50%; margin-left: 8px;"></span>`;

        // HTML HIỂN THỊ TRẠNG THÁI ĐANG THI
        const testingBadgeHtml = user.examStatus === 'testing'
            ? `<span style="font-size: 11px; color: #d97706; font-weight: 700; margin-left: 8px; display: inline-block; background: #fef3c7; padding: 2px 6px; border-radius: 6px;"><i class="fa-solid fa-pen-clip"></i> Đang thi</span>`
            : '';

        const hasPendingRequest = pendingVIPRequests.has(user.userId);
        const pendingBadge = hasPendingRequest 
            ? `<span style="background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); color: white; margin-left: 8px; font-size: 11px; padding: 2px 8px; border-radius: 12px; font-weight: bold; box-shadow: 0 2px 4px rgba(239, 68, 68, 0.4); animation: pulse 2s infinite;">💸 Báo Đã CK</span>` 
            : '';

        const costBadgeHtml = getCostBadgeHtml(user.totalTokensUsed);

        let datesHtml = `<div style="font-size: 11.5px; color: #64748b; margin-top: 5px;">`;
        const regDateDisplay = user.createdAt ? formatDateTime(user.createdAt) : '---';
        datesHtml += `<div><i class="fa-regular fa-calendar-plus" style="margin-right:4px;"></i>Ngày ĐK: <strong>${regDateDisplay}</strong></div>`;
        
        if (user.isVip) {
            let remainingText = '';
            let expDisplay = '---';
            let actDisplay = '---';
            
            if (user.vipExpirationDate) {
                expDisplay = formatDateTime(user.vipExpirationDate);
                const now = Date.now();
                const expMs = (typeof user.vipExpirationDate.toDate === 'function') ? user.vipExpirationDate.toDate().getTime() : new Date(user.vipExpirationDate).getTime();
                const diff = expMs - now;
                if (diff > 0) {
                    const daysLeft = Math.ceil(diff / (1000 * 60 * 60 * 24));
                    remainingText = `<span style="color: #10b981; font-weight: bold;">(Còn ${daysLeft} ngày)</span>`;
                } else {
                    remainingText = `<span style="color: #ef4444; font-weight: bold;">(Đã hết hạn)</span>`;
                }
            } else {
                remainingText = `<span style="color: #f59e0b; font-weight: bold; font-style: italic;">(Cần Tắt/Bật lại VIP để tạo ngày)</span>`;
            }
            
            if (user.vipActivationDate) actDisplay = formatDateTime(user.vipActivationDate);
            
            datesHtml += `<div style="margin-top: 2px;"><i class="fa-solid fa-crown" style="margin-right:4px; color:#f59e0b;"></i>Kích hoạt: <strong>${actDisplay}</strong></div>`;
            datesHtml += `<div style="margin-top: 2px;"><i class="fa-regular fa-clock" style="margin-right:4px;"></i>Hết hạn: <strong>${expDisplay}</strong> ${remainingText}</div>`;
        }
        datesHtml += `</div>`;

        const vipBtnClass = user.isVip ? 'btn-user-vip-off' : 'btn-user-vip-on';
        const vipBtnText = user.isVip ? '💎 Tắt VIP' : '👑 Kích VIP';
        const banBtnClass = user.isBanned ? 'btn-user-unban' : 'btn-user-ban';
        const banBtnText = user.isBanned ? '🔓 Mở Khóa' : '🚫 Khóa TK';
        
        const baseBtnStyle = "padding: 6px 12px; font-size: 12.5px; border-radius: 8px; display: inline-flex; align-items: center; gap: 5px; border: none; font-weight: 600; cursor: pointer; transition: all 0.2s ease; color: white;";
        const notifyStyle = `${baseBtnStyle} background: linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%); box-shadow: 0 2px 5px rgba(139,92,246,0.3);`;
        const vipStyle = user.isVip ? `${baseBtnStyle} background: #94a3b8; box-shadow: 0 2px 5px rgba(148,163,184,0.3);` : `${baseBtnStyle} background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); box-shadow: 0 2px 5px rgba(245,158,11,0.3);`; 
        const historyStyle = `${baseBtnStyle} background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); box-shadow: 0 2px 5px rgba(59,130,246,0.3);`;
        const banStyle = user.isBanned ? `${baseBtnStyle} background: linear-gradient(135deg, #10b981 0%, #059669 100%); box-shadow: 0 2px 5px rgba(16,185,129,0.3);` : `${baseBtnStyle} background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); box-shadow: 0 2px 5px rgba(239,68,68,0.3);`; 
        const hoverEffect = `onmouseover="this.style.transform='translateY(-1.5px)'" onmouseout="this.style.transform='translateY(0)'"`;

        const isChecked = selectedUserIds.has(user.userId) ? 'checked' : '';

        const tr = document.createElement('tr');
        tr.className = 'user-row';
        tr.style.transition = "background-color 0.2s ease";
        tr.style.backgroundColor = hasPendingRequest ? '#fff1f2' : 'transparent';
        tr.onmouseover = () => tr.style.backgroundColor = hasPendingRequest ? '#ffe4e6' : '#f8fafc';
        tr.onmouseout = () => tr.style.backgroundColor = hasPendingRequest ? '#fff1f2' : 'transparent';
        
        tr.innerHTML = `
            <td class="text-center">
                <input type="checkbox" class="user-row-checkbox" data-id="${user.userId}" data-email="${user.email}" ${isChecked} style="cursor:pointer; transform: scale(1.2);">
            </td>
            <td class="text-center" style="font-weight: 600; color: #64748b;">${stt++}</td>
            <td>
                <div class="user-email-cell" style="align-items: flex-start;">
                    <div class="user-avatar-placeholder" style="background-color: ${getAvatarColor(firstLetter)}; margin-top: 5px;">
                        ${firstLetter}
                    </div>
                    <div>
                        <div style="font-weight: 600; color: #0f172a; font-size: 14px; display: flex; align-items: center; flex-wrap: wrap;">
                            ${user.email} ${onlineStatusHtml} ${testingBadgeHtml} ${pendingBadge} ${costBadgeHtml}
                        </div>
                        ${datesHtml}
                    </div>
                </div>
            </td>
            <td class="text-center"><span class="badge ${badgeClass}" style="box-shadow: 0 1px 2px rgba(0,0,0,0.05);">${badgeText}</span></td>
            <td class="text-center">
                <div class="user-action-group" style="display: flex; gap: 8px; justify-content: center; flex-wrap: nowrap;">
                    <button class="btn-user-action btn-notify-user" data-email="${user.email}" style="${notifyStyle}" ${hoverEffect} title="Gửi TB">🔔 Gửi</button>
                    <button class="btn-user-action ${vipBtnClass} btn-toggle-vip" data-id="${user.userId}" data-vip="${user.isVip}" style="${vipStyle}" ${hoverEffect}>${vipBtnText}</button>
                    <button class="btn-user-action btn-user-history btn-history" data-email="${user.email}" style="${historyStyle}" ${hoverEffect}>📊 Lịch Sử</button>
                    <button class="btn-user-action ${banBtnClass} btn-toggle-ban" data-id="${user.userId}" data-banned="${user.isBanned}" style="${banStyle}" ${hoverEffect}>${banBtnText}</button>
                </div>
            </td>
        `;
        tbody.appendChild(tr);
    });

    renderPagination(totalPages);
    updateBulkActionBar();
}

function renderPagination(totalPages) {
    let paginationContainer = document.getElementById('user-pagination-container');
    const tableContainer = document.querySelector('#usersTableBody').closest('.table-container');
    
    if (!paginationContainer) {
        paginationContainer = document.createElement('div');
        paginationContainer.id = 'user-pagination-container';
        paginationContainer.style.cssText = 'display: flex; justify-content: center; align-items: center; gap: 10px; margin-top: 20px; padding-bottom: 10px;';
        tableContainer.parentNode.insertBefore(paginationContainer, tableContainer.nextSibling);
    }

    paginationContainer.innerHTML = ''; 
    if (totalPages <= 1) return; 

    const prevBtn = document.createElement('button');
    prevBtn.innerHTML = '<i class="fa-solid fa-arrow-left"></i> Trước';
    prevBtn.className = 'btn-modern-action';
    prevBtn.style.padding = '8px 16px';
    prevBtn.disabled = currentPage === 1;
    if (currentPage === 1) prevBtn.style.opacity = '0.4';
    prevBtn.onclick = () => {
        if (currentPage > 1) { currentPage--; renderUserList(); }
    };
    paginationContainer.appendChild(prevBtn);

    const pageInfo = document.createElement('div');
    pageInfo.innerHTML = `Trang <strong style="color:#3b82f6;">${currentPage}</strong> / ${totalPages}`;
    pageInfo.style.cssText = 'font-size: 14px; font-weight: 600; color: #475569; background: #f8fafc; padding: 8px 20px; border-radius: 10px; border: 1px solid #e2e8f0; margin: 0 5px;';
    paginationContainer.appendChild(pageInfo);

    const nextBtn = document.createElement('button');
    nextBtn.innerHTML = 'Tiếp <i class="fa-solid fa-arrow-right"></i>';
    nextBtn.className = 'btn-modern-action';
    nextBtn.style.padding = '8px 16px';
    nextBtn.disabled = currentPage === totalPages;
    if (currentPage === totalPages) nextBtn.style.opacity = '0.4';
    nextBtn.onclick = () => {
        if (currentPage < totalPages) { currentPage++; renderUserList(); }
    };
    paginationContainer.appendChild(nextBtn);
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
        
        let updates = { isVip: newVipStatus };
        if (newVipStatus) {
            updates.vipActivationDate = Date.now();
            updates.vipExpirationDate = Date.now() + (30 * 24 * 60 * 60 * 1000); 
        }

        await updateDoc(userRef, updates);
        
        if (newVipStatus) {
            const q = query(collection(db, "payment_requests"), where("uid", "==", userId), where("status", "==", "pending"));
            const snapshot = await getDocs(q);
            snapshot.forEach(async (docSnap) => {
                await updateDoc(docSnap.ref, { status: "completed" });
            });
        }
        showToast(`Đã ${newVipStatus ? 'kích hoạt' : 'hủy quyền'} tài khoản VIP thành công!`, "success");
        loadUserList(true); // GỌI API LÀM MỚI KHI THAY ĐỔI
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
        loadUserList(true); // GỌI API LÀM MỚI KHI THAY ĐỔI
    } catch (error) {
        console.error("Lỗi thay đổi trạng thái khóa:", error);
        showToast("Lỗi thay đổi trạng thái khóa tài khoản", "error");
    }
}

async function handleBulkAction(actionType) {
    if (selectedUserIds.size === 0) return;
    
    if (actionType === 'notify') {
        const emails = [];
        selectedUserIds.forEach(id => {
            const u = cachedUsers.find(user => user.userId === id);
            if(u) emails.push(u.email);
        });
        openNotificationModal(emails.join(', '));
        return;
    }

    const count = selectedUserIds.size;
    let isVipAction = false, isBanAction = false;

    if (actionType === 'vip') {
        if(!confirm(`Bạn có chắc muốn ĐẢO NGƯỢC trạng thái VIP cho ${count} tài khoản đã chọn? (Tài khoản đang Thường sẽ thành VIP 30 ngày, đang VIP sẽ bị Tắt)`)) return;
        isVipAction = true;
    } else if (actionType === 'ban') {
        if(!confirm(`Bạn có chắc muốn ĐẢO NGƯỢC trạng thái KHÓA cho ${count} tài khoản đã chọn? (TK bình thường sẽ bị khóa, TK bị khóa sẽ mở lại)`)) return;
        isBanAction = true;
    }

    const promises = [];
    selectedUserIds.forEach(id => {
        const userRef = doc(db, "users", id);
        const u = cachedUsers.find(user => user.userId === id);
        if (!u) return;
        
        let updates = {};
        if (isVipAction) {
            const newVipStatus = !u.isVip;
            updates.isVip = newVipStatus;
            if (newVipStatus) {
                updates.vipActivationDate = Date.now();
                updates.vipExpirationDate = Date.now() + (30 * 24 * 60 * 60 * 1000);
            }
        }
        if (isBanAction) {
            updates.isBanned = !u.isBanned;
        }
        promises.push(updateDoc(userRef, updates));
    });

    try {
        await Promise.all(promises);
        showToast(`Đã thực thi thao tác thành công trên ${count} tài khoản!`, "success");
        selectedUserIds.clear();
        loadUserList(true); // GỌI API LÀM MỚI KHI THAY ĐỔI HÀNG LOẠT
    } catch(err) {
        console.error("Lỗi bulk actions:", err);
        showToast("Lỗi khi thực thi hàng loạt", "error");
    }
}

document.addEventListener('componentsLoaded', () => {
    loadUserList(); 
    initRealtimePaymentListener();

    const sidebarMenuItems = document.querySelectorAll('.menu-item');
    sidebarMenuItems.forEach(item => {
        item.addEventListener('click', (e) => {
            const target = item.getAttribute('data-target');
            if (target === 'tab-users') {
                loadUserList(false); // CHỈ VẼ UI TỪ CACHE, KHÔNG ĐỌC DB KHI CHUYỂN TAB
            }
        });
    });

    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            currentSearchQuery = e.target.value.trim().toLowerCase();
            currentPage = 1;
            renderUserList(); 
        });
    }

    const filterSelect = document.getElementById('filterSelect');
    if (filterSelect) {
        filterSelect.addEventListener('change', (e) => {
            currentFilterStatus = e.target.value;
            currentPage = 1;
            renderUserList();
        });
    }

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
        usersBody.addEventListener('change', (e) => {
            if (e.target.classList.contains('user-row-checkbox')) {
                if (e.target.checked) selectedUserIds.add(e.target.dataset.id);
                else selectedUserIds.delete(e.target.dataset.id);
                updateBulkActionBar();
            }
        });

        usersBody.addEventListener('click', (e) => {
            if(e.target.classList.contains('user-row-checkbox')) return; 

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
        sendNotifyBtn.onclick = () => {
            sendNotification(cachedUsers, selectedUserIds, () => {
                selectedUserIds.clear();
                updateBulkActionBar();
                renderUserList();
            });
        };
    }
});
