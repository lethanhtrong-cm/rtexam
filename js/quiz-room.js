import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, collection, getDocs, addDoc, query, where, doc, getDoc, setDoc, increment, onSnapshot } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

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

let isSubmitted = false;
let currentUser = null; 

let timerInterval;
let examDuration = 15 * 60; 
let timeRemaining = examDuration;

const app = initializeApp(firebaseConfig);
auth = getAuth(app);
db = getFirestore(app); 

function redirect(url) {
    try {
        window.location.href = url;
    } catch (error) {
        console.warn("Môi trường Preview chặn chuyển hướng:", error);
        document.body.innerHTML = `<h2 style='text-align:center; padding: 50px;'>Hệ thống đang cố chuyển hướng tới ${url}. Vui lòng chạy trên môi trường thực tế.</h2>`;
    }
}

function showToast(msg) {
    const toast = document.getElementById('toast-message');
    toast.innerText = msg;
    toast.style.transform = 'translateY(0)';
    toast.style.opacity = '1';
    setTimeout(() => {
        toast.style.transform = 'translateY(100px)';
        toast.style.opacity = '0';
    }, 3000);
}

const urlParams = new URLSearchParams(window.location.search);
let currentExamId = urlParams.get('examId'); 
const currentRoomId = urlParams.get('roomId'); 

if (!currentExamId || !currentRoomId) {
    document.body.innerHTML = `<h2 style='text-align:center; padding: 50px;'>Lỗi: Không tìm thấy mã đề thi hoặc mã phòng. Đang chuyển hướng...</h2>`;
    setTimeout(() => redirect('dashboard.html'), 2000);
}

// ================= ANTI CHEATING LOGIC =================
let warningCount = 0;

function updateAntiCheatState() {
    if (!isSubmitted) {
        document.body.classList.add('no-select');
    } else {
        document.body.classList.remove('no-select');
    }
}

['contextmenu', 'copy', 'cut', 'paste'].forEach(evt => {
    document.addEventListener(evt, (e) => {
        if (!isSubmitted) {
            e.preventDefault();
            showToast("⚠️ Hành động này bị vô hiệu hóa trong phòng thi!");
        }
    });
});

document.addEventListener('visibilitychange', () => {
    if (document.hidden && !isSubmitted) {
        warningCount++;
        const warningModal = document.getElementById('cheat-warning-modal');
        const warningText = document.getElementById('cheat-warning-text');
        
        if (warningCount >= 3) {
            warningText.innerHTML = `<b>Vi phạm lần ${warningCount}:</b> Bạn vừa rời khỏi phòng thi!<br><br>Bạn đã vi phạm quá 3 lần, hệ thống sẽ tự động thu bài.`;
            document.getElementById('btn-close-warning').innerText = "Đóng & Nộp bài";
            warningModal.classList.add('active');
            
            document.getElementById('btn-close-warning').onclick = () => {
                warningModal.classList.remove('active');
            };
            
            executeSubmit();
        } else {
            warningText.innerHTML = `<b>Vi phạm lần ${warningCount}:</b> Bạn vừa rời khỏi phòng thi!<br><br>Nếu vi phạm quá 3 lần, hệ thống sẽ tự động thu bài.`;
            document.getElementById('btn-close-warning').innerText = "Tôi đã hiểu";
            warningModal.classList.add('active');
            
            document.getElementById('btn-close-warning').onclick = () => {
                warningModal.classList.remove('active');
            };
        }
    }
});
// ========================================================

onAuthStateChanged(auth, (user) => {
    if (!user || user.isAnonymous) {
        redirect('index.html');
    } else {
        currentUser = user;
        document.getElementById('quiz-title-display').innerText = `Đấu trường: Đề ${currentExamId}`;
        loadExamDataAndQuestions();
    }
});

async function loadExamDataAndQuestions() {
    document.getElementById('question-text').innerText = "Đang tải đề thi từ hệ thống...";
    
    try {
        const examDocRef = doc(db, "exams", currentExamId);
        const examDoc = await getDoc(examDocRef);
        
        if (examDoc.exists() && examDoc.data().timeLimit) {
            examDuration = examDoc.data().timeLimit * 60; 
        }
        
        await fetchQuestionsFromFirestore();
        initExamState(); 
        
    } catch (error) {
        console.error("Lỗi khi tải dữ liệu đề thi:", error);
        document.getElementById('question-text').innerText = `Lỗi tải đề thi: ${error.message}`;
    }
}

function initExamState() {
    currentIndex = 0;
    userAnswers = {};
    isSubmitted = false;
    warningCount = 0;
    
    updateAntiCheatState(); 
    
    const btnSubmit = document.getElementById('btn-submit-exam');
    btnSubmit.disabled = false; 
    btnSubmit.innerText = "Nộp bài ngay"; 
    btnSubmit.onclick = () => submitExam(false);

    // ================= TÍNH NĂNG ROOM: BÁO ĐANG THI & LẮNG NGHE CHỦ PHÒNG =================
    if (currentRoomId && currentUser) {
        const participantRef = doc(db, "rooms", currentRoomId, "participants", currentUser.uid);
        setDoc(participantRef, { status: 'playing' }, { merge: true }).catch(err => console.error(err));

        const roomRef = doc(db, "rooms", currentRoomId);
        onSnapshot(roomRef, (snapshot) => {
            if (snapshot.exists()) {
                const roomData = snapshot.data();
                if (roomData.status === 'closed' && !isSubmitted) {
                    // SỬA LỖI: Hiện đúng thông báo bị ép nộp bài do chủ phòng đóng
                    const overlayText = document.querySelector('#force-submit-overlay div:nth-child(2)');
                    if (overlayText) overlayText.innerText = "Chủ phòng đã kết thúc bài thi. Đang tự động thu bài...";

                    document.getElementById('force-submit-overlay').classList.add('active');
                    executeSubmit();
                }
            }
        });
    }
    // =======================================================================================

    renderAll();
    startTimer();
}

async function fetchQuestionsFromFirestore() {
    document.getElementById('options-container').innerHTML = ''; 
    const questionsRef = collection(db, "questions");
    const q = query(questionsRef, where("examId", "==", currentExamId));
    
    const querySnapshot = await getDocs(q);
    const fetched = querySnapshot.docs.map(doc => {
        return { id: doc.id, ...doc.data() };
    });
    
    if (fetched.length > 0) {
        questions = fetched;
    } else {
        throw new Error(`Không tìm thấy câu hỏi nào cho mã đề: ${currentExamId}`);
    }
}

function startTimer() {
    clearInterval(timerInterval);
    timeRemaining = examDuration; 
    updateTimerDisplay();

    timerInterval = setInterval(() => {
        timeRemaining--;
        updateTimerDisplay();

        if (timeRemaining <= 0) {
            clearInterval(timerInterval);
            submitExam(true); 
        }
    }, 1000);
}

function stopTimer() {
    clearInterval(timerInterval);
}

function updateTimerDisplay() {
    const minutes = Math.floor(timeRemaining / 60).toString().padStart(2, '0');
    const seconds = (timeRemaining % 60).toString().padStart(2, '0');
    document.getElementById('countdown').innerText = `${minutes}:${seconds}`;

    const timerContainer = document.getElementById('timer-container-box');
    if (timeRemaining <= 30 && timeRemaining > 0) {
        timerContainer.classList.add('timer-blink');
    } else {
        timerContainer.classList.remove('timer-blink');
    }
}

// ================= TÍNH NĂNG: XỬ LÝ NÚT VỀ PHÒNG CHỜ =================
const btnBackLobby = document.getElementById('btn-back-lobby');
if (btnBackLobby) {
    btnBackLobby.addEventListener('click', () => {
        if (isSubmitted) {
            redirect(`lobby.html?roomId=${currentRoomId}`);
        } else {
            const confirmLeaveModal = document.getElementById('confirm-leave-modal');
            if (confirmLeaveModal) confirmLeaveModal.classList.add('active');
        }
    });
}

const btnCancelLeave = document.getElementById('btn-cancel-leave');
if (btnCancelLeave) {
    btnCancelLeave.addEventListener('click', () => {
        document.getElementById('confirm-leave-modal').classList.remove('active');
    });
}

const btnConfirmLeave = document.getElementById('btn-confirm-leave');
if (btnConfirmLeave) {
    btnConfirmLeave.addEventListener('click', async () => {
        const btnConfirm = document.getElementById('btn-confirm-leave');
        const btnCancel = document.getElementById('btn-cancel-leave');
        
        btnConfirm.innerText = "Đang xử lý...";
        btnConfirm.disabled = true;
        btnCancel.disabled = true;

        isSubmitted = true;
        updateAntiCheatState();
        stopTimer();

        if (currentRoomId && currentUser) {
            try {
                const participantRef = doc(db, "rooms", currentRoomId, "participants", currentUser.uid);
                await setDoc(participantRef, { 
                    status: 'finished', 
                    score: 0,
                    timeTaken: 0 
                }, { merge: true });
            } catch (err) {
                console.error("Lỗi cập nhật trạng thái:", err);
            }
        }

        redirect(`lobby.html?roomId=${currentRoomId}`);
    });
}
// ==================================================================

async function executeSubmit() {
    stopTimer(); 
    isSubmitted = true; 
    updateAntiCheatState(); 
    
    const total = questions.length;
    const timeSpent = examDuration - timeRemaining; 
    
    const btnSubmit = document.getElementById('btn-submit-exam');
    btnSubmit.disabled = true; 
    btnSubmit.innerText = "Đang xử lý..."; 

    let correctCount = 0;
    questions.forEach((question, idx) => {
        if (userAnswers[idx] === question.correctAnswer) {
            correctCount++;
        }
    });

    let score = (correctCount / total) * 10;
    score = Math.round(score * 100) / 100; 

    // Cập nhật XP Leaderboard
    let gainedXP = 0;
    try {
        const resultsRef = collection(db, "results");
        const qResult = query(resultsRef, where("email", "==", currentUser.email), where("examId", "==", currentExamId));
        const resultSnapshot = await getDocs(qResult);
        
        if (resultSnapshot.empty) {
            gainedXP = Math.round((correctCount / total) * 10 * 10);
            if (gainedXP > 0) {
                const leaderboardRef = doc(db, "users_leaderboard", currentUser.uid);
                await setDoc(leaderboardRef, {
                    displayName: currentUser.displayName || currentUser.email.split('@')[0],
                    email: currentUser.email,
                    photoURL: currentUser.photoURL || "",
                    totalXP: increment(gainedXP) 
                }, { merge: true });
            }
        }
    } catch (xpError) {
        console.error("Lỗi khi tính XP Leaderboard:", xpError);
    }

    // Cập nhật Điểm số vào Room
    if (currentRoomId && currentUser) {
        try {
            const participantRef = doc(db, "rooms", currentRoomId, "participants", currentUser.uid);
            await setDoc(participantRef, {
                status: 'finished',
                score: score,
                timeTaken: timeSpent
            }, { merge: true });
        } catch (roomErr) {
            console.error("Lỗi cập nhật điểm vào phòng chờ:", roomErr);
        }
    }

    renderAll(); 
    btnSubmit.innerText = "Đã nộp bài";
    document.getElementById('force-submit-overlay').classList.add('active'); 

    try {
        await addDoc(collection(db, "results"), {
            email: currentUser.email,
            examId: currentExamId,
            score: score,
            correctCount: correctCount,
            totalQuestions: total,
            savedAnswers: userAnswers, 
            timeSpent: timeSpent,
            timestamp: new Date().toISOString() 
        });

        const examDocRef = doc(db, "exams", currentExamId);
        await setDoc(examDocRef, { attemptCount: increment(1) }, { merge: true });
        
        setTimeout(() => redirect(`lobby.html?roomId=${currentRoomId}`), 2000);
    } catch (error) {
        console.error("Lỗi lưu kết quả:", error);
        showToast("Lỗi lưu kết quả. Đang trở về phòng chờ...");
        setTimeout(() => redirect(`lobby.html?roomId=${currentRoomId}`), 2000);
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
            
            // SỬA LỖI UI: Đang tự nộp thì báo đang nộp
            const overlayText = document.querySelector('#force-submit-overlay div:nth-child(2)');
            if (overlayText) overlayText.innerText = "Đang xử lý nộp bài của bạn...";

            executeSubmit();
        };
        document.getElementById('btn-cancel-submit').onclick = () => {
            confirmModal.classList.remove('active');
        };
    } else {
        showToast("Hệ thống đang tự động thu bài!");
        
        // SỬA LỖI UI: Báo hết giờ
        const overlayText = document.querySelector('#force-submit-overlay div:nth-child(2)');
        if (overlayText) overlayText.innerText = "Đã hết thời gian làm bài. Đang tự động thu bài...";

        executeSubmit();
    }
}

function handleOptionSelect(idx) {
    if (isSubmitted) return; 
    userAnswers[currentIndex] = idx; 
    renderQuestion(); 
    renderPalette();  
    
    setTimeout(() => {
        if (isSubmitted) return; 
        if (currentIndex < questions.length - 1) {
            currentIndex++; 
            renderAll();
        } else {
            const firstUnansweredIdx = questions.findIndex((_, i) => userAnswers[i] === undefined);
            if (firstUnansweredIdx !== -1) {
                currentIndex = firstUnansweredIdx; 
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
}

function renderPalette() {
    const container = document.getElementById('palette-container');
    container.innerHTML = '';
    
    questions.forEach((q, idx) => {
        const btn = document.createElement('button');
        let btnClasses = 'palette-btn';
        if (idx === currentIndex) btnClasses += ' current';
        if (userAnswers[idx] !== undefined) btnClasses += ' answered';

        btn.className = btnClasses;
        btn.innerText = idx + 1;
        btn.onclick = () => { currentIndex = idx; renderAll(); };
        container.appendChild(btn);
    });
}

document.getElementById('btn-prev').onclick = () => { 
    if(currentIndex > 0) { currentIndex--; renderAll(); } 
};
document.getElementById('btn-next').onclick = () => { 
    if(currentIndex < questions.length - 1) { currentIndex++; renderAll(); } 
};

// PHÍM TẮT ĐIỀU HƯỚNG
document.addEventListener('keydown', (e) => {
    if (questions.length === 0 || document.activeElement.tagName === 'TEXTAREA') return;

    const key = e.key;
    if (key === 'ArrowLeft') {
        if(currentIndex > 0) { currentIndex--; renderAll(); } 
    } else if (key === 'ArrowRight') {
        if(currentIndex < questions.length - 1) { currentIndex++; renderAll(); } 
    } 
    else if (!isSubmitted) {
        const keyMap = { 'a': 0, 'A': 0, 'b': 1, 'B': 1, 'c': 2, 'C': 2, 'd': 3, 'D': 3 };
        const optionIndex = keyMap[key];
        
        if (optionIndex !== undefined && questions[currentIndex].options && optionIndex < questions[currentIndex].options.length) {
            handleOptionSelect(optionIndex); 
        }
    }
});
