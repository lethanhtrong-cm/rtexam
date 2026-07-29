import { State } from "./exam-state.js";
import { fetchUserResultsCache, loadAggregatedExamData } from "./exam-data.js";
import { setupFilterEvents, setupToolbarEvents } from "./exam-events.js";
import { initModals } from "./exam-modals.js";

// Khởi tạo Bộ kết nối các chức năng
document.addEventListener("authReady", async (e) => {
    State.currentUserData = e.detail.currentUserData;
    const user = e.detail.user;

    if (State.currentUserData) {
        if (!State.currentUserData.bookmarks) State.currentUserData.bookmarks = [];
        if (!State.currentUserData.hiddenExams) State.currentUserData.hiddenExams = [];
    }

    if (user) {
        // KIỂM TRA HÀNH ĐỘNG F5 BẰNG API BROWSER
        const navEntries = performance.getEntriesByType("navigation");
        if (navEntries.length > 0 && navEntries[0].type === "reload") {
            // F5: Chỉ xóa CoreCache (Câu hỏi & Cấu trúc Đề thi)
            // Lượt thi, Rating, Feedback (Nằm ở file exam-data.js) sẽ không bị xóa và được giữ nguyên
            sessionStorage.removeItem(`examCoreCache_${user.uid}`);
            console.log("F5 Detected: Đã xóa cache Core (Đề thi). Giữ nguyên Rating và Lượt thi.");
        }
    }

    initModals(); // Kích hoạt các window functions (Popup)
    await fetchUserResultsCache(user); // Tải lịch sử làm bài (Có cache)
    setupToolbarEvents(); // Kích hoạt nút AI, Tạo phòng
    setupFilterEvents(); // Kích hoạt nút Lọc đề
    await loadAggregatedExamData(); // Tải cấu trúc mảng danh sách Đề thi lớn
});
