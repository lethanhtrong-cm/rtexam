import { db, safeRedirect } from "./dashboard-core.js";
import { collection, getDocs, query, orderBy } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// =========================================================================
// 1. BIẾN TOÀN CỤC LƯU TRỮ TRẠNG THÁI & DỮ LIỆU
// =========================================================================
let allExamsCache = []; // Bộ nhớ đệm lưu toàn bộ đề thi để lọc cục bộ (tiết kiệm Firestore reads)
let isUserVip = false;

// Các biến trạng thái của Bộ lọc
let currentTechnique = 'all'; // Lấy từ Sidebar Sub-menu
let currentLevel = 'all';     // Lấy từ Pill button Cấp độ
let currentTime = 'all';      // Lấy từ Pill button Thời gian
let currentSort = 'newest';   // Lấy từ Select Option Sắp xếp

// =========================================================================
// 2. KHỞI TẠO & LẮNG NGHE TRẠNG THÁI NGƯỜI DÙNG
// =========================================================================
document.addEventListener("authReady", (e) => {
    const { currentUserData } = e.detail;
    if (currentUserData && currentUserData.isVip) {
        isUserVip = true;
    }
    
    // Tải dữ liệu lần đầu tiên sau khi đã xác thực xong
    loadExamsFromFirestore();
});

// =========================================================================
// 3. LẮNG NGHE SỰ KIỆN CLICK TỪ UI (BỘ LỌC & SẮP XẾP)
// =========================================================================

// A. Bộ lọc Kỹ thuật (Từ Sidebar Accordion Sub-menu)
const submenuItems = document.querySelectorAll('.submenu-item');
submenuItems.forEach(item => {
    item.addEventListener('click', (e) => {
        // Lấy giá trị data-technique ('all', 'MRI', 'CT', 'X quang', 'Hỗn hợp')
        currentTechnique = e.currentTarget.getAttribute('data-technique') || 'all';
        applyFiltersAndRender();
    });
});

// B. Bộ lọc Cấp độ (Pill Buttons)
const filterLevelBtns = document.querySelectorAll('.filter-level');
filterLevelBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
        // Xóa active hiện tại, thêm active cho nút được bấm
        filterLevelBtns.forEach(b => b.classList.remove('active'));
        e.currentTarget.classList.add('active');
        
        currentLevel = e.currentTarget.getAttribute('data-level') || 'all';
        applyFiltersAndRender();
    });
});

// C. Bộ lọc Thời gian (Pill Buttons)
const filterTimeBtns = document.querySelectorAll('.filter-time');
filterTimeBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
        filterTimeBtns.forEach(b => b.classList.remove('active'));
        e.currentTarget.classList.add('active');
        
        currentTime = e.currentTarget.getAttribute('data-time') || 'all';
        applyFiltersAndRender();
    });
});

// D. Sắp xếp (Select Dropdown)
const sortSelect = document.getElementById('sortFilter');
if (sortSelect) {
    sortSelect.addEventListener('change', (e) => {
        currentSort = e.target.value;
        applyFiltersAndRender();
    });
}

// E. Chuyển đổi View (Grid / List)
const viewBtns = document.querySelectorAll('.view-btn');
const examContainer = document.getElementById('examListContainer');

viewBtns.forEach(btn => {
    btn.addEventListener('click', function() {
        viewBtns.forEach(b => b.classList.remove('active'));
        this.classList.add('active');
        
        const viewType = this.getAttribute('data-view');
        if (viewType === 'list') {
            examContainer.classList.remove('grid-view');
            examContainer.classList.add('list-view');
        } else {
            examContainer.classList.remove('list-view');
            examContainer.classList.add('grid-view');
        }
    });
});

// =========================================================================
// 4. HÀM KÉO DỮ LIỆU TỪ FIRESTORE (CHỈ GỌI 1 LẦN KHI LOAD TRANG)
// =========================================================================
async function loadExamsFromFirestore() {
    try {
        const examsRef = collection(db, "exams");
        // Mặc định kéo về sắp xếp theo ngày tạo mới nhất
        const q = query(examsRef, orderBy("createdAt", "desc"));
        const snapshot = await getDocs(q);
        
        allExamsCache = [];
        snapshot.forEach(doc => {
            const data = doc.data();
            allExamsCache.push({
                id: doc.id,
                title: data.title || "Đề thi chưa có tên",
                description: data.description || "Chưa có mô tả",
                technique: data.technique || "Hỗn hợp",
                level: data.level || "Trung bình",
                timeLimit: parseInt(data.timeLimit) || 0,
                questionCount: parseInt(data.questionCount) || 0,
                rating: parseFloat(data.rating) || 0,
                attempts: parseInt(data.attempts) || 0,
                isVipOnly: data.isVipOnly || false,
                createdAt: data.createdAt ? data.createdAt.toDate().getTime() : 0
            });
        });
        
        // Cập nhật thống kê sơ bộ (Mô phỏng/Tùy chỉnh nếu có DB chi tiết hơn)
        document.getElementById('statCompletedExams').innerHTML = Math.floor(Math.random() * 10) + " đề"; 
        document.getElementById('statAvgScore').innerHTML = (Math.random() * (9.5 - 6.5) + 6.5).toFixed(1) + " đ";

        // Sau khi có dữ liệu gốc, chạy qua bộ lọc và hiển thị
        applyFiltersAndRender();

    } catch (error) {
        console.error("Lỗi khi tải danh sách đề thi:", error);
        examContainer.innerHTML = `<div style="grid-column: 1/-1; text-align:center; color: var(--danger-red); padding: 20px;">Lỗi tải dữ liệu. Vui lòng kiểm tra lại kết nối.</div>`;
    }
}

// =========================================================================
// 5. HÀM LỌC, SẮP XẾP VÀ RENDER DỮ LIỆU LÊN MÀN HÌNH
// =========================================================================
function applyFiltersAndRender() {
    // 1. Lọc mảng dữ liệu (Array.prototype.filter)
    let filteredExams = allExamsCache.filter(exam => {
        // Kiểm tra Kỹ thuật
        const passTechnique = (currentTechnique === 'all') || (exam.technique === currentTechnique);
        
        // Kiểm tra Cấp độ
        const passLevel = (currentLevel === 'all') || (exam.level === currentLevel);
        
        // Kiểm tra Thời gian (ép kiểu thời gian về chuỗi để so sánh với data-time)
        const passTime = (currentTime === 'all') || (String(exam.timeLimit) === currentTime);

        // Trả về true nếu thỏa mãn cả 3 điều kiện
        return passTechnique && passLevel && passTime;
    });

    // 2. Lọc và Sắp xếp nâng cao theo Toolbar Select Option
    if (currentSort === 'only_vip') {
        filteredExams = filteredExams.filter(exam => exam.isVipOnly === true);
    } else if (currentSort === 'only_free') {
        filteredExams = filteredExams.filter(exam => exam.isVipOnly === false);
    } else if (currentSort === 'highest_rating') {
        filteredExams.sort((a, b) => b.rating - a.rating);
    } else if (currentSort === 'most_attempts') {
        filteredExams.sort((a, b) => b.attempts - a.attempts);
    } else {
        // 'newest' - Đã sort sẵn từ Firebase nhưng sort lại cho chắc chắn
        filteredExams.sort((a, b) => b.createdAt - a.createdAt);
    }

    // 3. Render HTML ra giao diện
    renderToDOM(filteredExams);
}

function renderToDOM(examsArray) {
    if (examsArray.length === 0) {
        examContainer.innerHTML = `
            <div style="grid-column: 1/-1; text-align: center; padding: 40px 20px; background: var(--white); border-radius: 12px; border: 1px dashed var(--border-color);">
                <i class="fa-solid fa-box-open" style="font-size: 3rem; color: var(--border-color); margin-bottom: 15px;"></i>
                <h3 style="color: var(--text-muted); margin: 0;">Không tìm thấy đề thi phù hợp</h3>
                <p style="color: var(--text-muted); font-size: 0.9rem;">Vui lòng thử thay đổi các tùy chọn lọc phía trên.</p>
            </div>
        `;
        return;
    }

    examContainer.innerHTML = "";

    examsArray.forEach(exam => {
        const isLocked = exam.isVipOnly && !isUserVip;
        
        // Cấu hình Badge
        let badgeHtml = "";
        if (exam.isVipOnly) {
            badgeHtml = `<div class="course-badge badge-vip"><i class="fa-solid fa-crown"></i> VIP</div>`;
        } else {
            badgeHtml = `<div class="course-badge badge-free">Free</div>`;
        }

        // Cấu hình Nút bấm
        let buttonHtml = "";
        if (isLocked) {
            buttonHtml = `<button class="btn-locked" disabled><i class="fa-solid fa-lock"></i> Nâng cấp VIP để mở</button>`;
        } else {
            buttonHtml = `<button class="btn-primary btn-start-exam" data-id="${exam.id}"><i class="fa-solid fa-play"></i> Bắt đầu thi</button>`;
        }

        const cardHtml = `
            <div class="course-card">
                ${badgeHtml}
                <div class="card-body">
                    <h3 class="card-title" title="${exam.title}">${exam.title}</h3>
                    
                    <div class="card-stats">
                        <div class="stat-item" title="Phân loại">
                            <i class="fa-solid fa-tags" style="color: var(--primary-blue);"></i> 
                            ${exam.technique}
                        </div>
                        <div class="stat-item" title="Độ khó">
                            <i class="fa-solid fa-layer-group" style="color: var(--warning-orange);"></i> 
                            ${exam.level}
                        </div>
                        <div class="stat-item" title="Số câu hỏi">
                            <i class="fa-solid fa-clipboard-question" style="color: var(--text-muted);"></i> 
                            ${exam.questionCount} câu
                        </div>
                        <div class="stat-item" title="Thời gian làm bài">
                            <i class="fa-solid fa-stopwatch" style="color: var(--danger-red);"></i> 
                            ${exam.timeLimit} phút
                        </div>
                    </div>

                    <div class="card-meta">
                        <div class="rating">
                            <i class="fa-solid fa-star"></i> ${exam.rating}
                        </div>
                        <div class="attempts">
                            <i class="fa-solid fa-users"></i> ${exam.attempts} lượt thi
                        </div>
                    </div>
                </div>
                
                <div class="card-footer">
                    ${buttonHtml}
                </div>
            </div>
        `;
        
        examContainer.insertAdjacentHTML('beforeend', cardHtml);
    });

    // Gắn sự kiện cho các nút "Bắt đầu thi" vừa được tạo
    const startBtns = document.querySelectorAll('.btn-start-exam');
    startBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            const examId = e.currentTarget.getAttribute('data-id');
            // Chuyển hướng người dùng tới trang làm bài thi (vd: exam.html?id=xxx)
            safeRedirect(`exam.html?id=${examId}`);
        });
    });
}
