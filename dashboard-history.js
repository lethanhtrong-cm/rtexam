import { db, formatDate } from "./dashboard-core.js";
import { collection, getDocs, query, where, orderBy, doc, deleteDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// =========================================================================
// 1. BIẾN TOÀN CỤC LƯU TRỮ
// =========================================================================
let currentUserUid = null;
const historyTableBody = document.getElementById('historyTableBody');

// =========================================================================
// 2. LẮNG NGHE SỰ KIỆN AUTHENTICATION TỪ CORE
// =========================================================================
document.addEventListener("authReady", (e) => {
    const { user } = e.detail;
    currentUserUid = user.uid;
    
    // Bắt đầu tải lịch sử làm bài khi đã có thông tin user
    loadHistory(currentUserUid);
});

// =========================================================================
// 3. HÀM TẢI LỊCH SỬ LÀM BÀI TỪ FIRESTORE
// =========================================================================
async function loadHistory(uid) {
    if (!historyTableBody) return;

    try {
        const resultsRef = collection(db, "results");
        // Query lấy lịch sử: chỉ lấy của user hiện tại, sắp xếp thời gian nộp bài mới nhất lên đầu
        const q = query(resultsRef, where("userId", "==", uid), orderBy("submitTime", "desc"));
        const snapshot = await getDocs(q);

        if (snapshot.empty) {
            historyTableBody.innerHTML = `
                <tr>
                    <td colspan="6" style="text-align: center; color: var(--text-muted); padding: 30px;">
                        <i class="fa-solid fa-folder-open" style="font-size: 2rem; margin-bottom: 10px; display: block; opacity: 0.5;"></i>
                        Bạn chưa có lịch sử làm bài nào. Hãy chọn một đề thi và bắt đầu thử sức nhé!
                    </td>
                </tr>
            `;
            return;
        }

        historyTableBody.innerHTML = ""; // Xóa text "Đang tải..."

        snapshot.forEach(documentSnapshot => {
            const data = documentSnapshot.data();
            const resultId = documentSnapshot.id;
            
            // Lấy thông tin an toàn với fallback
            const examTitle = data.examTitle || data.examId || "Đề thi không xác định";
            const startTime = data.startTime ? formatDate(data.startTime) : "Không xác định";
            const submitTime = data.submitTime ? formatDate(data.submitTime) : "Không xác định";
            const score = data.score !== undefined ? parseFloat(data.score).toFixed(1) : "0.0";
            const correctCount = data.correctCount || 0;
            const totalQuestions = data.totalQuestions || 0;

            // Đổi màu badge số câu đúng nếu làm đúng trên 50%
            const isPass = totalQuestions > 0 && correctCount >= (totalQuestions / 2);
            const badgeClass = isPass ? "status-active" : "status-unactive";

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td style="font-weight: 600; color: var(--primary-blue); text-align: left;">${examTitle}</td>
                <td>${startTime}</td>
                <td>${submitTime}</td>
                <td><span class="status-badge ${badgeClass}">${correctCount} / ${totalQuestions}</span></td>
                <td style="font-weight: bold; font-size: 1.1rem; color: var(--danger-red);">${score}</td>
                <td>
                    <button class="btn-review" data-id="${resultId}" title="Xem lại chi tiết bài làm"><i class="fa-solid fa-eye"></i></button>
                    <button class="btn-delete-history" data-id="${resultId}" title="Xóa lịch sử này"><i class="fa-solid fa-trash"></i></button>
                </td>
            `;
            historyTableBody.appendChild(tr);
        });

        // Gắn sự kiện cho các nút vừa tạo
        attachHistoryActions();

    } catch (error) {
        console.error("Lỗi khi tải lịch sử:", error);
        
        // Bắt lỗi phổ biến: Thiếu Composite Index trong Firestore
        if (error.message.includes("requires an index")) {
            console.warn("VUI LÒNG CLICK VÀO LINK TRONG CONSOLE ĐỂ TẠO INDEX CHO FIRESTORE.");
            historyTableBody.innerHTML = `
                <tr>
                    <td colspan="6" style="text-align: center; color: var(--danger-red); padding: 20px;">
                        Lỗi truy xuất dữ liệu: Hệ thống đang thiếu cấu hình Index. Quản trị viên vui lòng kiểm tra Console (F12) để cấp quyền Index.
                    </td>
                </tr>
            `;
        } else {
            historyTableBody.innerHTML = `
                <tr>
                    <td colspan="6" style="text-align: center; color: var(--danger-red); padding: 20px;">
                        Đã xảy ra lỗi khi tải lịch sử làm bài. Vui lòng kiểm tra kết nối mạng và thử lại sau.
                    </td>
                </tr>
            `;
        }
    }
}

// =========================================================================
// 4. GẮN SỰ KIỆN CHO CÁC NÚT TRONG BẢNG LỊCH SỬ
// =========================================================================
function attachHistoryActions() {
    // Xóa lịch sử
    const deleteBtns = document.querySelectorAll('.btn-delete-history');
    deleteBtns.forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const resultId = e.currentTarget.getAttribute('data-id');
            
            if (confirm("Bạn có chắc chắn muốn xóa lịch sử bài làm này? Hành động này không thể hoàn tác.")) {
                try {
                    const btnElement = e.currentTarget;
                    btnElement.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i>`;
                    btnElement.disabled = true;

                    await deleteDoc(doc(db, "results", resultId));
                    
                    // Tải lại bảng lịch sử sau khi xóa thành công
                    loadHistory(currentUserUid);
                    alert("Đã xóa kết quả thành công!");
                } catch (error) {
                    console.error("Lỗi khi xóa lịch sử:", error);
                    alert("Không thể xóa kết quả lúc này. Vui lòng thử lại.");
                    e.currentTarget.innerHTML = `<i class="fa-solid fa-trash"></i>`;
                    e.currentTarget.disabled = false;
                }
            }
        });
    });

    // Xem lại bài làm
    const reviewBtns = document.querySelectorAll('.btn-review');
    reviewBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            const resultId = e.currentTarget.getAttribute('data-id');
            // Tạm thời hiển thị alert, sau này bạn có thể chuyển hướng sang trang review
            alert(`Tính năng xem lại chi tiết bài làm (ID: ${resultId}) đang được phát triển. Dữ liệu của bạn vẫn đang được lưu trữ an toàn.`);
            // Mở khóa dòng code dưới nếu bạn đã có trang review.html:
            // window.location.href = `review.html?resultId=${resultId}`;
        });
    });
}
