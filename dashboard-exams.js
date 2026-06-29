import { db, safeRedirect } from "./dashboard-core.js";
import { collection, getDocs, query, orderBy, where } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// =========================================================================
// 1. BIẾN TOÀN CỤC LƯU TRỮ TRẠNG THÁI & DỮ LIỆU
// =========================================================================
let allExamsCache = []; 
let isUserVip = false;
let currentUserUid = null;

// Các biến trạng thái của Bộ lọc
let currentTechnique = 'all'; 
let currentLevel = 'all';     
let currentTime = 'all';      
let currentSort = 'newest';   

const examContainer = document.getElementById('examListContainer');

// =========================================================================
// 2. KHỞI TẠO & LẮNG NGHE TRẠNG THÁI NGƯỜI DÙNG TỪ CORE
// =========================================================================
document.addEventListener("authReady", (e) => {
    const { user, currentUserData } = e.detail;
    currentUserUid = user.uid;
    
    if (currentUserData && currentUserData.isVip) {
        isUserVip = true;
    }
    
    // Tải thống kê thật từ DB và danh sách đề thi
    loadUserStats(currentUserUid);
    loadExamsFromFirestore();
});

// =========================================================================
// 3. LẮNG NGHE SỰ KIỆN CLICK TỪ UI (BỘ LỌC & SẮP XẾP)
// =========================================================================

// A. Bộ lọc Kỹ thuật (Từ Sidebar Accordion Sub-menu)
const submenuItems = document.querySelectorAll('.submenu-item[data-technique]');
if (submenuItems.length > 0) {
    submenuItems.forEach(item => {
        item.addEventListener('click', (e) => {
            currentTechnique = e.currentTarget.getAttribute('data-technique') || 'all';
            applyFiltersAndRender();
        });
    });
}

// B. Bộ lọc Cấp độ (Pill Buttons)
const filterLevelBtns = document.querySelectorAll('.filter-level');
if (filterLevelBtns.length > 0) {
    filterLevelBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            filterLevelBtns.forEach(b => b.classList.remove('active'));
            e.currentTarget.classList.add('active');
            
            currentLevel = e.currentTarget.getAttribute('data-level') || 'all';
            applyFiltersAndRender();
        });
    });
}

// C. Bộ lọc Thời gian (Pill Buttons)
const filterTimeBtns = document.querySelectorAll('.filter-time');
if (filterTimeBtns.length > 0) {
    filterTimeBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            filterTimeBtns.forEach(b => b.classList.remove('active'));
            e.currentTarget.classList.add('active');
            
            currentTime = e.currentTarget.getAttribute('data-time') || 'all';
            applyFiltersAndRender();
        });
    });
}

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
if (viewBtns.length > 0 && examContainer) {
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
}

// =========================================================================
// 4. HÀM LẤY THỐNG KÊ KẾT QUẢ THẬT TỪ FIRESTORE
// =========================================================================
async function loadUserStats(uid) {
    const statCompletedEl = document.getElementById('statCompletedExams');
    const statAvgEl = document.getElementById('statAvgScore');
    
    try {
        const resultsRef = collection(db, "results");
        // Lấy tất cả bài thi mà user này đã làm
        const q = query(resultsRef, where("userId", "==", uid));
        const snapshot = await getDocs(q);
        
        let totalExams = 0;
        let totalScore = 0;

        snapshot.forEach(doc => {
            const data = doc.data();
            totalExams++;
            // Giả sử field điểm lưu tên là 'score'
            totalScore += parseFloat(data.score) || 0; 
        });

        const avgScore = totalExams > 0 ? (totalScore / totalExams).toFixed(1) : "0.0";

        if (statCompletedEl) statCompletedEl.innerHTML = totalExams + " đề";
        if (statAvgEl) statAvgEl.innerHTML = avgScore + " đ";

    } catch (error) {
        console.error("Lỗi khi tải thống kê cá nhân:", error);
        if (statCompletedEl) statCompletedEl.innerHTML = "Lỗi dữ liệu";
        if (statAvgEl) statAvgEl.innerHTML = "Lỗi dữ liệu";
    }
}

// =========================================================================
// 5. HÀM KÉO DỮ LIỆU ĐỀ THI TỪ FIRESTORE (CHỈ GỌI 1 LẦN)
// =========================================================================
async function loadExamsFromFirestore() {
    if (!examContainer) return;

    try {
        const examsRef = collection(db, "exams");
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

        applyFiltersAndRender();

    } catch (error) {
        console.error("Lỗi khi tải danh sách đề thi:", error);
        examContainer.innerHTML = `<div style="grid-column: 1/-1; text-align:center; color: var(--danger-red); padding: 20px;">Lỗi tải dữ liệu. Vui lòng kiểm tra lại kết nối internet.</div>`;
    }
}

// =========================================================================
// 6. HÀM LỌC, SẮP XẾP VÀ RENDER DỮ LIỆU LÊN MÀN HÌNH
// =========================================================================
function applyFiltersAndRender() {
    // 1. Lọc mảng dữ liệu qua 3 điều kiện
    let filteredExams = allExamsCache.filter(exam => {
        const passTechnique = (currentTechnique === 'all') || (exam.technique === currentTechnique);
        const passLevel = (currentLevel === 'all') || (exam.level === currentLevel);
        const passTime = (currentTime === 'all') || (String(exam.timeLimit) === currentTime);

        return passTechnique && passLevel && passTime;
    });

    // 2. Sắp xếp dữ liệu
    if (currentSort === 'only_vip') {
        filteredExams = filteredExams.filter(exam => exam.isVipOnly === true);
    } else if (currentSort === 'only_free') {
        filteredExams = filteredExams.filter(exam => exam.isVipOnly === false);
    } else if (currentSort === 'highest_rating') {
        filteredExams.sort((a, b) => b.rating - a.rating);
    } else if (currentSort === 'most_attempts') {
        filteredExams.sort((a, b) => b.attempts - a.attempts);
    } else {
        filteredExams.sort((a, b) => b.createdAt - a.createdAt);
    }

    // 3. Kết xuất UI
    renderToDOM(filteredExams);
}

function renderToDOM(examsArray) {
    if (!examContainer) return;

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
        
        let badgeHtml = exam.isVipOnly 
            ? `<div class="course-badge badge-vip"><i class="fa-solid fa-crown"></i> VIP</div>` 
            : `<div class="course-badge badge-free">Free</div>`;

        let buttonHtml = isLocked 
            ? `<button class="btn-locked" disabled><i class="fa-solid fa-lock"></i> Nâng cấp VIP để mở</button>`
            : `<button class="btn-primary btn-start-exam" data-id="${exam.id}"><i class="fa-solid fa-play"></i> Bắt đầu thi</button>`;

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

    const startBtns = document.querySelectorAll('.btn-start-exam');
    startBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            const examId = e.currentTarget.getAttribute('data-id');
            safeRedirect(`exam.html?id=${examId}`);
        });
    });
}
