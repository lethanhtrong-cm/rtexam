import { db, formatDate, safeRedirect } from "./dashboard-core.js";
import { collection, query, where, getDocs, doc, deleteDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

let userEmail = null;
let examVipMap = {};

window.safeRedirect = safeRedirect;

// =========================================================================
// 1. LẮNG NGHE CÁC SỰ KIỆN
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
// 2. TẢI DỮ LIỆU LỊCH SỬ LÀM BÀI
// =========================================================================
async function fetchHistory(email) {
    const historyTableBody = document.getElementById("historyTableBody");
    const statCompletedExams = document.getElementById("statCompletedExams");
    const statAvgScore = document.getElementById("statAvgScore");

    if (!historyTableBody) return;

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

        resultsArray.sort((a, b) => {
            const dateA = a.timestamp && typeof a.timestamp.toDate === 'function' ? a.timestamp.toDate() : new Date(a.timestamp || a.submittedAt || 0);
            const dateB = b.timestamp && typeof b.timestamp.toDate === 'function' ? b.timestamp.toDate() : new Date(b.timestamp || b.submittedAt || 0);
            return dateB - dateA;
        });

        historyTableBody.innerHTML = ""; 
        
        resultsArray.forEach((data) => {
            const tr = document.createElement("tr");
            const quizId = data.examId || data.examCode || "Không rõ";
            const score = data.score !== undefined ? data.score : 0;
            const correctAnswers = data.correctAnswers !== undefined ? data.correctAnswers : 0;
            
            const isVipExam = examVipMap[quizId] === true;
            const badgeHtml = isVipExam ? '<span style="background:#ffc107;color:#856404;padding:2px 5px;border-radius:4px;font-size:0.75rem;">VIP</span>' 
                                        : '<span style="background:#e2e3e5;color:#383d41;padding:2px 5px;border-radius:4px;font-size:0.75rem;">Free</span>';

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
                <td><strong>${quizId}</strong> ${badgeHtml}</td>
                <td>${timeSpentStr}</td>
                <td>${submitTime}</td>
                <td>${correctAnswers} câu</td>
                <td style="color: var(--primary-blue); font-weight: bold;">${score}</td>
                <td>
                    <button class="btn-review" onclick="safeRedirect('quiz.html?resultId=${data.id}')">
                        <i class="fa-solid fa-eye"></i> Xem lại
                    </button>
                    <button class="btn-delete-history" data-id="${data.id}">
                        <i class="fa-solid fa-trash"></i> Xóa
                    </button>
                </td>
            `;
            historyTableBody.appendChild(tr);
        });

    } catch (error) {
        console.error("Lỗi khi tải bảng lịch sử:", error);
        historyTableBody.innerHTML = '<tr><td colspan="6" class="loading-text" style="color: red;">Lỗi khi tải dữ liệu lịch sử!</td></tr>';
    }
}

// =========================================================================
// 3. ỦY QUYỀN SỰ KIỆN: XÓA LỊCH SỬ THI
// =========================================================================
document.addEventListener('ComponentsLoaded', () => {
    const historyTableBody = document.getElementById("historyTableBody");
    if (historyTableBody) {
        historyTableBody.addEventListener('click', async (e) => {
            const deleteBtn = e.target.closest('.btn-delete-history');
            if (deleteBtn) {
                const docId = deleteBtn.getAttribute('data-id');
                if (confirm("Bạn có chắc chắn muốn xóa kết quả bài thi này khỏi lịch sử hệ thống?")) {
                    try {
                        await deleteDoc(doc(db, "results", docId));
                        alert("Đã xóa kết quả bài thi thành công!");
                        
                        if (userEmail) {
                            await fetchHistory(userEmail);
                        }
                    } catch (error) {
                        console.error("Lỗi khi xóa kết quả bài làm:", error);
                        alert("Đã xảy ra lỗi hệ thống khi thực hiện xóa: " + error.message);
                    }
                }
            }
        });
    }
});
