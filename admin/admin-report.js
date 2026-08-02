import { db, auth } from './firebase-config.js';
import { showToast } from './admin-core.js';
import { 
    collection, query, orderBy, onSnapshot, doc, updateDoc, deleteDoc, getDoc, addDoc, serverTimestamp, getDocs, where 
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// Biến lưu trữ dữ liệu State cục bộ để phục vụ Tìm kiếm & Lọc
let cachedReports = [];
let currentReportSearch = "";
let currentReportFilter = "all";
let currentReportData = null; // Chứa dữ liệu khi mở Modal Phản hồi
let currentViewingExamId = null; // Lưu tạm ExamID khi đang xem chi tiết câu hỏi

// =========================================================================
// HÀM TIÊM CSS TỐI ƯU GIAO DIỆN MOBILE
// =========================================================================
function injectReportMobileStyle() {
    if (!document.getElementById('mobile-report-style')) {
        const style = document.createElement('style');
        style.id = 'mobile-report-style';
        style.innerHTML = `
            @media (max-width: 768px) {
                /* Bẻ bảng thành dạng Card */
                #tab-reports .admin-table { min-width: 100% !important; display: block; border: none; }
                #tab-reports .admin-table thead { display: none; }
                #tab-reports .admin-table tbody { display: block; width: 100%; }
                
                #adminReportList tr {
                    display: flex !important;
                    flex-direction: column;
                    background: #fff;
                    border: 1px solid #cbd5e1;
                    border-radius: 12px;
                    margin-bottom: 15px;
                    padding: 15px;
                    box-shadow: 0 2px 4px rgba(0,0,0,0.02);
                }
                
                /* Hiển thị Tên cột thông qua pseudo-element */
                #adminReportList td { 
                    display: flex; 
                    flex-direction: column;
                    align-items: flex-start; 
                    border: none !important; 
                    padding: 8px 0 !important; 
                    text-align: left !important; 
                }
                
                #adminReportList td::before {
                    content: attr(data-label);
                    font-weight: 700;
                    color: #64748b;
                    font-size: 0.75rem;
                    text-transform: uppercase;
                    margin-bottom: 6px;
                    display: block;
                }
                
                /* Tối ưu khối nút bấm bên dưới cùng của thẻ Card */
                #adminReportList td:last-child {
                    margin-top: 10px;
                    padding-top: 15px !important;
                    border-top: 1px dashed #cbd5e1 !important;
                    align-items: stretch;
                }
                #adminReportList td:last-child::before { display: none; }
                
                #adminReportList td:last-child > div {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 10px;
                    width: 100%;
                }
                
                .report-action-item {
                    flex: 1;
                    min-width: 45%;
                    justify-content: center;
                    padding: 10px !important;
                    font-size: 13px !important;
                    text-align: center;
                }
            }
        `;
        document.head.appendChild(style);
    }
}

// =========================================================================
// QUẢN LÝ BÁO CÁO LỖI CÂU HỎI (HỆ THỐNG ADMIN)
// =========================================================================
function initAdminReportListener() {
    injectReportMobileStyle(); // Kích hoạt CSS Mobile

    const reportsSection = document.getElementById('tab-reports');
    if (!reportsSection) return;

    // 1. NHÚNG THANH CÔNG CỤ TÌM KIẾM VÀ LỌC
    if (!document.getElementById('report-toolbar')) {
        const toolbar = document.createElement('div');
        toolbar.id = 'report-toolbar';
        toolbar.className = 'toolbar-user-modern'; 
        toolbar.style.cssText = 'display: flex; gap: 15px; margin-bottom: 20px; flex-wrap: wrap; align-items: stretch;';
        toolbar.innerHTML = `
            <div class="search-user-container" style="flex: 1; min-width: 250px;">
                <input type="text" id="reportSearchInput" class="search-user-input" style="width: 100%;" placeholder="🔍 Tìm theo Email hoặc Mã đề...">
            </div>
            <select id="reportFilterSelect" class="select-user-filter" style="min-width: 180px;">
                <option value="all">Tất cả trạng thái</option>
                <option value="pending">Chờ xử lý</option>
                <option value="resolved">Đã xử lý</option>
            </select>
        `;
        
        const cardHeader = reportsSection.querySelector('.card > div:first-child');
        if (cardHeader && cardHeader.nextElementSibling) {
            cardHeader.parentNode.insertBefore(toolbar, cardHeader.nextElementSibling);
        }

        // Gắn sự kiện cho thanh tìm kiếm và lọc
        document.getElementById('reportSearchInput').addEventListener('input', (e) => {
            currentReportSearch = e.target.value.toLowerCase().trim();
            renderReportsTable();
        });
        document.getElementById('reportFilterSelect').addEventListener('change', (e) => {
            currentReportFilter = e.target.value;
            renderReportsTable();
        });
    }

    // 2. KHỞI TẠO NÚT GỬI PHẢN HỒI (Trong Modal - Khởi tạo 1 lần duy nhất)
    const btnSendReply = document.getElementById('btnSendAdminReply');
    if (btnSendReply && !btnSendReply.hasAttribute('data-initialized')) {
        const newBtnSendReply = btnSendReply.cloneNode(true);
        newBtnSendReply.setAttribute('data-initialized', 'true');
        btnSendReply.parentNode.replaceChild(newBtnSendReply, btnSendReply);

        newBtnSendReply.addEventListener('click', async function() {
            const replyMessage = document.getElementById('adminReplyContent').value.trim();
            if (!replyMessage) {
                showToast("Vui lòng nhập nội dung phản hồi!", "error");
                return;
            }

            if (!currentReportData) return;

            this.innerHTML = "⏳ Đang gửi...";
            this.disabled = true;

            try {
                await updateDoc(doc(db, "reported_questions", currentReportData.reportId), { 
                    status: 'resolved' 
                });

                await addDoc(collection(db, "notifications"), {
                    toEmail: currentReportData.toEmail,
                    type: 'admin_reply',
                    questionId: currentReportData.questionId,
                    adminMessage: replyMessage,
                    status: 'unread',
                    timestamp: serverTimestamp()
                });

                showToast("Đã gửi phản hồi thành công!", "success");
                document.getElementById('admin-reply-modal').style.display = 'none';
            } catch (err) {
                console.error("Lỗi khi gửi phản hồi:", err);
                showToast("Có lỗi xảy ra khi gửi", "error");
            } finally {
                this.innerHTML = `<i class="fa-solid fa-paper-plane"></i> Gửi Phản Hồi`;
                this.disabled = false;
            }
        });
    }

    // 3. KẾT NỐI FIRESTORE REALTIME VÀ CẬP NHẬT BADGE TRÊN TAB
    const reportsRef = collection(db, "reported_questions");
    const q = query(reportsRef, orderBy("timestamp", "desc"));

    onSnapshot(q, (snapshot) => {
        cachedReports = [];
        let pendingCount = 0;

        snapshot.forEach((docSnap) => {
            const data = docSnap.data();
            data.id = docSnap.id;
            cachedReports.push(data);
            if (data.status === 'pending') pendingCount++;
        });

        const pendingCountBadge = document.getElementById('pendingReportCount');
        if (pendingCountBadge) {
            pendingCountBadge.textContent = `${pendingCount} chờ xử lý`;
            if (pendingCount > 0) {
                pendingCountBadge.style.background = '#fee2e2'; pendingCountBadge.style.color = '#dc2626';
            } else {
                pendingCountBadge.style.background = '#d1fae5'; pendingCountBadge.style.color = '#059669';
            }
        }

        const tabMenuItems = document.querySelectorAll('[data-tab="tab-reports"], #menu-tab-reports');
        tabMenuItems.forEach(tabItem => {
            let badge = tabItem.querySelector('.report-badge-notify');
            if (pendingCount > 0) {
                if (!badge) {
                    badge = document.createElement('span');
                    badge.className = 'report-badge-notify';
                    badge.style.cssText = 'background-color: #ef4444; color: white; border-radius: 50%; padding: 2px 6px; font-size: 11px; margin-left: auto; font-weight: bold; line-height: 1;';
                    tabItem.appendChild(badge);
                }
                badge.innerText = pendingCount > 99 ? '99+' : pendingCount;
                badge.style.display = 'inline-block';
            } else {
                if (badge) badge.style.display = 'none';
            }
        });

        renderReportsTable();
    });
}

// =========================================================================
// HÀM RENDER DỮ LIỆU SAU KHI LỌC
// =========================================================================
function renderReportsTable() {
    const reportListBody = document.getElementById('adminReportList');
    if (!reportListBody) return;
    
    reportListBody.innerHTML = '';

    // Áp dụng bộ lọc
    const filteredReports = cachedReports.filter(report => {
        const matchSearch = currentReportSearch === "" || 
            (report.reportedBy && report.reportedBy.toLowerCase().includes(currentReportSearch)) || 
            (report.examId && report.examId.toLowerCase().includes(currentReportSearch));
        
        let matchFilter = true;
        if (currentReportFilter === 'pending') matchFilter = report.status === 'pending';
        if (currentReportFilter === 'resolved') matchFilter = report.status === 'resolved';

        return matchSearch && matchFilter;
    });

    if (filteredReports.length === 0) {
        reportListBody.innerHTML = '<tr><td colspan="5" style="text-align: center; padding: 30px; color: #64748b; font-weight: 500;">Không có dữ liệu báo cáo nào khớp với tìm kiếm hiện tại.</td></tr>';
        return;
    }

    filteredReports.forEach((data) => {
        let timeStr = 'N/A';
        let dateStr = '';
        if (data.timestamp) {
            const d = (typeof data.timestamp.toDate === 'function') ? data.timestamp.toDate() : new Date(data.timestamp);
            timeStr = d.toLocaleTimeString('vi-VN', {hour: '2-digit', minute:'2-digit'});
            dateStr = d.toLocaleDateString('vi-VN');
        }

        let shortQuestionText = data.questionText && data.questionText.length > 55 ? data.questionText.substring(0, 55) + '...' : (data.questionText || "N/A");
        
        let errorBadgeColor = data.errorType === 'Sai đáp án' ? 'background: #fef2f2; color: #ef4444; border: 1px solid #fca5a5;' : 
                              data.errorType === 'Lỗi chuyên môn' ? 'background: #fffbeb; color: #f59e0b; border: 1px solid #fcd34d;' : 
                              'background: #eff6ff; color: #3b82f6; border: 1px solid #bfdbfe;';

        const isResolved = data.status === 'resolved';
        const rowOpacity = isResolved ? '0.65' : '1';
        
        const deleteBtnHtml = `
            <button class="btn-delete-report report-action-item" data-id="${data.id}" style="background: #fff; color: #ef4444; border: 1px solid #fca5a5; padding: 6px 10px; border-radius: 6px; cursor: pointer; font-size: 0.9rem; transition: all 0.2s; display: flex; align-items: center; justify-content: center;" title="Xóa báo cáo này">
                <i class="fa-solid fa-trash"></i> <span style="margin-left:5px; font-weight: 600;">Xóa</span>
            </button>
        `;

        const safeDescription = (data.description || "").replace(/"/g, '&quot;');
        
        const actionButtons = isResolved 
            ? `<div style="display: flex; align-items: center; justify-content: center; gap: 8px;">
                 <span class="report-action-item" style="color: #059669; font-weight: 600; font-size: 0.85rem; background: #d1fae5; padding: 5px 12px; border-radius: 20px; border: 1px solid #a7f3d0; display:flex; align-items:center; justify-content:center; gap:5px;"><i class="fa-solid fa-check"></i> Đã xử lý</span>
                 ${deleteBtnHtml}
               </div>`
            : `<div style="display: flex; align-items: center; justify-content: center; gap: 8px;">
                <button class="btn-quick-resolve report-action-item" data-id="${data.id}" data-email="${data.reportedBy}" data-qid="${data.questionId}" style="background: #10b981; color: white; border: none; padding: 6px 14px; border-radius: 6px; cursor: pointer; font-size: 0.85rem; font-weight: 500; transition: all 0.2s; display: flex; align-items: center; justify-content: center; gap: 6px; box-shadow: 0 2px 4px rgba(16, 185, 129, 0.2);" title="Xử lý ngay và gửi thông báo mặc định">
                    <i class="fa-solid fa-bolt"></i> Xử lý nhanh
                </button>
                <button class="btn-reply-report report-action-item" data-id="${data.id}" data-email="${data.reportedBy}" data-qid="${data.questionId}" data-desc="${safeDescription}" style="background: #3b82f6; color: white; border: none; padding: 6px 14px; border-radius: 6px; cursor: pointer; font-size: 0.85rem; font-weight: 500; transition: all 0.2s; display: flex; align-items: center; justify-content: center; gap: 6px; box-shadow: 0 2px 4px rgba(59, 130, 246, 0.2);">
                    <i class="fa-solid fa-reply"></i> Phản hồi
                </button>
                ${deleteBtnHtml}
              </div>`;

        // 5. Tạo dòng (Row) với hiệu ứng Hover và Viền màu trạng thái
        const tr = document.createElement('tr');
        tr.style.opacity = rowOpacity;
        tr.style.transition = "background 0.2s ease";
        tr.style.borderLeft = isResolved ? "4px solid #10b981" : "4px solid #ef4444"; 
        
        tr.onmouseover = function() { this.style.background = '#f8fafc'; }
        tr.onmouseout = function() { this.style.background = 'transparent'; }

        tr.innerHTML = `
            <td data-label="THỜI GIAN" style="padding: 20px 15px; border-bottom: 1px solid #f1f5f9; vertical-align: top;">
                <div style="font-weight: 600; color: #475569; font-size: 0.9rem;">${timeStr}</div>
                <div style="font-size: 0.8rem; color: #94a3b8; margin-top: 2px;">${dateStr}</div>
            </td>
            
            <td data-label="NGƯỜI BÁO CÁO" style="padding: 20px 15px; border-bottom: 1px solid #f1f5f9; vertical-align: top;">
                <div style="color: #3b82f6; font-weight: 500; font-size: 0.9rem; word-break: break-all;">${data.reportedBy}</div>
            </td>
            
            <td data-label="MÃ ĐỀ / CÂU" style="padding: 20px 15px; border-bottom: 1px solid #f1f5f9; vertical-align: top;">
                <span style="background: #f1f5f9; color: #475569; padding: 4px 10px; border-radius: 6px; font-size: 0.75rem; font-weight: 700; border: 1px solid #e2e8f0;">${data.examId}</span>
                <div style="display: flex; align-items: center; gap: 8px; margin-top: 8px;">
                    <span style="color: #64748b; font-family: monospace; font-size: 0.8rem;">${data.questionId}</span>
                    <button class="btn-view-question" data-qid="${data.questionId}" data-examid="${data.examId}" style="background: #e0f2fe; color: #0284c7; border: 1px solid #bae6fd; padding: 3px 8px; border-radius: 4px; cursor: pointer; font-size: 0.75rem; font-weight: 600; transition: 0.2s;" title="Xem chi tiết câu hỏi">
                        Xem
                    </button>
                </div>
            </td>
            
            <td data-label="NỘI DUNG LỖI" style="padding: 20px 15px; border-bottom: 1px solid #f1f5f9; vertical-align: top;">
                <div style="font-size: 0.85rem; color: #64748b; margin-bottom: 8px; font-style: italic; border-left: 2px solid #cbd5e1; padding-left: 10px;">"${shortQuestionText}"</div>
                <span style="${errorBadgeColor} padding: 4px 10px; border-radius: 20px; font-size: 0.75rem; font-weight: 600; display: inline-block; margin-bottom: 6px;">${data.errorType}</span>
                <div style="color: #1e293b; font-size: 0.95rem; font-weight: 500; margin-top: 4px;">${data.description}</div>
            </td>
            
            <td style="padding: 20px 15px; border-bottom: 1px solid #f1f5f9; text-align: center; vertical-align: top;">
                ${actionButtons}
            </td>
        `;
        
        const styleFix = document.createElement('style');
        styleFix.innerHTML = `@media(min-width: 769px){ .mobile-only-text { display: none !important; } }`;
        tr.appendChild(styleFix);

        reportListBody.appendChild(tr);
    });

    bindRowEvents();
}

function bindRowEvents() {
    // 1. Nút Xem chi tiết câu hỏi
    document.querySelectorAll('.btn-view-question').forEach(btn => {
        btn.addEventListener('click', function() {
            const qId = this.getAttribute('data-qid');
            const eId = this.getAttribute('data-examid'); // Lấy examId để phục vụ tính năng Sửa câu hỏi
            fetchAndShowQuestionDetail(qId, eId);
        });
    });

    // 2. Nút Xóa Báo cáo
    document.querySelectorAll('.btn-delete-report').forEach(btn => {
        btn.addEventListener('click', async function() {
            const rId = this.getAttribute('data-id');
            if(confirm("Xóa báo cáo này vĩnh viễn?")) {
                try {
                    await deleteDoc(doc(db, "reported_questions", rId));
                    showToast("Đã xóa báo cáo!", "success");
                } catch (err) { 
                    console.error("Lỗi xóa:", err); 
                    showToast("Có lỗi xảy ra khi xóa", "error");
                }
            }
        });
    });

    // 3. Nút Xử lý nhanh
    document.querySelectorAll('.btn-quick-resolve').forEach(btn => {
        btn.addEventListener('click', async function() {
            const rId = this.getAttribute('data-id');
            const toEmail = this.getAttribute('data-email');
            const qId = this.getAttribute('data-qid');
            
            this.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>...';
            this.disabled = true;

            try {
                await updateDoc(doc(db, "reported_questions", rId), { status: 'resolved' });
                await addDoc(collection(db, "notifications"), {
                    toEmail: toEmail,
                    type: 'admin_reply',
                    questionId: qId,
                    adminMessage: "Cảm ơn bạn, hệ thống đã tiếp nhận và xử lý báo cáo lỗi của bạn thành công. Chúc bạn ôn tập tốt!",
                    status: 'unread',
                    timestamp: serverTimestamp()
                });
                showToast("Đã xử lý nhanh và gửi thông báo!", "success");
            } catch (err) { 
                console.error("Lỗi xử lý nhanh:", err); 
                showToast("Có lỗi xảy ra khi xử lý nhanh", "error");
                this.innerHTML = '<i class="fa-solid fa-bolt"></i> Xử lý nhanh';
                this.disabled = false;
            }
        });
    });

    // 4. Mở Modal Phản hồi
    document.querySelectorAll('.btn-reply-report').forEach(btn => {
        btn.addEventListener('click', function() {
            currentReportData = {
                reportId: this.getAttribute('data-id'),
                toEmail: this.getAttribute('data-email'),
                questionId: this.getAttribute('data-qid')
            };
            
            const replyModal = document.getElementById('admin-reply-modal');
            if(!replyModal) return;
            
            document.getElementById('reply-to-email').innerText = currentReportData.toEmail;
            document.getElementById('reply-question-id').innerText = currentReportData.questionId;
            document.getElementById('adminReplyContent').value = ""; 
            
            // Chèn ngữ cảnh lỗi vào khung Modal
            let contextDiv = document.getElementById('reply-context-info');
            if(!contextDiv) {
                contextDiv = document.createElement('div');
                contextDiv.id = 'reply-context-info';
                contextDiv.style.cssText = 'background: #f8fafc; padding: 12px; border-left: 4px solid #3b82f6; border-radius: 6px; margin-bottom: 15px; font-size: 0.9rem; color: #475569; font-style: italic; opacity: 0.9;';
                const textarea = document.getElementById('adminReplyContent');
                textarea.parentNode.insertBefore(contextDiv, textarea);
            }
            contextDiv.innerHTML = `<strong>Nội dung học viên báo cáo:</strong> "${this.getAttribute('data-desc')}"`;
            
            replyModal.style.display = 'block';
        });
    });
}

// =========================================================================
// HÀM TRUY VẤN FIRESTORE ĐỔ DỮ LIỆU CÂU HỎI VÀO MODAL
// =========================================================================
async function fetchAndShowQuestionDetail(questionId, examId) {
    if (!auth.currentUser) {
        alert("⛔ Lỗi bảo mật: Bạn cần đăng nhập quyền Admin để xem chi tiết câu hỏi.");
        return;
    }

    const modal = document.getElementById('question-detail-modal');
    const loadingDiv = document.getElementById('qd-loading');
    const contentDiv = document.getElementById('qd-content');
    
    if (!modal) {
        showToast("Lỗi: Không tìm thấy HTML của Modal chi tiết câu hỏi.", "error");
        return;
    }

    modal.style.display = 'block';
    loadingDiv.style.display = 'block';
    contentDiv.style.display = 'none';

    // Thêm nút "Sửa Câu Hỏi Này"
    let editBtnContainer = document.getElementById('qd-edit-btn-container');
    if (!editBtnContainer) {
        const closeBtn = modal.querySelector('.modal-close') || modal.querySelector('[id^="close"]');
        if (closeBtn && closeBtn.parentNode) {
            editBtnContainer = document.createElement('div');
            editBtnContainer.id = 'qd-edit-btn-container';
            editBtnContainer.style.cssText = 'margin-right: 15px; display: inline-block;';
            closeBtn.parentNode.insertBefore(editBtnContainer, closeBtn);
        } else {
            editBtnContainer = document.createElement('div');
            editBtnContainer.id = 'qd-edit-btn-container';
            editBtnContainer.style.cssText = 'text-align: right; margin-bottom: 10px;';
            contentDiv.prepend(editBtnContainer);
        }
    }

    editBtnContainer.innerHTML = `
        <button id="btn-goto-edit-question" style="background-color: #f59e0b; color: white; border: none; padding: 6px 12px; border-radius: 6px; font-weight: 600; cursor: pointer; font-size: 13px; box-shadow: 0 2px 4px rgba(245, 158, 11, 0.2); transition: 0.2s;">
            <i class="fa-solid fa-pen-to-square"></i> Chỉnh sửa câu hỏi này
        </button>
    `;

    document.getElementById('btn-goto-edit-question').addEventListener('click', () => {
        if (!examId) {
            alert("Không xác định được Mã đề (ExamID) của câu hỏi này.");
            return;
        }
        window.open(`admin-edit-exam.html?examId=${examId}&highlightQid=${questionId}`, '_blank');
    });

    try {
        const docRef = doc(db, "questions", questionId);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            const data = docSnap.data();
            const finalExamId = examId || data.examId || "Không rõ";

            // TÍNH NĂNG MỚI: Truy vấn toàn bộ câu hỏi của đề để tìm vị trí (Index)
            let questionNumberText = "Không xác định";
            if (finalExamId !== "Không rõ") {
                try {
                    const qSnap = await getDocs(query(collection(db, "questions"), where("examId", "==", finalExamId)));
                    let allQuestions = [];
                    qSnap.forEach(d => allQuestions.push(d.id));
                    
                    const index = allQuestions.indexOf(questionId);
                    if (index !== -1) {
                        questionNumberText = `Câu ${index + 1} / ${allQuestions.length}`;
                    }
                } catch (e) {
                    console.error("Lỗi tìm số thứ tự câu hỏi", e);
                }
            }

            // Tạo Header chứa thông tin Vị trí
            let contextDiv = document.getElementById('qd-context-info');
            if (!contextDiv) {
                contextDiv = document.createElement('div');
                contextDiv.id = 'qd-context-info';
                contextDiv.style.cssText = 'background: #eff6ff; padding: 10px 15px; border-radius: 8px; margin-bottom: 15px; font-size: 0.9rem; color: #1e293b; display: flex; gap: 20px; border: 1px solid #bfdbfe; flex-wrap: wrap;';
                const qdText = document.getElementById('qd-text');
                qdText.parentNode.insertBefore(contextDiv, qdText);
            }
            
            contextDiv.innerHTML = `
                <div><strong><i class="fa-solid fa-file-lines" style="color:#3b82f6;"></i> Mã đề:</strong> <span style="color: #2563eb; font-weight: 600;">${finalExamId}</span></div>
                <div><strong><i class="fa-solid fa-list-ol" style="color:#3b82f6;"></i> Vị trí:</strong> <span style="font-weight: 600; color: #059669;">${questionNumberText}</span> <span style="font-size: 0.8rem; color: #94a3b8; font-family: monospace; margin-left: 5px;">(ID: ${questionId})</span></div>
            `;

            const questionText = data.text || data.questionText || data.question || data.content || "Không có nội dung câu hỏi";
            document.getElementById('qd-text').innerText = questionText;

            const optionsArray = data.options || data.answers || [];
            const domOptions = [
                document.getElementById('qd-optA'),
                document.getElementById('qd-optB'),
                document.getElementById('qd-optC'),
                document.getElementById('qd-optD')
            ];

            if (optionsArray.length > 0) {
                for (let i = 0; i < 4; i++) {
                    if (domOptions[i]) domOptions[i].innerText = optionsArray[i] ? optionsArray[i] : "Không có dữ liệu đáp án";
                }
            } else {
                for (let i = 0; i < 4; i++) {
                    if (domOptions[i]) domOptions[i].innerText = "Không có dữ liệu đáp án";
                }
            }

            document.getElementById('qd-correct').innerText = data.correctAnswer || data.correct || "Chưa thiết lập";
            document.getElementById('qd-explanation').innerText = data.explanation || data.explain || "Không có giải thích cho câu hỏi này.";

            loadingDiv.style.display = 'none';
            contentDiv.style.display = 'block';
        } else {
            modal.style.display = 'none';
            alert("⚠️ Câu hỏi này không còn tồn tại trên hệ thống (Có thể đã bị xóa).");
        }
    } catch (error) {
        console.error("Lỗi khi tải chi tiết câu hỏi:", error);
        modal.style.display = 'none';
        showToast("Lỗi khi kết nối đến cơ sở dữ liệu.", "error");
    }
}

// Bắt sự kiện hệ thống đã load xong Component (HTML) để kích hoạt
document.addEventListener('componentsLoaded', () => {
    initAdminReportListener();
});
