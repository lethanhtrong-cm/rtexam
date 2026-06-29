// admin-exams.js
import { db, showToast } from './admin-core.js';
import { 
    collection, getDocs, doc, setDoc, updateDoc, deleteDoc, addDoc, query, where 
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// Biến tạm lưu trữ dữ liệu Excel sau khi đọc thành công và mã đề đang chỉnh sửa
let draftData = [];
let currentEditingExamId = "";

// =========================================================================
// 1. TẢI VÀ HIỂN THỊ DANH SÁCH ĐỀ THI (CÓ BỔ SUNG CỘT PHÂN LOẠI BADGES)
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
        
        // Bản đồ hóa cấu hình thuộc tính của đề thi (Metadata)
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

        // Gom nhóm đếm số lượng câu hỏi thực tế của đề
        const examGroups = {}; 
        questionsSnapshot.forEach((docSnap) => {
            const data = docSnap.data();
            const examId = data.examId || "Chưa phân loại"; 
            
            if (!examGroups[examId]) {
                examGroups[examId] = 0;
            }
            examGroups[examId]++; 
        });

        tbody.innerHTML = '';
        let stt = 1;
        
        if (Object.keys(examGroups).length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" class="empty-message">Hệ thống chưa có câu hỏi nào. Hãy chuyển sang Tab Import để nạp dữ liệu!</td></tr>';
            return;
        }

        // Vòng lặp kết xuất dữ liệu ra bảng tổng
        for (const examId in examGroups) {
            const count = examGroups[examId];
            const config = examDataMap[examId] || { isVip: false, timeLimit: 15, attemptCount: 0, technique: "Hỗn hợp", level: "Trung bình" };

            // Phân định lớp CSS cho màu sắc huy hiệu Cấp độ
            let levelClass = 'level-medium';
            if (config.level === 'Dễ') levelClass = 'level-easy';
            else if (config.level === 'Khó') levelClass = 'level-hard';

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td class="text-center">${stt++}</td>
                <td><strong>${examId}</strong></td>
                <td>
                    <span class="badge-meta">${config.technique}</span>
                    <span class="badge-meta ${levelClass}">${config.level}</span>
                </td>
                <td class="text-center">
                    <div style="margin-bottom: 5px;"><span class="badge-count">${count} câu</span></div>
                    <div>${config.isVip ? '<span class="badge-vip-exam">VIP 👑</span>' : '<span class="badge-free">Miễn Phí</span>'}</div>
                </td>
                <td class="text-center">
                    <div class="config-text">⏱️ Thời gian: <strong>${config.timeLimit}</strong> phút</div>
                    <div class="config-text">🔄 Lượt thi: <strong>${config.attemptCount}</strong></div>
                </td>
                <td class="text-center">
                    <div class="action-buttons">
                        <button class="btn-sm btn-edit-properties" 
                                data-examid="${examId}" 
                                data-technique="${config.technique}" 
                                data-time="${config.timeLimit}" 
                                data-level="${config.level}">⚙️ Sửa Thuộc Tính</button>
                        <button class="btn-sm btn-view-feedback" data-examid="${examId}">⭐ Xem Đánh Giá</button>
                        ${config.isVip 
                            ? `<button class="btn-sm btn-exam-vip-off btn-toggle-exam-vip" data-examid="${examId}" data-vip="true">Tắt VIP</button>`
                            : `<button class="btn-sm btn-exam-vip-on btn-toggle-exam-vip" data-examid="${examId}" data-vip="false">Bật VIP</button>`
                        }
                        <button class="btn-sm btn-delete" data-examid="${examId}">🗑️ Xóa</button>
                    </div>
                </td>
            `;
            tbody.appendChild(tr);
        }
    } catch (error) {
        console.error("Lỗi khi tải danh sách đề thi:", error);
        tbody.innerHTML = `<tr><td colspan="6" class="empty-message" style="color: red;">❌ Lỗi tải dữ liệu đề thi.</td></tr>`;
    }
}

// =========================================================================
// 2. NGHIỆP VỤ CẬP NHẬT THUỘC TÍNH ĐỀ THI ĐÃ XUẤT BẢN (NÂNG CẤP MỚI)
// =========================================================================

// Hàm mở Modal và gán tự động dữ liệu thuộc tính HIỆN TẠI của đề thi
function openEditPropertiesModal(examId, technique, time, level) {
    currentEditingExamId = examId;
    
    const modal = document.getElementById('edit-properties-modal');
    const modalTitleId = document.getElementById('edit-modal-exam-id');
    const selectTech = document.getElementById('edit-select-technique');
    const selectTime = document.getElementById('edit-select-time');
    const selectLevel = document.getElementById('edit-select-level');

    if (!modal) return;

    modalTitleId.innerText = examId;
    selectTech.value = technique || "Hỗn hợp";
    selectTime.value = time || "15";
    selectLevel.value = level || "Trung bình";

    // Hiển thị modal sửa thuộc tính
    modal.style.display = "block";
}

// Hàm đẩy thông tin thay đổi mới từ Modal lên Cloud Firestore
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
        
        // Thực hiện updateDoc cập nhật cục bộ Metadata của đề
        await updateDoc(examRef, {
            technique: technique,
            timeLimit: timeLimit,
            level: level
        });

        showToast(`Cập nhật thuộc tính đề "${currentEditingExamId}" thành công!`, "success");
        if (modal) modal.style.display = "none";
        
        // Tải lại bảng danh sách đề thi tổng hợp
        loadExamList();

    } catch (error) {
        console.error("Lỗi cập nhật thuộc tính đề thi:", error);
        showToast("Không thể lưu thay đổi thuộc tính", "error");
    } finally {
        saveBtn.disabled = false;
        saveBtn.innerHTML = "💾 Lưu Thay Đổi";
    }
}

// =========================================================================
// 3. ĐIỀU CHỈNH TRẠNG THÁI KHÁC (VIP, DELETE, FEEDBACK)
// =========================================================================
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
// 4. QUY TRÌNH IMPORT & PREVIEW EXCEL (GIỮ NGUYÊN)
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
                A: ${row.options[0]}<br>
                B: ${row.options[1]}<br>
                C: ${row.options[2]}<br>
                D: ${row.options[3]}
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

                if (jsonArr.length === 0) throw new Error("File Excel không chứa bất kỳ bản ghi nào!");

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
                
                // Hiển thị tên file và vẽ bảng
                if (fileNameDisplay) {
                    fileNameDisplay.innerText = `Đã chọn: ${file.name}`;
                    fileNameDisplay.style.display = 'inline-block';
                }
                renderPreview();

            } catch (error) {
                alert("❌ Không thể đọc file Excel. Vui lòng kiểm tra lại cấu trúc.\nChi tiết: " + error.message);
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

    const selectTechnique = document.getElementById('select-technique');
    const selectTime = document.getElementById('select-time');
    const selectLevel = document.getElementById('select-level');

    if (!publishBtn || draftData.length === 0) return;

    if (!confirm(`Bạn có chắc chắn muốn xuất bản ${draftData.length} câu hỏi kèm cấu hình thuộc tính đã chọn không?`)) return;

    publishBtn.disabled = true;
    publishBtn.innerHTML = "⏳ Đang thực hiện lưu dữ liệu và cấu hình...";

    try {
        let uniqueExamIds = new Set();
        for (let i = 0; i < draftData.length; i++) {
            const questionItem = draftData[i];
            uniqueExamIds.add(questionItem.examId);
            await addDoc(collection(db, "questions"), questionItem);
        }

        const techniqueValue = selectTechnique ? selectTechnique.value : "Hỗn hợp";
        const timeLimitValue = selectTime ? parseInt(selectTime.value, 10) : 15;
        const levelValue = selectLevel ? selectLevel.value : "Trung bình";

        for (const examId of uniqueExamIds) {
            await setDoc(doc(db, "exams", examId), {
                technique: techniqueValue,
                timeLimit: timeLimitValue,
                level: levelValue,
                isVip: false
            }, { merge: true });
        }

        alert(`🎉 XUẤT BẢN THÀNH CÔNG!\n- Đã nạp: ${draftData.length} câu hỏi.\n- Đồng bộ Metadata thành công.`);
        
        draftData = [];
        if (fileInput) fileInput.value = "";
        if (fileNameDisplay) fileNameDisplay.style.display = "none";
        
        renderPreview();
        loadExamList();

    } catch (error) {
        alert("❌ Quá trình xuất bản thất bại.\nChi tiết: " + error.message);
        publishBtn.disabled = false;
        publishBtn.innerHTML = "🔒 Xác Nhận & Publish Lên Hệ Thống";
    }
}

// =========================================================================
// 5. KHỞI TẠO VÀ GẮN LẮNG NGHE SỰ KIỆN BAN ĐẦU
// =========================================================================
document.addEventListener('DOMContentLoaded', () => {
    loadExamList();
    handleExcelRead();

    // Sự kiện tải file mẫu Excel
    const downloadBtn = document.getElementById('btn-download-template');
    if (downloadBtn) {
        downloadBtn.addEventListener('click', () => {
            const templateData = [{ 
                "Mã Đề (examId)": "DE_002", 
                "Nội Dung (text)": "Hệ thống đang chạy kiến trúc module gì?", 
                "Đáp Án A": "CommonJS", "Đáp Án B": "ES6 Module", "Đáp Án C": "AMD", "Đáp Án D": "UMD", 
                "Đáp Án Đúng (0=A, 1=B, 2=C, 3=D)": 1, 
                "Giải thích (explanation)": "Hệ thống đang chạy kiến trúc ES6 Module." 
            }];
            const ws = XLSX.utils.json_to_sheet(templateData);
            ws['!cols'] = [{wch: 15}, {wch: 40}, {wch: 20}, {wch: 20}, {wch: 20}, {wch: 20}, {wch: 30}, {wch: 50}];
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "DanhSachCauHoi");
            XLSX.writeFile(wb, "Template_Import_Cau_Hoi.xlsx");
        });
    }

    // Gắn sự kiện click cho nút "Lưu thay đổi" của Modal Chỉnh sửa thuộc tính
    const savePropsBtn = document.getElementById('btn-save-properties');
    if (savePropsBtn) {
        savePropsBtn.addEventListener('click', updateExamProperties);
    }

    const publishBtn = document.getElementById('btn-publish');
    if (publishBtn) {
        publishBtn.addEventListener('click', publishExam);
    }

    // Kỹ thuật Event Delegation (Ủy quyền sự kiện) linh hoạt trên bảng danh sách đề thi tổng hợp
    const examBody = document.getElementById('exam-list-body');
    if (examBody) {
        examBody.addEventListener('click', (e) => {
            // Nút mở Modal sửa toàn bộ thuộc tính mới
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

    // Đóng Modal Sửa thuộc tính
    const closeEditModalBtn = document.getElementById("closeEditPropertiesModal");
    if (closeEditModalBtn) {
        closeEditModalBtn.onclick = () => {
            document.getElementById("edit-properties-modal").style.display = "none";
        };
    }

    // Đóng Modal Feedback
    const closeFeedbackBtn = document.getElementById("closeFeedbackModal");
    if (closeFeedbackBtn) {
        closeFeedbackBtn.onclick = () => {
            document.getElementById("feedback-modal").style.display = "none";
        };
    }
});
