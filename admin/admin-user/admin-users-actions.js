// ==========================================
// FILE: admin-user/admin-users-actions.js
// QUẢN LÝ LOGIC NGHIỆP VỤ: NÚT BẤM, XUẤT EXCEL, BULK ACTIONS
// ==========================================
import { db, showToast } from '../admin-core.js';
import { doc, updateDoc, query, where, getDocs, collection } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { userState } from './admin-users-data.js';
import { renderUserList, updateBulkActionBar } from './admin-users-ui.js';
import { handleViewHistory } from './admin-history.js';
import { openNotificationModal } from './admin-users-notify.js';

export async function exportUserHistoryToExcel(email) {
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

        const targetUser = userState.cachedUsers.find(u => u.email === email);
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

async function handleToggleVip(userId, currentVipStatus) {
    const u = userState.cachedUsers.find(user => user.userId === userId);
    if (!u) return;

    const newVipStatus = !currentVipStatus;
    let updates = { isVip: newVipStatus };

    // 1. CẬP NHẬT TRẠNG THÁI LOCAL NGAY LẬP TỨC (Optimistic UI Update)
    u.isVip = newVipStatus;
    u.statusKey = newVipStatus ? 'vip' : 'normal';
    
    if (newVipStatus) {
        const now = Date.now();
        updates.vipActivationDate = now;
        updates.vipExpirationDate = now + (30 * 24 * 60 * 60 * 1000);
        u.vipActivationDate = updates.vipActivationDate;
        u.vipExpirationDate = updates.vipExpirationDate;
    } else {
        updates.vipActivationDate = null;
        updates.vipExpirationDate = null;
        u.vipActivationDate = null;
        u.vipExpirationDate = null;
    }

    // Vẽ lại UI lập tức để khóa trạng thái mới, chống xung đột Realtime Listener
    renderUserList();

    try {
        // 2. Tiến hành đẩy dữ liệu lên Firestore
        const userRef = doc(db, "users", userId);
        await updateDoc(userRef, updates);
        
        if (newVipStatus) {
            try {
                const q = query(collection(db, "payment_requests"), where("uid", "==", userId), where("status", "==", "pending"));
                const snapshot = await getDocs(q);
                const paymentPromises = [];
                snapshot.forEach((docSnap) => {
                    paymentPromises.push(updateDoc(docSnap.ref, { status: "completed" }));
                });
                await Promise.all(paymentPromises);
            } catch (err) {
                console.warn("Bỏ qua lỗi BloomFilter của payment_requests:", err);
            }
        }
        
        showToast(`Đã ${newVipStatus ? 'kích hoạt' : 'hủy quyền'} tài khoản VIP thành công!`, "success");
        
    } catch (error) {
        console.error("Lỗi cập nhật VIP:", error);
        const msg = error.code === 'resource-exhausted' ? "LỖI: Đã hết Quota Firebase ngày hôm nay!" : "Lỗi mạng! Đang khôi phục lại trạng thái cũ...";
        showToast(msg, "error");
        
        // 3. Rollback (Hoàn tác) nếu có lỗi mạng xảy ra
        u.isVip = currentVipStatus;
        u.statusKey = currentVipStatus ? 'vip' : 'normal';
        renderUserList(); 
    }
}

async function handleToggleBan(userId, currentBannedStatus) {
    const actionText = currentBannedStatus ? 'mở khóa' : 'khóa vĩnh viễn';
    if (!confirm(`Hệ thống cảnh báo: Bạn có chắc chắn thực hiện lệnh ${actionText} tài khoản học viên này không?`)) return;

    const u = userState.cachedUsers.find(user => user.userId === userId);
    if (!u) return;

    const newBannedStatus = !currentBannedStatus;

    // Optimistic Update
    u.isBanned = newBannedStatus;
    u.statusKey = newBannedStatus ? 'banned' : (u.isVip ? 'vip' : 'normal');
    renderUserList();

    try {
        const userRef = doc(db, "users", userId);
        await updateDoc(userRef, { isBanned: newBannedStatus });
        showToast(`Đã thực thi lệnh ${currentBannedStatus ? 'mở khóa' : 'khóa'} tài khoản thành công!`, "success");
    } catch (error) {
        console.error("Lỗi thay đổi trạng thái khóa:", error);
        showToast("Lỗi mạng! Khôi phục trạng thái...", "error");
        
        // Rollback
        u.isBanned = currentBannedStatus;
        u.statusKey = currentBannedStatus ? 'banned' : (u.isVip ? 'vip' : 'normal');
        renderUserList(); 
    }
}

let isProcessingBulk = false;

export async function handleBulkAction(actionType) {
    if (userState.selectedUserIds.size === 0) return;
    
    if (actionType === 'notify') {
        const emails = [];
        userState.selectedUserIds.forEach(id => {
            const u = userState.cachedUsers.find(user => user.userId === id);
            if(u) emails.push(u.email);
        });
        openNotificationModal(emails.join(', '));
        return;
    }

    if (isProcessingBulk) {
        showToast("Hệ thống đang xử lý, vui lòng chờ...", "warning");
        return;
    }

    const count = userState.selectedUserIds.size;
    let isVipAction = false, isBanAction = false;

    if (actionType === 'vip') {
        if(!confirm(`Bạn có chắc muốn ĐẢO NGƯỢC trạng thái VIP cho ${count} tài khoản đã chọn?`)) return;
        isVipAction = true;
    } else if (actionType === 'ban') {
        if(!confirm(`Bạn có chắc muốn ĐẢO NGƯỢC trạng thái KHÓA cho ${count} tài khoản đã chọn?`)) return;
        isBanAction = true;
    }

    isProcessingBulk = true;
    const promises = [];

    // 1. Áp dụng Optimistic Update cho hàng loạt tài khoản
    userState.selectedUserIds.forEach(id => {
        const u = userState.cachedUsers.find(user => user.userId === id);
        if (!u) return;
        
        let updates = {};
        if (isVipAction) {
            const newVipStatus = !u.isVip;
            updates.isVip = newVipStatus;
            
            if (newVipStatus) {
                const now = Date.now();
                updates.vipActivationDate = now;
                updates.vipExpirationDate = now + (30 * 24 * 60 * 60 * 1000);
            } else {
                updates.vipActivationDate = null;
                updates.vipExpirationDate = null;
            }

            // Ghi đè Local State
            u.isVip = newVipStatus;
            u.statusKey = newVipStatus ? 'vip' : 'normal';
            u.vipActivationDate = updates.vipActivationDate;
            u.vipExpirationDate = updates.vipExpirationDate;
        }

        if (isBanAction) {
            updates.isBanned = !u.isBanned;
            // Ghi đè Local State
            u.isBanned = updates.isBanned;
            u.statusKey = updates.isBanned ? 'banned' : (u.isVip ? 'vip' : 'normal');
        }

        promises.push(updateDoc(doc(db, "users", id), updates));
    });

    // 2. Vẽ lại UI ngay lập tức
    renderUserList();

    try {
        await Promise.all(promises);
        showToast(`Đã thực thi thao tác thành công trên ${count} tài khoản!`, "success");
        userState.selectedUserIds.clear();
        updateBulkActionBar();
        renderUserList(); 
    } catch(err) {
        console.error("Lỗi bulk actions:", err);
        showToast("Có lỗi mạng khi thực thi hàng loạt. Vui lòng F5 tải lại trang!", "error");
    } finally {
        isProcessingBulk = false;
    }
}

export function initUserActionEvents() {
    const usersBody = document.getElementById('usersTableBody');
    if (usersBody) {
        usersBody.addEventListener('change', (e) => {
            if (e.target.classList.contains('user-row-checkbox')) {
                if (e.target.checked) userState.selectedUserIds.add(e.target.dataset.id);
                else userState.selectedUserIds.delete(e.target.dataset.id);
                updateBulkActionBar();
            }
        });

        usersBody.addEventListener('click', (e) => {
            if(e.target.classList.contains('user-row-checkbox')) return; 

            const excelBtn = e.target.closest('.btn-export-excel');
            if (excelBtn) return exportUserHistoryToExcel(excelBtn.dataset.email);

            const notifyBtn = e.target.closest('.btn-notify-user');
            if (notifyBtn) return openNotificationModal(notifyBtn.dataset.email);

            const vipBtn = e.target.closest('.btn-toggle-vip');
            if (vipBtn) {
                if (vipBtn.disabled) return;
                vipBtn.disabled = true; 
                vipBtn.innerHTML = '⏳ Đang xử lý...';
                return handleToggleVip(vipBtn.dataset.id, vipBtn.dataset.vip === 'true');
            }

            const banBtn = e.target.closest('.btn-toggle-ban');
            if (banBtn) {
                if (banBtn.disabled) return;
                banBtn.disabled = true; 
                banBtn.innerHTML = '⏳ Xử lý...';
                return handleToggleBan(banBtn.dataset.id, banBtn.dataset.banned === 'true');
            }

            const historyBtn = e.target.closest('.btn-history');
            if (historyBtn) return handleViewHistory(historyBtn.dataset.email);
        });
    }

    // Bắt sự kiện Click cho thanh công cụ Bulk Actions (Event Delegation)
    document.addEventListener('click', (e) => {
        if (e.target.closest('#btnBulkVip')) return handleBulkAction('vip');
        if (e.target.closest('#btnBulkBan')) return handleBulkAction('ban');
        if (e.target.closest('#btnBulkNotify')) return handleBulkAction('notify');
    });
}
