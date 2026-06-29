// admin-exams.js
import { db, showToast } from './admin-core.js';
import { 
    collection, getDocs, doc, setDoc, deleteDoc, addDoc, query, where 
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// =========================================================================
// 1. TẢI VÀ HIỂN THỊ DANH SÁCH ĐỀ THI
// =========================================================================
export async function loadExamList() {
    const tbody = document.getElementById('exam-list-body');
    if (!tbody) return;
    
    tbody.innerHTML = '<tr><td colspan="5" class="loading-text">⏳ Đang tải dữ liệu từ Firestore...</td></tr>';

    try {
        // Kéo đồng thời dữ liệu câu hỏi (để đếm) và cấu hình đề thi (VIP, thời gian)
        const [questionsSnapshot, examsSnapshot] = await Promise.all([
            getDocs(collection(db, "questions")),
            getDocs(collection(db, "exams"))
        ]);
        
        // Bản đồ hóa (Map) cấu hình đề thi
        const examDataMap = {};
        examsSnapshot.forEach(docSnap => {
            const data = docSnap.data();
            examDataMap[docSnap.id] = {
                isVip: data.isVip || false,
                timeLimit: data.timeLimit !== undefined ? data.timeLimit : 15,
                attemptCount: data.attemptCount || 0
            };
        });

        // Gom nhóm và đếm số lượng câu hỏi theo examId
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
            tbody.innerHTML = '<tr><td colspan="5" class="empty-message">Hệ thống chưa có câu hỏi nào. Hãy sử dụng khu vực Import phía dưới để thêm!</td></tr>';
            return;
        }

        // Vòng lặp render danh sách ra bảng dữ liệu
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
        tbody.innerHTML = `<tr><td colspan="5" class="empty-message" style="color: red;">❌ Lỗi tải dữ liệu đề thi. Hãy kiểm tra Console.</td></tr>`;
        showToast("Không thể tải danh sách đề thi", "error");
    }
}

// =========================================================================
// 2. CÁC HÀM XỬ LÝ SỰ KIỆN TRÊN BẢNG (BẬT/TẮT VIP, SỬA THỜI GIAN, XÓA, XEM FEEDBACK)
// =========================================================================
async function toggleExamVip(examId, currentVipState) {
    try {
        await setDoc(doc(db, "exams", examId), { isVip: !currentVipState }, { merge: true });
        showToast(`Cập nhật trạng thái VIP đề "${examId}" thành công!`, "success");
        loadExamList();
    } catch (error) {
        console.error("Lỗi cập nhật VIP đề thi:", error);
        showToast("Lỗi thay đổi trạng thái VIP đề thi", "error");
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
        console.error("Lỗi cập nhật thời gian:", error);
        showToast("Không thể cập nhật thời gian", "error");
    }
}

async function deleteExam(examId, buttonElement) {
    if (!confirm(`⚠️ CẢNH BÁO: Bạn có chắc chắn muốn xóa TOÀN BỘ câu hỏi của đề "${examId}"?\nHành động này không thể hoàn tác!`)) {
        return;
    }

    const originalText = buttonElement.innerHTML;
    buttonElement.innerHTML = "⏳...";
    buttonElement.disabled = true;

    try {
        const q = query(collection(db, "questions"), where("examId", "==", examId));
        const querySnapshot = await getDocs(q);
        
        if (querySnapshot.empty) {
            alert("Không tìm thấy câu hỏi nào thuộc đề này để xóa.");
            buttonElement.innerHTML = originalText;
            buttonElement.disabled = false;
            return;
        }

        const deletePromises = querySnapshot.docs.map(docSnap => deleteDoc(doc(db, "questions", docSnap.id)));
        await Promise.all(deletePromises);

        showToast(`Đã xóa sạch ${deletePromises.length} câu hỏi của đề "${examId}"!`, "success");
        loadExamList();
    } catch (error) {
        console.error("Lỗi khi xóa đề thi:", error);
        showToast("Lỗi trong quá trình xóa dữ liệu", "error");
        buttonElement.innerHTML = originalText;
        buttonElement.disabled = false;
    }
}

async function viewFeedback(examId) {
    const modal = document.getElementById("feedback-modal");
    const modalExamId = document.getElementById("modal-exam-id");
    const tbody = document.getElementById("feedback-list-body");
    
    if (!modal || !tbody) return;

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
            } else if (data.timestamp) {
                timeStr = new Date(data.timestamp).toLocaleString('vi-VN');
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
        console.error("Lỗi tải đánh giá:", error);
        tbody.innerHTML = '<tr><td colspan="4" class="empty-message" style="color: red;">❌ Lỗi tải dữ liệu feedback.</td></tr>';
    }
}

// =========================================================================
// 3. LOGIC IMPORT EXCEL (SHEETJS)
// =========================================================================
function initExcelHandlers() {
    const fileInput = document.getElementById('excel-file');
    const fileNameDisplay = document.getElementById('file-name-display');
    const importBtn = document.getElementById('btn-import');
    const downloadBtn = document.getElementById('btn-download-template');

    if (downloadBtn) {
        downloadBtn.addEventListener('click', () => {
            const templateData = [{ 
                "Mã Đề (examId)": "DE_001", 
                "Nội Dung (text)": "Thủ đô của Việt Nam là gì?", 
                "Đáp Án A": "Hồ Chí Minh", "Đáp Án B": "Hà Nội", "Đáp Án C": "Đà Nẵng", "Đáp Án D": "Hải Phòng", 
                "Đáp Án Đúng (0=A, 1=B, 2=C, 3=D)": 1, 
                "Giải thích (explanation)": "Hà Nội là thủ đô của nước CHXHCN Việt Nam." 
            }];
            const ws = XLSX.utils.json_to_sheet(templateData);
            ws['!cols'] = [{wch: 15}, {wch: 40}, {wch: 20}, {wch: 20}, {wch: 20}, {wch: 20}, {wch: 30}, {wch: 50}];
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "DanhSachCauHoi");
            XLSX.writeFile(wb, "Template_Import_Cau_Hoi.xlsx");
        });
    }

    if (fileInput && fileNameDisplay) {
        fileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                fileNameDisplay.innerText = `Đã chọn: ${file.name}`;
                fileNameDisplay.style.color = '#10b981';
            } else {
                fileNameDisplay.innerText = "Chưa có file nào được chọn";
                fileNameDisplay.style.color = '#ef4444';
            }
        });
    }

    if (importBtn) {
        importBtn.addEventListener('click', async () => {
            const file = fileInput.files[0];
            if (!file) return alert("❌ Vui lòng chọn một file Excel (.xlsx hoặc .xls) trước khi Import!");

            importBtn.disabled = true;
            importBtn.innerHTML = "⏳ Đang xử lý dữ liệu... Vui lòng đợi";

            const reader = new FileReader();
            reader.onload = async (e) => {
                try {
                    const data = new Uint8Array(e.target.result);
                    const workbook = XLSX.read(data, { type: 'array' });
                    const jsonArr = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);

                    if (jsonArr.length === 0) throw new Error("File Excel rỗng!");

                    let successCount = 0;
                    let errorCount = 0;

                    for (let i = 0; i < jsonArr.length; i++) {
                        const row = jsonArr[i];
                        if (!row["Nội Dung (text)"] || row["Đáp Án Đúng (0=A, 1=B, 2=C, 3=D)"] === undefined) {
                            errorCount++;
                            continue; 
                        }

                        await addDoc(collection(db, "questions"), {
                            examId: String(row["Mã Đề (examId)"] || "DEFAULT_EXAM"),
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
                        successCount++;
                    }

                    alert(`✅ IMPORT HOÀN TẤT!\n- Thành công: ${successCount} câu.\n- Bỏ qua do thiếu cột dữ liệu: ${errorCount} câu.`);
                    
                    fileInput.value = "";
                    fileNameDisplay.innerText = "Chưa có file nào được chọn";
                    fileNameDisplay.style.color = "";
                    
                    loadExamList(); // Làm mới danh sách bảng đề thi

                } catch (error) {
                    console.error("Lỗi khi import:", error);
                    alert("❌ Đã xảy ra lỗi khi đọc file hoặc đẩy lên Firebase:\n" + error.message);
                } finally {
                    importBtn.disabled = false;
                    importBtn.innerHTML = "⬆️ Bắt Đầu Import Lên Firebase";
                }
            };
            reader.readAsArrayBuffer(file);
        });
    }
}

// =========================================================================
// 4. KHỞI TẠO VÀ LẮNG NGHE SỰ KIỆN BAN ĐẦU
// =========================================================================
document.addEventListener('DOMContentLoaded', () => {
    loadExamList();
    initExcelHandlers();

    // Event Delegation (Ủy quyền sự kiện) tối ưu cho các nút trong bảng
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

    // Đóng Modal Feedback
    const closeFeedbackBtn = document.getElementById("closeFeedbackModal");
    if (closeFeedbackBtn) {
        closeFeedbackBtn.onclick = () => {
            document.getElementById("feedback-modal").style.display = "none";
        };
    }
});