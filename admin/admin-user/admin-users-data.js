// ==========================================
// FILE: admin-user/admin-users-data.js
// QUẢN LÝ KẾT NỐI DỮ LIỆU, TRẠNG THÁI (STATE) VÀ LOGIC NGẦM
// ==========================================
import { db } from '../admin-core.js';
import { 
    collection, onSnapshot, doc, updateDoc, query, where, getDocs
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";

// 1. TRẠNG THÁI DÙNG CHUNG (SINGLE SOURCE OF TRUTH)
export const userState = {
    cachedUsers: [],
    pendingVIPRequests: new Set(),
    localTestingTimers: new Map(),
    isUserListLoaded: false,
    isResultsLoaded: false,
    isLeaderboardLoaded: false,
    globalResultsStats: {},
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
        snapshot.forEach((docSnap) => {
            const data = docSnap.data();
            if (data.status === "pending") {
                userState.pendingVIPRequests.add(data.uid);
            }
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
        if (onSuccess) onSuccess(false); // false biểu thị không cần render lại thanh công cụ
        return;
    }

    if (!userState.isUserListLoaded && onStart) {
        onStart();
    }

    try {
        let promises = [getDocs(collection(db, "users"))];
        let resultsIndex = -1;
        let leaderboardIndex = -1;

        if (!userState.isResultsLoaded || forceRefresh) {
            promises.push(getDocs(collection(db, "results")));
            resultsIndex = promises.length - 1;
        }
        
        if (!userState.isLeaderboardLoaded || forceRefresh) {
            promises.push(getDocs(collection(db, "users_leaderboard")));
            leaderboardIndex = promises.length - 1;
        }

        const snapshots = await Promise.all(promises);
        const usersSnap = snapshots[0];
        
        const auth = getAuth();
        const currentAdminEmail = auth.currentUser ? auth.currentUser.email : null;

        if (resultsIndex !== -1) {
            userState.globalResultsStats = {};
            snapshots[resultsIndex].forEach(docSnap => {
                const data = docSnap.data();
                const email = data.email;
                if (!email) return;
                
                if (!userState.globalResultsStats[email]) userState.globalResultsStats[email] = { totalScore: 0, count: 0 };
                userState.globalResultsStats[email].totalScore += (parseFloat(data.score) || 0);
                userState.globalResultsStats[email].count += 1;
            });
            userState.isResultsLoaded = true;
        }

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
                if (!userState.localTestingTimers.has(userId)) {
                    userState.localTestingTimers.set(userId, Date.now()); 
                }
            } else {
                userState.localTestingTimers.delete(userId); 
            }

            const rStats = userState.globalResultsStats[email] || { totalScore: 0, count: 0 };
            const finalAvgScore = rStats.count > 0 ? (rStats.totalScore / rStats.count) : 0;
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
                localTestingStartMs: userState.localTestingTimers.get(userId)
            });
        });

        // Bắn dữ liệu ra UI Header (Vì đây là thông số chung của Header, có thể để ở đây cho gọn)
        const totalUsersEl = document.getElementById('totalUsers');
        const totalVipUsersEl = document.getElementById('totalVipUsers');
        if (totalUsersEl) totalUsersEl.innerText = totalUsersCount;
        if (totalVipUsersEl) totalVipUsersEl.innerText = totalVipsCount;

        userState.isUserListLoaded = true;
        userState.selectedUserIds.clear();
        
        if (onSuccess) onSuccess(true); // true -> Yêu cầu UI gọi hàm Inject Toolbar

    } catch (error) {
        console.error("Lỗi kết nối Firestore khi tải danh sách người dùng:", error);
        userState.isUserListLoaded = false;
        if (onError) onError(error);
    }
}

// 4. AUTO CLEAR GHOST SESSIONS
export function initAutoClearGhostSessions(onDataUpdated) {
    setInterval(async () => {
        const testingUsers = userState.cachedUsers.filter(u => u.examStatus === 'testing');
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
                    
                    userState.localTestingTimers.delete(user.userId);
                    
                    user.isOnline = false;
                    user.examStatus = 'none';
                    clearedCount++;
                } catch (e) {
                    console.error(`Lỗi tự động gỡ kẹt cho user ${user.userId}:`, e);
                }
            }
        }

        if (clearedCount > 0) {
            console.log(`[Auto-GC] Đã tự động dọn dẹp ${clearedCount} phiên thi bị kẹt quá 45 phút.`);
            if (typeof onDataUpdated === 'function') onDataUpdated();
        }
    }, 60000); 
}
