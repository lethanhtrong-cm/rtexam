import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, collection, getDocs, addDoc, query, where, doc, getDoc, setDoc, increment, serverTimestamp, updateDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// ĐÃ CHIA NHỎ: Import các module xử lý giao diện và Flashcard
import { redirect, showToast, initThemeToggle, initMobilePanel } from './quiz-modules/quiz-utils.js';
import { initFlashcard } from './quiz-modules/quiz-flashcard.js';

const firebaseConfig = {
    apiKey: "AIzaSyDqdo_DJIWa5iqxiCgBq-0iGX7f9sr6soo",
    authDomain: "rt-examination.firebaseapp.com",
    projectId: "rt-examination",
    storageBucket: "rt-examination.firebasestorage.app",
    messagingSenderId: "920482699854",
    appId: "1:920482699854:web:44f9b0d735bdc001c6c11f",
    measurementId: "G-8N7RTTREQM"
};

let questions = [];
let auth, db;
let currentIndex = 0;
let userAnswers = {};
let flaggedQuestions = {}; 

let isSubmitted = false;
let currentUser = null; 
let isShowExplanation = false;

// CỜ THEO DÕI ĐIỀU HƯỚNG ĐỂ CHỐNG XUNG ĐỘT TRẠNG THÁI ONLINE
let isNavigating = false; 

let timerInterval;
let examDuration = 15 * 60; 
let timeRemaining = examDuration;
let currentDifficulty = 'medium'; // Thêm biến lưu độ khó của đề thi

let finalScore = 0;
let finalCorrectCount = 0;
let finalTotal = 0;

let reportingQuestionId = null;
let reportingQuestionText = "";

const app = initializeApp(firebaseConfig);
auth = getAuth(app);
db = getFirestore(app); 

const urlParams = new URLSearchParams(window.location.search);
let currentExamId = urlParams.get('examId'); 
const currentResultId = urlParams.get('resultId'); 
const currentRoomId = urlParams.get('roomId'); 
const currentMode = urlParams.get('mode');

// Khởi tạo các thành phần giao diện từ Module
initThemeToggle();
initMobilePanel();

// Khởi tạo Module Flashcard và cung cấp State cho nó (Dependency Injection)
const flashcardAPI = initFlashcard(db, () => ({
    currentExamId,
    currentUser,
    questions,
    currentMode,
    showToast,
    returnToLobbyOrDashboard
}));

async function returnToLobbyOrDashboard() {
    isNavigating = true; // Kích hoạt cờ để hàm beforeunload bỏ qua việc ghi Offline
    if (currentUser && !isSubmitted) {
        try {
            const userRef = doc(db, "users", currentUser.uid);
            await updateDoc(userRef, { examStatus: 'idle' });
        } catch (err) { console.error(err); }
    }
    if (currentRoomId) redirect(`lobby.html?roomId=${currentRoomId}`);
    else redirect('dashboard.html');
}

let warningCount = 0;

function updateAntiCheatState() {
    if (!isSubmitted && !isShowExplanation && currentMode !== 'flashcard') document.body.classList.add('no-select');
    else document.body.classList.remove('no-select');
}

['contextmenu', 'copy', 'cut', 'paste'].forEach(evt => {
    document.addEventListener(evt, (e) => {
        if (!isSubmitted && !isShowExplanation && currentMode !== 'flashcard') {
            e.preventDefault();
            showToast("⚠️ Hành động này bị vô hiệu hóa trong phòng thi!");
        }
    });
});

document.addEventListener('visibilitychange', () => {
    if (document.hidden && !isSubmitted && !isShowExplanation && currentMode !== 'flashcard' && !document.getElementById('reviewExamModal').classList.contains('active')) {
        warningCount++;
        const warningModal = document.getElementById('cheat-warning-modal');
        const warningText = document.getElementById('cheat-warning-text');
        
        if (warningCount >= 3) {
            warningText.innerHTML = `<b>Vi phạm lần ${warningCount}:</b> Bạn vừa rời khỏi phòng thi!<br><br>Bạn đã vi phạm quá 3 lần, hệ thống sẽ tự động thu bài.`;
            document.getElementById('btn-close-warning').innerText = "Đóng & Nộp bài";
            warningModal.classList.add('active');
            document.getElementById('btn-close-warning').onclick = () => { warningModal.classList.remove('active'); };
            executeSubmit();
        } else {
            warningText.innerHTML = `<b>Vi phạm lần ${warningCount}:</b> Bạn vừa rời khỏi phòng thi!<br><br>Nếu vi phạm quá 3 lần, hệ thống sẽ tự động thu bài.`;
            document.getElementById('btn-close-warning').innerText = "Tôi đã hiểu";
            warningModal.classList.add('active');
            document.getElementById('btn-close-warning').onclick = () => { warningModal.classList.remove('active'); };
        }
    }
});

function getDraftKey() { return `quiz_draft_${currentExamId}_${currentUser.uid}`; }

function saveDraft() {
    if (isSubmitted || !currentUser || !currentExamId || currentMode === 'flashcard') return;
    const draft = { userAnswers, flaggedQuestions, timeRemaining, currentIndex };
    localStorage.setItem(getDraftKey(), JSON.stringify(draft));
}

function loadDraft() {
    if (!currentUser || !currentExamId || currentMode === 'flashcard') return false;
    const draftStr = localStorage.getItem(getDraftKey());
    if (draftStr) {
        try {
            const draft = JSON.parse(draftStr);
            userAnswers = draft.userAnswers || {};
            flaggedQuestions = draft.flaggedQuestions || {};
            if (draft.timeRemaining) timeRemaining = draft.timeRemaining;
            if (draft.currentIndex !== undefined) currentIndex = draft.currentIndex;
            return true;
        } catch(e) {}
    }
    return false;
}

function clearDraft() { if (currentUser && currentExamId) localStorage.removeItem(getDraftKey()); }

onAuthStateChanged(auth, (user) => {
    if (!user || user.isAnonymous) {
        localStorage.setItem('redirectAfterLogin', window.location.href);
        redirect('index.html');
    } else {
        currentUser = user;
        if (currentResultId) {
            loadReviewMode(currentResultId);
        } else if (currentExamId) {
            document.getElementById('quiz-title-display').innerText = `Bài thi: ${currentExamId}`;
            if (currentMode === 'flashcard') {
                loadFlashcardMode();
            } else {
                loadExamDataAndQuestions();
            }
        }
    }
});

async function loadFlashcardMode() {
    document.getElementById('skeleton-container').classList.add('active');
    document.getElementById('real-content').classList.add('hidden');
    document.getElementById('timer-container-box').style.display = 'none';

    try {
        await fetchQuestionsFromFirestore();
        document.getElementById('skeleton-container').classList.remove('active');
        
        // Gọi hàm từ Module flashcard để kích hoạt hiển thị
        if (flashcardAPI) flashcardAPI.triggerCreate();
        
    } catch (error) {
        document.getElementById('skeleton-container').classList.remove('active');
        document.getElementById('real-content').classList.remove('hidden');
        document.getElementById('question-text').innerText = `Lỗi hệ thống: ${error.message}`;
    }
}

async function loadExamDataAndQuestions() {
    document.getElementById('skeleton-container').classList.add('active');
    document.getElementById('real-content').classList.add('hidden');
    
    try {
        const examDocRef = doc(db, "exams", currentExamId);
        const examDoc = await getDoc(examDocRef);
        
        if (examDoc.exists()) {
            const examData = examDoc.data();
            if (examData.timeLimit) examDuration = examData.timeLimit * 60; 
            if (examData.difficulty) currentDifficulty = String(examData.difficulty).toLowerCase(); // Lấy độ khó
        }
        await fetchQuestionsFromFirestore();
        initExamState(); 
    } catch (error) {
        document.getElementById('skeleton-container').classList.remove('active');
        document.getElementById('real-content').classList.remove('hidden');
        document.getElementById('question-text').innerText = `Lỗi tải đề thi: ${error.message}`;
    }
}

async function initExamState() {
    isSubmitted = false;
    isShowExplanation = false;
    warningCount = 0;
    
    const hasDraft = loadDraft();
    if (!hasDraft) {
        currentIndex = 0;
        userAnswers = {};
        flaggedQuestions = {};
        timeRemaining = examDuration;
    } else {
        showToast("Đã khôi phục trạng thái bài làm trước đó!");
    }
    
    updateAntiCheatState(); 
    
    const btnSubmit = document.getElementById('btn-submit-exam');
    btnSubmit.disabled = false; 
    btnSubmit.innerText = "Nộp bài ngay"; 
    btnSubmit.onclick = () => submitExam(false);

    if (currentRoomId && currentUser) {
        const participantRef = doc(db, "rooms", currentRoomId, "participants", currentUser.uid);
        setDoc(participantRef, { status: 'playing' }, { merge: true }).catch(e => console.error(e));
    }

    if (currentUser) {
        try {
            const userRef = doc(db, "users", currentUser.uid);
            await updateDoc(userRef, { examStatus: 'testing', isOnline: true });
        } catch (err) {}
    }

    document.getElementById('skeleton-container').classList.remove('active');
    document.getElementById('real-content').classList.remove('hidden');

    renderAll();
    startTimer();
}

async function loadReviewMode(resultId) {
    document.getElementById('skeleton-container').classList.add('active');
    document.getElementById('real-content').classList.add('hidden');

    try {
        const resultDocRef = doc(db, "results", resultId);
        const resultDoc = await getDoc(resultDocRef);

        if (!resultDoc.exists()) throw new Error("Không tìm thấy kết quả bài làm trên hệ thống.");

        const resultData = resultDoc.data();
        currentExamId = resultData.examId;
        userAnswers = resultData.savedAnswers || {}; 
        isSubmitted = true;
        isShowExplanation = true;
        updateAntiCheatState(); 

        document.getElementById('quiz-title-display').innerText = `Xem lại bài thi: ${currentExamId}`;
        document.getElementById('timer-container-box').style.display = 'none'; 
        
        await fetchQuestionsFromFirestore();
        
        document.getElementById('skeleton-container').classList.remove('active');
        document.getElementById('real-content').classList.remove('hidden');

        openReviewModal(resultData.score, resultData.correctCount, resultData.totalQuestions);
    } catch (error) {
        document.getElementById('skeleton-container').classList.remove('active');
        document.getElementById('real-content').classList.remove('hidden');
        document.getElementById('question-text').innerText = `Lỗi hệ thống: ${error.message}`;
    }
}

async function fetchQuestionsFromFirestore() {
    document.getElementById('options-container').innerHTML = ''; 
    const questionsRef = collection(db, "questions");
    const q = query(questionsRef, where("examId", "==", currentExamId));
    
    const querySnapshot = await getDocs(q);
    const fetched = querySnapshot.docs.map(doc => { return { id: doc.id, ...doc.data() }; });
    
    if (fetched.length > 0) {
        questions = fetched.sort((a,b) => a.order - b.order);
    } else {
        throw new Error(`Không tìm thấy câu hỏi nào cho mã đề: ${currentExamId}`);
    }
}

function playBeepWarning() {
    try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(600, ctx.currentTime);
        osc.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.1);
    } catch(e) {}
}

function startTimer() {
    clearInterval(timerInterval);
    updateTimerDisplay();

    timerInterval = setInterval(() => {
        timeRemaining--;
        updateTimerDisplay();
        
        if (timeRemaining % 10 === 0) saveDraft();

        if (timeRemaining <= 0) {
            clearInterval(timerInterval);
            submitExam(true); 
        }
    }, 1000);
}

function stopTimer() { clearInterval(timerInterval); }

function updateTimerDisplay() {
    const minutes = Math.floor(timeRemaining / 60).toString().padStart(2, '0');
    const seconds = (timeRemaining % 60).toString().padStart(2, '0');
    document.getElementById('countdown').innerText = `${minutes}:${seconds}`;
    
    const timerBox = document.getElementById('timer-container-box');
    if (timeRemaining <= 60 && timeRemaining > 0) {
        timerBox.classList.add('timer-warning');
        if (timeRemaining <= 30 && timeRemaining % 2 === 0) playBeepWarning();
    } else {
        timerBox.classList.remove('timer-warning');
    }
}

// =========================================================================
// HÀM HELPER HỖ TRỢ BỘ LỌC THỜI GIAN DB
// =========================================================================
function getCurrentMonthKey() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    return `xp_${year}_${month}`;
}

function getCurrentWeekKey() {
    const now = new Date();
    const startDate = new Date(now.getFullYear(), 0, 1);
    const days = Math.floor((now - startDate) / (24 * 60 * 60 * 1000));
    const weekNumber = Math.ceil((now.getDay() + 1 + days) / 7);
    return `xp_${now.getFullYear()}_W${weekNumber.toString().padStart(2, '0')}`;
}

async function executeSubmit() {
    stopTimer(); 
    isSubmitted = true; 
    clearDraft(); 
    updateAntiCheatState(); 
    
    finalTotal = questions.length;
    const timeSpent = examDuration - timeRemaining; 
    
    const btnSubmit = document.getElementById('btn-submit-exam');
    btnSubmit.disabled = true; 
    btnSubmit.innerText = "Đang xử lý..."; 

    finalCorrectCount = 0;
    questions.forEach((question, idx) => {
        if (userAnswers[idx] === question.correctAnswer) finalCorrectCount++;
    });

    finalScore = Math.round(((finalCorrectCount / finalTotal) * 10) * 100) / 100; 

    // Biến toàn cục dùng cho XP Logic
    let gainedXP = 0;
    let xpMessage = "";
    let isRetake = false;
    let isNewRecord = false;
    let totalRawXP = 0;

    try {
        const resultsRef = collection(db, "results");
        const qResult = query(resultsRef, where("email", "==", currentUser.email), where("examId", "==", currentExamId));
        const resultSnapshot = await getDocs(qResult);
        
        if (finalTotal > 0) {
            
            let wrongOrEmptyCount = finalTotal - finalCorrectCount;

            // 1. Tính điểm cơ bản & Phạt điểm (10 điểm đúng, -2 điểm sai/bỏ trống)
            let baseXP = (finalCorrectCount * 10) - (wrongOrEmptyCount * 2);
            if (baseXP < 0) baseXP = 0; 
            
            let accuracyRate = finalCorrectCount / finalTotal;

            // 2. Xét Ngưỡng kích hoạt hệ số 75%
            let difficultyMultiplier = 1.0;
            if (accuracyRate >= 0.75) {
                if (currentDifficulty === 'hard') difficultyMultiplier = 1.5;
                else if (currentDifficulty === 'medium') difficultyMultiplier = 1.2;
            }

            // 3. Thưởng hoàn thành trọn vẹn 100% & 4. Thưởng tốc độ
            let perfectBonus = 0;
            let speedBonus = 0;

            if (accuracyRate === 1) {
                perfectBonus = 100; // Flat Bonus cực lớn cho 100%
                
                // Thưởng tốc độ tỉ lệ thuận với thời gian còn lại (Tối đa nhận 50 XP)
                speedBonus = Math.round((timeRemaining / examDuration) * 50);
            }if (accuracyRate === 1) {
                perfectBonus = 100; // Flat Bonus cực lớn cho 100%
                
                // Thưởng tốc độ tỉ lệ thuận với thời gian còn lại (Tối đa nhận 50 XP)
                speedBonus = Math.round((timeRemaining / examDuration) * 50);
            }

            // Tổng XP thô nhận được từ lần làm này
            totalRawXP = Math.round((baseXP * difficultyMultiplier) + perfectBonus + speedBonus);
            if (totalRawXP < 0) totalRawXP = 0;

            // 5. Phân loại luồng xử lý: Làm lần đầu hay Ôn tập
            if (resultSnapshot.empty) {
                gainedXP = totalRawXP;
                xpMessage = `🎉 Xuất sắc! Bạn nhận được +${gainedXP} XP cho bài thi này!`;
            } else {
                isRetake = true;
                
                // Quét điểm thô cao nhất trong lịch sử ôn tập đề này
                let previousBestRawXP = 0;
                resultSnapshot.forEach(doc => {
                    let data = doc.data();
                    if (data.earnedXP && data.earnedXP > previousBestRawXP) {
                        previousBestRawXP = data.earnedXP;
                    }
                });
                
                if (totalRawXP > previousBestRawXP) {
                    isNewRecord = true;
                    gainedXP = totalRawXP - previousBestRawXP;
                    xpMessage = `🔥 Kỷ lục mới! Bạn nhận thêm phần chênh lệch +${gainedXP} XP!`;
                } else {
                    gainedXP = 5; // Điểm chuyên cần
                    xpMessage = `💡 Ôn tập tốt! Nhận +${gainedXP} XP điểm chuyên cần.`;
                }
            }

            // 6. Cập nhật Leaderboard (Hỗ trợ cấu trúc DB bộ lọc Tháng/Tuần)
            if (gainedXP > 0) {
                const leaderboardRef = doc(db, "users_leaderboard", currentUser.uid);
                const monthKey = getCurrentMonthKey();
                const weekKey = getCurrentWeekKey();

                await setDoc(leaderboardRef, {
                    displayName: currentUser.displayName || currentUser.email.split('@')[0],
                    email: currentUser.email,
                    photoURL: currentUser.photoURL || "",
                    totalXP: increment(gainedXP),
                    [monthKey]: increment(gainedXP),
                    [weekKey]: increment(gainedXP)
                }, { merge: true });
                showToast(xpMessage);
            }
        }
    } catch (xpError) { console.error("Lỗi cập nhật XP:", xpError); }

    if (currentRoomId && currentUser) {
        try {
            const participantRef = doc(db, "rooms", currentRoomId, "participants", currentUser.uid);
            await setDoc(participantRef, { status: 'finished', score: finalScore, timeTaken: timeSpent }, { merge: true });
        } catch (roomErr) {}
    }

    if (currentUser) {
        try {
            const userRef = doc(db, "users", currentUser.uid);
            await updateDoc(userRef, { examStatus: 'idle' });
        } catch (err) {}
    }

    renderAll(); 
    btnSubmit.innerText = "Đã nộp bài";

    try {
        await addDoc(collection(db, "results"), {
            email: currentUser.email, examId: currentExamId, score: finalScore,
            correctCount: finalCorrectCount, totalQuestions: finalTotal,
            earnedXP: totalRawXP, // BẮT BUỘC LƯU LẠI XP THÔ ĐỂ SO SÁNH VỚI CÁC LẦN ÔN TẬP SAU
            savedAnswers: userAnswers, timeSpent: timeSpent, timestamp: new Date().toISOString() 
        });

        const examDocRef = doc(db, "exams", currentExamId);
        await setDoc(examDocRef, { attemptCount: increment(1) }, { merge: true });
        
        showResultModal(finalCorrectCount, finalTotal, finalScore, gainedXP, isRetake, isNewRecord);
    } catch (error) {
        showResultModal(finalCorrectCount, finalTotal, finalScore, gainedXP, isRetake, isNewRecord);
    }
}

function submitExam(isAutoSubmit = false) {
    if (isSubmitted) return;
    const total = questions.length;
    const answeredCount = Object.keys(userAnswers).length;
    
    if (!isAutoSubmit) {
        const confirmModal = document.getElementById('confirm-submit-modal');
        document.getElementById('confirm-submit-text').innerText = `Bạn đã hoàn thành ${answeredCount}/${total} câu hỏi.\nBạn có chắc chắn muốn nộp bài lúc này?`;
        confirmModal.classList.add('active');
        
        document.getElementById('btn-confirm-submit').onclick = () => {
            confirmModal.classList.remove('active');
            executeSubmit();
        };
        document.getElementById('btn-cancel-submit').onclick = () => { confirmModal.classList.remove('active'); };
    } else {
        showToast("Hệ thống đang tự động thu bài!");
        executeSubmit();
    }
}

function openReviewModal(score, correctCount, total) {
    const modal = document.getElementById('reviewExamModal');
    const contentArea = document.getElementById('reviewContentArea');
    modal.classList.add('active');

    let html = `
        <div style="background: linear-gradient(135deg, #e0c3fc 0%, #8ec5fc 100%); padding: 20px; border-radius: 12px; margin-bottom: 25px; box-shadow: 0 4px 10px rgba(0,0,0,0.05); color: #1e1b4b; text-align: center;">
            <h2 style="margin: 0 0 5px 0; font-weight: 900;">ĐIỂM SỐ CỦA BẠN: <span style="color: #ea580c; font-size: 1.5em; background: #fff; padding: 2px 15px; border-radius: 20px;">${score}</span></h2>
            <p style="margin: 0; font-weight: 600; opacity: 0.8;">Trả lời đúng: ${correctCount}/${total} câu</p>
        </div>
    `;

    questions.forEach((q, idx) => {
        const userAns = userAnswers[idx];
        const correctAns = q.correctAnswer;
        let isUnanswered = userAns === undefined;

        let optionsHtml = '';
        const opts = q.options || [];
        const labels = ['A','B','C','D', 'E', 'F'];

        opts.forEach((optText, oIdx) => {
            let bg = 'var(--bg-panel)'; let border = '2px solid var(--border-color)'; let color = 'var(--text-main)'; let fw = 'normal'; let icon = '';

            if (oIdx === correctAns) {
                bg = 'rgba(16, 185, 129, 0.1)'; border = '2px solid #10b981'; color = '#10b981'; fw = 'bold';
                icon = '<i class="fa-solid fa-check-circle" style="color: #10b981; font-size: 1.2rem; float: right;"></i>';
            } else if (oIdx === userAns && userAns !== correctAns) {
                bg = 'rgba(239, 68, 68, 0.1)'; border = '2px solid #ef4444'; color = '#ef4444'; fw = 'bold';
                icon = '<i class="fa-solid fa-circle-xmark" style="color: #ef4444; font-size: 1.2rem; float: right;"></i>';
            }

            optionsHtml += `
                <div style="padding: 12px 15px; margin-bottom: 10px; background: ${bg}; border: ${border}; border-radius: 8px; color: ${color}; font-weight: ${fw}; display: flex; justify-content: space-between; align-items: center;">
                    <div style="flex: 1;"><span style="display:inline-block; width: 25px; font-weight:900;">${labels[oIdx] !== undefined ? labels[oIdx] : oIdx}.</span> ${optText}</div>
                    <div>${icon}</div>
                </div>
            `;
        });

        let explanationHtml = '';
        if (q.explanation && q.explanation.trim() !== '' && q.explanation.toLowerCase() !== 'không có giải thích chi tiết') {
            explanationHtml = `
                <div style="margin-top: 15px; padding: 15px; background: rgba(245, 158, 11, 0.1); border-left: 4px solid #f59e0b; border-radius: 6px; font-size: 0.95rem; color: #d97706;">
                    <b style="color: #b45309;"><i class="fa-solid fa-lightbulb"></i> Giải thích:</b><br>${q.explanation}
                </div>
            `;
        }

        let statusBadge = isUnanswered ? '<span style="background: var(--bg-hover); color: var(--text-muted); padding: 3px 8px; border-radius: 4px; font-size: 0.8rem; font-weight: bold; margin-left: 10px; white-space: nowrap;">Chưa chọn</span>' : 
                          (userAns === correctAns) ? '<span style="background: rgba(16, 185, 129, 0.2); color: #059669; padding: 3px 8px; border-radius: 4px; font-size: 0.8rem; font-weight: bold; white-space: nowrap;">Đúng</span>' : 
                          '<span style="background: rgba(239, 68, 68, 0.2); color: #dc2626; padding: 3px 8px; border-radius: 4px; font-size: 0.8rem; font-weight: bold; white-space: nowrap;">Sai</span>';

        let safeQuestionText = (q.text || "").replace(/"/g, '&quot;');
        
        html += `
            <div style="background: var(--bg-panel); padding: 20px; border-radius: 12px; margin-bottom: 20px; box-shadow: var(--shadow-sm); border: 1px solid var(--border-color);">
                
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                    <span style="background: #3b82f6; color: #fff; padding: 4px 12px; border-radius: 6px; font-size: 0.85rem; font-weight: 700; white-space: nowrap;">Câu ${idx+1}</span>
                    <button class="btn-report-error" data-qid="${q.id}" data-qtext="${safeQuestionText}" style="background: rgba(239, 68, 68, 0.1); border: 1px solid #f87171; color: #dc2626; padding: 5px 12px; border-radius: 6px; font-size: 0.85rem; font-weight: bold; cursor: pointer; display: flex; align-items: center; gap: 5px; white-space: nowrap; transition: 0.2s;">
                        <i class="fa-solid fa-flag"></i> Báo lỗi
                    </button>
                </div>
                
                <div style="color: var(--text-main); font-weight: 600; font-size: 1.05rem; line-height: 1.6; margin-bottom: 15px;">
                    ${q.text} 
                    <div style="margin-top: 8px; display: inline-block;">${statusBadge}</div>
                </div>

                <div>${optionsHtml}</div>
                ${explanationHtml}
            </div>
        `;
    });

    contentArea.innerHTML = html;

    document.querySelectorAll('.btn-report-error').forEach(btn => {
        btn.addEventListener('mouseover', function() { this.style.background = 'rgba(239, 68, 68, 0.2)'; });
        btn.addEventListener('mouseout', function() { this.style.background = 'rgba(239, 68, 68, 0.1)'; });
        btn.addEventListener('click', function() {
            const qId = this.getAttribute('data-qid');
            const qText = this.getAttribute('data-qtext');
            openReportModal(qId, qText);
        });
    });
}

function openReportModal(qId, qText) {
    reportingQuestionId = qId;
    reportingQuestionText = qText;
    
    let previewText = qText.length > 70 ? qText.substring(0, 70) + '...' : qText;
    document.getElementById('reportQuestionTextPreview').innerText = previewText;
    document.getElementById('reportErrorType').value = 'Sai đáp án';
    document.getElementById('reportDescription').value = '';
    
    document.getElementById('reportQuestionModal').classList.add('active');
}

document.getElementById('btnCancelReport').addEventListener('click', () => { document.getElementById('reportQuestionModal').classList.remove('active'); });

document.getElementById('btnSubmitReport').addEventListener('click', async () => {
    if (!auth.currentUser) { showToast("Bạn cần đăng nhập để gửi báo cáo!"); return; }
    
    const errorType = document.getElementById('reportErrorType').value;
    const description = document.getElementById('reportDescription').value.trim();
    
    if (!description) { showToast("Vui lòng nhập mô tả chi tiết lỗi!"); return; }
    
    const btnSubmit = document.getElementById('btnSubmitReport');
    btnSubmit.disabled = true;
    btnSubmit.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Đang gửi...';
    
    try {
        await addDoc(collection(db, "reported_questions"), {
            examId: currentExamId, questionId: reportingQuestionId, questionText: reportingQuestionText,
            reportedBy: currentUser.email, errorType: errorType, description: description,
            status: "pending", timestamp: serverTimestamp()
        });
        
        showToast("Đã gửi báo cáo lỗi. Xin cảm ơn sự đóng góp của bạn!");
        document.getElementById('reportQuestionModal').classList.remove('active');
    } catch (error) {
        showToast("Đã xảy ra lỗi khi gửi dữ liệu. Vui lòng thử lại sau!");
    } finally {
        btnSubmit.disabled = false;
        btnSubmit.innerText = "Gửi Báo Cáo";
    }
});

document.getElementById('closeReviewModalBtn').addEventListener('click', () => {
    document.getElementById('reviewExamModal').classList.remove('active');
    if (currentResultId) returnToLobbyOrDashboard();
    else document.getElementById('result-modal').classList.add('active');
});

document.getElementById('reviewExamModal').addEventListener('click', (e) => {
    if (e.target.id === 'reviewExamModal') {
        document.getElementById('reviewExamModal').classList.remove('active');
        if (currentResultId) returnToLobbyOrDashboard();
        else document.getElementById('result-modal').classList.add('active');
    }
});

let selectedStars = 0;
const stars = document.querySelectorAll('#star-rating span');

stars.forEach(star => {
    star.onclick = () => {
        selectedStars = parseInt(star.getAttribute('data-value'));
        stars.forEach(s => {
            if (parseInt(s.getAttribute('data-value')) <= selectedStars) s.classList.add('active');
            else s.classList.remove('active');
        });
    };
});

document.getElementById('btn-submit-feedback').onclick = async () => {
    if (selectedStars === 0) { showToast("Vui lòng chọn số sao để đánh giá!"); return; }
    const text = document.getElementById('feedback-text').value;
    const btn = document.getElementById('btn-submit-feedback');
    btn.innerText = "Đang gửi..."; btn.disabled = true;

    try {
        await addDoc(collection(db, "feedbacks"), {
            examId: currentExamId, email: currentUser.email, rating: selectedStars, comment: text, timestamp: new Date().toISOString()
        });
        document.getElementById('feedback-section').style.display = 'none';
        document.getElementById('feedback-thankyou').style.display = 'block';
    } catch (error) {
        showToast("Lỗi khi gửi đánh giá. Vui lòng thử lại!");
        btn.innerText = "Gửi Đánh Giá"; btn.disabled = false;
    }
};

function resetFeedbackUI() {
    document.getElementById('feedback-section').style.display = 'block';
    document.getElementById('feedback-thankyou').style.display = 'none';
    selectedStars = 0;
    stars.forEach(s => s.classList.remove('active'));
    document.getElementById('feedback-text').value = '';
    const btn = document.getElementById('btn-submit-feedback');
    btn.innerText = "Gửi Đánh Giá"; btn.disabled = false;
}

function showResultModal(correctCount, total, score, xp = 0, isRetake = false, isNewRecord = false) {
    const modal = document.getElementById('result-modal');
    document.getElementById('modal-score-text').innerText = score;
    document.getElementById('modal-correct-text').innerText = `${correctCount}/${total}`;
    
    const percentage = (correctCount / total) * 100;
    const scoreCircle = document.getElementById('modal-score-circle');
    scoreCircle.style.background = `conic-gradient(#10b981 ${percentage}%, #d1fae5 ${percentage}%)`;

    // CẬP NHẬT GIAO DIỆN XP ĐỂ PHÙ HỢP VỚI LOGIC CHỐNG FARM ĐIỂM
    let xpDisplay = document.getElementById('modal-xp-display');
    if (!xpDisplay) {
        xpDisplay = document.createElement('div');
        xpDisplay.id = 'modal-xp-display';
        xpDisplay.style.cssText = "margin-top: 15px; font-weight: bold; font-size: 1.1rem; padding: 5px 15px; border-radius: 20px; display: inline-block; box-shadow: 0 2px 5px rgba(0,0,0,0.05);";
        
        if (scoreCircle && scoreCircle.parentNode) {
            scoreCircle.parentNode.insertBefore(xpDisplay, scoreCircle.nextSibling);
        }
    }
    
    xpDisplay.style.display = 'inline-block';
    
    if (!isRetake) {
        // Lần thi đầu tiên
        xpDisplay.innerHTML = `🌟 +${xp} XP`;
        xpDisplay.style.color = "#ea580c";
        xpDisplay.style.background = "#ffedd5";
    } else {
        // Thi lại (Chế độ ôn tập)
        if (isNewRecord && xp > 0) {
            xpDisplay.innerHTML = `🔥 +${xp} XP (Vượt kỷ lục)`;
            xpDisplay.style.color = "#ea580c";
            xpDisplay.style.background = "#ffedd5";
        } else {
            // Chỉ nhận điểm chuyên cần (+5)
            xpDisplay.innerHTML = `💡 +${xp} XP (Chuyên cần)`;
            xpDisplay.style.color = "#059669"; 
            xpDisplay.style.background = "#d1fae5";
        }
    }

    resetFeedbackUI(); 
    modal.classList.add('active');
}

function closeModal() { document.getElementById('result-modal').classList.remove('active'); }

document.getElementById('btn-modal-dashboard-modal').onclick = () => returnToLobbyOrDashboard();
document.getElementById('btn-back-dashboard').onclick = () => returnToLobbyOrDashboard();
document.getElementById('btn-modal-retry').onclick = () => { closeModal(); initExamState(); };
document.getElementById('btn-modal-explain').onclick = () => { closeModal(); openReviewModal(finalScore, finalCorrectCount, finalTotal); };


// =========================================================================
// QUẢN LÝ TƯƠNG TÁC LÀM BÀI (TÙY CHỌN, BẤM PHÍM, V.V...)
// =========================================================================
function handleOptionSelect(idx) {
    if (isSubmitted) return; 
    
    userAnswers[currentIndex] = idx; 
    saveDraft(); 
    renderQuestion(); 
    renderPalette();  
    
    setTimeout(() => {
        if (isSubmitted) return; 

        if (currentIndex < questions.length - 1) {
            currentIndex++; 
            saveDraft();
            renderAll();
        } else {
            const firstUnansweredIdx = questions.findIndex((_, i) => userAnswers[i] === undefined);
            if (firstUnansweredIdx !== -1) {
                currentIndex = firstUnansweredIdx; 
                saveDraft();
                renderAll();
            }
        }
    }, 300);
}

function renderAll() {
    if (questions.length === 0) return;
    renderQuestion();
    renderPalette();
}

function renderQuestion() {
    const questionData = questions[currentIndex];
    const questionText = questionData.text || "Câu hỏi không có nội dung";
    const options = questionData.options || [];

    document.getElementById('question-badge').innerText = `Câu ${currentIndex + 1}`;
    document.getElementById('question-text').innerText = questionText;
    
    const container = document.getElementById('options-container');
    container.innerHTML = ''; 

    options.forEach((opt, idx) => {
        const div = document.createElement('div');
        let extraClasses = '';
        
        if (isSubmitted) extraClasses += ' disabled';
        if (userAnswers[currentIndex] === idx) extraClasses += ' selected';

        div.className = 'option-item' + extraClasses;
        div.innerHTML = `<div class="option-label">${['A','B','C','D'][idx]}</div><div>${opt}</div>`;
        
        div.onclick = () => handleOptionSelect(idx);
        container.appendChild(div);
    });

    const btnFlag = document.getElementById('btn-flag');
    if (flaggedQuestions[currentIndex]) {
        btnFlag.classList.add('active');
        btnFlag.innerHTML = '<i class="fa-solid fa-flag"></i> Bỏ đánh dấu';
    } else {
        btnFlag.classList.remove('active');
        btnFlag.innerHTML = '<i class="fa-regular fa-flag"></i> Đánh dấu';
    }
}

function renderPalette() {
    const container = document.getElementById('palette-container');
    container.innerHTML = '';
    
    questions.forEach((q, idx) => {
        const btn = document.createElement('button');
        let btnClasses = 'palette-btn';
        if (idx === currentIndex) btnClasses += ' current';
        if (userAnswers[idx] !== undefined) btnClasses += ' answered';
        if (flaggedQuestions[idx]) btnClasses += ' flagged'; 

        btn.className = btnClasses;
        btn.innerText = idx + 1;
        btn.onclick = () => { currentIndex = idx; saveDraft(); renderAll(); };
        container.appendChild(btn);
    });
    
    const answeredCount = Object.keys(userAnswers).length;
    const progressPercent = questions.length > 0 ? (answeredCount / questions.length) * 100 : 0;
    const progressBar = document.getElementById('progress-bar');
    if (progressBar) progressBar.style.width = `${progressPercent}%`;
}

document.getElementById('btn-flag').onclick = () => {
    if (isSubmitted) return;
    flaggedQuestions[currentIndex] = !flaggedQuestions[currentIndex];
    saveDraft(); 
    renderQuestion();
    renderPalette();
};

document.getElementById('btn-prev').onclick = () => { if(currentIndex > 0) { currentIndex--; saveDraft(); renderAll(); } };
document.getElementById('btn-next').onclick = () => { if(currentIndex < questions.length - 1) { currentIndex++; saveDraft(); renderAll(); } };

document.getElementById('btn-logout').addEventListener('click', () => {
    isNavigating = true; // NGĂN CHẶN XUNG ĐỘT TRẠNG THÁI KHI ĐĂNG XUẤT
    if (currentUser) {
        updateDoc(doc(db, "users", currentUser.uid), { isOnline: false, examStatus: 'idle' }).catch(() => {});
        sessionStorage.removeItem(`online_flag_${currentUser.uid}`);
    }
    signOut(auth).then(() => { redirect('index.html'); }).catch((error) => { showToast("Có lỗi xảy ra khi đăng xuất."); });
});

document.addEventListener('keydown', (e) => {
    if (questions.length === 0 || document.activeElement.tagName === 'TEXTAREA') return;
    const key = e.key;
    if (key === 'ArrowLeft') { if(currentIndex > 0) { currentIndex--; saveDraft(); renderAll(); } } 
    else if (key === 'ArrowRight') { if(currentIndex < questions.length - 1) { currentIndex++; saveDraft(); renderAll(); } } 
    else if (!isSubmitted && currentMode !== 'flashcard') {
        const keyMap = { 'a': 0, 'A': 0, 'b': 1, 'B': 1, 'c': 2, 'C': 2, 'd': 3, 'D': 3 };
        const optionIndex = keyMap[key];
        if (optionIndex !== undefined && questions[currentIndex].options && optionIndex < questions[currentIndex].options.length) {
            handleOptionSelect(optionIndex); 
        }
    }
});

// =========================================================================
// SỰ KIỆN: XỬ LÝ KHI NGƯỜI DÙNG TẮT TRÌNH DUYỆT / ĐÓNG TAB NGANG
// =========================================================================
window.addEventListener('beforeunload', () => {
    // Chỉ kích hoạt ghi Offline nếu người dùng thực sự đóng tab (không phải điều hướng nội bộ)
    if (!isNavigating && currentUser) {
        updateDoc(doc(db, "users", currentUser.uid), { 
            isOnline: false, 
            examStatus: 'idle' 
        }).catch(() => {});
        // Xóa cờ cache để lần sau mở lại web sẽ tự nhận là Online
        sessionStorage.removeItem(`online_flag_${currentUser.uid}`);
    }
});
