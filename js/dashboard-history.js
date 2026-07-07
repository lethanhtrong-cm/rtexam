import { db, formatDate, safeRedirect } from "./dashboard-core.js";
import { collection, query, where, getDocs, doc, deleteDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

let userEmail = null;
let examVipMap = {};

window.safeRedirect = safeRedirect;

// =========================================================================
// 1. LẮNG NGHE SỰ KIỆN TỪ HỆ THỐNG MODULES
// =========================================================================
document.addEventListener("authReady", (e) => {
    userEmail = e.detail.user.email;
});

document.addEventListener("examsReady", async (e) => {
    const allExamsData = e.detail.allExamsData;
    
    examVipMap = {};
    allExamsData.forEach(exam => {
        examVipMap[exam.id] = exam.isVip;
    });

    if (userEmail) {
        await fetchHistory(userEmail);
    }
});

// =========================================================================
// 2. TẢI DỮ LIỆU LỊCH SỬ LÀM BÀI & CẬP NHẬT GIAO DIỆN
// =========================================================================
async function fetchHistory(email) {
    // ĐƯA CÁC BIẾN DOM VÀO TRONG HÀM ĐỂ TRÁNH LỖI NULL KHI CHƯA LOAD XONG HTML
    const historyTableBody = document.getElementById("historyTableBody");
    const statCompletedExams = document.getElementById("statCompletedExams");
    const statAvgScore = document.getElementById("statAvgScore");

    if (!historyTableBody) return; // Thoát nếu giao diện chưa sẵn sàng

    try {
        const resultsRef = collection(db, "results");
        const q = query(resultsRef, where("email", "==", email));
        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
            historyTableBody.innerHTML = '<tr><td colspan="6" class="loading-text">Bạn chưa hoàn thành bài thi nào.</td></tr>';
            if (statCompletedExams) statCompletedExams.textContent = "0";
            if (statAvgScore) statAvgScore.textContent = "0.0";
            return;
        }

        const resultsArray = [];
        const firstAttempts = {}; 

        querySnapshot.forEach((doc) => {
            const data = doc.data();
            resultsArray.push({ id: doc.id, ...data });
            
            const examId = data.examId || data.examCode || "Unknown";
            const ts = data.timestamp && typeof data.timestamp.toMillis === 'function' 
                ? data.timestamp.toMillis() 
                : new Date(data.timestamp || data.submittedAt || 0).getTime();

            if (!firstAttempts[examId] || ts < firstAttempts[examId].timestamp) {
                firstAttempts[examId] = {
                    score: data.score !== undefined ? parseFloat(data.score) : 0,
                    totalQuestions: data.totalQuestions || data.total || 1,
                    timestamp: ts
                };
            }
        });

        // --- TÍNH TOÁN QUICK STATS ---
        let totalScoreSum = 0;
        const uniqueExamsCount = Object.keys(firstAttempts).length;

        for (const examId in firstAttempts) {
            const attempt = firstAttempts[examId];
            const scoreBase10 = (attempt.score / attempt.totalQuestions) * 10;
            totalScoreSum += scoreBase10;
        }

        const averageScoreResult = uniqueExamsCount > 0 ? (totalScoreSum / uniqueExamsCount).toFixed(1) : "0.0";

        if (statCompletedExams) statCompletedExams.textContent = uniqueExamsCount;
        if (statAvgScore) statAvgScore.textContent = averageScoreResult;

        // --- SẮP XẾP VÀ RENDER BẢNG ---
        resultsArray.sort((a, b) => {
            const dateA = a.timestamp && typeof a.timestamp.toDate === 'function' ? a.timestamp.toDate() : new Date(a.timestamp || a.submittedAt || 0);
            const dateB = b.timestamp && typeof b.timestamp.toDate === 'function' ? b.timestamp.toDate() : new Date(b.timestamp || b.submittedAt || 0);
            return dateB - dateA;
        });

        historyTableBody.innerHTML = ""; 
        
        resultsArray.forEach((data) => {
            const tr = document.createElement("tr");
            const quizId = data.examId || data.examCode || "Không rõ";
            
            const correctCount = data.score !== undefined ? data.score : 0;
            const totalQ = data.totalQuestions || data.total || 1;
            
            let displayScore = (correctCount / totalQ) * 10;
            displayScore = Number.isInteger(displayScore) ? displayScore : parseFloat(displayScore.toFixed(2));
            
            const isVipExam = examVipMap[quizId] === true;
            const badgeHtml = isVipExam ? '<span style="background:linear-gradient(135deg, #FFD700 0%, #FDB931 100%);color:#856404;padding:4px 8px;border-radius:6px;font-size:0.7rem;font-weight:bold;margin-left:8px;box-shadow:0 2px 4px rgba(255,215,0,0.3);">PRO</span>' 
                                        : '<span style="background:#e5e7eb;color:#4b5563;padding:4px 8px;border-radius:6px;font-size:0.7rem;font-weight:bold;margin-left:8px;">Free</span>';

            let timeSpentStr = "Không rõ";
            if (data.timeSpent !== undefined) {
                const totalSeconds = parseInt(data.timeSpent, 10);
                const m = Math.floor(totalSeconds / 60);
                const s = totalSeconds % 60;
                timeSpentStr = m + "p " + s + "s";
            }
            
            let submitTime = "Không xác định";
            if (data.timestamp || data.submittedAt) {
                const d = data.timestamp && typeof data.timestamp.toDate === 'function' ? data.timestamp.toDate() : new Date(data.timestamp || data.submittedAt);
                submitTime = d.toLocaleString('vi-VN'); 
            }

            tr.innerHTML = `
                <td><strong style="color: var(--text-main); font-size: 1.05rem;">${quizId}</strong> ${badgeHtml}</td>
                <td><i class="fa-regular fa-clock" style="color: #9ca3af; margin-right: 5px;"></i> ${timeSpentStr}</td>
                <td style="color: #6b7280;">${submitTime}</td>
                <td><span style="background: #f3f4f6; padding: 4px 10px; border-radius: 20px; font-weight: 600; font-size: 0.9rem;">${correctCount} / ${totalQ} câu</span></td>
                <td><span class="score-highlight">${displayScore}</span></td>
                <td>
                    <div class="history-action-btns">
                        <button class="btn-history-action btn-review-modern" onclick="safeRedirect('quiz.html?resultId=${data.id}')" title="Xem chi tiết bài làm">
                            <i class="fa-solid fa-eye"></i> Xem chi tiết
                        </button>
                        <button class="btn-history-action btn-delete-modern btn-delete-history" data-id="${data.id}" title="Xóa vĩnh viễn">
                            <i class="fa-solid fa-trash-can"></i>
                        </button>
                    </div>
                </td>
            `;
            historyTableBody.appendChild(tr);
        });

    } catch (error) {
        console.error("Lỗi khi tải bảng lịch sử:", error);
        if (historyTableBody) {
            historyTableBody.innerHTML = '<tr><td colspan="6" class="loading-text" style="color: var(--danger-red);">Lỗi khi tải dữ liệu lịch sử. Vui lòng tải lại trang!</td></tr>';
        }
    }
}

// =========================================================================
// 3. SỰ KIỆN XÓA BẢN GHI LỊCH SỬ THI (CHỜ LOAD XONG GIAO DIỆN)
// =========================================================================
document.addEventListener('ComponentsLoaded', () => {
    const historyTableBody = document.getElementById("historyTableBody");
    
    if (historyTableBody) {
        historyTableBody.addEventListener('click', async (e) => {
            const deleteBtn = e.target.closest('.btn-delete-history');
            if (deleteBtn) {
                const docId = deleteBtn.getAttribute('data-id');
                if (confirm("Bạn có chắc chắn muốn xóa kết quả bài thi này khỏi lịch sử hệ thống? Hành động này không thể hoàn tác.")) {
                    const originalHtml = deleteBtn.innerHTML;
                    deleteBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
                    deleteBtn.disabled = true;

                    try {
                        await deleteDoc(doc(db, "results", docId));
                        
                        // Cập nhật lại giao diện sau khi xóa
                        if (userEmail) {
                            await fetchHistory(userEmail);
                        }
                    } catch (error) {
                        console.error("Lỗi khi xóa kết quả bài làm:", error);
                        alert("Đã xảy ra lỗi hệ thống khi thực hiện xóa: " + error.message);
                        deleteBtn.innerHTML = originalHtml;
                        deleteBtn.disabled = false;
                    }
                }
            }
        });
    }
});
