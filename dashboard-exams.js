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
let completedExams = {}; // ĐÃ NÂNG CẤP: Dùng Object để lưu chi tiết điểm số

// DOM Elements
const examListContainer = document.getElementById('examListContainer');
const sortFilter = document.getElementById('sortFilter');
const viewBtns = document.querySelectorAll('.view-btn');

const subMenuItems = document.querySelectorAll('.sub-menu-item');
const levelPills = document.querySelectorAll('#levelFilter .pill-btn');
const timePills = document.querySelectorAll('#timeFilter .pill-btn');
const searchInput = document.getElementById('searchInput');

// Bơm CSS động cho hiệu ứng Hover mượt mà, Nút PRO rực rỡ & Băng chuyền Netflix
const styleId = "exam-card-dynamic-styles";
if (!document.getElementById(styleId)) {
    const style = document.createElement('style');
    style.id = styleId;
    style.innerHTML = `
        /* Ẩn thanh cuộn scrollbar cho giao diện băng chuyền */
        .hide-scrollbar::-webkit-scrollbar { display: none; }
        .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        
        /* Ghi đè class container để tránh xung đột với lưới Grid/List cũ */
        .swimlane-view { display: block !important; }

        /* Box-shadow mặc định và hiệu ứng Hover nảy lên mượt mà */
        .exam-card-hover {
            box-shadow: 0 2px 8px rgba(0,0,0,0.04) !important;
            transition: all 0.3s ease !important;
        }
        .exam-card-hover:hover {
            transform: translateY(-4px) !important;
            box-shadow: 0 12px 24px rgba(0,0,0,0.08) !important;
        }

        /* Nút "Vào thi ngay" thành màu xanh nhạt, mát mắt */
        .btn-primary {
            background-color: #e0f2fe !important;
            color: #0369a1 !important;
            border: none !important;
            font-weight: 600 !important;
            transition: all 0.2s ease !important;
        }
        .btn-primary:hover {
            background-color: #bae6fd !important;
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
                            timestamp: ts,
                            resultId: doc.id
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
                // Gọi renderExams để update UI, container class sẽ do renderExams tự xử lý
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
// 5. CẤU TRÚC GIAO DIỆN BĂNG CHUYỀN (SWIMLANES NETFLIX STYLE)
// =========================================================================
function renderExams() {
    if (allExamsData.length === 0) {
        examListContainer.innerHTML = '<div class="loading-text">Hiện tại chưa có khóa học / đề thi nào.</div>';
        return;
    }

    let displayData = [...allExamsData];
    const userBookmarks = (currentUserData && currentUserData.bookmarks) ? currentUserData.bookmarks : [];

    // --- CÁC LỚP LỌC DỮ LIỆU ---
    if (currentTechnique === 'saved') {
        displayData = displayData.filter(exam => userBookmarks.includes(exam.id));
    } else if (currentTechnique !== 'all') {
        displayData = displayData.filter(exam => exam.technique === currentTechnique);
    }

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

    const filterType = sortFilter.value;
    if (filterType === 'only_vip') displayData = displayData.filter(exam => exam.isVip);
    else if (filterType === 'only_free') displayData = displayData.filter(exam => !exam.isVip);

    if (filterType === 'highest_rating') displayData.sort((a, b) => b.rating - a.rating);
    else if (filterType === 'most_attempts') displayData.sort((a, b) => b.attemptCount - a.attemptCount);
    else displayData.sort((a, b) => b.createdAt - a.createdAt); 

    examListContainer.innerHTML = "";
    
    // Ép buộc container hiển thị dạng Block để không bị vỡ Layout Băng chuyền 
    examListContainer.className = "swimlane-view";

    if (displayData.length === 0) {
        if (currentTechnique === 'saved') {
            examListContainer.innerHTML = '<div class="loading-text">Bạn chưa lưu đề thi nào vào bộ sưu tập.</div>';
        } else {
            examListContainer.innerHTML = '<div class="loading-text">Không tìm thấy đề thi nào phù hợp với các bộ lọc hiện tại.</div>';
        }
        return;
    }

    const isUserVip = currentUserData && currentUserData.isVip === true;

    // --- PHÂN LUỒNG DỮ LIỆU THÀNH CÁC NHÓM (CONTENT CURATION) ---
    const groups = [
        { title: "📝 Đề đã thi & Cần ôn tập", data: displayData.filter(exam => !!completedExams[exam.id]) },
        { title: "⚡ Khởi động nhanh (15 phút)", data: displayData.filter(exam => exam.timeLimit === 15) },
        { title: "🔥 Thử thách chuyên sâu", data: displayData.filter(exam => exam.level === 'Khó') },
        { title: "🧲 Khối kiến thức MRI", data: displayData.filter(exam => exam.technique === 'MRI') },
        { title: "☢️ Khối kiến thức CT Scanner", data: displayData.filter(exam => exam.technique === 'CT') },
        { title: "🩻 Khối kiến thức X-Quang", data: displayData.filter(exam => exam.technique === 'X quang') },
        { title: "🧩 Khối kiến thức Hỗn hợp & Khác", data: displayData.filter(exam => exam.technique === 'Hỗn hợp' || !['MRI', 'CT', 'X quang'].includes(exam.technique)) }
    ];

    // --- RENDER TỪNG BĂNG CHUYỀN ---
    groups.forEach(group => {
        if (group.data.length === 0) return; // Bỏ qua nếu nhóm không có đề thi

        let rowHtml = `
            <div class="exam-category-row mb-5">
                <h4 class="fw-bold mb-3 text-dark" style="font-size: 1.15rem; border-left: 4px solid #084298; padding-left: 10px;">${group.title}</h4>
                <div class="d-flex overflow-x-auto hide-scrollbar" style="flex-wrap: nowrap; scroll-snap-type: x mandatory; padding: 10px 5px; padding-bottom: 20px;">
        `;

        group.data.forEach(exam => {
            const isExamVip = exam.isVip;
            const isSaved = userBookmarks.includes(exam.id);
            const isCompleted = !!completedExams[exam.id];
            
            // 1. GÓC PHẢI: Badge PRO/Free & Nút Bookmark
            const badgeHtml = isExamVip 
                ? `<span class="course-badge badge-vip header-badge"><i class="fa-solid fa-crown"></i> PRO</span>`
                : `<span class="course-badge badge-free header-badge">Free</span>`;
                
            const bookmarkHtml = `
                <button class="btn-bookmark header-bookmark ${isSaved ? 'saved' : ''}" onclick="toggleBookmark(event, '${exam.id}')" title="${isSaved ? 'Bỏ lưu đề thi' : 'Lưu đề thi'}">
                    <i class="${isSaved ? 'fa-solid' : 'fa-regular'} fa-heart"></i>
                </button>
            `;

            // 2. HEADER FLEXBOX
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

            // 3. DẢI BADGE PASTEL 4 THÔNG SỐ (Minimalist Style)
            let levelColor = '#d97706'; // Vàng cam cho Trung bình
            let levelIcon = 'fa-chart-bar';
            if (exam.level === 'Dễ') {
                levelColor = '#059669'; // Xanh lá
                levelIcon = 'fa-arrow-trend-up';
            } else if (exam.level === 'Khó') {
                levelColor = '#dc2626'; // Đỏ
                levelIcon = 'fa-fire';
            }

            const pillBaseStyle = "padding: 4px 8px; border-radius: 6px; font-size: 0.72rem; font-weight: 600; display: inline-flex; align-items: center; gap: 4px; border: 1px solid #e9ecef; background-color: #f8f9fa; white-space: nowrap; flex-shrink: 0;";

            const mergedTagsHtml = `
                <div style="display: flex; flex-wrap: nowrap; gap: 6px; margin-bottom: 20px; overflow: hidden; width: 100%;">
                    <span style="${pillBaseStyle} color: #0284c7;">
                        <i class="fa-solid fa-microchip" style="font-size: 0.7rem;"></i> ${exam.technique}
                    </span>
                    <span style="${pillBaseStyle} color: ${levelColor};">
                        <i class="fa-solid ${levelIcon}" style="font-size: 0.7rem;"></i> ${exam.level}
                    </span>
                    <span style="${pillBaseStyle} color: #4b5563;">
                        <i class="fa-solid fa-list-check" style="font-size: 0.7rem;"></i> ${exam.questionCount} câu
                    </span>
                    <span style="${pillBaseStyle} color: #4b5563;">
                        <i class="fa-regular fa-clock" style="font-size: 0.7rem;"></i> ${exam.timeLimit} phút
                    </span>
                </div>
            `;

            // 4. ACTION BUTTON THÔNG MINH (CÓ VÒNG TRÒN ĐIỂM SỐ SVG)
            let actionAreaHtml = '';
            if (isExamVip && !isUserVip) {
                actionAreaHtml = `
                    <button onclick="goToUpgrade()" style="width: 100%; display: block; padding: 12px; border: none; background: linear-gradient(135deg, #fff3cd 0%, #ffe69c 100%); color: #997404; border-radius: 8px; font-weight: 600; cursor: pointer; transition: all 0.3s ease; box-shadow: 0 2px 4px rgba(255, 230, 156, 0.4);">
                        <i class="fa-solid fa-crown me-2"></i> Nâng cấp tài khoản Pro
                    </button>
                `;
            } else if (isCompleted) {
                const correctAnswers = completedExams[exam.id].score || 0;
                const total = completedExams[exam.id].total || 1;

                let displayScore = (correctAnswers / total) * 10;
                displayScore = Number.isInteger(displayScore) ? displayScore : parseFloat(displayScore.toFixed(1));

                const percent = Math.min(100, (displayScore / 10) * 100);
                const radius = 24;
                const circum = 2 * Math.PI * radius; 
                const offset = circum - (percent / 100) * circum; 
                const dotRotation = (percent / 100) * 360; 

                actionAreaHtml = `
                    <div style="margin-bottom: 20px; padding: 12px 16px; background-color: #f8f9fa; border: 1px solid #e9ecef; border-radius: 12px; display: flex; align-items: center; justify-content: space-between; box-shadow: inset 0 1px 3px rgba(0,0,0,0.02);">
                        <div>
                            <span style="font-size: 0.85rem; color: #6c757d; font-weight: 600; display: block; margin-bottom: 4px;">Lần thi gần nhất</span>
                            <span style="font-size: 1.15rem; color: #0ba360; font-weight: 800;">${displayScore} <span style="font-size:0.85rem; color:#6c757d; font-weight:600;">/ 10</span></span>
                        </div>

                        <div style="position: relative; width: 56px; height: 56px;">
                            <svg width="56" height="56" viewBox="0 0 56 56" style="transform: rotate(-90deg); overflow: visible;">
                                <defs>
                                    <linearGradient id="grad_${exam.id}" x1="0%" y1="0%" x2="100%" y2="0%">
                                        <stop offset="0%" stop-color="#0ba360" />
                                        <stop offset="100%" stop-color="#3cba92" />
                                    </linearGradient>
                                </defs>
                                <circle cx="28" cy="28" r="${radius}" fill="none" stroke="#e9ecef" stroke-width="5"></circle>
                                <circle cx="28" cy="28" r="${radius}" fill="none" stroke="url(#grad_${exam.id})" stroke-width="5"
                                        stroke-dasharray="${circum}" stroke-dashoffset="${offset}"
                                        stroke-linecap="butt" style="transition: stroke-dashoffset 1s ease-out;"></circle>
                                <g style="transform: rotate(${dotRotation}deg); transform-origin: 28px 28px; transition: transform 1s ease-out;">
                                    <circle cx="52" cy="28" r="4.5" fill="#fff" stroke="#0ba360" stroke-width="2.5"></circle>
                                </g>
                            </svg>
                        </div>
                    </div>

                    <div style="display: flex; gap: 12px; width: 100%;">
                        <button onclick="goToHistory('${exam.id}')" onmouseover="this.style.background='#e9ecef'" onmouseout="this.style.background='transparent'" style="flex: 1; padding: 10px 0; border: 1px solid #adb5bd; background: transparent; color: #495057; border-radius: 8px; font-weight: 600; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 6px; transition: all 0.2s;">
                            <i class="fas fa-history me-2"></i> Lịch sử
                        </button>
                        <button onclick="goToQuiz('${exam.id}')" onmouseover="this.style.background='#9ec5fe'" onmouseout="this.style.background='#cfe2ff'" style="flex: 1; padding: 10px 0; border: none; background: #cfe2ff; color: #084298; border-radius: 8px; font-weight: 600; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 6px; transition: all 0.2s;">
                            <i class="fas fa-redo me-2"></i> Thi lại
                        </button>
                    </div>
                `;
            } else {
                actionAreaHtml = `
                    <button class="btn-primary" style="width: 100%; padding: 10px; font-size: 1rem; border-radius: 8px; border: none;" onclick="goToQuiz('${exam.id}')">
                        Vào thi ngay <i class="fa-solid fa-arrow-right ms-2"></i>
                    </button>
                `;
            }

            // --- GHÉP CARD VÀO TRONG ROW HTML, THÊM MARGIN CHO CÁC THẺ ---
            rowHtml += `
                <div class="course-card exam-card-hover h-100 d-flex flex-column" style="min-width: 340px; max-width: 340px; flex-shrink: 0; scroll-snap-align: start; margin-right: 24px; margin-bottom: 10px; border-radius: 12px; border: 1px solid #eef0f2; background: #fff; overflow: hidden; position: relative;">
                    <div class="card-body p-4 d-flex flex-column h-100">
                        ${headerHtml}
                        ${mergedTagsHtml}
                        
                        <div class="card-meta mt-auto" style="border-top: 1px dashed #e9ecef; padding-top: 15px; display: flex; justify-content: space-between; font-size: 0.9rem; color: #6c757d; margin-bottom: 20px;">
                            <div class="rating"><span class="fw-bold text-dark">${exam.rating}</span> <i class="fa-solid fa-star text-warning"></i> <span>(${exam.ratingCount})</span></div>
                            <div class="attempts"><i class="fa-solid fa-users"></i> ${exam.attemptCount} lượt thi</div>
                        </div>
                        
                        <div>
                            ${actionAreaHtml}
                        </div>
                    </div>
                </div>
            `;
        });

        rowHtml += `
                </div>
            </div>
        `;
        examListContainer.insertAdjacentHTML('beforeend', rowHtml);
    });
}

// =========================================================================
// 6. LOGIC BOOKMARK & CÁC HÀM EXPOSE HTML
// =========================================================================
window.toggleBookmark = async function(event, examId) {
    event.stopPropagation(); 
    
    // YÊU CẦU CỐT LÕI: Kiểm tra đăng nhập (Không áp dụng user khách)
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

window.goToHistory = function(examId) {
    if (!examId) return;
    
    const historyData = completedExams[examId];
    if (historyData && historyData.resultId) {
        // Mở thẳng trang quiz kèm resultId để kích hoạt chế độ Xem lại (Review mode)
        const url = `quiz.html?resultId=${historyData.resultId}`;
        window.open(url, '_blank');
    } else {
        alert("Không tìm thấy dữ liệu bài thi cũ để xem lại.");
    }
};
