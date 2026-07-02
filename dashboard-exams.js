import { db, auth, safeRedirect } from "./dashboard-core.js";
import { collection, getDocs, doc, updateDoc, arrayUnion, arrayRemove } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// =========================================================================
// 1. BIẾN TOÀN CỤC & TRẠNG THÁI BỘ LỌC ĐA LỚP
// =========================================================================
export let allExamsData = []; 
let currentUserData = null;
let currentView = 'grid'; 
let userBookmarks = []; // Mảng chứa ID các đề thi đã lưu

// Biến trạng thái của Bộ lọc
let currentTechnique = 'all'; // Lấy từ Sidebar
let currentLevel = 'all';     // Lấy từ Pill Buttons
let currentTime = 'all';      // Lấy từ Pill Buttons
let currentSearchQuery = '';  // Lấy từ Search Bar 

// DOM Elements
const examListContainer = document.getElementById('examListContainer');
const sortFilter = document.getElementById('sortFilter');
const viewBtns = document.querySelectorAll('.view-btn');

// Các phần tử lọc
const subMenuItems = document.querySelectorAll('.sub-menu-item');
const levelPills = document.querySelectorAll('#levelFilter .pill-btn');
const timePills = document.querySelectorAll('#timeFilter .pill-btn');
const searchInput = document.getElementById('searchInput'); 

// =========================================================================
// 2. LẮNG NGHE SỰ KIỆN AUTH READY ĐỂ KHỞI CHẠY DỮ LIỆU
// =========================================================================
document.addEventListener("authReady", async (e) => {
    currentUserData = e.detail.currentUserData;
    
    // Lấy mảng bookmark từ dữ liệu User truyền qua
    if (currentUserData && currentUserData.bookmarks) {
        userBookmarks = [...currentUserData.bookmarks];
    }

    setupToolbarEvents(); 
    setupFilterEvents(); 
    await loadAggregatedExamData(); 
});

// =========================================================================
// 3. CẤU HÌNH SỰ KIỆN LỌC & TOOLBAR
// =========================================================================
function setupFilterEvents() {
    // 1. Sự kiện lọc theo Kỹ thuật (Sidebar) - Bao gồm cả "Đề thi đã lưu" (saved)
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
// 5. EVENT DELEGATION CHO NÚT BOOKMARK
// =========================================================================
examListContainer.addEventListener('click', async (e) => {
    const bookmarkBtn = e.target.closest('.btn-bookmark');
    if (bookmarkBtn) {
        const examId = bookmarkBtn.getAttribute('data-exam-id');
        const userDocRef = doc(db, "users", auth.currentUser.uid);
        
        try {
            if (userBookmarks.includes(examId)) {
                // Xóa Bookmark
                await updateDoc(userDocRef, { bookmarks: arrayRemove(examId) });
                userBookmarks = userBookmarks.filter(id => id !== examId);
            } else {
                // Thêm Bookmark
                await updateDoc(userDocRef, { bookmarks: arrayUnion(examId) });
                userBookmarks.push(examId);
            }
            renderExams(); // Cập nhật lại UI lập tức
        } catch (error) {
            console.error("Lỗi cập nhật Bookmark:", error);
            alert("Đã xảy ra lỗi khi lưu đề thi. Vui lòng thử lại!");
        }
    }
});

// =========================================================================
// 6. PIPELINE LỌC DỮ LIỆU & RENDER GIAO DIỆN
// =========================================================================
function renderExams() {
    if (allExamsData.length === 0) {
        examListContainer.innerHTML = '<div class="loading-text">Hiện tại chưa có khóa học / đề thi nào.</div>';
        return;
    }

    let displayData = [...allExamsData];

    // LỚP LỌC 1: Kỹ thuật hoặc Đề thi đã lưu (Từ Sidebar)
    if (currentTechnique === 'saved') {
        displayData = displayData.filter(exam => userBookmarks.includes(exam.id));
    } else if (currentTechnique !== 'all') {
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
        if (currentTechnique === 'saved') {
            examListContainer.innerHTML = '<div class="loading-text">Bạn chưa lưu đề thi nào vào bộ sưu tập.</div>';
        } else {
            examListContainer.innerHTML = '<div class="loading-text">Không tìm thấy đề thi nào phù hợp với các bộ lọc và từ khóa hiện tại.</div>';
        }
        return;
    }

    displayData.forEach(exam => {
        const isExamVip = exam.isVip;
        const isSaved = userBookmarks.includes(exam.id);
        
        // Trạng thái Bookmark Icon
        const bookmarkClass = isSaved ? "btn-bookmark saved" : "btn-bookmark";
        const bookmarkIcon = isSaved ? "fa-solid fa-bookmark" : "fa-regular fa-bookmark";

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
            <button class="${bookmarkClass}" data-exam-id="${exam.id}" title="${isSaved ? 'Bỏ lưu đề thi' : 'Lưu đề thi'}">
                <i class="${bookmarkIcon}"></i>
            </button>
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
// 7. EXPOSE FUNCTIONS ĐỂ HTML THUẦN CÓ THỂ GỌI SỰ KIỆN CLICK
// =========================================================================
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
