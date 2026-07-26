import { db, showToast } from './admin-core.js';
import { 
    collection, getDocs, doc, setDoc, updateDoc, deleteDoc, addDoc, query, where, getDoc, onSnapshot 
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// Các biến trạng thái bộ lọc toàn cục
let currentTechnique = "MRI"; // Mặc định ban đầu
let currentLevel = "all";
let currentTime = "all";
let currentSearchQuery = "";

let cachedExams = [];
let draftData = [];
let currentEditingExamId = "";

export async function loadExamList() {
    const container = document.getElementById('exam-list-body');
    if (!container) return;
    
    container.innerHTML = '<div class="loading-text">⏳ Đang kết nối dữ liệu từ Firestore...</div>';

    try {
        const [questionsSnapshot, examsSnapshot, feedbacksSnapshot] = await Promise.all([
            getDocs(collection(db, "questions")),
            getDocs(collection(db, "exams")),
            getDocs(collection(db, "feedbacks"))
        ]);
        
        const examDataMap = {};
        examsSnapshot.forEach(docSnap => {
            const data = docSnap.data();
            examDataMap[docSnap.id] = {
                isVip: data.isVip || false,
                timeLimit: data.timeLimit !== undefined ? data.timeLimit : 15,
                attemptCount: data.attemptCount || 0,
                technique: data.technique || "Hỗn hợp",
                level: data.level || "Trung bình",
                createdAt: data.createdAt,
                examName: data.examName || ""
            };
        });

        const feedbackCounts = {};
        const feedbackStars = {};
        if (feedbacksSnapshot) {
            feedbacksSnapshot.forEach(docSnap => {
                const fb = docSnap.data();
                if (fb.examId) {
                    feedbackCounts[fb.examId] = (feedbackCounts[fb.examId] || 0) + 1;
                    feedbackStars[fb.examId] = (feedbackStars[fb.examId] || 0) + (fb.rating || 5);
                }
            });
        }

        const examGroups = {}; 
        questionsSnapshot.forEach((docSnap) => {
            const data = docSnap.data();
            const examId = data.examId || "Chưa phân loại"; 
            if (!examGroups[examId]) examGroups[examId] = 0;
            examGroups[examId]++; 
        });

        cachedExams = [];
        for (const examId in examGroups) {
            const count = examGroups[examId];
            const config = examDataMap[examId] || { isVip: false, timeLimit: 15, attemptCount: 0, technique: "Hỗn hợp", level: "Trung bình", createdAt: null, examName: "" };

            const fCount = feedbackCounts[examId] || 0;
            const fStars = feedbackStars[examId] || 0;
            const avgRating = fCount > 0 ? (fStars / fCount) : 0;

            cachedExams.push({
                examId: examId, 
                examName: config.examName,
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
    } catch (error) {
        console.error("Lỗi:", error);
        container.innerHTML = `<div class="empty-message" style="color: red;">❌ Không thể kết nối Firestore.</div>`;
    }
}

export function renderExamList() {
    const container = document.getElementById('exam-list-body');
    if (!container) return;

    // Cập nhật tiêu đề trang động theo chuyên ngành
    const pageTitle = document.getElementById('page-title');
    if (pageTitle) pageTitle.innerText = `DANH SÁCH ĐỀ THI: CHUYÊN KHOA ${currentTechnique.toUpperCase()}`;

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

    container.innerHTML = '';

    if (filteredExams.length === 0) {
        container.innerHTML = `<div class="empty-message" style="width: 100%; background: #ffffff; padding: 40px; border-radius: 12px; border: 1px dashed #cbd5e1;">🔍 Không tìm thấy đề thi ${currentTechnique} nào.</div>`;
        return;
    }

    filteredExams.forEach(exam => {
        let levelClass = 'level-medium';
        if (exam.level === 'Dễ') levelClass = 'level-easy';
        else if (exam.level === 'Khó') levelClass = 'level-hard';

        let formattedDate = 'Không rõ';
        if (exam.createdAt) {
            const numDate = Number(exam.createdAt);
            formattedDate = new Date(numDate > 1000000000000 ? numDate : numDate * 1000).toLocaleDateString('vi-VN');
        }

        const displayTitle = exam.examName ? exam.examName : `Đề: ${exam.examId}`;
        const cardDiv = document.createElement('div');
        cardDiv.className = 'exam-premium-card';
        
        cardDiv.innerHTML = `
            <div class="card-premium-header">
                <div class="header-left">
                    <h3 class="exam-premium-title">${displayTitle}</h3>
                    <span class="exam-subtitle-id">Mã: ${exam.examId}</span>
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
                    <button class="btn-modern-action btn-edit-properties" data-examid="${exam.examId}" data-examname="${exam.examName}" data-technique="${exam.technique}" data-time="${exam.timeLimit}" data-level="${exam.level}"><i class="fa-solid fa-gear"></i> Sửa Thuộc Tính</button>
                    <button class="btn-modern-action btn-edit-content" data-examid="${exam.examId}" style="color: #0284c7; border-color: #bae6fd;"><i class="fa-solid fa-pen-to-square"></i> Sửa Nội Dung</button>
                </div>
                <div class="footer-actions-right">
                    <button class="btn-modern-action btn-view-feedback" data-examid="${exam.examId}"><i class="fa-solid fa-star"></i> Đánh Giá</button>
                    <button class="btn-modern-action toggle-vip" data-examid="${exam.examId}" data-vip="${exam.isVip}"><i class="fa-solid ${exam.isVip ? 'fa-unlock' : 'fa-lock'}"></i> ${exam.isVip ? 'Hủy VIP' : 'Kích VIP'}</button>
                    <button class="btn-modern-action btn-delete-danger btn-delete" data-examid="${exam.examId}"><i class="fa-solid fa-trash-can"></i> Xóa Đề</button>
                </div>
            </div>
        `;
        container.appendChild(cardDiv);
    });
}

function initFilterChangeListeners() {
    // LẮNG NGHE MENU SIDEBAR ĐỂ ĐỔI CHUYÊN NGÀNH
    document.querySelectorAll('.sidebar-menu .menu-item[data-tech]').forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const tech = item.getAttribute('data-tech');
            if (tech) { 
                currentTechnique = tech; 
                renderExamList(); 
                // Thêm class active vào menu đang chọn
                document.querySelectorAll('.sidebar-menu .menu-item').forEach(m => m.classList.remove('active'));
                item.classList.add('active');
            }
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

    const sortSelect = document.getElementById('examSortSelect');
    if (sortSelect) sortSelect.addEventListener('change', renderExamList);
}

document.addEventListener('componentsLoaded', () => {
    // Tự động tải lại danh sách mỗi khi có đề AI chuyển sang hoặc có thay đổi trên Database
    onSnapshot(collection(db, "exams"), () => {
        loadExamList();
    });
    
    initFilterChangeListeners();
});
