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

    if (searchInput) searchInput.addEventListener('input', (e) => { State.currentSearchQuery = e.target.value.toLowerCase(); renderExams(); });
    if (levelPills) levelPills.forEach(pill => pill.addEventListener('click', (e) => { levelPills.forEach(p => p.classList.remove('active')); e.target.classList.add('active'); State.currentLevel = e.target.getAttribute('data-level'); renderExams(); }));
    if (timePills) timePills.forEach(pill => pill.addEventListener('click', (e) => { timePills.forEach(p => p.classList.remove('active')); e.target.classList.add('active'); State.currentTime = e.target.getAttribute('data-time'); renderExams(); }));
    if (sortFilter) sortFilter.addEventListener('change', () => renderExams());
    if (viewBtns) viewBtns.forEach(btn => btn.addEventListener('click', (e) => { viewBtns.forEach(b => b.classList.remove('active')); const targetBtn = e.target.closest('.view-btn'); targetBtn.classList.add('active'); State.currentView = targetBtn.getAttribute('data-view'); renderExams(); }));
    if (subMenuItems) subMenuItems.forEach(item => item.addEventListener('click', (e) => { const tech = item.getAttribute('data-technique'); if (tech) { State.currentTechnique = tech; if(searchInput) searchInput.value = ''; State.currentSearchQuery = ''; renderExams(); } }));
}

export function setupToolbarEvents() {
    const btnOpenCreateRoom = document.getElementById('btnOpenCreateRoom');
    const btnAutoGenerate = document.getElementById('btnAutoGenerate');
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

    if (btnAutoGenerate) {
        btnAutoGenerate.addEventListener('click', async (e) => {
            e.preventDefault(); 
            if (!auth.currentUser) return alert("Vui lòng đăng nhập!");
            const isVip = State.currentUserData && State.currentUserData.isVip;
            if (!isVip) {
                const originalHtml = btnAutoGenerate.innerHTML;
                btnAutoGenerate.disabled = true;
                btnAutoGenerate.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Kiểm tra quyền...';
                try {
                    const examsRef = collection(db, "exams");

                    // TỐI ƯU 1 & 2: Dùng getCountFromServer đếm trực tiếp trên server
                    const countQuery = query(
                        examsRef, 
                        where("creatorId", "==", auth.currentUser.uid),
                        where("technique", "==", "AI Tự Động")
                    );
                    
                    const snapshot = await getCountFromServer(countQuery);
                    const aiCount = snapshot.data().count; 

                    if (aiCount >= 5) {
                        const modal = document.getElementById('aiGenerateModal');
                        if (modal) { modal.classList.remove('active', 'show'); modal.style.display = 'none'; }
                        if (typeof window.showLimitWarningPopup === 'function') window.showLimitWarningPopup(aiCount);
                        return; 
                    }
                    const modal = document.getElementById('aiGenerateModal');
                    if (modal) {
                        modal.querySelectorAll('[value="Khó"]').forEach(el => { el.disabled = true; el.title = "Yêu cầu tài khoản PRO"; if (el.selected || el.checked) { const tb = modal.querySelector('[value="Trung bình"]'); if (tb) tb.selected = true; } });
                    }
                } catch (error) { console.error("Lỗi:", error); alert("Có lỗi xảy ra."); return; } 
                finally { btnAutoGenerate.disabled = false; btnAutoGenerate.innerHTML = originalHtml; }
            } else {
                const modal = document.getElementById('aiGenerateModal');
                if (modal) modal.querySelectorAll('[value="Khó"]').forEach(el => { el.disabled = false; el.removeAttribute('title'); });
            }
            const modal = document.getElementById('aiGenerateModal');
            if (modal) { modal.classList.add('active'); modal.style.display = 'flex'; }
        });
    }

    const closeAiModalBtn = document.getElementById('closeAiModalBtn');
    if (closeAiModalBtn) closeAiModalBtn.addEventListener('click', () => { const m = document.getElementById('aiGenerateModal'); if(m) m.classList.remove('active'); });
    const btnCancelAi = document.getElementById('btnCancelAi');
    if (btnCancelAi) btnCancelAi.addEventListener('click', () => { const m = document.getElementById('aiGenerateModal'); if(m) m.classList.remove('active'); });
    if (btnUploadExam) btnUploadExam.addEventListener('click', () => alert("Tính năng Upload đề thi đang phát triển!"));
}
