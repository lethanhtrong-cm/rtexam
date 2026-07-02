import { auth, db, safeRedirect } from "./dashboard-core.js";
import { collection, getDocs, doc, updateDoc, arrayUnion, arrayRemove, query, where, orderBy, limit } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

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

// Đổi từ Set sang Map để lưu trữ thông tin chi tiết (điểm, tổng số câu) của lần thi gần nhất
let completedExams = new Map(); 

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
            border-radius: 12px;
            overflow: hidden;
            border: 1px solid #eaeaea;
        }
        .exam-card-hover:hover {
            transform: translateY(-6px) !important;
            box-shadow: 0 12px 28px rgba(0,0,0,0.12) !important;
            border-color: #d0d7de;
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
            font-weight: 600 !important; 
            transition: all 0.3s ease !important;
            cursor: pointer;
        }
        .btn-premium-pro:hover {
            transform: translateY(-2px) !important;
            box-shadow: 0 8px 15px rgba(142, 197, 252, 0.4) !important; 
            filter: brightness(1.05);
        }
        
        .header-bookmark {
            width: 32px; height: 32px; flex-shrink: 0;
            display: flex; align-items: center; justify-content: center;
            background: #f8f9fa; border-radius: 50%;
            color: #6c757d; transition: all 0.2s;
            border: 1px solid transparent;
        }
        .header-bookmark:hover { background: #e9ecef; color: #dc3545; }
        .header-bookmark.saved { color: #dc3545; background: #ffe6e6; }
        
        /* Chỉnh style riêng cho nút thi lại chia đôi */
        .btn-retake-split {
            background-color: #e0ebf9; color: #0d6efd;
            border: none; font-weight: 600; transition: all 0.2s;
        }
        .btn-retake-split:hover { background-color: #cce0f5; }
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
            
            let tempHistory = {};
            snap.forEach(doc => {
                const data = doc.data();
                const examId = data.examId || data.examCode;
                
                if (examId) {
                    // Lấy thời gian để so sánh tìm lần thi mới nhất
                    const ts = data.createdAt ? (typeof data.createdAt.toMillis === 'function' ? data.createdAt.toMillis() : new Date(data.createdAt).getTime()) : data.timestamp || 0;
                    
                    if (!tempHistory[examId] || ts >= tempHistory[examId].timestamp) {
                        tempHistory[examId] = {
                            score: data.score || 0,
                            total: data.totalQuestions || data.total || 0,
                            timestamp: ts
                        };
                    }
                }
            });
            
            completedExams = new Map(Object.entries(tempHistory));
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
// 5. PIPELINE LỌC DỮ LIỆU & RENDER GIAO DIỆN CHUYÊN NGHIỆP TÁI CẤU TRÚC
// =========================================================================
function renderExams() {
    if (allExamsData.length === 0) {
        examListContainer.innerHTML = '<div class="loading-text">Hiện tại chưa có khóa học / đề thi nào.</div>';
        return;
    }

    let displayData = [...allExamsData];
    const userBookmarks = (currentUserData && currentUserData.bookmarks) ? currentUserData.bookmarks : [];

    // Các lớp lọc giữ nguyên
    if (currentTechnique === 'saved') displayData = displayData.filter(exam => userBookmarks.includes(exam.id));
    else if (currentTechnique !== 'all') displayData = displayData.filter(exam => exam.technique === currentTechnique);
    
    if (currentLevel !== 'all') displayData = displayData.filter(exam => exam.level === currentLevel);
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
        const isCompleted = completedExams.has(exam.id); 
        
        // --- PHẦN 1: HEADER (Badge Nhóm Trái & Bookmark Phải) ---
        const proBadgeHtml = isExamVip 
            ? `<span class="badge" style="background: linear-gradient(135deg, #8ec5fc 0%, #e0c3fc 100%); color: #2c3e50; padding: 5px 10px; font-weight: 600; border-radius: 6px;"><i class="fa-solid fa-crown me-1"></i> PRO</span>`
            : `<span class="badge bg-secondary text-white" style="padding: 5px 10px; font-weight: 500; border-radius: 6px;">Free</span>`;
            
        const headerHtml = `
            <div class="d-flex justify-content-between align-items-start mb-3">
                <div class="d-flex gap-2 align-items-center flex-wrap">
                    <span class="badge bg-primary-subtle text-primary" style="padding: 5px 10px; font-weight: 600; border-radius: 6px;">${exam.technique}</span>
                    ${proBadgeHtml}
                </div>
                <button class="header-bookmark ${isSaved ? 'saved' : ''}" onclick="toggleBookmark(event, '${exam.id}')" title="${isSaved ? 'Bỏ lưu' : 'Lưu đề'}">
                    <i class="${isSaved ? 'fa-solid' : 'fa-regular'} fa-heart"></i>
                </button>
            </div>
        `;

        // --- PHẦN 2: TÊN ĐỀ & THÔNG SỐ (Pills xám nhạt dưới tên) ---
        const titleHtml = `
            <h4 class="card-title mb-2" style="font-weight: 700; color: #1e293b; font-size: 1.2rem; display: flex; align-items: center; gap: 8px;">
                ${exam.id}
                ${isCompleted ? '<i class="fa-solid fa-circle-check text-success" style="font-size: 1rem;" title="Đã thi"></i>' : ''}
            </h4>
        `;

        const pillStyle = "background-color: #f1f5f9; color: #475569; border: 1px solid #e2e8f0; padding: 4px 10px; border-radius: 6px; font-size: 0.8rem; font-weight: 500; display: inline-flex; align-items: center; gap: 5px;";
        const paramsHtml = `
            <div class="d-flex flex-wrap gap-2 mb-3">
                <span style="${pillStyle}"><i class="fa-solid fa-signal" style="color: #94a3b8;"></i> ${exam.level}</span>
                <span style="${pillStyle}"><i class="fa-solid fa-clock" style="color: #94a3b8;"></i> ${exam.timeLimit} phút</span>
                <span style="${pillStyle}"><i class="fa-solid fa-cube" style="color: #94a3b8;"></i> ${exam.questionCount} câu</span>
            </div>
        `;

        // --- PHẦN 3: XỬ LÝ KHỐI ĐIỂM SỐ (Chỉ khi đã thi) ---
        let progressHtml = '';
        let buttonHtml = '';
        
        if (isCompleted) {
            // Lấy thông tin điểm
            const historyData = completedExams.get(exam.id);
            const score = historyData.score || 0;
            const total = historyData.total || exam.questionCount || 1; // Fallback để tránh chia 0
            const percent = Math.min(100, Math.round((score / total) * 100));
            
            progressHtml = `
                <div class="mb-3" style="background-color: #f8fafc; padding: 12px; border-radius: 8px; border: 1px solid #e2e8f0;">
                    <div class="d-flex justify-content-between align-items-center mb-2" style="font-size: 0.85rem;">
                        <span class="text-secondary fw-medium">Lần thi gần nhất</span>
                        <span class="text-success fw-bold">${score} / ${total} điểm</span>
                    </div>
                    <div class="progress" style="height: 6px; border-radius: 10px; background-color: #e2e8f0;">
                        <div class="progress-bar bg-success" role="progressbar" style="width: ${percent}%; border-radius: 10px;" aria-valuenow="${percent}" aria-valuemin="0" aria-valuemax="100"></div>
                    </div>
                </div>
            `;
            
            // Nút bấm chia đôi
            buttonHtml = `
                <div class="d-flex gap-2 w-100 mt-auto">
                    <button class="btn btn-outline-secondary w-50" style="border-radius: 8px; font-weight: 500; font-size: 0.95rem;" onclick="goToHistory('${exam.id}')">
                        <i class="fa-regular fa-clock me-1"></i> Lịch sử
                    </button>
                    <button class="btn w-50 btn-retake-split" style="border-radius: 8px; font-size: 0.95rem;" onclick="goToQuiz('${exam.id}')">
                        <i class="fa-solid fa-rotate-right me-1"></i> Thi lại
                    </button>
                </div>
            `;
        } else {
            // Nút bấm cho đề CHƯA THI (Hoặc check VIP)
            if (isExamVip && !isUserVip) {
                buttonHtml = `
                    <button class="btn w-100 shadow-sm btn-premium-pro mt-auto" style="padding: 10px 12px; font-size: 1rem; border-radius: 8px;" onclick="goToUpgrade()">
                        <i class="fa-solid fa-gem me-2"></i> Nâng cấp tài khoản Pro
                    </button>
                `;
            } else {
                buttonHtml = `
                    <button class="btn btn-primary w-100 mt-auto" style="padding: 10px 12px; font-size: 1rem; font-weight: 600; border-radius: 8px;" onclick="goToQuiz('${exam.id}')">
                        Bắt đầu thi <i class="fa-solid fa-arrow-right ms-1"></i>
                    </button>
                `;
            }
        }

        const card = document.createElement('div');
        card.className = 'course-card exam-card-hover bg-white'; 
        card.style.display = "flex";
        card.style.flexDirection = "column";
        card.style.height = "100%"; 
        card.style.padding = "20px";
        
        card.innerHTML = `
            ${headerHtml}
            ${titleHtml}
            ${paramsHtml}
            
            <!-- Phần Đánh giá / Số lượt thi dồn lên trên Progress -->
            <div class="d-flex align-items-center gap-3 mb-3" style="font-size: 0.85rem; color: #64748b;">
                <div><span class="text-warning"><i class="fa-solid fa-star"></i> ${exam.rating}</span> (${exam.ratingCount})</div>
                <div><i class="fa-solid fa-users"></i> ${exam.attemptCount} lượt</div>
            </div>
            
            ${progressHtml}
            ${buttonHtml}
        `;
        examListContainer.appendChild(card);
    });
}

// =========================================================================
// 6. LOGIC BOOKMARK & CÁC HÀM EXPOSE HTML
// =========================================================================
window.toggleBookmark = async function(event, examId) {
    event.stopPropagation(); 
    
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
            currentUserData.bookmarks = currentUserData.bookmarks.filter(id => id !== examId);
            renderExams();
            await updateDoc(userRef, { bookmarks: arrayRemove(examId) });
        } else {
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

// Hàm chuyển hướng sang tab lịch sử và phát ra sự kiện filter theo mã đề
window.goToHistory = function(examId) {
    // 1. Reset các tab active hiện tại
    const tabPanes = document.querySelectorAll('.tab-pane');
    tabPanes.forEach(pane => pane.classList.remove('active'));
    document.querySelectorAll('.sidebar-menu .menu-item').forEach(m => m.classList.remove('active'));
    
    // 2. Kích hoạt tab Lịch sử (giả định ID là tab-history)
    const historyTab = document.getElementById('tab-history');
    if (historyTab) historyTab.classList.add('active');
    
    // 3. Kích hoạt menu sidebar Lịch sử
    const historyMenu = document.querySelector('.sidebar-menu .menu-item[data-target="tab-history"]');
    if (historyMenu) historyMenu.classList.add('active');
    
    const currentTabTitle = document.getElementById("currentTabTitle");
    if(currentTabTitle) currentTabTitle.textContent = 'Lịch Sử Thi';

    // 4. Bắn sự kiện (CustomEvent) để module history bắt được và fill input search
    document.dispatchEvent(new CustomEvent("filterHistoryByExam", { detail: { examId: examId } }));
};

