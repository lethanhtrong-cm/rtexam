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
        let resultsArray = [];
        
        // Bước 1: Đẩy dữ liệu vào mảng để xử lý
        querySnapshot.forEach(docSnap => {
            resultsArray.push({ id: docSnap.id, data: docSnap.data() });
        });

        // Bước 2: Sắp xếp tăng dần theo thời gian để tính số thứ tự lần thi chính xác
        resultsArray.sort((a, b) => {
            const tA = a.data.timestamp ? (typeof a.data.timestamp.toDate === 'function' ? a.data.timestamp.toDate().getTime() : new Date(a.data.timestamp).getTime()) : 0;
            const tB = b.data.timestamp ? (typeof b.data.timestamp.toDate === 'function' ? b.data.timestamp.toDate().getTime() : new Date(b.data.timestamp).getTime()) : 0;
            return tA - tB;
        });

        // Bước 3: Đếm số thứ tự lần thi (attempt) trên từng mã đề
        const attemptCounts = {};
        resultsArray.forEach(item => {
            const examCode = item.data.examId || item.data.examCode || item.data.quizId || 'Không rõ';
            if (!attemptCounts[examCode]) attemptCounts[examCode] = 0;
            attemptCounts[examCode]++;
            item.attemptNumber = attemptCounts[examCode];
        });

        // Bước 4: Đảo ngược mảng để hiển thị bài làm mới nhất lên trên cùng (UX)
        resultsArray.reverse();

        // Bước 5: Render ra HTML
        resultsArray.forEach((item) => {
            const data = item.data;
            const examCode = data.examId || data.examCode || data.quizId || 'Không rõ';
            const score = data.score !== undefined ? data.score : 'N/A';
            
            // Trích xuất điểm XP (hỗ trợ fallback nếu trường lưu là earnedXP)
            const xp = data.xp !== undefined ? data.xp : (data.earnedXP || 0);
            
            const examName = cachedExamsMap[examCode];
            const displayTitle = examName 
                ? `<span style="font-weight:600; color:#0f172a;">${examName}</span><br><span style="font-size:11.5px; color:#64748b; font-weight:normal;">(Mã: ${examCode})</span>` 
                : `<strong>${examCode}</strong>`;

            // Tạo nhãn Lần 1 hoặc Ôn tập
            const attemptLabel = item.attemptNumber === 1 
                ? `<span style="color:#10b981; font-size: 10px; font-weight: bold; background: #d1fae5; padding: 2px 6px; border-radius: 4px; display: inline-block; margin-top: 4px;">Lần đầu tiên</span>` 
                : `<span style="color:#f59e0b; font-size: 10px; font-weight: bold; background: #fef3c7; padding: 2px 6px; border-radius: 4px; display: inline-block; margin-top: 4px;">Ôn tập (Lần ${item.attemptNumber})</span>`;

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
                    <td>${displayTitle}<br>${attemptLabel}</td>
                    <td class="text-center">
                        <strong style="color: #ef4444; font-size: 15px;">${score}</strong>
                        <br><span style="font-size: 11px; color: #a16207; display: inline-block; margin-top: 4px; font-weight: bold;"><i class="fa-solid fa-bolt"></i> +${xp} XP</span>
                    </td>
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
