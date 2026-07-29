import { auth, db } from "./dashboard-core.js"; // Nhớ cập nhật đường dẫn import nếu bạn để file trong thư mục con
import { collection, query, orderBy, limit, getDocs, doc, getDoc, where, getCountFromServer } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// Biến toàn cục để quản lý dữ liệu phân trang (Giới hạn Top 20)
let globalTopUsers = [];
let currentPage = 1;
const itemsPerPage = 10;
let currentUserDataIndex = -1;

// Hằng số định nghĩa thời gian sống của Cache bảng xếp hạng: 15 PHÚT
const CACHE_TTL_MS = 15 * 60 * 1000; 

// Lắng nghe sự kiện authReady từ hệ thống cốt lõi
document.addEventListener('authReady', async (e) => {
    const user = e.detail ? e.detail.user : auth.currentUser;
    if (user) {
        // KIỂM TRA HÀNH ĐỘNG RELOAD (F5) - Xóa cache khi tải lại trang
        const navEntries = performance.getEntriesByType("navigation");
        if (navEntries.length > 0 && navEntries[0].type === "reload") {
            sessionStorage.removeItem('leaderboardCache');
            sessionStorage.removeItem(`userRankCache_${user.uid}`);
        }

        await initLeaderboard(user);
        await updateUserDashboardRank(user); // Cập nhật thứ hạng vào Quick Stats
        setupRefreshButton(user);
    }
});

// Lắng nghe sự kiện load component để tránh lỗi DOM chưa render kịp
document.addEventListener('ComponentsLoaded', async () => {
    const user = auth.currentUser;
    if (user) {
        await updateUserDashboardRank(user);
        setupRefreshButton(user);
    }
});

// Thiết lập sự kiện cho nút "Cập nhật" thủ công
function setupRefreshButton(currentUser) {
    const refreshBtn = document.getElementById('btnRefreshLeaderboard');
    if (refreshBtn && !refreshBtn.dataset.listenerAttached) {
        refreshBtn.dataset.listenerAttached = "true";
        refreshBtn.addEventListener('click', async () => {
            // Xóa toàn bộ cache liên quan đến leaderboard để ép tải mới từ Firestore
            sessionStorage.removeItem('leaderboardCache');
            sessionStorage.removeItem(`userRankCache_${currentUser.uid}`);
            
            refreshBtn.style.opacity = "0.7";
            refreshBtn.innerText = "Đang cập nhật...";
            
            await initLeaderboard(currentUser);
            await updateUserDashboardRank(currentUser);
            
            setTimeout(() => {
                refreshBtn.style.opacity = "1";
                refreshBtn.innerHTML = `<i class="fa-solid fa-rotate"></i> Cập nhật`;
            }, 400);
        });
    }
}

// Cập nhật thứ hạng của User vào Dashboard Thống kê nhanh (Có áp dụng Cache)
export async function updateUserDashboardRank(currentUser) {
    const statElement = document.getElementById('statAccountStatus');
    if (!statElement || statElement.innerHTML.includes('Hạng')) return;

    try {
        const cacheKey = `userRankCache_${currentUser.uid}`;
        const cachedData = sessionStorage.getItem(cacheKey);
        
        if (cachedData) {
            const parsed = JSON.parse(cachedData);
            if (Date.now() - parsed.timestamp < CACHE_TTL_MS) {
                statElement.innerHTML = `Hạng ${parsed.rank}`;
                return; 
            }
        }

        const userDocRef = doc(db, 'users_leaderboard', currentUser.uid);
        const userDocSnap = await getDoc(userDocRef);
        
        if (!userDocSnap.exists()) {
            statElement.innerHTML = 'Chưa xếp hạng';
            return;
        }

        const currentXP = userDocSnap.data().totalXP || 0;
        const higherXpQuery = query(
            collection(db, "users_leaderboard"),
            where("totalXP", ">", currentXP)
        );
        
        const snapshot = await getCountFromServer(higherXpQuery);
        const countHigher = snapshot.data().count;
        const actualRank = countHigher + 1;
        
        statElement.innerHTML = `Hạng ${actualRank}`;
        sessionStorage.setItem(cacheKey, JSON.stringify({ rank: actualRank, timestamp: Date.now() }));
    } catch (error) {
        console.error("Lỗi khi cập nhật thứ hạng Dashboard:", error);
    }
}

async function initLeaderboard(currentUser) {
    const podiumContainer = document.getElementById('leaderboardPodium');
    const cRankStats = document.getElementById('cRankStats');

    const oldSticky = document.getElementById('stickyUserRank');
    if (oldSticky) oldSticky.style.display = 'none';

    try {
        const cacheKey = 'leaderboardCache';
        const cachedData = sessionStorage.getItem(cacheKey);
        let useCache = false;

        // KIỂM TRA BỘ NHỚ ĐỆM (CACHE)
        if (cachedData) {
            const parsed = JSON.parse(cachedData);
            if (Date.now() - parsed.timestamp < CACHE_TTL_MS) {
                globalTopUsers = parsed.data;
                useCache = true;
            }
        }

        // TẢI TỪ FIREBASE NẾU KHÔNG CÓ CACHE (Giới hạn tối đa Top 20)
        if (!useCache) {
            const q = query(
                collection(db, "users_leaderboard"), 
                orderBy("totalXP", "desc"), 
                limit(20) 
            );
            const querySnapshot = await getDocs(q);

            globalTopUsers = [];
            querySnapshot.forEach(docSnap => {
                globalTopUsers.push({ id: docSnap.id, ...docSnap.data() });
            });

            sessionStorage.setItem(cacheKey, JSON.stringify({ data: globalTopUsers, timestamp: Date.now() }));
        }

        // Tách dữ liệu Top 3 và Danh sách còn lại (từ vị trí 4 đến hết Top 20)
        const top3 = globalTopUsers.slice(0, 3);
        const restUsersList = globalTopUsers.slice(3);

        // ==========================
        // RENDER BỤC VINH QUANG (TOP 3)
        // ==========================
        podiumContainer.innerHTML = '';
        if (top3.length === 0) {
            podiumContainer.innerHTML = '<p style="color: #64748b; padding: 20px;">Chưa có dữ liệu xếp hạng.</p>';
        } else {
            const displayOrder = [];
            if (top3[1]) displayOrder.push({ ...top3[1], rank: 2, class: 'step-2' });
            if (top3[0]) displayOrder.push({ ...top3[0], rank: 1, class: 'step-1' });
            if (top3[2]) displayOrder.push({ ...top3[2], rank: 3, class: 'step-3' });

            displayOrder.forEach(user => {
                const avatar = user.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.displayName || 'User')}&background=random&color=fff`;
                const crown = user.rank === 1 ? '<i class="fa-solid fa-crown crown-icon"></i>' : '';
                
                podiumContainer.innerHTML += `
                    <div class="podium-step ${user.class}">
                        ${crown}
                        <img src="${avatar}" alt="Avatar" class="podium-avatar">
                        <div class="podium-name">${user.displayName || 'Học viên ẩn danh'}</div>
                        <div class="podium-xp">${(user.totalXP || 0).toLocaleString()} XP</div>
                        <div class="podium-rank-box">TOP ${user.rank}</div>
                    </div>
                `;
            });
        }

        // ==========================
        // RENDER THÀNH TÍCH CÁ NHÂN GỌN GÀNG
        // ==========================
        currentUserDataIndex = globalTopUsers.findIndex(u => u.id === currentUser.uid);
        const statElement = document.getElementById('statAccountStatus'); 
        
        if (currentUserDataIndex !== -1) {
            const currentRank = currentUserDataIndex + 1;
            const currentXP = globalTopUsers[currentUserDataIndex].totalXP || 0;
            cRankStats.innerHTML = `
                <span class="xp-badge">XP Tích lũy: <b>${currentXP.toLocaleString()}</b></span>
                <span class="rank-badge">Hạng: ${currentRank}</span>
            `;
            if(statElement) statElement.innerHTML = `Hạng ${currentRank}`; 
        } else {
            let currentXP = 0;
            const userDocRef = doc(db, 'users_leaderboard', currentUser.uid);
            const userDocSnap = await getDoc(userDocRef);
            if (userDocSnap.exists()) {
                currentXP = userDocSnap.data().totalXP || 0;
            }
            
            cRankStats.innerHTML = `
                <span class="xp-badge">XP Tích lũy: <b>${currentXP.toLocaleString()}</b></span>
                <span class="rank-badge out-of-rank">Ngoài Top 20</span>
            `;
            if(statElement) statElement.innerHTML = `Ngoài Top 20`; 
        }

        // ==========================
        // THIẾT LẬP PHÂN TRANG DANH SÁCH (10 người / trang, tổng 2 trang)
        // ==========================
        currentPage = 1;
        setupPaginationControls(restUsersList);

    } catch (error) {
        console.error("Lỗi khi tải Bảng Xếp Hạng:", error);
        podiumContainer.innerHTML = '<p style="color: #ef4444; padding: 20px;">Không thể tải dữ liệu xếp hạng lúc này.</p>';
        document.getElementById('leaderboardTableBody').innerHTML = '<div style="text-align: center; color: #ef4444; padding: 20px;">Lỗi kết nối máy chủ.</div>';
    }
}

function setupPaginationControls(restUsersList) {
    const btnPrev = document.getElementById('btnPrevPage');
    const btnNext = document.getElementById('btnNextPage');

    renderLeaderboardPage(restUsersList, currentPage);

    const newBtnPrev = btnPrev.cloneNode(true);
    const newBtnNext = btnNext.cloneNode(true);
    btnPrev.parentNode.replaceChild(newBtnPrev, btnPrev);
    btnNext.parentNode.replaceChild(newBtnNext, btnNext);

    newBtnPrev.addEventListener('click', () => {
        if (currentPage > 1) {
            currentPage--;
            renderLeaderboardPage(restUsersList, currentPage);
        }
    });

    newBtnNext.addEventListener('click', () => {
        const maxPage = Math.ceil(restUsersList.length / itemsPerPage) || 1;
        if (currentPage < maxPage) {
            currentPage++;
            renderLeaderboardPage(restUsersList, currentPage);
        }
    });
}

function renderLeaderboardPage(restUsersList, page) {
    const tableBody = document.getElementById('leaderboardTableBody');
    const pageIndicator = document.getElementById('pageIndicator');
    const btnPrev = document.getElementById('btnPrevPage');
    const btnNext = document.getElementById('btnNextPage');

    const maxPage = Math.ceil(restUsersList.length / itemsPerPage) || 1;
    const startIndex = (page - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const pageData = restUsersList.slice(startIndex, endIndex);

    tableBody.innerHTML = '';
    
    if (pageData.length === 0) {
        tableBody.innerHTML = '<div style="text-align: center; color: #64748b; padding: 30px; font-size: 1rem; border: 1px dashed #cbd5e1; border-radius: 12px; margin-top: 10px;">Chưa có đủ dữ liệu học viên.</div>';
    } else {
        pageData.forEach((user, index) => {
            const actualRank = startIndex + index + 4; 
            const avatar = user.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.displayName || 'User')}&background=e2e8f0&color=334155`;
            
            tableBody.innerHTML += `
                <div class="leaderboard-row">
                    <div class="row-rank">#${actualRank}</div>
                    <div class="row-info">
                        <img src="${avatar}" alt="Avatar" class="row-avatar">
                        <div class="row-name">${user.displayName || 'Học viên ẩn danh'}</div>
                    </div>
                    <div class="row-xp">${(user.totalXP || 0).toLocaleString()} XP</div>
                </div>
            `;
        });
    }

    pageIndicator.innerText = `Trang ${page} / ${maxPage}`;
    btnPrev.disabled = page === 1;
    btnNext.disabled = page === maxPage;
}
