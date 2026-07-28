// ==========================================
// FILE: admin-user/admin-history.js
// QUẢN LÝ LOGIC TRUY VẤN VÀ HIỂN THỊ LỊCH SỬ THI
// ==========================================
import { db } from '../admin-core.js';
import { 
    collection, query, where, getDocs 
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

let cachedExamsMap = null; // CỜ CACHE CẤU HÌNH ĐỀ THI

export async function handleViewHistory(userEmail) {
    const modal = document.getElementById('historyModal');
    const historyBody = document.getElementById('historyTableBody');
    const modalTitle = document.getElementById('modalTitle');
    
    if (!modal || !historyBody) return;
    
    modalTitle.innerText = `📊 KẾT QUẢ THI: ${userEmail}`;
    historyBody.innerHTML = '<tr><td colspan="3" class="loading-text">⏳ Đang truy vấn cơ sở dữ liệu kết quả thi...</td></tr>';
    modal.style.display = "block";

    try {
        let querySnapshot;
        
        // Tối ưu Quota: Chỉ tải danh sách đề thi 1 lần duy nhất cho toàn bộ phiên làm việc
        if (!cachedExamsMap) {
            const [qSnap, eSnap] = await Promise.all([
                getDocs(query(collection(db, "results"), where("email", "==", userEmail))),
                getDocs(collection(db, "exams"))
            ]);
            querySnapshot = qSnap;
            cachedExamsMap = {};
            eSnap.forEach(docSnap => {
                const exData = docSnap.data();
                if (exData.examName) {
                    cachedExamsMap[docSnap.id] = exData.examName;
                }
            });
        } else {
            // Nếu đã có cache đề thi, chỉ cần tải bài làm của cá nhân đó
            querySnapshot = await getDocs(query(collection(db, "results"), where("email", "==", userEmail)));
        }

        if (querySnapshot.empty) {
            historyBody.innerHTML = '<tr><td colspan="3" class="empty-message">Thành viên này chưa làm bài thi trắc nghiệm nào trên hệ thống.</td></tr>';
            return;
        }

        let htmlContent = '';
        querySnapshot.forEach((docSnap) => {
            const data = docSnap.data();
            const examCode = data.examId || data.examCode || data.quizId || 'Không rõ';
            const score = data.score !== undefined ? data.score : 'N/A';
            
            const examName = cachedExamsMap[examCode];
            const displayTitle = examName 
                ? `<span style="font-weight:600; color:#0f172a;">${examName}</span><br><span style="font-size:11.5px; color:#64748b; font-weight:normal;">(Mã: ${examCode})</span>` 
                : `<strong>${examCode}</strong>`;

            let timeStr = 'Không rõ';
            if (data.timestamp) {
                if (typeof data.timestamp.toDate === 'function') {
                    timeStr = data.timestamp.toDate().toLocaleString('vi-VN');
                } else {
                    timeStr = new Date(data.timestamp).toLocaleString('vi-VN');
                }
            }

            htmlContent += `
                <tr>
                    <td>${displayTitle}</td>
                    <td class="text-center"><strong style="color: #ef4444; font-size: 15px;">${score}</strong></td>
                    <td style="color: #64748b; font-size: 13px;">${timeStr}</td>
                </tr>
            `;
        });

        historyBody.innerHTML = htmlContent;

    } catch (error) {
        console.error("Lỗi tải lịch sử results:", error);
        historyBody.innerHTML = '<tr><td colspan="3" class="empty-message" style="color:red">❌ Thất bại khi truy vấn lịch sử bài làm học viên.</td></tr>';
    }
}
