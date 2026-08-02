import { db, showToast } from './admin-core.js';
import { 
    collection, getDocs, doc, setDoc, updateDoc, deleteDoc, addDoc, query, where, getDoc, onSnapshot 
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// Các biến trạng thái bộ lọc toàn cục
let currentTechnique = "MRI";
let currentLevel = "all";
let currentTime = "all";
let currentSearchQuery = "";

let cachedExams = [];
let draftData = [];
let currentEditingExamId = "";

// Biến lưu trữ State cục bộ cho Real-time
let rawExams = [];
let rawQuestions = [];
let rawFeedbacks = [];
let loadedStatus = { exams: false, questions: false, feedbacks: false };
let listenersInitialized = false;

// Trạng thái hiển thị của Bảng thống kê
let isStatsVisible = false; 

// =========================================================================
// HÀM KHỞI TẠO LẮNG NGHE REAL-TIME (TỐI ƯU QUOTA)
// =========================================================================
export function loadExamList() {
    if (listenersInitialized) return;
    listenersInitialized = true;
    
    const container = document.getElementById('exam-list-body');
    if (container) container.innerHTML = '<div class="loading-text">⏳ Đang thiết lập kết nối thời gian thực (Real-time) để tối ưu Quota...</div>';

    onSnapshot(collection(db, "exams"), (snapshot) => {
        rawExams = snapshot.docs;
        loadedStatus.exams = true;
        processAndRender();
    }, (error) => handleLoadError(error));

    onSnapshot(collection(db, "questions"), (snapshot) => {
        rawQuestions = snapshot.docs;
        loadedStatus.questions = true;
        processAndRender();
    }, (error) => handleLoadError(error));

    onSnapshot(collection(db, "feedbacks"), (snapshot) => {
        rawFeedbacks = snapshot.docs;
        loadedStatus.feedbacks = true;
        processAndRender();
    }, (error) => handleLoadError(error));
}

function handleLoadError(error) {
    console.error("Lỗi khi tải danh sách đề thi:", error);
    const container = document.getElementById('exam-list-body');
    if (container) container.innerHTML = `<div class="empty-message" style="color: red;">❌ Không thể kết nối Cloud Firestore để đồng bộ dữ liệu.</div>`;
}

// =========================================================================
// HÀM XỬ LÝ DỮ LIỆU SAU KHI FIRESTORE TRẢ VỀ (CACHE & MAP)
// =========================================================================
function processAndRender() {
    if (!loadedStatus.exams || !loadedStatus.questions || !loadedStatus.feedbacks) return;

    const examDataMap = {};
    rawExams.forEach(docSnap => {
        const data = docSnap.data();
        examDataMap[docSnap.id] = {
            isVip: data.isVip || false,
            timeLimit: data.timeLimit !== undefined ? data.timeLimit : 15,
            attemptCount: data.attemptCount || 0,
            technique: data.technique || "Hỗn hợp",
            level: data.level || "Trung bình",
            createdAt: data.createdAt,
            examName: data.examName || "",
            description: data.description || ""
        };
    });

    const feedbackCounts = {};
    const feedbackStars = {};
    rawFeedbacks.forEach(docSnap => {
        const fb = docSnap.data();
        if (fb.examId) {
            feedbackCounts[fb.examId] = (feedbackCounts[fb.examId] || 0) + 1;
            feedbackStars[fb.examId] = (feedbackStars[fb.examId] || 0) + (fb.rating || 5);
        }
    });

    const examGroups = {}; 
    rawQuestions.forEach((docSnap) => {
        const data = docSnap.data();
        const examId = data.examId || "Chưa phân loại"; 
        if (!examGroups[examId]) examGroups[examId] = 0;
        examGroups[examId]++; 
    });

    cachedExams = [];
    for (const examId in examGroups) {
        const count = examGroups[examId];
        const config = examDataMap[examId] || { isVip: false, timeLimit: 15, attemptCount: 0, technique: "Hỗn hợp", level: "Trung bình", createdAt: null, examName: "", description: "" };

        const fCount = feedbackCounts[examId] || 0;
        const fStars = feedbackStars[examId] || 0;
        const avgRating = fCount > 0 ? (fStars / fCount) : 0; 

        cachedExams.push({
            examId: examId, 
            examName: config.examName,
            description: config.description, 
            count: count, 
            isVip: config.isVip,
            timeLimit: config.timeLimit, 
            attemptCount: config.attemptCount,
            technique: config.technique, 
            level: config.level,
            createdAt: config.createdAt || 0,
            feedbackCount: fCount,
            rating: avgRating 
        });
    }

    renderExamList();
}

// =========================================================================
// HÀM TẠO BẢNG THỐNG KÊ NHANH (Có trạng thái Ẩn/Hiện)
// =========================================================================
function generateStatsHtml() {
    const stats = {};
    let totalExams = 0;
    
    cachedExams.forEach(ex => {
        totalExams++;
        const t = ex.technique || "Chưa phân loại";
        const l = ex.level || "Không xác định";
        const time = ex.timeLimit || 0;

        if(!stats[t]) stats[t] = { total: 0, levels: {} };
        stats[t].total++;

        if(!stats[t].levels[l]) stats[t].levels[l] = { total: 0, times: {} };
        stats[t].levels[l].total++;

        if(!stats[t].levels[l].times[time]) stats[t].levels[l].times[time] = 0;
        stats[t].levels[l].times[time]++;
    });

    let tableContent = '';
    if (isStatsVisible) {
        tableContent = `
        <div style="overflow-x: auto; border-radius: 8px; border: 1px solid #cbd5e1; margin-top: 20px;">
        <table style="width:100%; border-collapse:collapse; background: #fff; min-width: 600px;">
            <thead style="background:#f8fafc; color:#475569; font-size:13px; text-transform:uppercase; border-bottom: 2px solid #cbd5e1;">
                <tr>
                    <th style="padding:12px 15px; text-align:left; width: 30%;">Chuyên khoa</th>
                    <th style="padding:12px 15px; text-align:center; width: 25%;">Cấp độ</th>
                    <th style="padding:12px 15px; text-align:center; width: 25%;">Thời gian</th>
                    <th style="padding:12px 15px; text-align:center; width: 20%;">Số lượng đề</th>
                </tr>
            </thead>
            <tbody>`;

        for(const t in stats) {
            const techData = stats[t];
            const levels = Object.keys(techData.levels);
            
            let techRowSpan = 0;
            levels.forEach(l => { techRowSpan += Object.keys(techData.levels[l].times).length; });

            let firstTech = true;
            for(const l of levels) {
                const times = Object.keys(techData.levels[l].times);
                let firstLevel = true;
                
                for(const time of times) {
                    tableContent += `<tr style="border-bottom: 1px solid #e2e8f0; transition: background 0.2s;" onmouseover="this.style.background='#f1f5f9'" onmouseout="this.style.background='transparent'">`;
                    
                    if(firstTech) {
                        tableContent += `<td rowspan="${techRowSpan}" style="padding:15px; vertical-align:middle; font-weight:700; color:#1e293b; border-right:1px solid #e2e8f0; background: #fff;">
                                    ${t} <br><span style="font-size:12px; font-weight: normal; color: #64748b;">(Tổng: ${techData.total} đề)</span>
                                 </td>`;
                        firstTech = false;
                    }
                    if(firstLevel) {
                        let lvlColor = l === 'Khó' ? '#ef4444' : (l === 'Dễ' ? '#10b981' : '#f59e0b');
                        tableContent += `<td rowspan="${times.length}" style="padding:15px; vertical-align:middle; text-align:center; font-weight:700; color:${lvlColor}; border-right:1px solid #e2e8f0; background: #fff;">
                                    ${l} <br><span style="font-size:12px; font-weight: normal; color: #64748b;">(Có ${techData.levels[l].total} đề)</span>
                                 </td>`;
                        firstLevel = false;
                    }
                    
                    tableContent += `<td style="padding:12px 15px; text-align:center; color:#475569; font-weight: 500;">${time} phút</td>`;
                    tableContent += `<td style="padding:12px 15px; text-align:center; font-weight:bold; color:#0f172a; font-size: 15px;">
                                <span style="background: #e0f2fe; color: #0369a1; padding: 4px 12px; border-radius: 20px;">${techData.levels[l].times[time]}</span>
                             </td>`;
                    tableContent += `</tr>`;
                }
            }
        }
        tableContent += `</tbody></table></div>`;
    }

    let btnStyle = isStatsVisible 
        ? "background: #f8fafc; color: #475569; border: 1px solid #cbd5e1;" 
        : "background: #3b82f6; color: white; border: 1px solid #3b82f6; box-shadow: 0 2px 4px rgba(59,130,246,0.3);";
    let btnText = isStatsVisible ? '<i class="fa-solid fa-eye-slash"></i> Ẩn thống kê' : '<i class="fa-solid fa-chart-pie"></i> Xem thống kê nhanh';

    let html = `
    <div style="background: white; border-radius: 12px; padding: 20px; margin-bottom: 25px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); border: 1px solid #e2e8f0;">
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 15px;">
            <h3 style="margin: 0; color: #0f172a; display: flex; align-items: center; gap: 10px; font-size: 17px;">
                <i class="fa-solid fa-layer-group" style="color: #3b82f6;"></i> Ngân Hàng Đề (Tổng: <span style="color:#ef4444;">${totalExams}</span> đề)
            </h3>
            <button id="btn-toggle-stats" style="padding: 8px 16px; border-radius: 6px; cursor: pointer; font-size: 13px; font-weight: 600; transition: 0.2s; ${btnStyle}">
                ${btnText}
            </button>
        </div>
        ${tableContent}
    </div>`;

    return html;
}

// =========================================================================
// TÍNH NĂNG MỚI: XEM DANH SÁCH LỊCH SỬ HỌC VIÊN ĐÃ THI
// =========================================================================
function injectHistoryModal() {
    if (document.getElementById('exam-history-modal')) return;
    const modalHtml = `
    <div id="exam-history-modal" style="display:none; position:fixed; z-index:9999; left:0; top:0; width:100%; height:100%; background-color:rgba(15, 23, 42, 0.75); backdrop-filter: blur(4px);">
        <div style="background-color:#fff; margin:5vh auto; padding:0; border-radius:12px; width:95%; max-width:800px; max-height:90vh; display:flex; flex-direction:column; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.25); overflow: hidden;">
            <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid #e2e8f0; padding:15px 20px; background: #f8fafc;">
                <h3 style="margin:0; color:#0f172a; font-size:16px;"><i class="fa-solid fa-users" style="color:#3b82f6;"></i> Danh sách thi đề: <span id="history-modal-exam-id" style="color:#2563eb; font-weight: 800;"></span></h3>
                <span id="close-exam-history-modal" style="cursor:pointer; font-size:24px; color:#94a3b8; line-height: 1;">&times;</span>
            </div>
            <div style="overflow-y:auto; flex:1; padding: 0;">
                <table style="width:100%; border-collapse:collapse; text-align:left;">
                    <thead style="background:#f1f5f9; border-bottom:2px solid #cbd5e1; position: sticky; top: 0; z-index: 10;">
                        <tr>
                            <th style="padding:12px 15px; color:#475569; font-size:13px; text-transform:uppercase;">Email Học viên</th>
                            <th style="padding:12px 15px; color:#475569; font-size:13px; text-transform:uppercase; text-align:center;">Điểm số</th>
                            <th style="padding:12px 15px; color:#475569; font-size:13px; text-transform:uppercase; text-align:right;">Thời gian nộp (Mới nhất)</th>
                        </tr>
                    </thead>
                    <tbody id="history-table-body">
                    </tbody>
                </table>
            </div>
        </div>
    </div>`;
    document.body.insertAdjacentHTML('beforeend', modalHtml);

    document.getElementById('close-exam-history-modal').onclick = () => {
        document.getElementById('exam-history-modal').style.display = 'none';
    };
}

async function viewExamHistory(examId) {
    injectHistoryModal();
    const modal = document.getElementById('exam-history-modal');
    const tbody = document.getElementById('history-table-body');
    
    document.getElementById('history-modal-exam-id').innerText = examId;
    tbody.innerHTML = '<tr><td colspan="3" style="text-align:center; padding:30px; color:#64748b;">⏳ Đang kéo dữ liệu từ máy chủ...</td></tr>';
    modal.style.display = 'block';

    try {
        // Trỏ truy vấn vào collection "results"
        const q = query(collection(db, "results"), where("examId", "==", examId));
        const snap = await getDocs(q);
        
        tbody.innerHTML = '';
        if (snap.empty) {
            tbody.innerHTML = '<tr><td colspan="3" style="text-align:center; padding:30px; color:#94a3b8; font-style: italic;">Chưa có học viên nào hoàn thành đề thi này.</td></tr>';
            return;
        }

        // Lọc trùng lặp người dùng bằng Map
        let uniqueUsersMap = new Map();

        snap.forEach(docSnap => {
            const data = docSnap.data();
            const userIdentifier = data.uid || data.userId || data.email || data.userEmail || docSnap.id;
            
            if (!uniqueUsersMap.has(userIdentifier)) {
                uniqueUsersMap.set(userIdentifier, data);
            } else {
                // Nếu đã tồn tại, so sánh thời gian để lấy lần nộp bài sau cùng
                const existingData = uniqueUsersMap.get(userIdentifier);
                const existingTime = existingData.timestamp || existingData.createdAt || 0;
                const newTime = data.timestamp || data.createdAt || 0;
                
                if (newTime > existingTime) {
                    uniqueUsersMap.set(userIdentifier, data);
                }
            }
        });

        let records = Array.from(uniqueUsersMap.values());
        
        // Sắp xếp mới nhất lên đầu
        records.sort((a, b) => (b.timestamp || b.createdAt || 0) - (a.timestamp || a.createdAt || 0)); 

        records.forEach(data => {
            let timeStr = 'Không xác định';
            const rawTime = data.timestamp || data.createdAt;
            if (rawTime) {
                const date = (typeof rawTime.toDate === 'function') ? rawTime.toDate() : new Date(rawTime);
                timeStr = date.toLocaleString('vi-VN');
            }
            
            const scoreText = data.score !== undefined ? data.score : (data.correctAnswers || 0);
            const totalText = data.totalQuestions || 0;
            const email = data.email || data.userEmail || data.uid || "Khách vô danh";

            tbody.innerHTML += `
                <tr style="border-bottom: 1px solid #e2e8f0; transition: background 0.2s;" onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background='transparent'">
                    <td style="padding:15px; color:#0f172a; font-weight:600; font-size: 14px;">${email}</td>
                    <td style="padding:15px; text-align:center;">
                        <span style="background: #d1fae5; color: #059669; padding: 4px 10px; border-radius: 20px; font-weight: 700; font-size: 13px; border: 1px solid #a7f3d0;">
                            ${scoreText} ${totalText ? `/ ${totalText}` : ''}
                        </span>
                    </td>
                    <td style="padding:15px; text-align:right; color:#64748b; font-size:13px;">${timeStr}</td>
                </tr>
            `;
        });
    } catch (err) {
        console.error("Lỗi tải lịch sử:", err);
        tbody.innerHTML = '<tr><td colspan="3" style="text-align:center; padding:30px; color:#ef4444;">❌ Lỗi kết nối Cơ sở dữ liệu khi tải lịch sử.</td></tr>';
    }
}

// =========================================================================
// HÀM HIỂN THỊ DANH SÁCH RA MÀN HÌNH THEO BỘ LỌC
// =========================================================================
export function renderExamList() {
    const container = document.getElementById('exam-list-body');
    if (!container) return;

    container.innerHTML = '';

    // CHÈN BẢNG THỐNG KÊ (NẾU Ở TAB CHƯA PHÂN LOẠI)
    if (currentTechnique === "Chưa phân loại") {
        const statsWrapper = document.createElement('div');
        statsWrapper.innerHTML = generateStatsHtml();
        container.appendChild(statsWrapper);

        const toggleBtn = statsWrapper.querySelector('#btn-toggle-stats');
        if (toggleBtn) {
            toggleBtn.addEventListener('click', () => {
                isStatsVisible = !isStatsVisible;
                renderExamList();
            });
        }
    }

    const filteredExams = cachedExams.filter(exam => {
        const matchTech = exam.technique === currentTechnique;
        const matchLevel = currentLevel === "all" || exam.level === currentLevel;
        const matchTime = currentTime === "all" || String(exam.timeLimit) === String(currentTime);
        const searchTarget = (exam.examId + " " + exam.examName).toLowerCase();
        const matchSearch = !currentSearchQuery || searchTarget.includes(currentSearchQuery);
        return matchTech && matchLevel && matchTime && matchSearch;
    });

    const sortSelect = document.getElementById('examSortSelect');
    const sortMode = sortSelect ? sortSelect.value : 'newest';

    filteredExams.sort((a, b) => {
        if (sortMode === 'most_attempts') return b.attemptCount - a.attemptCount;
        if (sortMode === 'most_feedbacks') return b.feedbackCount - a.feedbackCount;
        if (sortMode === 'highest_rating') return b.rating - a.rating;
        return b.createdAt - a.createdAt;
    });

    if (filteredExams.length === 0) {
        const emptyMsg = document.createElement('div');
        emptyMsg.className = 'empty-message';
        emptyMsg.style.cssText = 'width: 100%; background: #ffffff; padding: 40px; border-radius: 12px; border: 1px dashed #cbd5e1;';
        emptyMsg.innerHTML = '🔍 Không tìm thấy mã đề thi nào thỏa mãn điều kiện lọc hiện tại.';
        container.appendChild(emptyMsg);
        return;
    }

    filteredExams.forEach(exam => {
        let levelClass = 'level-medium';
        if (exam.level === 'Dễ') levelClass = 'level-easy';
        else if (exam.level === 'Khó') levelClass = 'level-hard';

        let formattedDate = 'Không rõ';
        if (exam.createdAt) {
            if (typeof exam.createdAt.toDate === 'function') {
                formattedDate = exam.createdAt.toDate().toLocaleDateString('vi-VN');
            } else {
                const numDate = Number(exam.createdAt);
                if (!isNaN(numDate) && numDate > 100000000) {
                    let finalMs = numDate > 1000000000000 ? numDate : numDate * 1000;
                    formattedDate = new Date(finalMs).toLocaleDateString('vi-VN');
                } else {
                    formattedDate = new Date(exam.createdAt).toLocaleDateString('vi-VN');
                }
            }
        }

        const displayTitle = exam.examName ? exam.examName : `Đề: ${exam.examId}`;
        const displaySubId = exam.examName ? `<span class="exam-subtitle-id">Mã: ${exam.examId}</span>` : '';

        let feedbackBadgeHtml = '';
        if (exam.feedbackCount > 0) {
            const formattedRating = Number.isInteger(exam.rating) ? exam.rating : exam.rating.toFixed(1);
            feedbackBadgeHtml = `<span style="background: #f59e0b; color: white; border-radius: 10px; padding: 2px 6px; font-size: 0.75rem; margin-left: 4px; line-height: 1; box-shadow: 0 1px 2px rgba(0,0,0,0.1);">${formattedRating}★ (${exam.feedbackCount})</span>`;
        }
        const feedbackBtnClass = exam.feedbackCount > 0 ? "btn-modern-action btn-view-feedback has-feedback" : "btn-modern-action btn-view-feedback";

        const safeDescription = encodeURIComponent(exam.description || "");

        const cardDiv = document.createElement('div');
        cardDiv.className = 'exam-premium-card';
        
        cardDiv.innerHTML = `
            <div class="card-premium-header">
                <div class="header-left">
                    <h3 class="exam-premium-title">${displayTitle}</h3>
                    ${displaySubId}
                </div>
                <div class="header-right">
                    ${exam.isVip ? '<span class="badge-premium-vip"><i class="fa-solid fa-crown"></i> PRO</span>' : '<span class="badge-premium-free">Miễn Phí</span>'}
                </div>
            </div>
            
            <div class="card-premium-meta">
                <div class="meta-tags-container">
                    <span class="premium-tag tech-tag"><i class="fa-solid fa-microchip"></i> ${exam.technique}</span>
                    <span class="premium-tag ${levelClass}"><i class="fa-solid fa-chart-simple"></i> ${exam.level}</span>
                    <span class="premium-tag time-tag"><i class="fa-regular fa-clock"></i> ${exam.timeLimit} phút</span>
                    <span class="premium-tag count-tag"><i class="fa-solid fa-list-check"></i> ${exam.count} Câu</span>
                </div>
                <div class="meta-stats-container">
                    <span class="stat-item"><i class="fa-solid fa-calendar-day"></i> Tạo: ${formattedDate}</span>
                    <span class="stat-item"><i class="fa-solid fa-users"></i> Lượt thi: <strong>${exam.attemptCount}</strong></span>
                </div>
            </div>

            <hr class="premium-divider">

            <div class="card-premium-footer">
                <div style="display: flex; gap: 8px;">
                    <button class="btn-modern-action btn-edit-properties" data-examid="${exam.examId}" data-examname="${exam.examName}" data-technique="${exam.technique}" data-time="${exam.timeLimit}" data-level="${exam.level}" data-description="${safeDescription}">
                        <i class="fa-solid fa-gear"></i> Sửa Thuộc Tính
                    </button>
                    <button class="btn-modern-action btn-edit-content" data-examid="${exam.examId}" style="color: #0284c7; border-color: #bae6fd;">
                        <i class="fa-solid fa-pen-to-square"></i> Sửa Nội Dung
                    </button>
                </div>
                
                <div class="footer-actions-right">
                    <button class="btn-modern-action btn-view-history" data-examid="${exam.examId}" style="color: #4f46e5; border-color: #c7d2fe; background: #e0e7ff;">
                        <i class="fa-solid fa-users"></i> Xem Lịch Sử
                    </button>

                    <button class="${feedbackBtnClass}" data-examid="${exam.examId}">
                        <i class="fa-solid fa-star"></i> Đánh Giá ${feedbackBadgeHtml}
                    </button>
                    ${exam.isVip 
                        ? `<button class="btn-modern-action toggle-vip off" data-examid="${exam.examId}" data-vip="true"><i class="fa-solid fa-unlock"></i> Hủy VIP</button>` 
                        : `<button class="btn-modern-action toggle-vip on" data-examid="${exam.examId}" data-vip="false"><i class="fa-solid fa-lock"></i> Kích VIP</button>`
                    }
                    <button class="btn-modern-action btn-delete-danger btn-delete" data-examid="${exam.examId}">
                        <i class="fa-solid fa-trash-can"></i> Xóa Đề
                    </button>
                </div>
            </div>
        `;
        container.appendChild(cardDiv);
    });
}

function initFilterChangeListeners() {
    document.querySelectorAll('.sidebar-menu .menu-item[data-tech]').forEach(item => {
        item.addEventListener('click', () => {
            const tech = item.getAttribute('data-tech');
            if (tech) { currentTechnique = tech; renderExamList(); }
        });
    });

    const levelPills = document.querySelectorAll('#filter-level-pills .pill-btn');
    levelPills.forEach(pill => {
        pill.addEventListener('click', () => {
            levelPills.forEach(btn => btn.classList.remove('active'));
            pill.classList.add('active');
            currentLevel = pill.getAttribute('data-level');
            renderExamList();
        });
    });

    const timePills = document.querySelectorAll('#filter-time-pills .pill-btn');
    timePills.forEach(pill => {
        pill.addEventListener('click', () => {
            timePills.forEach(btn => btn.classList.remove('active'));
            pill.classList.add('active');
            currentTime = pill.getAttribute('data-time');
            renderExamList();
        });
    });

    const searchInput = document.getElementById('examSearchInput');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            currentSearchQuery = e.target.value.trim().toLowerCase();
            renderExamList(); 
        });
    }

    const filterRow = document.querySelector('.filter-flex-row');
    let sortSelect = document.getElementById('examSortSelect');

    if (filterRow) {
        const searchWrapper = document.getElementById('examSearchInput')?.parentElement;
        if (searchWrapper && !document.getElementById('exam-sticky-wrapper')) {
            const stickyWrapper = document.createElement('div');
            stickyWrapper.id = 'exam-sticky-wrapper';
            stickyWrapper.style.cssText = 'position: sticky; top: 60px; z-index: 90; background: #f1f5f9; padding: 10px 0; margin-top: -10px; border-bottom: 1px solid #e2e8f0;';
            
            searchWrapper.parentNode.insertBefore(stickyWrapper, searchWrapper);
            stickyWrapper.appendChild(searchWrapper);
            stickyWrapper.appendChild(filterRow);
            
            filterRow.style.position = 'static';
            filterRow.style.marginTop = '15px';
        }
        
        if (!sortSelect) {
            const sortCol = document.createElement('div');
            sortCol.className = 'filter-col-50';
            sortCol.innerHTML = `
                <span class="filter-label-text">Sắp xếp theo:</span>
                <div style="display: flex; height: 100%; align-items: center;">
                    <select id="examSortSelect" style="padding: 8px 15px; border-radius: 20px; border: 1px solid #e2e8f0; font-size: 13.5px; font-weight: 600; color: #475569; background-color: #f1f5f9; outline: none; cursor: pointer; width: 100%; transition: 0.2s;">
                        <option value="newest">Mới nhất đến cũ nhất</option>
                        <option value="most_attempts">Số người thi nhiều nhất</option>
                        <option value="most_feedbacks">Đánh giá nhiều nhất</option>
                        <option value="highest_rating">Rating cao nhất</option>
                    </select>
                </div>
            `;
            filterRow.appendChild(sortCol);
            sortSelect = document.getElementById('examSortSelect');
        } else if (sortSelect.closest('.filter-col-50') && sortSelect.closest('.filter-col-50').parentNode !== filterRow) {
            const sortCol = sortSelect.closest('.filter-col-50');
            filterRow.appendChild(sortCol);
        }
    }

    if (sortSelect) {
        sortSelect.addEventListener('change', () => {
            renderExamList();
        });
    }
}

function openEditPropertiesModal(examId, examName, technique, time, level, description) {
    currentEditingExamId = examId;
    const modal = document.getElementById('edit-properties-modal');
    if (!modal) return;
    
    document.getElementById('edit-modal-exam-id').innerText = examId;
    document.getElementById('edit-exam-name').value = examName || ""; 
    document.getElementById('edit-select-technique').value = technique || "Hỗn hợp";
    document.getElementById('edit-select-time').value = time || "15";
    document.getElementById('edit-select-level').value = level || "Trung bình";
    
    const descInput = document.getElementById('edit-exam-description');
    if (descInput) descInput.value = description || "";
    
    modal.style.display = "block";
}

async function updateExamProperties() {
    if (!currentEditingExamId) return;
    const saveBtn = document.getElementById('btn-save-properties');
    const modal = document.getElementById('edit-properties-modal');
    
    saveBtn.disabled = true;
    saveBtn.innerHTML = "⏳ Đang lưu...";

    try {
        const docRef = doc(db, "exams", currentEditingExamId);
        const docSnap = await getDoc(docRef);
        
        const payload = {
            examName: document.getElementById('edit-exam-name').value.trim(), 
            technique: document.getElementById('edit-select-technique').value,
            timeLimit: parseInt(document.getElementById('edit-select-time').value, 10),
            level: document.getElementById('edit-select-level').value,
            isPublic: true 
        };

        const descInput = document.getElementById('edit-exam-description');
        if (descInput) {
            payload.description = descInput.value.trim();
        }

        if (!docSnap.exists() || !docSnap.data().createdAt) {
            payload.createdAt = Date.now();
        }

        await setDoc(docRef, payload, { merge: true });
        
        showToast(`Cập nhật thuộc tính đề "${currentEditingExamId}" thành công!`, "success");
        if (modal) modal.style.display = "none";
    } catch (error) {
        showToast("Không thể lưu thay đổi thuộc tính đề", "error");
    } finally {
        saveBtn.disabled = false;
        saveBtn.innerHTML = "💾 Lưu Thay Đổi";
    }
}

async function toggleExamVip(examId, currentVipState) {
    try {
        const docRef = doc(db, "exams", examId);
        const docSnap = await getDoc(docRef);
        
        const payload = { 
            isVip: !currentVipState,
            isPublic: true 
        };

        if (!docSnap.exists() || !docSnap.data().createdAt) {
            payload.createdAt = Date.now();
        }
        
        await setDoc(docRef, payload, { merge: true });
        showToast(`Cập nhật trạng thái VIP đề "${examId}" thành công!`, "success");
    } catch (error) { showToast("Lỗi thay đổi quyền VIP", "error"); }
}

async function deleteExam(examId, buttonElement) {
    if (!confirm(`⚠️ CẢNH BÁO NGUY HIỂM: Bạn có chắc chắn xóa TOÀN BỘ câu hỏi của đề "${examId}"?\nHành động này không thể hoàn tác!`)) return;
    const originalText = buttonElement.innerHTML;
    buttonElement.innerHTML = "⏳...";
    buttonElement.disabled = true;

    try {
        const querySnapshot = await getDocs(query(collection(db, "questions"), where("examId", "==", examId)));
        if (querySnapshot.empty) {
            alert("Không tìm thấy dữ liệu thuộc đề này.");
            buttonElement.innerHTML = originalText;
            buttonElement.disabled = false;
            return;
        }
        const deletePromises = querySnapshot.docs.map(docSnap => deleteDoc(doc(db, "questions", docSnap.id)));
        await Promise.all(deletePromises);
        showToast(`Đã xóa sạch thành công ${deletePromises.length} câu hỏi của đề "${examId}"!`, "success");
    } catch (error) {
        showToast("Lỗi hệ thống khi thực thi lệnh xóa", "error");
        buttonElement.innerHTML = originalText;
        buttonElement.disabled = false;
    }
}

async function viewFeedback(examId) {
    const modal = document.getElementById("feedback-modal");
    const tbody = document.getElementById("feedback-list-body");
    document.getElementById("modal-exam-id").innerText = examId;
    tbody.innerHTML = '<tr><td colspan="4" class="empty-message">⏳ Đang tải dữ liệu đánh giá...</td></tr>';
    modal.style.display = "block"; 

    try {
        const querySnapshot = await getDocs(query(collection(db, "feedbacks"), where("examId", "==", examId)));
        tbody.innerHTML = '';
        if (querySnapshot.empty) {
            tbody.innerHTML = '<tr><td colspan="4" class="empty-message">Chưa có lượt đánh giá nào cho đề thi này.</td></tr>';
            return;
        }
        querySnapshot.forEach((docSnap) => {
            const data = docSnap.data();
            let starsHtml = '';
            for (let i = 0; i < (data.rating || 0); i++) starsHtml += '<span class="rating-star">★</span>';
            
            let timeStr = 'N/A';
            const rawTime = data.timestamp || data.createdAt;
            if (rawTime) {
                if (typeof rawTime.toDate === 'function') {
                    timeStr = rawTime.toDate().toLocaleString('vi-VN');
                } else {
                    timeStr = new Date(rawTime).toLocaleString('vi-VN');
                }
            }

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><strong>${data.email || "Khách vô danh"}</strong></td>
                <td class="text-center">${starsHtml}</td>
                <td>${data.comment || data.feedback || "Không có góp ý văn bản."}</td>
                <td class="text-center" style="font-size: 13px; color: #64748b;">${timeStr}</td>
            `;
            tbody.appendChild(tr);
        });
    } catch (error) {
        tbody.innerHTML = '<tr><td colspan="4" class="empty-message" style="color: red;">❌ Lỗi tải feedback.</td></tr>';
    }
}

function renderPreview() {
    const previewBody = document.getElementById('preview-list-body');
    const publishBtn = document.getElementById('btn-publish');
    if (!previewBody) return;
    previewBody.innerHTML = '';

    if (draftData.length === 0) {
        previewBody.innerHTML = '<tr><td colspan="9" class="empty-message">Chưa có dữ liệu nào được nạp để xem trước.</td></tr>';
        if (publishBtn) publishBtn.disabled = true;
        return;
    }

    let stt = 1;
    draftData.forEach((row) => {
        const tr = document.createElement('tr');
        const mapCorrectText = ['A', 'B', 'C', 'D'];
        const correctChar = mapCorrectText[row.correctAnswer] || 'Không rõ';

        tr.innerHTML = `
            <td class="text-center">${stt++}</td>
            <td><span class="badge-count" style="background:#eff6ff; color:#2563eb;">${row.examId}</span></td>
            <td><div style="max-width:250px; font-weight:500; font-size:13.5px;">${row.text}</div></td>
            <td><div style="max-width:150px; font-size:13px; color:#475569;">${row.options[0]}</div></td>
            <td><div style="max-width:150px; font-size:13px; color:#475569;">${row.options[1]}</div></td>
            <td><div style="max-width:150px; font-size:13px; color:#475569;">${row.options[2]}</div></td>
            <td><div style="max-width:150px; font-size:13px; color:#475569;">${row.options[3]}</div></td>
            <td class="text-center"><strong style="color:#10b981; font-size:16px;">${correctChar}</strong></td>
            <td><div style="max-width:200px; font-size:12.5px; color:#64748b; font-style: italic;">${row.explanation}</div></td>
        `;
        previewBody.appendChild(tr);
    });

    if (publishBtn) {
        publishBtn.removeAttribute('disabled');
        publishBtn.innerHTML = `🔓 Xác Nhận & Publish ${draftData.length} Câu Lên Hệ Thống`;
    }
}

function handleExcelRead() {
    const fileInput = document.getElementById('excel-file');
    const importBtn = document.getElementById('btn-import');

    if (!fileInput || !importBtn) return;

    importBtn.addEventListener('click', () => {
        const file = fileInput.files[0];
        if (!file) return alert("❌ Vui lòng chọn một file Excel (.xlsx hoặc .xls) trước khi đọc dữ liệu!");

        importBtn.disabled = true;
        importBtn.innerHTML = "⏳ Đang phân tích cú pháp Excel...";

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, { type: 'array' });
                const jsonArr = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);

                if (jsonArr.length === 0) throw new Error("File Excel rỗng!");

                draftData = [];
                let skipCount = 0;

                jsonArr.forEach((row) => {
                    if (!row["Câu hỏi"] || !row["Đáp án đúng"]) {
                        skipCount++;
                        return;
                    }

                    const correctChar = String(row["Đáp án đúng"]).toUpperCase().trim();
                    let correctIndex = 0; 
                    
                    if (correctChar === 'B') correctIndex = 1;
                    else if (correctChar === 'C') correctIndex = 2;
                    else if (correctChar === 'D') correctIndex = 3;
                    else if (correctChar !== 'A') console.warn(`Đáp án "${correctChar}" không hợp lệ, hệ thống tự động fallback về A.`);

                    draftData.push({
                        examId: String(row["Mã đề"] || "DEFAULT_EXAM").trim(),
                        text: String(row["Câu hỏi"]).trim(),
                        options: [
                            String(row["Đáp án A"] || "").trim(),
                            String(row["Đáp án B"] || "").trim(),
                            String(row["Đáp án C"] || "").trim(),
                            String(row["Đáp án D"] || "").trim()
                        ],
                        correctAnswer: correctIndex,
                        explanation: row["Giải thích đáp án"] ? String(row["Giải thích đáp án"]).trim() : ""
                    });
                });

                let msg = `Đọc file thành công! Nạp được ${draftData.length} câu hỏi.`;
                if (skipCount > 0) msg += ` (Bỏ qua ${skipCount} dòng lỗi do để trống câu hỏi hoặc đáp án).`;
                showToast(msg, "success");
                
                const fileNameDisplay = document.getElementById('file-name-display');
                if (fileNameDisplay) {
                    fileNameDisplay.innerText = `Đã chọn: ${file.name}`;
                    fileNameDisplay.style.display = 'inline-block';
                }
                
                renderPreview();

            } catch (error) {
                alert("❌ Không thể đọc file Excel. Chi tiết: " + error.message);
            } finally {
                importBtn.disabled = false;
                importBtn.innerHTML = "👁️ Đọc Dữ Liệu & Xem Trước";
            }
        };
        reader.readAsArrayBuffer(file);
    });
}

async function publishExam() {
    const publishBtn = document.getElementById('btn-publish');
    const techniqueValue = document.getElementById('select-technique').value;
    const timeLimitValue = parseInt(document.getElementById('select-time').value, 10);
    const levelValue = document.getElementById('select-level').value;

    const descInput = document.getElementById('input-description');
    const descValue = descInput ? descInput.value.trim() : "";

    if (!publishBtn || draftData.length === 0) return;
    if (!confirm(`Bạn có chắc chắn muốn xuất bản ${draftData.length} câu hỏi kèm cấu hình thuộc tính đã chọn không?`)) return;

    publishBtn.disabled = true;
    publishBtn.innerHTML = "⏳ Đang xuất bản dữ liệu...";

    try {
        let uniqueExamIds = new Set();
        for (let i = 0; i < draftData.length; i++) {
            const questionItem = draftData[i];
            uniqueExamIds.add(questionItem.examId);
            await addDoc(collection(db, "questions"), questionItem);
        }

        for (const examId of uniqueExamIds) {
            await setDoc(doc(db, "exams", examId), {
                examName: "", 
                technique: techniqueValue,
                timeLimit: timeLimitValue,
                level: levelValue,
                description: descValue, 
                isVip: false,
                isPublic: true,
                createdAt: Date.now()
            }, { merge: true });
        }

        alert(`🎉 XUẤT BẢN THÀNH CÔNG!\n- Đã nạp chính thức: ${draftData.length} câu hỏi vào Database.`);
        
        draftData = [];
        const fileInput = document.getElementById('excel-file');
        if (fileInput) fileInput.value = "";
        const fileNameDisplay = document.getElementById('file-name-display');
        if (fileNameDisplay) fileNameDisplay.style.display = "none";
        
        if (descInput) descInput.value = "";
        
        renderPreview();
    } catch (error) {
        alert("❌ Quá trình xuất bản thất bại. Chi tiết: " + error.message);
        publishBtn.disabled = false;
        publishBtn.innerHTML = "🔒 Xác Nhận & Publish Lên Hệ Thống";
    }
}

document.addEventListener('componentsLoaded', () => {
    // KHỞI ĐỘNG CHUỖI LẮNG NGHE REAL-TIME
    loadExamList();
    
    handleExcelRead();
    initFilterChangeListeners(); 

    const downloadBtn = document.getElementById('btn-download-template');
    if (downloadBtn) {
        downloadBtn.addEventListener('click', () => {
            const templateData = [{ 
                "Mã đề": "DE_MRI_01", 
                "Câu hỏi": "Chuỗi xung T2W trên MRI làm nước có màu gì?", 
                "Đáp án A": "Màu đen", "Đáp án B": "Màu Trắng sáng", "Đáp án C": "Màu xám", "Đáp án D": "Màu đỏ", 
                "Đáp án đúng": "B", 
                "Giải thích đáp án": "Trên chuỗi xung dịch nước (như dịch não tủy) có tín hiệu cao (trắng sáng)." 
            }];
            const ws = XLSX.utils.json_to_sheet(templateData);
            ws['!cols'] = [{wch: 15}, {wch: 45}, {wch: 15}, {wch: 15}, {wch: 15}, {wch: 15}, {wch: 15}, {wch: 40}];
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "DanhSachCauHoi");
            XLSX.writeFile(wb, "Template_Import_Cau_Hoi.xlsx");
        });
    }

    const savePropsBtn = document.getElementById('btn-save-properties');
    if (savePropsBtn) savePropsBtn.addEventListener('click', updateExamProperties);

    const publishBtn = document.getElementById('btn-publish');
    if (publishBtn) publishBtn.addEventListener('click', publishExam);

    const examContainer = document.getElementById('exam-list-body');
    if (examContainer) {
        examContainer.addEventListener('click', (e) => {
            const editPropsBtn = e.target.closest('.btn-edit-properties');
            if (editPropsBtn) {
                const dataset = editPropsBtn.dataset;
                const description = decodeURIComponent(dataset.description || ""); 
                return openEditPropertiesModal(dataset.examid, dataset.examname, dataset.technique, dataset.time, dataset.level, description);
            }
            
            const editContentBtn = e.target.closest('.btn-edit-content');
            if (editContentBtn) {
                const examId = editContentBtn.dataset.examid;
                window.open(`admin-edit-exam.html?examId=${examId}`, '_blank');
                return;
            }
            
            // XỬ LÝ SỰ KIỆN CLICK NÚT XEM LỊCH SỬ THI
            const historyBtn = e.target.closest('.btn-view-history');
            if (historyBtn) {
                return viewExamHistory(historyBtn.dataset.examid);
            }

            const vipBtn = e.target.closest('.toggle-vip');
            if (vipBtn) return toggleExamVip(vipBtn.dataset.examid, vipBtn.dataset.vip === "true");
            const feedbackBtn = e.target.closest('.btn-view-feedback');
            if (feedbackBtn) return viewFeedback(feedbackBtn.dataset.examid);
            const deleteBtn = e.target.closest('.btn-delete');
            if (deleteBtn) return deleteExam(deleteBtn.dataset.examid, deleteBtn);
        });
    }

    document.getElementById("closeEditPropertiesModal").onclick = () => {
        document.getElementById("edit-properties-modal").style.display = "none";
    };
    document.getElementById("closeFeedbackModal").onclick = () => {
        document.getElementById("feedback-modal").style.display = "none";
    };
});
