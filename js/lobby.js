import { auth, db } from "./dashboard-core.js";
import { doc, getDoc, setDoc, deleteDoc, updateDoc, writeBatch, onSnapshot, collection, getDocs, query, where, serverTimestamp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";

// Import từ các module đã tách
import { state } from "./lobby-modules/lobby-state.js";
import { UI, switchUIState, enhanceLeaderboardUI, renderHistoryLB, renderUI, resetAiForm } from "./lobby-modules/lobby-ui.js";
import { loadExamsToDropdown, parseTimeSafely } from "./lobby-modules/lobby-api.js";

// Khởi tạo và kiểm tra
if (!state.roomId) {
    alert("Không tìm thấy mã phòng hợp lệ!");
    window.location.href = "dashboard.html";
} else {
    if (UI.displayRoomId) UI.displayRoomId.textContent = state.roomId;
}

onAuthStateChanged(auth, (user) => {
    if (user) {
        state.currentUser = {
            uid: user.uid,
            email: user.email,
            displayName: user.displayName || user.email.split('@')[0],
            photoURL: user.photoURL || `https://ui-avatars.com/api/?name=${user.displayName || user.email}&background=random&color=fff`
        };
        if (UI.headerUserName) UI.headerUserName.textContent = state.currentUser.displayName;
        initLobby(); 
    } else {
        window.location.href = "index.html";
    }
});

// =====================================================================
// GẮN SỰ KIỆN CLICK (EVENT LISTENERS)
// =====================================================================

UI.btnBackToLobby.addEventListener('click', () => {
    state.forceLobbyView = true;
    state.viewingHistoryMode = false;
    state.currentViewedExamId = state.currentActiveExamId; 
    switchUIState('waiting');
    renderUI(); 
});

UI.btnCopyRoomCode.addEventListener('click', async () => {
    try {
        await navigator.clipboard.writeText(state.roomId);
        alert("Đã sao chép mã phòng!");
    } catch (err) { console.error("Lỗi copy:", err); }
});

UI.selectExamInLobby.addEventListener('change', async () => {
    const selectedExamId = UI.selectExamInLobby.value;
    const selectedExamName = selectedExamId ? UI.selectExamInLobby.options[UI.selectExamInLobby.selectedIndex].text : null;
    const roomRef = doc(db, 'rooms', state.roomId);
    
    if (selectedExamId) {
        UI.btnStart.removeAttribute('disabled');
        UI.displayExamName.innerHTML = `<i class="fa-solid fa-book-open"></i> ${selectedExamName}`;
    } else {
        UI.btnStart.setAttribute('disabled', 'true');
        UI.displayExamName.innerHTML = `<i class="fa-solid fa-circle-notch fa-spin"></i> Chủ phòng đang cấu hình...`;
    }

    try {
        await updateDoc(roomRef, { examId: selectedExamId || null, examName: selectedExamName, status: 'waiting' });
        try {
            const batch = writeBatch(db);
            const pSnapshot = await getDocs(collection(db, `rooms/${state.roomId}/participants`));
            pSnapshot.forEach((docItem) => {
                batch.update(docItem.ref, { status: 'waiting', score: 0, timeTaken: '00:00' });
            });
            await batch.commit();
        } catch (batchErr) { console.warn("Lỗi reset điểm", batchErr); }
        state.forceLobbyView = false;
    } catch (err) { 
        alert("Lỗi cập nhật phòng: " + err.message);
    }
});

UI.btnStart.addEventListener('click', async () => {
    if (state.currentRoomStatus === 'playing' || state.currentRoomStatus === 'closed') {
        state.forceLobbyView = false;
        state.viewingHistoryMode = false;
        switchUIState('playing'); 
        renderUI();
    } else {
        // TÍNH NĂNG MỚI: CHO PHÉP CHỦ PHÒNG CHỌN CHẾ ĐỘ THI ĐẤU HOẶC GIÁM THỊ
        const isPlaying = confirm("TÙY CHỌN VAI TRÒ:\n\n- Chọn [OK] để TRỰC TIẾP THI ĐẤU cùng mọi người.\n- Chọn [Hủy / Cancel] để làm GIÁM THỊ (Chỉ xem tiến trình).");
        state.forceLobbyView = !isPlaying; // Nếu Cancel (false) -> forceLobbyView = true (Giám thị). Nếu OK (true) -> false (Thi đấu)

        UI.btnStart.setAttribute('disabled', 'true');
        UI.btnStart.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> ĐANG KHỞI ĐỘNG...';
        try {
            await updateDoc(doc(db, 'rooms', state.roomId), { status: 'playing' });
        } catch (error) {
            UI.btnStart.removeAttribute('disabled');
            UI.btnStart.innerHTML = '<i class="fa-solid fa-play"></i> BẮT ĐẦU THI';
        }
    }
});

UI.btnEndRoom.addEventListener('click', async () => {
    if (confirm("Xác nhận TẠO LƯỢT THI MỚI?\nHệ thống sẽ thu bài tất cả người đang thi và làm mới phòng.")) {
        UI.btnEndRoom.disabled = true;
        UI.btnEndRoom.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Đang thu bài...';
        try {
            const roomRef = doc(db, 'rooms', state.roomId);
            await updateDoc(roomRef, { status: 'closed' });
            await new Promise(resolve => setTimeout(resolve, 3000));
            
            UI.btnEndRoom.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Đang lưu lịch sử...';
            const pSnapshot = await getDocs(collection(db, `rooms/${state.roomId}/participants`));
            let finalParticipants = [];
            pSnapshot.forEach(d => finalParticipants.push(d.data()));

            finalParticipants.sort((a, b) => {
                const isAFinished = (a.status === 'finished') ? 1 : 0;
                const isBFinished = (b.status === 'finished') ? 1 : 0;
                if (isAFinished !== isBFinished) return isBFinished - isAFinished; 
                const scoreA = (typeof a.score === 'number') ? a.score : 0;
                const scoreB = (typeof b.score === 'number') ? b.score : 0;
                if (scoreB !== scoreA) return scoreB - scoreA; 
                return parseTimeSafely(a.timeTaken) - parseTimeSafely(b.timeTaken);
            });

            const currentRoomData = (await getDoc(roomRef)).data();
            await setDoc(doc(collection(db, `rooms/${state.roomId}/history`)), {
                examId: currentRoomData.examId || 'N/A',
                examName: currentRoomData.examName || 'N/A',
                createdAt: serverTimestamp(),
                participants: finalParticipants
            });

            const batch = writeBatch(db);
            pSnapshot.forEach((docItem) => {
                batch.update(docItem.ref, { status: 'waiting', score: 0, timeTaken: '00:00', answeredCount: 0 });
            });
            await batch.commit();
            
            // TÍNH NĂNG MỚI: Reset trắng ExamId để chủ phòng chọn đề mới dễ dàng
            await updateDoc(roomRef, { status: 'waiting', examId: null, examName: null });
            UI.selectExamInLobby.value = ""; 
            
            state.forceLobbyView = false;
            state.viewingHistoryMode = false;
            UI.btnEndRoom.disabled = false;
        } catch (error) {
            UI.btnEndRoom.disabled = false;
            alert("Đã xảy ra lỗi khi tạo lượt mới!");
        }
    }
});

// Sự kiện AI 
const closeAiModal = () => UI.aiGenerateModal.classList.remove('active');
UI.btnOpenAiModal.addEventListener('click', () => { UI.aiGenerateModal.classList.add('active'); resetAiForm(); });
if (UI.closeAiModalBtn) UI.closeAiModalBtn.addEventListener('click', closeAiModal);
if (UI.btnCancelAi) UI.btnCancelAi.addEventListener('click', closeAiModal);
UI.aiGenerateModal.addEventListener('click', (e) => { if (e.target === UI.aiGenerateModal) closeAiModal(); });

UI.btnSubmitAiGenerate.addEventListener('click', async () => {
    const prompt = UI.aiPromptInput.value.trim();
    if (!prompt) return alert("Vui lòng nhập chủ đề cần tạo đề!");

    UI.aiFormArea.style.display = 'none';
    UI.aiModalFooter.style.display = 'none';
    UI.aiLoadingSpinner.style.display = 'block';

    try {
        const strictPrompt = prompt + "\n\nYÊU CẦU BẮT BUỘC: Mỗi câu hỏi trắc nghiệm phải có CHÍNH XÁC 4 ĐÁP ÁN (A, B, C, D). Tuyệt đối không được tạo 5 đáp án.";
        const response = await fetch('/api/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ promptText: strictPrompt, questionCount: UI.aiQuestionCount.value, difficulty: UI.aiDifficulty.value })
        });

        if (!response.ok) throw new Error("Lỗi gọi API AI.");
        const questions = await response.json();
        
        const aiExamsSnap = await getDocs(query(collection(db, "exams"), where("technique", "==", "AI Tự Động")));
        const nextNumber = aiExamsSnap.size + 1;
        const examId = "AI-" + String(nextNumber).padStart(3, '0');

        const savePromises = questions.map((q, i) => {
            const safeOptions = q.options.length > 4 ? q.options.slice(0, 4) : q.options;
            let safeCorrectAnswer = q.correctAnswer !== undefined ? q.correctAnswer : (q.correct || 0);
            if (safeCorrectAnswer > 3) safeCorrectAnswer = 0; 

            return setDoc(doc(db, "questions", `${examId}-Q${i + 1}`), {
                examId: examId, text: q.text || "Lỗi AI", options: safeOptions,
                correctAnswer: safeCorrectAnswer, explanation: q.explanation || "Không có giải thích chi tiết", order: i + 1
            });
        });
        await Promise.all(savePromises);

        const examTitle = `Đề AI tạo lúc ${new Date().toLocaleTimeString('vi-VN')}`;

        await setDoc(doc(db, "exams", examId), {
            id: examId, technique: "AI Tự Động", title: examTitle,
            level: 'Trí tuệ nhân tạo', timeLimit: parseInt(UI.aiQuestionCount.value), createdAt: Date.now(),
            isVip: false, attemptCount: 0, creatorId: state.currentUser.uid, isPublic: false
        });

        await updateDoc(doc(db, 'rooms', state.roomId), { 
            examId: examId, examName: `[AI Tự Động] ${examId} - ${examTitle}`, status: 'waiting' 
        });
        
        state.isExamsLoaded = false;
        await loadExamsToDropdown();
        
        UI.selectExamInLobby.insertAdjacentHTML('beforeend', `<optgroup label="✨ ĐỀ THI AI VỪA TẠO"><option value="${examId}">[AI Tự Động] ${examId} - ${examTitle}</option></optgroup>`);
        UI.selectExamInLobby.value = examId;

        alert("Tạo đề AI thành công!");
        closeAiModal();
    } catch (error) {
        alert("Lỗi AI: " + error.message);
        resetAiForm(); 
    }
});

// =====================================================================
// KHỞI TẠO VÀ LẮNG NGHE REALTIME DATABASE
// =====================================================================
async function initLobby() {
    enhanceLeaderboardUI(); 

    const roomRef = doc(db, 'rooms', state.roomId);
    const participantRef = doc(db, `rooms/${state.roomId}/participants/${state.currentUser.uid}`);
    const participantsColl = collection(db, `rooms/${state.roomId}/participants`);

    try {
        const initRoomSnap = await getDoc(roomRef);
        if (!initRoomSnap.exists()) {
            alert("Phòng thi không tồn tại!");
            return window.location.href = "dashboard.html";
        }
        
        const pSnap = await getDoc(participantRef);
        if (pSnap.exists()) {
            await setDoc(participantRef, { displayName: state.currentUser.displayName, photoURL: state.currentUser.photoURL }, { merge: true });
            state.myParticipantStatus = pSnap.data().status || 'waiting';
        } else {
            if (initRoomSnap.data().isLocked === true) {
                alert("Phòng đã bị khóa!");
                return window.location.href = 'dashboard.html';
            }
            await setDoc(participantRef, {
                uid: state.currentUser.uid, displayName: state.currentUser.displayName, photoURL: state.currentUser.photoURL,
                joinedAt: serverTimestamp(), status: 'waiting', score: 0, timeTaken: '00:00'
            });
            state.myParticipantStatus = 'waiting';
        }

        window.addEventListener('beforeunload', () => {
            if (state.currentRoomStatus === 'waiting' && !state.isKicked) deleteDoc(participantRef);
        });

        // LẮNG NGHE HISTORY
        onSnapshot(query(collection(db, `rooms/${state.roomId}/history`)), (snapshot) => {
            const container = document.getElementById('historyListContainer');
            if(!container) return;
            container.innerHTML = '';
            
            const currBtn = document.createElement('div');
            currBtn.className = state.viewingHistoryMode ? 'history-item' : 'history-item active';
            currBtn.innerHTML = `<b><i class="fa-solid fa-play"></i> Lượt hiện tại</b>`;
            currBtn.onclick = () => {
                document.querySelectorAll('.history-item').forEach(el => el.classList.remove('active'));
                currBtn.classList.add('active');
                state.viewingHistoryMode = false;
                state.currentViewedExamId = state.currentActiveExamId; 
                renderUI();
            }
            container.appendChild(currBtn);

            let roundCount = 1;
            snapshot.forEach(doc => {
                const data = doc.data();
                const histBtn = document.createElement('div');
                histBtn.className = 'history-item';
                histBtn.innerHTML = `<b><i class="fa-solid fa-medal" style="color:#f59e0b"></i> Lượt thi ${roundCount}</b><br><small style="color:#6b7280">${data.createdAt ? data.createdAt.toDate().toLocaleString('vi-VN') : ''}</small>`;
                
                histBtn.onclick = () => {
                    document.querySelectorAll('.history-item').forEach(el => el.classList.remove('active'));
                    histBtn.classList.add('active');
                    state.viewingHistoryMode = true;
                    renderHistoryLB(data);
                }
                container.appendChild(histBtn);
                roundCount++;
            });
        });

        // LẮNG NGHE DANH SÁCH NGƯỜI CHƠI
        onSnapshot(participantsColl, (snapshot) => {
            let amIInRoom = false;
            state.currentParticipantsArray = [];
            
            snapshot.forEach(doc => {
                const data = doc.data();
                state.currentParticipantsArray.push(data);
                if (data.uid === state.currentUser.uid) { amIInRoom = true; state.myParticipantStatus = data.status || 'waiting'; }
            });

            if (!amIInRoom && state.currentRoomStatus === 'waiting' && !state.isKicked) {
                state.isKicked = true;
                alert("Bạn đã bị mời ra ngoài.");
                window.location.href = 'dashboard.html';
                return;
            }

            state.currentParticipantsArray.sort((a, b) => {
                const isAFinished = (a.status === 'finished') ? 1 : 0;
                const isBFinished = (b.status === 'finished') ? 1 : 0;
                if (isAFinished !== isBFinished) return isBFinished - isAFinished; 
                const scoreA = (typeof a.score === 'number') ? a.score : 0;
                const scoreB = (typeof b.score === 'number') ? b.score : 0;
                if (scoreB !== scoreA) return scoreB - scoreA; 
                return parseTimeSafely(a.timeTaken) - parseTimeSafely(b.timeTaken);
            });
            renderUI();
        });

        // LẮNG NGHE TRẠNG THÁI PHÒNG
        onSnapshot(roomRef, async (docSnap) => {
            if (!docSnap.exists()) return window.location.href = "dashboard.html";
            
            const roomData = docSnap.data();
            state.currentRoomStatus = roomData.status;
            state.currentHostEmail = roomData.hostEmail;
            state.currentHostUid = roomData.hostUid; 
            state.currentActiveExamId = roomData.examId;
            if (!state.viewingHistoryMode) state.currentViewedExamId = state.currentActiveExamId;

            if (roomData.examId) UI.displayExamName.innerHTML = `<i class="fa-solid fa-book-open"></i> ${roomData.examName || "Đề thi đã chọn"}`;
            else UI.displayExamName.innerHTML = `<i class="fa-solid fa-circle-notch fa-spin"></i> Chủ phòng đang cấu hình...`;

            const isHost = (state.currentHostEmail === state.currentUser.email);
            
            if (isHost) {
                UI.hostPanel.style.display = 'block';
                UI.waitingText.style.display = 'none';
                
                if (state.currentRoomStatus === 'playing' || state.currentRoomStatus === 'closed') {
                    UI.btnEndRoom.style.display = 'block';
                    UI.selectExamInLobby.setAttribute('disabled', 'true');
                    UI.btnStart.style.display = 'block'; 
                    UI.btnStart.innerHTML = '<i class="fa-solid fa-trophy"></i> XEM BẢNG XẾP HẠNG';
                    UI.btnStart.removeAttribute('disabled');
                } else { 
                    UI.btnEndRoom.style.display = 'none';
                    UI.selectExamInLobby.removeAttribute('disabled');
                    UI.btnStart.style.display = 'block'; 
                    UI.btnStart.innerHTML = '<i class="fa-solid fa-play"></i> BẮT ĐẦU THI';
                    if (roomData.examId) UI.btnStart.removeAttribute('disabled');
                    else UI.btnStart.setAttribute('disabled', 'true');
                }

                if (!state.isExamsLoaded) await loadExamsToDropdown();
                if (roomData.examId && UI.selectExamInLobby.value !== roomData.examId) UI.selectExamInLobby.value = roomData.examId;
                else if (!roomData.examId) UI.selectExamInLobby.value = "";
            } else {
                UI.hostPanel.style.display = 'none';
                UI.btnEndRoom.style.display = 'none'; 
                
                if (state.currentRoomStatus === 'playing' || state.currentRoomStatus === 'closed') {
                    if (state.myParticipantStatus === 'finished') {
                        UI.waitingText.style.display = 'none';
                        UI.btnStart.style.display = 'block';
                        UI.btnStart.innerHTML = '<i class="fa-solid fa-trophy"></i> XEM BẢNG XẾP HẠNG';
                        UI.btnStart.removeAttribute('disabled');
                    } else {
                        UI.btnStart.style.display = 'none';
                        UI.waitingText.style.display = 'block';
                        UI.waitingText.textContent = "Bạn đang ở ngoài phòng thi...";
                    }
                } else {
                    UI.btnStart.style.display = 'none';
                    UI.waitingText.style.display = 'block';
                    UI.waitingText.textContent = roomData.examId ? "Đang chờ bắt đầu thi..." : "Đang chờ cấu hình bài thi...";
                }
            }

            renderUI();

            // LOGIC ĐIỀU HƯỚNG MỚI
            if (state.currentRoomStatus === 'waiting') {
                state.forceLobbyView = false;
                switchUIState('waiting');
            } 
            else if (state.currentRoomStatus === 'playing') {
                if (isHost) {
                    if (state.forceLobbyView) {
                        // Chọn làm giám thị -> Ở lại sảnh
                        switchUIState('waiting'); 
                    } else {
                        // Chọn thi đấu -> Kéo vào phòng thi
                        if (state.myParticipantStatus !== 'finished') {
                            if (state.myParticipantStatus === 'waiting') await updateDoc(participantRef, { status: 'playing' });
                            window.location.href = `quiz-room.html?examId=${roomData.examId}&roomId=${state.roomId}`;
                        } else {
                            // Thi xong quay lại sẽ mở bảng xếp hạng
                            if (!state.forceLobbyView) switchUIState('playing');
                            else switchUIState('waiting');
                        }
                    }
                } else if (state.myParticipantStatus !== 'finished') {
                    // Học viên -> bị kéo qua phòng thi làm bài
                    if (state.myParticipantStatus === 'waiting') await updateDoc(participantRef, { status: 'playing' });
                    window.location.href = `quiz-room.html?examId=${roomData.examId}&roomId=${state.roomId}`;
                } else {
                    // Học viên đã xong
                    if (!state.forceLobbyView) switchUIState('playing');
                    else switchUIState('waiting');
                }
            } 
        });
    } catch (error) {
        console.error("Lỗi Lobby:", error);
    }
}
