import { db, showToast } from './admin-core.js';
import { 
    collection, getDocs, doc, setDoc, updateDoc, deleteDoc, addDoc, query, where, getDoc 
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// Các biến trạng thái bộ lọc toàn cục
let currentTechnique = "MRI";
let currentLevel = "all";
let currentTime = "all";
let currentSearchQuery = "";

let cachedExams = [];
let draftData = [];
let currentEditingExamId = "";

export async function loadExamList() {
    const container = document.getElementById('exam-list-body');
    if (!container) return;
    
    container.innerHTML = '<div class="loading-text">⏳ Đang kết nối dữ liệu và đồng bộ từ Firestore...</div>';

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
        console.error("Lỗi khi tải danh sách đề thi:", error);
        container.innerHTML = `<div class="empty-message" style="color: red;">❌ Không thể kết nối Cloud Firestore để đồng bộ dữ liệu.</div>`;
    }
}

export function renderExamList() {
    const container = document.getElementById('exam-list-body');
    if (!container) return;

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
        container.innerHTML = `<div class="empty-message" style="width: 100%; background: #ffffff; padding: 40px; border-radius: 12px; border: 1px dashed #cbd5e1;">🔍 Không tìm thấy mã đề thi nào thỏa mãn điều kiện lọc hiện tại.</div>`;
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
                    <button class="btn-modern-action btn-edit-properties" data-examid="${exam.examId}" data-examname="${exam.examName}" data-technique="${exam.technique}" data-time="${exam.timeLimit}" data-level="${exam.level}">
                        <i class="fa-solid fa-gear"></i> Sửa Thuộc Tính
                    </button>
                    <button class="btn-modern-action btn-edit-content" data-examid="${exam.examId}" style="color: #0284c7; border-color: #bae6fd;">
                        <i class="fa-solid fa-pen-to-square"></i> Sửa Nội Dung
                    </button>
                </div>
                
                <div class="footer-actions-right">
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

function openEditPropertiesModal(examId, examName, technique, time, level) {
    currentEditingExamId = examId;
    const modal = document.getElementById('edit-properties-modal');
    if (!modal) return;
    
    document.getElementById('edit-modal-exam-id').innerText = examId;
    document.getElementById('edit-exam-name').value = examName || ""; 
    document.getElementById('edit-select-technique').value = technique || "Hỗn hợp";
    document.getElementById('edit-select-time').value = time || "15";
    document.getElementById('edit-select-level').value = level || "Trung bình";
    
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

        if (!docSnap.exists() || !docSnap.data().createdAt) {
            payload.createdAt = Date.now();
        }

        await setDoc(docRef, payload, { merge: true });
        
        showToast(`Cập nhật thuộc tính đề "${currentEditingExamId}" thành công!`, "success");
        if (modal) modal.style.display = "none";
        loadExamList(); 
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
        loadExamList();
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
        loadExamList();
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
        
        renderPreview();
        loadExamList();

    } catch (error) {
        alert("❌ Quá trình xuất bản thất bại. Chi tiết: " + error.message);
        publishBtn.disabled = false;
        publishBtn.innerHTML = "🔒 Xác Nhận & Publish Lên Hệ Thống";
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
                return openEditPropertiesModal(dataset.examid, dataset.examname, dataset.technique, dataset.time, dataset.level);
            }
            
            // Lắng nghe sự kiện click mở tab Trình Sửa Nội Dung Đề
            const editContentBtn = e.target.closest('.btn-edit-content');
            if (editContentBtn) {
                const examId = editContentBtn.dataset.examid;
                window.open(`admin-edit-exam.html?examId=${examId}`, '_blank');
                return;
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
