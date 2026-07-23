/**
 * Hệ thống tải Module động dựa trên thuộc tính data-component
 * Giúp chia nhỏ giao diện để dễ quản lý, phù hợp cho kiến trúc Landing Page dài.
 */
document.addEventListener('DOMContentLoaded', () => {
    // Tìm tất cả các phần tử có thuộc tính data-component
    const components = document.querySelectorAll('[data-component]');
    
    components.forEach(async (container) => {
        const filePath = container.getAttribute('data-component');
        
        try {
            const response = await fetch(filePath);
            if (!response.ok) {
                throw new Error(`Mã lỗi: ${response.status}`);
            }
            
            // Lấy nội dung HTML và nhúng vào container
            const html = await response.text();
            container.innerHTML = html;
            
            // Thêm class để kích hoạt hiệu ứng fade-in nhẹ nhàng
            // Sử dụng setTimeout ngắn để đảm bảo DOM đã render xong trước khi animate
            setTimeout(() => {
                if (container.firstElementChild) {
                    container.firstElementChild.classList.add('fade-in-module');
                } else {
                    container.classList.add('fade-in-module');
                }
            }, 50);

        } catch (error) {
            console.error(`Không thể load module [${filePath}]:`, error);
            container.innerHTML = `
                <div class="p-6 m-4 rounded-xl border border-red-100 bg-red-50 text-red-500 text-sm text-center flex flex-col items-center justify-center">
                    <svg class="w-6 h-6 mb-2 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
                    <b>Lỗi tải giao diện:</b> Không thể tìm thấy file <i>${filePath}</i><br>
                    <span class="text-xs mt-1 text-red-400">Vui lòng kiểm tra lại đường dẫn hoặc chạy qua Live Server.</span>
                </div>
            `;
        }
    });
});
