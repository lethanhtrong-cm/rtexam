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

// Đảm bảo các component được nạp trước khi các script module logic (như dashboard-core.js) gắn sự kiện
async function initDashboard() {
    await Promise.all([
        loadComponent('topbar-container', './components/dashboard/topbar.html'),
        loadComponent('sidebar-container', './components/dashboard/sidebar.html'),
        
        // Nạp toàn bộ 5 tab nội dung
        loadComponent('tab-exams', './components/dashboard/tab-exams.html'),
        loadComponent('tab-profile', './components/dashboard/tab-profile.html'),
        loadComponent('tab-history', './components/dashboard/tab-history.html'),
        loadComponent('leaderboard', './components/dashboard/tab-leaderboard.html'),
        loadComponent('tab-vip', './components/dashboard/tab-vip.html'),
        
        loadComponent('modals-container', './components/dashboard/modals.html')
    ]);
    
    // Phát ra một sự kiện báo hiệu UI đã sẵn sàng
    document.dispatchEvent(new Event('ComponentsLoaded'));
}

document.addEventListener('DOMContentLoaded', initDashboard);
