import { auth, db } from "./dashboard-core.js";
import { doc, getDoc, setDoc, deleteDoc, updateDoc, writeBatch, onSnapshot, collection, getDocs, query, where, serverTimestamp, addDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
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
// TÍNH NĂNG MỚI: MỜI NGƯỜI CHƠI (BẢN FIX LỖI HIỂN THỊ GIAO DIỆN)
// =====================================================================
if (UI.btnOpenInviteModal) {
    UI.btnOpenInviteModal.addEventListener('click', async () => {
        UI.inviteFriendModal.classList.add('active');
        
        // Dựng container hiển thị danh sách người dùng chèn ngay bên dưới ô nhập Email
        let usersContainer = document.getElementById('dynamicUsersContainer');
        if (!usersContainer) {
            usersContainer = document.createElement('div');
            usersContainer.id = 'dynamicUsersContainer';
            usersContainer.style.marginTop = '20px';
            usersContainer.style.marginBottom = '20px';
            usersContainer.style.textAlign = 'left';
            
            // Tìm ô nhập email hiện tại trên giao diện và chèn danh sách xuống dưới nó
            if (UI.inviteEmailInput && UI.inviteEmailInput.parentNode) {
                UI.inviteEmailInput.parentNode.insertBefore(usersContainer, UI.inviteEmailInput.nextSibling);
            }
        }
        
        usersContainer.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; border-top: 1px dashed #cbd5e1; padding-top: 18px;">
                <label style="font-weight: 600; color: #0f172a; margin: 0; font-size: 0.95rem;"><i class="fa-solid fa-users" style="color:#3b82f6;"></i> Mời nhanh người dùng:</label>
                <div style="display: flex; gap: 8px;">
                    <button id="btnSelectAllOnline" style="background: #ecfdf5; color: #059669; border: 1px solid #a7f3d0; padding: 6px 12px; border-radius: 6px; font-size: 0.8rem; font-weight: bold; cursor: pointer; transition: 0.2s;" onmouseover="this.style.background='#d1fae5'" onmouseout="this.style.background='#ecfdf5'">Chọn tất cả Online</button>
                    <button id="btnSelectAllUsers" style="background: #f1f5f9; color: #3b82f6; border: 1px solid #bfdbfe; padding: 6px 12px; border-radius: 6px; font-size: 0.8rem; font-weight: bold; cursor: pointer; transition: 0.2s;" onmouseover="this.style.background='#e0f2fe'" onmouseout="this.style.background='#f1f5f9'">Chọn hết</button>
                </div>
            </div>
            
            <div id="onlineUsersList" style="max-height: 250px; overflow-y: auto; border: 1px solid #e2e8f0; border-radius: 8px; background: #f8fafc; padding: 5px;">
                <div style="text-align:center; color:#64748b; padding: 25px;"><i class="fa-solid fa-spinner fa-spin fa-2x"></i><br><span style="display:block; margin-top:10px;">Đang quét người dùng...</span></div>
            </div>
        `;

        // Lấy dữ liệu và sắp xếp người Online lên trên
        try {
            const usersSnap = await getDocs(collection(db, "users"));
            const onlineListEl = document.getElementById('onlineUsersList');
            let usersHtml = '';
            
            let usersData = [];
            usersSnap.forEach(docSnap => usersData.push(docSnap.data()));
            
            // Sort: Ưu tiên isOnline = true lên đầu
            usersData.sort((a, b) => (b.isOnline === true ? 1 : 0) - (a.isOnline === true ? 1 : 0));

            usersData.forEach(u => {
                // Không hiển thị chính bản thân người đang thao tác
                if (u.email && u.email !== state.currentUser.email) {
                    const isOnline = u.isOnline;
                    const statusHtml = isOnline 
                        ? '<span style="color: #10b981; font-size: 0.75rem; font-weight:600; padding: 2px 6px; background: #d1fae5; border-radius: 10px;"><i class="fa-solid fa-circle" style="font-size: 0.5rem; transform: translateY(-1px);"></i> Online</span>' 
                        : '<span style="color: #94a3b8; font-size: 0.75rem; font-weight:600; padding: 2px 6px; background: #e2e8f0; border-radius: 10px;"><i class="fa-solid fa-circle" style="font-size: 0.5rem; transform: translateY(-1px);"></i> Offline</span>';
                    
                    const cbClass = isOnline ? 'user-invite-cb online-cb' : 'user-invite-cb';

                    usersHtml += `
                        <label style="display: flex; align-items: center; justify-content: space-between; padding: 12px; margin-bottom: 4px; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; cursor: pointer; transition: 0.2s;" onmouseover="this.style.background='#eff6ff'; this.style.borderColor='#bfdbfe';" onmouseout="this.style.background='#ffffff'; this.style.borderColor='#e2e8f0';">
                            <div style="display: flex; align-items: center; gap: 12px;">
                                <input type="checkbox" class="${cbClass}" value="${u.email}" style="cursor: pointer; width: 18px; height: 18px; accent-color: #3b82f6;">
                                <img src="${u.avatarBase64 || u.photoURL || 'https://ui-avatars.com/api/?name='+u.email}" style="width:38px; height:38px; border-radius:50%; border: 2px solid #e2e8f0; object-fit: cover;">
                                <div style="display: flex; flex-direction: column; line-height: 1.4;">
                                    <span style="font-weight: 700; font-size: 0.95rem; color: #1e293b;">${u.displayName || u.email.split('@')[0]}</span>
                                    <div>${statusHtml}</div>
                                </div>
                            </div>
                        </label>
                    `;
                }
            });
            
            if (usersHtml === '') {
                onlineListEl.innerHTML = '<div style="text-align:center; color:#64748b; font-size: 0.9rem; padding: 25px;">Hệ thống chưa có người dùng nào khác.</div>';
            } else {
                onlineListEl.innerHTML = usersHtml;
            }

            // Xử lý sự kiện: Chọn tất cả Online
            const btnSelectOnline = document.getElementById('btnSelectAllOnline');
            if (btnSelectOnline) {
                btnSelectOnline.onclick = (e) => {
                    e.preventDefault();
                    const onlineCheckboxes = document.querySelectorAll('.online-cb');
                    if(onlineCheckboxes.length === 0) {
                        alert("Hiện không có ai đang Online trên hệ thống!");
                        return;
                    }
                    const allChecked = Array.from(onlineCheckboxes).every(cb => cb.checked);
                    onlineCheckboxes.forEach(cb => cb.checked = !allChecked);
                    e.target.innerText = allChecked ? "Chọn tất cả Online" : "Bỏ chọn Online";
                };
            }

            // Xử lý sự kiện: Chọn hết
            const btnSelectAll = document.getElementById('btnSelectAllUsers');
            if (btnSelectAll) {
                btnSelectAll.onclick = (e) => {
                    e.preventDefault();
                    const checkboxes = document.querySelectorAll('.user-invite-cb');
                    const allChecked = Array.from(checkboxes).every(cb => cb.checked);
                    checkboxes.forEach(cb => cb.checked = !allChecked);
                    e.target.innerText = allChecked ? "Chọn hết" : "Bỏ chọn hết";
                    
                    if(btnSelectOnline) {
                        const onlineCheckboxes = document.querySelectorAll('.online-cb');
                        if(onlineCheckboxes.length > 0) {
                            const allOnlineChecked = Array.from(onlineCheckboxes).every(cb => cb.checked);
                            btnSelectOnline.innerText = allOnlineChecked ? "Bỏ chọn Online" : "Chọn tất cả Online";
                        }
                    }
                };
            }
            
        } catch (err) {
            console.error(err);
            document.getElementById('onlineUsersList').innerHTML = '<div style="text-align:center; color:#ef4444; padding: 20px;">Lỗi tải danh sách người dùng.</div>';
        }
    });
}

// Xử lý đóng Modal mời
if (UI.closeInviteModalBtn) {
    UI.closeInviteModalBtn.addEventListener('click', () => {
        UI.inviteFriendModal.classList.remove('active');
    });
}

// Xử lý nút GỬI LỜI MỜI
if (UI.btnSendInvite) {
    UI.btnSendInvite.addEventListener('click', async () => {
        const manualEmail = document.getElementById('inviteEmailInput')?.value.trim();
        const checkboxes = document.querySelectorAll('.user-invite-cb:checked');
        let targetEmails = [];
        
        if (manualEmail) targetEmails.push(manualEmail);
        checkboxes.forEach(cb => targetEmails.push(cb.value));
        
        targetEmails = [...new Set(targetEmails)]; // Lọc loại bỏ email bị trùng lặp
        
        if (targetEmails.length === 0) {
            alert("Vui lòng nhập Email hoặc tick chọn ít nhất 1 người dùng để mời!");
            return;
        }
        
        const originalText = UI.btnSendInvite.innerHTML;
        UI.btnSendInvite.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Đang gửi...';
        UI.btnSendInvite.disabled = true;
        
        try {
            // Đẩy Push Notifications vào bộ lưu trữ Firestore cho những người được tick
            const notifPromises = targetEmails.map(email => {
                // THAY THẾ BẰNG ĐOẠN SAU (Chỉnh sửa 'type' và thêm 'roomId'):
return addDoc(collection(db, "notifications"), {
    toEmail: email,
    title: "🎯 Lời mời thách đấu!",
    message: `${state.currentUser.displayName} vừa mời bạn tham gia phòng thi trực tiếp.\nMã phòng: ${state.roomId}`,
    type: "room_invite", // Đã sửa type cho khớp với bộ lọc notification
    roomId: state.roomId, // Bổ sung roomId để logic click không bị null
    actionUrl: `lobby.html?roomId=${state.roomId}`,
    status: "unread",
    timestamp: serverTimestamp()
});
            
            await Promise.all(notifPromises);
            alert(`Đã gửi thành công lời mời thách đấu tới ${targetEmails.length} người!`);
            UI.inviteFriendModal.classList.remove('active');
            
            // Hủy tick sau khi gửi thành công
            document.querySelectorAll('.user-invite-cb:checked').forEach(cb => cb.checked = false);
            if (document.getElementById('inviteEmailInput')) document.getElementById('inviteEmailInput').value = '';
            
        } catch (err) {
            console.error("Lỗi gửi lời mời:", err);
            alert("Lỗi khi gửi thông báo. Vui lòng thử lại!");
        } finally {
            UI.btnSendInvite.innerHTML = originalText;
            UI.btnSendInvite.disabled = false;
        }
    });
}


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
            state.currentHostRole = roomData.hostRole || 'proctor'; // ĐỌC VÀ LƯU VAI TRÒ CHỦ PHÒNG

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

            // LOGIC ĐIỀU HƯỚNG DỰA VÀO VAI TRÒ
            if (state.currentRoomStatus === 'waiting') {
                state.forceLobbyView = (state.currentHostRole === 'proctor');
                switchUIState('waiting');
            } 
            else if (state.currentRoomStatus === 'playing') {
                if (isHost) {
                    if (state.currentHostRole === 'proctor' || state.forceLobbyView) {
                        switchUIState('waiting'); 
                    } else {
                        if (state.myParticipantStatus !== 'finished') {
                            if (state.myParticipantStatus === 'waiting') await updateDoc(participantRef, { status: 'playing' });
                            window.location.href = `quiz-room.html?examId=${roomData.examId}&roomId=${state.roomId}`;
                        } else {
                            if (!state.forceLobbyView) switchUIState('playing');
                            else switchUIState('waiting');
                        }
                    }
                } else if (state.myParticipantStatus !== 'finished') {
                    if (state.myParticipantStatus === 'waiting') await updateDoc(participantRef, { status: 'playing' });
                    window.location.href = `quiz-room.html?examId=${roomData.examId}&roomId=${state.roomId}`;
                } else {
                    if (!state.forceLobbyView) switchUIState('playing');
                    else switchUIState('waiting');
                }
            } 
        });
    } catch (error) {
        console.error("Lỗi Lobby:", error);
    }
}
