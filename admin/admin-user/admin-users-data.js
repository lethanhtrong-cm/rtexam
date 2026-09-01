// ==========================================
// FILE: admin-user/admin-users-data.js
// QUẢN LÝ KẾT NỐI DỮ LIỆU VÀ TRẠNG THÁI (STATE)
// TỐI ƯU HÓA QUOTA: Đã loại bỏ việc fetch toàn bộ bảng "results"
// ==========================================
import { db } from '../admin-core.js';
import { 
    collection, onSnapshot, doc, updateDoc, getDocs
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { renderPaymentHistory } from './admin-users-ui.js';

// 1. TRẠNG THÁI DÙNG CHUNG (SINGLE SOURCE OF TRUTH)
export const userState = {
    cachedUsers: [],
    pendingVIPRequests: new Map(), // SỬA THÀNH MAP ĐỂ LƯU KÈM TÊN GÓI (PLUS/PRO)
    allPaymentUIDs: new Set(), 
    cachedPaymentRequests: [], 
    isUserListLoaded: false,
    isLeaderboardLoaded: false,
    globalLeaderboardStats: {},
    selectedUserIds: new Set(),
    currentSearchQuery: "",
    currentFilterStatus: "all",
    currentSortMethod: "newest",
    currentPage: 1,
    itemsPerPage: 20
};

// Hàm tiện ích format thời gian dùng chung
export function formatDateTime(timestamp) {
    if (!timestamp) return '---';
    const date = (typeof timestamp.toDate === 'function') ? timestamp.toDate() : new Date(timestamp);
    if (isNaN(date.getTime())) return '---';
    return date.toLocaleDateString('vi-VN') + ' ' + date.toLocaleTimeString('vi-VN', {hour: '2-digit', minute:'2-digit'});
}

// 2. LẮNG NGHE YÊU CẦU THANH TOÁN (REALTIME)
export function initRealtimePaymentListener(onDataUpdated) {
    onSnapshot(collection(db, "payment_requests"), (snapshot) => {
        userState.pendingVIPRequests.clear();
        userState.allPaymentUIDs.clear();
        userState.cachedPaymentRequests = [];

        snapshot.forEach((docSnap) => {
            const data = docSnap.data();
            data.id = docSnap.id;
            
            // Lưu vào mảng và tập hợp tổng
            userState.cachedPaymentRequests.push(data);
            userState.allPaymentUIDs.add(data.uid);

            if (data.status === "pending") {
                // Lưu ID kèm theo tên gói người dùng đang yêu cầu (Mặc định là plus nếu ko có)
                userState.pendingVIPRequests.set(data.uid, data.requestedTier || 'plus');
            }
        });

        // Sắp xếp lịch sử thanh toán: Mới nhất lên đầu
        userState.cachedPaymentRequests.sort((a, b) => {
            const tA = a.timestamp ? (typeof a.timestamp.toDate === 'function' ? a.timestamp.toDate().getTime() : new Date(a.timestamp).getTime()) : 0;
            const tB = b.timestamp ? (typeof b.timestamp.toDate === 'function' ? b.timestamp.toDate().getTime() : new Date(b.timestamp).getTime()) : 0;
            return tB - tA;
        });

        const badge = document.getElementById('pending-vip-badge');
        if (badge) {
            if (userState.pendingVIPRequests.size > 0) {
                badge.style.display = 'inline-block';
                badge.innerText = userState.pendingVIPRequests.size;
            } else {
                badge.style.display = 'none';
            }
        }

        renderPaymentHistory();

        if (userState.isUserListLoaded && typeof onDataUpdated === 'function') {
            onDataUpdated();
        }
    }, (error) => {
        console.error("Lỗi khi tải yêu cầu thanh toán:", error);
    });
}

// 3. TẢI DỮ LIỆU TỪ FIREBASE
export async function fetchAllUserData(forceRefresh = false, callbacks = {}) {
    const { onStart, onSuccess, onError } = callbacks;

    if (!forceRefresh && userState.isUserListLoaded) {
        if (onSuccess) onSuccess(false); 
        return;
    }

    if (!userState.isUserListLoaded && onStart) {
        onStart();
    }

    try {
        let promises = [getDocs(collection(db, "users"))];
        let leaderboardIndex = -1;

        if (!userState.isLeaderboardLoaded || forceRefresh) {
            promises.push(getDocs(collection(db, "users_leaderboard")));
            leaderboardIndex = promises.length - 1;
        }

        const snapshots = await Promise.all(promises);
        const usersSnap = snapshots[0];

        if (leaderboardIndex !== -1) {
            userState.globalLeaderboardStats = {};
            snapshots[leaderboardIndex].forEach(docSnap => {
                userState.globalLeaderboardStats[docSnap.id] = docSnap.data().totalXP || 0;
            });
            userState.isLeaderboardLoaded = true;
        }

        userState.cachedUsers = [];
        let totalUsersCount = 0;
        let totalVipsCount = 0;

        usersSnap.forEach((docSnap) => {
            const user = docSnap.data();
            const userId = docSnap.id;
            const email = user.email || 'Chưa cập nhật';
            const isBanned = user.isBanned || false;
            
            // XỬ LÝ CHUYỂN ĐỔI LOGIC VIP -> PLUS/PRO
            const isVipLegacy = user.isVip || false;
            let vipTier = user.vipTier || null;
            
            if (!vipTier && isVipLegacy) {
                vipTier = 'plus';
            }

            const totalTokensUsed = user.totalTokensUsed || 0;
            const aiDailyCount = user.aiDailyCount || 0;           // Đã giữ lại từ file của bạn
            const aiLastUsedDate = user.aiLastUsedDate || '';      // Đã giữ lại từ file của bạn
            const viewedLecturesCount = user.viewedLecturesCount || 0; // THÊM MỚI: Trích xuất số bài giảng đã xem
            const finalAvgScore = user.avgScore || 0;
            const finalXp = userState.globalLeaderboardStats[userId] || 0;

            let createdAtRaw = user.firstLogin || user.creationTime || user.createdAt || user.timestamp;
            if (!createdAtRaw) {
                createdAtRaw = Date.now();
                updateDoc(doc(db, "users", userId), { createdAt: createdAtRaw }).catch(e=>e);
            }
            let createdAtMs = (typeof createdAtRaw.toDate === 'function') ? createdAtRaw.toDate().getTime() : new Date(createdAtRaw).getTime();

            totalUsersCount++;
            if (vipTier) totalVipsCount++; 

            let statusKey = 'normal';
            if (isBanned) statusKey = 'banned';
            else if (vipTier) statusKey = 'vip';

            userState.cachedUsers.push({
                userId: userId,
                email: email,
                vipTier: vipTier,
                isBanned: isBanned,
                statusKey: statusKey,
                totalTokensUsed: totalTokensUsed,
                aiDailyCount: aiDailyCount,          // Đã giữ lại
                aiLastUsedDate: aiLastUsedDate,      // Đã giữ lại
                viewedLecturesCount: viewedLecturesCount, // THÊM MỚI
                avgScore: finalAvgScore, 
                xp: finalXp, 
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

        userState.isUserListLoaded = true;
        userState.selectedUserIds.clear();
        
        renderPaymentHistory();

        if (onSuccess) onSuccess(true); 

    } catch (error) {
        console.error("Lỗi kết nối Firestore khi tải danh sách người dùng:", error);
        userState.isUserListLoaded = false;
        if (onError) onError(error);
    }
}
