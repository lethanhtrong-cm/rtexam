import { auth, db, safeRedirect } from "../dashboard-core.js";
import { doc, getDoc, setDoc, updateDoc, arrayUnion, arrayRemove, collection, getDocs, query, where, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { State } from "./exam-state.js";
import { renderExams } from "./exam-ui.js";

// Khởi tạo các hàm toàn cục gắn vào window
export function initModals() {
    window.slideLeft = function(button) { const container = button.parentElement.querySelector('.swimlane-scroll-container'); if (container) container.scrollBy({ left: -364, behavior: 'smooth' }); };
    window.slideRight = function(button) { const container = button.parentElement.querySelector('.swimlane-scroll-container'); if (container) container.scrollBy({ left: 364, behavior: 'smooth' }); };
    window.goToQuiz = function(examId) { safeRedirect(`quiz.html?examId=${examId}`); };
    window.goToReview = function(resultId) { safeRedirect(`quiz.html?resultId=${resultId}`); };
    window.goToFlashcard = function(examId) { window.open(`quiz.html?examId=${examId}&mode=flashcard`, '_blank'); };
    window.goToUpgrade = function() { document.querySelectorAll('.menu-item').forEach(m => m.classList.remove('active')); document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active')); const tabVip = document.getElementById('tab-vip'); if(tabVip) tabVip.classList.add('active'); const title = document.getElementById("currentTabTitle"); if(title) title.textContent = "Nâng Cấp Tài Khoản Pro"; };

    window.toggleBookmark = async function(event, examId) {
        event.stopPropagation();
        if (!auth.currentUser || !State.currentUserData) return alert("Vui lòng đăng nhập để lưu đề thi!");
        const btn = event.currentTarget; const icon = btn.querySelector('i'); const isSaved = btn.classList.contains('saved'); const userDocRef = doc(db, "users", auth.currentUser.uid);
        try {
            if (isSaved) { await updateDoc(userDocRef, { bookmarks: arrayRemove(examId) }); btn.classList.remove('saved'); icon.classList.remove('fa-solid'); icon.classList.add('fa-regular'); State.currentUserData.bookmarks = State.currentUserData.bookmarks.filter(id => id !== examId); } 
            else { await updateDoc(userDocRef, { bookmarks: arrayUnion(examId) }); btn.classList.add('saved'); icon.classList.remove('fa-regular'); icon.classList.add('fa-solid'); if (!State.currentUserData.bookmarks) State.currentUserData.bookmarks = []; State.currentUserData.bookmarks.push(examId); }
            if (State.currentTechnique === 'saved') renderExams();
        } catch (error) { console.error("Lỗi khi lưu đề thi:", error); alert("Đã xảy ra lỗi khi lưu đề thi."); }
    };

    window.hideExam = async function(event, examId) {
        event.stopPropagation();
        if (!auth.currentUser || !State.currentUserData) return alert("Vui lòng đăng nhập để thực hiện chức năng này!");
        if (!confirm('Bạn có chắc chắn muốn ẩn đề AI này khỏi trang của mình không?')) return;
        const userDocRef = doc(db, "users", auth.currentUser.uid);
        try { await updateDoc(userDocRef, { hiddenExams: arrayUnion(examId) }); if (!State.currentUserData.hiddenExams) State.currentUserData.hiddenExams = []; State.currentUserData.hiddenExams.push(examId); State.allExamsData = State.allExamsData.filter(e => e.id !== examId); renderExams(); } 
        catch (error) { console.error("Lỗi khi ẩn đề thi:", error); alert("Đã xảy ra lỗi khi cố gắng ẩn đề thi."); }
    };

   window.openShareModal = function(examId) {
        State.currentShareExamId = examId;
        // Cố định link chia sẻ trỏ về tên miền mới theo yêu cầu
        document.getElementById('shareLinkInput').value = `https://exam.ktv3mien.com/quiz.html?examId=${examId}`;
        document.getElementById('shareEmailInput').value = '';
        document.getElementById('shareExamModal').classList.add('active');
    };

    window.copyShareLink = function() {
        const copyText = document.getElementById('shareLinkInput');
        copyText.select(); copyText.setSelectionRange(0, 99999); 
        try { document.execCommand('copy'); alert("Đã copy link thành công!"); } catch (err) { alert("Lỗi khi copy link."); }
    };

    window.sendShareNotification = async function() {
        const toEmail = document.getElementById('shareEmailInput').value.trim();
        if (!toEmail) return alert("Vui lòng nhập Email người nhận!");
        if (!auth.currentUser || !auth.currentUser.email) return alert("Lỗi gửi thông báo. Vui lòng tải lại trang.");
        if (toEmail === auth.currentUser.email) return alert("Bạn không thể tự gửi thông báo cho chính mình.");

        try {
            await addDoc(collection(db, "notifications"), { examId: State.currentShareExamId, fromEmail: auth.currentUser.email, toEmail: toEmail, status: 'unread', timestamp: serverTimestamp(), type: 'exam_share' });
            alert("Đã gửi thông báo chia sẻ thành công tới " + toEmail);
            document.getElementById('shareExamModal').classList.remove('active');
        } catch (error) { console.error("Lỗi:", error); alert("Đã xảy ra lỗi khi gửi."); }
    };

    window.showLimitWarningPopup = function(count) {
        let popup = document.getElementById('limitWarningPopup');
        if (!popup) {
            const html = `
            <div id="limitWarningPopup" style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(15, 23, 42, 0.75); z-index: 100000; display: flex; align-items: center; justify-content: center; backdrop-filter: blur(4px); animation: popIn 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);">
                <div style="background: #ffffff; width: 90%; max-width: 420px; border-radius: 16px; padding: 30px; text-align: center; box-shadow: 0 20px 40px rgba(0,0,0,0.3);">
                    <div style="width: 70px; height: 70px; background: #fee2e2; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 20px;"><i class="fa-solid fa-lock" style="font-size: 2.2rem; color: #ef4444;"></i></div>
                    <h3 style="color: #0f172a; margin-bottom: 12px; font-size: 1.4rem; font-weight: 800;">Đã đạt giới hạn Free</h3>
                    <p style="color: #475569; margin-bottom: 25px; line-height: 1.6; font-size: 1.05rem;">Tài khoản Free chỉ được tạo tối đa 5 đề AI (bạn đã tạo <strong style="color:#ef4444;" id="popupAiCountDisplay">${count}</strong>/5).<br>Vui lòng nâng cấp PRO để không giới hạn!</p>
                    <div style="display: flex; gap: 12px;">
                        <button onclick="document.getElementById('limitWarningPopup').style.display='none'" style="flex: 1; padding: 12px; border: none; background: #e2e8f0; color: #475569; border-radius: 10px; font-weight: 600; cursor: pointer;">Đóng lại</button>
                        <button onclick="document.getElementById('limitWarningPopup').style.display='none'; goToUpgrade();" style="flex: 1; padding: 12px; border: none; background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); color: white; border-radius: 10px; font-weight: 600; cursor: pointer;"><i class="fa-solid fa-crown"></i> Nâng cấp PRO</button>
                    </div>
                </div>
            </div>`;
            document.body.insertAdjacentHTML('beforeend', html);
        } else {
            document.getElementById('popupAiCountDisplay').innerText = count;
            popup.style.display = 'flex';
        }
    };

    window.openSummaryModal = async function(examId) {
        if (!document.getElementById('summaryModal')) {
            const html = `
            <div id="summaryModal" style="display:none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(15, 23, 42, 0.7); z-index: 100000; align-items: center; justify-content: center; backdrop-filter: blur(5px);">
                <div style="background: #ffffff; width: 90%; max-width: 750px; max-height: 85vh; border-radius: 16px; display: flex; flex-direction: column; overflow: hidden; box-shadow: 0 20px 40px rgba(0,0,0,0.3); animation: popIn 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);">
                    <div style="padding: 20px 25px; border-bottom: 1px solid #e5e7eb; display: flex; justify-content: space-between; align-items: center; background: linear-gradient(135deg, #2563eb 0%, #1e40af 100%); color: white;">
                        <div><h3 style="margin: 0; font-size: 1.3rem; font-weight: 800;"><i class="fa-solid fa-book-open-reader"></i> TÓM TẮT KIẾN THỨC</h3><div id="summaryExamCode" style="font-size: 0.85rem; font-weight: 600; margin-top: 5px; opacity: 0.9;"></div></div>
                        <button onclick="document.getElementById('summaryModal').style.display='none'" style="background: rgba(255,255,255,0.2); border: none; color: white; width: 36px; height: 36px; border-radius: 50%; font-size: 1.2rem; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: 0.2s;"><i class="fa-solid fa-xmark"></i></button>
                    </div>
                    <div id="summaryContent" style="padding: 30px; overflow-y: auto; flex: 1; font-size: 1.05rem; line-height: 1.7; color: #334155;"></div>
                </div>
            </div>
            <style>@keyframes popIn { from { transform: scale(0.9); opacity: 0; } to { transform: scale(1); opacity: 1; } } #summaryContent h3 { color: #1e40af; margin-top: 25px; margin-bottom: 15px; font-size: 1.2rem; border-left: 4px solid #3b82f6; padding-left: 10px; } #summaryContent ul { margin-bottom: 20px; padding-left: 20px; } #summaryContent li { margin-bottom: 8px; } #summaryContent strong { color: #0f172a; }</style>`;
            document.body.insertAdjacentHTML('beforeend', html);
        }

        const modal = document.getElementById('summaryModal');
        const content = document.getElementById('summaryContent');
        document.getElementById('summaryExamCode').innerText = "Mã đề: " + examId;
        modal.style.display = 'flex';
        content.innerHTML = `<div style="text-align: center; padding: 60px 20px;"><i class="fa-solid fa-wand-magic-sparkles fa-bounce" style="font-size: 3.5rem; color: #3b82f6; margin-bottom: 20px;"></i><h4 style="color: #1e293b; margin-bottom: 10px;">AI đang trích xuất kiến thức...</h4><p style="color: #64748b; font-size: 0.95rem;">Quá trình này tốn khoảng 5-10 giây cho lần khởi tạo đầu tiên.</p></div>`;

        try {
            const summaryRef = doc(db, "summaries", examId);
            const summarySnap = await getDoc(summaryRef);
            if (summarySnap.exists()) { content.innerHTML = summarySnap.data().htmlContent; return; }

            const qSnap = await getDocs(query(collection(db, "questions"), where("examId", "==", examId)));
            if (qSnap.empty) { content.innerHTML = '<p style="color: #dc2626; text-align: center; font-weight: bold;">Đề thi này chưa có câu hỏi nào để tóm tắt.</p>'; return; }

            const questions = qSnap.docs.map(d => d.data());
            let promptString = questions.map((q, idx) => `[Câu ${idx + 1}] Hỏi: ${q.text} | Đáp án: ${q.options ? q.options[q.correctAnswer] : ''} | Giải thích: ${q.explanation || 'Không'}`).join('\n\n');

            const response = await fetch('/api/generate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ promptText: promptString, action: 'summary' }) });
            if (!response.ok) throw new Error("Lỗi kết nối với AI Backend.");
            const aiData = await response.json();
            const summaryHtml = aiData.summary;
            if (!summaryHtml) throw new Error("AI không trả về dữ liệu hợp lệ.");

            await setDoc(summaryRef, { examId: examId, htmlContent: summaryHtml, createdAt: serverTimestamp() });
            content.innerHTML = summaryHtml;
        } catch (error) {
            console.error(error);
            content.innerHTML = `<div style="text-align: center; padding: 40px; color: #dc2626;"><i class="fa-solid fa-triangle-exclamation fa-3x mb-3"></i><p>Đã xảy ra lỗi: ${error.message}</p></div>`;
        }
    };
}
