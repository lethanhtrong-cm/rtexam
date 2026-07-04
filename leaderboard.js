import { auth, db } from './dashboard-core.js';
import { collection, query, orderBy, limit, getDocs, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.0.0/firebase-firestore.js";

// Lắng nghe sự kiện authReady từ hệ thống cốt lõi
document.addEventListener('authReady', async (e) => {
    const user = e.detail ? e.detail.user : auth.currentUser;
    if (user) {
        await initLeaderboard(user);
    }
});

async function initLeaderboard(currentUser) {
    const podiumContainer = document.getElementById('leaderboardPodium');
    const tableBody = document.getElementById('leaderboardTableBody');
    const stickyRank = document.getElementById('stickyUserRank');
    const stickyStats = document.getElementById('stickyUserStats');

    try {
        // Query top 30 từ collection tối ưu
        const leaderboardRef = collection(db, 'users_leaderboard');
        const q = query(leaderboardRef, orderBy('totalXP', 'desc'), limit(30));
        const snapshot = await getDocs(q);

        const topUsers = [];
        snapshot.forEach(doc => {
            topUsers.push({ id: doc.id, ...doc.data() });
        });

        // Tách dữ liệu Top 3 và Top 4-30
        const top3 = topUsers.slice(0, 3);
        const rest = topUsers.slice(3, 30);

        // ==========================
        // KHU VỰC 1: RENDER PODIUM (TOP 3)
        // ==========================
        podiumContainer.innerHTML = ''; // Clear loading text

        if (top3.length === 0) {
            podiumContainer.innerHTML = '<p class="text-muted">Chưa có dữ liệu xếp hạng.</p>';
        } else {
            // Sắp xếp lại thứ tự DOM để Top 1 nằm giữa: Top 2 -> Top 1 -> Top 3
            const displayOrder = [];
            if (top3[1]) displayOrder.push({ ...top3[1], rank: 2, class: 'step-2' });
            if (top3[0]) displayOrder.push({ ...top3[0], rank: 1, class: 'step-1' });
            if (top3[2]) displayOrder.push({ ...top3[2], rank: 3, class: 'step-3' });

            displayOrder.forEach(user => {
                const avatar = user.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.displayName || 'User')}&background=random`;
                const crown = user.rank === 1 ? '<i class="fa-solid fa-crown crown-icon"></i>' : '';
                
                podiumContainer.innerHTML += `
                    <div class="podium-step ${user.class}">
                        ${crown}
                        <img src="${avatar}" alt="Avatar" class="podium-avatar">
                        <div class="podium-name">${user.displayName || 'Học viên ẩn danh'}</div>
                        <div class="podium-xp">${user.totalXP.toLocaleString()} XP</div>
                        <div class="podium-rank-box">TOP ${user.rank}</div>
                    </div>
                `;
            });
        }

        // ==========================
        // KHU VỰC 2: RENDER TABLE (TOP 4 - 30)
        // ==========================
        tableBody.innerHTML = '';
        if (rest.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="3" class="text-muted">Chưa có đủ dữ liệu học viên.</td></tr>';
        } else {
            rest.forEach((user, index) => {
                const actualRank = index + 4;
                tableBody.innerHTML += `
                    <tr>
                        <td><strong>#${actualRank}</strong></td>
                        <td>${user.displayName || 'Học viên ẩn danh'}</td>
                        <td class="text-primary fw-bold">${user.totalXP.toLocaleString()}</td>
                    </tr>
                `;
            });
        }

        // ==========================
        // KHU VỰC 3: STICKY RANK BAR
        // ==========================
        // Kiểm tra xem User hiện tại có nằm trong Top 30 không
        const currentUserIndex = topUsers.findIndex(u => u.id === currentUser.uid);
        
        // Hiển thị thanh sticky khi người dùng click vào tab leaderboard
        const menuLeaderboard = document.querySelector('.menu-item[data-target="leaderboard"]');
        if(menuLeaderboard) {
            menuLeaderboard.addEventListener('click', () => {
                stickyRank.style.display = 'flex';
                // Đóng các tab khác và mở tab leaderboard
                document.querySelectorAll('.tab-pane').forEach(tab => tab.classList.remove('active'));
                document.getElementById('leaderboard').classList.add('active');
            });
        }

        // Ẩn thanh sticky nếu qua tab khác
        const otherMenus = document.querySelectorAll('.menu-item:not([data-target="leaderboard"]), .sub-menu-item');
        otherMenus.forEach(menu => {
            menu.addEventListener('click', () => {
                stickyRank.style.display = 'none';
            });
        });

        if (currentUserIndex !== -1) {
            // Nằm trong Top 30
            const currentRank = currentUserIndex + 1;
            const currentXP = topUsers[currentUserIndex].totalXP;
            stickyStats.innerHTML = `
                <span style="margin-right: 15px;">XP Tích lũy: <b style="color: var(--warning-orange);">${currentXP.toLocaleString()}</b></span>
                <span class="highlight-rank">Hạng: ${currentRank}</span>
            `;
        } else {
            // Ngoài Top 30, truy vấn thêm duy nhất 1 Read request để lấy điểm bản thân
            const userDocRef = doc(db, 'users_leaderboard', currentUser.uid);
            const userDocSnap = await getDoc(userDocRef);
            
            let currentXP = 0;
            if (userDocSnap.exists()) {
                currentXP = userDocSnap.data().totalXP || 0;
            }
            
            stickyStats.innerHTML = `
                <span style="margin-right: 15px;">XP Tích lũy: <b style="color: var(--warning-orange);">${currentXP.toLocaleString()}</b></span>
                <span class="highlight-rank" style="background-color: var(--text-muted);">Hạng: Ngoài Top 30</span>
            `;
        }

    } catch (error) {
        console.error("Lỗi khi tải Bảng Xếp Hạng:", error);
        podiumContainer.innerHTML = '<p class="text-danger">Không thể tải dữ liệu xếp hạng lúc này.</p>';
        tableBody.innerHTML = '<tr><td colspan="3" class="text-danger">Lỗi kết nối máy chủ.</td></tr>';
    }
}