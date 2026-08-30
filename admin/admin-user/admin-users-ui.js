// ==========================================
// FILE: admin-user/admin-users-ui.js
// QUẢN LÝ GIAO DIỆN (VIEW): RENDER BẢNG, PHÂN TRANG, THANH CÔNG CỤ
// ==========================================
import { userState, formatDateTime } from './admin-users-data.js';
import { getCostBadgeHtml } from './admin-billing.js';
import { db } from '../admin-core.js';
import { collection, getDocs, doc, updateDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

export function injectTableHeadersAndToolbar() {
    const table = document.querySelector('#usersTableBody').closest('table');
    const theadTr = table.querySelector('thead tr');
    
    if (!document.getElementById('mobile-user-row-style')) {
        const style = document.createElement('style');
        style.id = 'mobile-user-row-style';
        style.innerHTML = `
            @media (max-width: 768px) {
                #tab-user-list .admin-table { min-width: 100% !important; display: block; border: none; }
                #tab-user-list .admin-table thead { display: none; }
                #tab-user-list .admin-table tbody { display: block; width: 100%; }
                
                .user-row {
                    display: flex !important;
                    flex-wrap: wrap;
                    background: #fff;
                    border: 1px solid #cbd5e1;
                    border-radius: 12px;
                    margin-bottom: 15px;
                    padding: 12px;
                    box-shadow: 0 2px 4px rgba(0,0,0,0.02);
                }
                
                .user-row td { display: block; border: none !important; padding: 0 !important; text-align: left !important; }
                
                .user-row td:nth-child(1) { width: 55px; padding-top: 5px !important; }
                .mobile-left-data { display: flex !important; } 
                
                .desktop-only-cell, .desktop-status-td, .desktop-action-td { display: none !important; }
                .user-row td:nth-child(2), .user-row td:nth-child(4), .user-row td:nth-child(5) { display: none !important; }
                
                .user-row td:nth-child(3) { width: calc(100% - 55px); padding-left: 12px !important; }
                
                .mobile-action-bar { 
                    display: flex !important; 
                    flex-wrap: wrap; 
                    gap: 8px; 
                    margin-top: 15px; 
                    padding-top: 15px; 
                    border-top: 1px dashed #cbd5e1; 
                    width: calc(100% + 55px); 
                    margin-left: -55px;
                }
                .mobile-action-bar button { 
                    flex: 1; 
                    min-width: 45%; 
                    justify-content: center; 
                    padding: 10px !important; 
                    font-size: 13px !important; 
                }
            }
        `;
        document.head.appendChild(style);
    }

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

    const filterSelect = document.getElementById('filterSelect');
    
    if (filterSelect) {
        const testingOpt = filterSelect.querySelector('option[value="testing"]');
        if (testingOpt) testingOpt.remove();
        
        const onlineOpt = filterSelect.querySelector('option[value="online"]');
        if (onlineOpt) onlineOpt.remove();

        const pendingOpt = filterSelect.querySelector('option[value="pending_vip"]');
        if (pendingOpt) pendingOpt.remove();

        if (!filterSelect.querySelector('option[value="has_payment"]')) {
            const paymentOption = document.createElement('option');
            paymentOption.value = 'has_payment';
            paymentOption.innerText = 'Đã từng báo chuyển khoản';
            filterSelect.appendChild(paymentOption);
        }
    }

    if (filterSelect && !document.getElementById('sortSelect')) {
        const sortSelect = document.createElement('select');
        sortSelect.id = 'sortSelect';
        sortSelect.className = filterSelect.className; 
        sortSelect.style.marginRight = '10px';
        sortSelect.innerHTML = `
            <option value="newest">Sắp xếp: Ngày ĐK gần nhất</option>
            <option value="avgScore">Sắp xếp: Điểm TB cao nhất</option>
            <option value="xp">Sắp xếp: XP cao nhất</option>
        `;
        sortSelect.addEventListener('change', (e) => {
            userState.currentSortMethod = e.target.value;
            userState.currentPage = 1; 
            renderUserList();
        });
        filterSelect.parentNode.insertBefore(sortSelect, filterSelect);
    }

    const selectAllCb = document.getElementById('selectAllUsers');
    if (selectAllCb) {
        selectAllCb.onclick = (e) => {
            const isChecked = e.target.checked;
            const checkboxes = document.querySelectorAll('.user-row-checkbox');
            checkboxes.forEach(cb => {
                cb.checked = isChecked;
                if (isChecked) userState.selectedUserIds.add(cb.dataset.id);
                else userState.selectedUserIds.delete(cb.dataset.id);
            });
            updateBulkActionBar();
        };
    }

    const toolbar = document.querySelector('.toolbar-user-modern');
    if (toolbar && !document.getElementById('bulk-action-bar')) {
        const bulkBar = document.createElement('div');
        bulkBar.id = 'bulk-action-bar';
        
        bulkBar.style.cssText = 'display: none; justify-content: space-between; align-items: center; background: #ffffff; padding: 12px 18px; border-radius: 10px; width: 100%; border: 2px solid #8b5cf6; box-shadow: 0 4px 10px rgba(139, 92, 246, 0.15); flex-wrap: wrap; gap: 12px; order: 99; margin-top: 5px;';
        bulkBar.innerHTML = `
            <div style="font-weight: 600; color: #1e3a8a; font-size: 14px;">
                Đã chọn: <span id="bulk-selected-count" style="color: #ef4444; font-size: 16px;">0</span> tài khoản
            </div>
            <div style="display: flex; gap: 10px; flex-wrap: wrap;">
                <button id="btnBulkNotify" class="btn-modern-action" style="background: #8b5cf6; color: white; border: none; padding: 6px 12px; border-radius: 6px; cursor: pointer; font-size: 12.5px;"><i class="fa-solid fa-bell"></i> TB Hàng Loạt</button>
                <button id="btnBulkVip" class="btn-modern-action" style="background: #f59e0b; color: white; border: none; padding: 6px 12px; border-radius: 6px; cursor: pointer; font-size: 12.5px;"><i class="fa-solid fa-crown"></i> Kích PLUS Loạt</button>
                <button id="btnBulkBan" class="btn-modern-action" style="background: #ef4444; color: white; border: none; padding: 6px 12px; border-radius: 6px; cursor: pointer; font-size: 12.5px;"><i class="fa-solid fa-ban"></i> Khóa Loạt</button>
            </div>
        `;
        toolbar.appendChild(bulkBar);
    }
}

export function updateBulkActionBar() {
    const bulkBar = document.getElementById('bulk-action-bar');
    const countEl = document.getElementById('bulk-selected-count');
    if (bulkBar && countEl) {
        if (userState.selectedUserIds.size > 0) {
            bulkBar.style.display = 'flex';
            countEl.innerText = userState.selectedUserIds.size;
        } else {
            bulkBar.style.display = 'none';
        }
    }
}

export function exportFilteredUsersToExcel() {
    if (!userState.cachedUsers || userState.cachedUsers.length === 0) {
        alert("Chưa có dữ liệu học viên để xuất Excel!");
        return;
    }

    let sortedUsers = [...userState.cachedUsers];
    if (userState.currentSortMethod === "newest") {
        sortedUsers.sort((a, b) => b.createdAtMs - a.createdAtMs);
    } else if (userState.currentSortMethod === "avgScore") {
        sortedUsers.sort((a, b) => b.avgScore - a.avgScore);
    } else if (userState.currentSortMethod === "xp") {
        sortedUsers.sort((a, b) => b.xp - a.xp);
    }

    const filteredUsers = sortedUsers.filter(user => {
        const matchSearch = !userState.currentSearchQuery || user.email.toLowerCase().includes(userState.currentSearchQuery);
        let matchStatus = false;
        if (userState.currentFilterStatus === "all") {
            matchStatus = true;
        } else if (userState.currentFilterStatus === "has_payment") { 
            matchStatus = userState.allPaymentUIDs.has(user.userId);
        } else {
            matchStatus = (user.statusKey === userState.currentFilterStatus);
        }
        return matchSearch && matchStatus;
    });

    if (filteredUsers.length === 0) {
        alert("Danh sách lọc hiện tại đang trống, không có dữ liệu để xuất!");
        return;
    }

    const dataToExport = filteredUsers.map((user, index) => {
        let statusText = "Thường";
        if (user.isBanned) statusText = "Bị khóa";
        else if (user.vipTier) statusText = user.vipTier.toUpperCase();

        let regDate = user.createdAt ? formatDateTime(user.createdAt) : '---';

        return {
            "STT": index + 1,
            "Email": user.email,
            "Trạng Thái": statusText,
            "Điểm Trung Bình": user.avgScore ? user.avgScore.toFixed(2) : 0,
            "Kinh Nghiệm (XP)": Math.round(user.xp || 0),
            "Đang Online": user.isOnline ? "Có" : "Không",
            "Đang Thi": user.examStatus === 'testing' ? "Có" : "Không",
            "Ngày Đăng Ký": regDate
        };
    });

    try {
        const worksheet = XLSX.utils.json_to_sheet(dataToExport);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "DanhSachHocVien");
        
        worksheet['!cols'] = [{wch: 5}, {wch: 35}, {wch: 15}, {wch: 15}, {wch: 20}, {wch: 15}, {wch: 15}, {wch: 25}];
        
        XLSX.writeFile(workbook, "Danh_Sach_Hoc_Vien_Da_Loc.xlsx");
    } catch (error) {
        console.error("Lỗi xuất Excel:", error);
        alert("Có lỗi xảy ra khi xuất file Excel. Vui lòng thử lại!");
    }
}

export function exportPaymentHistoryToExcel() {
    if (!userState.cachedPaymentRequests || userState.cachedPaymentRequests.length === 0) {
        alert("Chưa có dữ liệu lịch sử chuyển khoản để xuất Excel!");
        return;
    }

    const dataToExport = userState.cachedPaymentRequests.map((data, index) => {
        const u = userState.cachedUsers.find(user => user.userId === data.uid);
        const email = (u && u.email) ? u.email : (data.email || data.uid);
        
        const rawTime = data.timestamp || data.createdAt || data.date;
        let timeStr = 'Không rõ';
        if (rawTime) {
            const dateObj = (typeof rawTime.toDate === 'function') ? rawTime.toDate() : new Date(rawTime);
            if (!isNaN(dateObj.getTime())) {
                timeStr = dateObj.toLocaleDateString('vi-VN') + ' ' + dateObj.toLocaleTimeString('vi-VN', {hour: '2-digit', minute:'2-digit'});
            }
        }
        
        let approveTimeStr = '---';
        if (data.status !== "pending") {
            if (u && u.vipActivationDate) {
                const actDate = (typeof u.vipActivationDate.toDate === 'function') ? u.vipActivationDate.toDate() : new Date(u.vipActivationDate);
                if (!isNaN(actDate.getTime())) {
                    approveTimeStr = actDate.toLocaleDateString('vi-VN') + ' ' + actDate.toLocaleTimeString('vi-VN', {hour: '2-digit', minute:'2-digit'});
                }
            } else {
                approveTimeStr = 'Đã duyệt (Gói cũ)';
            }
        }
        
        const reqTier = data.requestedTier ? data.requestedTier.toUpperCase() : 'PLUS';

        return {
            "STT": index + 1,
            "Tài Khoản / Email": email,
            "Gói Yêu Cầu": reqTier,
            "Thời Gian Báo Cáo": timeStr,
            "Thời Gian Phê Duyệt": approveTimeStr,
            "Trạng Thái": data.status === "pending" ? "Đang chờ duyệt" : "Đã xử lý"
        };
    });

    try {
        const worksheet = XLSX.utils.json_to_sheet(dataToExport);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "LichSuChuyenKhoan");
        
        worksheet['!cols'] = [{wch: 5}, {wch: 35}, {wch: 15}, {wch: 22}, {wch: 22}, {wch: 18}];
        
        XLSX.writeFile(workbook, "Danh_Sach_Bao_Cao_Chuyen_Khoan.xlsx");
    } catch (error) {
        console.error("Lỗi xuất Excel:", error);
        alert("Có lỗi xảy ra khi xuất file Excel. Vui lòng thử lại!");
    }
}

export function renderPaymentHistory() {
    const tbody = document.getElementById('payment-history-body');
    if (!tbody) return;

    const paymentSection = document.getElementById('tab-payments');
    if (paymentSection && !document.getElementById('btnExportPayments')) {
        const titleEl = paymentSection.querySelector('.card-title');
        if (titleEl && titleEl.parentNode) {
            const headerDiv = titleEl.parentNode;
            headerDiv.style.position = 'relative'; 
            
            const btn = document.createElement('button');
            btn.id = 'btnExportPayments';
            btn.className = 'btn-modern-action';
            btn.style.cssText = 'position: absolute; right: 20px; top: 20px; background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; border: none; padding: 10px 16px; border-radius: 8px; font-weight: bold; cursor: pointer; transition: 0.2s; box-shadow: 0 4px 6px rgba(16,185,129,0.2); font-size: 13px;';
            btn.innerHTML = '<i class="fa-solid fa-file-excel"></i> Xuất Excel';
            btn.onmouseover = () => btn.style.transform = 'translateY(-2px)';
            btn.onmouseout = () => btn.style.transform = 'translateY(0)';
            btn.onclick = exportPaymentHistoryToExcel;
            
            headerDiv.appendChild(btn);
        }
    }

    let html = '';
    let stt = 1;
    
    if (userState.cachedPaymentRequests.length === 0) {
        html = '<tr><td colspan="5" class="empty-message text-center" style="padding: 20px;">Chưa có yêu cầu nâng cấp nào.</td></tr>';
    } else {
        userState.cachedPaymentRequests.forEach(data => {
            const u = userState.cachedUsers.find(user => user.userId === data.uid);
            const email = (u && u.email) ? u.email : (data.email || data.uid);
            
            const rawTime = data.timestamp || data.createdAt || data.date;
            let timeStr = 'Không rõ';
            if (rawTime) {
                const dateObj = (typeof rawTime.toDate === 'function') ? rawTime.toDate() : new Date(rawTime);
                if (!isNaN(dateObj.getTime())) {
                    timeStr = dateObj.toLocaleDateString('vi-VN') + ' ' + dateObj.toLocaleTimeString('vi-VN', {hour: '2-digit', minute:'2-digit'});
                }
            }
            
            const statusHtml = data.status === "pending" 
                ? `<span style="background: #fef08a; color: #a16207; padding: 4px 8px; border-radius: 6px; font-size: 11px; font-weight: bold;">Đang chờ duyệt</span>`
                : `<span style="background: #d1fae5; color: #059669; padding: 4px 8px; border-radius: 6px; font-size: 11px; font-weight: bold;">Đã xử lý</span>`;
            
            const reqTier = data.requestedTier ? data.requestedTier.toUpperCase() : 'PLUS';
            const tierBadgeHtml = reqTier === 'PRO'
                ? `<span style="background: #ffedd5; color: #b45309; padding: 3px 6px; border-radius: 4px; font-size: 11px; font-weight: bold; margin-left: 8px;">Gói PRO</span>`
                : `<span style="background: #e0f2fe; color: #0369a1; padding: 3px 6px; border-radius: 4px; font-size: 11px; font-weight: bold; margin-left: 8px;">Gói PLUS</span>`;

            const actionHtml = data.status === "pending"
                ? `<div style="display:flex; gap:6px; justify-content:center; align-items:center; flex-wrap: wrap;">
                     <button class="btn-modern-action btn-approve-tier" data-id="${data.uid}" data-email="${email}" data-tier="plus" style="background: #0ea5e9; color: white; border: none; padding: 6px 8px; border-radius: 6px; font-size: 11.5px; cursor: pointer; transition: 0.2s; white-space: nowrap;" title="Duyệt cấp quyền Plus"><i class="fa-solid fa-check"></i> Plus</button>
                     <button class="btn-modern-action btn-approve-tier" data-id="${data.uid}" data-email="${email}" data-tier="pro" style="background: #f59e0b; color: white; border: none; padding: 6px 8px; border-radius: 6px; font-size: 11.5px; cursor: pointer; transition: 0.2s; white-space: nowrap;" title="Duyệt cấp quyền Pro"><i class="fa-solid fa-check"></i> Pro</button>
                     <button class="btn-modern-action btn-delete-payment" data-id="${data.id}" style="background: #ef4444; color: white; border: none; padding: 6px 10px; border-radius: 6px; font-size: 11.5px; cursor: pointer; transition: 0.2s; white-space: nowrap;" title="Xóa bản ghi này"><i class="fa-solid fa-trash"></i></button>
                   </div>`
                : `<div style="display:flex; gap:6px; justify-content:center; align-items:center; flex-wrap: wrap;">
                     <span style="color: #94a3b8; font-size: 12px; margin-right: 5px; white-space: nowrap;"><i class="fa-solid fa-check-double"></i> Hoàn tất</span>
                     <button class="btn-modern-action btn-delete-payment" data-id="${data.id}" style="background: #ef4444; color: white; border: none; padding: 6px 10px; border-radius: 6px; font-size: 11.5px; cursor: pointer; transition: 0.2s; white-space: nowrap;" title="Xóa bản ghi này"><i class="fa-solid fa-trash"></i></button>
                   </div>`;
                
            html += `
                <tr style="border-bottom: 1px solid #f1f5f9; transition: background 0.2s;" onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background='transparent'">
                    <td class="text-center" style="padding: 12px;">${stt++}</td>
                    <td style="padding: 12px;">
                        <div style="display:flex; align-items:center;">
                            <strong style="color: #0f172a;">${email}</strong> ${tierBadgeHtml}
                        </div>
                    </td>
                    <td class="text-center" style="padding: 12px; color: #64748b; font-size: 13px;">${timeStr}</td>
                    <td class="text-center" style="padding: 12px;">${statusHtml}</td>
                    <td class="text-center" style="padding: 12px;">${actionHtml}</td>
                </tr>
            `;
        });
    }
    tbody.innerHTML = html;
}

export function renderUserList() {
    const tbody = document.getElementById('usersTableBody');
    if (!tbody) return;

    let sortedUsers = [...userState.cachedUsers];
    
    if (userState.currentSortMethod === "newest") {
        sortedUsers.sort((a, b) => b.createdAtMs - a.createdAtMs);
    } else if (userState.currentSortMethod === "avgScore") {
        sortedUsers.sort((a, b) => b.avgScore - a.avgScore);
    } else if (userState.currentSortMethod === "xp") {
        sortedUsers.sort((a, b) => b.xp - a.xp);
    }

    const filteredUsers = sortedUsers.filter(user => {
        const matchSearch = !userState.currentSearchQuery || user.email.toLowerCase().includes(userState.currentSearchQuery);
        
        let matchStatus = false;
        if (userState.currentFilterStatus === "all") {
            matchStatus = true;
        } else if (userState.currentFilterStatus === "has_payment") { 
            matchStatus = userState.allPaymentUIDs.has(user.userId);
        } else {
            matchStatus = (user.statusKey === userState.currentFilterStatus);
        }
                            
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
    const totalPages = Math.ceil(totalItems / userState.itemsPerPage);
    
    if (userState.currentPage < 1) userState.currentPage = 1;
    if (userState.currentPage > totalPages) userState.currentPage = totalPages;

    const startIndex = (userState.currentPage - 1) * userState.itemsPerPage;
    const endIndex = startIndex + userState.itemsPerPage;
    const paginatedUsers = filteredUsers.slice(startIndex, endIndex);

    let stt = startIndex + 1;

    paginatedUsers.forEach(user => {
        let currentStt = stt++;
        
        // SỬA LỖI UI BADGE TRẠNG THÁI: Áp dụng icon FontAwesome màu sắc rõ rệt + inline-flex chống rớt dòng
        let statusBadgeHtml = '';
        if (user.isBanned) {
            statusBadgeHtml = `<span style="background: #fee2e2 !important; color: #dc2626 !important; padding: 5px 10px !important; border-radius: 6px !important; font-size: 11px !important; font-weight: 800 !important; border: 1px solid #fecaca !important; box-shadow: 0 1px 2px rgba(0,0,0,0.05) !important; display: inline-flex !important; align-items: center !important; white-space: nowrap !important; line-height: 1 !important;"><i class="fa-solid fa-ban" style="margin-right: 4px;"></i>Bị Khóa</span>`;
        } else if (user.vipTier === 'pro') {
            statusBadgeHtml = `<span style="background: #ffedd5 !important; color: #b45309 !important; padding: 5px 10px !important; border-radius: 6px !important; font-size: 11px !important; font-weight: 800 !important; border: 1px solid #fed7aa !important; box-shadow: 0 1px 2px rgba(0,0,0,0.05) !important; display: inline-flex !important; align-items: center !important; white-space: nowrap !important; line-height: 1 !important;"><i class="fa-solid fa-crown" style="color: #f59e0b; margin-right: 4px;"></i>PRO</span>`;
        } else if (user.vipTier === 'plus') {
            statusBadgeHtml = `<span style="background: #e0f2fe !important; color: #0369a1 !important; padding: 5px 10px !important; border-radius: 6px !important; font-size: 11px !important; font-weight: 800 !important; border: 1px solid #bae6fd !important; box-shadow: 0 1px 2px rgba(0,0,0,0.05) !important; display: inline-flex !important; align-items: center !important; white-space: nowrap !important; line-height: 1 !important;"><i class="fa-solid fa-star" style="color: #0ea5e9; margin-right: 4px;"></i>PLUS</span>`;
        } else {
            statusBadgeHtml = `<span style="background: #f8fafc !important; color: #64748b !important; padding: 5px 10px !important; border-radius: 6px !important; font-size: 11px !important; font-weight: 700 !important; border: 1px solid #e2e8f0 !important; display: inline-flex !important; align-items: center !important; white-space: nowrap !important; line-height: 1 !important;"><i class="fa-solid fa-user" style="color: #94a3b8; margin-right: 4px;"></i>Thường</span>`;
        }

        const firstLetter = user.email.charAt(0);

        const scoreBadgeHtml = `<span style="font-size: 11px; color: #4338ca; font-weight: 700; margin-left: 8px; display: inline-block; background: #e0e7ff; padding: 2px 6px; border-radius: 6px;" title="Điểm trung bình (ĐTB)"><i class="fa-solid fa-star"></i> ĐTB: ${user.avgScore.toFixed(2)}</span>`;
        const xpBadgeHtml = `<span style="font-size: 11px; color: #a16207; font-weight: 700; margin-left: 8px; display: inline-block; background: #fef08a; padding: 2px 6px; border-radius: 6px;" title="Kinh nghiệm"><i class="fa-solid fa-bolt"></i> XP: ${Math.round(user.xp).toLocaleString()}</span>`;

        const pendingTier = userState.pendingVIPRequests.get(user.userId);
        const hasPendingRequest = !!pendingTier;
        let pendingBadge = '';
        if (hasPendingRequest) {
            const tierStr = pendingTier.toUpperCase();
            pendingBadge = `<span style="background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); color: white; margin-left: 8px; font-size: 11px; padding: 2px 8px; border-radius: 12px; font-weight: bold; box-shadow: 0 2px 4px rgba(239, 68, 68, 0.4); animation: pulse 2s infinite;">💸 Báo CK ${tierStr}</span>`;
        }

        const costBadgeHtml = getCostBadgeHtml(user.totalTokensUsed);

        let datesHtml = `<div style="font-size: 11.5px; color: #64748b; margin-top: 5px;">`;
        const regDateDisplay = user.createdAt ? formatDateTime(user.createdAt) : '---';
        datesHtml += `<div><i class="fa-regular fa-calendar-plus" style="margin-right:4px;"></i>Ngày ĐK: <strong>${regDateDisplay}</strong></div>`;
        
        if (user.vipTier) {
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
                remainingText = `<span style="color: #f59e0b; font-weight: bold; font-style: italic;">(Cần Tắt/Bật lại gói để tạo ngày)</span>`;
            }
            
            if (user.vipActivationDate) actDisplay = formatDateTime(user.vipActivationDate);
            
            datesHtml += `<div style="margin-top: 2px;"><i class="fa-solid fa-crown" style="margin-right:4px; color:#f59e0b;"></i>Kích hoạt: <strong>${actDisplay}</strong></div>`;
            datesHtml += `<div style="margin-top: 2px;"><i class="fa-regular fa-clock" style="margin-right:4px;"></i>Hết hạn: <strong>${expDisplay}</strong> ${remainingText}</div>`;
        }
        datesHtml += `</div>`;

        const isVipTierActive = !!user.vipTier;
        
        // SỬA LỖI UI CỤM NÚT ACTION: Ép display: inline-flex và flex-direction: row !important để chống bị dọc
        const baseBtnStyle = "padding: 6px 10px !important; font-size: 11.5px !important; border-radius: 6px !important; display: inline-flex !important; flex-direction: row !important; align-items: center !important; justify-content: center !important; gap: 5px !important; border: none !important; font-weight: 600 !important; cursor: pointer !important; transition: all 0.2s ease !important; color: white !important; white-space: nowrap !important; line-height: 1 !important;";
        
        const notifyStyle = `${baseBtnStyle} background: linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%); box-shadow: 0 2px 5px rgba(139,92,246,0.3);`;
        const historyStyle = `${baseBtnStyle} background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); box-shadow: 0 2px 5px rgba(59,130,246,0.3);`;
        const excelStyle = `${baseBtnStyle} background: linear-gradient(135deg, #10b981 0%, #059669 100%); box-shadow: 0 2px 5px rgba(16,185,129,0.3);`;
        const banStyle = user.isBanned ? `${baseBtnStyle} background: linear-gradient(135deg, #10b981 0%, #059669 100%); box-shadow: 0 2px 5px rgba(16,185,129,0.3);` : `${baseBtnStyle} background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); box-shadow: 0 2px 5px rgba(239,68,68,0.3);`; 
        
        const hoverEffect = `onmouseover="this.style.transform='translateY(-1.5px)'" onmouseout="this.style.transform='translateY(0)'"`;

        let vipActionButtonsHtml = '';
        if (isVipTierActive) {
            if (user.vipTier === 'pro') {
                const offStylePro = `${baseBtnStyle} background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); box-shadow: 0 2px 5px rgba(245,158,11,0.3); opacity: 0.9;`;
                vipActionButtonsHtml = `<button class="btn-user-action btn-user-vip-off btn-toggle-vip" data-id="${user.userId}" data-tier="none" style="${offStylePro}" ${hoverEffect} title="Đang ở gói PRO. Nhấn để Tắt"><i class="fa-solid fa-xmark"></i> Hủy Gói</button>`;
            } else {
                const offStylePlus = `${baseBtnStyle} background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); box-shadow: 0 2px 5px rgba(59,130,246,0.3); opacity: 0.9;`;
                vipActionButtonsHtml = `<button class="btn-user-action btn-user-vip-off btn-toggle-vip" data-id="${user.userId}" data-tier="none" style="${offStylePlus}" ${hoverEffect} title="Đang ở gói PLUS. Nhấn để Tắt"><i class="fa-solid fa-xmark"></i> Hủy Gói</button>`;
            }
        } else {
            const plusStyle = `${baseBtnStyle} background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); box-shadow: 0 2px 5px rgba(59,130,246,0.3);`;
            const proStyle = `${baseBtnStyle} background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); box-shadow: 0 2px 5px rgba(245,158,11,0.3);`;
            
            vipActionButtonsHtml = `
                <button class="btn-user-action btn-user-vip-on btn-toggle-vip" data-id="${user.userId}" data-tier="plus" style="${plusStyle}" ${hoverEffect}><i class="fa-solid fa-star"></i> Kích Plus</button>
                <button class="btn-user-action btn-user-vip-on btn-toggle-vip" data-id="${user.userId}" data-tier="pro" style="${proStyle}" ${hoverEffect}><i class="fa-solid fa-crown"></i> Kích Pro</button>
            `;
        }

        let deleteCkBtn = '';
        if (userState.allPaymentUIDs.has(user.userId)) {
            deleteCkBtn = `<button class="btn-user-action btn-delete-payment-record" data-id="${user.userId}" style="${baseBtnStyle} background: #fecaca !important; color: #dc2626 !important; box-shadow: 0 2px 5px rgba(220,38,38,0.2) !important;" ${hoverEffect} title="Xóa thông tin báo CK của tài khoản này"><i class="fa-solid fa-file-invoice-dollar"></i> Xóa CK</button>`;
        }

        const isChecked = userState.selectedUserIds.has(user.userId) ? 'checked' : '';

        const actionButtonsHtml = `
            <button class="btn-user-action btn-notify-user" data-email="${user.email}" style="${notifyStyle}" ${hoverEffect} title="Gửi Thông Báo"><i class="fa-solid fa-bell"></i> Gửi</button>
            ${vipActionButtonsHtml}
            <button class="btn-user-action btn-user-history btn-history" data-email="${user.email}" style="${historyStyle}" ${hoverEffect} title="Xem Lịch sử"><i class="fa-solid fa-clipboard-list"></i> Lịch Sử</button>
            <button class="btn-user-action btn-export-excel" data-email="${user.email}" style="${excelStyle}" ${hoverEffect} title="Tải Excel Lịch sử & XP"><i class="fa-solid fa-file-excel"></i> Tải XP</button>
            ${deleteCkBtn}
            <button class="btn-user-action ${user.isBanned ? 'btn-user-unban' : 'btn-user-ban'} btn-toggle-ban" data-id="${user.userId}" data-banned="${user.isBanned}" style="${banStyle}" ${hoverEffect}>${user.isBanned ? '<i class="fa-solid fa-unlock"></i> Mở Khóa' : '<i class="fa-solid fa-ban"></i> Khóa TK'}</button>
        `;

        const tr = document.createElement('tr');
        tr.className = 'user-row';
        tr.style.transition = "background-color 0.2s ease";
        tr.style.backgroundColor = hasPendingRequest ? '#fff1f2' : 'transparent';
        tr.onmouseover = () => tr.style.backgroundColor = hasPendingRequest ? '#ffe4e6' : '#f8fafc';
        tr.onmouseout = () => tr.style.backgroundColor = hasPendingRequest ? '#fff1f2' : 'transparent';
        
        tr.innerHTML = `
            <td class="text-center" style="vertical-align: top;">
                <div style="display: flex; flex-direction: column; align-items: center; gap: 10px;">
                    <input type="checkbox" class="user-row-checkbox" data-id="${user.userId}" data-email="${user.email}" ${isChecked} style="cursor:pointer; transform: scale(1.2);">
                    
                    <div class="mobile-left-data" style="display: none; flex-direction: column; align-items: center; gap: 8px;">
                        <span style="font-weight: 700; color: #94a3b8; font-size: 13px;">#${currentStt}</span>
                        <div class="user-avatar-placeholder" style="background-color: ${getAvatarColor(firstLetter)}; width: 35px; height: 35px; font-size: 16px;">
                            ${firstLetter}
                        </div>
                    </div>
                </div>
            </td>
            
            <td class="text-center desktop-only-cell" style="font-weight: 600; color: #64748b;">${currentStt}</td>
            
            <td style="width: 100%;">
                <div class="user-email-cell" style="display: flex; align-items: flex-start; width: 100%;">
                    <div class="user-avatar-placeholder desktop-only-cell" style="background-color: ${getAvatarColor(firstLetter)}; margin-top: 5px; flex-shrink: 0;">
                        ${firstLetter}
                    </div>
                    <div style="flex: 1; min-width: 0;">
                        <div style="font-weight: 600; color: #0f172a; font-size: 14px; display: flex; align-items: center; flex-wrap: wrap;">
                            <span style="word-break: break-all;">${user.email}</span> 
                            ${scoreBadgeHtml} ${xpBadgeHtml} ${pendingBadge} ${costBadgeHtml}
                        </div>
                        ${datesHtml}
                    </div>
                </div>
                
                <div class="mobile-action-bar" style="display: none;">
                    ${actionButtonsHtml}
                </div>
            </td>
            
            <td class="text-center desktop-status-td">
                ${statusBadgeHtml}
            </td>
            <td class="text-center desktop-action-td">
                <div class="user-action-group" style="display: flex !important; flex-direction: row !important; gap: 6px !important; justify-content: center !important; flex-wrap: wrap !important;">
                    ${actionButtonsHtml}
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
    prevBtn.disabled = userState.currentPage === 1;
    if (userState.currentPage === 1) prevBtn.style.opacity = '0.4';
    prevBtn.onclick = () => {
        if (userState.currentPage > 1) { userState.currentPage--; renderUserList(); }
    };
    paginationContainer.appendChild(prevBtn);

    const pageInfo = document.createElement('div');
    pageInfo.innerHTML = `Trang <strong style="color:#3b82f6;">${userState.currentPage}</strong> / ${totalPages}`;
    pageInfo.style.cssText = 'font-size: 14px; font-weight: 600; color: #475569; background: #f8fafc; padding: 8px 20px; border-radius: 10px; border: 1px solid #e2e8f0; margin: 0 5px;';
    paginationContainer.appendChild(pageInfo);

    const nextBtn = document.createElement('button');
    nextBtn.innerHTML = 'Tiếp <i class="fa-solid fa-arrow-right"></i>';
    nextBtn.className = 'btn-modern-action';
    nextBtn.style.padding = '8px 16px';
    nextBtn.disabled = userState.currentPage === totalPages;
    if (userState.currentPage === totalPages) nextBtn.style.opacity = '0.4';
    nextBtn.onclick = () => {
        if (userState.currentPage < totalPages) { userState.currentPage++; renderUserList(); }
    };
    paginationContainer.appendChild(nextBtn);
}

function getAvatarColor(letter) {
    const charCode = letter.toUpperCase().charCodeAt(0) || 65;
    const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#14b8a6'];
    return colors[charCode % colors.length];
}

export function initUserInterfaceEvents(loadUserListCallback, openNotifyCallback) {
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            userState.currentSearchQuery = e.target.value.trim().toLowerCase();
            userState.currentPage = 1; 
            renderUserList(); 
        });
    }

    const filterSelect = document.getElementById('filterSelect');
    if (filterSelect) {
        filterSelect.addEventListener('change', (e) => {
            userState.currentFilterStatus = e.target.value;
            userState.currentPage = 1; 
            renderUserList();
        });
    }

    const toolbar = document.querySelector('.toolbar-user-modern');
    if (toolbar) {
        const tabUserList = document.getElementById('tab-user-list');
        const statsContainer = tabUserList ? tabUserList.querySelector('.stats-container') : null;
        
        if (statsContainer && !document.getElementById('user-top-sticky-wrapper')) {
            const wrapper = document.createElement('div');
            wrapper.id = 'user-top-sticky-wrapper';
            wrapper.style.cssText = 'position: sticky; top: 60px; z-index: 95; background: #f1f5f9; padding: 15px 0 10px 0; margin-top: -15px; margin-bottom: 15px; border-bottom: 1px solid #cbd5e1;';
            statsContainer.parentNode.insertBefore(wrapper, statsContainer);
            wrapper.appendChild(statsContainer);
            wrapper.appendChild(toolbar);
            
            statsContainer.style.marginBottom = '15px';
            toolbar.style.cssText += 'display: flex; flex-wrap: wrap; gap: 10px; align-items: center; width: 100%;';
        } else if (!document.getElementById('user-top-sticky-wrapper')) {
            toolbar.style.cssText += 'position: sticky; top: 60px; z-index: 95; background: #f1f5f9; padding: 10px 0; margin-top: -10px; display: flex; flex-wrap: wrap; gap: 10px; align-items: center;';
        }
        
        const searchContainer = document.querySelector('.search-user-container');
        if (searchContainer) {
            searchContainer.style.flex = '1 1 100%';
            searchContainer.style.width = '100%';
            const sInput = document.getElementById('searchInput');
            if (sInput) sInput.style.width = '100%';
        }

        let actionGroup = document.getElementById('toolbar-btn-group');
        if (!actionGroup) {
            actionGroup = document.createElement('div');
            actionGroup.id = 'toolbar-btn-group';
            actionGroup.style.cssText = 'display: flex; flex-wrap: wrap; gap: 6px; align-items: center; width: 100%;';
            toolbar.appendChild(actionGroup);

            const sortSelect = document.getElementById('sortSelect');
            if (sortSelect) actionGroup.appendChild(sortSelect);
            if (filterSelect) actionGroup.appendChild(filterSelect);
        }

        const baseBtnCSS = 'color: white; border: none; padding: 8px 12px; border-radius: 8px; font-weight: bold; font-size: 12.5px; cursor: pointer; white-space: nowrap; transition: 0.2s; box-shadow: 0 2px 4px rgba(0,0,0,0.1); display: inline-flex; align-items: center; gap: 5px;';

        if (!document.getElementById('btnRefreshUsers')) {
            const refreshBtn = document.createElement('button');
            refreshBtn.id = 'btnRefreshUsers';
            refreshBtn.className = 'btn-modern-action';
            refreshBtn.style.cssText = `background: linear-gradient(135deg, #10b981 0%, #059669 100%); ${baseBtnCSS}`;
            refreshBtn.innerHTML = '<i class="fa-solid fa-rotate"></i> Cập Nhật';
            refreshBtn.onmouseover = () => refreshBtn.style.transform = 'translateY(-2px)';
            refreshBtn.onmouseout = () => refreshBtn.style.transform = 'translateY(0)';
            refreshBtn.onclick = async () => {
                refreshBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Đang tải...';
                refreshBtn.disabled = true;
                if(typeof loadUserListCallback === 'function') await loadUserListCallback(true); 
                refreshBtn.innerHTML = '<i class="fa-solid fa-rotate"></i> Cập Nhật';
                refreshBtn.disabled = false;
            };
            actionGroup.appendChild(refreshBtn);
        }

        if (!document.getElementById('btnNotifyAll')) {
            const notifyAllBtn = document.createElement('button');
            notifyAllBtn.id = 'btnNotifyAll';
            notifyAllBtn.className = 'btn-modern-action';
            notifyAllBtn.style.cssText = `background: linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%); ${baseBtnCSS}`;
            notifyAllBtn.innerHTML = '<i class="fa-solid fa-bell-ring"></i> Gửi Thông Báo';
            notifyAllBtn.onmouseover = () => notifyAllBtn.style.transform = 'translateY(-2px)';
            notifyAllBtn.onmouseout = () => notifyAllBtn.style.transform = 'translateY(0)';
            notifyAllBtn.onclick = () => {
                if(typeof openNotifyCallback === 'function') openNotifyCallback('ALL');
            };
            actionGroup.appendChild(notifyAllBtn);
        }

        if (!document.getElementById('btnSyncOldData')) {
            const syncBtn = document.createElement('button');
            syncBtn.id = 'btnSyncOldData';
            syncBtn.className = 'btn-modern-action';
            syncBtn.style.cssText = `background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); ${baseBtnCSS}`;
            syncBtn.innerHTML = '<i class="fa-solid fa-database"></i> Đồng bộ ĐTB';
            syncBtn.onmouseover = () => syncBtn.style.transform = 'translateY(-2px)';
            syncBtn.onmouseout = () => syncBtn.style.transform = 'translateY(0)';
            syncBtn.onclick = async () => {
                if(!confirm("Hệ thống sẽ chạy lệnh quét toàn bộ dữ liệu lịch sử để tính lại Điểm Trung Bình. Quá trình này tiêu tốn một ít Quota nhưng chỉ cần chạy 1 LẦN DUY NHẤT. Bạn có muốn tiếp tục?")) return;
                
                syncBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Đang xử lý...';
                syncBtn.disabled = true;
                
                try {
                    const resultsSnap = await getDocs(collection(db, "results"));
                    const stats = {};
                    resultsSnap.forEach(r => {
                        const d = r.data();
                        if(!d.email) return;
                        if(!stats[d.email]) stats[d.email] = { total: 0, count: 0 };
                        stats[d.email].total += (parseFloat(d.score) || 0);
                        stats[d.email].count += 1;
                    });
                    
                    const usersSnap = await getDocs(collection(db, "users"));
                    const promises = [];
                    usersSnap.forEach(u => {
                        const email = u.data().email;
                        if(email && stats[email]) {
                            const avg = parseFloat((stats[email].total / stats[email].count).toFixed(2));
                            promises.push(updateDoc(doc(db, "users", u.id), {
                                totalScore: stats[email].total,
                                examCount: stats[email].count,
                                avgScore: avg
                            }));
                        }
                    });
                    
                    await Promise.all(promises);
                    alert("Đồng bộ ĐTB thành công! Hãy nhấn nút Cập Nhật để tải lại danh sách.");
                    if(typeof loadUserListCallback === 'function') await loadUserListCallback(true);
                } catch(e) {
                    console.error(e);
                    alert("Lỗi đồng bộ: " + e.message);
                } finally {
                    syncBtn.innerHTML = '<i class="fa-solid fa-database"></i> Đồng bộ ĐTB';
                    syncBtn.disabled = false;
                }
            };
            actionGroup.appendChild(syncBtn);
        }

        if (!document.getElementById('btnExportFilteredUsers')) {
            const exportUsersBtn = document.createElement('button');
            exportUsersBtn.id = 'btnExportFilteredUsers';
            exportUsersBtn.className = 'btn-modern-action';
            exportUsersBtn.style.cssText = `background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); ${baseBtnCSS}`;
            exportUsersBtn.innerHTML = '<i class="fa-solid fa-file-excel"></i> Excel DS Lọc';
            exportUsersBtn.onmouseover = () => exportUsersBtn.style.transform = 'translateY(-2px)';
            exportUsersBtn.onmouseout = () => exportUsersBtn.style.transform = 'translateY(0)';
            exportUsersBtn.onclick = exportFilteredUsersToExcel;
            actionGroup.appendChild(exportUsersBtn);
        }

        if (!document.getElementById('btnExportPaymentsMain')) {
            const exportBtn = document.createElement('button');
            exportBtn.id = 'btnExportPaymentsMain';
            exportBtn.className = 'btn-modern-action';
            exportBtn.style.cssText = `background: linear-gradient(135deg, #14b8a6 0%, #0f766e 100%); ${baseBtnCSS}`;
            exportBtn.innerHTML = '<i class="fa-solid fa-file-excel"></i> Excel Báo CK';
            exportBtn.onmouseover = () => exportBtn.style.transform = 'translateY(-2px)';
            exportBtn.onmouseout = () => exportBtn.style.transform = 'translateY(0)';
            exportBtn.onclick = exportPaymentHistoryToExcel;
            actionGroup.appendChild(exportBtn);
        }
    }
}
