import { db, showToast } from './admin-core.js';
import { 
    collection, getDocs, doc, deleteDoc, query, where 
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// Biến lưu trữ dữ liệu các đề AI
let aiExamsData = [];

// ==========================================
// CẤU HÌNH PHÂN TRANG (PAGINATION)
// ==========================================
let currentPage = 1;
const itemsPerPage = 10;

// ==========================================
// 1. TẢI DỮ LIỆU ĐỀ THI AI TỪ FIRESTORE
// ==========================================
async function loadAiExams() {
    const tbody = document.getElementById('ai-exam-list-body');
    if (!tbody) return;
    
    tbody.innerHTML = '<tr><td colspan="6" class="loading-text">⏳ Đang truy xuất dữ liệu đề AI từ hệ thống...</td></tr>';
    
    try {
        // Query các đề thi có technique là "AI Tự Động"
        const examsQuery = query(collection(db, "exams"), where("technique", "==", "AI Tự Động"));
        
        // Chạy song song: Lấy thông tin cấu hình đề (exams) và Lấy toàn bộ câu hỏi (questions)
        const [examsSnap, questionsSnap] = await Promise.all([
            getDocs(examsQuery),
            getDocs(collection(db, "questions")) 
        ]);
        
        // Cache lại toàn bộ câu hỏi để xử lý nội bộ
        const allQuestions = [];
        questionsSnap.forEach(doc => allQuestions.push(doc.data()));

        aiExamsData = [];
        
        examsSnap.forEach(docSnap => {
            const examData = docSnap.data();
            const examQuestions = allQuestions.filter(q => q.examId === docSnap.id);
            
            // Xử lý ngày tháng an toàn (Fix lỗi hiển thị dãy số Timestamp)
            let formattedDate = 'Không rõ';
            const rawDate = examData.createdAt || examData.timestamp; 

            if (rawDate) {
                if (typeof rawDate.toDate === 'function') {
                    // Định dạng Firebase Timestamp object
                    formattedDate = rawDate.toDate().toLocaleString('vi-VN');
                } else if (!isNaN(Number(rawDate))) {
                    // Định dạng dãy số ms (ví dụ: 1783618433169)
                    formattedDate = new Date(Number(rawDate)).toLocaleString('vi-VN');
                } else {
                    // Định dạng chuỗi ngày tháng thông thường
                    formattedDate = new Date(rawDate).toLocaleString('vi-VN');
                }
            }

            // Lấy email người tạo (Tài khoản tạo đề)
            const creatorAccount = examData.creatorEmail || examData.email || examData.creator || 'Hệ thống AI';

            aiExamsData.push({
                id: docSnap.id,
                creator: creatorAccount, 
                createdAt: formattedDate,
                rawTime: Number(rawDate) || 0, // Lưu lại thời gian gốc để sắp xếp
                questionCount: examQuestions.length,
                questions: examQuestions, 
                ...examData
            });
        });
        
        // Sắp xếp đề thi mới nhất lên đầu
        aiExamsData.sort((a, b) => b.rawTime - a.rawTime);

        // Reset về trang 1 mỗi khi load lại dữ liệu
        currentPage = 1;
        renderAiExamsTable();

    } catch (error) {
        console.error("Lỗi khi tải danh sách đề AI:", error);
        tbody.innerHTML = `<tr><td colspan="6" class="empty-message" style="color: red;">❌ Không thể tải dữ liệu: ${error.message}</td></tr>`;
    }
}

// ==========================================
// 2. RENDER BẢNG HIỂN THỊ (CÓ PHÂN TRANG)
// ==========================================
function renderAiExamsTable() {
    const tbody = document.getElementById('ai-exam-list-body');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    
    if (aiExamsData.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="empty-message">Hiện chưa có đề thi nào được tạo bởi AI.</td></tr>';
        renderPagination(0);
        return;
    }
    
    // --- XỬ LÝ LOGIC PHÂN TRANG ---
    const totalItems = aiExamsData.length;
    const totalPages = Math.ceil(totalItems / itemsPerPage);
    
    if (currentPage < 1) currentPage = 1;
    if (currentPage > totalPages) currentPage = totalPages;
    
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const pagedData = aiExamsData.slice(startIndex, endIndex);
    
    let stt = startIndex + 1;

    // --- VẼ DỮ LIỆU CỦA TRANG HIỆN TẠI ---
    pagedData.forEach(exam => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td class="text-center">${stt++}</td>
            <td><strong>${exam.id}</strong></td>
            <td><div style="font-size: 13.5px; color: #0f172a; font-weight: 600;">${exam.creator}</div></td>
            <td class="text-center"><span class="badge-count" style="background:#eff6ff; color:#3b82f6;">${exam.questionCount} câu</span></td>
            <td class="text-center" style="font-size: 13px; color: #64748b;">${exam.createdAt}</td>
            <td class="text-center">
                <div style="display: flex; gap: 6px; justify-content: center; flex-wrap: nowrap;">
                    <button class="btn-outline-sm btn-export-ai-single" data-id="${exam.id}" style="color: #10b981; border-color: #a7f3d0;">
                        📥 Xuất Excel
                    </button>
                    <button class="btn-outline-sm btn-delete-modern btn-delete-ai" data-id="${exam.id}">
                        🗑️ Xóa Đề
                    </button>
                </div>
            </td>
        `;
        tbody.appendChild(tr);
    });

    // Vẽ thanh điều hướng trang
    renderPagination(totalPages);
}

// ==========================================
// 3. VẼ THANH ĐIỀU HƯỚNG PHÂN TRANG
// ==========================================
function renderPagination(totalPages) {
    let paginationContainer = document.getElementById('ai-pagination-container');
    
    // Tạo vùng chứa phân trang nếu chưa có
    if (!paginationContainer) {
        const tableContainer = document.querySelector('#tab-admin .table-container');
        paginationContainer = document.createElement('div');
        paginationContainer.id = 'ai-pagination-container';
        paginationContainer.style.cssText = 'display: flex; justify-content: center; align-items: center; gap: 10px; margin-top: 20px; padding-bottom: 10px;';
        // Chèn ngay bên dưới cái bảng
        tableContainer.parentNode.insertBefore(paginationContainer, tableContainer.nextSibling);
    }

    paginationContainer.innerHTML = ''; // Xóa nút cũ

    if (totalPages <= 1) return; // Ẩn phân trang nếu chỉ có 1 trang

    // Nút "Trang Trước"
    const prevBtn = document.createElement('button');
    prevBtn.innerHTML = '◀ Trước';
    prevBtn.className = 'btn-outline-sm';
    prevBtn.disabled = currentPage === 1;
    if (currentPage === 1) prevBtn.style.opacity = '0.5';
    prevBtn.onclick = () => {
        if (currentPage > 1) {
            currentPage--;
            renderAiExamsTable();
        }
    };
    paginationContainer.appendChild(prevBtn);

    // Hiển thị Số Trang
    const pageInfo = document.createElement('span');
    pageInfo.innerText = `Trang ${currentPage} / ${totalPages}`;
    pageInfo.style.cssText = 'font-size: 14px; font-weight: 600; color: #475569; margin: 0 10px;';
    paginationContainer.appendChild(pageInfo);

    // Nút "Trang Tiếp"
    const nextBtn = document.createElement('button');
    nextBtn.innerHTML = 'Tiếp ▶';
    nextBtn.className = 'btn-outline-sm';
    nextBtn.disabled = currentPage === totalPages;
    if (currentPage === totalPages) nextBtn.style.opacity = '0.5';
    nextBtn.onclick = () => {
        if (currentPage < totalPages) {
            currentPage++;
            renderAiExamsTable();
        }
    };
    paginationContainer.appendChild(nextBtn);
}

// ==========================================
// 4. XÓA ĐỀ AI
// ==========================================
async function deleteAiExam(examId, btnElement) {
    if (!confirm(`Bạn có chắc chắn muốn xóa vĩnh viễn đề AI "${examId}" và toàn bộ câu hỏi bên trong không?`)) return;

    const originalText = btnElement.innerHTML;
    btnElement.innerHTML = "⏳...";
    btnElement.disabled = true;

    try {
        const q = query(collection(db, "questions"), where("examId", "==", examId));
        const querySnapshot = await getDocs(q);
        
        const deletePromises = querySnapshot.docs.map(docSnap => deleteDoc(doc(db, "questions", docSnap.id)));
        deletePromises.push(deleteDoc(doc(db, "exams", examId)));
        
        await Promise.all(deletePromises);

        showToast(`Đã xóa thành công đề "${examId}"!`, "success");
        loadAiExams(); // Tải lại bảng để cập nhật giao diện
    } catch (error) {
        console.error("Lỗi khi xóa đề AI:", error);
        showToast("Lỗi hệ thống khi xóa dữ liệu", "error");
        btnElement.innerHTML = originalText;
        btnElement.disabled = false;
    }
}

// ==========================================
// 5. XUẤT EXCEL 1 ĐỀ CỤ THỂ
// ==========================================
function exportSingleAiExam(examId) {
    const exam = aiExamsData.find(e => e.id === examId);
    if (!exam || !exam.questions || exam.questions.length === 0) {
        showToast("Đề này hiện không có câu hỏi nào để xuất!", "error");
        return;
    }

    showToast(`Đang chuẩn bị file Excel cho đề ${examId}...`, "success");
    processAndDownloadExcel([exam], `De_AI_${examId}`);
}

// ==========================================
// 6. XUẤT EXCEL TẤT CẢ CÁC ĐỀ AI
// ==========================================
function exportAllAiExamsToExcel() {
    if (aiExamsData.length === 0) {
        showToast("Chưa có dữ liệu đề AI để xuất ra Excel!", "error");
        return;
    }
    showToast("Đang gom toàn bộ đề và chuẩn bị file Excel...", "success");
    processAndDownloadExcel(aiExamsData, "Ngan_Hang_Tong_Hop_De_AI");
}

// Hàm hỗ trợ format và tạo file Excel dùng chung cho Cả 2 nút Xuất
function processAndDownloadExcel(examsArray, fileName) {
    const exportData = [];
    const mapCorrectText = ['A', 'B', 'C', 'D']; // Map Index (0,1,2,3) về định dạng Text

    examsArray.forEach(exam => {
        if (exam.questions && exam.questions.length > 0) {
            exam.questions.forEach(q => {
                exportData.push({
                    "Mã đề": q.examId || exam.id,
                    "Câu hỏi": q.text || "",
                    "Đáp án A": q.options ? (q.options[0] || "") : "",
                    "Đáp án B": q.options ? (q.options[1] || "") : "",
                    "Đáp án C": q.options ? (q.options[2] || "") : "",
                    "Đáp án D": q.options ? (q.options[3] || "") : "",
                    "Đáp án đúng": mapCorrectText[q.correctAnswer] || "",
                    "Giải thích đáp án": q.explanation || "",
                    "Tài khoản tạo đề": exam.creator || ""
                });
            });
        }
    });

    if (exportData.length === 0) {
        showToast("Không tìm thấy dữ liệu câu hỏi hợp lệ.", "error");
        return;
    }

    try {
        const ws = XLSX.utils.json_to_sheet(exportData);
        ws['!cols'] = [
            {wch: 15}, {wch: 50}, {wch: 20}, {wch: 20}, {wch: 20}, {wch: 20},
            {wch: 15}, {wch: 40}, {wch: 30}
        ];
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "DanhSachDeAI");
        XLSX.writeFile(wb, `${fileName}.xlsx`);
        showToast("Tải file Excel thành công!", "success");
    } catch (error) {
        console.error("Lỗi xuất Excel:", error);
        showToast("Có lỗi xảy ra khi tạo file Excel.", "error");
    }
}

// ==========================================
// 7. KHỞI TẠO VÀ LẮNG NGHE SỰ KIỆN
// ==========================================
document.addEventListener('componentsLoaded', () => {
    
    // Load lười: Chỉ truy vấn Firestore khi Admin bấm vào Tab
    const sidebarMenuItems = document.querySelectorAll('.menu-item');
    sidebarMenuItems.forEach(item => {
        item.addEventListener('click', () => {
            const target = item.getAttribute('data-target');
            if (target === 'tab-admin') {
                loadAiExams();
            }
        });
    });

    // Lắng nghe nút "Xuất Toàn Bộ Ra Excel"
    const btnExport = document.getElementById('btnExportAiExams');
    if (btnExport) {
        btnExport.addEventListener('click', exportAllAiExamsToExcel);
    }

    // Kỹ thuật Event Delegation cho các nút "Xuất Excel Riêng Lẻ" và "Xóa" bên trong bảng
    const tbody = document.getElementById('ai-exam-list-body');
    if (tbody) {
        tbody.addEventListener('click', (e) => {
            // Nút xóa đề
            const deleteBtn = e.target.closest('.btn-delete-ai');
            if (deleteBtn) {
                const examId = deleteBtn.getAttribute('data-id');
                deleteAiExam(examId, deleteBtn);
            }
            
            // Nút xuất Excel từng đề riêng lẻ
            const exportBtn = e.target.closest('.btn-export-ai-single');
            if (exportBtn) {
                const examId = exportBtn.getAttribute('data-id');
                exportSingleAiExam(examId);
            }
        });
    }
});
