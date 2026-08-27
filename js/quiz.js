import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, collection, getDocs, addDoc, query, where, doc, getDoc, setDoc, increment, updateDoc, limit } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
// Import các module hệ thống
import { redirect, showToast, initThemeToggle, initMobilePanel } from './quiz-modules/quiz-utils.js';
import { initFlashcard } from './quiz-modules/quiz-flashcard.js';
import { resetAntiCheatWarning, updateAntiCheatState, setupAntiCheatEvents } from './quiz-modules/quiz-anti-cheat.js';
import { saveDraftToLocal, loadDraftFromLocal, clearDraftFromLocal } from './quiz-modules/quiz-draft.js';
import { initDisplaySettings } from './quiz-modules/quiz-display.js';
import { initQuizUI } from './quiz-modules/quiz-ui.js';
// Import module chứng nhận
import { loadHtml2Canvas, downloadCertificate } from './quiz-modules/quiz-certificate.js';

const firebaseConfig = {
    apiKey: "AIzaSyDqdo_DJIWa5iqxiCgBq-0iGX7f9sr6soo",
    authDomain: "rt-examination.firebaseapp.com",
    projectId: "rt-examination",
    storageBucket: "rt-examination.firebasestorage.app",
    messagingSenderId: "920482699854",
    appId: "1:920482699854:web:44f9b0d735bdc001c6c11f",
    measurementId: "G-8N7RTTREQM"
};

const app = initializeApp(firebaseConfig);
let auth = getAuth(app);
let db = getFirestore(app);

// Variables State
let questions = [];
let currentIndex = 0;
let userAnswers = {};
let flaggedQuestions = {}; 

let isSubmitted = false;
let currentUser = null; 
let isShowExplanation = false;
let isNavigating = false; 
let isAntiCheatEnabled = false;
let isCurrentUserVip = false;

let timerInterval;
let examDuration = 15 * 60; 
let timeRemaining = examDuration;
let currentDifficulty = 'medium'; 

let finalScore = 0;
let finalCorrectCount = 0;
let finalTotal = 0;

const urlParams = new URLSearchParams(window.location.search);
let currentExamId = urlParams.get('examId'); 
const currentResultId = urlParams.get('resultId'); 
const currentRoomId = urlParams.get('roomId'); 
const currentMode = urlParams.get('mode');

// Khởi tạo các Utilities cơ bản (An toàn lướt qua nếu DOM chưa đầy đủ)
initThemeToggle();
initMobilePanel();
initDisplaySettings(); 

// KẾT NỐI MODULE GIAO DIỆN (UI MODULE) 
let quizUI = initQuizUI(db, {
    get questions() { return questions; },
    get currentIndex() { return currentIndex; },
    set currentIndex(val) { currentIndex = val; },
    get userAnswers() { return userAnswers; },
    get flaggedQuestions() { return flaggedQuestions; },
    get isSubmitted() { return isSubmitted; },
    get isShowExplanation() { return isShowExplanation; },
    get isCurrentUserVip() { return isCurrentUserVip; },
    get currentUser() { return currentUser; },
    get currentExamId() { return currentExamId; },
    get currentResultId() { return currentResultId; },
    get currentMode() { return currentMode; }
}, {
    saveDraft,
    returnToLobbyOrDashboard,
    initExamState,
    executeSubmit
});

const flashcardAPI = initFlashcard(db, () => ({
    currentExamId, currentUser, questions, currentMode, showToast, returnToLobbyOrDashboard
}));

// =========================================================================
// CÁC HÀM TIỆN ÍCH CORE
// =========================================================================
function updateAntiCheatStateHelper() {
    updateAntiCheatState({ isAntiCheatEnabled, isSubmitted, isShowExplanation, currentMode });
}

setupAntiCheatEvents(
    () => ({ isAntiCheatEnabled, isSubmitted, isShowExplanation, currentMode }),
    () => executeSubmit()
);

function saveDraft() { saveDraftToLocal({ isSubmitted, currentUser, currentExamId, currentMode, userAnswers, flaggedQuestions, timeRemaining, currentIndex }); }

function loadDraft() {
    const draft = loadDraftFromLocal(currentUser, currentExamId, currentMode);
    if (draft) {
        userAnswers = draft.userAnswers || {};
        flaggedQuestions = draft.flaggedQuestions || {};
        if (draft.timeRemaining !== undefined) timeRemaining = draft.timeRemaining;
        if (draft.currentIndex !== undefined) currentIndex = currentIndex = draft.currentIndex;
        return true;
    }
    return false;
}

function clearDraft() { clearDraftFromLocal(currentUser, currentExamId); }

async function returnToLobbyOrDashboard() {
    isNavigating = true; 
    if (currentUser && !isSubmitted) {
        try { await updateDoc(doc(db, "users", currentUser.uid), { examStatus: 'idle' }); } catch (err) {}
    }
    if (currentRoomId) redirect(`lobby.html?roomId=${currentRoomId}`);
    else redirect('dashboard.html');
}

// =========================================================================
// KHỞI TẠO BÀI THI & TẢI DỮ LIỆU
// =========================================================================
onAuthStateChanged(auth, async (user) => {
    if (!user || user.isAnonymous) {
        localStorage.setItem('redirectAfterLogin', window.location.href);
        redirect('index.html');
    } else {
        currentUser = user;
        
        try {
            const userDoc = await getDoc(doc(db, "users", user.uid));
            if (userDoc.exists()) {
                const ud = userDoc.data();
                if (ud.isVip) {
                    const expiryField = ud.vipExpirationDate || ud.vipEnd;
                    if (expiryField) {
                        const vipEnd = expiryField.toDate ? expiryField.toDate() : new Date(expiryField);
                        if (vipEnd.getTime() > Date.now()) {
                            isCurrentUserVip = true;
                        }
                    }
                }
            }
        } catch (e) { console.error(e); }

        if (currentResultId) {
            loadReviewMode(currentResultId);
        } else if (currentExamId) {
            const titleElement = document.getElementById('quiz-title-display');
            if (titleElement) titleElement.innerHTML = `<i class="fa-solid fa-brain me-2" style="color: #fbbf24; font-size: 1.2em; vertical-align: middle;"></i>Bài thi: ${currentExamId}`;
            
            if (currentMode === 'flashcard') loadFlashcardMode();
            else loadExamDataAndQuestions();
        }
    }
});

async function loadFlashcardMode() {
    document.getElementById('skeleton-container')?.classList.add('active');
    document.getElementById('real-content')?.classList.add('hidden');
    
    const timerBox = document.getElementById('timer-container-box');
    if (timerBox) timerBox.style.display = 'none';

    try {
        await fetchQuestionsFromFirestore();
        document.getElementById('skeleton-container')?.classList.remove('active');
        if (flashcardAPI) flashcardAPI.triggerCreate();
    } catch (error) {
        document.getElementById('skeleton-container')?.classList.remove('active');
        document.getElementById('real-content')?.classList.remove('hidden');
        
        const qText = document.getElementById('question-text');
        if(qText) qText.innerText = `Lỗi hệ thống: ${error.message}`;
    }
}

async function loadExamDataAndQuestions() {
    document.getElementById('skeleton-container')?.classList.add('active');
    document.getElementById('real-content')?.classList.add('hidden');
    
    try {
        const examDocRef = doc(db, "exams", currentExamId);
        const examDoc = await getDoc(examDocRef);
        
        if (examDoc.exists()) {
            const examData = examDoc.data();
            if (examData.timeLimit) examDuration = examData.timeLimit * 60; 
            if (examData.difficulty) currentDifficulty = String(examData.difficulty).toLowerCase(); 
            isAntiCheatEnabled = examData.antiCheatEnabled === true;
        }

        if (currentRoomId) {
            const roomDocRef = doc(db, "rooms", currentRoomId);
            const roomDoc = await getDoc(roomDocRef);
            if (roomDoc.exists() && roomDoc.data().antiCheatEnabled !== undefined) {
                isAntiCheatEnabled = roomDoc.data().antiCheatEnabled === true;
            }
        }

        await fetchQuestionsFromFirestore();
        initExamState(); 
    } catch (error) {
        document.getElementById('skeleton-container')?.classList.remove('active');
        document.getElementById('real-content')?.classList.remove('hidden');
        const qText = document.getElementById('question-text');
        if(qText) qText.innerText = `Lỗi tải đề thi: ${error.message}`;
    }
}

async function initExamState() {
    isSubmitted = false;
    isShowExplanation = false;
    resetAntiCheatWarning(); 
    
    const hasDraft = loadDraft();
    if (!hasDraft) {
        currentIndex = 0;
        userAnswers = {};
        flaggedQuestions = {};
        timeRemaining = examDuration;
    } else {
        showToast("Đã khôi phục trạng thái bài làm trước đó!");
    }
    
    updateAntiCheatStateHelper(); 
    
    const btnSubmit = document.getElementById('btn-submit-exam');
    if (btnSubmit) {
        btnSubmit.disabled = false; 
        btnSubmit.innerText = "Nộp bài ngay"; 
        btnSubmit.onclick = () => quizUI.submitExam(false); 
    }

    if (currentRoomId && currentUser) {
        const participantRef = doc(db, "rooms", currentRoomId, "participants", currentUser.uid);
        setDoc(participantRef, { status: 'playing' }, { merge: true }).catch(e => console.error(e));
    }

    if (currentUser) {
        try { await updateDoc(doc(db, "users", currentUser.uid), { examStatus: 'testing', isOnline: true }); } catch (err) {}
    }

    document.getElementById('skeleton-container')?.classList.remove('active');
    document.getElementById('real-content')?.classList.remove('hidden');

    quizUI.renderAll();
    startTimer();
}

async function loadReviewMode(resultId) {
    if (!isCurrentUserVip) {
        alert("Tính năng Xem lại bài làm và giải thích chi tiết chỉ dành cho Tài khoản PRO!");
        returnToLobbyOrDashboard();
        return;
    }

    document.getElementById('skeleton-container')?.classList.add('active');
    document.getElementById('real-content')?.classList.add('hidden');

    try {
        const resultDocRef = doc(db, "results", resultId);
        const resultDoc = await getDoc(resultDocRef);

        if (!resultDoc.exists()) throw new Error("Không tìm thấy kết quả bài làm trên hệ thống.");

        const resultData = resultDoc.data();
        currentExamId = resultData.examId;
        userAnswers = resultData.savedAnswers || {}; 
        isSubmitted = true;
        isShowExplanation = true;
        updateAntiCheatStateHelper(); 

        const titleDisplay = document.getElementById('quiz-title-display');
        if (titleDisplay) titleDisplay.innerHTML = `<i class="fa-solid fa-brain me-2" style="color: #fbbf24; font-size: 1.2em; vertical-align: middle;"></i>Xem lại bài thi: ${currentExamId}`;
        
        const timerBox = document.getElementById('timer-container-box');
        if(timerBox) timerBox.style.display = 'none'; 
        
        await fetchQuestionsFromFirestore();
        
        document.getElementById('skeleton-container')?.classList.remove('active');
        document.getElementById('real-content')?.classList.remove('hidden');

        quizUI.openReviewModal(resultData.score, resultData.correctCount, resultData.totalQuestions);
    } catch (error) {
        document.getElementById('skeleton-container')?.classList.remove('active');
        document.getElementById('real-content')?.classList.remove('hidden');
        
        const qText = document.getElementById('question-text');
        if(qText) qText.innerText = `Lỗi hệ thống: ${error.message}`;
    }
}

async function fetchQuestionsFromFirestore() {
    const container = document.getElementById('options-container');
    if(container) container.innerHTML = ''; 
    
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

// =========================================================================
// KIỂM SOÁT THỜI GIAN
// =========================================================================
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
            quizUI.submitExam(true); 
        }
    }, 1000);
}

function stopTimer() { clearInterval(timerInterval); }

function updateTimerDisplay() {
    const minutes = Math.floor(timeRemaining / 60).toString().padStart(2, '0');
    const seconds = (timeRemaining % 60).toString().padStart(2, '0');
    
    const countdownEl = document.getElementById('countdown');
    if(countdownEl) countdownEl.innerText = `${minutes}:${seconds}`;
    
    const timerBox = document.getElementById('timer-container-box');
    if (timerBox) {
        if (timeRemaining <= 60 && timeRemaining > 0) {
            timerBox.classList.add('timer-warning');
            if (timeRemaining <= 30 && timeRemaining % 2 === 0) playBeepWarning();
        } else {
            timerBox.classList.remove('timer-warning');
        }
    }
}

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

// Load thư viện html2canvas sẵn
loadHtml2Canvas();

// =========================================================================
// LOGIC TÍNH ĐIỂM, XP, NỘP BÀI VÀ GHI FIRESTORE
// =========================================================================
async function executeSubmit() {
    stopTimer(); 
    isSubmitted = true; 
    clearDraft(); 
    updateAntiCheatStateHelper(); 
    
    finalTotal = questions.length;
    const timeSpent = examDuration - timeRemaining; 
    
    const btnSubmit = document.getElementById('btn-submit-exam');
    if (btnSubmit) {
        btnSubmit.disabled = true; 
        btnSubmit.innerText = "Đang xử lý..."; 
    }

    finalCorrectCount = 0;
    questions.forEach((question, idx) => {
        if (userAnswers[idx] === question.correctAnswer) finalCorrectCount++;
    });

    finalScore = Math.round(((finalCorrectCount / finalTotal) * 10) * 100) / 100; 

    let gainedXP = 0;
    let xpMessage = "";
    let isRetake = false;
    let isNewRecord = false;
    let totalRawXP = 0;
    
    let attendanceBonus = 0;
    let isDailyFirst = false;
    const todayStr = new Date().toLocaleDateString('en-CA'); 

    try {
        const resultsRef = collection(db, "results");
        const qResult = query(resultsRef, where("email", "==", currentUser.email), where("examId", "==", currentExamId), limit(30));
        const resultSnapshot = await getDocs(qResult);
        
        const leaderboardRef = doc(db, "users_leaderboard", currentUser.uid);
        const lbSnap = await getDoc(leaderboardRef);
        
        if (lbSnap.exists()) {
            if (lbSnap.data().lastAttendanceDate !== todayStr) isDailyFirst = true; 
        } else {
            isDailyFirst = true; 
        }
        
        if (isDailyFirst) attendanceBonus = 20;

        if (finalTotal > 0) {
            let wrongOrEmptyCount = finalTotal - finalCorrectCount;
            let baseXP = (finalCorrectCount * 10) - (wrongOrEmptyCount * 2);
            if (baseXP < 0) baseXP = 0; 
            
            let accuracyRate = finalCorrectCount / finalTotal;
            let difficultyMultiplier = 1.0;
            if (accuracyRate >= 0.75) {
                if (currentDifficulty === 'hard') difficultyMultiplier = 1.5;
                else if (currentDifficulty === 'medium') difficultyMultiplier = 1.2;
            }

            let perfectBonus = 0;
            let speedBonus = 0;

            if (accuracyRate === 1) {
                perfectBonus = 100; 
                speedBonus = Math.round((timeRemaining / examDuration) * 50);
            }

            totalRawXP = Math.round((baseXP * difficultyMultiplier) + perfectBonus + speedBonus);
            if (totalRawXP < 0) totalRawXP = 0;

            if (resultSnapshot.empty) {
                gainedXP = totalRawXP;
                xpMessage = `🎉 Xuất sắc! Bạn nhận được +${gainedXP} XP cho bài thi này!`;
            } else {
                isRetake = true;
                let previousBestRawXP = 0;
                resultSnapshot.forEach(doc => {
                    let data = doc.data();
                    if (data.earnedXP && data.earnedXP > previousBestRawXP) previousBestRawXP = data.earnedXP;
                });
                
                if (totalRawXP > previousBestRawXP) {
                    isNewRecord = true;
                    gainedXP = Math.round((baseXP * 0.2) * difficultyMultiplier);
                    xpMessage = `🔥 Kỷ lục mới! Bạn nhận được +${gainedXP} XP khuyến khích!`;
                } else if (totalRawXP > 0) {
                    gainedXP = 5; 
                    xpMessage = `💡 Ôn tập tốt! Nhận +${gainedXP} XP điểm chuyên cần.`;
                } else {
                    gainedXP = 0; 
                    xpMessage = `💡 Hãy ôn tập kỹ hơn ở lần sau nhé!`;
                }
            }

            const totalAddedXP = gainedXP + attendanceBonus;
            
            if (totalAddedXP > 0) {
                const monthKey = getCurrentMonthKey();
                const weekKey = getCurrentWeekKey();

                let updatePayload = {
                    displayName: currentUser.displayName || currentUser.email.split('@')[0],
                    email: currentUser.email,
                    photoURL: currentUser.photoURL || "",
                    totalXP: increment(totalAddedXP),
                    [monthKey]: increment(totalAddedXP),
                    [weekKey]: increment(totalAddedXP)
                };
                
                if (isDailyFirst) {
                    updatePayload.lastAttendanceDate = todayStr;
                    xpMessage += ` (+20 XP Điểm danh ngày mới!)`;
                }

                await setDoc(leaderboardRef, updatePayload, { merge: true });
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
            const ud = (await getDoc(userRef)).data() || {};
            const newTotal = (ud.totalScore || 0) + finalScore;
            const newCount = (ud.examCount || 0) + 1;
            await updateDoc(userRef, { examStatus: 'idle', totalScore: newTotal, examCount: newCount, avgScore: parseFloat((newTotal / newCount).toFixed(2)) });
        } catch (err) { console.error(err); }
    }

    quizUI.renderAll(); 
    if (btnSubmit) btnSubmit.innerText = "Đã nộp bài";

    try {
        await addDoc(collection(db, "results"), {
            email: currentUser.email, examId: currentExamId, score: finalScore,
            correctCount: finalCorrectCount, totalQuestions: finalTotal,
            earnedXP: totalRawXP, 
            savedAnswers: userAnswers, timeSpent: timeSpent, timestamp: new Date().toISOString() 
        });

        const answeredCount = Object.keys(userAnswers).length;
        if (finalTotal > 0 && (answeredCount / finalTotal) >= 0.75) {
            const examDocRef = doc(db, "exams", currentExamId);
            await setDoc(examDocRef, { attemptCount: increment(1) }, { merge: true });
        }

        quizUI.showResultModal(finalCorrectCount, finalTotal, finalScore, gainedXP, isRetake, isNewRecord, attendanceBonus);
    } catch (error) {
        quizUI.showResultModal(finalCorrectCount, finalTotal, finalScore, gainedXP, isRetake, isNewRecord, attendanceBonus);
    }

    // ==========================================
    // BỔ SUNG LOGIC CHỨNG NHẬN TRỰC TIẾP TỪ ĐÂY
    // ĐIỀU KIỆN: SỐ ĐIỂM > 8 VÀ PHẢI LÀ TÀI KHOẢN VIP
    // ==========================================
    if (finalScore > 8 && isCurrentUserVip) {
        setTimeout(() => {
            const modalContent = document.querySelector('#result-modal .modal-content') || document.querySelector('#result-modal > div') || document.getElementById('result-modal');
            
            if (modalContent && !document.getElementById('btn-download-cert')) {
                // Tạo nút tải chứng nhận
                const certBtn = document.createElement('button');
                certBtn.id = 'btn-download-cert';
                certBtn.innerHTML = '<i class="fa-solid fa-award"></i> Tải Chứng Nhận Xuất Sắc';
                certBtn.style.cssText = "background: linear-gradient(135deg, #f59e0b, #d97706); color: white; border: none; padding: 12px 20px; border-radius: 8px; font-weight: bold; cursor: pointer; margin-top: 15px; width: 100%; box-shadow: 0 4px 10px rgba(245, 158, 11, 0.3); display: flex; justify-content: center; align-items: center; gap: 8px; font-size: 1.05rem; transition: 0.2s;";
                
                certBtn.onmouseover = () => certBtn.style.transform = 'translateY(-2px)';
                certBtn.onmouseout = () => certBtn.style.transform = 'translateY(0)';
                
                certBtn.onclick = () => {
                    const userName = currentUser.displayName || currentUser.email.split('@')[0];
                    downloadCertificate(userName, currentExamId, finalScore);
                };
                
                // Tiêm vào dưới cùng của nội dung Modal
                modalContent.appendChild(certBtn);
            }
        }, 600); 
    }
}

// =========================================================================
// SỰ KIỆN: XỬ LÝ KHI NGƯỜI DÙNG CHỦ ĐỘNG ĐĂNG XUẤT / TẮT TRÌNH DUYỆT
// =========================================================================
document.getElementById('btn-logout')?.addEventListener('click', () => {
    isNavigating = true; 
    if (currentUser) {
        updateDoc(doc(db, "users", currentUser.uid), { isOnline: false, examStatus: 'idle' }).catch(() => {});
        sessionStorage.removeItem(`online_flag_${currentUser.uid}`);
    }
    signOut(auth).then(() => { redirect('index.html'); }).catch((error) => { showToast("Có lỗi xảy ra khi đăng xuất."); });
});

const btnBackDash = document.getElementById('btn-back-dashboard');
if (btnBackDash) btnBackDash.onclick = () => returnToLobbyOrDashboard();

window.addEventListener('beforeunload', () => {
    if (!isNavigating && currentUser) {
        updateDoc(doc(db, "users", currentUser.uid), { isOnline: false, examStatus: 'idle' }).catch(() => {});
        sessionStorage.removeItem(`online_flag_${currentUser.uid}`);
    }
});
