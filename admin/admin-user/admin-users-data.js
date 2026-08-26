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
    pendingVIPRequests: new Set(),
    allPaymentUIDs: new Set(), // THÊM MỚI: Lưu toàn bộ UID đã từng CK
    cachedPaymentRequests: [], // THÊM MỚI: Lưu mảng data lịch sử CK
    isUserListLoaded: false,
    isLeaderboardLoaded: false,
    globalLeaderboardStats: {},
    // Biến phục vụ UI & Hành động
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
                userState.pendingVIPRequests.add(data.uid);
            }
        });

        // Sắp xếp lịch sử thanh toán: Mới nhất lên đầu
        userState.cachedPaymentRequests.sort((a, b) => {
            const tA = a.timestamp ? (typeof a.timestamp.toDate === 'function' ? a.timestamp.toDate().getTime() : new Date(a.timestamp).getTime()) : 0;
            const tB = b.timestamp ? (typeof b.timestamp.toDate === 'function' ? b.timestamp.toDate().getTime() : new Date(b.timestamp).getTime()) : 0;
            return tB - tA;
        });

        // Cập nhật chuông thông báo (badge) trên Sidebar
        const badge = document.getElementById('pending-vip-badge');
        if (badge) {
            if (userState.pendingVIPRequests.size > 0) {
                badge.style.display = 'inline-block';
                badge.innerText = userState.pendingVIPRequests.size;
            } else {
                badge.style.display = 'none';
            }
        }

        // Gọi hàm render bảng Lịch sử thanh toán bên UI
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
            const isVip = user.isVip || false;
            const isBanned = user.isBanned || false;
            
            const totalTokensUsed = user.totalTokensUsed || 0;

            const finalAvgScore = user.avgScore || 0;
            const finalXp = userState.globalLeaderboardStats[userId] || 0;

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

            userState.cachedUsers.push({
                userId: userId,
                email: email,
                isVip: isVip,
                isBanned: isBanned,
                statusKey: statusKey,
                totalTokensUsed: totalTokensUsed,
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
        
        // Gọi lại renderPaymentHistory để lấy thông tin Email thực tế từ danh sách User vừa tải xong
        renderPaymentHistory();

        if (onSuccess) onSuccess(true); 

    } catch (error) {
        console.error("Lỗi kết nối Firestore khi tải danh sách người dùng:", error);
        userState.isUserListLoaded = false;
        if (onError) onError(error);
    }
}
