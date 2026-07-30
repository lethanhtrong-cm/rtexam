import { db, showToast } from './admin-core.js';
import { 
    collection, getDocs, doc, deleteDoc, updateDoc, query, where 
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// Biến lưu trữ dữ liệu các đề AI
let aiExamsData = [];

// ==========================================
// CẤU HÌNH PHÂN TRANG (PAGINATION)
// ==========================================
let currentPage = 1;
const itemsPerPage = 10; // Hiển thị chuẩn 10 đề mỗi trang

// ==========================================
// HÀM TIÊM CSS TỐI ƯU GIAO DIỆN MOBILE
// ==========================================
function injectAiMobileStyle() {
    if (!document.getElementById('mobile-ai-style')) {
        const style = document.createElement('style');
        style.id = 'mobile-ai-style';
        style.innerHTML = `
            @media (max-width: 768px) {
                /* Bẻ bảng thành dạng Card */
                #tab-admin .admin-table { min-width: 100% !important; display: block; border: none; }
                #tab-admin .admin-table thead { display: none; }
                #tab-admin .admin-table tbody { display: block; width: 100%; }
                
                #ai-exam-list-body tr {
                    display: flex !important;
                    flex-direction: column;
                    background: #fff;
                    border: 1px solid #cbd5e1;
                    border-radius: 12px;
                    margin-bottom: 15px;
                    padding: 12px 15px;
                    box-shadow: 0 2px 4px rgba(0,0,0,0.02);
                }
                
                /* Hiển thị Tên cột thông qua pseudo-element */
                #ai-exam-list-body td { 
                    display: flex; 
                    justify-content: space-between; 
                    align-items: center; 
                    border: none !important; 
                    padding: 8px 0 !important; 
                    text-align: right !important; 
                }
                
                #ai-exam-list-body td::before {
                    content: attr(data-label);
                    font-weight: 700;
                    color: #64748b;
                    font-size: 0.8rem;
                    text-align: left;
                    flex-shrink: 0;
                    margin-right: 15px;
                }
                
                /* Tối ưu thanh hành động (Nút bấm) thành Grid dưới đáy */
                #ai-exam-list-body td:last-child {
                    flex-direction: column;
                    margin-top: 10px;
                    padding-top: 15px !important;
                    border-top: 1px dashed #cbd5e1 !important;
                }
                #ai-exam-list-body td:last-child::before { display: none; }
                
                #ai-exam-list-body td:last-child > div {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 8px;
                    width: 100%;
                }
                
                #ai-exam-list-body td:last-child button {
                    flex: 1;
                    min-width: 45%;
                    justify-content: center;
                    padding: 10px !important;
                    font-size: 13px !important;
                }
            }
        `;
        document.head.appendChild(style);
    }
}

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
    // Tiêm CSS giao diện Mobile trước khi Render
    injectAiMobileStyle();

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

    // --- VẼ DỮ LIỆU ĐỀ THI VỚI UI HIỆN ĐẠI & DATA-LABEL CHO MOBILE ---
    pagedData.forEach(exam => {
        const tr = document.createElement('tr');
        tr.style.transition = "all 0.2s ease";

        // Giao diện Badge Tài khoản Tạo đề
        const isAI = exam.displayCreator === 'Hệ thống AI';
        const creatorBadge = isAI 
            ? `<span style="background: #f3e8ff; color: #7e22ce; padding: 5px 12px; border-radius: 20px; font-size: 0.8rem; font-weight: 700; border: 1px solid #e9d5ff; display: inline-flex; align-items: center; gap: 6px;"><i class="fa-solid fa-robot"></i> Hệ thống AI</span>`
            : `<span style="background: #e0f2fe; color: #0369a1; padding: 5px 12px; border-radius: 20px; font-size: 0.8rem; font-weight: 700; border: 1px solid #bae6fd; display: inline-flex; align-items: center; gap: 6px;"><i class="fa-regular fa-user"></i> ${exam.displayCreator}</span>`;

        tr.innerHTML = `
            <td class="text-center" data-label="STT"><span style="font-weight: 700; color: #64748b;">${stt++}</span></td>
            <td data-label="MÃ ĐỀ">
                <div style="display: flex; align-items: center;">
                    <span style="background: #f8fafc; color: #0f172a; padding: 6px 12px; border-radius: 8px; font-family: 'Courier New', Courier, monospace; font-weight: 700; font-size: 0.9rem; border: 1px solid #e2e8f0; box-shadow: 0 1px 2px rgba(0,0,0,0.02);">
                        <i class="fa-solid fa-barcode" style="color: #94a3b8; margin-right: 6px;"></i>${exam.id}
                    </span>
                </div>
            </td>
            <td data-label="NGƯỜI TẠO">${creatorBadge}</td>
            <td class="text-center" data-label="SỐ CÂU">
                <span style="background: #f0fdf4; color: #15803d; padding: 5px 12px; border-radius: 20px; font-size: 0.85rem; font-weight: 700; border: 1px solid #bbf7d0; display: inline-flex; align-items: center; gap: 5px;">
                    <i class="fa-solid fa-layer-group"></i> ${exam.questionCount} câu
                </span>
            </td>
            <td class="text-center" data-label="NGÀY TẠO">
                <div style="color: #475569; font-size: 0.85rem; font-weight: 600; display: flex; align-items: center; justify-content: center; gap: 6px;">
                    <i class="fa-regular fa-calendar-days"></i> ${exam.displayDate}
                </div>
            </td>
            <td class="text-center">
                <div style="display: flex; gap: 8px; justify-content: center; flex-wrap: nowrap;">
                    <!-- THÊM MỚI NÚT SỬA NỘI DUNG -->
                    <button class="btn-modern-action btn-edit-ai" data-id="${exam.id}" style="padding: 6px 12px; font-size: 0.8rem; background-color: #fef3c7; color: #d97706; border-color: #fde68a;" title="Sửa Nội Dung">
                        <i class="fa-solid fa-pen-to-square"></i> Sửa
                    </button>
                    <button class="btn-modern-action btn-convert-ai" data-id="${exam.id}" style="padding: 6px 12px; font-size: 0.8rem; background-color: #eff6ff; color: #2563eb; border-color: #bfdbfe;" title="Chuyển thành đề Admin">
                        <i class="fa-solid fa-arrow-right-arrow-left"></i> Chuyển
                    </button>
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
// 3. VẼ THANH ĐIỀU HƯỚNG PHÂN TRANG
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
// 4. CHUYỂN ĐỔI ĐỀ AI THÀNH ĐỀ ADMIN
// ==========================================
function openConvertAiModal(examId) {
    // Xóa modal cũ nếu có
    const oldModal = document.getElementById('convert-ai-modal');
    if (oldModal) oldModal.remove();

    const modalHtml = `
        <div id="convert-ai-modal" style="display: flex; position: fixed; z-index: 2000; left: 0; top: 0; width: 100%; height: 100%; background-color: rgba(15, 23, 42, 0.6); backdrop-filter: blur(2px); justify-content: center; align-items: center;">
            <div style="background-color: #fff; padding: 25px; border-radius: 12px; width: 90%; max-width: 450px; box-shadow: 0 10px 25px rgba(0,0,0,0.2);">
                <div style="display:flex; justify-content: space-between; align-items:center; margin-bottom: 20px; border-bottom: 1px solid #e2e8f0; padding-bottom: 10px;">
                    <h3 style="margin:0; color: #1e293b; font-size: 1.1rem;"><i class="fa-solid fa-arrow-right-arrow-left" style="color: #3b82f6;"></i> Chuyển đổi thành Đề Chính Thức</h3>
                </div>
                
                <p style="font-size: 14px; color: #475569; margin-bottom: 20px;">Bạn đang thao tác với mã đề: <strong style="color:#2563eb;">${examId}</strong></p>

                <label style="display:block; font-weight:600; margin-bottom:8px; font-size:14px; color:#334155;">Chuyên khoa đích:</label>
                <select id="convert-tech" style="width:100%; padding:10px; margin-bottom:15px; border-radius:8px; border:1px solid #cbd5e1; outline:none; font-family:inherit;">
                    <option value="MRI">MRI</option>
                    <option value="CT">CT</option>
                    <option value="X quang">X quang</option>
                    <option value="Hỗn hợp">Hỗn hợp</option>
                </select>

                <label style="display:block; font-weight:600; margin-bottom:8px; font-size:14px; color:#334155;">Mức độ khó:</label>
                <select id="convert-level" style="width:100%; padding:10px; margin-bottom:15px; border-radius:8px; border:1px solid #cbd5e1; outline:none; font-family:inherit;">
                    <option value="Dễ">Dễ</option>
                    <option value="Trung bình" selected>Trung bình</option>
                    <option value="Khó">Khó</option>
                </select>

                <label style="display:block; font-weight:600; margin-bottom:8px; font-size:14px; color:#334155;">Thời gian làm bài:</label>
                <select id="convert-time" style="width:100%; padding:10px; margin-bottom:25px; border-radius:8px; border:1px solid #cbd5e1; outline:none; font-family:inherit;">
                    <option value="15">15 phút</option>
                    <option value="30">30 phút</option>
                    <option value="45">45 phút</option>
                </select>

                <div style="display:flex; justify-content:flex-end; gap:12px;">
                    <button id="btn-cancel-convert" style="padding:10px 20px; border:none; border-radius:8px; background:#e2e8f0; color:#475569; cursor:pointer; font-weight:bold; transition:0.2s;">Hủy Bỏ</button>
                    <button id="btn-confirm-convert" style="padding:10px 20px; border:none; border-radius:8px; background:#3b82f6; color:white; cursor:pointer; font-weight:bold; transition:0.2s; box-shadow:0 4px 6px rgba(59,130,246,0.2);">Xác Nhận Chuyển</button>
                </div>
            </div>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalHtml);

    document.getElementById('btn-cancel-convert').onclick = () => {
        document.getElementById('convert-ai-modal').remove();
    };

    document.getElementById('btn-confirm-convert').onclick = async () => {
        const tech = document.getElementById('convert-tech').value;
        const level = document.getElementById('convert-level').value;
        const time = parseInt(document.getElementById('convert-time').value, 10);
        const btn = document.getElementById('btn-confirm-convert');

        btn.disabled = true;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Đang xử lý...';

        try {
            const examRef = doc(db, "exams", examId);
            await updateDoc(examRef, {
                technique: tech,
                level: level,
                timeLimit: time,
                creatorEmail: "Admin", // Đánh dấu lại người sở hữu
                creator: "Admin",
                isPublic: true // Đảm bảo đề hiển thị công khai như mọi đề Admin khác
            });
            
            showToast(`Tuyệt vời! Đề "${examId}" đã được chuyển sang tab quản lý ${tech}.`, "success");
            document.getElementById('convert-ai-modal').remove();
            
            // Reload lại danh sách (đề này sẽ tự động biến mất khỏi bảng AI)
            loadAiExams(); 
        } catch (error) {
            console.error("Lỗi khi chuyển đổi:", error);
            showToast("Có lỗi xảy ra khi chuyển đổi đề thi.", "error");
            btn.disabled = false;
            btn.innerHTML = "Xác Nhận Chuyển";
        }
    };
}


// ==========================================
// 5. XÓA ĐỀ AI
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
// 6. XUẤT EXCEL 1 ĐỀ CỤ THỂ
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
// 7. XUẤT EXCEL TẤT CẢ CÁC ĐỀ AI
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
// 8. KHỞI TẠO VÀ LẮNG NGHE SỰ KIỆN
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

    // Lắng nghe các nút click bên trong bảng (Sửa, Chuyển đổi, Xóa, Xuất Excel lẻ)
    const tbody = document.getElementById('ai-exam-list-body');
    if (tbody) {
        tbody.addEventListener('click', (e) => {
            
            // THÊM MỚI: Nút Sửa nội dung đề thi
            const editBtn = e.target.closest('.btn-edit-ai');
            if (editBtn) {
                const examId = editBtn.getAttribute('data-id');
                window.location.href = `admin-edit-exam.html?examId=${examId}`;
            }

            // Nút Chuyển Đổi thành đề Admin
            const convertBtn = e.target.closest('.btn-convert-ai');
            if (convertBtn) {
                const examId = convertBtn.getAttribute('data-id');
                openConvertAiModal(examId);
            }

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
