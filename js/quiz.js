import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, collection, getDocs, addDoc, query, where, doc, getDoc, setDoc, increment } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

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

// Biến lưu trữ điểm để truyền vào Modal Xem Lại
let finalScore = 0;
let finalCorrectCount = 0;
let finalTotal = 0;

const app = initializeApp(firebaseConfig);
auth = getAuth(app);
db = getFirestore(app); 

function redirect(url) {
    try {
        window.location.href = url;
    } catch (error) {
        console.warn("Môi trường Preview chặn chuyển hướng:", error);
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
const currentResultId = urlParams.get('resultId'); 
const currentRoomId = urlParams.get('roomId'); 

function returnToLobbyOrDashboard() {
    if (currentRoomId) {
        redirect(`lobby.html?roomId=${currentRoomId}`);
    } else {
        redirect('dashboard.html');
    }
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
    if (document.hidden && !isSubmitted && !document.getElementById('reviewExamModal').classList.contains('active')) {
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
// ========================================================

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
            loadExamDataAndQuestions();
        }
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

    if (currentRoomId && currentUser) {
        const participantRef = doc(db, "rooms", currentRoomId, "participants", currentUser.uid);
        setDoc(participantRef, { status: 'playing' }, { merge: true }).catch(err => console.error(err));
    }

    renderAll();
    startTimer();
}

async function fetchQuestionsFromFirestore() {
    document.getElementById('options-container').innerHTML = ''; 
    const questionsRef = collection(db, "questions");
    const q = query(questionsRef, where("examId", "==", currentExamId));
    
    const querySnapshot = await getDocs(q);
    const fetched = querySnapshot.docs.map(doc => { return { id: doc.id, ...doc.data() }; });
    
    if (fetched.length > 0) {
        questions = fetched.sort((a,b) => a.order - b.order); // Sắp xếp thứ tự câu
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

function stopTimer() { clearInterval(timerInterval); }

function updateTimerDisplay() {
    const minutes = Math.floor(timeRemaining / 60).toString().padStart(2, '0');
    const seconds = (timeRemaining % 60).toString().padStart(2, '0');
    document.getElementById('countdown').innerText = `${minutes}:${seconds}`;
}

async function executeSubmit() {
    stopTimer(); 
    isSubmitted = true; 
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

    // Cộng XP Leaderboard
    let gainedXP = 0;
    try {
        const resultsRef = collection(db, "results");
        const qResult = query(resultsRef, where("email", "==", currentUser.email), where("examId", "==", currentExamId));
        const resultSnapshot = await getDocs(qResult);
        
        if (resultSnapshot.empty) {
            gainedXP = Math.round((finalCorrectCount / finalTotal) * 10 * 10);
            if (gainedXP > 0) {
                const leaderboardRef = doc(db, "users_leaderboard", currentUser.uid);
                await setDoc(leaderboardRef, {
                    displayName: currentUser.displayName || currentUser.email.split('@')[0],
                    email: currentUser.email,
                    photoURL: currentUser.photoURL || "",
                    totalXP: increment(gainedXP) 
                }, { merge: true });
                showToast(`🎉 Bạn đã nhận được +${gainedXP} XP cho lần đầu hoàn thành!`);
            }
        }
    } catch (xpError) { console.error("Lỗi khi tính XP Leaderboard:", xpError); }

    if (currentRoomId && currentUser) {
        try {
            const participantRef = doc(db, "rooms", currentRoomId, "participants", currentUser.uid);
            await setDoc(participantRef, { status: 'finished', score: finalScore, timeTaken: timeSpent }, { merge: true });
        } catch (roomErr) { console.error("Lỗi cập nhật điểm vào phòng chờ:", roomErr); }
    }

    renderAll(); 
    btnSubmit.innerText = "Đã nộp bài";

    try {
        await addDoc(collection(db, "results"), {
            email: currentUser.email, examId: currentExamId, score: finalScore,
            correctCount: finalCorrectCount, totalQuestions: finalTotal,
            savedAnswers: userAnswers, timeSpent: timeSpent, timestamp: new Date().toISOString() 
        });

        const examDocRef = doc(db, "exams", currentExamId);
        await setDoc(examDocRef, { attemptCount: increment(1) }, { merge: true });
        
        showResultModal(finalCorrectCount, finalTotal, finalScore);
    } catch (error) {
        console.error("Lỗi lưu kết quả:", error);
        showResultModal(finalCorrectCount, finalTotal, finalScore);
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

// ================= LOGIC XEM LẠI BÀI LÀM (POPUP) =================
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
            let bg = '#fff'; let border = '2px solid #e5e7eb'; let color = '#374151'; let fw = 'normal'; let icon = '';

            if (oIdx === correctAns) {
                bg = '#d1fae5'; border = '2px solid #10b981'; color = '#065f46'; fw = 'bold';
                icon = '<i class="fa-solid fa-check-circle" style="color: #10b981; font-size: 1.2rem; float: right;"></i>';
            } else if (oIdx === userAns && userAns !== correctAns) {
                bg = '#fee2e2'; border = '2px solid #ef4444'; color = '#991b1b'; fw = 'bold';
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
                <div style="margin-top: 15px; padding: 15px; background: #fef3c7; border-left: 4px solid #f59e0b; border-radius: 6px; font-size: 0.95rem; color: #92400e;">
                    <b style="color: #b45309;"><i class="fa-solid fa-lightbulb"></i> Giải thích:</b><br>${q.explanation}
                </div>
            `;
        }

        let statusBadge = isUnanswered ? '<span style="background: #f3f4f6; color: #4b5563; padding: 3px 8px; border-radius: 4px; font-size: 0.8rem; font-weight: bold; margin-left: 10px;">Chưa chọn</span>' : 
                          (userAns === correctAns) ? '<span style="background: #d1fae5; color: #065f46; padding: 3px 8px; border-radius: 4px; font-size: 0.8rem; font-weight: bold; margin-left: 10px;">Đúng</span>' : 
                          '<span style="background: #fee2e2; color: #991b1b; padding: 3px 8px; border-radius: 4px; font-size: 0.8rem; font-weight: bold; margin-left: 10px;">Sai</span>';

        html += `
            <div style="background: #fff; padding: 25px; border-radius: 12px; margin-bottom: 20px; box-shadow: 0 4px 6px rgba(0,0,0,0.02); border: 1px solid #f3f4f6;">
                <h4 style="margin: 0 0 15px 0; color: #1f2937; font-weight: 800; font-size: 1.1rem; line-height: 1.5;">
                    <span style="background: #3b82f6; color: #fff; padding: 4px 10px; border-radius: 6px; font-size: 0.9rem; margin-right: 8px;">Câu ${idx+1}</span>
                    ${q.text} ${statusBadge}
                </h4>
                <div>${optionsHtml}</div>
                ${explanationHtml}
            </div>
        `;
    });

    contentArea.innerHTML = html;
}

document.getElementById('closeReviewModalBtn').addEventListener('click', () => {
    document.getElementById('reviewExamModal').classList.remove('active');
    // Nếu truy cập từ Deep Link Lịch Sử -> Về Dashboard/Lobby
    if (currentResultId) {
        returnToLobbyOrDashboard();
    } else {
        // Nếu vừa thi xong, mở lại bảng Điểm
        document.getElementById('result-modal').classList.add('active');
    }
});

document.getElementById('reviewExamModal').addEventListener('click', (e) => {
    if (e.target.id === 'reviewExamModal') {
        document.getElementById('reviewExamModal').classList.remove('active');
        if (currentResultId) returnToLobbyOrDashboard();
        else document.getElementById('result-modal').classList.add('active');
    }
});

// Xử lý truy cập Deep Link từ Lịch Sử (Lobby/Dashboard chuyển sang)
async function loadReviewMode(resultId) {
    document.getElementById('question-text').innerText = "Đang tải dữ liệu bài làm...";
    try {
        const resultDocRef = doc(db, "results", resultId);
        const resultDoc = await getDoc(resultDocRef);

        if (!resultDoc.exists()) throw new Error("Không tìm thấy kết quả bài làm trên hệ thống.");

        const resultData = resultDoc.data();
        currentExamId = resultData.examId;
        userAnswers = resultData.savedAnswers || {}; 
        isSubmitted = true;
        updateAntiCheatState(); 

        document.getElementById('quiz-title-display').innerText = `Lịch sử thi: ${currentExamId}`;
        document.getElementById('timer-container-box').style.display = 'none'; 
        
        await fetchQuestionsFromFirestore();
        
        // Mở thẳng Review Popup
        openReviewModal(resultData.score, resultData.correctCount, resultData.totalQuestions);
    } catch (error) {
        console.error("Lỗi tải Review Mode:", error);
        document.getElementById('question-text').innerText = `Lỗi hệ thống: ${error.message}`;
    }
}
// ==============================================================

// ================= LOGIC FEEDBACK RATING =================
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

function showResultModal(correctCount, total, score) {
    const modal = document.getElementById('result-modal');
    document.getElementById('modal-score-text').innerText = score;
    document.getElementById('modal-correct-text').innerText = `${correctCount}/${total}`;
    
    const percentage = (correctCount / total) * 100;
    document.getElementById('modal-score-circle').style.background = `conic-gradient(#10b981 ${percentage}%, #d1fae5 ${percentage}%)`;

    resetFeedbackUI(); 
    modal.classList.add('active');
}

function closeModal() { document.getElementById('result-modal').classList.remove('active'); }

document.getElementById('btn-modal-dashboard-modal').onclick = () => returnToLobbyOrDashboard();
document.getElementById('btn-back-dashboard').onclick = () => returnToLobbyOrDashboard();

document.getElementById('btn-modal-retry').onclick = () => {
    closeModal();
    initExamState();
};

// ĐỔI SỰ KIỆN NÚT: Gọi thẳng Popup Review Modal
document.getElementById('btn-modal-explain').onclick = () => {
    closeModal();
    openReviewModal(finalScore, finalCorrectCount, finalTotal);
};

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

document.getElementById('btn-prev').onclick = () => { if(currentIndex > 0) { currentIndex--; renderAll(); } };
document.getElementById('btn-next').onclick = () => { if(currentIndex < questions.length - 1) { currentIndex++; renderAll(); } };

document.getElementById('btn-logout').addEventListener('click', () => {
    signOut(auth).then(() => { redirect('index.html'); }).catch((error) => { showToast("Có lỗi xảy ra khi đăng xuất."); });
});

document.addEventListener('keydown', (e) => {
    if (questions.length === 0 || document.activeElement.tagName === 'TEXTAREA') return;
    const key = e.key;
    if (key === 'ArrowLeft') { if(currentIndex > 0) { currentIndex--; renderAll(); } } 
    else if (key === 'ArrowRight') { if(currentIndex < questions.length - 1) { currentIndex++; renderAll(); } } 
    else if (!isSubmitted) {
        const keyMap = { 'a': 0, 'A': 0, 'b': 1, 'B': 1, 'c': 2, 'C': 2, 'd': 3, 'D': 3 };
        const optionIndex = keyMap[key];
        if (optionIndex !== undefined && questions[currentIndex].options && optionIndex < questions[currentIndex].options.length) {
            handleOptionSelect(optionIndex); 
        }
    }
});
