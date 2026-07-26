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

// ==========================================
// 1. TẢI DỮ LIỆU TỪ FIRESTORE
// ==========================================
export async function loadExamList() {
    const container = document.getElementById('exam-list-body');
    if (!container) return;
    
    // Nếu chưa có dữ liệu thì hiện loading
    if (cachedExams.length === 0) {
        container.innerHTML = '<div class="loading-text">⏳ Đang kết nối dữ liệu từ Firestore...</div>';
    }

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

// ==========================================
// 2. HIỂN THỊ DANH SÁCH & LỌC UI
// ==========================================
export function renderExamList() {
    const container = document.getElementById('exam-list-body');
    if (!container) return;

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
                    <button class="btn-modern-action toggle-vip" data-examid="${exam.examId}" data-vip="${exam.isVip}"><i class="fa-solid ${exam.isVip ? 'fa-unlock' : 'fa-lock'}"></i> ${exam.isVip ? 'Hủy VIP' : 'Kích VIP'}</button>
                    <button class="btn-modern-action btn-delete-danger btn-delete" data-examid="${exam.examId}"><i class="fa-solid fa-trash-can"></i> Xóa Đề</button>
                </div>
            </div>
        `;
        container.appendChild(cardDiv);
    });
}

// ==========================================
// 3. KHỞI TẠO BỘ LỌC (SIDEBAR & HEADER)
// ==========================================
function initFilterChangeListeners() {
    document.querySelectorAll('.sidebar-menu .menu-item[data-tech]').forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const tech = item.getAttribute('data-tech');
            if (tech) { 
                currentTechnique = tech; 
                renderExamList(); 
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

// ==========================================
// 4. LẮNG NGHE SỰ KIỆN NÚT BẤM (ỦY QUYỀN EVENT)
// ==========================================
function initActionListeners() {
    const container = document.getElementById('exam-list-body');
    if (!container) return;

    // Gắn sự kiện vào thẻ cha để dù tải lại bằng Real-time thì nút vẫn bấm được
    container.addEventListener('click', async (e) => {
        
        // --- NÚT SỬA NỘI DUNG (MỞ EDITOR) ---
        const btnEditContent = e.target.closest('.btn-edit-content');
        if (btnEditContent) {
            const examId = btnEditContent.getAttribute('data-examid');
            window.location.href = `admin-edit-exam.html?examId=${examId}`;
            return;
        }

        // --- NÚT KÍCH VIP ---
        const btnVip = e.target.closest('.toggle-vip');
        if (btnVip) {
            const examId = btnVip.getAttribute('data-examid');
            const isVip = btnVip.getAttribute('data-vip') === 'true';
            
            btnVip.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
            try {
                await updateDoc(doc(db, "exams", examId), { isVip: !isVip });
                showToast(`Đã ${!isVip ? 'Kích' : 'Hủy'} quyền VIP thành công!`, "success");
                // Không cần gọi loadExamList vì onSnapshot sẽ tự động load lại UI
            } catch (error) {
                console.error("Lỗi cập nhật VIP:", error);
                showToast("Có lỗi xảy ra khi cập nhật quyền.", "error");
            }
            return;
        }

        // --- NÚT XÓA ĐỀ THI ---
        const btnDelete = e.target.closest('.btn-delete');
        if (btnDelete) {
            const examId = btnDelete.getAttribute('data-examid');
            if (!confirm(`CẢNH BÁO: Bạn có chắc chắn muốn xóa vĩnh viễn đề thi "${examId}" cùng toàn bộ câu hỏi bên trong không?`)) return;

            btnDelete.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Xóa...';
            try {
                const qSnap = await getDocs(query(collection(db, "questions"), where("examId", "==", examId)));
                const deletePromises = qSnap.docs.map(docSnap => deleteDoc(doc(db, "questions", docSnap.id)));
                deletePromises.push(deleteDoc(doc(db, "exams", examId)));
                
                await Promise.all(deletePromises);
                showToast(`Đã xóa vĩnh viễn đề ${examId}`, "success");
            } catch (error) {
                console.error("Lỗi xóa đề:", error);
                showToast("Lỗi hệ thống khi xóa dữ liệu", "error");
            }
            return;
        }

        // --- NÚT SỬA THUỘC TÍNH (MỞ MODAL) ---
        const btnEditProps = e.target.closest('.btn-edit-properties');
        if (btnEditProps) {
            const examId = btnEditProps.getAttribute('data-examid');
            const examName = btnEditProps.getAttribute('data-examname');
            const tech = btnEditProps.getAttribute('data-technique');
            const time = btnEditProps.getAttribute('data-time');
            const level = btnEditProps.getAttribute('data-level');
            
            openEditPropertiesModal(examId, examName, tech, time, level);
            return;
        }
    });
}

// ==========================================
// 5. MODAL CẬP NHẬT THUỘC TÍNH
// ==========================================
function openEditPropertiesModal(examId, currentName, currentTech, currentTime, currentLevel) {
    const oldModal = document.getElementById('edit-props-modal');
    if (oldModal) oldModal.remove();

    const modalHtml = `
        <div id="edit-props-modal" style="display: flex; position: fixed; z-index: 2000; left: 0; top: 0; width: 100%; height: 100%; background-color: rgba(15, 23, 42, 0.6); backdrop-filter: blur(2px); justify-content: center; align-items: center;">
            <div style="background-color: #fff; padding: 25px; border-radius: 12px; width: 90%; max-width: 450px; box-shadow: 0 10px 25px rgba(0,0,0,0.2);">
                <div style="display:flex; justify-content: space-between; align-items:center; margin-bottom: 20px; border-bottom: 1px solid #e2e8f0; padding-bottom: 10px;">
                    <h3 style="margin:0; color: #1e293b; font-size: 1.1rem;"><i class="fa-solid fa-gear" style="color: #3b82f6;"></i> Sửa Thuộc Tính Đề Thi</h3>
                </div>
                
                <p style="font-size: 14px; color: #475569; margin-bottom: 20px;">Mã đề: <strong style="color:#2563eb;">${examId}</strong></p>

                <label style="display:block; font-weight:600; margin-bottom:8px; font-size:14px; color:#334155;">Tên đề hiển thị (Tùy chọn):</label>
                <input type="text" id="edit-exam-name" value="${currentName || ''}" placeholder="Vd: Bộ Đề Siêu Cấp CT 2026" style="width:100%; padding:10px; margin-bottom:15px; border-radius:8px; border:1px solid #cbd5e1; outline:none; font-family:inherit;">

                <label style="display:block; font-weight:600; margin-bottom:8px; font-size:14px; color:#334155;">Chuyên khoa:</label>
                <select id="edit-exam-tech" style="width:100%; padding:10px; margin-bottom:15px; border-radius:8px; border:1px solid #cbd5e1; outline:none; font-family:inherit;">
                    <option value="MRI" ${currentTech === 'MRI' ? 'selected' : ''}>MRI</option>
                    <option value="CT" ${currentTech === 'CT' ? 'selected' : ''}>CT</option>
                    <option value="X quang" ${currentTech === 'X quang' ? 'selected' : ''}>X quang</option>
                    <option value="Hỗn hợp" ${currentTech === 'Hỗn hợp' ? 'selected' : ''}>Hỗn hợp</option>
                </select>

                <label style="display:block; font-weight:600; margin-bottom:8px; font-size:14px; color:#334155;">Mức độ khó:</label>
                <select id="edit-exam-level" style="width:100%; padding:10px; margin-bottom:15px; border-radius:8px; border:1px solid #cbd5e1; outline:none; font-family:inherit;">
                    <option value="Dễ" ${currentLevel === 'Dễ' ? 'selected' : ''}>Dễ</option>
                    <option value="Trung bình" ${currentLevel === 'Trung bình' ? 'selected' : ''}>Trung bình</option>
                    <option value="Khó" ${currentLevel === 'Khó' ? 'selected' : ''}>Khó</option>
                </select>

                <label style="display:block; font-weight:600; margin-bottom:8px; font-size:14px; color:#334155;">Thời gian (phút):</label>
                <select id="edit-exam-time" style="width:100%; padding:10px; margin-bottom:25px; border-radius:8px; border:1px solid #cbd5e1; outline:none; font-family:inherit;">
                    <option value="15" ${currentTime == 15 ? 'selected' : ''}>15 phút</option>
                    <option value="30" ${currentTime == 30 ? 'selected' : ''}>30 phút</option>
                    <option value="45" ${currentTime == 45 ? 'selected' : ''}>45 phút</option>
                </select>

                <div style="display:flex; justify-content:flex-end; gap:12px;">
                    <button id="btn-cancel-edit" style="padding:10px 20px; border:none; border-radius:8px; background:#e2e8f0; color:#475569; cursor:pointer; font-weight:bold; transition:0.2s;">Hủy Bỏ</button>
                    <button id="btn-confirm-edit" style="padding:10px 20px; border:none; border-radius:8px; background:#10b981; color:white; cursor:pointer; font-weight:bold; transition:0.2s; box-shadow:0 4px 6px rgba(16, 185, 129, 0.3);">Lưu Thay Đổi</button>
                </div>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHtml);

    document.getElementById('btn-cancel-edit').onclick = () => document.getElementById('edit-props-modal').remove();

    document.getElementById('btn-confirm-edit').onclick = async () => {
        const btn = document.getElementById('btn-confirm-edit');
        btn.disabled = true;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Đang lưu...';

        const newName = document.getElementById('edit-exam-name').value.trim();
        const newTech = document.getElementById('edit-exam-tech').value;
        const newLevel = document.getElementById('edit-exam-level').value;
        const newTime = parseInt(document.getElementById('edit-exam-time').value, 10);

        try {
            await updateDoc(doc(db, "exams", examId), {
                examName: newName,
                technique: newTech,
                level: newLevel,
                timeLimit: newTime
            });
            showToast("Đã cập nhật thuộc tính đề thi thành công!", "success");
            document.getElementById('edit-props-modal').remove();
        } catch (error) {
            console.error("Lỗi cập nhật:", error);
            showToast("Có lỗi xảy ra khi lưu thay đổi.", "error");
            btn.disabled = false;
            btn.innerHTML = 'Lưu Thay Đổi';
        }
    };
}

// ==========================================
// 6. KHỞI CHẠY (ENTRY POINT)
// ==========================================
document.addEventListener('componentsLoaded', () => {
    initFilterChangeListeners();
    initActionListeners();

    // Lắng nghe thay đổi Real-time (Bao gồm cả việc gọi lần đầu tiên lúc load trang)
    onSnapshot(collection(db, "exams"), () => {
        loadExamList();
    });
});
