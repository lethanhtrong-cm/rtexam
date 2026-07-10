// HÀM TRUY VẤN FIRESTORE VÀ HIỂN THỊ MODAL CHI TIẾT CÂU HỎI
async function fetchAndShowQuestionDetail(questionId) {
    // 1. Quy tắc hệ thống: Kiểm tra bắt buộc phải có tài khoản đăng nhập (auth.currentUser)
    if (!auth.currentUser) {
        alert("⛔ Lỗi bảo mật: Bạn cần đăng nhập với quyền Admin để xem chi tiết câu hỏi.");
        return;
    }

    const modal = document.getElementById('question-detail-modal');
    const loadingDiv = document.getElementById('qd-loading');
    const contentDiv = document.getElementById('qd-content');
    
    if (!modal) {
        showToast("Lỗi: Không tìm thấy HTML của Modal.", "error");
        return;
    }

    // Hiển thị modal ở trạng thái loading (ẩn nội dung cũ để tránh chớp dữ liệu)
    modal.style.display = 'block';
    loadingDiv.style.display = 'block';
    contentDiv.style.display = 'none';

    try {
        // Truy vấn vào document trong collection 'questions'
        const docRef = doc(db, "questions", questionId);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            const data = docSnap.data();
            
            // 2. Logic dự phòng cho Nội dung câu hỏi (Quét qua các trường phổ biến)
            const questionText = data.text || data.questionText || data.question || data.content || "Không có nội dung";
            document.getElementById('qd-text').innerText = questionText;

            // 3. Logic dự phòng cho 4 Đáp án (Xử lý mảng options hoặc answers)
            const optionsArray = data.options || data.answers || [];
            
            // Các thẻ HTML tương ứng với A, B, C, D
            const domOptions = [
                document.getElementById('qd-optA'),
                document.getElementById('qd-optB'),
                document.getElementById('qd-optC'),
                document.getElementById('qd-optD')
            ];

            if (optionsArray.length > 0) {
                // Lặp qua mảng và đổ dữ liệu vào tối đa 4 thẻ (A, B, C, D)
                for (let i = 0; i < 4; i++) {
                    if (domOptions[i]) {
                        domOptions[i].innerText = optionsArray[i] ? optionsArray[i] : "Không có dữ liệu đáp án";
                    }
                }
            } else {
                // Nếu mảng rỗng hoàn toàn hoặc không tồn tại
                for (let i = 0; i < 4; i++) {
                    if (domOptions[i]) {
                        domOptions[i].innerText = "Không có dữ liệu đáp án";
                    }
                }
            }

            // 4. Logic cho Đáp án đúng & Giải thích (Giữ nguyên)
            document.getElementById('qd-correct').innerText = data.correctAnswer || data.correct || "Chưa thiết lập";
            document.getElementById('qd-explanation').innerText = data.explanation || data.explain || "Không có giải thích cho câu hỏi này.";

            // Ẩn trạng thái loading, hiện nội dung thật
            loadingDiv.style.display = 'none';
            contentDiv.style.display = 'block';
        } else {
            // Trường hợp document không tồn tại (admin đã xóa trước đó)
            modal.style.display = 'none';
            alert("⚠️ Câu hỏi này không còn tồn tại trên hệ thống (Có thể đã bị xóa).");
        }
    } catch (error) {
        console.error("Lỗi khi tải chi tiết câu hỏi:", error);
        modal.style.display = 'none';
        showToast("Lỗi khi kết nối đến cơ sở dữ liệu.", "error");
    }
}
