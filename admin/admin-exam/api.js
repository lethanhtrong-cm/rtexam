import { db, showToast } from '../admin-core.js';
import { collection, getDocs, doc, setDoc, updateDoc, deleteDoc, addDoc, query, where, getDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { appState } from './state.js';
import { renderPreview, injectHistoryModal } from './ui.js';

export async function updateExamProperties() {
    if (!appState.currentEditingExamId) return;
    const saveBtn = document.getElementById('btn-save-properties');
    const modal = document.getElementById('edit-properties-modal');
    
    saveBtn.disabled = true;
    saveBtn.innerHTML = "⏳ Đang lưu...";

    try {
        const docRef = doc(db, "exams", appState.currentEditingExamId);
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
        
        showToast(`Cập nhật thuộc tính đề "${appState.currentEditingExamId}" thành công!`, "success");
        if (modal) modal.style.display = "none";
    } catch (error) {
        showToast("Không thể lưu thay đổi thuộc tính đề", "error");
    } finally {
        saveBtn.disabled = false;
        saveBtn.innerHTML = "💾 Lưu Thay Đổi";
    }
}

export async function toggleExamVip(examId, currentVipState) {
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

export async function deleteExam(examId, buttonElement) {
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

export async function viewFeedback(examId) {
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

export async function viewExamHistory(examId) {
    injectHistoryModal();
    const modal = document.getElementById('exam-history-modal');
    const tbody = document.getElementById('history-table-body');
    
    document.getElementById('history-modal-exam-id').innerText = examId;
    tbody.innerHTML = '<tr><td colspan="3" style="text-align:center; padding:30px; color:#64748b;">⏳ Đang kéo dữ liệu từ máy chủ...</td></tr>';
    modal.style.display = 'block';

    // Hàm trợ thủ siêu chuẩn hóa thời gian: Biến mọi định dạng thành số Milliseconds
    const getMs = (timeVal) => {
        if (!timeVal) return 0;
        if (typeof timeVal.toMillis === 'function') return timeVal.toMillis();
        if (typeof timeVal.toDate === 'function') return timeVal.toDate().getTime();
        if (timeVal.seconds) return timeVal.seconds * 1000;
        const parsed = new Date(timeVal).getTime();
        return isNaN(parsed) ? Number(timeVal) || 0 : parsed;
    };

    try {
        const q = query(collection(db, "results"), where("examId", "==", examId));
        const snap = await getDocs(q);
        
        tbody.innerHTML = '';
        if (snap.empty) {
            tbody.innerHTML = '<tr><td colspan="3" style="text-align:center; padding:30px; color:#94a3b8; font-style: italic;">Chưa có học viên nào hoàn thành đề thi này.</td></tr>';
            return;
        }

        let uniqueUsersMap = new Map();

        snap.forEach(docSnap => {
            const data = docSnap.data();
            const userIdentifier = data.uid || data.userId || data.email || data.userEmail || docSnap.id;
            
            if (!uniqueUsersMap.has(userIdentifier)) {
                uniqueUsersMap.set(userIdentifier, data);
            } else {
                const existingData = uniqueUsersMap.get(userIdentifier);
                // Dùng hàm chuẩn hóa thời gian để so sánh an toàn
                const existingTimeMs = getMs(existingData.timestamp || existingData.createdAt);
                const newTimeMs = getMs(data.timestamp || data.createdAt);
                
                if (newTimeMs > existingTimeMs) {
                    uniqueUsersMap.set(userIdentifier, data);
                }
            }
        });

        let records = Array.from(uniqueUsersMap.values());
        
        // Dùng hàm chuẩn hóa thời gian để sắp xếp an toàn từ mới đến cũ
        records.sort((a, b) => {
            const timeA = getMs(a.timestamp || a.createdAt);
            const timeB = getMs(b.timestamp || b.createdAt);
            return timeB - timeA;
        }); 

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

export function handleExcelRead() {
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

                appState.draftData = [];
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

                    appState.draftData.push({
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

                let msg = `Đọc file thành công! Nạp được ${appState.draftData.length} câu hỏi.`;
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

export async function publishExam() {
    const publishBtn = document.getElementById('btn-publish');
    const techniqueValue = document.getElementById('select-technique').value;
    const timeLimitValue = parseInt(document.getElementById('select-time').value, 10);
    const levelValue = document.getElementById('select-level').value;

    const descInput = document.getElementById('input-description');
    const descValue = descInput ? descInput.value.trim() : "";

    if (!publishBtn || appState.draftData.length === 0) return;
    if (!confirm(`Bạn có chắc chắn muốn xuất bản ${appState.draftData.length} câu hỏi kèm cấu hình thuộc tính đã chọn không?`)) return;

    publishBtn.disabled = true;
    publishBtn.innerHTML = "⏳ Đang xuất bản dữ liệu...";

    try {
        let uniqueExamIds = new Set();
        for (let i = 0; i < appState.draftData.length; i++) {
            const questionItem = appState.draftData[i];
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

        alert(`🎉 XUẤT BẢN THÀNH CÔNG!\n- Đã nạp chính thức: ${appState.draftData.length} câu hỏi vào Database.`);
        
        appState.draftData = [];
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
