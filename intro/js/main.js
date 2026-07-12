// Cập nhật file: js/main.js

document.addEventListener('DOMContentLoaded', () => {
    // Tìm vùng chứa chính trong index.html
    const mainContent = document.getElementById('main-content');
    if (!mainContent) return;

    // Danh sách các module slide cần load
    const slides = [
        'components/hero-slide-1.html',
        'components/hero-slide-2.html'
    ];
    
    let currentSlide = 0;
    let slideElements = [];
    let slideInterval;

    // 1. Dựng khung Slider & Navigation Dots
    mainContent.innerHTML = `
        <div id="hero-slider" class="relative w-full overflow-hidden min-h-[600px] flex items-center bg-slate-50">
            <div id="slider-track" class="relative w-full h-full"></div>
            
            <div class="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-3 z-50" id="slider-dots"></div>
        </div>
    `;

    const track = document.getElementById('slider-track');
    const dotsContainer = document.getElementById('slider-dots');

    // 2. Hàm Fetch API để tải HTML của từng slide
    const initSlider = async () => {
        for (let i = 0; i < slides.length; i++) {
            try {
                const response = await fetch(slides[i]);
                const html = await (response.ok ? response.text() : `<p class="p-4 text-red-500">Lỗi không tìm thấy: ${slides[i]}</p>`);
                
                // Bọc nội dung slide vào thẻ div với hiệu ứng Opacity Transition
                const slideDiv = document.createElement('div');
                slideDiv.className = `absolute inset-0 w-full h-full transition-opacity duration-1000 ease-in-out flex items-center justify-center ${i === 0 ? 'opacity-100 z-10' : 'opacity-0 z-0'}`;
                slideDiv.innerHTML = html;
                track.appendChild(slideDiv);
                slideElements.push(slideDiv);

                // Tạo các nút chấm tròn (Dots) tương ứng
                const dot = document.createElement('button');
                dot.className = `w-3 h-3 rounded-full transition-all duration-300 ${i === 0 ? 'bg-teal-600 scale-125' : 'bg-slate-300 hover:bg-slate-400'}`;
                dot.setAttribute('aria-label', `Chuyển đến slide ${i + 1}`);
                dot.addEventListener('click', () => goToSlide(i));
                dotsContainer.appendChild(dot);
            } catch (error) {
                console.error('Lỗi load slide:', error);
            }
        }
        // Kích hoạt tự động chuyển slide sau khi load xong
        startAutoPlay();
    };

    // 3. Logic chuyển đổi slide
    const goToSlide = (index) => {
        if (index === currentSlide) return;
        
        // Ẩn slide hiện tại
        slideElements[currentSlide].classList.remove('opacity-100', 'z-10');
        slideElements[currentSlide].classList.add('opacity-0', 'z-0');
        dotsContainer.children[currentSlide].classList.remove('bg-teal-600', 'scale-125');
        dotsContainer.children[currentSlide].classList.add('bg-slate-300');

        // Hiển thị slide mới
        currentSlide = index;
        slideElements[currentSlide].classList.remove('opacity-0', 'z-0');
        slideElements[currentSlide].classList.add('opacity-100', 'z-10');
        dotsContainer.children[currentSlide].classList.remove('bg-slate-300');
        
        // Thay đổi màu dot tùy theo slide (Teal cho Slide 1, Blue cho Slide 2)
        const dotColor = currentSlide === 0 ? 'bg-teal-600' : 'bg-blue-600';
        dotsContainer.children[currentSlide].classList.add(dotColor, 'scale-125');

        resetAutoPlay(); // Reset lại thời gian chờ để tránh bị chuyển giật cục
    };

    // Chuyển slide tiếp theo
    const nextSlide = () => {
        let next = (currentSlide + 1) % slides.length;
        goToSlide(next);
    };

    // 4. Quản lý Auto-play
    const startAutoPlay = () => {
        slideInterval = setInterval(nextSlide, 7000); // Đổi slide tự động sau mỗi 7 giây
    };

    const resetAutoPlay = () => {
        clearInterval(slideInterval);
        startAutoPlay();
    };

    // Bắt đầu thực thi
    initSlider();
});
