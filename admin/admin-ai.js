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
const itemsPerPage = 10; // Hiển thị chuẩn 10 đề mỗi trang

// ==========================================
// 1. TẢI DỮ LIỆU ĐỀ THI AI TỪ FIRESTORE
// ==========================================
async function loadAiExams() {
    const tbody = document.getElementById('ai-exam-list-body');
    if (!tbody) return;

    // FIX UI: Tự động gỡ bỏ thanh cuộn (scrollbar) bị dính từ HTML cũ (max-height: 500px)
    const tableContainer = document.querySelector('#tab-admin .table-container');
    if (tableContainer) {
        // Ép buộc xóa giới hạn chiều cao để bung toàn bộ 10 phần tử ra trang
        tableContainer.style.cssText = 'max-height: none !important; overflow: visible !important;';
    }

    // Đổi tên Header của bảng thành "Tài khoản tạo đề"
    const thElements = document.querySelectorAll('#tab-admin thead th');
    if (thElements && thElements[2]) {
        thElements[2].innerText = "TÀI KHOẢN TẠO ĐỀ";
    }
    
    tbody.innerHTML = '<tr><td colspan="6" class="loading-text">⏳ Đang truy xuất dữ liệu đề AI từ hệ thống...</td></tr>';
    
    try {
        // Query các đề thi có technique là "AI Tự Động"
        const examsQuery = query(collection(db, "exams"), where("technique", "==", "AI Tự Động"));
        
        // Chạy song song: Lấy thông tin cấu hình đề và câu hỏi
        const [examsSnap, questionsSnap] = await Promise.all([
            getDocs(examsQuery),
            getDocs(collection(db, "questions")) 
        ]);
        
        // Cache lại toàn bộ câu hỏi
        const allQuestions = [];
        questionsSnap.forEach(doc => allQuestions.push(doc.data()));

        aiExamsData = [];
        
        examsSnap.forEach(docSnap => {
            const examData = docSnap.data();
            const examQuestions = allQuestions.filter(q => q.examId === docSnap.id);
            
            // 1. FIX LỖI NGÀY THÁNG (Ép kiểu chuỗi số mili-giây sang Date chuẩn)
            let formattedDate = 'Không rõ';
            let rawTimeSort = 0;
            const rawDate = examData.createdAt || examData.timestamp; 

            if (rawDate) {
                if (typeof rawDate.toDate === 'function') {
                    // Chuẩn Firebase Timestamp
                    formattedDate = rawDate.toDate().toLocaleString('vi-VN');
                    rawTimeSort = rawDate.toDate().getTime();
                } else {
                    // Nếu là chuỗi dãy số (VD: "1783618433169")
                    const numDate = Number(rawDate);
                    if (!isNaN(numDate) && numDate > 1000000000) { 
                        formattedDate = new Date(numDate).toLocaleString('vi-VN');
                        rawTimeSort = numDate;
                    } else {
                        // Chuỗi String thông thường
                        formattedDate = new Date(rawDate).toLocaleString('vi-VN');
                        rawTimeSort = new Date(rawDate).getTime();
                    }
                }
            }

            // 2. Lấy TÀI KHOẢN người tạo
            const creatorAccount = examData.creatorEmail || examData.email || examData.creator || 'Hệ thống AI';

            aiExamsData.push({
                id: docSnap.id,
                creator: creatorAccount, 
                createdAt: formattedDate,
                rawTime: rawTimeSort, 
                questionCount: examQuestions.length,
                questions: examQuestions, 
                ...examData
            });
        });
        
        // Sắp xếp đề thi mới nhất lên đầu (Dựa vào thời gian gốc rawTime)
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

    // Đảm bảo không có thanh cuộn mỗi khi render lại bảng
    const tableContainer = document.querySelector('#tab-admin .table-container');
    if (tableContainer) tableContainer.style.cssText = 'max-height: none !important; overflow: visible !important;';
    
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
    const pagedData = aiExamsData.slice(startIndex, endIndex); // Cắt chuẩn 10 phần tử
    
    let stt = startIndex + 1;

    // --- VẼ DỮ LIỆU ĐỀ THI LÊN TRANG HIỆN TẠI ---
    pagedData.forEach(exam => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td class="text-center">${stt++}</td>
            <td><strong>${exam.id}</strong></td>
            <td><div style="font-size: 13.5px; color: #0f172a; font-weight: 600;">${exam.creator}</div></td>
            <td class="text-center"><span class="badge-count" style="background:#eff6ff; color:#3b82f6;">${exam.questionCount} câu</span></td>
            <td class="text-center" style="font-size: 13px; color: #64748b;">${exam.createdAt}</td>
            <td class="text-center">
                <!-- 3. NÚT XUẤT EXCEL & NÚT XÓA RIÊNG BIỆT -->
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

    // Vẽ thanh điều hướng trang (Prev/Next)
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
        tableContainer.parentNode.insertBefore(paginationContainer, tableContainer.nextSibling);
    }

    paginationContainer.innerHTML = ''; // Xóa sạch để vẽ lại

    if (totalPages <= 1) return; // Nếu chỉ có 1 trang thì ẩn luôn

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

    // Thông tin "Trang X / Y"
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
        loadAiExams(); // Tải lại bảng sau khi xóa
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

// Hàm hỗ trợ format và tải Excel chung (dùng cho 1 đề hoặc tất cả đề)
function processAndDownloadExcel(examsArray, fileName) {
    const exportData = [];
    const mapCorrectText = ['A', 'B', 'C', 'D']; // Map Index (0,1,2,3) về A, B, C, D

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
    
    // Lắng nghe sự kiện click mở tab "Quản lý Đề AI" từ Sidebar
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

    // Lắng nghe các nút click bên trong bảng (Xóa, Xuất Excel lẻ)
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
