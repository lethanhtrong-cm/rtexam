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

    // FIX UI: Triệt tiêu hoàn toàn thanh cuộn (scrollbar) từ thẻ HTML
    const tableContainer = document.querySelector('#tab-admin .table-container');
    if (tableContainer) {
        tableContainer.style.maxHeight = 'none';
        tableContainer.style.overflowY = 'visible';
    }

    // Đổi tên Header của bảng thành "Tài khoản tạo đề"
    const thElements = document.querySelectorAll('#tab-admin thead th');
    if (thElements && thElements[2]) {
        thElements[2].innerText = "TÀI KHOẢN TẠO ĐỀ";
    }

    // Tự động nâng cấp UI nút "Xuất Toàn Bộ Ra Excel" bằng JS để không phải sửa file HTML
    const btnExportAll = document.getElementById('btnExportAiExams');
    if (btnExportAll) {
        btnExportAll.innerHTML = '<i class="fa-solid fa-file-export"></i> Xuất Toàn Bộ Ra Excel';
        btnExportAll.style.cssText = 'background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; border: none; padding: 10px 20px; border-radius: 8px; font-weight: 600; font-size: 0.9rem; box-shadow: 0 4px 10px rgba(16, 185, 129, 0.3); cursor: pointer; transition: all 0.2s; display: flex; align-items: center; gap: 8px;';
        btnExportAll.onmouseover = () => btnExportAll.style.transform = 'translateY(-2px)';
        btnExportAll.onmouseout = () => btnExportAll.style.transform = 'translateY(0)';
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
            
            // FIX LỖI NGÀY THÁNG
            let formattedDate = 'Không rõ';
            let rawTimeSort = 0;
            const rawDate = examData.createdAt || examData.timestamp; 

            if (rawDate) {
                if (typeof rawDate.toDate === 'function') {
                    formattedDate = rawDate.toDate().toLocaleString('vi-VN');
                    rawTimeSort = rawDate.toDate().getTime();
                } else {
                    const numDate = Number(rawDate);
                    if (!isNaN(numDate) && numDate > 100000000) { 
                        let finalMs = numDate > 1000000000000 ? numDate : numDate * 1000;
                        formattedDate = new Date(finalMs).toLocaleString('vi-VN');
                        rawTimeSort = finalMs;
                    } else {
                        formattedDate = new Date(rawDate).toLocaleString('vi-VN');
                        rawTimeSort = new Date(rawDate).getTime();
                    }
                }
            }

            // Lấy TÀI KHOẢN người tạo
            const creatorAccount = examData.creatorEmail || examData.userEmail || examData.email || examData.userId || examData.creator || 'Hệ thống AI';

            aiExamsData.push({
                ...examData,
                id: docSnap.id,
                displayCreator: creatorAccount, 
                displayDate: formattedDate,
                rawTime: rawTimeSort, 
                questionCount: examQuestions.length,
                questions: examQuestions 
            });
        });
        
        // Sắp xếp đề thi mới nhất lên đầu
        aiExamsData.sort((a, b) => b.rawTime - a.rawTime);

        // Reset về trang 1
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

    // Đảm bảo triệt tiêu thanh cuộn
    const tableContainer = document.querySelector('#tab-admin .table-container');
    if (tableContainer) {
        tableContainer.style.maxHeight = 'none';
        tableContainer.style.overflowY = 'visible';
    }
    
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

    // --- VẼ DỮ LIỆU ĐỀ THI VỚI UI HIỆN ĐẠI ---
    pagedData.forEach(exam => {
        const tr = document.createElement('tr');
        tr.style.transition = "all 0.2s ease";

        // Giao diện Badge Tài khoản Tạo đề
        const isAI = exam.displayCreator === 'Hệ thống AI';
        const creatorBadge = isAI 
            ? `<span style="background: #f3e8ff; color: #7e22ce; padding: 5px 12px; border-radius: 20px; font-size: 0.8rem; font-weight: 700; border: 1px solid #e9d5ff; display: inline-flex; align-items: center; gap: 6px;"><i class="fa-solid fa-robot"></i> Hệ thống AI</span>`
            : `<span style="background: #e0f2fe; color: #0369a1; padding: 5px 12px; border-radius: 20px; font-size: 0.8rem; font-weight: 700; border: 1px solid #bae6fd; display: inline-flex; align-items: center; gap: 6px;"><i class="fa-regular fa-user"></i> ${exam.displayCreator}</span>`;

        // --- TÍNH TOÁN VÀ HIỂN THỊ CHI PHÍ VỐN CHO TỪNG ĐỀ ---
        const tokenUsed = exam.tokenUsed || 0;
        const costVND = Math.round((tokenUsed / 1000000) * 42638);
        const costBadgeHtml = tokenUsed > 0 
            ? `<div style="font-size: 11px; color: #b45309; font-weight: 700; margin-top: 4px; display: inline-block; background: #fef3c7; padding: 3px 8px; border-radius: 6px; border: 1px solid #fde68a;"><i class="fa-solid fa-coins"></i> Vốn: ${costVND.toLocaleString('vi-VN')} đ</div>` 
            : '';

        tr.innerHTML = `
            <td class="text-center"><span style="font-weight: 700; color: #64748b;">${stt++}</span></td>
            <td>
                <div style="display: flex; flex-direction: column; align-items: flex-start; gap: 4px;">
                    <span style="background: #f8fafc; color: #0f172a; padding: 6px 12px; border-radius: 8px; font-family: 'Courier New', Courier, monospace; font-weight: 700; font-size: 0.9rem; border: 1px solid #e2e8f0; box-shadow: 0 1px 2px rgba(0,0,0,0.02);">
                        <i class="fa-solid fa-barcode" style="color: #94a3b8; margin-right: 6px;"></i>${exam.id}
                    </span>
                    ${costBadgeHtml}
                </div>
            </td>
            <td>${creatorBadge}</td>
            <td class="text-center">
                <span style="background: #f0fdf4; color: #15803d; padding: 5px 12px; border-radius: 20px; font-size: 0.85rem; font-weight: 700; border: 1px solid #bbf7d0; display: inline-flex; align-items: center; gap: 5px;">
                    <i class="fa-solid fa-layer-group"></i> ${exam.questionCount} câu
                </span>
            </td>
            <td class="text-center">
                <div style="color: #475569; font-size: 0.85rem; font-weight: 600; display: flex; align-items: center; justify-content: center; gap: 6px;">
                    <i class="fa-regular fa-calendar-days"></i> ${exam.displayDate}
                </div>
            </td>
            <td class="text-center">
                <div style="display: flex; gap: 8px; justify-content: center; flex-wrap: nowrap;">
                    <button class="btn-modern-action btn-export-ai-single" data-id="${exam.id}" style="padding: 6px 12px; font-size: 0.8rem; background-color: #f0fdfa; color: #059669; border-color: #a7f3d0;" title="Xuất Excel">
                        <i class="fa-solid fa-file-excel"></i> Xuất
                    </button>
                    <button class="btn-modern-action btn-delete-danger btn-delete-ai" data-id="${exam.id}" style="padding: 6px 12px; font-size: 0.8rem;" title="Xóa Đề">
                        <i class="fa-solid fa-trash-can"></i> Xóa
                    </button>
                </div>
            </td>
        `;
        tbody.appendChild(tr);
    });

    renderPagination(totalPages);
}

// ==========================================
// 3. VẼ THANH ĐIỀU HƯỚNG PHÂN TRANG (MỚI)
// ==========================================
function renderPagination(totalPages) {
    let paginationContainer = document.getElementById('ai-pagination-container');
    
    if (!paginationContainer) {
        const tableContainer = document.querySelector('#tab-admin .table-container');
        paginationContainer = document.createElement('div');
        paginationContainer.id = 'ai-pagination-container';
        paginationContainer.style.cssText = 'display: flex; justify-content: center; align-items: center; gap: 10px; margin-top: 20px; padding-bottom: 10px;';
        tableContainer.parentNode.insertBefore(paginationContainer, tableContainer.nextSibling);
    }

    paginationContainer.innerHTML = ''; 

    if (totalPages <= 1) return; 

    // Nút "Trang Trước"
    const prevBtn = document.createElement('button');
    prevBtn.innerHTML = '<i class="fa-solid fa-arrow-left"></i> Trước';
    prevBtn.className = 'btn-modern-action';
    prevBtn.style.padding = '8px 16px';
    prevBtn.disabled = currentPage === 1;
    if (currentPage === 1) prevBtn.style.opacity = '0.4';
    prevBtn.onclick = () => {
        if (currentPage > 1) {
            currentPage--;
            renderAiExamsTable();
        }
    };
    paginationContainer.appendChild(prevBtn);

    // Thông tin "Trang X / Y"
    const pageInfo = document.createElement('div');
    pageInfo.innerHTML = `Trang <strong style="color:#3b82f6;">${currentPage}</strong> / ${totalPages}`;
    pageInfo.style.cssText = 'font-size: 14px; font-weight: 600; color: #475569; background: #f8fafc; padding: 8px 20px; border-radius: 10px; border: 1px solid #e2e8f0; margin: 0 5px; box-shadow: 0 1px 2px rgba(0,0,0,0.02);';
    paginationContainer.appendChild(pageInfo);

    // Nút "Trang Tiếp"
    const nextBtn = document.createElement('button');
    nextBtn.innerHTML = 'Tiếp <i class="fa-solid fa-arrow-right"></i>';
    nextBtn.className = 'btn-modern-action';
    nextBtn.style.padding = '8px 16px';
    nextBtn.disabled = currentPage === totalPages;
    if (currentPage === totalPages) nextBtn.style.opacity = '0.4';
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
    btnElement.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
    btnElement.disabled = true;

    try {
        const q = query(collection(db, "questions"), where("examId", "==", examId));
        const querySnapshot = await getDocs(q);
        
        const deletePromises = querySnapshot.docs.map(docSnap => deleteDoc(doc(db, "questions", docSnap.id)));
        deletePromises.push(deleteDoc(doc(db, "exams", examId)));
        
        await Promise.all(deletePromises);

        showToast(`Đã xóa thành công đề "${examId}"!`, "success");
        loadAiExams(); 
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
                    "Tài khoản tạo đề": exam.displayCreator || ""
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
