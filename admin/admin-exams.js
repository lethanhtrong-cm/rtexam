// admin-exams.js
import { db, showToast } from './admin-core.js';
import { 
    collection, getDocs, doc, setDoc, updateDoc, deleteDoc, addDoc, query, where 
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// Biến trạng thái bộ lọc toàn cục (Mặc định ban đầu)
let currentTechnique = "MRI";
let currentLevel = "all";
let currentTime = "all";

// Bộ nhớ đệm lưu trữ danh sách đề thi thô tải về từ Firestore
let cachedExams = [];

// Biến tạm phục vụ quy trình Import Excel & ID đề thi đang chỉnh sửa
let draftData = [];
let currentEditingExamId = "";

// =========================================================================
// 1. TẢI DỮ LIỆU TỪ FIRESTORE (POPULATE CACHE)
// =========================================================================
export async function loadExamList() {
    const tbody = document.getElementById('exam-list-body');
    if (!tbody) return;
    
    tbody.innerHTML = '<tr><td colspan="6" class="loading-text">⏳ Đang tải dữ liệu từ Firestore...</td></tr>';

    try {
        const [questionsSnapshot, examsSnapshot] = await Promise.all([
            getDocs(collection(db, "questions")),
            getDocs(collection(db, "exams"))
        ]);
        
        // Bản đồ hóa cấu hình metadata từ collection "exams"
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

        // Gom nhóm và đếm số lượng câu hỏi thực tế từ collection "questions"
        const examGroups = {}; 
        questionsSnapshot.forEach((docSnap) => {
            const data = docSnap.data();
            const examId = data.examId || "Chưa phân loại"; 
            
            if (!examGroups[examId]) {
                examGroups[examId] = 0;
            }
            examGroups[examId]++; 
        });

        // Nạp toàn bộ dữ liệu xử lý thô vào mảng bộ nhớ đệm toàn cục
        cachedExams = [];
        for (const examId in examGroups) {
            const count = examGroups[examId];
            const config = examDataMap[examId] || { isVip: false, timeLimit: 15, attemptCount: 0, technique: "Hỗn hợp", level: "Trung bình" };

            cachedExams.push({
                examId: examId,
                count: count,
                isVip: config.isVip,
                timeLimit: config.timeLimit,
                attemptCount: config.attemptCount,
                technique: config.technique,
                level: config.level
            });
        }

        // Kích hoạt hàm render lọc dữ liệu ra giao diện
        renderExamList();

    } catch (error) {
        console.error("Lỗi khi tải danh sách đề thi:", error);
        tbody.innerHTML = `<tr><td colspan="6" class="empty-message" style="color: red;">❌ Lỗi tải dữ liệu đề thi từ hệ thống.</td></tr>`;
    }
}

// =========================================================================
// 2. HÀM KẾT XUẤT DỮ LIỆU QUA 3 LỚP FILTER REALTIME (NÂNG CẤP CHÍNH)
// =========================================================================
export function renderExamList() {
    const tbody = document.getElementById('exam-list-body');
    if (!tbody) return;

    // Tiến hành lọc dữ liệu từ bộ nhớ đệm qua 3 tầng điều kiện song song
    const filteredExams = cachedExams.filter(exam => {
        const matchTech = exam.technique === currentTechnique;
        const matchLevel = currentLevel === "all" || exam.level === currentLevel;
        const matchTime = currentTime === "all" || String(exam.timeLimit) === String(currentTime);
        return matchTech && matchLevel && matchTime;
    });

    tbody.innerHTML = '';
    let stt = 1;

    // Giao diện khi không có kết quả phù hợp
    if (filteredExams.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="empty-message">Không có đề thi nào thỏa mãn bộ lọc hiện tại (Kỹ thuật: ${currentTechnique} | Cấp độ: ${currentLevel} | Thời gian: ${currentTime === 'all' ? 'Tất cả' : currentTime + ' phút'}).</td></tr>`;
        return;
    }

    // Vòng lặp kết xuất các bản ghi thỏa mãn điều kiện
    filteredExams.forEach(exam => {
        let levelClass = 'level-medium';
        if (exam.level === 'Dễ') levelClass = 'level-easy';
        else if (exam.level === 'Khó') levelClass = 'level-hard';

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td class="text-center">${stt++}</td>
            <td><strong>${exam.examId}</strong></td>
            <td>
                <span class="badge-meta">${exam.technique}</span>
                <span class="badge-meta ${levelClass}">${exam.level}</span>
            </td>
            <td class="text-center">
                <div style="margin-bottom: 5px;"><span class="badge-count">${exam.count} câu</span></div>
                <div>${exam.isVip ? '<span class="badge-vip-exam">VIP 👑</span>' : '<span class="badge-free">Miễn Phí</span>'}</div>
            </td>
            <td class="text-center">
                <div class="config-text">⏱️ Thời gian: <strong>${exam.timeLimit}</strong> phút</div>
                <div class="config-text">🔄 Lượt thi: <strong>${exam.attemptCount}</strong></div>
            </td>
            <td class="text-center">
                <div class="action-buttons">
                    <button class="btn-sm btn-edit-properties" 
                            data-examid="${exam.examId}" 
                            data-technique="${exam.technique}" 
                            data-time="${exam.timeLimit}" 
                            data-level="${exam.level}">⚙️ Sửa Thuộc Tính</button>
                    <button class="btn-sm btn-view-feedback" data-examid="${exam.examId}">⭐ Xem Đánh Giá</button>
                    ${exam.isVip 
                        ? `<button class="btn-sm btn-exam-vip-off btn-toggle-exam-vip" data-examid="${exam.examId}" data-vip="true">Tắt VIP</button>`
                        : `<button class="btn-sm btn-exam-vip-on btn-toggle-exam-vip" data-examid="${exam.examId}" data-vip="false">Bật VIP</button>`
                    }
                    <button class="btn-sm btn-delete" data-examid="${exam.examId}">🗑️ Xóa</button>
                </div>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

// =========================================================================
// 3. KHỞI TẠO BỘ LẮNG NGHE SỰ KIỆN TỪ SIDEBAR & CÁC THANH TABS DÀN NGANG
// =========================================================================
function initFilterChangeListeners() {
    // A. Lắng nghe click Chuyên khoa từ Sidebar (MRI, CT, X quang, Hỗn hợp)
    const sidebarItems = document.querySelectorAll('.sidebar-menu .menu-item[data-tech]');
    sidebarItems.forEach(item => {
        item.addEventListener('click', () => {
            const tech = item.getAttribute('data-tech');
            if (tech) {
                currentTechnique = tech;
                renderExamList(); // Re-render ngay lập tức từ cache
            }
        });
    });

    // B. Lắng nghe click hàng nút dàn ngang (Pills) chọn Độ Khó
    const levelPills = document.querySelectorAll('#filter-level-pills .pill-btn');
    levelPills.forEach(pill => {
        pill.addEventListener('click', () => {
            levelPills.forEach(btn => btn.classList.remove('active'));
            pill.classList.add('active');
            
            currentLevel = pill.getAttribute('data-level');
            renderExamList();
        });
    });

    // C. Lắng nghe click hàng nút dàn ngang (Pills) chọn Thời Gian Thi
    const timePills = document.querySelectorAll('#filter-time-pills .pill-btn');
    timePills.forEach(pill => {
        pill.addEventListener('click', () => {
            timePills.forEach(btn => btn.classList.remove('active'));
            pill.classList.add('active');
            
            currentTime = pill.getAttribute('data-time');
            renderExamList();
        });
    });
}

// =========================================================================
// 4. NGHIỆP VỤ ĐIỀU CHỈNH ĐỀ THI (VIP, EDIT PROPERTIES, DELETE, FEEDBACK)
// =========================================================================
function openEditPropertiesModal(examId, technique, time, level) {
    currentEditingExamId = examId;
    const modal = document.getElementById('edit-properties-modal');
    const modalTitleId = document.getElementById('edit-modal-exam-id');
    
    if (!modal) return;

    modalTitleId.innerText = examId;
    document.getElementById('edit-select-technique').value = technique || "Hỗn hợp";
    document.getElementById('edit-select-time').value = time || "15";
    document.getElementById('edit-select-level').value = level || "Trung bình";

    modal.style.display = "block";
}

async function updateExamProperties() {
    if (!currentEditingExamId) return;

    const saveBtn = document.getElementById('btn-save-properties');
    const modal = document.getElementById('edit-properties-modal');
    const technique = document.getElementById('edit-select-technique').value;
    const timeLimit = parseInt(document.getElementById('edit-select-time').value, 10);
    const level = document.getElementById('edit-select-level').value;

    saveBtn.disabled = true;
    saveBtn.innerHTML = "⏳ Đang lưu...";

    try {
        const examRef = doc(db, "exams", currentEditingExamId);
        await updateDoc(examRef, {
            technique: technique,
            timeLimit: timeLimit,
            level: level
        });

        showToast(`Cập nhật thuộc tính đề "${currentEditingExamId}" thành công!`, "success");
        if (modal) modal.style.display = "none";
        
        loadExamList(); // Làm mới bộ đệm cache và cập nhật bảng dữ liệu

    } catch (error) {
        console.error("Lỗi cập nhật thuộc tính:", error);
        showToast("Không thể lưu thay đổi", "error");
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
    } catch (error) {
        showToast("Lỗi thay đổi trạng thái VIP", "error");
    }
}

async function deleteExam(examId, buttonElement) {
    if (!confirm(`⚠️ CẢNH BÁO: Bạn có chắc chắn muốn xóa TOÀN BỘ câu hỏi của đề "${examId}"?\nHành động này không thể hoàn tác!`)) return;

    const originalText = buttonElement.innerHTML;
    buttonElement.innerHTML = "⏳...";
    buttonElement.disabled = true;

    try {
        const q = query(collection(db, "questions"), where("examId", "==", examId));
        const querySnapshot = await getDocs(q);
        
        if (querySnapshot.empty) {
            alert("Không tìm thấy câu hỏi thuộc đề này.");
            buttonElement.innerHTML = originalText;
            buttonElement.disabled = false;
            return;
        }

        const deletePromises = querySnapshot.docs.map(docSnap => deleteDoc(doc(db, "questions", docSnap.id)));
        await Promise.all(deletePromises);

        showToast(`Đã xóa sạch ${deletePromises.length} câu hỏi của đề "${examId}"!`, "success");
        loadExamList();
    } catch (error) {
        showToast("Lỗi khi xóa dữ liệu", "error");
        buttonElement.innerHTML = originalText;
        buttonElement.disabled = false;
    }
}

async function viewFeedback(examId) {
    const modal = document.getElementById("feedback-modal");
    const modalExamId = document.getElementById("modal-exam-id");
    const tbody = document.getElementById("feedback-list-body");
    
    modalExamId.innerText = examId;
    tbody.innerHTML = '<tr><td colspan="4" class="empty-message">⏳ Đang tải dữ liệu đánh giá...</td></tr>';
    modal.style.display = "block"; 

    try {
        const q = query(collection(db, "feedbacks"), where("examId", "==", examId));
        const querySnapshot = await getDocs(q);
        tbody.innerHTML = '';
        
        if (querySnapshot.empty) {
            tbody.innerHTML = '<tr><td colspan="4" class="empty-message">Chưa có lượt đánh giá nào cho đề thi này.</td></tr>';
            return;
        }

        querySnapshot.forEach((docSnap) => {
            const data = docSnap.data();
            const email = data.email || "Khách vô danh";
            const rating = data.rating || 0;
            const comment = data.comment || data.feedback || "Không có góp ý văn bản.";
            
            let starsHtml = '';
            for (let i = 0; i < rating; i++) starsHtml += '<span class="rating-star">★</span>';
            
            let timeStr = "N/A";
            if (data.createdAt && data.createdAt.toDate) {
                timeStr = data.createdAt.toDate().toLocaleString('vi-VN');
            }

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><strong>${email}</strong></td>
                <td class="text-center">${starsHtml}</td>
                <td>${comment}</td>
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
        previewBody.innerHTML = '<tr><td colspan="5" class="empty-message">Chưa có dữ liệu nào được nạp để xem trước.</td></tr>';
        if (publishBtn) publishBtn.disabled = true;
        return;
    }

    let stt = 1;
    draftData.forEach((row) => {
        const tr = document.createElement('tr');
        const optionsHtml = `
            <div style="font-size:13px; line-height:1.4;">
                A: ${row.options[0]}<br> B: ${row.options[1]}<br> C: ${row.options[2]}<br> D: ${row.options[3]}
            </div>
        `;
        const mapCorrectText = ['A', 'B', 'C', 'D'];
        const correctChar = mapCorrectText[row.correctAnswer] || 'Không rõ';

        tr.innerHTML = `
            <td class="text-center">${stt++}</td>
            <td><span class="badge-count" style="background:#eff6ff; color:#2563eb;">${row.examId}</span></td>
            <td><div style="max-width:300px; font-weight:500;">${row.text}</div></td>
            <td>${optionsHtml}</td>
            <td class="text-center"><strong style="color:#10b981; font-size:15px;">${correctChar}</strong></td>
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
    const fileNameDisplay = document.getElementById('file-name-display');
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
                jsonArr.forEach((row) => {
                    if (!row["Nội Dung (text)"] || row["Đáp Án Đúng (0=A, 1=B, 2=C, 3=D)"] === undefined) return;

                    draftData.push({
                        examId: String(row["Mã Đề (examId)"] || "DEFAULT_EXAM").trim(),
                        text: String(row["Nội Dung (text)"]).trim(),
                        options: [
                            String(row["Đáp Án A"] || "").trim(),
                            String(row["Đáp Án B"] || "").trim(),
                            String(row["Đáp Án C"] || "").trim(),
                            String(row["Đáp Án D"] || "").trim()
                        ],
                        correctAnswer: parseInt(row["Đáp Án Đúng (0=A, 1=B, 2=C, 3=D)"], 10),
                        explanation: row["Giải thích (explanation)"] ? String(row["Giải thích (explanation)"]).trim() : ""
                    });
                });

                showToast(`Đọc file thành công! Đã nạp ${draftData.length} câu hỏi vào danh sách xem trước.`, "success");
                
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
    const fileInput = document.getElementById('excel-file');
    const fileNameDisplay = document.getElementById('file-name-display');

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

        alert(`🎉 XUẤT BẢN THÀNH CÔNG!\n- Đã nạp: ${draftData.length} câu hỏi vào Database.`);
        
        draftData = [];
        if (fileInput) fileInput.value = "";
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
document.addEventListener('DOMContentLoaded', () => {
    loadExamList();
    handleExcelRead();
    initFilterChangeListeners(); // Khởi chạy bộ lắng nghe sự kiện lọc Pill & Sidebar mới

    // Tải file Excel mẫu
    const downloadBtn = document.getElementById('btn-download-template');
    if (downloadBtn) {
        downloadBtn.addEventListener('click', () => {
            const templateData = [{ 
                "Mã Đề (examId)": "DE_MRI_01", 
                "Nội Dung (text)": "Chuỗi xung T2W trên MRI làm nước có màu gì?", 
                "Đáp Án A": "Màu đen", "Đáp Án B": "Màu Trắng sáng", "Đáp Án C": "Màu xám", "Đáp Án D": "Màu đỏ", 
                "Đáp Án Đúng (0=A, 1=B, 2=C, 3=D)": 1, 
                "Giải thích (explanation)": "Trên chuỗi xung dịch nước (như dịch não tủy) có tín hiệu cao (trắng)." 
            }];
            const ws = XLSX.utils.json_to_sheet(templateData);
            ws['!cols'] = [{wch: 15}, {wch: 40}, {wch: 20}, {wch: 20}, {wch: 20}, {wch: 20}, {wch: 30}, {wch: 50}];
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "DanhSachCauHoi");
            XLSX.writeFile(wb, "Template_Import_Cau_Hoi.xlsx");
        });
    }

    // Modal lưu chỉnh sửa thuộc tính
    const savePropsBtn = document.getElementById('btn-save-properties');
    if (savePropsBtn) {
        savePropsBtn.addEventListener('click', updateExamProperties);
    }

    const publishBtn = document.getElementById('btn-publish');
    if (publishBtn) {
        publishBtn.addEventListener('click', publishExam);
    }

    // Event Delegation cho các thao tác trên dòng bảng kết quả
    const examBody = document.getElementById('exam-list-body');
    if (examBody) {
        examBody.addEventListener('click', (e) => {
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

    // Cơ chế đóng các Modals thủ công
    document.getElementById("closeEditPropertiesModal").onclick = () => {
        document.getElementById("edit-properties-modal").style.display = "none";
    };
    document.getElementById("closeFeedbackModal").onclick = () => {
        document.getElementById("feedback-modal").style.display = "none";
    };
});
