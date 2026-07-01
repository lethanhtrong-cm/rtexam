import { db, safeRedirect } from "./dashboard-core.js";
import { collection, getDocs } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// =========================================================================
// 1. BIẾN TOÀN CỤC & TRẠNG THÁI BỘ LỌC ĐA LỚP
// =========================================================================
export let allExamsData = []; 
let currentUserData = null;
let currentView = 'grid'; 

// Biến trạng thái của Bộ lọc
let currentTechnique = 'all'; // Lấy từ Sidebar
let currentLevel = 'all';     // Lấy từ Pill Buttons
let currentTime = 'all';      // Lấy từ Pill Buttons
let currentSearchQuery = '';  // Lấy từ Search Bar (Tính năng mới)

// DOM Elements
const examListContainer = document.getElementById('examListContainer');
const sortFilter = document.getElementById('sortFilter');
const viewBtns = document.querySelectorAll('.view-btn');

// Các phần tử lọc mới
const subMenuItems = document.querySelectorAll('.sub-menu-item');
const levelPills = document.querySelectorAll('#levelFilter .pill-btn');
const timePills = document.querySelectorAll('#timeFilter .pill-btn');
const searchInput = document.getElementById('searchInput'); // Thanh tìm kiếm

// =========================================================================
// 2. LẮNG NGHE SỰ KIỆN AUTH READY ĐỂ KHỞI CHẠY DỮ LIỆU
// =========================================================================
document.addEventListener("authReady", async (e) => {
    currentUserData = e.detail.currentUserData;
    setupToolbarEvents(); 
    setupFilterEvents(); // Khởi tạo sự kiện cho các bộ lọc
    await loadAggregatedExamData(); 
});

// =========================================================================
// 3. CẤU HÌNH SỰ KIỆN LỌC & TOOLBAR
// =========================================================================
function setupFilterEvents() {
    // 1. Sự kiện lọc theo Kỹ thuật (Sidebar)
    subMenuItems.forEach(item => {
        item.addEventListener('click', (e) => {
            currentTechnique = e.currentTarget.getAttribute('data-technique');
            renderExams();
        });
    });

    // 2. Hàm setup chung cho Pill Buttons (Cấp độ & Thời gian)
    function setupPillEvents(pills, stateKey) {
        pills.forEach(pill => {
            pill.addEventListener('click', (e) => {
                // Xóa active của nhóm pill tương ứng
                pills.forEach(p => p.classList.remove('active'));
                e.currentTarget.classList.add('active');
                
                // Cập nhật biến trạng thái
                if (stateKey === 'level') currentLevel = e.currentTarget.getAttribute('data-level');
                if (stateKey === 'time') currentTime = e.currentTarget.getAttribute('data-time');
                
                renderExams(); // Kích hoạt render lại
            });
        });
    }

    setupPillEvents(levelPills, 'level');
    setupPillEvents(timePills, 'time');

    // 3. Sự kiện Tìm kiếm Real-time (Tìm kiếm theo Mã đề)
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            // Lấy giá trị, chuyển thành chữ thường và xóa khoảng trắng thừa
            currentSearchQuery = e.target.value.toLowerCase().trim();
            renderExams();
        });
    }
}

function setupToolbarEvents() {
    // Sự kiện Thay đổi Dropdown (Sắp xếp / Free-Pro)
    sortFilter.removeEventListener('change', handleSortFilterChange);
    sortFilter.addEventListener('change', handleSortFilterChange);

    // Sự kiện Chuyển đổi Grid / List View
    viewBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            const view = e.currentTarget.getAttribute('data-view');
            if (view !== currentView) {
                currentView = view;
                viewBtns.forEach(b => b.classList.remove('active'));
                e.currentTarget.classList.add('active');
                examListContainer.className = currentView === 'grid' ? 'grid-view' : 'list-view';
                renderExams();
            }
        });
    });
}

function handleSortFilterChange() {
    renderExams();
}

// =========================================================================
// 4. TẢI VÀ TỔNG HỢP SIÊU DỮ LIỆU TỪ FIRESTORE
// =========================================================================
async function loadAggregatedExamData() {
    try {
        const questionsRef = collection(db, "questions");
        const qSnap = await getDocs(questionsRef);
        const examMap = {}; 
        
        qSnap.forEach((doc) => {
            const data = doc.data();
            const eId = data.examId;
            if (eId) {
                if (!examMap[eId]) examMap[eId] = { id: eId, questionCount: 0 };
                examMap[eId].questionCount++;
            }
        });

        // Lấy cấu hình metadata (isVip, timeLimit, level, technique...)
        const examsConfigRef = collection(db, "exams");
        const eSnap = await getDocs(examsConfigRef);
        eSnap.forEach((doc) => {
            const eId = doc.id;
            if (examMap[eId]) {
                const conf = doc.data();
                examMap[eId].isVip = conf.isVip || false;
                examMap[eId].timeLimit = conf.timeLimit ? parseInt(conf.timeLimit) : 15;
                examMap[eId].attemptCount = conf.attemptCount || 0;
                examMap[eId].createdAt = conf.createdAt ? (typeof conf.createdAt.toMillis === 'function' ? conf.createdAt.toMillis() : new Date(conf.createdAt).getTime()) : 0;
                
                // Fetch siêu dữ liệu phân loại
                examMap[eId].technique = conf.technique || "Hỗn hợp";
                examMap[eId].level = conf.level || "Trung bình";
            }
        });

        const feedbacksRef = collection(db, "feedbacks");
        const fSnap = await getDocs(feedbacksRef);
        const ratingMap = {}; 
        
        fSnap.forEach((doc) => {
            const data = doc.data();
            const eId = data.examId;
            const stars = data.rating || 5; 
            if (eId) {
                if (!ratingMap[eId]) ratingMap[eId] = { total: 0, count: 0 };
                ratingMap[eId].total += stars;
                ratingMap[eId].count++;
            }
        });

        // Chuẩn hóa dữ liệu
        Object.keys(examMap).forEach(eId => {
            if (examMap[eId].timeLimit === undefined) examMap[eId].timeLimit = 15;
            if (examMap[eId].isVip === undefined) examMap[eId].isVip = false;
            if (examMap[eId].attemptCount === undefined) examMap[eId].attemptCount = 0;
            if (examMap[eId].createdAt === undefined) examMap[eId].createdAt = 0;
            if (examMap[eId].technique === undefined) examMap[eId].technique = "Hỗn hợp";
            if (examMap[eId].level === undefined) examMap[eId].level = "Trung bình";

            if (ratingMap[eId]) {
                const avg = ratingMap[eId].total / ratingMap[eId].count;
                examMap[eId].rating = Math.round(avg * 10) / 10; 
                examMap[eId].ratingCount = ratingMap[eId].count;
            } else {
                examMap[eId].rating = 5.0; 
                examMap[eId].ratingCount = 0;
            }
        });

        allExamsData = Object.values(examMap);

        const examsReadyEvent = new CustomEvent("examsReady", { detail: { allExamsData } });
        document.dispatchEvent(examsReadyEvent);

        renderExams();

    } catch (error) {
        console.error("Lỗi khi tổng hợp dữ liệu đề thi:", error);
        examListContainer.innerHTML = '<div class="loading-text" style="color:red;">Lỗi tải dữ liệu khóa học!</div>';
    }
}

// =========================================================================
// 5. PIPELINE LỌC DỮ LIỆU & RENDER GIAO DIỆN
// =========================================================================
function renderExams() {
    if (allExamsData.length === 0) {
        examListContainer.innerHTML = '<div class="loading-text">Hiện tại chưa có khóa học / đề thi nào.</div>';
        return;
    }

    let displayData = [...allExamsData];

    // LỚP LỌC 1: Kỹ thuật (Từ Sidebar)
    if (currentTechnique !== 'all') {
        displayData = displayData.filter(exam => exam.technique === currentTechnique);
    }

    // LỚP LỌC 2: Cấp độ (Từ Pill button)
    if (currentLevel !== 'all') {
        displayData = displayData.filter(exam => exam.level === currentLevel);
    }

    // LỚP LỌC 3: Thời gian (Từ Pill button)
    if (currentTime !== 'all') {
        const timeTarget = parseInt(currentTime);
        displayData = displayData.filter(exam => exam.timeLimit === timeTarget);
    }
    
    // LỚP LỌC 4: Tìm kiếm theo từ khóa Real-time (Tìm trong ID đề thi và Kỹ thuật)
    if (currentSearchQuery !== '') {
        displayData = displayData.filter(exam => 
            exam.id.toLowerCase().includes(currentSearchQuery) || 
            (exam.technique && exam.technique.toLowerCase().includes(currentSearchQuery))
        );
    }

    // LỚP LỌC 5: Trạng thái Dropdown (PRO/Free)
    const filterType = sortFilter.value;
    if (filterType === 'only_vip') displayData = displayData.filter(exam => exam.isVip);
    else if (filterType === 'only_free') displayData = displayData.filter(exam => !exam.isVip);

    // LỚP LỌC 6: Sắp xếp
    if (filterType === 'highest_rating') displayData.sort((a, b) => b.rating - a.rating);
    else if (filterType === 'most_attempts') displayData.sort((a, b) => b.attemptCount - a.attemptCount);
    else displayData.sort((a, b) => b.createdAt - a.createdAt); 

    // Bắt đầu Render UI
    examListContainer.innerHTML = "";
    const isUserVip = currentUserData && currentUserData.isVip === true;

    if (displayData.length === 0) {
        examListContainer.innerHTML = '<div class="loading-text">Không tìm thấy đề thi nào phù hợp với các bộ lọc và từ khóa hiện tại.</div>';
        return;
    }

    displayData.forEach(exam => {
        const isExamVip = exam.isVip;
        
        // Badge PRO hoặc Free
        const badgeHtml = isExamVip 
            ? `<span class="course-badge badge-vip"><i class="fa-solid fa-crown"></i> PRO</span>`
            : `<span class="course-badge badge-free">Free</span>`;
        
        // Nút Call to Action
        let buttonHtml = '';
        if (isExamVip && !isUserVip) {
            buttonHtml = `<button class="btn-pro-locked" onclick="goToUpgrade()"><i class="fa-solid fa-gem"></i> Nâng cấp tài khoản Pro</button>`;
        } else {
            buttonHtml = `<button class="btn-primary" onclick="goToQuiz('${exam.id}')">Vào thi ngay</button>`;
        }

        // Tags hiển thị Cấp độ & Kỹ thuật
        const tagsHtml = `
            <div class="card-tags">
                <span class="meta-tag"><i class="fa-solid fa-tag"></i> ${exam.technique}</span>
                <span class="meta-tag"><i class="fa-solid fa-signal"></i> ${exam.level}</span>
            </div>
        `;

        const card = document.createElement('div');
        card.className = 'course-card';
        card.innerHTML = `
            ${badgeHtml}
            <div class="card-body">
                <div style="flex: 1;">
                    <h3 class="card-title">${exam.id}</h3>
                    ${tagsHtml}
                    <div class="card-stats">
                        <div class="stat-item"><i class="fa-solid fa-file-circle-question"></i> ${exam.questionCount} câu hỏi</div>
                        <div class="stat-item"><i class="fa-solid fa-stopwatch"></i> ${exam.timeLimit} phút</div>
                    </div>
                </div>
                <div class="card-meta">
                    <div class="rating">${exam.rating} <i class="fa-solid fa-star"></i> <span class="attempts">(${exam.ratingCount})</span></div>
                    <div class="attempts"><i class="fa-solid fa-users"></i> ${exam.attemptCount} lượt thi</div>
                </div>
            </div>
            <div class="card-footer">${buttonHtml}</div>
        `;
        examListContainer.appendChild(card);
    });
}

// =========================================================================
// 6. EXPOSE FUNCTIONS ĐỂ HTML THUẦN CÓ THỂ GỌI SỰ KIỆN CLICK
// =========================================================================
window.goToQuiz = function(examId) {
    safeRedirect(`quiz.html?examId=${examId}`);
};

// Hàm xử lý sự kiện bấm Nâng cấp từ thẻ Đề thi
window.goToUpgrade = function() {
    // 1. Tắt active toàn bộ Tab Nội Dung
    const tabPanes = document.querySelectorAll('.tab-pane');
    tabPanes.forEach(pane => pane.classList.remove('active'));
    
    // 2. Tắt active toàn bộ Menu Sidebar để reset trạng thái
    document.querySelectorAll('.sidebar-menu .menu-item').forEach(m => m.classList.remove('active'));
    document.querySelectorAll('.sub-menu-item').forEach(m => m.classList.remove('active'));
    
    // 3. Mở hiển thị Tab VIP/PRO
    const proTab = document.getElementById('tab-vip');
    if (proTab) proTab.classList.add('active');
    
    // 4. Cập nhật Tiêu đề trang
    const currentTabTitle = document.getElementById("currentTabTitle");
    if(currentTabTitle) currentTabTitle.textContent = 'Nâng Cấp Tài Khoản Pro';
};
