import { db } from '../admin-core.js';
import { collection, onSnapshot } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { appState } from './state.js';
import { renderExamList, openEditPropertiesModal } from './ui.js';
import { updateExamProperties, toggleExamVip, deleteExam, viewFeedback, viewExamHistory, handleExcelRead, publishExam, toggleAntiCheat, bulkToggleAntiCheat } from './api.js';

export function loadExamList() {
    if (appState.listenersInitialized) return;
    appState.listenersInitialized = true;
    
    const container = document.getElementById('exam-list-body');
    if (container) container.innerHTML = '<div class="loading-text">⏳ Đang thiết lập kết nối thời gian thực (Real-time) để tối ưu Quota...</div>';

    onSnapshot(collection(db, "exams"), (snapshot) => {
        appState.rawExams = snapshot.docs;
        appState.loadedStatus.exams = true;
        processAndRender();
    }, (error) => handleLoadError(error));

    onSnapshot(collection(db, "questions"), (snapshot) => {
        appState.rawQuestions = snapshot.docs;
        appState.loadedStatus.questions = true;
        processAndRender();
    }, (error) => handleLoadError(error));

    onSnapshot(collection(db, "feedbacks"), (snapshot) => {
        appState.rawFeedbacks = snapshot.docs;
        appState.loadedStatus.feedbacks = true;
        processAndRender();
    }, (error) => handleLoadError(error));
}

function handleLoadError(error) {
    console.error("Lỗi khi tải danh sách đề thi:", error);
    const container = document.getElementById('exam-list-body');
    if (container) container.innerHTML = `<div class="empty-message" style="color: red;">❌ Không thể kết nối Cloud Firestore để đồng bộ dữ liệu.</div>`;
}

function processAndRender() {
    if (!appState.loadedStatus.exams || !appState.loadedStatus.questions || !appState.loadedStatus.feedbacks) return;

    const examDataMap = {};
    appState.rawExams.forEach(docSnap => {
        const data = docSnap.data();
        examDataMap[docSnap.id] = {
            isVip: data.isVip || false,
            antiCheatEnabled: data.antiCheatEnabled || false,
            timeLimit: data.timeLimit !== undefined ? data.timeLimit : 15,
            attemptCount: data.attemptCount || 0,
            technique: data.technique || "Hỗn hợp",
            level: data.level || "Trung bình",
            createdAt: data.createdAt,
            examName: data.examName || "",
            description: data.description || "",
            authorEmail: data.authorEmail || "Không rõ", 
            sourceTech: data.sourceTech || "Không rõ" 
        };
    });

    const feedbackCounts = {};
    const feedbackStars = {};
    appState.rawFeedbacks.forEach(docSnap => {
        const fb = docSnap.data();
        if (fb.examId) {
            feedbackCounts[fb.examId] = (feedbackCounts[fb.examId] || 0) + 1;
            feedbackStars[fb.examId] = (feedbackStars[fb.examId] || 0) + (fb.rating || 5);
        }
    });

    const examGroups = {}; 
    appState.rawQuestions.forEach((docSnap) => {
        const data = docSnap.data();
        const examId = data.examId || "Chưa phân loại"; 
        if (!examGroups[examId]) examGroups[examId] = 0;
        examGroups[examId]++; 
    });

    appState.cachedExams = [];
    for (const examId in examGroups) {
        const count = examGroups[examId];
        const config = examDataMap[examId] || { isVip: false, antiCheatEnabled: false, timeLimit: 15, attemptCount: 0, technique: "Hỗn hợp", level: "Trung bình", createdAt: null, examName: "", description: "", authorEmail: "Không rõ", sourceTech: "Không rõ" };

        const fCount = feedbackCounts[examId] || 0;
        const fStars = feedbackStars[examId] || 0;
        const avgRating = fCount > 0 ? (fStars / fCount) : 0; 

        appState.cachedExams.push({
            examId: examId, 
            examName: config.examName,
            description: config.description, 
            count: count, 
            isVip: config.isVip,
            antiCheatEnabled: config.antiCheatEnabled,
            timeLimit: config.timeLimit, 
            attemptCount: config.attemptCount,
            technique: config.technique, 
            level: config.level,
            createdAt: config.createdAt || 0,
            feedbackCount: fCount,
            rating: avgRating,
            authorEmail: config.authorEmail,
            sourceTech: config.sourceTech
        });
    }

    renderExamList();
}

function initFilterChangeListeners() {
    document.querySelectorAll('.sidebar-menu .menu-item[data-tech]').forEach(item => {
        item.addEventListener('click', () => {
            const tech = item.getAttribute('data-tech');
            if (tech) { appState.currentTechnique = tech; renderExamList(); }
        });
    });

    const levelPills = document.querySelectorAll('#filter-level-pills .pill-btn');
    levelPills.forEach(pill => {
        pill.addEventListener('click', () => {
            levelPills.forEach(btn => btn.classList.remove('active'));
            pill.classList.add('active');
            appState.currentLevel = pill.getAttribute('data-level');
            renderExamList();
        });
    });

    const timePills = document.querySelectorAll('#filter-time-pills .pill-btn');
    timePills.forEach(pill => {
        pill.addEventListener('click', () => {
            timePills.forEach(btn => btn.classList.remove('active'));
            pill.classList.add('active');
            appState.currentTime = pill.getAttribute('data-time');
            renderExamList();
        });
    });

    const searchInput = document.getElementById('examSearchInput');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            appState.currentSearchQuery = e.target.value.trim().toLowerCase();
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

document.addEventListener('componentsLoaded', () => {
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
            
            const historyBtn = e.target.closest('.btn-view-history');
            if (historyBtn) {
                return viewExamHistory(historyBtn.dataset.examid);
            }

            const vipBtn = e.target.closest('.toggle-vip');
            if (vipBtn) return toggleExamVip(vipBtn.dataset.examid, vipBtn.dataset.vip === "true");
            
            const antiCheatBtn = e.target.closest('.toggle-anticheat');
            if (antiCheatBtn) return toggleAntiCheat(antiCheatBtn.dataset.examid, antiCheatBtn.dataset.state === "true");
            
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
