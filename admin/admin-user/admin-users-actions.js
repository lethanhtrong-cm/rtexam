// ==========================================
// FILE: admin-user/admin-users-actions.js
// QUẢN LÝ LOGIC NGHIỆP VỤ: NÚT BẤM, XUẤT EXCEL, BULK ACTIONS
// ==========================================
import { db, showToast } from '../admin-core.js';
import { doc, updateDoc, setDoc, query, where, getDocs, collection, deleteDoc, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
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

// ==============================================================
// HÀM DUYỆT GÓI MỚI (TỪ LỊCH SỬ THANH TOÁN)
// ==============================================================
async function approveUserUpgrade(uid, userEmail, tierName, durationDays = 30) {
    try {
        const now = Date.now();
        const durationMs = durationDays * 24 * 60 * 60 * 1000;
        const expirationDate = now + durationMs;

        // 1. Cập nhật phân quyền vào collection 'users'
        await setDoc(doc(db, "users", uid), {
            vipTier: tierName,            
            vipActivationDate: now,
            vipExpirationDate: expirationDate,
            isVip: null 
        }, { merge: true });

        // 2. TÌM VÀ CẬP NHẬT TRẠNG THÁI YÊU CẦU THÀNH COMPLETED
        const q = query(collection(db, "payment_requests"), where("uid", "==", uid), where("status", "==", "pending"));
        const reqSnap = await getDocs(q);
        const reqPromises = [];
        reqSnap.forEach(reqDoc => {
            reqPromises.push(updateDoc(reqDoc.ref, {
                status: "completed",
                approvedAt: serverTimestamp()
            }));
        });
        await Promise.all(reqPromises); 

        // 3. Đẩy thông báo thành công cho người dùng
        await addDoc(collection(db, "notifications"), {
            toEmail: userEmail,
            title: `👑 Kích hoạt tài khoản ${tierName.toUpperCase()} thành công!`,
            message: `Admin đã xác nhận thanh toán. Gói ${tierName.toUpperCase()} của bạn đã được mở khóa với đầy đủ đặc quyền.`,
            status: "unread",
            type: "system_broadcast",
            timestamp: serverTimestamp()
        });

        // 4. Ghi đè Local State ngay lập tức để giao diện không bị giật lag
        const u = userState.cachedUsers.find(user => user.userId === uid);
        if (u) {
            u.vipTier = tierName;
            u.statusKey = 'vip';
            u.vipActivationDate = now;
            u.vipExpirationDate = expirationDate;
        }

        showToast(`Đã duyệt thành công gói ${tierName.toUpperCase()} cho ${userEmail}`, "success");
        renderUserList();
    } catch (error) {
        console.error("Lỗi khi duyệt nâng cấp cho user:", error);
        showToast("Lỗi hệ thống: " + error.message, "error");
    }
}

// Bật tắt thủ công từ danh sách
async function handleToggleVip(userId, targetTier) {
    const u = userState.cachedUsers.find(user => user.userId === userId);
    if (!u) return;

    const isActivating = targetTier !== 'none';
    
    let updates = { 
        vipTier: isActivating ? targetTier : null,
        isVip: null,
        vipStart: null,
        vipEnd: null
    };

    const prevTier = u.vipTier;
    const prevStatusKey = u.statusKey;
    const prevAct = u.vipActivationDate;
    const prevExp = u.vipExpirationDate;

    // CẬP NHẬT LOCAL NGAY LẬP TỨC 
    u.vipTier = updates.vipTier;
    u.statusKey = isActivating ? 'vip' : 'normal';
    
    if (isActivating) {
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

    renderUserList();

    try {
        const userRef = doc(db, "users", userId);
        await setDoc(userRef, updates, { merge: true });

        // NẾU KÍCH HOẠT, CẬP NHẬT THÔNG BÁO CHỜ DUYỆT BÊN PAYMENT REQUESTS ĐỂ ẨN BADGE CẢNH BÁO
        if (isActivating) {
            const q = query(collection(db, "payment_requests"), where("uid", "==", userId), where("status", "==", "pending"));
            const reqSnap = await getDocs(q);
            const reqPromises = [];
            reqSnap.forEach(reqDoc => {
                reqPromises.push(updateDoc(reqDoc.ref, {
                    status: "completed",
                    approvedAt: serverTimestamp()
                }));
            });
            await Promise.all(reqPromises);
        }

        showToast(`Đã ${isActivating ? 'kích hoạt gói ' + targetTier.toUpperCase() : 'hủy quyền'} thành công!`, "success");
    } catch (error) {
        console.error("Lỗi cập nhật VIP:", error);
        const msg = error.code === 'resource-exhausted' ? "LỖI: Đã hết Quota Firebase ngày hôm nay!" : "Lỗi mạng! Đang khôi phục lại trạng thái cũ...";
        showToast(msg, "error");
        
        u.vipTier = prevTier;
        u.statusKey = prevStatusKey;
        u.vipActivationDate = prevAct;
        u.vipExpirationDate = prevExp;
        renderUserList(); 
    }
}

async function handleToggleBan(userId, currentBannedStatus) {
    const actionText = currentBannedStatus ? 'mở khóa' : 'khóa vĩnh viễn';
    if (!confirm(`Hệ thống cảnh báo: Bạn có chắc chắn thực hiện lệnh ${actionText} tài khoản học viên này không?`)) return;

    const u = userState.cachedUsers.find(user => user.userId === userId);
    if (!u) return;

    const newBannedStatus = !currentBannedStatus;

    u.isBanned = newBannedStatus;
    u.statusKey = newBannedStatus ? 'banned' : (u.vipTier ? 'vip' : 'normal');
    renderUserList();

    try {
        const userRef = doc(db, "users", userId);
        await setDoc(userRef, { isBanned: newBannedStatus }, { merge: true });
        showToast(`Đã thực thi lệnh ${currentBannedStatus ? 'mở khóa' : 'khóa'} tài khoản thành công!`, "success");
    } catch (error) {
        console.error("Lỗi thay đổi trạng thái khóa:", error);
        showToast("Lỗi mạng! Khôi phục trạng thái...", "error");
        
        u.isBanned = currentBannedStatus;
        u.statusKey = currentBannedStatus ? 'banned' : (u.vipTier ? 'vip' : 'normal');
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
        if(!confirm(`Bạn có chắc muốn ĐẢO NGƯỢC trạng thái gói cước (Thường <-> Plus) cho ${count} tài khoản đã chọn?`)) return;
        isVipAction = true;
    } else if (actionType === 'ban') {
        if(!confirm(`Bạn có chắc muốn ĐẢO NGƯỢC trạng thái KHÓA cho ${count} tài khoản đã chọn?`)) return;
        isBanAction = true;
    }

    isProcessingBulk = true;
    const promises = [];

    userState.selectedUserIds.forEach(id => {
        const u = userState.cachedUsers.find(user => user.userId === id);
        if (!u) return;
        
        let updates = {};
        let newVipStatus = false;

        if (isVipAction) {
            const isCurrentlyActive = !!u.vipTier;
            newVipStatus = !isCurrentlyActive;
            
            updates.vipTier = newVipStatus ? 'plus' : null;
            updates.isVip = null;
            updates.vipStart = null;
            updates.vipEnd = null;
            
            if (newVipStatus) {
                const now = Date.now();
                updates.vipActivationDate = now;
                updates.vipExpirationDate = now + (30 * 24 * 60 * 60 * 1000);
            } else {
                updates.vipActivationDate = null;
                updates.vipExpirationDate = null;
            }

            u.vipTier = updates.vipTier;
            u.statusKey = newVipStatus ? 'vip' : 'normal';
            u.vipActivationDate = updates.vipActivationDate;
            u.vipExpirationDate = updates.vipExpirationDate;
        }

        if (isBanAction) {
            updates.isBanned = !u.isBanned;
            u.isBanned = updates.isBanned;
            u.statusKey = updates.isBanned ? 'banned' : (u.vipTier ? 'vip' : 'normal');
        }

        promises.push((async () => {
            await setDoc(doc(db, "users", id), updates, { merge: true });
            
            // Xử lý dọn dẹp payment_requests nếu là bật VIP
            if (isVipAction && newVipStatus) {
                const q = query(collection(db, "payment_requests"), where("uid", "==", id), where("status", "==", "pending"));
                const reqSnap = await getDocs(q);
                const reqPromises = [];
                reqSnap.forEach(reqDoc => {
                    reqPromises.push(updateDoc(reqDoc.ref, { status: "completed", approvedAt: serverTimestamp() }));
                });
                await Promise.all(reqPromises);
            }
        })());
    });

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
                const originalHtml = vipBtn.innerHTML;
                vipBtn.innerHTML = '⏳...';
                
                handleToggleVip(vipBtn.dataset.id, vipBtn.dataset.tier).finally(() => {
                    // Logic mở khoá nút sẽ tự động thay đổi khi UI load lại
                });
                return;
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
    
    const paymentBody = document.getElementById('payment-history-body');
    if (paymentBody) {
        paymentBody.addEventListener('click', (e) => {
            // NÚT XÓA BẢN GHI LỊCH SỬ CHUYỂN KHOẢN (MỚI THÊM)
            const deletePaymentBtn = e.target.closest('.btn-delete-payment');
            if (deletePaymentBtn) {
                if (deletePaymentBtn.disabled) return;
                const docId = deletePaymentBtn.dataset.id;
                
                if (confirm("Hệ thống cảnh báo: Bạn có chắc chắn muốn xóa bản ghi báo cáo chuyển khoản này không? Hành động này CHỈ xóa lịch sử báo cáo, KHÔNG ảnh hưởng đến quyền hay tài khoản của người dùng!")) {
                    const originalHtml = deletePaymentBtn.innerHTML;
                    deletePaymentBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
                    deletePaymentBtn.disabled = true;
                    
                    deleteDoc(doc(db, "payment_requests", docId)).then(() => {
                        showToast("Xóa bản ghi lịch sử chuyển khoản thành công!", "success");
                    }).catch(err => {
                        console.error("Lỗi xóa lịch sử thanh toán:", err);
                        showToast("Lỗi hệ thống khi xóa bản ghi!", "error");
                        deletePaymentBtn.innerHTML = originalHtml;
                        deletePaymentBtn.disabled = false;
                    });
                }
                return;
            }

            // XỬ LÝ NÚT DUYỆT GÓI
            const approveTierBtn = e.target.closest('.btn-approve-tier');
            if (approveTierBtn) {
                if (approveTierBtn.disabled) return;
                approveTierBtn.disabled = true;
                const originalHtml = approveTierBtn.innerHTML;
                approveTierBtn.innerHTML = '⏳...';
                
                approveUserUpgrade(
                    approveTierBtn.dataset.id,
                    approveTierBtn.dataset.email,
                    approveTierBtn.dataset.tier
                ).finally(() => {
                    approveTierBtn.disabled = false;
                    approveTierBtn.innerHTML = originalHtml;
                });
            }
        });
    }

    document.addEventListener('click', (e) => {
        if (e.target.closest('#btnBulkVip')) return handleBulkAction('vip');
        if (e.target.closest('#btnBulkBan')) return handleBulkAction('ban');
        if (e.target.closest('#btnBulkNotify')) return handleBulkAction('notify');
    });
}
