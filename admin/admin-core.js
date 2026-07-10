import { db, auth } from './firebase-config.js'; 
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
// --- THÊM MỚI 1: Import thêm getDoc để truy vấn 1 document cụ thể
import { collection, query, orderBy, onSnapshot, doc, updateDoc, deleteDoc, getDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

export { db };

// HÀM TOAST THÔNG BÁO CHUNG HỆ THỐNG
export function showToast(message, type = 'success') {
    const container = document.getElementById('toastContainer');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = `toast show ${type}`;
    toast.innerText = message;
    container.appendChild(toast);

    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// THEO DÕI XÁC THỰC
onAuthStateChanged(auth, (user) => {
    if (!user) {
        // window.location.href = 'login.html'; 
    }
});

// HÀM TẢI COMPONENT HTML ĐỘNG
async function loadComponent(elementId, filePath) {
    try {
        const response = await fetch(filePath);
        if (!response.ok) throw new Error(`Lỗi HTTP status: ${response.status}`);
        const html = await response.text();
        document.getElementById(elementId).innerHTML = html;
    } catch (error) {
        console.error(`Không thể tải component ${filePath}:`, error);
    }
}

// KHỞI TẠO HỆ THỐNG GIAO DIỆN
document.addEventListener('DOMContentLoaded', async () => {
    await loadComponent('sidebar-container', './components/sidebar.html');
    await loadComponent('modals-container', './components/modal.html');

    initSidebarEvents();
    initModalEvents();
    initAuthEvents();
    initAdminReportListener();

    document.dispatchEvent(new Event('componentsLoaded'));
});

function initSidebarEvents() {
    const parentMenus = document.querySelectorAll('.menu-parent');
    parentMenus.forEach(parent => {
        parent.addEventListener('click', (e) => {
            e.preventDefault();
            const submenu = parent.nextElementSibling;
            if (submenu && submenu.classList.contains('submenu')) {
                parent.classList.toggle('open');
                submenu.classList.toggle('show');
            }
        });
    });

    const menuItems = document.querySelectorAll('.menu-item');
    menuItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            
            menuItems.forEach(nav => nav.classList.remove('active'));
            item.classList.add('active');

            const title = item.getAttribute('data-title');
            const topbarTitle = document.getElementById('topbar-title');
            if (topbarTitle) topbarTitle.innerText = title;

            document.querySelectorAll('.content-section').forEach(section => {
                section.classList.remove('active');
            });
            
            const targetId = item.getAttribute('data-target');
            const targetSection = document.getElementById(targetId);
            if (targetSection) targetSection.classList.add('active');
        });
    });
}

function initModalEvents() {
    window.onclick = function(event) {
        const editPropsModal = document.getElementById("edit-properties-modal");
        const feedbackModal = document.getElementById("feedback-modal");
        const historyModal = document.getElementById("historyModal");
        
        // --- THÊM MỚI: Xử lý click ra ngoài để đóng modal chi tiết câu hỏi
        const questionDetailModal = document.getElementById("question-detail-modal");

        if (event.target === editPropsModal) editPropsModal.style.display = "none";
        if (event.target === feedbackModal) feedbackModal.style.display = "none";
        if (event.target === historyModal) historyModal.style.display = "none";
        if (event.target === questionDetailModal) questionDetailModal.style.display = "none";
    };

    // --- THÊM MỚI: Xử lý nút X để đóng modal chi tiết câu hỏi
    document.addEventListener('click', (e) => {
        if (e.target && e.target.id === 'close-qd-modal') {
            document.getElementById("question-detail-modal").style.display = "none";
        }
    });
}

function initAuthEvents() {
    const btnLogout = document.getElementById('btnLogout');
    if (btnLogout) {
        btnLogout.addEventListener('click', () => {
            signOut(auth).then(() => {
                window.location.href = 'login.html';
            }).catch((error) => {
                showToast("Lỗi khi đăng xuất: " + error.message, "error");
            });
        });
    }
}

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

            let timeStr = 'N/A';
            if (data.timestamp) {
                const d = data.timestamp.toDate();
                timeStr = d.toLocaleTimeString('vi-VN') + '<br><small style="color:#9ca3af">' + d.toLocaleDateString('vi-VN') + '</small>';
            }

            let shortQuestionText = data.questionText && data.questionText.length > 50 ? data.questionText.substring(0, 50) + '...' : (data.questionText || "N/A");
            
            let errorBadgeColor = data.errorType === 'Sai đáp án' ? 'background: #fee2e2; color: #dc2626;' : 
                                  data.errorType === 'Lỗi chuyên môn' ? 'background: #fef3c7; color: #d97706;' : 
                                  'background: #e0e7ff; color: #4f46e5;';

            const isResolved = data.status === 'resolved';
            const rowOpacity = isResolved ? '0.6' : '1';
            const actionButtons = isResolved 
                ? `<span style="color: #10b981; font-weight: bold;"><i class="fa-solid fa-check"></i> Đã xử lý</span>`
                : `
                    <button class="btn-resolve-report" data-id="${reportId}" style="background: #10b981; color: white; border: none; padding: 6px 12px; border-radius: 6px; cursor: pointer; font-size: 0.85rem; font-weight: bold; margin-right: 5px; transition: 0.2s;"><i class="fa-solid fa-check"></i> Xong</button>
                    <button class="btn-delete-report" data-id="${reportId}" style="background: #f3f4f6; color: #dc2626; border: 1px solid #d1d5db; padding: 6px 12px; border-radius: 6px; cursor: pointer; font-size: 0.85rem; transition: 0.2s;"><i class="fa-solid fa-trash"></i></button>
                  `;

            const tr = document.createElement('tr');
            tr.style.opacity = rowOpacity;
            
            // --- THÊM MỚI 2: Thêm nút "Xem gốc" ngay dưới QuestionID
            tr.innerHTML = `
                <td style="padding: 15px; border-bottom: 1px solid #f3f4f6;">${timeStr}</td>
                <td style="padding: 15px; border-bottom: 1px solid #f3f4f6; font-weight: 600;">${data.reportedBy}</td>
                <td style="padding: 15px; border-bottom: 1px solid #f3f4f6;">
                    <span style="background: #e5e7eb; padding: 3px 8px; border-radius: 4px; font-size: 0.8rem; font-weight: bold;">${data.examId}</span><br>
                    <div style="display: flex; align-items: center; gap: 8px; margin-top: 5px;">
                        <small style="color: #6b7280; font-family: monospace;">${data.questionId}</small>
                        <button class="btn-view-question" data-qid="${data.questionId}" style="background: #3b82f6; color: white; border: none; padding: 2px 6px; border-radius: 4px; cursor: pointer; font-size: 0.7rem;" title="Xem chi tiết câu hỏi">
                            <i class="fa-solid fa-eye"></i> Xem
                        </button>
                    </div>
                </td>
                <td style="padding: 15px; border-bottom: 1px solid #f3f4f6;">
                    <div style="font-size: 0.85rem; color: #6b7280; margin-bottom: 4px;"><i>"${shortQuestionText}"</i></div>
                    <span style="${errorBadgeColor} padding: 2px 6px; border-radius: 4px; font-size: 0.75rem; font-weight: bold; display: inline-block; margin-bottom: 5px;">${data.errorType}</span><br>
                    <b style="color: #1f2937; font-size: 0.95rem;">${data.description}</b>
                </td>
                <td style="padding: 15px; border-bottom: 1px solid #f3f4f6; text-align: center;">
                    ${actionButtons}
                </td>
            `;
            reportListBody.appendChild(tr);
        });

        pendingCountBadge.textContent = `${pendingCount} chờ xử lý`;
        if (pendingCount > 0) {
            pendingCountBadge.style.background = '#fee2e2'; pendingCountBadge.style.color = '#dc2626';
        } else {
            pendingCountBadge.style.background = '#d1fae5'; pendingCountBadge.style.color = '#059669';
        }

        // --- THÊM MỚI 3: Gắn sự kiện cho nút Xem câu hỏi
        document.querySelectorAll('.btn-view-question').forEach(btn => {
            btn.addEventListener('click', function() {
                const qId = this.getAttribute('data-qid');
                fetchAndShowQuestionDetail(qId);
            });
        });

        // Gắn sự kiện đánh dấu đã xử lý
        document.querySelectorAll('.btn-resolve-report').forEach(btn => {
            btn.addEventListener('click', async function() {
                const rId = this.getAttribute('data-id');
                try {
                    await updateDoc(doc(db, "reported_questions", rId), { status: 'resolved' });
                    showToast("Đã đánh dấu xử lý xong!", "success");
                } catch (err) { 
                    console.error("Lỗi cập nhật:", err); 
                    showToast("Có lỗi xảy ra khi cập nhật", "error");
                }
            });
        });

        // Gắn sự kiện xóa báo cáo
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
    });
}

// --- THÊM MỚI 4: Hàm truy vấn Firestore và hiển thị Modal
async function fetchAndShowQuestionDetail(questionId) {
    const modal = document.getElementById('question-detail-modal');
    const loadingDiv = document.getElementById('qd-loading');
    const contentDiv = document.getElementById('qd-content');
    
    if (!modal) {
        showToast("Lỗi: Không tìm thấy HTML của Modal.", "error");
        return;
    }

    // Hiển thị modal ở trạng thái loading
    modal.style.display = 'block';
    loadingDiv.style.display = 'block';
    contentDiv.style.display = 'none';

    try {
        // Truy vấn vào collection 'questions' (Hãy đổi tên collection nếu DB của bạn khác)
        const docRef = doc(db, "questions", questionId);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            const data = docSnap.data();
            
            // Đổ dữ liệu vào HTML (Lưu ý: Bạn có thể cần đổi tên biến (ví dụ: data.A) cho khớp với field trong DB của bạn)
            document.getElementById('qd-text').innerText = data.questionText || data.question || "Không có nội dung";
            document.getElementById('qd-optA').innerText = data.A || data.optionA || "";
            document.getElementById('qd-optB').innerText = data.B || data.optionB || "";
            document.getElementById('qd-optC').innerText = data.C || data.optionC || "";
            document.getElementById('qd-optD').innerText = data.D || data.optionD || "";
            document.getElementById('qd-correct').innerText = data.correctAnswer || data.correct || "Chưa thiết lập";
            document.getElementById('qd-explanation').innerText = data.explanation || data.explain || "Không có giải thích cho câu hỏi này.";

            // Ẩn loading, hiện nội dung
            loadingDiv.style.display = 'none';
            contentDiv.style.display = 'block';
        } else {
            // Trường hợp câu hỏi đã bị admin xóa trước đó
            modal.style.display = 'none'; // Tạm ẩn modal
            alert("⚠️ Câu hỏi này không còn tồn tại trên hệ thống (Có thể đã bị xóa).");
        }
    } catch (error) {
        console.error("Lỗi khi tải chi tiết câu hỏi:", error);
        modal.style.display = 'none';
        showToast("Lỗi khi kết nối đến cơ sở dữ liệu.", "error");
    }
}
