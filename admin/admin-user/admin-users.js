// ==========================================
// FILE: admin-user/admin-users.js
// QUẢN LÝ GIAO DIỆN CHÍNH (CONTROLLER TỔNG SAU KHI REFACTOR)
// ==========================================
import { fetchAllUserData, initRealtimePaymentListener, userState } from './admin-users-data.js';
import { renderUserList, injectTableHeadersAndToolbar, initUserInterfaceEvents, updateBulkActionBar } from './admin-users-ui.js';
import { initUserActionEvents } from './admin-users-actions.js';
import { sendNotification, openNotificationModal } from './admin-users-notify.js';

document.addEventListener('componentsLoaded', () => {
    
    // Đóng gói Callback để Data giao tiếp với UI mà không bị dính vòng lặp import
    const dataCallbacks = {
        onStart: () => {}, 
        onSuccess: (needsToolbarInjection) => {
            if (needsToolbarInjection) injectTableHeadersAndToolbar();
            renderUserList();
        },
        onError: (error) => {} 
    };

    // 1. Tải danh sách gốc lần đầu
    fetchAllUserData(false, dataCallbacks);

    // 2. Lắng nghe cập nhật thanh toán CK Realtime và cập nhật Chuông thông báo Sidebar
    initRealtimePaymentListener(() => {
        const badge = document.getElementById('pending-vip-badge');
        if (badge && userState.pendingVIPRequests) {
            const count = userState.pendingVIPRequests.size;
            badge.innerText = count;
            // Nếu có người chờ duyệt thì hiện huy hiệu đỏ, nếu không thì ẩn đi
            badge.style.display = count > 0 ? 'inline-block' : 'none';
        }
        renderUserList();
    });

    // 3. Kích hoạt giao diện UI (Tìm kiếm, Bộ lọc Dropdown, Nút Cập nhật, Nút Thông báo Hàng loạt)
    initUserInterfaceEvents(
        (force) => fetchAllUserData(force, dataCallbacks), 
        (target) => openNotificationModal(target) 
    );

    // 4. Kích hoạt Click Logic cho từng dòng (VIP, Khóa, Excel, Lịch sử)
    initUserActionEvents();

    // 5. Xử lý Sidebar Menu Clicks (Lọc trạng thái qua thuộc tính HTML)
    const sidebarMenuItems = document.querySelectorAll('.menu-item');
    sidebarMenuItems.forEach(item => {
        item.addEventListener('click', (e) => {
            const target = item.getAttribute('data-target');
            if (target === 'tab-users' || target === 'tab-user-list') {
                const filter = item.getAttribute('data-filter');
                userState.currentFilterStatus = filter ? filter : 'all';
                
                // Cập nhật lại thanh chọn dropdown UI nếu nó tồn tại
                const filterSelect = document.getElementById('filterSelect');
                if (filterSelect) filterSelect.value = userState.currentFilterStatus;

                fetchAllUserData(false, dataCallbacks); 
            }
        });
    });

    // 6. Khởi tạo chức năng Đóng/Mở Modal chung (Lịch sử, Thông báo)
    const closeHistoryBtn = document.getElementById('closeHistoryModalBtn');
    if (closeHistoryBtn) {
        closeHistoryBtn.onclick = () => { document.getElementById('historyModal').style.display = "none"; };
    }

    const closeNotifyBtn = document.getElementById('close-notification-modal');
    if (closeNotifyBtn) {
        closeNotifyBtn.onclick = () => { document.getElementById('notification-modal').style.display = 'none'; };
    }
    
    // 7. Xử lý logic nút Gửi Thông Báo (kết hợp lấy trạng thái userState)
    const sendNotifyBtn = document.getElementById('btnSendNotification');
    if (sendNotifyBtn) {
        sendNotifyBtn.onclick = () => {
            sendNotification(userState.cachedUsers, userState.selectedUserIds, () => {
                userState.selectedUserIds.clear();
                updateBulkActionBar();
                renderUserList();
            });
        };
    }
});
