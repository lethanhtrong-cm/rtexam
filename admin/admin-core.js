import { db, showToast } from './admin-core.js';
import { 
    collection, getDocs, doc, deleteDoc, query, where 
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// Biến lưu trữ dữ liệu các đề AI
let aiExamsData = [];

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
        
        // Chạy song song: Lấy thông tin cấu hình đề (exams) và Lấy toàn bộ câu hỏi (questions) để đếm/xuất excel
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
            // Lọc ra các câu hỏi thuộc mã đề hiện tại
            const examQuestions = allQuestions.filter(q => q.examId === docSnap.id);
            
            // Xử lý ngày tháng an toàn
            let formattedDate = 'Không rõ';
            if (examData.createdAt && typeof examData.createdAt.toDate === 'function') {
                formattedDate = examData.createdAt.toDate().toLocaleString('vi-VN');
            } else if (examData.createdAt) {
                formattedDate = new Date(examData.createdAt).toLocaleString('vi-VN');
            }

            aiExamsData.push({
                id: docSnap.id,
                creator: examData.creatorEmail || examData.creator || 'Hệ thống AI', // Lấy thông tin người tạo AI
                createdAt: formattedDate,
                questionCount: examQuestions.length,
                questions: examQuestions, // Gắn kèm mảng câu hỏi để lát nữa Xuất Excel
                ...examData
            });
        });
        
        renderAiExamsTable();

    } catch (error) {
        console.error("Lỗi khi tải danh sách đề AI:", error);
        tbody.innerHTML = `<tr><td colspan="6" class="empty-message" style="color: red;">❌ Không thể tải dữ liệu: ${error.message}</td></tr>`;
    }
}

// ==========================================
// 2. RENDER BẢNG HIỂN THỊ
// ==========================================
function renderAiExamsTable() {
    const tbody = document.getElementById('ai-exam-list-body');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    
    if (aiExamsData.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="empty-message">Hiện chưa có đề thi nào được tạo bởi AI.</td></tr>';
        return;
    }
    
    let stt = 1;
    aiExamsData.forEach(exam => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td class="text-center">${stt++}</td>
            <td><strong>${exam.id}</strong></td>
            <td><div style="font-size: 13px; color: #475569; font-weight: 500;">${exam.creator}</div></td>
            <td class="text-center"><span class="badge-count" style="background:#eff6ff; color:#3b82f6;">${exam.questionCount} câu</span></td>
            <td class="text-center" style="font-size: 13px; color: #64748b;">${exam.createdAt}</td>
            <td class="text-center">
                <button class="btn-outline-sm btn-delete-modern btn-delete-ai" data-id="${exam.id}">
                    🗑️ Xóa Đề Này
                </button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

// ==========================================
// 3. XÓA ĐỀ AI
// ==========================================
async function deleteAiExam(examId, btnElement) {
    if (!confirm(`Bạn có chắc chắn muốn xóa vĩnh viễn đề AI "${examId}" và toàn bộ câu hỏi bên trong không?`)) return;

    const originalText = btnElement.innerHTML;
    btnElement.innerHTML = "⏳...";
    btnElement.disabled = true;

    try {
        // Tìm và xóa các câu hỏi thuộc mã đề này
        const q = query(collection(db, "questions"), where("examId", "==", examId));
        const querySnapshot = await getDocs(q);
        
        const deletePromises = querySnapshot.docs.map(docSnap => deleteDoc(doc(db, "questions", docSnap.id)));
        
        // Xóa document cấu hình trong collection exams
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
// 4. XUẤT EXCEL (SỬ DỤNG SHEETJS)
// ==========================================
function exportAiExamsToExcel() {
    if (aiExamsData.length === 0) {
        showToast("Chưa có dữ liệu đề AI để xuất ra Excel!", "error");
        return;
    }

    showToast("Đang chuẩn bị file Excel, vui lòng đợi...", "success");
    
    const exportData = [];
    const mapCorrectText = ['A', 'B', 'C', 'D']; // Map Index (0,1,2,3) về định dạng Text

    aiExamsData.forEach(exam => {
        if (exam.questions && exam.questions.length > 0) {
            exam.questions.forEach(q => {
                // Format lại object dữ liệu xuất ra Excel sao cho khớp với template nhập liệu chuẩn
                exportData.push({
                    "Mã đề": q.examId || exam.id,
                    "Câu hỏi": q.text || "",
                    "Đáp án A": q.options ? (q.options[0] || "") : "",
                    "Đáp án B": q.options ? (q.options[1] || "") : "",
                    "Đáp án C": q.options ? (q.options[2] || "") : "",
                    "Đáp án D": q.options ? (q.options[3] || "") : "",
                    "Đáp án đúng": mapCorrectText[q.correctAnswer] || "",
                    "Giải thích đáp án": q.explanation || "",
                    "Người tạo (Hệ thống AI)": exam.creator || ""
                });
            });
        }
    });

    if (exportData.length === 0) {
        showToast("Các đề AI hiện đang rỗng (không chứa câu hỏi nào).", "error");
        return;
    }

    try {
        // Tạo Sheet từ mảng JSON
        const ws = XLSX.utils.json_to_sheet(exportData);
        
        // Tùy chỉnh độ rộng các cột (Tính bằng ký tự) cho file Excel đẹp hơn
        ws['!cols'] = [
            {wch: 15}, // Mã đề
            {wch: 50}, // Câu hỏi
            {wch: 20}, {wch: 20}, {wch: 20}, {wch: 20}, // Đáp án A B C D
            {wch: 15}, // Đáp án đúng
            {wch: 40}, // Giải thích
            {wch: 30}  // Người tạo
        ];

        // Tạo Workbook và gắn Sheet vào
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "NganHangDeAI");

        // Kích hoạt tải file xuống trình duyệt
        XLSX.writeFile(wb, "Ngan_Hang_De_AI.xlsx");
        
        showToast("Tải file Excel thành công!", "success");
    } catch (error) {
        console.error("Lỗi xuất Excel:", error);
        showToast("Có lỗi xảy ra khi tạo file Excel.", "error");
    }
}

// ==========================================
// 5. KHỞI TẠO VÀ LẮNG NGHE SỰ KIỆN
// ==========================================
document.addEventListener('componentsLoaded', () => {
    
    // Lắng nghe sự kiện click mở tab "Quản lý Đề AI" từ Sidebar
    // (Load lười - Lazy Load: Chỉ tải khi Admin click vào tab này để tiết kiệm chi phí đọc Database)
    const sidebarMenuItems = document.querySelectorAll('.menu-item');
    sidebarMenuItems.forEach(item => {
        item.addEventListener('click', () => {
            const target = item.getAttribute('data-target');
            if (target === 'tab-admin') {
                loadAiExams();
            }
        });
    });

    // Lắng nghe nút Xuất Excel
    const btnExport = document.getElementById('btnExportAiExams');
    if (btnExport) {
        btnExport.addEventListener('click', exportAiExamsToExcel);
    }

    // Sử dụng kỹ thuật Event Delegation (Ủy quyền sự kiện) cho các nút Xóa nằm bên trong bảng sinh động
    const tbody = document.getElementById('ai-exam-list-body');
    if (tbody) {
        tbody.addEventListener('click', (e) => {
            const deleteBtn = e.target.closest('.btn-delete-ai');
            if (deleteBtn) {
                const examId = deleteBtn.getAttribute('data-id');
                deleteAiExam(examId, deleteBtn);
            }
        });
    }
});
