/**
 * Hàm load component từ file HTML bằng Fetch API
 * @param {string} containerId - ID của thẻ div chứa component
 * @param {string} filePath - Đường dẫn đến file HTML component (ví dụ: components/hero-slide-1.html)
 */
async function loadComponent(containerId, filePath) {
    const container = document.getElementById(containerId);
    if (!container) return;

    try {
        const response = await fetch(filePath);
        if (!response.ok) {
            throw new Error(`Lỗi tải file: ${filePath} (Mã lỗi: ${response.status})`);
        }
        const html = await response.text();
        container.innerHTML = html;
        
        // Thêm một chút độ trễ nhỏ để DOM render xong mới kích hoạt animation fade-in
        setTimeout(() => {
            container.classList.add('loaded');
        }, 50);

    } catch (error) {
        console.error(`Không thể load component [${containerId}]:`, error);
        container.innerHTML = `
            <div class="p-6 flex items-center justify-center bg-red-50/50 border border-red-100 rounded-xl m-4 text-center text-red-500 text-sm font-medium">
                ⚠️ Không thể tải giao diện từ module: <b>${filePath}</b><br>
                (Lưu ý: Fetch API yêu cầu chạy qua Live Server/Localhost)
            </div>
        `;
    }
}

/**
 * Khởi tạo ứng dụng: Gọi lần lượt các module để nhúng vào trang
 */
document.addEventListener('DOMContentLoaded', async () => {
    
    // Tải tuần tự các module từ trên xuống dưới để đảm bảo luồng trải nghiệm người dùng
    
    // 1. Tải Navbar (Nếu bạn đã có file, hãy bỏ comment dòng dưới)
    // await loadComponent('navbar-container', 'components/navbar.html');
    
    // 2. Tải các khối nội dung Hero (Slide 1, 2, 3)
    await loadComponent('slide-1-container', 'components/hero-slide-1.html');
    await loadComponent('slide-2-container', 'components/hero-slide-2.html');
    await loadComponent('slide-3-container', 'components/hero-slide-3.html');
    
    // 3. Tải Footer (Nếu bạn đã có file, hãy bỏ comment dòng dưới)
    // await loadComponent('footer-container', 'components/footer.html');
    
});
