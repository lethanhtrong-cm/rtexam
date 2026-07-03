import { auth, db, safeRedirect } from "./dashboard-core.js";
import { collection, getDocs, doc, updateDoc, arrayUnion, arrayRemove, query, where } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// =========================================================================
// 1. BIẾN TOÀN CỤC & TRẠNG THÁI BỘ LỌC ĐA LỚP
// =========================================================================
export let allExamsData = []; 
let currentUserData = null;
let currentView = 'grid'; 

// Biến trạng thái của Bộ lọc & Dữ liệu Lịch sử
let currentTechnique = 'all'; 
let currentLevel = 'all';     
let currentTime = 'all';      
let currentSearchQuery = '';  
let completedExams = {}; // Đã đổi sang Object để lưu trữ thông tin điểm số lần thi gần nhất

// DOM Elements
const examListContainer = document.getElementById('examListContainer');
const sortFilter = document.getElementById('sortFilter');
const viewBtns = document.querySelectorAll('.view-btn');

const subMenuItems = document.querySelectorAll('.sub-menu-item');
const levelPills = document.querySelectorAll('#levelFilter .pill-btn');
const timePills = document.querySelectorAll('#timeFilter .pill-btn');
const searchInput = document.getElementById('searchInput');

// Bơm CSS động cho hiệu ứng Hover mượt mà & Nút PRO rực rỡ
const styleId = "exam-card-dynamic-styles";
if (!document.getElementById(styleId)) {
    const style = document.createElement('style');
    style.id = styleId;
    style.innerHTML = `
        .exam-card-hover {
            transition: transform 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275), box-shadow 0.2s ease-out !important;
        }
        .exam-card-hover:hover {
            transform: translateY(-6px) !important;
            box-shadow: 0 12px 28px rgba(0,0,0,0.12) !important;
        }
        .btn-outline-primary-custom {
            width: 100%; padding: 12px; font-size: 1rem; border-radius: 8px;
            background: transparent; border: 2px solid var(--primary-blue); 
            color: var(--primary-blue); font-weight: bold; cursor: pointer; 
            transition: all 0.3s ease;
        }
        .btn-outline-primary-custom:hover {
            background: var(--primary-blue); color: white;
        }
        /* --- NÚT PRO CHUẨN PREMIUM (PASTEL COOL) --- */
        .btn-premium-pro {
            background: linear-gradient(135deg, #8ec5fc 0%, #e0c3fc 100%) !important;
            color: #2c3e50 !important; /* Chữ màu xám xanh đậm, lịch sự */
            border: none !important;
            font-weight: 500 !important; /* Độ đậm vừa phải, không bị thô */
            transition: all 0.3s ease !important;
            cursor: pointer;
        }
        .btn-premium-pro:hover {
            transform: translateY(-3px) !important;
            box-shadow: 0 8px 20px rgba(142, 197, 252, 0.5) !important; /* Bóng đổ đồng điệu với màu nền */
            filter: brightness(1.05);
        }
        /* Class dự phòng cho nút pastel Bootstrap */
        .btn-primary-subtle {
            background-color: #cfe2ff !important;
            color: #0a58ca !important;
            border: none;
            transition: all 0.2s;
        }
        .btn-primary-subtle:hover {
            background-color: #9ec5fe !important;
        }
        
        /* Loại bỏ position absolute cũ để gom vào Flexbox Header */
        .header-badge {
            position: relative !important; top: auto !important; left: auto !important; right: auto !important; margin: 0 !important;
        }
        .header-bookmark {
            position: relative !important; top: auto !important; right: auto !important; left: auto !important; margin: 0 !important;
            width: 34px !important; height: 34px !important; flex-shrink: 0;
        }
        .list-view .header-flex-container { margin-bottom: 10px !important; }
    `;
    document.head.appendChild(style);
}

// =========================================================================
// 2. LẮNG NGHE SỰ KIỆN AUTH READY ĐỂ KHỞI CHẠY DỮ LIỆU
// =========================================================================
document.addEventListener("authReady", async (e) => {
    currentUserData = e.detail.currentUserData;
    if (currentUserData && !currentUserData.bookmarks) {
        currentUserData.bookmarks = [];
    }
    
    // Tải danh sách đề thi đã hoàn thành & lấy điểm số gần nhất
    try {
        if (e.detail.user && e.detail.user.email) {
            const resultsRef = collection(db, "results");
            const q = query(resultsRef, where("email", "==", e.detail.user.email));
            const snap = await getDocs(q);
            
            snap.forEach(doc => {
                const data = doc.data();
                const examId = data.examId || data.examCode;
                if (examId) {
                    // Xử lý timestamp để tìm lần thi mới nhất
                    const ts = data.createdAt ? (typeof data.createdAt.toMillis === 'function' ? data.createdAt.toMillis() : new Date(data.createdAt).getTime()) : data.timestamp || 0;
                    
                    // Nếu chưa có trong danh sách, hoặc có nhưng bản ghi này mới hơn
                    if (!completedExams[examId] || ts >= completedExams[examId].timestamp) {
                        completedExams[examId] = {
                            score: data.score || 0,
                            total: data.totalQuestions || data.total || 1, // Fallback mặc định 1 để không chia cho 0
                            timestamp: ts
                        };
                    }
                }
            });
        }
    } catch (err) {
        console.error("Lỗi lấy lịch sử thi để check trạng thái hoàn thành:", err);
    }

    setupToolbarEvents(); 
    setupFilterEvents(); 
    await loadAggregatedExamData(); 
});

// =========================================================================
// 3. CẤU HÌNH SỰ KIỆN LỌC & TOOLBAR
// =========================================================================
function setupFilterEvents() {
    subMenuItems.forEach(item => {
        item.addEventListener('click', (e) => {
            currentTechnique = e.currentTarget.getAttribute('data-technique');
            renderExams();
        });
    });

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
    
    // LỚP LỌC 4: Tìm kiếm theo từ khóa Real-time
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
        const isCompleted = !!completedExams[exam.id]; // Kiểm tra tồn tại trong Object lịch sử
        
        // 1. GÓC PHẢI: Badge PRO/Free & Nút Bookmark
        const badgeHtml = isExamVip 
            ? `<span class="course-badge badge-vip header-badge"><i class="fa-solid fa-crown"></i> PRO</span>`
            : `<span class="course-badge badge-free header-badge">Free</span>`;
            
        const bookmarkHtml = `
            <button class="btn-bookmark header-bookmark ${isSaved ? 'saved' : ''}" onclick="toggleBookmark(event, '${exam.id}')" title="${isSaved ? 'Bỏ lưu đề thi' : 'Lưu đề thi'}">
                <i class="${isSaved ? 'fa-solid' : 'fa-regular'} fa-heart"></i>
            </button>
        `;

        // 2. HEADER FLEXBOX CHUYÊN NGHIỆP
        const headerHtml = `
            <div class="header-flex-container" style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 18px; gap: 15px;">
                <div style="display: flex; align-items: center; gap: 8px; flex: 1; overflow: hidden;">
                    <h3 class="card-title" style="margin
