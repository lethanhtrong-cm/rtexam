// admin-exams.js
import { db, showToast } from './admin-core.js';
import { 
    collection, getDocs, doc, setDoc, deleteDoc, addDoc, query, where 
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// Biến tạm lưu trữ dữ liệu Excel sau khi đọc thành công (Hàng đợi chờ duyệt)
let draftData = [];

// =========================================================================
// 1. TẢI VÀ HIỂN THỊ DANH SÁCH ĐỀ THI (GIỮ NGUYÊN HOÀN TOÀN LOGIC CŨ)
// =========================================================================
export async function loadExamList() {
    const tbody = document.getElementById('exam-list-body');
    if (!tbody) return;
    
    tbody.innerHTML = '<tr><td colspan="5" class="loading-text">⏳ Đang tải dữ liệu từ Firestore...</td></tr>';

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
                attemptCount: data.attemptCount || 0
            };
        });

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
            tbody.innerHTML = '<tr><td colspan="5" class="empty-message">Hệ thống chưa có câu hỏi nào. Hãy chuyển sang Tab Import để nạp dữ liệu!</td></tr>';
            return;
        }

        for (const examId in examGroups) {
            const count = examGroups[examId];
            const config = examDataMap[examId] || { isVip: false, timeLimit: 15, attemptCount: 0 };

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td class="text-center">${stt++}</td>
                <td><strong>${examId}</strong></td>
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
                        <button class="btn-sm btn-edit-time" data-examid="${examId}" data-time="${config.timeLimit}">⏱️ Sửa Thời Gian</button>
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
        tbody.innerHTML = `<tr><td colspan="5" class="empty-message" style="color: red;">❌ Lỗi tải dữ liệu đề thi.</td></tr>`;
    }
}

// =========================================================================
// 2. NGHIỆP VỤ ĐIỀU CHỈNH ĐỀ THI CŨ
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

async function editExamTime(examId, currentTime) {
    const newTimeInput = prompt(`Nhập số phút làm bài cho đề "${examId}":`, currentTime);
    if (newTimeInput === null || newTimeInput.trim() === "") return;

    const newTime = parseInt(newTimeInput, 10);
    if (isNaN(newTime) || newTime <= 0) {
        alert("❌ Thời gian không hợp lệ. Vui lòng nhập một số lớn hơn 0.");
        return;
    }

    try {
        await setDoc(doc(db, "exams", examId), { timeLimit: newTime }, { merge: true });
        showToast(`Đã đổi thời gian đề "${examId}" thành ${newTime} phút!`, "success");
        loadExamList();
    } catch (error) {
        showToast("Không thể cập nhật thời gian", "error");
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
// 3. QUY TRÌNH IMPORT & RENDER PREVIEW (GIỮ NGUYÊN TOÀN BỘ LOGIC CŨ)
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
                let skipCount = 0;

                jsonArr.forEach((row) => {
                    if (!row["Nội Dung (text)"] || row["Đáp Án Đúng (0=A, 1=B, 2=C, 3=D)"] === undefined) {
                        skipCount++;
                        return;
                    }

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
                renderPreview();

            } catch (error) {
                console.error("Lỗi đọc Excel:", error);
                alert("❌ Không thể đọc file Excel. Vui lòng kiểm tra lại tệp tin mẫu.\nChi tiết: " + error.message);
            } finally {
                importBtn.disabled = false;
                importBtn.innerHTML = "👁️ Đọc Dữ Liệu & Xem Trước";
            }
        };
        reader.readAsArrayBuffer(file);
    });
}

// =========================================================================
// 4. QUY TRÌNH PUBLISH DỮ LIỆU CHÍNH THỨC + ĐỒNG BỘ THUỘC TÍNH (METADATA)
// =========================================================================
async function publishExam() {
    const publishBtn = document.getElementById('btn-publish');
    const fileInput = document.getElementById('excel-file');
    const fileNameDisplay = document.getElementById('file-name-display');

    // Lấy đối tượng DOM của 3 thẻ select cấu hình metadata mới
    const selectTechnique = document.getElementById('select-technique');
    const selectTime = document.getElementById('select-time');
    const selectLevel = document.getElementById('select-level');

    if (!publishBtn || draftData.length === 0) return;

    if (!confirm(`Bạn có chắc chắn muốn xuất bản ${draftData.length} câu hỏi kèm cấu hình thuộc tính đã chọn lên Firebase không?`)) {
        return;
    }

    publishBtn.disabled = true;
    publishBtn.innerHTML = "⏳ Đang thực hiện lưu dữ liệu và cấu hình...";

    try {
        let uniqueExamIds = new Set();

        // 1. Lưu tuần tự dữ liệu câu hỏi chi tiết vào collection "questions"
        for (let i = 0; i < draftData.length; i++) {
            const questionItem = draftData[i];
            uniqueExamIds.add(questionItem.examId);

            await addDoc(collection(db, "questions"), questionItem);
        }

        // Đọc giá trị Metadata được chọn từ giao diện HTML
        const techniqueValue = selectTechnique ? selectTechnique.value : "Hỗn hợp";
        const timeLimitValue = selectTime ? parseInt(selectTime.value, 10) : 15;
        const levelValue = selectLevel ? selectLevel.value : "Trung bình";

        // 2. Đồng bộ các thuộc tính phân loại (Metadata) vào từng mã đề thuộc collection "exams"
        for (const examId of uniqueExamIds) {
            // Sử dụng merge: true giúp lưu đè bổ sung các thuộc tính mà không làm mất các trường cũ (ví dụ: attemptCount)
            await setDoc(doc(db, "exams", examId), {
                technique: techniqueValue,
                timeLimit: timeLimitValue,
                level: levelValue,
                isVip: false
            }, { merge: true });
        }

        alert(`🎉 XUẤT BẢN THÀNH CÔNG!\n- Đã tải lên: ${draftData.length} câu hỏi.\n- Đã cấu hình thuộc tính [Kỹ thuật: ${techniqueValue} | Thời gian: ${timeLimitValue} phút | Cấp độ: ${levelValue}] thành công cho các mã đề.`);
        
        // Trả lại trạng thái trống sau khi xử lý thành công
        draftData = [];
        if (fileInput) fileInput.value = "";
        if (fileNameDisplay) {
            fileNameDisplay.innerText = "Chưa có file nào được chọn";
            fileNameDisplay.style.color = "";
        }
        
        // Làm mới lại bảng xem trước và danh sách đề thi tổng
        renderPreview();
        loadExamList();

    } catch (error) {
        console.error("Lỗi khi đẩy dữ liệu lên Firebase:", error);
        alert("❌ Quá trình xuất bản thất bại. Vui lòng kiểm tra Rules Firestore.\nChi tiết: " + error.message);
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
                "Nội Dung (text)": "Trang Admin đang chạy kiến trúc module gì?", 
                "Đáp Án A": "CommonJS", "Đáp Án B": "ES6 Module", "Đáp Án C": "AMD", "Đáp Án D": "UMD", 
                "Đáp Án Đúng (0=A, 1=B, 2=C, 3=D)": 1, 
                "Giải thích (explanation)": "Hệ thống đang chạy kiến trúc ES6 Module (type='module')." 
            }];
            const ws = XLSX.utils.json_to_sheet(templateData);
            ws['!cols'] = [{wch: 15}, {wch: 40}, {wch: 20}, {wch: 20}, {wch: 20}, {wch: 20}, {wch: 30}, {wch: 50}];
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "DanhSachCauHoi");
            XLSX.writeFile(wb, "Template_Import_Cau_Hoi.xlsx");
        });
    }

    // Sự kiện lắng nghe nút lệnh Publish dữ liệu
    const publishBtn = document.getElementById('btn-publish');
    if (publishBtn) {
        publishBtn.addEventListener('click', publishExam);
    }

    // Lắng nghe đổi file để cập nhật UI tên file
    const fileInput = document.getElementById('excel-file');
    const fileNameDisplay = document.getElementById('file-name-display');
    if (fileInput && fileNameDisplay) {
        fileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                fileNameDisplay.innerText = `Đã chọn: ${file.name}`;
                fileNameDisplay.style.color = '#10b981';
            }
        });
    }

    // Kỹ thuật Event Delegation cho bảng tổng kết đề thi
    const examBody = document.getElementById('exam-list-body');
    if (examBody) {
        examBody.addEventListener('click', (e) => {
            const editBtn = e.target.closest('.btn-edit-time');
            if (editBtn) return editExamTime(editBtn.dataset.examid, editBtn.dataset.time);

            const vipBtn = e.target.closest('.btn-toggle-exam-vip');
            if (vipBtn) return toggleExamVip(vipBtn.dataset.examid, vipBtn.dataset.vip === "true");

            const feedbackBtn = e.target.closest('.btn-view-feedback');
            if (feedbackBtn) return viewFeedback(feedbackBtn.dataset.examid);

            const deleteBtn = e.target.closest('.btn-delete');
            if (deleteBtn) return deleteExam(deleteBtn.dataset.examid, deleteBtn);
        });
    }

    // Nút đóng modal feedback
    const closeFeedbackBtn = document.getElementById("closeFeedbackModal");
    if (closeFeedbackBtn) {
        closeFeedbackBtn.onclick = () => {
            document.getElementById("feedback-modal").style.display = "none";
        };
    }
});
