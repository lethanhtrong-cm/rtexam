import { auth, db, safeRedirect } from "./dashboard-core.js";
import { collection, getDocs, doc, setDoc, updateDoc, arrayUnion, arrayRemove, query, where, or, addDoc, onSnapshot, serverTimestamp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

export let allExamsData = []; 
let currentUserData = null;
let currentView = 'grid'; 

let currentTechnique = 'all'; 
let currentLevel = 'all';     
let currentTime = 'all';      
let currentSearchQuery = '';  
let completedExams = {}; 
let currentShareExamId = null;

document.addEventListener("authReady", async (e) => {
    currentUserData = e.detail.currentUserData;
    if (currentUserData && !currentUserData.bookmarks) {
        currentUserData.bookmarks = [];
    }
    
    try {
        if (e.detail.user && e.detail.user.email) {
            const resultsRef = collection(db, "results");
            const q = query(resultsRef, where("email", "==", e.detail.user.email));
            const snap = await getDocs(q);
            snap.forEach(doc => {
                const data = doc.data();
                const examId = data.examId || data.examCode;
                if (examId) {
                    const ts = data.createdAt ? (typeof data.createdAt.toMillis === 'function' ? data.createdAt.toMillis() : new Date(data.createdAt).getTime()) : data.timestamp || 0;
                    if (!completedExams[examId] || ts >= completedExams[examId].timestamp) {
                        completedExams[examId] = {
                            score: data.score || 0,
                            total: data.totalQuestions || data.total || 1,
                            timestamp: ts,
                            resultId: doc.id
                        };
                    }
                }
            });
        }
    } catch (err) {
        console.error("Lỗi khởi tạo Dashboard:", err);
    }

    setupToolbarEvents(); 
    setupFilterEvents(); 
    await loadAggregatedExamData(); 
});

window.openShareModal = function(examId) {
    currentShareExamId = examId;
    const currentUrl = window.location.href;
    const baseUrl = currentUrl.substring(0, currentUrl.lastIndexOf('/') + 1);
    const fullLink = `${baseUrl}quiz.html?examId=${examId}`;
    
    document.getElementById('shareLinkInput').value = fullLink;
    document.getElementById('shareEmailInput').value = '';
    document.getElementById('shareExamModal').classList.add('active');
};

window.copyShareLink = function() {
    const copyText = document.getElementById('shareLinkInput');
    copyText.select();
    copyText.setSelectionRange(0, 99999); 
    try {
        document.execCommand('copy');
        alert("Đã copy link thành công vào bộ nhớ tạm!");
    } catch (err) {
        alert("Lỗi khi copy link, trình duyệt của bạn chặn quyền này.");
    }
};

window.sendShareNotification = async function() {
    const toEmail = document.getElementById('shareEmailInput').value.trim();
    if (!toEmail) return alert("Vui lòng nhập Email người nhận!");
    if (!auth.currentUser || !auth.currentUser.email) return alert("Lỗi gửi thông báo. Vui lòng tải lại trang.");
    if (toEmail === auth.currentUser.email) return alert("Bạn không thể tự gửi thông báo cho chính mình.");

    try {
        await addDoc(collection(db, "notifications"), {
            examId: currentShareExamId,
            fromEmail: auth.currentUser.email,
            toEmail: toEmail,
            status: 'unread',
            timestamp: serverTimestamp(),
            type: 'exam_share'
        });
        alert("Đã gửi thông báo chia sẻ thành công tới " + toEmail);
        document.getElementById('shareExamModal').classList.remove('active');
    } catch (error) {
        console.error("Lỗi khi gửi thông báo:", error);
        alert("Đã xảy ra lỗi khi gửi. Vui lòng kiểm tra lại kết nối mạng!");
    }
};

function setupToolbarEvents() {
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
                
                await setDoc(doc(db, "rooms", newRoomId), {
                    hostEmail: auth.currentUser.email,
                    status: 'waiting',
                    createdAt: serverTimestamp(),
                    examId: null,
                    examName: null,
                    isLocked: false
                });
                
                window.location.href = `lobby.html?roomId=${newRoomId}`;
            } catch (error) {
                console.error("Lỗi tạo phòng trực tiếp:", error);
                alert("Đã xảy ra lỗi khi tạo phòng. Vui lòng thử lại!");
                btnOpenCreateRoom.disabled = false;
                btnOpenCreateRoom.innerHTML = originalHtml;
            }
        });
    }

    if (btnAutoGenerate) {
        btnAutoGenerate.addEventListener('click', () => {
            const modal = document.getElementById('aiGenerateModal');
            if (modal) modal.classList.add('active');
        });
    }

    const closeAiModalBtn = document.getElementById('closeAiModalBtn');
    if (closeAiModalBtn) {
        closeAiModalBtn.addEventListener('click', () => {
            const modal = document.getElementById('aiGenerateModal');
            if (modal) modal.classList.remove('active');
        });
    }
    
    const btnCancelAi = document.getElementById('btnCancelAi');
    if (btnCancelAi) {
        btnCancelAi.addEventListener('click', () => {
            const modal = document.getElementById('aiGenerateModal');
            if (modal) modal.classList.remove('active');
        });
    }

    if (btnUploadExam) {
        btnUploadExam.addEventListener('click', () => {
            alert("Tính năng Upload đề thi thủ công đang được phát triển!");
        });
    }
}

function setupFilterEvents() {
    const searchInput = document.getElementById('searchInput');
    const levelPills = document.querySelectorAll('#levelFilter .pill-btn');
    const timePills = document.querySelectorAll('#timeFilter .pill-btn');
    const sortFilter = document.getElementById('sortFilter');
    const viewBtns = document.querySelectorAll('.view-btn');
    const subMenuItems = document.querySelectorAll('.sub-menu-item');
    const examListContainer = document.getElementById('examListContainer');

    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            currentSearchQuery = e.target.value.toLowerCase();
            renderExams();
        });
    }

    if (levelPills) {
        levelPills.forEach(pill => {
            pill.addEventListener('click', (e) => {
                levelPills.forEach(p => p.classList.remove('active'));
                e.target.classList.add('active');
                currentLevel = e.target.getAttribute('data-level');
                renderExams();
            });
        });
    }

    if (timePills) {
        timePills.forEach(pill => {
            pill.addEventListener('click', (e) => {
                timePills.forEach(p => p.classList.remove('active'));
                e.target.classList.add('active');
                currentTime = e.target.getAttribute('data-time');
                renderExams();
            });
        });
    }

    if (sortFilter) {
        sortFilter.addEventListener('change', () => renderExams());
    }

    if (viewBtns) {
        viewBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                viewBtns.forEach(b => b.classList.remove('active'));
                const targetBtn = e.target.closest('.view-btn');
                targetBtn.classList.add('active');
                currentView = targetBtn.getAttribute('data-view');
                if(examListContainer) {
                    if (currentView === 'grid') {
                        examListContainer.classList.remove('list-view');
                        examListContainer.classList.add('grid-view');
                    } else {
                        examListContainer.classList.remove('grid-view');
                        examListContainer.classList.add('list-view');
                    }
                }
            });
        });
    }

    if (subMenuItems) {
        subMenuItems.forEach(item => {
            item.addEventListener('click', (e) => {
                const tech = item.getAttribute('data-technique');
                if (tech) {
                    currentTechnique = tech;
                    if(searchInput) searchInput.value = '';
                    currentSearchQuery = '';
                    renderExams();
                }
            });
        });
    }
}

async function loadAggregatedExamData() {
    try {
        const questionsRef = collection(db, "questions");
        const qSnap = await getDocs(questionsRef);
        const examMap = {}; 
        
        qSnap.forEach((doc) => {
            const data = doc.data();
            const eId = data.examId;
            if (eId) {
                if (!examMap[eId]) examMap[eId] = { id: eId, questionCount: 0 };
                examMap[eId].questionCount++;
            }
        });

        const examsConfigRef = collection(db, "exams");
        let examsQuery;

        if (auth.currentUser) {
            examsQuery = query(
                examsConfigRef, 
                or(
                    where("isPublic", "==", true),
                    where("creatorId", "==", auth.currentUser.uid)
                )
            );
        } else {
            examsQuery = query(examsConfigRef, where("isPublic", "==", true));
        }

        const eSnap = await getDocs(examsQuery);

        eSnap.forEach((doc) => {
            const eId = doc.id;
            if (examMap[eId]) {
                examMap[eId].isValid = true; 
                const conf = doc.data();
                examMap[eId].isVip = conf.isVip || false;
                examMap[eId].timeLimit = conf.timeLimit ? parseInt(conf.timeLimit) : 15;
                examMap[eId].attemptCount = conf.attemptCount || 0;
                examMap[eId].technique = conf.technique || "Hỗn hợp";
                examMap[eId].level = conf.level || "Trung bình";
                
                // --- XỬ LÝ LỖI PARSE THỜI GIAN CHO ĐỀ ADMIN ---
                let parsedTime = 0;
                const rawTime = conf.createdAt || conf.timestamp; // Hỗ trợ cả 2 tên trường cũ và mới
                if (rawTime) {
                    if (typeof rawTime.toMillis === 'function') {
                        parsedTime = rawTime.toMillis();
                    } else if (rawTime.seconds !== undefined) {
                        parsedTime = rawTime.seconds * 1000;
                    } else {
                        parsedTime = new Date(rawTime).getTime();
                    }
                }
                examMap[eId].createdAt = isNaN(parsedTime) ? 0 : parsedTime;
            }
        });

        const feedbacksRef = collection(db, "feedbacks");
        const fSnap = await getDocs(feedbacksRef);
        const ratingMap = {}; 
        
        fSnap.forEach((doc) => {
            const data = doc.data();
            const eId = data.examId;
            const stars = data.rating || 5; 
            if (eId) {
                if (!ratingMap[eId]) ratingMap[eId] = { total: 0, count: 0 };
                ratingMap[eId].total += stars;
                ratingMap[eId].count++;
            }
        });

        Object.keys(examMap).forEach(eId => {
            if (!examMap[eId].isValid) {
                delete examMap[eId];
                return; 
            }
            if (examMap[eId].timeLimit === undefined) examMap[eId].timeLimit = 15;
            if (examMap[eId].isVip === undefined) examMap[eId].isVip = false;
            if (examMap[eId].attemptCount === undefined) examMap[eId].attemptCount = 0;

            if (ratingMap[eId]) {
                const avg = ratingMap[eId].total / ratingMap[eId].count;
                examMap[eId].rating = Math.round(avg * 10) / 10; 
                examMap[eId].ratingCount = ratingMap[eId].count;
            } else {
                examMap[eId].rating = 5.0; 
                examMap[eId].ratingCount = 0;
            }
        });

        allExamsData = Object.values(examMap);

        // --- GIỚI HẠN HIỂN THỊ TỐI ĐA 10 ĐỀ AI MỚI NHẤT ---
        const aiExams = allExamsData.filter(e => e.technique === "AI Tự Động").sort((a, b) => b.createdAt - a.createdAt).slice(0, 10);
        const otherExams = allExamsData.filter(e => e.technique !== "AI Tự Động");
        allExamsData = [...otherExams, ...aiExams];

        const examsReadyEvent = new CustomEvent("examsReady", { detail: { allExamsData } });
        document.dispatchEvent(examsReadyEvent);

        renderExams();

    } catch (error) {
        console.error("Lỗi khi tổng hợp dữ liệu đề thi:", error);
    }
}

function renderExams() {
    const examListContainer = document.getElementById('examListContainer');
    const sortFilter = document.getElementById('sortFilter');
    
    if (!examListContainer) return;

    if (allExamsData.length === 0) {
        examListContainer.innerHTML = '<div class="loading-text">Hiện tại chưa có khóa học / đề thi nào.</div>';
        return;
    }

    let displayData = [...allExamsData];
    const userBookmarks = (currentUserData && currentUserData.bookmarks) ? currentUserData.bookmarks : [];

    if (currentTechnique === 'saved') {
        displayData = displayData.filter(exam => userBookmarks.includes(exam.id));
    } else if (currentTechnique !== 'all') {
        displayData = displayData.filter(exam => exam.technique === currentTechnique);
    }
    
    if (currentLevel !== 'all') displayData = displayData.filter(exam => exam.level === currentLevel);
    if (currentTime !== 'all') displayData = displayData.filter(exam => exam.timeLimit === parseInt(currentTime));
    
    if (currentSearchQuery !== '') {
        displayData = displayData.filter(exam => 
            exam.id.toLowerCase().includes(currentSearchQuery) || 
            (exam.technique && exam.technique.toLowerCase().includes(currentSearchQuery))
        );
    }

    if (sortFilter) {
        const filterType = sortFilter.value;
        if (filterType === 'only_vip') displayData = displayData.filter(exam => exam.isVip);
        else if (filterType === 'only_free') displayData = displayData.filter(exam => !exam.isVip);

        if (filterType === 'highest_rating') displayData.sort((a, b) => b.rating - a.rating);
        else if (filterType === 'most_attempts') displayData.sort((a, b) => b.attemptCount - a.attemptCount);
        else displayData.sort((a, b) => b.createdAt - a.createdAt); 
    }

    examListContainer.innerHTML = "";
    
    if (currentView === 'grid') {
        examListContainer.className = "grid-view swimlane-view";
    } else {
        examListContainer.className = "list-view";
    }

    if (displayData.length === 0) {
        examListContainer.innerHTML = '<div class="loading-text">Không tìm thấy đề thi phù hợp với bộ lọc.</div>';
        return;
    }

    const isUserVip = currentUserData && currentUserData.isVip === true;

    const groups = [
        { title: "📝 Đề đã thi & Cần ôn tập", data: displayData.filter(exam => !!completedExams[exam.id]) },
        { title: "⚡ Khởi động nhanh (15 phút)", data: displayData.filter(exam => exam.timeLimit === 15) },
        { title: "🔥 Thử thách chuyên sâu", data: displayData.filter(exam => exam.level === 'Khó') },
        { title: "🧲 Khối kiến thức MRI", data: displayData.filter(exam => exam.technique === 'MRI') },
        { title: "☢️ Khối kiến thức CT Scanner", data: displayData.filter(exam => exam.technique === 'CT') },
        { title: "🩻 Khối kiến thức X-Quang", data: displayData.filter(exam => exam.technique === 'X quang') },
        { title: "🧩 Đề Hỗn hợp và AI", data: displayData.filter(exam => exam.technique === 'Hỗn hợp' || exam.technique === 'AI Tự Động' || !['MRI', 'CT', 'X quang'].includes(exam.technique)) }
    ];

    groups.forEach(group => {
        if (group.data.length === 0) return; 

        let rowHtml = `
            <div class="exam-category-row mb-5">
                <h4 class="fw-bold mb-3 text-dark" style="font-size: 1.15rem; border-left: 4px solid #084298; padding-left: 10px;">${group.title}</h4>
                <div class="swimlane-wrapper">
                    <button class="slider-btn left" onclick="slideLeft(this)"><i class="fa-solid fa-chevron-left"></i></button>
                    <div class="swimlane-scroll-container hide-scrollbar">
        `;

        group.data.forEach(exam => {
            const isExamVip = exam.isVip;
            const isSaved = userBookmarks.includes(exam.id);
            const isCompleted = !!completedExams[exam.id];
            
            const badgeHtml = isExamVip 
                ? `<span class="course-badge badge-vip header-badge"><i class="fa-solid fa-crown"></i> PRO</span>`
                : `<span class="course-badge badge-free header-badge">Free</span>`;
                
            const bookmarkHtml = `
                <button class="btn-bookmark header-bookmark ${isSaved ? 'saved' : ''}" onclick="toggleBookmark(event, '${exam.id}')" title="Lưu đề thi">
                    <i class="${isSaved ? 'fa-solid' : 'fa-regular'} fa-heart"></i>
                </button>
            `;

            const headerHtml = `
                <div class="header-flex-container" style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 18px; gap: 15px;">
                    <div style="display: flex; align-items: center; gap: 8px; flex: 1; overflow: hidden;">
                        <h3 class="card-title" style="margin: 0; padding: 0; font-size: 1.25rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${exam.id}</h3>
                        ${isCompleted ? '<i class="fas fa-check-circle text-success" style="color: #198754; font-size: 1.15rem; flex-shrink: 0;" title="Đã hoàn thành"></i>' : ''}
                    </div>
                    <div style="display: flex; align-items: center; gap: 10px; flex-shrink: 0;">
                        ${badgeHtml}
                        ${bookmarkHtml}
                    </div>
                </div>
            `;

            let levelColor = '#d97706';
            let levelIcon = 'fa-chart-bar';
            if (exam.level === 'Dễ') { levelColor = '#059669'; levelIcon = 'fa-arrow-trend-up'; } 
            else if (exam.level === 'Khó') { levelColor = '#dc2626'; levelIcon = 'fa-fire'; }

            // Chuyển đổi timestamp, ẩn thẻ lịch nếu đề cũ không có trường thời gian
            let datePillHtml = "";
            if (exam.createdAt > 0) {
                const dateObj = new Date(exam.createdAt);
                const dd = String(dateObj.getDate()).padStart(2, '0');
                const mm = String(dateObj.getMonth() + 1).padStart(2, '0');
                const yyyy = dateObj.getFullYear();
                datePillHtml = `<span style="padding: 4px 8px; border-radius: 6px; font-size: 0.72rem; font-weight: 600; display: inline-flex; align-items: center; gap: 4px; border: 1px solid #e9ecef; background-color: #f8f9fa; white-space: nowrap; flex-shrink: 0; color: #4b5563;"> <i class="fa-regular fa-calendar-days" style="font-size: 0.7rem;"></i> ${dd}/${mm}/${yyyy} </span>`;
            }

            const pillBaseStyle = "padding: 4px 8px; border-radius: 6px; font-size: 0.72rem; font-weight: 600; display: inline-flex; align-items: center; gap: 4px; border: 1px solid #e9ecef; background-color: #f8f9fa; white-space: nowrap; flex-shrink: 0;";

            const mergedTagsHtml = `
                <div style="display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 20px; overflow: hidden; width: 100%;">
                    <span style="${pillBaseStyle} color: #0284c7;"> <i class="fa-solid fa-microchip" style="font-size: 0.7rem;"></i> ${exam.technique} </span>
                    <span style="${pillBaseStyle} color: ${levelColor};"> <i class="fa-solid ${levelIcon}" style="font-size: 0.7rem;"></i> ${exam.level} </span>
                    <span style="${pillBaseStyle} color: #4b5563;"> <i class="fa-solid fa-list-check" style="font-size: 0.7rem;"></i> ${exam.questionCount} câu </span>
                    <span style="${pillBaseStyle} color: #4b5563;"> <i class="fa-regular fa-clock" style="font-size: 0.7rem;"></i> ${exam.timeLimit} phút </span>
                    ${datePillHtml}
                </div>
            `;

            let actionAreaHtml = '';
            
            if (isExamVip && !isUserVip) {
                actionAreaHtml = `
                    <button onclick="goToUpgrade()" style="width: 100%; display: block; padding: 12px; border: none; background: linear-gradient(135deg, #fff3cd 0%, #ffe69c 100%); color: #997404; border-radius: 8px; font-weight: 600; cursor: pointer; transition: all 0.3s ease; box-shadow: 0 2px 4px rgba(255, 230, 156, 0.4);">
                        <i class="fa-solid fa-crown me-2"></i> Nâng cấp tài khoản Pro
                    </button>
                `;
            } else if (isCompleted) {
                const correctAnswers = completedExams[exam.id].score || 0;
                const total = completedExams[exam.id].total || 1;
                const resultId = completedExams[exam.id].resultId; 

                let displayScore = (correctAnswers / total) * 10;
                displayScore = Number.isInteger(displayScore) ? displayScore : parseFloat(displayScore.toFixed(1));

                actionAreaHtml = `
                    <div style="margin-bottom: 20px; padding: 12px 16px; background-color: #f8f9fa; border: 1px solid #e9ecef; border-radius: 12px; display: flex; align-items: center; justify-content: space-between;">
                        <div>
                            <span style="font-size: 0.85rem; color: #6c757d; font-weight: 600; display: block; margin-bottom: 4px;">Lần thi gần nhất</span>
                            <span style="font-size: 1.15rem; color: #0ba360; font-weight: 800;">${displayScore} <span style="font-size:0.85rem; color:#6c757d; font-weight:600;">/ 10</span></span>
                        </div>
                    </div>
                    
                    <div style="display: flex; gap: 8px; width: 100%;">
                        <button onclick="goToReview('${resultId}')" style="flex: 1; padding: 10px 0; border: 1px solid #adb5bd; background: transparent; color: #495057; border-radius: 8px; font-weight: 600; cursor: pointer; transition: all 0.2s;">
                            <i class="fa-solid fa-eye"></i> Xem lại
                        </button>
                        <button onclick="goToQuiz('${exam.id}')" style="flex: 1; padding: 10px 0; border: none; background: #cfe2ff; color: #084298; border-radius: 8px; font-weight: 600; cursor: pointer; transition: all 0.2s;">
                            <i class="fas fa-redo"></i> Thi lại
                        </button>
                        <button onclick="openShareModal('${exam.id}')" style="width: 44px; flex-shrink: 0; background: #e0e7ff; color: #3730a3; border: none; border-radius: 8px; cursor: pointer; transition: all 0.2s;" title="Chia sẻ">
                            <i class="fa-solid fa-share-nodes"></i>
                        </button>
                    </div>
                `;
            } else {
                actionAreaHtml = `
                    <div style="display: flex; gap: 8px; width: 100%;">
                        <button class="btn-primary" style="flex: 1; padding: 10px; font-size: 1rem; border-radius: 8px; border: none;" onclick="goToQuiz('${exam.id}')">
                            Vào thi ngay <i class="fa-solid fa-arrow-right ms-2"></i>
                        </button>
                        <button onclick="openShareModal('${exam.id}')" style="width: 44px; flex-shrink: 0; background: #e0e7ff; color: #3730a3; border: none; border-radius: 8px; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.2s;" title="Chia sẻ đề thi">
                            <i class="fa-solid fa-share-nodes"></i>
                        </button>
                    </div>
                `;
            }

            rowHtml += `
                <div class="course-card exam-card-hover h-100 d-flex flex-column" style="min-width: 340px; max-width: 340px; flex-shrink: 0; scroll-snap-align: start; margin-right: 24px; margin-bottom: 10px; border-radius: 12px; border: 1px solid #eef0f2; background: #fff; overflow: hidden; position: relative;">
                    <div class="card-body p-4 d-flex flex-column h-100">
                        ${headerHtml}
                        ${mergedTagsHtml}
                        
                        <div class="card-meta mt-auto" style="border-top: 1px dashed #e9ecef; padding-top: 15px; display: flex; justify-content: space-between; align-items: center; font-size: 0.85rem; color: #6b7280; font-weight: normal; margin-bottom: 20px;">
                            <div class="rating" style="display: flex; align-items: center; gap: 5px;">
                                <span>${exam.rating}</span> <i class="fa-solid fa-star" style="color: #fbbf24;"></i> <span>(${exam.ratingCount})</span>
                            </div>
                            <div class="attempts" style="display: flex; align-items: center; gap: 5px;">
                                <i class="fa-solid fa-users"></i> ${exam.attemptCount} lượt thi
                            </div>
                        </div>
                        
                        <div>${actionAreaHtml}</div>
                    </div>
                </div>
            `;
        });

        rowHtml += `
                    </div>
                    <button class="slider-btn right" onclick="slideRight(this)"><i class="fa-solid fa-chevron-right"></i></button>
                </div>
            </div>
        `;
        examListContainer.insertAdjacentHTML('beforeend', rowHtml);
    });
}

window.slideLeft = function(button) {
    const container = button.parentElement.querySelector('.swimlane-scroll-container');
    if (container) container.scrollBy({ left: -364, behavior: 'smooth' });
};

window.slideRight = function(button) {
    const container = button.parentElement.querySelector('.swimlane-scroll-container');
    if (container) container.scrollBy({ left: 364, behavior: 'smooth' });
};

window.toggleBookmark = async function(event, examId) {
    event.stopPropagation();
    if (!auth.currentUser || !currentUserData) {
        alert("Vui lòng đăng nhập để lưu đề thi!");
        return;
    }

    const btn = event.currentTarget;
    const icon = btn.querySelector('i');
    const isSaved = btn.classList.contains('saved');
    const userDocRef = doc(db, "users", auth.currentUser.uid);

    try {
        if (isSaved) {
            await updateDoc(userDocRef, { bookmarks: arrayRemove(examId) });
            btn.classList.remove('saved');
            icon.classList.remove('fa-solid');
            icon.classList.add('fa-regular');
            currentUserData.bookmarks = currentUserData.bookmarks.filter(id => id !== examId);
        } else {
            await updateDoc(userDocRef, { bookmarks: arrayUnion(examId) });
            btn.classList.add('saved');
            icon.classList.remove('fa-regular');
            icon.classList.add('fa-solid');
            if (!currentUserData.bookmarks) currentUserData.bookmarks = [];
            currentUserData.bookmarks.push(examId);
        }
        
        if (currentTechnique === 'saved') {
            renderExams();
        }
    } catch (error) {
        console.error("Lỗi khi lưu đề thi:", error);
        alert("Đã xảy ra lỗi khi lưu đề thi.");
    }
};

window.goToQuiz = function(examId) { 
    safeRedirect(`quiz.html?examId=${examId}`); 
};

window.goToReview = function(resultId) { 
    safeRedirect(`quiz.html?resultId=${resultId}`); 
};

window.goToUpgrade = function() {
    document.querySelectorAll('.menu-item').forEach(m => m.classList.remove('active'));
    document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
    const tabVip = document.getElementById('tab-vip');
    if(tabVip) tabVip.classList.add('active');
    const title = document.getElementById("currentTabTitle");
    if(title) title.textContent = "Nâng Cấp Tài Khoản Pro";
};
