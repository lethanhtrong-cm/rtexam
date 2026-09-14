async function loadComponent(elementId, componentPath) {
    try {
        const response = await fetch(componentPath);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const html = await response.text();
        document.getElementById(elementId).innerHTML = html;
    } catch (error) {
        console.error(`Lỗi khi nạp ${componentPath}:`, error);
    }
}

// BỔ SUNG: Hàm quét và nạp tự động các thành phần dùng data-include
async function loadIncludes() {
    const elements = document.querySelectorAll('[data-include]');
    const promises = Array.from(elements).map(async (el) => {
        const path = el.getAttribute('data-include');
        try {
            const response = await fetch(path);
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            const html = await response.text();
            el.innerHTML = html;
        } catch (error) {
            console.error(`Lỗi khi nạp include ${path}:`, error);
        }
    });
    return Promise.all(promises);
}

// Đảm bảo các component được nạp trước khi các script module logic (như dashboard-core.js) gắn sự kiện
async function initDashboard() {
    await Promise.all([
        loadComponent('topbar-container', './components/dashboard/topbar.html'),
        loadComponent('sidebar-container', './components/dashboard/sidebar.html'),
        
        // Nạp các tab nội dung
        loadComponent('tab-exams', './components/dashboard/tab-exams.html'),
        loadComponent('tab-profile', './components/dashboard/tab-profile.html'),
        loadComponent('tab-history', './components/dashboard/tab-history.html'),
        loadComponent('leaderboard', './components/dashboard/tab-leaderboard.html'),
        // ĐÃ XÓA: tab-vip.html cũ
        
        loadComponent('modals-container', './components/dashboard/modals.html'),
        loadComponent('footer-container', './components/dashboard/dashboard-footer.html')
    ]);
    
    // ĐÃ THÊM: Gọi hàm nạp 2 file VIP con (và các file có data-include trong tương lai)
    await loadIncludes();
    
    // Phát ra một sự kiện báo hiệu UI đã sẵn sàng
    document.dispatchEvent(new Event('ComponentsLoaded'));
}

document.addEventListener('DOMContentLoaded', initDashboard);
