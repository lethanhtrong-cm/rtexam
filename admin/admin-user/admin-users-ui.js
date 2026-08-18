// ==========================================
// FILE: admin-user/admin-users-ui.js
// QUẢN LÝ GIAO DIỆN (VIEW): RENDER BẢNG, PHÂN TRANG, THANH CÔNG CỤ
// ==========================================
import { userState, formatDateTime } from './admin-users-data.js';
import { getCostBadgeHtml } from './admin-billing.js';

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
        // TỰ ĐỘNG TÌM VÀ XÓA CÁC OPTION CŨ TỒN TẠI TRONG HTML
        const testingOpt = filterSelect.querySelector('option[value="testing"]');
        if (testingOpt) testingOpt.remove();
        
        const onlineOpt = filterSelect.querySelector('option[value="online"]');
        if (onlineOpt) onlineOpt.remove();

        if (!filterSelect.querySelector('option[value="pending_vip"]')) {
            const pendingOption = document.createElement('option');
            pendingOption.value = 'pending_vip';
            pendingOption.innerText = 'Chờ xác nhận CK';
            filterSelect.appendChild(pendingOption);
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

    let insertTarget = table.closest('.table-container') || table;
    if (insertTarget && !document.getElementById('bulk-action-bar')) {
        const bulkBar = document.createElement('div');
        bulkBar.id = 'bulk-action-bar';
        
        bulkBar.style.cssText = 'display: none; justify-content: space-between; align-items: center; background: #ffffff; padding: 16px 24px; border-radius: 12px; margin-bottom: 20px; border: 2px solid #8b5cf6; box-shadow: 0 10px 25px rgba(139, 92, 246, 0.25); flex-wrap: wrap; gap: 12px; position: relative; z-index: 105;';
        bulkBar.innerHTML = `
            <div style="font-weight: 600; color: #1e3a8a; font-size: 14px;">
                Đã chọn: <span id="bulk-selected-count" style="color: #ef4444; font-size: 16px;">0</span> tài khoản
            </div>
            <div style="display: flex; gap: 10px; flex-wrap: wrap;">
                <button id="btnBulkNotify" class="btn-modern-action" style="background: #8b5cf6; color: white; border: none; padding: 6px 12px; border-radius: 6px; cursor: pointer; font-size: 12.5px;"><i class="fa-solid fa-bell"></i> TB Hàng Loạt</button>
                <button id="btnBulkVip" class="btn-modern-action" style="background: #f59e0b; color: white; border: none; padding: 6px 12px; border-radius: 6px; cursor: pointer; font-size: 12.5px;"><i class="fa-solid fa-crown"></i> Kích VIP Loạt</button>
                <button id="btnBulkBan" class="btn-modern-action" style="background: #ef4444; color: white; border: none; padding: 6px 12px; border-radius: 6px; cursor: pointer; font-size: 12.5px;"><i class="fa-solid fa-ban"></i> Khóa Loạt</button>
            </div>
        `;
        insertTarget.parentNode.insertBefore(bulkBar, insertTarget);
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
        } else if (userState.currentFilterStatus === "pending_vip") { 
            matchStatus = userState.pendingVIPRequests.has(user.userId);
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

        const scoreBadgeHtml = `<span style="font-size: 11px; color: #4338ca; font-weight: 700; margin-left: 8px; display: inline-block; background: #e0e7ff; padding: 2px 6px; border-radius: 6px;" title="Điểm trung bình (ĐTB)"><i class="fa-solid fa-star"></i> ĐTB: ${user.avgScore.toFixed(2)}</span>`;
        const xpBadgeHtml = `<span style="font-size: 11px; color: #a16207; font-weight: 700; margin-left: 8px; display: inline-block; background: #fef08a; padding: 2px 6px; border-radius: 6px;" title="Kinh nghiệm"><i class="fa-solid fa-bolt"></i> XP: ${Math.round(user.xp).toLocaleString()}</span>`;

        const hasPendingRequest = userState.pendingVIPRequests.has(user.userId);
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
        const excelStyle = `${baseBtnStyle} background: linear-gradient(135deg, #10b981 0%, #059669 100%); box-shadow: 0 2px 5px rgba(16,185,129,0.3);`;
        const banStyle = user.isBanned ? `${baseBtnStyle} background: linear-gradient(135deg, #10b981 0%, #059669 100%); box-shadow: 0 2px 5px rgba(16,185,129,0.3);` : `${baseBtnStyle} background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); box-shadow: 0 2px 5px rgba(239,68,68,0.3);`; 
        
        const hoverEffect = `onmouseover="this.style.transform='translateY(-1.5px)'" onmouseout="this.style.transform='translateY(0)'"`;

        const isChecked = userState.selectedUserIds.has(user.userId) ? 'checked' : '';

        const actionButtonsHtml = `
            <button class="btn-user-action btn-notify-user" data-email="${user.email}" style="${notifyStyle}" ${hoverEffect} title="Gửi TB">🔔 Gửi</button>
            <button class="btn-user-action ${vipBtnClass} btn-toggle-vip" data-id="${user.userId}" data-vip="${user.isVip}" style="${vipStyle}" ${hoverEffect}>${vipBtnText}</button>
            <button class="btn-user-action btn-user-history btn-history" data-email="${user.email}" style="${historyStyle}" ${hoverEffect}>📊 Lịch Sử</button>
            <button class="btn-user-action btn-export-excel" data-email="${user.email}" style="${excelStyle}" ${hoverEffect} title="Tải Excel Lịch sử & XP"><i class="fa-solid fa-file-excel"></i> Tải XP</button>
            <button class="btn-user-action ${banBtnClass} btn-toggle-ban" data-id="${user.userId}" data-banned="${user.isBanned}" style="${banStyle}" ${hoverEffect}>${banBtnText}</button>
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
                        <span class="badge ${badgeClass}" style="padding: 3px 6px; font-size: 10px; margin-top: -3px; box-shadow: 0 1px 2px rgba(0,0,0,0.1);">${badgeText}</span>
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
                <span class="badge ${badgeClass}" style="box-shadow: 0 1px 2px rgba(0,0,0,0.05);">${badgeText}</span>
            </td>
            <td class="text-center desktop-action-td">
                <div class="user-action-group" style="display: flex; gap: 8px; justify-content: center; flex-wrap: nowrap;">
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
        toolbar.style.cssText += 'position: sticky; top: 65px; z-index: 90; background: #f1f5f9; padding: 10px 0; margin-top: -10px;';
        
        if (!document.getElementById('btnRefreshUsers')) {
            const refreshBtn = document.createElement('button');
            refreshBtn.id = 'btnRefreshUsers';
            refreshBtn.className = 'btn-modern-action';
            refreshBtn.style.cssText = 'background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; border: none; padding: 12px 20px; border-radius: 10px; font-weight: bold; cursor: pointer; white-space: nowrap; transition: 0.2s; box-shadow: 0 4px 10px rgba(16, 185, 129, 0.3); margin-right: 10px;';
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
            toolbar.appendChild(refreshBtn);
        }

        if (!document.getElementById('btnNotifyAll')) {
            const notifyAllBtn = document.createElement('button');
            notifyAllBtn.id = 'btnNotifyAll';
            notifyAllBtn.className = 'btn-modern-action';
            notifyAllBtn.style.cssText = 'background: linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%); color: white; border: none; padding: 12px 20px; border-radius: 10px; font-weight: bold; cursor: pointer; white-space: nowrap; transition: 0.2s; box-shadow: 0 4px 10px rgba(139, 92, 246, 0.3);';
            notifyAllBtn.innerHTML = '<i class="fa-solid fa-bell-ring"></i> Gửi TB Toàn Hệ Thống';
            notifyAllBtn.onmouseover = () => notifyAllBtn.style.transform = 'translateY(-2px)';
            notifyAllBtn.onmouseout = () => notifyAllBtn.style.transform = 'translateY(0)';
            notifyAllBtn.onclick = () => {
                if(typeof openNotifyCallback === 'function') openNotifyCallback('ALL');
            };
            toolbar.appendChild(notifyAllBtn);
        }
    }
}
