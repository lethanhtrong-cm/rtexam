// Cập nhật file: js/main.js

document.addEventListener('DOMContentLoaded', () => {
    // Hàm tự động fetch và render các module HTML
    const loadComponents = () => {
        const components = document.querySelectorAll('[data-component]');
        
        components.forEach(async (el) => {
            const file = el.getAttribute('data-component');
            try {
                const response = await fetch(file);
                if (response.ok) {
                    const html = await response.text();
                    
                    // Tạo hiệu ứng fade-in mượt mà khi module vừa được load vào DOM
                    el.style.opacity = '0';
                    el.style.transition = 'opacity 0.8s ease-in-out';
                    el.innerHTML = html;
                    
                    // Kích hoạt hiển thị sau một khoảng delay rất nhỏ để CSS kịp nhận diện
                    setTimeout(() => {
                        el.style.opacity = '1';
                    }, 50);

                } else {
                    el.innerHTML = `
                        <div class="p-4 border-l-4 border-red-500 bg-red-50 text-red-700 m-4 rounded-md">
                            Không tìm thấy module: <strong>${file}</strong>
                        </div>`;
                }
            } catch (error) {
                console.error(`Lỗi hệ thống khi load component ${file}:`, error);
            }
        });
    };

    // Khởi chạy hàm
    loadComponents();
});
