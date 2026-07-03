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
let completedExams = {}; // Lưu trữ thông tin điểm số lần thi gần nhất

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
            color: #2c3e50 !important;
            border: none !important;
            font-weight: 500 !important;
            transition: all 0.3s ease !important;
            cursor: pointer;
        }
        .btn-premium-pro:hover {
            transform: translateY(-3px) !important;
            box-shadow: 0 8px 20px rgba(142, 197, 252, 0.5) !important;
            filter: brightness(1.05);
        }
        .btn-primary-subtle {
            background-color: #cfe2ff !important;
            color: #0a58ca !important;
            border: none;
            transition: all 0.2s;
        }
        .btn-primary-subtle:hover {
            background-color: #9ec5fe !important;
        }
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
                    const ts = data.createdAt ? (typeof data.createdAt.toMillis === 'function' ? data.createdAt.toMillis() : new Date(data.createdAt).getTime()) : data.timestamp || 0;
                    
                    if (!completedExams[examId] || ts >= completedExams[examId].timestamp) {
                        completedExams[examId] = {
                            score: data.score || 0,
                            total: data.totalQuestions || data.total || 1,
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

    // Lọc theo Technique & Bookmark
    if (currentTechnique === 'saved') {
        displayData = displayData.filter(exam => userBookmarks.includes(exam.id));
    } else if (currentTechnique !== 'all') {
        displayData = displayData.filter(exam => exam.technique === currentTechnique);
    }

    // Lọc Level, Time, Search
    if (currentLevel !== 'all') {
        displayData = displayData.filter(exam => exam.level === currentLevel);
    }
    if (currentTime !== 'all') {
        const timeTarget = parseInt(currentTime);
        displayData = displayData.filter(exam => exam.timeLimit === timeTarget);
    }
    if (currentSearchQuery !== '') {
        displayData = displayData.filter(exam => 
            exam.id.toLowerCase().includes(currentSearchQuery) || 
            (exam.technique && exam.technique.toLowerCase().includes(currentSearchQuery))
        );
    }

    // Lọc VIP/Free & Sắp xếp
    const filterType = sortFilter.value;
    if (filterType === 'only_vip') displayData = displayData.filter(exam => exam.isVip);
    else if (filterType === 'only_free') displayData = displayData.filter(exam => !exam.isVip);

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
        const isCompleted = !!completedExams[exam.id]; 
        
        const badgeHtml = isExamVip 
            ? `<span class="course-badge badge-vip header-badge"><i class="fa-solid fa-crown"></i> PRO</span>`
            : `<span class="course-badge badge-free header-badge">Free</span>`;
            
        const bookmarkHtml = `
            <button class="btn-bookmark header-bookmark ${isSaved ? 'saved' : ''}" onclick="toggleBookmark(event, '${exam.id}')" title="${isSaved ? 'Bỏ lưu đề thi' : 'Lưu đề thi'}">
                <i class="${isSaved ? 'fa-solid' : 'fa-regular'} fa-heart"></i>
            </button>
        `;

        const headerHtml = `
            <div class="header-flex-container" style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 18px; gap: 15px;">
                <div style="display: flex; align-items: center; gap: 8px; flex: 1; overflow: hidden;">
                    <h3 class="card-title" style="margin: 0; padding: 0; font-size: 1.25rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${exam.id}</h3>
                    ${isCompleted ? '<i class="fas fa-check-circle text-success" style="color: #198754; font-size: 1.15rem; flex-shrink: 0;" title="Đã hoàn thành"></i>' : ''}
                </div>
                
                <div style="display: flex; align-items: center; gap: 10px; flex-shrink: 0;">
                    ${badgeHtml}
                    ${bookmarkHtml}
                </div>
            </div>
        `;

        let levelClass = 'bg-warning-subtle text-warning'; 
        let levelStyle = 'background-color: #fff3cd; color: #664d03;'; 
        if (exam.level === 'Dễ') {
            levelClass = 'bg-success-subtle text-success';
            levelStyle = 'background-color: #d1e7dd; color: #0f5132;';
        } else if (exam.level === 'Khó') {
            levelClass = 'bg-danger-subtle text-danger';
            levelStyle = 'background-color: #f8d7da; color: #842029;';
        }

        const pillBaseStyle = "padding: 5px 12px; border-radius: 50rem; font-size: 0.8rem; display: inline-flex; align-items: center; gap: 6px; border: none; letter-spacing: 0.2px;";

        const mergedTagsHtml = `
            <div class="d-flex flex-wrap gap-2 mb-3" style="display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 20px;">
                <span class="badge rounded-pill bg-primary-subtle text-primary" style="${pillBaseStyle} background-color: #cfe2ff; color: #084298;">
                    <i class="fa-solid fa-tag"></i> <span class="fw-normal" style="font-weight: 600;">${exam.technique}</span>
                </span>
                <span class="badge rounded-pill ${levelClass}" style="${pillBaseStyle} ${levelStyle}">
                    <i class="fa-solid fa-signal"></i> <span class="fw-normal" style="font-weight: 600;">${exam.level}</span>
                </span>
                <span class="badge rounded-pill bg-info-subtle text-info" style="${pillBaseStyle} background-color: #cff4fc; color: #055160;">
                    <i class="fa-solid fa-cube"></i> <span class="fw-normal" style="font-weight: 500;"><b>${exam.questionCount}</b> câu</span>
                </span>
                <span class="badge rounded-pill bg-secondary-subtle text-secondary" style="${pillBaseStyle} background-color: #e2e3e5; color: #41464b;">
                    <i class="fa-solid fa-clock"></i> <span class="fw-normal" style="font-weight: 500;"><b>${exam.timeLimit}</b> phút</span>
                </span>
            </div>
        `;

        // ==========================================
        // CẤU TRÚC LẠI PHẦN NÚT BẤM VÀ ĐIỂM SỐ Ở ĐÂY
        // ==========================================
        let actionAreaHtml = '';

        if (isExamVip && !isUserVip) {
            actionAreaHtml = `
                <button class="btn btn-premium-pro w-100 mt-2" onclick="handleUpgradeProClick('${exam.id}')">
                    <i class="fa-solid fa-gem me-2"></i> Nâng cấp tài khoản Pro
                </button>
            `;
        } else {
            if (isCompleted) {
                const score = completedExams[exam.id].score;
                const totalQuestions = completedExams[exam.id].total;
                const percent = Math.min(100, Math.round((score / totalQuestions) * 100));

                actionAreaHtml = `
                    <div class="mb-3 p-2 bg-light rounded border border-light">
                        <div class="d-flex justify-content-between align-items-center mb-2">
                            <small class="text-muted fw-medium">Lần thi gần nhất</small>
                            <span class="text-success fw-bold" style="font-size: 0.95rem;">${score} / ${totalQuestions} điểm</span>
                        </div>
                        <div class="progress" style="height: 6px; border-radius: 10px;">
                            <div class="progress-bar bg-success" role="progressbar" style="width: ${percent}%; border-radius: 10px;"></div>
                        </div>
                    </div>
                    <div class="row g-2">
                        <div class="col-6">
                            <button class="btn btn-outline-secondary w-100 fw-medium" style="border-radius: 6px;" onclick="goToHistory('${exam.id}')">
                                <i class="fas fa-history me-1"></i> Lịch sử
                            </button>
                        </div>
                        <div class="col-6">
                            <button class="btn btn-primary-subtle text-primary fw-medium w-100" style="border-radius: 6px;" onclick="handleExamClick('${exam.id}')">
                                <i class="fas fa-redo me-1"></i> Thi lại
                            </button>
                        </div>
                    </div>
                `;
            } else {
                actionAreaHtml = `
                    <button class="btn btn-primary w-100 fw-bold mt-2" style="padding: 10px; border-radius: 6px;" onclick="handleExamClick('${exam.id}')">
                        Bắt đầu thi <i class="fa-solid fa-arrow-right ms-2"></i>
                    </button>
                `;
            }
        }

        const cardHtml = `
            <div class="course-card exam-card-hover" style="border-radius: 12px; overflow: hidden; background: #fff; border: 1px solid #eef0f2;">
                <div class="card-body p-4" style="display: flex; flex-direction: column; height: 100%;">
                    ${headerHtml}
                    ${mergedTagsHtml}
                    
                    <div class="stats-row" style="display: flex; justify-content: space-between; margin-bottom: 20px; font-size: 0.9rem; color: #6c757d; border-top: 1px dashed #e9ecef; padding-top: 15px;">
                        <div class="rating">
                            <span class="fw-bold text-dark">${exam.rating}</span> <i class="fa-solid fa-star text-warning"></i> <span style="font-size: 0.8rem;">(${exam.ratingCount})</span>
                        </div>
                        <div class="users">
                            <i class="fa-solid fa-users"></i> ${exam.attemptCount} lượt thi
                        </div>
                    </div>
                    
                    <div class="mt-auto">
                        ${actionAreaHtml}
                    </div>
                </div>
            </div>
        `;

        examListContainer.insertAdjacentHTML('beforeend', cardHtml);
    });
}

// =========================================================================
// 6. CÁC HÀM XỬ LÝ SỰ KIỆN NÚT BẤM (CLICK HANDLERS)
// =========================================================================
window.handleExamClick = function(examId) {
    if (!currentUserData) {
        alert("Vui lòng tải lại trang.");
        return;
    }
    const exam = allExamsData.find(e => e.id === examId);
    if (!exam) return;
    
    if (exam.isVip && currentUserData.isVip !== true) {
        handleUpgradeProClick(examId);
        return;
    }
    
    const url = `quiz.html?examId=${encodeURIComponent(examId)}`;
    window.open(url, '_blank');
}

window.handleUpgradeProClick = function(examId) {
    alert("Tính năng Nâng cấp Pro đang được xây dựng. Vui lòng liên hệ Admin để mua tài khoản.");
}

window.goToHistory = function(examId) {
    const historyBtn = document.querySelector('[data-target="history"]');
    if(historyBtn) {
        historyBtn.click();
        document.dispatchEvent(new CustomEvent('filterHistoryByExam', { detail: { examId: examId } }));
    } else {
        alert("Đang chuyển đến lịch sử của đề " + examId);
    }
}

window.toggleBookmark = async function(event, examId) {
    event.stopPropagation();
    if (!currentUserData || !currentUserData.email) return;

    const btn = event.currentTarget;
    const isSaved = btn.classList.contains('saved');
    const userRef = doc(db, "users", currentUserData.email);

    try {
        if (isSaved) {
            await updateDoc(userRef, { bookmarks: arrayRemove(examId) });
            currentUserData.bookmarks = currentUserData.bookmarks.filter(id => id !== examId);
            btn.classList.remove('saved');
            btn.innerHTML = '<i class="fa-regular fa-heart"></i>';
        } else {
            await updateDoc(userRef, { bookmarks: arrayUnion(examId) });
            currentUserData.bookmarks.push(examId);
            btn.classList.add('saved');
            btn.innerHTML = '<i class="fa-solid fa-heart" style="color: #dc3545;"></i>';
        }
        
        if (currentTechnique === 'saved') {
            renderExams();
        }
    } catch (error) {
        console.error("Lỗi khi cập nhật bookmark:", error);
    }
}
