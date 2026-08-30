import { auth, db } from "../dashboard-core.js";
import { collection, getDocs, query, where, setDoc, doc, serverTimestamp, getCountFromServer } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { State } from "./exam-state.js";
import { renderExams } from "./exam-ui.js";

export function setupFilterEvents() {
    const searchInput = document.getElementById('searchInput');
    const levelPills = document.querySelectorAll('#levelFilter .pill-btn');
    const timePills = document.querySelectorAll('#timeFilter .pill-btn');
    const sortFilter = document.getElementById('sortFilter');
    const viewBtns = document.querySelectorAll('.view-btn');
    const subMenuItems = document.querySelectorAll('.sub-menu-item');

    // Bằng khối code dưới đây (Thêm Debounce 300ms chống lag):
    let searchTimeout = null;
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                State.currentSearchQuery = e.target.value.toLowerCase();
                renderExams();
            }, 300);
        });
    }
    if (levelPills) levelPills.forEach(pill => pill.addEventListener('click', (e) => { levelPills.forEach(p => p.classList.remove('active')); e.target.classList.add('active'); State.currentLevel = e.target.getAttribute('data-level'); renderExams(); }));
    if (timePills) timePills.forEach(pill => pill.addEventListener('click', (e) => { timePills.forEach(p => p.classList.remove('active')); e.target.classList.add('active'); State.currentTime = e.target.getAttribute('data-time'); renderExams(); }));
    if (sortFilter) sortFilter.addEventListener('change', () => renderExams());
    if (viewBtns) viewBtns.forEach(btn => btn.addEventListener('click', (e) => { viewBtns.forEach(b => b.classList.remove('active')); const targetBtn = e.target.closest('.view-btn'); targetBtn.classList.add('active'); State.currentView = targetBtn.getAttribute('data-view'); renderExams(); }));
    if (subMenuItems) subMenuItems.forEach(item => item.addEventListener('click', (e) => { const tech = item.getAttribute('data-technique'); if (tech) { State.currentTechnique = tech; if(searchInput) searchInput.value = ''; State.currentSearchQuery = ''; renderExams(); } }));
}

export function setupToolbarEvents() {
    const btnOpenCreateRoom = document.getElementById('btnOpenCreateRoom');
    const btnUploadExam = document.getElementById('btnUploadExam');

    if (btnOpenCreateRoom) {
        btnOpenCreateRoom.addEventListener('click', async () => {
            if (!auth.currentUser) return alert("Vui lòng đăng nhập để tạo phòng!");
            const originalHtml = btnOpenCreateRoom.innerHTML;
            btnOpenCreateRoom.disabled = true;
            btnOpenCreateRoom.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Đang tạo...';
            try {
                const newRoomId = Math.random().toString(36).substring(2, 8).toUpperCase();
                await setDoc(doc(db, "rooms", newRoomId), { hostEmail: auth.currentUser.email, status: 'waiting', createdAt: serverTimestamp(), examId: null, examName: null, isLocked: false });
                window.location.href = `lobby.html?roomId=${newRoomId}`;
            } catch (error) { console.error("Lỗi tạo phòng:", error); alert("Đã xảy ra lỗi!"); btnOpenCreateRoom.disabled = false; btnOpenCreateRoom.innerHTML = originalHtml; }
        });
    }

    if (btnUploadExam) btnUploadExam.addEventListener('click', () => alert("Tính năng Upload đề thi đang phát triển!"));
}
