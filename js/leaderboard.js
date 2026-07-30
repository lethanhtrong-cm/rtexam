import { auth, db } from "./dashboard-core.js"; 
import { collection, query, orderBy, limit, getDocs, doc, getDoc, where, getCountFromServer } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

let globalTopUsers = [];
let currentPage = 1;
const itemsPerPage = 10;
let currentUserDataIndex = -1;

const CACHE_TTL_MS = 15 * 60 * 1000; 

// HÀM HELPER: Xác định cấp bậc dựa trên điểm XP
function getTierBadge(xp) {
    if (xp < 1000) return `<span class="tier-badge tier-rookie" title="Tân binh"><i class="fa-solid fa-seedling"></i> Tân binh</span>`;
    if (xp < 3000) return `<span class="tier-badge tier-pro" title="Chuyên gia"><i class="fa-solid fa-medal"></i> Chuyên gia</span>`;
    if (xp < 10000) return `<span class="tier-badge tier-master" title="Cao thủ"><i class="fa-solid fa-star"></i> Cao thủ</span>`;
    return `<span class="tier-badge tier-grandmaster" title="Thách đấu"><i class="fa-solid fa-gem"></i> Thách đấu</span>`;
}

// HÀM HELPER: Cập nhật dòng "Last Updated"
function updateLastUpdatedText(timestamp) {
    const textElement = document.getElementById('lastUpdatedText');
    if (!textElement) return;
    if (!timestamp) {
        textElement.innerHTML = '<i class="fa-regular fa-clock"></i> Chưa có dữ liệu';
        return;
    }
    const diffMs = Date.now() - timestamp;
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) {
        textElement.innerHTML = '<i class="fa-regular fa-clock"></i> Vừa cập nhật xong';
    } else {
        textElement.innerHTML = `<i class="fa-regular fa-clock"></i> Cập nhật: ${diffMins} phút trước`;
    }
}

document.addEventListener('authReady', async (e) => {
    const user = e.detail ? e.detail.user : auth.currentUser;
    if (user) {
        const navEntries = performance.getEntriesByType("navigation");
        if (navEntries.length > 0 && navEntries[0].type === "reload") {
            sessionStorage.removeItem('leaderboardCache');
            sessionStorage.removeItem(`userRankCache_${user.uid}`);
        }

        await initLeaderboard(user);
        await updateUserDashboardRank(user); 
        setupControlListeners(user);
    }
});

document.addEventListener('ComponentsLoaded', async () => {
    const user = auth.currentUser;
    if (user) {
        await updateUserDashboardRank(user);
        setupControlListeners(user);
    }
});

// THIẾT LẬP SỰ KIỆN NÚT BẤM (BỘ LỌC, CẬP NHẬT, VÀ MODAL SHARE)
function setupControlListeners(currentUser) {
    const refreshBtn = document.getElementById('btnRefreshLeaderboard');
    if (refreshBtn && !refreshBtn.dataset.listenerAttached) {
        refreshBtn.dataset.listenerAttached = "true";
        refreshBtn.addEventListener('click', async () => {
            sessionStorage.removeItem('leaderboardCache');
            sessionStorage.removeItem(`userRankCache_${currentUser.uid}`);
            
            refreshBtn.style.opacity = "0.7";
            refreshBtn.innerText = "Đang lấy...";
            
            const textElement = document.getElementById('lastUpdatedText');
            if(textElement) textElement.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Đang đồng bộ...';
            
            await initLeaderboard(currentUser);
            await updateUserDashboardRank(currentUser);
            
            setTimeout(() => {
                refreshBtn.style.opacity = "1";
                refreshBtn.innerHTML = `<i class="fa-solid fa-rotate"></i> Cập nhật`;
            }, 400);
        });
    }

    const filterEl = document.getElementById('leaderboardFilter');
    if (filterEl && !filterEl.dataset.listenerAttached) {
        filterEl.dataset.listenerAttached = "true";
        filterEl.addEventListener('change', (e) => {
            if (e.target.value !== 'all') {
                alert('Tính năng lọc thời gian đang được nâng cấp để tiết kiệm băng thông. Vui lòng sử dụng bộ lọc "Tổng thời gian" trong lúc chờ đợi nhé!');
                e.target.value = 'all'; 
            }
        });
    }

    // Xử lý đóng Modal Share
    const closeShareModal = document.getElementById('closeShareModal');
    const shareModal = document.getElementById('shareAchievementModal');
    if (closeShareModal && shareModal && !closeShareModal.dataset.listenerAttached) {
        closeShareModal.dataset.listenerAttached = "true";
        closeShareModal.addEventListener('click', () => {
            shareModal.classList.remove('active');
        });
        shareModal.addEventListener('click', (e) => {
            if(e.target === shareModal) shareModal.classList.remove('active'); // Đóng khi click ra ngoài Overlay
        });
    }

    // Xử lý nút Web Share API (Chia sẻ Native)
    const btnNativeShare = document.getElementById('btnNativeShare');
    if (btnNativeShare && !btnNativeShare.dataset.listenerAttached) {
        btnNativeShare.dataset.listenerAttached = "true";
        btnNativeShare.addEventListener('click', async () => {
            const currentXpText = document.getElementById('shareXp').innerText;
            const currentRankText = document.getElementById('shareRank').innerText;
            const shareData = {
                title: 'Thành tích Thi Trắc Nghiệm',
                text: `🔥 Tôi vừa đạt mức ${currentXpText} XP (Hạng: ${currentRankText}) trên Hệ Thống Thi Trắc Nghiệm. Truy cập ngay để đua Top cùng tôi nhé!`,
                url: window.location.origin
            };
            if (navigator.share) {
                try {
                    await navigator.share(shareData);
                } catch (err) {
                    console.log('User cancelled share or error:', err);
                }
            } else {
                alert('Trình duyệt của bạn không hỗ trợ tính năng chia sẻ trực tiếp. Vui lòng chụp màn hình Thẻ thành tích này để khoe với bạn bè nhé!');
            }
        });
    }
}

// HÀM MỞ MODAL SHARE TRUYỀN DỮ LIỆU ĐỘNG
function openShareModal(user, rank, xp) {
    const modal = document.getElementById('shareAchievementModal');
    if(!modal) return;
    
    const avatarUrl = user.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.displayName || 'User')}&background=random&color=fff`;
    document.getElementById('shareAvatar').src = avatarUrl;
    document.getElementById('shareName').innerText = user.displayName || 'Học viên ẩn danh';
    document.getElementById('shareTier').innerHTML = getTierBadge(xp);
    
    const rankText = typeof rank === 'number' ? `#${rank}` : rank;
    document.getElementById('shareRank').innerText = rankText;
    document.getElementById('shareXp').innerText = xp.toLocaleString();
    
    // Tạo QR Code động theo Domain hiện tại
    const websiteUrl = window.location.origin; 
    document.getElementById('shareQrCode').src = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(websiteUrl)}`;
    
    modal.classList.add('active');
}

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
        let cacheTimestamp = null;

        if (cachedData) {
            const parsed = JSON.parse(cachedData);
            if (Date.now() - parsed.timestamp < CACHE_TTL_MS) {
                globalTopUsers = parsed.data;
                cacheTimestamp = parsed.timestamp;
                useCache = true;
            }
        }

        if (!useCache) {
            const q = query(collection(db, "users_leaderboard"), orderBy("totalXP", "desc"), limit(20));
            const querySnapshot = await getDocs(q);

            globalTopUsers = [];
            querySnapshot.forEach(docSnap => {
                globalTopUsers.push({ id: docSnap.id, ...docSnap.data() });
            });
            cacheTimestamp = Date.now();
            sessionStorage.setItem(cacheKey, JSON.stringify({ data: globalTopUsers, timestamp: cacheTimestamp }));
        }

        updateLastUpdatedText(cacheTimestamp);

        const top3 = globalTopUsers.slice(0, 3);
        const restUsersList = globalTopUsers.slice(3);

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
                        <div class="podium-name">
                            ${user.displayName || 'Học viên ẩn danh'}
                            <span style="margin-top:2px;">${getTierBadge(user.totalXP || 0)}</span>
                        </div>
                        <div class="podium-xp">${(user.totalXP || 0).toLocaleString()} XP</div>
                        <div class="podium-rank-box">TOP ${user.rank}</div>
                    </div>
                `;
            });
        }

        // ==========================
        // CẬP NHẬT THÀNH TÍCH VÀ NÚT SHARE
        // ==========================
        currentUserDataIndex = globalTopUsers.findIndex(u => u.id === currentUser.uid);
        const statElement = document.getElementById('statAccountStatus'); 
        let finalRank = "Ngoài Top 20";
        let finalXP = 0;
        
        if (currentUserDataIndex !== -1) {
            finalRank = currentUserDataIndex + 1;
            finalXP = globalTopUsers[currentUserDataIndex].totalXP || 0;
            cRankStats.innerHTML = `
                <span class="xp-badge">XP Tích lũy: <b>${finalXP.toLocaleString()}</b></span>
                <span class="rank-badge">Hạng: ${finalRank}</span>
            `;
            if(statElement) statElement.innerHTML = `Hạng ${finalRank}`; 
        } else {
            const userDocRef = doc(db, 'users_leaderboard', currentUser.uid);
            const userDocSnap = await getDoc(userDocRef);
            if (userDocSnap.exists()) {
                finalXP = userDocSnap.data().totalXP || 0;
            }
            
            cRankStats.innerHTML = `
                <span class="xp-badge">XP Tích lũy: <b>${finalXP.toLocaleString()}</b></span>
                <span class="rank-badge out-of-rank">Ngoài Top 20</span>
            `;
            if(statElement) statElement.innerHTML = `Ngoài Top 20`; 
        }

        // Hiển thị nút Share và Gắn sự kiện lấy data
        const btnOpenShare = document.getElementById('btnOpenShare');
        if (btnOpenShare) {
            btnOpenShare.style.display = 'flex';
            btnOpenShare.onclick = () => openShareModal(currentUser, finalRank, finalXP);
        }

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
            
            const animationDelay = index * 0.08; 
            
            tableBody.innerHTML += `
                <div class="leaderboard-row animate-fade-in" style="animation-delay: ${animationDelay}s">
                    <div class="row-rank">#${actualRank}</div>
                    <div class="row-info">
                        <img src="${avatar}" alt="Avatar" class="row-avatar">
                        <div class="row-name">
                            ${user.displayName || 'Học viên ẩn danh'}
                            ${getTierBadge(user.totalXP || 0)}
                        </div>
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
