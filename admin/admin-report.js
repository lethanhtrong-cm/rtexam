import { db, auth } from './firebase-config.js';
import { showToast } from './admin-core.js';
import { 
    collection, query, orderBy, onSnapshot, doc, updateDoc, deleteDoc, getDoc, addDoc, serverTimestamp 
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// =========================================================================
// QUẢN LÝ BÁO CÁO LỖI CÂU HỎI (HỆ THỐNG ADMIN)
// =========================================================================
function initAdminReportListener() {
    const reportListBody = document.getElementById('adminReportList');
    const pendingCountBadge = document.getElementById('pendingReportCount');
    
    if (!reportListBody) return; 

    const reportsRef = collection(db, "reported_questions");
    const q = query(reportsRef, orderBy("timestamp", "desc"));

    // Lắng nghe Realtime
    onSnapshot(q, (snapshot) => {
        reportListBody.innerHTML = '';
        let pendingCount = 0;

        if (snapshot.empty) {
            reportListBody.innerHTML = '<tr><td colspan="5" style="text-align: center; padding: 30px; color: #10b981; font-weight: bold;"><i class="fa-solid fa-check-circle"></i> Tuyệt vời! Không có báo cáo lỗi nào cần xử lý.</td></tr>';
            pendingCountBadge.textContent = `0 chờ xử lý`;
            return;
        }

        snapshot.forEach((docSnap) => {
            const data = docSnap.data();
            const reportId = docSnap.id;
            
            if (data.status === 'pending') pendingCount++;

            // 1. Tách chuỗi thời gian và ngày tháng
            let timeStr = 'N/A';
            let dateStr = '';
            if (data.timestamp) {
                const d = data.timestamp.toDate();
                timeStr = d.toLocaleTimeString('vi-VN', {hour: '2-digit', minute:'2-digit'});
                dateStr = d.toLocaleDateString('vi-VN');
            }

            // 2. Rút gọn text câu hỏi gốc
            let shortQuestionText = data.questionText && data.questionText.length > 55 ? data.questionText.substring(0, 55) + '...' : (data.questionText || "N/A");
            
            // 3. Thiết kế lại Badge Lỗi: Bo góc tròn, nền pastel
            let errorBadgeColor = data.errorType === 'Sai đáp án' ? 'background: #fef2f2; color: #ef4444; border: 1px solid #fca5a5;' : 
                                  data.errorType === 'Lỗi chuyên môn' ? 'background: #fffbeb; color: #f59e0b; border: 1px solid #fcd34d;' : 
                                  'background: #eff6ff; color: #3b82f6; border: 1px solid #bfdbfe;';

            const isResolved = data.status === 'resolved';
            const rowOpacity = isResolved ? '0.65' : '1';
            
            // 4. Nút Hành động (Nút Xóa luôn hiện)
            const deleteBtnHtml = `
                <button class="btn-delete-report" data-id="${reportId}" style="background: #fff; color: #ef4444; border: 1px solid #fca5a5; padding: 6px 10px; border-radius: 6px; cursor: pointer; font-size: 0.9rem; transition: all 0.2s; display: flex; align-items: center; justify-content: center;" title="Xóa báo cáo này">
                    <i class="fa-regular fa-trash-can"></i>
                </button>
            `;

            const actionButtons = isResolved 
                ? `<div style="display: flex; align-items: center; justify-content: center; gap: 8px;">
                     <span style="color: #059669; font-weight: 600; font-size: 0.85rem; background: #d1fae5; padding: 5px 12px; border-radius: 20px; border: 1px solid #a7f3d0;"><i class="fa-solid fa-check"></i> Đã xử lý</span>
                     ${deleteBtnHtml}
                   </div>`
                : `<div style="display: flex; align-items: center; justify-content: center; gap: 8px;">
                    <button class="btn-reply-report" data-id="${reportId}" data-email="${data.reportedBy}" data-qid="${data.questionId}" style="background: #3b82f6; color: white; border: none; padding: 6px 14px; border-radius: 6px; cursor: pointer; font-size: 0.85rem; font-weight: 500; transition: all 0.2s; display: flex; align-items: center; gap: 6px; box-shadow: 0 2px 4px rgba(59, 130, 246, 0.2);">
                        <i class="fa-solid fa-reply"></i> Phản hồi
                    </button>
                    ${deleteBtnHtml}
                  </div>`;

            // 5. Tạo dòng (Row) với hiệu ứng Hover màu nền
            const tr = document.createElement('tr');
            tr.style.opacity = rowOpacity;
            tr.style.transition = "background 0.2s ease";
            tr.onmouseover = function() { this.style.background = '#f8fafc'; }
            tr.onmouseout = function() { this.style.background = 'transparent'; }

            // 6. Cấu trúc HTML các cột
            tr.innerHTML = `
                <td style="padding: 20px 15px; border-bottom: 1px solid #f1f5f9; vertical-align: top;">
                    <div style="font-weight: 600; color: #475569; font-size: 0.9rem;">${timeStr}</div>
                    <div style="font-size: 0.8rem; color: #94a3b8; margin-top: 2px;">${dateStr}</div>
                </td>
                
                <td style="padding: 20px 15px; border-bottom: 1px solid #f1f5f9; vertical-align: top;">
                    <div style="color: #3b82f6; font-weight: 500; font-size: 0.9rem;">${data.reportedBy}</div>
                </td>
                
                <td style="padding: 20px 15px; border-bottom: 1px solid #f1f5f9; vertical-align: top;">
                    <span style="background: #f1f5f9; color: #475569; padding: 4px 10px; border-radius: 6px; font-size: 0.75rem; font-weight: 700; border: 1px solid #e2e8f0;">${data.examId}</span>
                    <div style="display: flex; align-items: center; gap: 8px; margin-top: 8px;">
                        <span style="color: #64748b; font-family: monospace; font-size: 0.8rem;">${data.questionId}</span>
                        <button class="btn-view-question" data-qid="${data.questionId}" style="background: #e0f2fe; color: #0284c7; border: 1px solid #bae6fd; padding: 3px 8px; border-radius: 4px; cursor: pointer; font-size: 0.75rem; font-weight: 600; transition: 0.2s;" title="Xem chi tiết câu hỏi">
                            Xem
                        </button>
                    </div>
                </td>
                
                <td style="padding: 20px 15px; border-bottom: 1px solid #f1f5f9; vertical-align: top;">
                    <div style="font-size: 0.85rem; color: #64748b; margin-bottom: 8px; font-style: italic; border-left: 2px solid #cbd5e1; padding-left: 10px;">"${shortQuestionText}"</div>
                    <span style="${errorBadgeColor} padding: 4px 10px; border-radius: 20px; font-size: 0.75rem; font-weight: 600; display: inline-block; margin-bottom: 6px;">${data.errorType}</span>
                    <div style="color: #1e293b; font-size: 0.95rem; font-weight: 500; margin-top: 4px;">${data.description}</div>
                </td>
                
                <td style="padding: 20px 15px; border-bottom: 1px solid #f1f5f9; text-align: center; vertical-align: top;">
                    ${actionButtons}
                </td>
            `;
            reportListBody.appendChild(tr);
        });

        // Cập nhật thẻ Badge đếm số lượng
        pendingCountBadge.textContent = `${pendingCount} chờ xử lý`;
        if (pendingCount > 0) {
            pendingCountBadge.style.background = '#fee2e2'; pendingCountBadge.style.color = '#dc2626';
        } else {
            pendingCountBadge.style.background = '#d1fae5'; pendingCountBadge.style.color = '#059669';
        }

        // ------------------ GẮN CÁC SỰ KIỆN NÚT ------------------
        
        // 1. Nút Xem chi tiết câu hỏi
        document.querySelectorAll('.btn-view-question').forEach(btn => {
            btn.addEventListener('click', function() {
                const qId = this.getAttribute('data-qid');
                fetchAndShowQuestionDetail(qId);
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

        // 3. Logic Mở Modal Phản hồi Báo Cáo
        let currentReportData = null; 
        document.querySelectorAll('.btn-reply-report').forEach(btn => {
            btn.addEventListener('click', function() {
                currentReportData = {
                    reportId: this.getAttribute('data-id'),
                    toEmail: this.getAttribute('data-email'),
                    questionId: this.getAttribute('data-qid')
                };
                
                const replyModal = document.getElementById('admin-reply-modal');
                if(!replyModal) {
                    showToast("Chưa tải được HTML của Modal Phản hồi!", "error");
                    return;
                }
                
                document.getElementById('reply-to-email').innerText = currentReportData.toEmail;
                document.getElementById('reply-question-id').innerText = currentReportData.questionId;
                document.getElementById('adminReplyContent').value = ""; // Xóa text cũ
                replyModal.style.display = 'block';
            });
        });

        // 4. Xử lý Nút Gửi Phản Hồi Trong Modal
        const btnSendReply = document.getElementById('btnSendAdminReply');
        if (btnSendReply) {
            // Clone node để tránh gắn sự kiện dồn cục nhiều lần do onSnapshot
            const newBtnSendReply = btnSendReply.cloneNode(true);
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
                    // Cập nhật Document trạng thái Resolved
                    await updateDoc(doc(db, "reported_questions", currentReportData.reportId), { 
                        status: 'resolved' 
                    });

                    // Ghi Document vào collection notifications
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
    });
}

// =========================================================================
// HÀM TRUY VẤN FIRESTORE ĐỔ DỮ LIỆU CÂU HỎI VÀO MODAL
// =========================================================================
async function fetchAndShowQuestionDetail(questionId) {
    // Check Auth - Ngăn chặn Guest truy cập nội bộ
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

    try {
        const docRef = doc(db, "questions", questionId);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            const data = docSnap.data();
            
            // Fallback Logic cho Nội dung
            const questionText = data.text || data.questionText || data.question || data.content || "Không có nội dung câu hỏi";
            document.getElementById('qd-text').innerText = questionText;

            // Fallback Logic xử lý mảng Đáp án
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
