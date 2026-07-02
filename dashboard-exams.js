import { auth, db, safeRedirect } from "./dashboard-core.js";
import { collection, getDocs, doc, updateDoc, arrayUnion, arrayRemove } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

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
let currentSearchQuery = '';  // Lấy từ Search Bar

// DOM Elements
const examListContainer = document.getElementById('examListContainer');
const sortFilter = document.getElementById('sortFilter');
const viewBtns = document.querySelectorAll('.view-btn');

// Các phần tử lọc mới
const subMenuItems = document.querySelectorAll('.sub-menu-item');
const levelPills = document.querySelectorAll('#levelFilter .pill-btn');
const timePills = document.querySelectorAll('#timeFilter .pill-btn');
const searchInput = document.getElementById('searchInput');

// =========================================================================
// 2. LẮNG NGHE SỰ KIỆN AUTH READY ĐỂ KHỞI CHẠY DỮ LIỆU
// =========================================================================
document.addEventListener("authReady", async (e) => {
    currentUserData = e.detail.currentUserData;
    // Đảm bảo mảng bookmarks luôn tồn tại ở local để tránh lỗi undefined
    if (currentUserData && !currentUserData.bookmarks) {
        currentUserData.bookmarks = [];
    }
    setupToolbarEvents(); 
    setupFilterEvents(); 
    await loadAggregatedExamData(); 
});

// =========================================================================
// 3. CẤU HÌNH SỰ KIỆN LỌC & TOOLBAR
// =========================================================================
function setupFilterEvents() {
    // 1. Sự kiện lọc theo Kỹ thuật hoặc Bộ sưu tập (Sidebar)
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
                pills.forEach(p => p.classList.remove('active'));
                e.currentTarget.classList.add('active');
                
                if (stateKey === 'level') currentLevel = e.currentTarget.getAttribute('data-level');
                if (stateKey === 'time') currentTime = e.currentTarget.getAttribute('data-time');
                
                renderExams();
            });
        });
    }

    setupPillEvents(levelPills, 'level');
    setupPillEvents(timePills, 'time');

    // 3. Sự kiện Tìm kiếm Real-time
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            currentSearchQuery = e.target.value.toLowerCase().trim();
            renderExams();
        });
    }
}

function setupToolbarEvents() {
    sortFilter.removeEventListener('change', handleSortFilterChange);
    sortFilter.addEventListener('change', handleSortFilterChange);

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
// 5. PIPELINE LỌC DỮ LIỆU & RENDER GIAO DIỆN CHUYÊN NGHIỆP
// =========================================================================
function renderExams() {
    if (allExamsData.length === 0) {
        examListContainer.innerHTML = '<div class="loading-text">Hiện tại chưa có khóa học / đề thi nào.</div>';
        return;
    }

    let displayData = [...allExamsData];
    const userBookmarks = (currentUserData && currentUserData.bookmarks) ? currentUserData.bookmarks : [];

    // LỚP LỌC 1: Kỹ thuật hoặc Lọc đề thi ĐÃ LƯU
    if (currentTechnique === 'saved') {
        displayData = displayData.filter(exam => userBookmarks.includes(exam.id));
    } else if (currentTechnique !== 'all') {
        displayData = displayData.filter(exam => exam.technique === currentTechnique);
    }

    // LỚP LỌC 2: Cấp độ
    if (currentLevel !== 'all') {
        displayData = displayData.filter(exam => exam.level === currentLevel);
    }

    // LỚP LỌC 3: Thời gian
    if (currentTime !== 'all') {
        const timeTarget = parseInt(currentTime);
        displayData = displayData.filter(exam => exam.timeLimit === timeTarget);
    }
    
    // LỚP LỌC 4: Tìm kiếm theo từ khóa
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

    examListContainer.innerHTML = "";
    const isUserVip = currentUserData && currentUserData.isVip === true;

    if (displayData.length === 0) {
        if (currentTechnique === 'saved') {
            examListContainer.innerHTML = '<div class="loading-text">Bạn chưa lưu đề thi nào vào bộ sưu tập.</div>';
        } else {
            examListContainer.innerHTML = '<div class="loading-text">Không tìm thấy đề thi nào phù hợp với các bộ lọc hiện tại.</div>';
        }
        return;
    }

    displayData.forEach(exam => {
        const isExamVip = exam.isVip;
        const isSaved = userBookmarks.includes(exam.id);
        
        // Badge PRO/Free
        const badgeHtml = isExamVip 
            ? `<span class="course-badge badge-vip"><i class="fa-solid fa-crown"></i> PRO</span>`
            : `<span class="course-badge badge-free">Free</span>`;
            
        // UI Nút Bookmark
        const bookmarkHtml = `
            <button class="btn-bookmark ${isSaved ? 'saved' : ''}" onclick="toggleBookmark(event, '${exam.id}')" title="${isSaved ? 'Bỏ lưu đề thi' : 'Lưu đề thi'}">
                <i class="${isSaved ? 'fa-solid' : 'fa-regular'} fa-heart"></i>
            </button>
        `;
        
        let buttonHtml = '';
        if (isExamVip && !isUserVip) {
            buttonHtml = `<button class="btn-pro-locked" onclick="goToUpgrade()"><i class="fa-solid fa-gem"></i> Nâng cấp tài khoản Pro</button>`;
        } else {
            buttonHtml = `<button class="btn-primary" onclick="goToQuiz('${exam.id}')">Vào thi ngay</button>`;
        }

        // Color-coding Cấp độ chuyên nghiệp
        let levelClass = 'tag-level-tb'; 
        if (exam.level === 'Dễ') levelClass = 'tag-level-de';
        else if (exam.level === 'Khó') levelClass = 'tag-level-kho';

        const tagsHtml = `
            <div class="card-tags">
                <span class="meta-tag tag-tech"><i class="fa-solid fa-tag"></i> ${exam.technique}</span>
                <span class="meta-tag ${levelClass}"><i class="fa-solid fa-signal"></i> ${exam.level}</span>
            </div>
        `;

        // Thống kê với nền xám nổi bật con số
        const statsHtml = `
            <div class="card-stats-bg">
                <div class="stat-item"><i class="fa-solid fa-file-circle-question"></i> <span><b>${exam.questionCount}</b> câu</span></div>
                <div class="stat-item"><i class="fa-solid fa-stopwatch"></i> <span><b>${exam.timeLimit}</b> phút</span></div>
            </div>
        `;

        const card = document.createElement('div');
        card.className = 'course-card';
        card.innerHTML = `
            ${badgeHtml}
            ${bookmarkHtml}
            <div class="card-body">
                <div style="flex: 1;">
                    <h3 class="card-title">${exam.id}</h3>
                    ${tagsHtml}
                    ${statsHtml}
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
// 6. LOGIC BOOKMARK & CÁC HÀM EXPOSE HTML
// =========================================================================

// Xử lý Lưu / Bỏ lưu đề thi Real-time
window.toggleBookmark = async function(event, examId) {
    event.stopPropagation(); // Ngăn sự kiện click lan ra ngoài Card
    
    if (!auth.currentUser || !currentUserData) {
        alert("Vui lòng đăng nhập để lưu đề thi vào bộ sưu tập!");
        return;
    }

    if (!currentUserData.bookmarks) {
        currentUserData.bookmarks = [];
    }

    const userRef = doc(db, "users", auth.currentUser.uid);
    const isCurrentlySaved = currentUserData.bookmarks.includes(examId);

    try {
        if (isCurrentlySaved) {
            // Xóa Bookmark: Cập nhật local array và render UI ngay lập tức để tạo cảm giác mượt mà
            currentUserData.bookmarks = currentUserData.bookmarks.filter(id => id !== examId);
            renderExams();
            // Gửi dữ liệu đồng bộ lên Firestore ngầm
            await updateDoc(userRef, { bookmarks: arrayRemove(examId) });
        } else {
            // Thêm Bookmark
            currentUserData.bookmarks.push(examId);
            renderExams();
            await updateDoc(userRef, { bookmarks: arrayUnion(examId) });
        }
    } catch (error) {
        console.error("Lỗi cập nhật bộ sưu tập:", error);
        alert("Đã xảy ra lỗi khi cập nhật bộ sưu tập. Vui lòng thử lại!");
    }
};

window.goToQuiz = function(examId) {
    safeRedirect(`quiz.html?examId=${examId}`);
};

window.goToUpgrade = function() {
    const tabPanes = document.querySelectorAll('.tab-pane');
    tabPanes.forEach(pane => pane.classList.remove('active'));
    
    document.querySelectorAll('.sidebar-menu .menu-item').forEach(m => m.classList.remove('active'));
    document.querySelectorAll('.sub-menu-item').forEach(m => m.classList.remove('active'));
    
    const proTab = document.getElementById('tab-vip');
    if (proTab) proTab.classList.add('active');
    
    const currentTabTitle = document.getElementById("currentTabTitle");
    if(currentTabTitle) currentTabTitle.textContent = 'Nâng Cấp Tài Khoản Pro';
};
```eof
