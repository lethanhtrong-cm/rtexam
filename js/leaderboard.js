import { auth, db } from "./dashboard-core.js";
import { collection, query, orderBy, limit, getDocs, doc, getDoc, where, getCountFromServer } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// Lắng nghe sự kiện authReady từ hệ thống cốt lõi
document.addEventListener('authReady', async (e) => {
    const user = e.detail ? e.detail.user : auth.currentUser;
    if (user) {
        await initLeaderboard(user);
        await updateUserDashboardRank(user); // Cập nhật thứ hạng vào Quick Stats
    }
});

// Lắng nghe sự kiện load component để tránh lỗi DOM chưa render kịp
document.addEventListener('ComponentsLoaded', async () => {
    const user = auth.currentUser;
    if (user) {
        await updateUserDashboardRank(user);
    }
});

// Hàm mới: Tính toán và cập nhật thứ hạng của User vào Dashboard
export async function updateUserDashboardRank(currentUser) {
    const statElement = document.getElementById('statAccountStatus');
    
    // Nếu chưa load DOM thẻ statAccountStatus thì thoát, tránh báo lỗi
    if (!statElement) return;

    // Kiểm tra cache trong sessionStorage trước
    const cachedRank = sessionStorage.getItem('dashboard_user_rank');
    if (cachedRank) {
        statElement.innerHTML = cachedRank;
        return; // Dừng hàm, không gọi lên Firebase nữa
    }

    try {
        const userDocRef = doc(db, 'users_leaderboard', currentUser.uid);
        const userDocSnap = await getDoc(userDocRef);
        
        // Nếu user chưa từng có điểm trong system
        if (!userDocSnap.exists()) {
            statElement.innerHTML = 'Chưa xếp hạng';
            return;
        }

        const currentXP = userDocSnap.data().totalXP || 0;

        // Truy vấn đếm số lượng người có điểm cao hơn user hiện tại
        const higherXpQuery = query(
            collection(db, "users_leaderboard"),
            where("totalXP", ">", currentXP)
        );
        
        const snapshot = await getCountFromServer(higherXpQuery);
        const countHigher = snapshot.data().count;

        // Thứ hạng = Số người cao điểm hơn + 1
        const actualRank = countHigher + 1;
        
        // Lưu kết quả vào sessionStorage để dùng lại cho các lần load sau
        sessionStorage.setItem('dashboard_user_rank', `Hạng ${actualRank}`);
        statElement.innerHTML = `Hạng ${actualRank}`;

    } catch (error) {
        console.error("Lỗi khi cập nhật thứ hạng Dashboard:", error);
        statElement.innerHTML = 'Lỗi tính toán';
    }
}

async function initLeaderboard(currentUser) {
    const podiumContainer = document.getElementById('leaderboardPodium');
    const tableBody = document.getElementById('leaderboardTableBody'); // Bây giờ là container div list
    const stickyRank = document.getElementById('stickyUserRank');
    const stickyStats = document.getElementById('stickyUserStats');

    try {
        // Cú pháp chuẩn Modular V9 của Firebase
        const q = query(
            collection(db, "users_leaderboard"), 
            orderBy("totalXP", "desc"), 
            limit(30)
        );
        const querySnapshot = await getDocs(q);

        const topUsers = [];
        querySnapshot.forEach(docSnap => {
            topUsers.push({ id: docSnap.id, ...docSnap.data() });
        });

        // Tách dữ liệu Top 3 và Top 4-30
        const top3 = topUsers.slice(0, 3);
        const rest = topUsers.slice(3, 30);

        // ==========================
        // KHU VỰC 1: RENDER PODIUM (TOP 3)
        // ==========================
        podiumContainer.innerHTML = ''; // Clear loading text

        if (top3.length === 0) {
            podiumContainer.innerHTML = '<p class="text-muted" style="padding: 20px;">Chưa có dữ liệu xếp hạng.</p>';
        } else {
            // Sắp xếp lại thứ tự DOM để Top 1 nằm giữa: Top 2 -> Top 1 -> Top 3
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
        // KHU VỰC 2: RENDER MODERN LIST (TOP 4 - 30)
        // ==========================
        tableBody.innerHTML = '';
        if (rest.length === 0) {
            tableBody.innerHTML = '<div style="text-align: center; color: #64748b; padding: 30px; font-size: 1rem; border: 1px dashed #cbd5e1; border-radius: 12px; margin-top: 10px;">Chưa có đủ dữ liệu học viên.</div>';
        } else {
            rest.forEach((user, index) => {
                const actualRank = index + 4;
                // Ảnh fallback chuyên nghiệp với màu xám xanh
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
            const currentXP = topUsers[currentUserIndex].totalXP || 0;
            stickyStats.innerHTML = `
                <span style="margin-right: 15px;">XP Tích lũy: <b style="color: var(--warning-orange);">${currentXP.toLocaleString()}</b></span>
                <span class="highlight-rank">Hạng: ${currentRank}</span>
            `;
        } else {
            // Ngoài Top 30, truy vấn thêm 1 lượt đọc để lấy điểm bản thân
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
        podiumContainer.innerHTML = '<p style="color: #ef4444; padding: 20px;">Không thể tải dữ liệu xếp hạng lúc này.</p>';
        tableBody.innerHTML = '<div style="text-align: center; color: #ef4444; padding: 20px;">Lỗi kết nối máy chủ.</div>';
    }
}
