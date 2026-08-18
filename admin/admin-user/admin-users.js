// ==========================================
// FILE: admin-user/admin-users.js
// QUẢN LÝ GIAO DIỆN CHÍNH, BẢNG VÀ LOGIC TỔNG HỢP
// ==========================================
import { db, showToast } from '../admin-core.js';
import { 
    collection, onSnapshot, doc, updateDoc, query, where, getDocs, addDoc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";

// IMPORT CÁC MODULE ĐÃ ĐƯỢC PHÂN TÁCH
import { getCostBadgeHtml } from './admin-billing.js';
import { handleViewHistory } from './admin-history.js';
import { openNotificationModal, sendNotification } from './admin-users-notify.js';

let cachedUsers = [];
let currentSearchQuery = "";
let currentFilterStatus = "all";
let currentSortMethod = "newest"; 

let isUserListLoaded = false; 
let isResultsLoaded = false; 
let isLeaderboardLoaded = false; 

let globalResultsStats = {}; 
let globalLeaderboardStats = {}; 

let currentPage = 1;
const itemsPerPage = 20;
let selectedUserIds = new Set(); 
let pendingVIPRequests = new Set(); 

let localTestingTimers = new Map();

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

// =========================================================================
// XUẤT EXCEL: ĐỒNG BỘ LOGIC & THÊM DÒNG TỔNG KẾT ĐỐI CHIẾU
// =========================================================================
async function exportUserHistoryToExcel(email) {
    if (!email) {
        showToast("Không tìm thấy email học viên để xuất dữ liệu!", "error");
        return;
    }
    
    showToast(`Đang trích xuất dữ liệu của ${email}...`, "success");

    try {
        const [qSnap, eSnap] = await Promise.all([
            getDocs(query(collection(db, "results"), where("email", "==", email))),
            getDocs(collection(db, "exams"))
        ]);

        if (qSnap.empty) {
            showToast(`Học viên ${email} chưa có lịch sử làm bài nào!`, "error");
            return;
        }

        const examsMap = {};
        eSnap.forEach(docSnap => {
            const exData = docSnap.data();
            if (exData.examName) {
                examsMap[docSnap.id] = exData.examName;
            }
        });

        let resultsArray = [];
        qSnap.forEach(docSnap => {
            resultsArray.push({ id: docSnap.id, data: docSnap.data() });
        });

        resultsArray.sort((a, b) => {
            const tA = a.data.timestamp ? (typeof a.data.timestamp.toDate === 'function' ? a.data.timestamp.toDate().getTime() : new Date(a.data.timestamp).getTime()) : (a.data.createdAt ? (typeof a.data.createdAt.toDate === 'function' ? a.data.createdAt.toDate().getTime() : new Date(a.data.createdAt).getTime()) : 0);
            const tB = b.data.timestamp ? (typeof b.data.timestamp.toDate === 'function' ? b.data.timestamp.toDate().getTime() : new Date(b.data.timestamp).getTime()) : (b.data.createdAt ? (typeof b.data.createdAt.toDate === 'function' ? b.data.createdAt.toDate().getTime() : new Date(b.data.createdAt).getTime()) : 0);
            return tA - tB;
        });

        const attemptCounts = {};
        const maxRawXpDict = {};

        resultsArray.forEach(item => {
            const data = item.data;
            const examCode = data.examId || data.examCode || data.quizId || 'Không rõ';
            
            if (!attemptCounts[examCode]) {
                attemptCounts[examCode] = 0;
                maxRawXpDict[examCode] = 0;
            }
            attemptCounts[examCode]++;
            item.attemptNumber = attemptCounts[examCode];

            let rawXP = 0;
            if (data.earnedXP !== undefined) {
                rawXP = data.earnedXP;
            } else if (data.xp !== undefined) {
                rawXP = data.xp;
            } else if (data.score !== undefined && data.score > 0) {
                rawXP = Math.round(data.score * 10);
            }

            let displayXP = 0;
            if (item.attemptNumber === 1) {
                displayXP = rawXP;
                maxRawXpDict[examCode] = rawXP;
            } else {
                let prevMax = maxRawXpDict[examCode];
                if (rawXP > prevMax) {
                    displayXP = Math.min(Math.round(rawXP * 0.2), 30); 
                    maxRawXpDict[examCode] = rawXP;
                } else if (rawXP > 0) {
                    displayXP = 5; 
                } else {
                    displayXP = 0;
                }
            }
            item.displayXP = displayXP;
            
            item.ts = data.timestamp ? (typeof data.timestamp.toDate === 'function' ? data.timestamp.toDate().getTime() : new Date(data.timestamp).getTime()) : (data.createdAt ? (typeof data.createdAt.toDate === 'function' ? data.createdAt.toDate().getTime() : new Date(data.createdAt).getTime()) : 0);
        });

        resultsArray.sort((a, b) => b.ts - a.ts);

        const dataToExport = [];
        let stt = 1;
        let totalCalculatedXP = 0; 

        resultsArray.forEach((item) => {
            const data = item.data;
            const examCode = data.examId || data.examCode || data.quizId || "Không rõ";
            const examName = examsMap[examCode] ? `${examsMap[examCode]} (${examCode})` : examCode;
            
            const attemptLabel = item.attemptNumber === 1 ? "Lần đầu" : `Ôn tập (Lần ${item.attemptNumber})`;
            
            let examDate = 'N/A';
            if (item.ts > 0) {
                const dateObj = new Date(item.ts);
                examDate = dateObj.toLocaleDateString('vi-VN') + ' ' + dateObj.toLocaleTimeString('vi-VN', {hour: '2-digit', minute:'2-digit'});
            }

            totalCalculatedXP += item.displayXP;

            dataToExport.push({
                "STT": stt++,
                "Mã / Tên Đề Thi": examName,
                "Lần Thi": attemptLabel,
                "Điểm Số": data.score !== undefined ? data.score : 0,
                "Tổng Câu Hỏi": data.totalQuestions || data.total || 0,
                "Thời Gian Làm (Giây)": data.timeSpent || 0,
                "Số XP Thực Nhận": item.displayXP,
                "Ngày Nộp Bài": examDate
            });
        });

        const targetUser = cachedUsers.find(u => u.email === email);
        const actualLeaderboardXP = targetUser ? Math.round(targetUser.xp).toLocaleString() : "Không rõ";

        dataToExport.push({});
        dataToExport.push({
            "Thời Gian Làm (Giây)": "TỔNG XP TRONG FILE EXCEL NÀY:",
            "Số XP Thực Nhận": totalCalculatedXP
        });
        dataToExport.push({
            "Thời Gian Làm (Giây)": "TỔNG XP GHI NHẬN TRÊN BẢNG XẾP HẠNG (THỰC TẾ):",
            "Số XP Thực Nhận": actualLeaderboardXP
        });

        const worksheet = XLSX.utils.json_to_sheet(dataToExport);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Lịch sử thi & XP");

        const wscols = [
            {wch: 5},  {wch: 40}, {wch: 15}, {wch: 10}, {wch: 15}, {wch: 45}, {wch: 25}, {wch: 20}
        ];
        worksheet['!cols'] = wscols;

        const safeEmail = email.replace(/[^a-zA-Z0-9]/g, '_');
        XLSX.writeFile(workbook, `Lich_Su_Thi_${safeEmail}.xlsx`);
        
        showToast("Xuất Excel thành công!", "success");

    } catch (error) {
        console.error("Lỗi khi xuất Excel:", error);
        showToast("Có lỗi xảy ra trong quá trình xuất Excel.", "error");
    }
}

export async function loadUserList(forceRefresh = false) {
    const tbody = document.getElementById('usersTableBody');
    if (!tbody) return;

    if (!forceRefresh && isUserListLoaded) {
        renderUserList();
        return;
    }

    if (!isUserListLoaded) {
        tbody.innerHTML = '<tr><td colspan="5" class="loading-text">⏳ Đang tải và phân tích dữ liệu học viên (Tối ưu Quota)...</td></tr>';
    }

    try {
        let promises = [getDocs(collection(db, "users"))];
        
        let resultsIndex = -1;
        let leaderboardIndex = -1;

        if (!isResultsLoaded || forceRefresh) {
            promises.push(getDocs(collection(db, "results")));
            resultsIndex = promises.length - 1;
        }
        
        if (!isLeaderboardLoaded || forceRefresh) {
            promises.push(getDocs(collection(db, "users_leaderboard")));
            leaderboardIndex = promises.length - 1;
        }

        const snapshots = await Promise.all(promises);
        const usersSnap = snapshots[0];
        
        const auth = getAuth();
        const currentAdminEmail = auth.currentUser ? auth.currentUser.email : null;

        if (resultsIndex !== -1) {
            globalResultsStats = {};
            snapshots[resultsIndex].forEach(docSnap => {
                const data = docSnap.data();
                const email = data.email;
                if (!email) return;
                
                if (!globalResultsStats[email]) globalResultsStats[email] = { totalScore: 0, count: 0 };
                globalResultsStats[email].totalScore += (parseFloat(data.score) || 0);
                globalResultsStats[email].count += 1;
            });
            isResultsLoaded = true;
        }

        if (leaderboardIndex !== -1) {
            globalLeaderboardStats = {};
            snapshots[leaderboardIndex].forEach(docSnap => {
                globalLeaderboardStats[docSnap.id] = docSnap.data().totalXP || 0;
            });
            isLeaderboardLoaded = true;
        }

        cachedUsers = [];
        let totalUsersCount = 0;
        let totalVipsCount = 0;

        usersSnap.forEach((docSnap) => {
            const user = docSnap.data();
            const userId = docSnap.id;
            const email = user.email || 'Chưa cập nhật';
            const isVip = user.isVip || false;
            const isBanned = user.isBanned || false;
            
            let isOnline = false;
            if (user.isOnline === true || user.isOnline === "true" || user.isOnline === 1) {
                isOnline = true;
            }
            if (currentAdminEmail && email === currentAdminEmail) {
                isOnline = true;
            }

            const totalTokensUsed = user.totalTokensUsed || 0;
            let examStatus = user.examStatus || 'none'; 

            if (!isOnline) {
                examStatus = 'none';
            }

            let examStartTimeMs = null;
            if (user.examStartTime) {
                examStartTimeMs = (typeof user.examStartTime.toDate === 'function') ? user.examStartTime.toDate().getTime() : new Date(user.examStartTime).getTime();
            }
            
            if (examStatus === 'testing') {
                if (!localTestingTimers.has(userId)) {
                    localTestingTimers.set(userId, Date.now()); 
                }
            } else {
                localTestingTimers.delete(userId); 
            }

            const rStats = globalResultsStats[email] || { totalScore: 0, count: 0 };
            const finalAvgScore = rStats.count > 0 ? (rStats.totalScore / rStats.count) : 0;
            const finalXp = globalLeaderboardStats[userId] || 0;

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
                examStatus: examStatus,
                statusKey: statusKey,
                totalTokensUsed: totalTokensUsed,
                avgScore: finalAvgScore, 
                xp: finalXp, 
                createdAtMs: createdAtMs, 
                createdAt: createdAtRaw,
                vipActivationDate: user.vipActivationDate || null,
                vipExpirationDate: user.vipExpirationDate || null,
                examStartTimeMs: examStartTimeMs,
                localTestingStartMs: localTestingTimers.get(userId)
            });
        });

        const totalUsersEl = document.getElementById('totalUsers');
        const totalVipUsersEl = document.getElementById('totalVipUsers');

        if (totalUsersEl) totalUsersEl.innerText = totalUsersCount;
        if (totalVipUsersEl) totalVipUsersEl.innerText = totalVipsCount;

        isUserListLoaded = true;
        selectedUserIds.clear();
        
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

function initAutoClearGhostSessions() {
    setInterval(async () => {
        const testingUsers = cachedUsers.filter(u => u.examStatus === 'testing');
        if (testingUsers.length === 0) return;

        const now = Date.now();
        const timeoutMs = 45 * 60 * 1000; 
        
        let clearedCount = 0;

        for (const user of testingUsers) {
            let timeElapsed = 0;
            
            if (user.examStartTimeMs) {
                timeElapsed = now - user.examStartTimeMs;
            } 
            else if (user.localTestingStartMs) {
                timeElapsed = now - user.localTestingStartMs;
            }

            if (timeElapsed > timeoutMs) {
                try {
                    await updateDoc(doc(db, "users", user.userId), {
                        isOnline: false,
                        examStatus: 'none'
                    });
                    
                    localTestingTimers.delete(user.userId);
                    
                    user.isOnline = false;
                    user.examStatus = 'none';
                    clearedCount++;
                } catch (e) {
                    console.error(`Lỗi tự động gỡ kẹt cho user ${user.userId}:`, e);
                }
            }
        }

        if (clearedCount > 0) {
            renderUserList(); 
            console.log(`[Auto-GC] Đã tự động dọn dẹp ${clearedCount} phiên thi bị kẹt quá 45 phút.`);
        }
    }, 60000); 
}

function injectTableHeadersAndToolbar() {
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
    
    if (filterSelect && !filterSelect.querySelector('option[value="online"]')) {
        const onlineOption = document.createElement('option');
        onlineOption.value = 'online';
        onlineOption.innerText = 'Đang trực tuyến';
        filterSelect.appendChild(onlineOption);
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
            currentSortMethod = e.target.value;
            currentPage = 1; 
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
                if (isChecked) selectedUserIds.add(cb.dataset.id);
                else selectedUserIds.delete(cb.dataset.id);
            });
            updateBulkActionBar();
        };
    }

    let insertTarget = table.closest('.table-container') || table;
    if (insertTarget && !document.getElementById('bulk-action-bar')) {
        const bulkBar = document.createElement('div');
        bulkBar.id = 'bulk-action-bar';
        
        bulkBar.style.cssText = 'display: none; justify-content: space-between; align-items: center; background: #eff6ff; padding: 10px 15px; border-radius: 8px; margin-bottom: 15px; border: 1px solid #bfdbfe; box-shadow: 0 4px 6px rgba(0,0,0,0.08); flex-wrap: wrap; gap: 10px; position: sticky; top: 135px; z-index: 100;';
        
        bulkBar.innerHTML = `
            <div style="font-weight: 600; color: #1e3a8a; font-size: 14px;">
                Đã chọn: <span id="bulk-selected-count" style="color: #ef4444; font-size: 16px;">0</span> tài khoản
            </div>
            <div style="display: flex; gap: 10px; flex-wrap: wrap;">
                <button id="btnBulkNotify" class="btn-modern-action" style="background: #8b5cf6; color: white; border: none; padding: 6px 12px; border-radius: 6px; cursor: pointer; font-size: 12.5px;"><i class="fa-solid fa-bell"></i> TB Hàng Loạt</button>
                <button id="btnBulkVip" class="btn-modern-action" style="background: #f59e0b; color: white; border: none; padding: 6px 12px; border-radius: 6px; cursor: pointer; font-size: 12.5px;"><i class="fa-solid fa-crown"></i> Kích VIP Loạt</button>
                <button id="btnBulkBan" class="btn-modern-action" style="background: #ef4444; color: white; border: none; padding: 6px 12px; border-radius: 6px; cursor: pointer; font-size: 12.5px;"><i class="fa-solid fa-ban"></i> Khóa Loạt</button>
                <button id="btnBulkReset" class="btn-modern-action" style="background: #64748b; color: white; border: none; padding: 6px 12px; border-radius: 6px; cursor: pointer; font-size: 12.5px;" title="Xóa trạng thái kẹt Online/Đang thi"><i class="fa-solid fa-power-off"></i> Sửa Kẹt Thi</button>
            </div>
        `;
        insertTarget.parentNode.insertBefore(bulkBar, insertTarget);

        document.getElementById('btnBulkVip').onclick = () => handleBulkAction('vip');
        document.getElementById('btnBulkBan').onclick = () => handleBulkAction('ban');
        document.getElementById('btnBulkNotify').onclick = () => handleBulkAction('notify');
        document.getElementById('btnBulkReset').onclick = () => handleBulkAction('reset');
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

    let sortedUsers = [...cachedUsers];
    
    if (currentSortMethod === "newest") {
        sortedUsers.sort((a, b) => b.createdAtMs - a.createdAtMs);
    } else if (currentSortMethod === "avgScore") {
        sortedUsers.sort((a, b) => b.avgScore - a.avgScore);
    } else if (currentSortMethod === "xp") {
        sortedUsers.sort((a, b) => b.xp - a.xp);
    }

    const filteredUsers = sortedUsers.filter(user => {
        const matchSearch = !currentSearchQuery || user.email.toLowerCase().includes(currentSearchQuery);
        
        let matchStatus = false;
        if (currentFilterStatus === "all") {
            matchStatus = true;
        } else if (currentFilterStatus === "testing") {
            matchStatus = (user.examStatus === "testing");
        } else if (currentFilterStatus === "online") {
            matchStatus = (user.isOnline === true);
        } else {
            matchStatus = (user.statusKey === currentFilterStatus);
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
    const totalPages = Math.ceil(totalItems / itemsPerPage);
    
    if (currentPage < 1) currentPage = 1;
    if (currentPage > totalPages) currentPage = totalPages;

    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
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
        
        const onlineStatusHtml = user.isOnline 
            ? `<span title="Đang trực tuyến" style="display: inline-block; width: 10px; height: 10px; background-color: #10b981; border-radius: 50%; margin-left: 8px; box-shadow: 0 0 6px rgba(16,185,129,0.5);"></span>` 
            : `<span title="Ngoại tuyến" style="display: inline-block; width: 10px; height: 10px; background-color: #cbd5e1; border-radius: 50%; margin-left: 8px;"></span>`;

        const testingBadgeHtml = user.examStatus === 'testing'
            ? `<span style="font-size: 11px; color: #d97706; font-weight: 700; margin-left: 8px; display: inline-block; background: #fef3c7; padding: 2px 6px; border-radius: 6px;"><i class="fa-solid fa-pen-clip"></i> Đang thi</span>`
            : '';

        const scoreBadgeHtml = `<span style="font-size: 11px; color: #4338ca; font-weight: 700; margin-left: 8px; display: inline-block; background: #e0e7ff; padding: 2px 6px; border-radius: 6px;" title="Điểm trung bình (ĐTB)"><i class="fa-solid fa-star"></i> ĐTB: ${user.avgScore.toFixed(2)}</span>`;
        const xpBadgeHtml = `<span style="font-size: 11px; color: #a16207; font-weight: 700; margin-left: 8px; display: inline-block; background: #fef08a; padding: 2px 6px; border-radius: 6px;" title="Kinh nghiệm"><i class="fa-solid fa-bolt"></i> XP: ${Math.round(user.xp).toLocaleString()}</span>`;

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
        const excelStyle = `${baseBtnStyle} background: linear-gradient(135deg, #10b981 0%, #059669 100%); box-shadow: 0 2px 5px rgba(16,185,129,0.3);`;
        const banStyle = user.isBanned ? `${baseBtnStyle} background: linear-gradient(135deg, #10b981 0%, #059669 100%); box-shadow: 0 2px 5px rgba(16,185,129,0.3);` : `${baseBtnStyle} background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); box-shadow: 0 2px 5px rgba(239,68,68,0.3);`; 
        
        const resetStyle = `${baseBtnStyle} background: linear-gradient(135deg, #64748b 0%, #475569 100%); box-shadow: 0 2px 5px rgba(100,116,139,0.3);`;
        const resetBtnHtml = user.examStatus === 'testing' 
            ? `<button class="btn-user-action btn-reset-status" data-id="${user.userId}" style="${resetStyle}" onmouseover="this.style.transform='translateY(-1.5px)'" onmouseout="this.style.transform='translateY(0)'" title="Gỡ kẹt trạng thái đang thi"><i class="fa-solid fa-power-off"></i> Gỡ</button>` 
            : '';

        const hoverEffect = `onmouseover="this.style.transform='translateY(-1.5px)'" onmouseout="this.style.transform='translateY(0)'"`;

        const isChecked = selectedUserIds.has(user.userId) ? 'checked' : '';

        const actionButtonsHtml = `
            <button class="btn-user-action btn-notify-user" data-email="${user.email}" style="${notifyStyle}" ${hoverEffect} title="Gửi TB">🔔 Gửi</button>
            <button class="btn-user-action ${vipBtnClass} btn-toggle-vip" data-id="${user.userId}" data-vip="${user.isVip}" style="${vipStyle}" ${hoverEffect}>${vipBtnText}</button>
            <button class="btn-user-action btn-user-history btn-history" data-email="${user.email}" style="${historyStyle}" ${hoverEffect}>📊 Lịch Sử</button>
            <button class="btn-user-action btn-export-excel" data-email="${user.email}" style="${excelStyle}" ${hoverEffect} title="Tải Excel Lịch sử & XP"><i class="fa-solid fa-file-excel"></i> Tải XP</button>
            <button class="btn-user-action ${banBtnClass} btn-toggle-ban" data-id="${user.userId}" data-banned="${user.isBanned}" style="${banStyle}" ${hoverEffect}>${banBtnText}</button>
            ${resetBtnHtml}
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
                        <div style="font-weight: 600; color: #0f172a; font-size: 14px; display: flex; align-items: center; flex-wrap: nowrap;">
                            <span style="word-break: break-all;">${user.email}</span> 
                            ${onlineStatusHtml} ${testingBadgeHtml} ${scoreBadgeHtml} ${xpBadgeHtml} ${pendingBadge} ${costBadgeHtml}
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

// =========================================================================
// HÀM XỬ LÝ NÂNG CẤP VIP & GỬI EMAIL THÔNG BÁO (THỦ CÔNG MAILTO)
// =========================================================================
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

            // TÍNH NĂNG MỚI: Đẩy chuông thông báo và Mở trình duyệt gửi Email thủ công
            const u = cachedUsers.find(user => user.userId === userId);
            if (u && u.email) {
                // Đẩy thông báo vào chuông in-app
                await addDoc(collection(db, "notifications"), {
                    toEmail: u.email,
                    type: 'admin_direct',
                    title: '🎉 Nâng cấp PRO thành công',
                    message: 'Tài khoản của bạn đã được kích hoạt quyền VIP 30 ngày. Chúc bạn ôn thi hiệu quả!',
                    status: 'unread',
                    timestamp: serverTimestamp()
                });
                
                // Mở trình gửi mail thủ công (mailto)
                const mailSubject = encodeURIComponent("🎉 Kích hoạt tài khoản PRO thành công!");
                const mailBody = encodeURIComponent(`Chào bạn,\n\nTài khoản ${u.email} của bạn đã được kích hoạt quyền VIP thành công trên hệ thống.\nThời hạn sử dụng: 30 ngày.\n\nChúc bạn ôn thi đạt kết quả cao!`);
                window.location.href = `mailto:${u.email}?subject=${mailSubject}&body=${mailBody}`;
            }
        }
        
        showToast(`Đã ${newVipStatus ? 'kích hoạt' : 'hủy quyền'} tài khoản VIP thành công!`, "success");
        
        const u = cachedUsers.find(user => user.userId === userId);
        if (u) {
            u.isVip = newVipStatus;
            u.statusKey = newVipStatus ? 'vip' : 'normal';
            if (newVipStatus) {
                u.vipActivationDate = updates.vipActivationDate;
                u.vipExpirationDate = updates.vipExpirationDate;
            } else {
                u.vipActivationDate = null;
                u.vipExpirationDate = null;
            }
        }
        
        renderUserList(); 
        
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
        
        const u = cachedUsers.find(user => user.userId === userId);
        if (u) {
            u.isBanned = newBannedStatus;
            u.statusKey = newBannedStatus ? 'banned' : (u.isVip ? 'vip' : 'normal');
        }
        
        renderUserList(); 
        
    } catch (error) {
        console.error("Lỗi thay đổi trạng thái khóa:", error);
        showToast("Lỗi thay đổi trạng thái khóa tài khoản", "error");
    }
}

async function handleResetStatus(userId) {
    if (!confirm(`Xác nhận GỠ KẸT trạng thái cho tài khoản này (Ép ngoại tuyến và Hủy Đang thi)?`)) return;
    try {
        await updateDoc(doc(db, "users", userId), {
            isOnline: false,
            examStatus: 'none'
        });
        showToast(`Đã gỡ trạng thái kẹt thành công!`, "success");
        const u = cachedUsers.find(user => user.userId === userId);
        if (u) {
            u.isOnline = false;
            u.examStatus = 'none';
        }
        localTestingTimers.delete(userId);
        renderUserList();
    } catch (error) {
        console.error("Lỗi gỡ kẹt:", error);
        showToast("Lỗi hệ thống khi gỡ trạng thái", "error");
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
    let isVipAction = false, isBanAction = false, isResetAction = false;

    if (actionType === 'vip') {
        if(!confirm(`Bạn có chắc muốn ĐẢO NGƯỢC trạng thái VIP cho ${count} tài khoản đã chọn?`)) return;
        isVipAction = true;
    } else if (actionType === 'ban') {
        if(!confirm(`Bạn có chắc muốn ĐẢO NGƯỢC trạng thái KHÓA cho ${count} tài khoản đã chọn?`)) return;
        isBanAction = true;
    } else if (actionType === 'reset') {
        if(!confirm(`Bạn có chắc chắn muốn XÓA TRẠNG THÁI KẸT (Ép ngoại tuyến và Hủy Đang thi) cho ${count} tài khoản đã chọn?`)) return;
        isResetAction = true;
    }

    const promises = [];
    let vipEmailsToNotify = []; // Mảng chứa các email cần gửi BCC

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

                if (u.email) {
                    // Đẩy thông báo chuông in-app
                    promises.push(addDoc(collection(db, "notifications"), {
                        toEmail: u.email,
                        type: 'admin_direct',
                        title: '🎉 Nâng cấp PRO thành công',
                        message: 'Tài khoản của bạn đã được kích hoạt quyền VIP 30 ngày. Chúc bạn ôn thi hiệu quả!',
                        status: 'unread',
                        timestamp: serverTimestamp()
                    }));
                    
                    vipEmailsToNotify.push(u.email); // Lưu email vào danh sách để gửi thủ công
                }
            }
        }
        if (isBanAction) {
            updates.isBanned = !u.isBanned;
        }
        if (isResetAction) {
            updates.isOnline = false;
            updates.examStatus = 'none';
        }
        promises.push(updateDoc(userRef, updates));
    });

    try {
        await Promise.all(promises);
        showToast(`Đã thực thi thao tác thành công trên ${count} tài khoản!`, "success");
        
        // Kích hoạt gửi email thủ công hàng loạt (Cho vào mục BCC để bảo mật thông tin)
        if (vipEmailsToNotify.length > 0) {
            const mailSubject = encodeURIComponent("🎉 Kích hoạt tài khoản PRO thành công!");
            const mailBody = encodeURIComponent(`Chào bạn,\n\nTài khoản của bạn đã được kích hoạt quyền VIP thành công trên hệ thống.\nThời hạn sử dụng: 30 ngày.\n\nChúc bạn ôn thi đạt kết quả cao!`);
            window.location.href = `mailto:?bcc=${vipEmailsToNotify.join(',')}&subject=${mailSubject}&body=${mailBody}`;
        }
        
        selectedUserIds.forEach(id => {
            const u = cachedUsers.find(user => user.userId === id);
            if (!u) return;
            if (isVipAction) {
                u.isVip = !u.isVip;
                u.statusKey = u.isVip ? 'vip' : 'normal';
                if (u.isVip) {
                    u.vipActivationDate = Date.now();
                    u.vipExpirationDate = Date.now() + (30 * 24 * 60 * 60 * 1000);
                } else {
                    u.vipActivationDate = null;
                    u.vipExpirationDate = null;
                }
            }
            if (isBanAction) {
                u.isBanned = !u.isBanned;
                if (u.isBanned) u.statusKey = 'banned';
                else u.statusKey = u.isVip ? 'vip' : 'normal';
            }
            if (isResetAction) {
                u.isOnline = false;
                u.examStatus = 'none';
                localTestingTimers.delete(id);
            }
        });
        
        selectedUserIds.clear();
        renderUserList(); 
    } catch(err) {
        console.error("Lỗi bulk actions:", err);
        showToast("Lỗi khi thực thi hàng loạt", "error");
    }
}

document.addEventListener('componentsLoaded', () => {
    loadUserList(); 
    initRealtimePaymentListener();
    initAutoClearGhostSessions(); 

    const sidebarMenuItems = document.querySelectorAll('.menu-item');
    sidebarMenuItems.forEach(item => {
        item.addEventListener('click', (e) => {
            const target = item.getAttribute('data-target');
            if (target === 'tab-users') {
                loadUserList(false); 
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
                await loadUserList(true); 
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
            notifyAllBtn.onclick = () => openNotificationModal('ALL');
            toolbar.appendChild(notifyAllBtn);
        }
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

            const excelBtn = e.target.closest('.btn-export-excel');
            if (excelBtn) return exportUserHistoryToExcel(excelBtn.dataset.email);

            const resetBtn = e.target.closest('.btn-reset-status');
            if (resetBtn) return handleResetStatus(resetBtn.dataset.id);

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
