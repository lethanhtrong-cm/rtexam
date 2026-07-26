// =========================================================================
// HÀM TIỆN ÍCH UI CƠ BẢN
// =========================================================================
export function safeRedirect(path) {
    if (window.location.protocol === 'blob:') {
        console.warn("Đang ở môi trường Preview, giả lập chuyển hướng tới:", path);
        alert(`Chuyển hướng đến: ${path}`);
    } else {
        window.location.href = path;
    }
}

export function formatDate(dateData) {
    if (dateData && typeof dateData.toDate === 'function') {
        return dateData.toDate().toLocaleString('vi-VN');
    }
    return new Date(dateData).toLocaleString('vi-VN');
}

// =========================================================================
// LOGIC UI: XỬ LÝ CHUYỂN TAB ĐỘNG
// =========================================================================
const tabTitleMap = {
    'tab-exams': 'Kho Đề Thi',
    'tab-profile': 'Hồ Sơ Cá Nhân',
    'tab-history': 'Lịch Sử Làm Bài',
    'tab-vip': 'Nâng Cấp Tài Khoản Pro',
    'leaderboard': 'Bảng Xếp Hạng'
};

export function switchTab(targetTabId, titleOverride) {
    const mainMenuItems = document.querySelectorAll('.sidebar-menu > .menu-item[data-target]');
    const accordionHeaders = document.querySelectorAll('.accordion-header');
    const subMenuItems = document.querySelectorAll('.sub-menu-item');
    const tabPanes = document.querySelectorAll('.tab-pane');
    const currentTabTitle = document.getElementById("currentTabTitle");

    if (mainMenuItems) mainMenuItems.forEach(m => m.classList.remove('active'));
    if (accordionHeaders) accordionHeaders.forEach(h => h.classList.remove('active'));
    if (subMenuItems) subMenuItems.forEach(sm => sm.classList.remove('active'));
    if (tabPanes) tabPanes.forEach(pane => pane.classList.remove('active'));

    const targetPane = document.getElementById(targetTabId);
    if (targetPane) {
        targetPane.classList.add('active');
    }
    
    if (currentTabTitle) {
        currentTabTitle.textContent = titleOverride || tabTitleMap[targetTabId] || 'Bảng Điều Khiển';
    }

    // Tự động đóng Sidebar trên Mobile sau khi click chọn menu
    const sidebar = document.querySelector('.sidebar');
    if (sidebar && window.innerWidth <= 768) {
        sidebar.classList.remove('active');
    }
}

// =========================================================================
// LOGIC UI: RENDER MODAL THÔNG BÁO VÀ THÔNG TIN USER
// =========================================================================
export function showNotificationModal(notif) {
    const existingModal = document.getElementById('notifModalDynamic');
    if (existingModal) existingModal.remove();

    let actionButtonsHTML = `<button data-action="close-notif-modal" style="padding: 8px 20px; background: #e2e8f0; color: #334155; border: none; border-radius: 6px; cursor: pointer; font-weight: 600; transition: 0.2s;">Đóng</button>`;
    
    if (notif.type === 'room_share' || notif.type === 'exam_share' || notif.actionUrl) {
        const targetLink = notif.actionUrl || '#'; 
        actionButtonsHTML = `
            <button data-action="close-notif-modal" style="padding: 8px 20px; background: #e2e8f0; color: #334155; border: none; border-radius: 6px; cursor: pointer; font-weight: 600; transition: 0.2s;">Hủy</button>
            <button data-action="accept-share" data-url="${targetLink}" style="padding: 8px 20px; background: #084298; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: 600; transition: 0.2s; box-shadow: 0 4px 6px rgba(8, 66, 152, 0.2);">Vào thi</button>
        `;
    }

    const modalHtml = `
        <div id="notifModalDynamic" style="position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(15, 23, 42, 0.6); z-index: 100000; display: flex; align-items: center; justify-content: center; backdrop-filter: blur(4px);">
            <div style="background: white; width: 90%; max-width: 480px; border-radius: 12px; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04); overflow: hidden; animation: modalNotifFade 0.25s ease-out;">
                
                <div style="padding: 18px 24px; border-bottom: 1px solid #e2e8f0; background: #f8fafc; font-weight: 700; font-size: 1.15rem; color: #0f172a; display: flex; justify-content: space-between; align-items: center;">
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <i class="fa-solid fa-bell" style="color: #084298;"></i> Chi tiết thông báo
                    </div>
                    <i class="fa-solid fa-xmark" data-action="close-notif-modal" style="cursor: pointer; color: #64748b; font-size: 1.2rem;"></i>
                </div>
                
                <div style="padding: 24px;">
                    <h3 style="margin: 0 0 12px 0; font-size: 1.15rem; color: #1e293b; font-weight: 600;">${notif.title}</h3>
                    <p style="margin: 0; color: #475569; line-height: 1.6; font-size: 0.95rem; white-space: pre-wrap;">${notif.message}</p>
                </div>
                
                <div style="padding: 16px 24px; border-top: 1px solid #e2e8f0; background: #f8fafc; display: flex; justify-content: flex-end; gap: 12px;">
                    ${actionButtonsHTML}
                </div>

            </div>
        </div>
        <style>
            @keyframes modalNotifFade {
                from { opacity: 0; transform: scale(0.95) translateY(10px); }
                to { opacity: 1; transform: scale(1) translateY(0); }
            }
        </style>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalHtml);
}

export function renderAuthInfo(user) {
    const email = user.email;
    const name = user.displayName || "Người dùng ẩn danh";
    const fallbackPhotoUrl = user.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=0056b3&color=fff`;

    const elTopbarName = document.getElementById("topbarName");
    if (elTopbarName) elTopbarName.textContent = name;

    const elTopbarAvatar = document.getElementById("topbarAvatar");
    if (elTopbarAvatar) elTopbarAvatar.src = fallbackPhotoUrl;

    const elDisplayEmail = document.getElementById("displayEmail");
    if (elDisplayEmail) elDisplayEmail.textContent = email;

    const elPaymentEmail = document.getElementById("paymentEmail");
    if (elPaymentEmail) elPaymentEmail.textContent = email; 

    const elDisplayName = document.getElementById("displayName");
    if (elDisplayName) elDisplayName.textContent = name;

    const elUserAvatar = document.getElementById("userAvatar");
    if (elUserAvatar) elUserAvatar.src = fallbackPhotoUrl;
    
    const inputName = document.getElementById("inputName");
    if(inputName) inputName.value = user.displayName || "";
}

export function setVipInactive() {
    const elVipStatusBadge = document.getElementById("vipStatusBadge");
    if (elVipStatusBadge) {
        elVipStatusBadge.textContent = "Chưa kích hoạt";
        elVipStatusBadge.className = "status-badge status-unactive";
    }

    const elVipStatusTab3 = document.getElementById("vipStatusTab3");
    if (elVipStatusTab3) {
        elVipStatusTab3.textContent = "Chưa kích hoạt Tài khoản Pro";
        elVipStatusTab3.className = "status-badge status-unactive";
    }

    const elVipStartDate = document.getElementById("vipStartDate");
    if (elVipStartDate) elVipStartDate.textContent = "Không xác định";

    const elVipEndDate = document.getElementById("vipEndDate");
    if (elVipEndDate) elVipEndDate.textContent = "Không xác định";
    
    const topbarVipContainer = document.getElementById('topbar-vip-container');
    if (topbarVipContainer) {
        topbarVipContainer.innerHTML = `
            <button class="btn-premium-pro" id="btnUpgradeHeader" style="background: linear-gradient(135deg, #f59e0b, #d97706); border: none; color: white; padding: 8px 16px; border-radius: 8px; font-weight: 600; cursor: pointer; transition: 0.2s; display: flex; align-items: center; gap: 8px; box-shadow: 0 2px 6px rgba(245, 158, 11, 0.3);">
                <i class="fa-solid fa-crown"></i> Nâng cấp Pro
            </button>
        `;
    }
}

// =========================================================================
// LOGIC UI: XỬ LÝ ĐÓNG/MỞ SIDEBAR TRÊN MOBILE
// =========================================================================
document.addEventListener('click', (e) => {
    const toggleBtn = e.target.closest('#mobileMenuToggle');
    const sidebar = document.querySelector('.sidebar');
    
    // Nếu bấm vào nút Hamburger thì Mở/Đóng Sidebar
    if (toggleBtn) {
        if (sidebar) sidebar.classList.toggle('active');
    } 
    // Nếu Sidebar đang mở mà người dùng click ra vùng xám bên ngoài thì tự Đóng
    else if (sidebar && sidebar.classList.contains('active') && !e.target.closest('.sidebar')) {
        sidebar.classList.remove('active');
    }
});
