import { db, showToast } from './admin-core.js';
import { 
    collection, getDocs, doc, setDoc, updateDoc, deleteDoc, addDoc, query, where 
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
        const [questionsSnapshot, examsSnapshot] = await Promise.all([
            getDocs(collection(db, "questions")),
            getDocs(collection(db, "exams"))
        ]);
        
        const examDataMap = {};
        examsSnapshot.forEach(docSnap => {
            const data = docSnap.data();
            examDataMap[docSnap.id] = {
                isVip: data.isVip || false,
                timeLimit: data.timeLimit !== undefined ? data.timeLimit : 15,
                attemptCount: data.attemptCount || 0,
                technique: data.technique || "Hỗn hợp",
                level: data.level || "Trung bình"
            };
        });

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
            const config = examDataMap[examId] || { isVip: false, timeLimit: 15, attemptCount: 0, technique: "Hỗn hợp", level: "Trung bình" };

            cachedExams.push({
                examId: examId, count: count, isVip: config.isVip,
                timeLimit: config.timeLimit, attemptCount: config.attemptCount,
                technique: config.technique, level: config.level
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
        const matchSearch = !currentSearchQuery || exam.examId.toLowerCase().includes(currentSearchQuery);
        return matchTech && matchLevel && matchTime && matchSearch;
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

        const cardDiv = document.createElement('div');
        cardDiv.className = 'exam-modern-card';
        
        cardDiv.innerHTML = `
            <div class="card-top-half">
                <div class="card-info-left">
                    <span class="card-exam-title">📄 Đề: ${exam.examId}</span>
                    <span class="badge-meta">${exam.technique}</span>
                    <span class="badge-meta ${levelClass}">${exam.level}</span>
                    <span class="badge-count">⏱️ ${exam.timeLimit} phút</span>
                </div>
                <div class="card-status-right">
                    <span class="badge-count" style="background-color: #f1f5f9; color: #475569;">📊 ${exam.count} Câu hỏi</span>
                    ${exam.isVip ? '<span class="badge-vip-exam">VIP 👑</span>' : '<span class="badge-free">Miễn Phí</span>'}
                    <span class="config-text" style="margin-left: 10px; font-size: 13px;">🔄 Lượt thi: <strong>${exam.attemptCount}</strong></span>
                </div>
            </div>
            <hr class="card-divider">
            <div class="card-bottom-half">
                <button class="btn-outline-sm btn-properties-modern btn-edit-properties" data-examid="${exam.examId}" data-technique="${exam.technique}" data-time="${exam.timeLimit}" data-level="${exam.level}">⚙️ Sửa Thuộc Tính</button>
                <button class="btn-outline-sm btn-feedback-modern btn-view-feedback" data-examid="${exam.examId}">⭐ Xem Đánh Giá</button>
                ${exam.isVip ? `<button class="btn-outline-sm btn-vip-off-modern btn-toggle-exam-vip" data-examid="${exam.examId}" data-vip="true">Tắt VIP</button>` : `<button class="btn-outline-sm btn-vip-on-modern btn-toggle-exam-vip" data-examid="${exam.examId}" data-vip="false">Bật VIP</button>`}
                <button class="btn-outline-sm btn-delete-modern btn-delete" data-examid="${exam.examId}">🗑️ Xóa Đề Thi</button>
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
}

function openEditPropertiesModal(examId, technique, time, level) {
    currentEditingExamId = examId;
    const modal = document.getElementById('edit-properties-modal');
    if (!modal) return;
    document.getElementById('edit-modal-exam-id').innerText = examId;
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
        await updateDoc(doc(db, "exams", currentEditingExamId), {
            technique: document.getElementById('edit-select-technique').value,
            timeLimit: parseInt(document.getElementById('edit-select-time').value, 10),
            level: document.getElementById('edit-select-level').value
        });
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
        await setDoc(doc(db, "exams", examId), { isVip: !currentVipState }, { merge: true });
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
            const timeStr = (data.createdAt && data.createdAt.toDate) ? data.createdAt.toDate().toLocaleString('vi-VN') : "N/A";
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

// =========================================================================
// 5. QUY TRÌNH IMPORT & PREVIEW EXCEL 
// =========================================================================
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
                technique: techniqueValue,
                timeLimit: timeLimitValue,
                level: levelValue,
                isVip: false
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

// =========================================================================
// 6. KHỞI TẠO VÀ ĐĂNG KÝ SỰ KIỆN BAN ĐẦU
// =========================================================================
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
                return openEditPropertiesModal(dataset.examid, dataset.technique, dataset.time, dataset.level);
            }
            const vipBtn = e.target.closest('.btn-toggle-exam-vip');
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
