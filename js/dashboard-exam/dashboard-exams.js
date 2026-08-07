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
            // F5: Xóa TOÀN BỘ cache để ép hệ thống tải lại dữ liệu mới nhất từ Firestore
            sessionStorage.removeItem(`examCoreCache_${user.uid}`);
            sessionStorage.removeItem(`examExtraCache_${user.uid}`);
            sessionStorage.removeItem(`examMetaCache_${user.uid}`); // BỔ SUNG: Xóa luôn MetaCache (Lượt thi & Rating)
            console.log("F5 Detected: Đã xóa toàn bộ cache Core, Extra và Meta. Dữ liệu sẽ được tải mới hoàn toàn!");
        }
    }

    initModals(); // Kích hoạt các window functions (Popup)
    await fetchUserResultsCache(user); // Tải lịch sử làm bài (Có cache)
    setupToolbarEvents(); // Kích hoạt nút AI, Tạo phòng
    setupFilterEvents(); // Kích hoạt nút Lọc đề
    await loadAggregatedExamData(); // Tải cấu trúc mảng danh sách Đề thi lớn
});
