import { auth, db } from "../dashboard-core.js";
import { collection, getDocs, query, where } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { State } from "./exam-state.js";
import { renderExams } from "./exam-ui.js";

// Tải lịch sử làm bài (Chỉ xóa khi tắt Tab)
export async function fetchUserResultsCache(user) {
    if (!user || !user.email) return;
    try {
        const cacheKey = `completedExams_${user.uid}`;
        const cachedData = sessionStorage.getItem(cacheKey);
        
        if (cachedData) {
            State.completedExams = JSON.parse(cachedData);
            return; // Tiết kiệm lượt đọc
        }

        const resultsRef = collection(db, "results");
        const q = query(resultsRef, where("email", "==", user.email));
        const snap = await getDocs(q);
        
        snap.forEach(doc => {
            const data = doc.data();
            const examId = data.examId || data.examCode;
            if (examId) {
                const ts = data.createdAt ? (typeof data.createdAt.toMillis === 'function' ? data.createdAt.toMillis() : new Date(data.createdAt).getTime()) : data.timestamp || 0;
                if (!State.completedExams[examId] || ts >= (State.completedExams[examId].timestamp || 0)) {
                    State.completedExams[examId] = {
                        score: data.score || 0,
                        total: data.totalQuestions || data.total || 1,
                        timestamp: ts,
                        resultId: doc.id
                    };
                }
            }
        });
        
        sessionStorage.setItem(cacheKey, JSON.stringify(State.completedExams));
    } catch (err) {
        console.error("Lỗi tải kết quả thi:", err);
    }
}

// Tải tổng hợp dữ liệu Đề (Tách riêng Logic Cache)
export async function loadAggregatedExamData() {
    try {
        const uid = auth.currentUser ? auth.currentUser.uid : 'guest';
        const metaCacheKey = `examMetaCache_${uid}`; // Chứa Rating/Feedback (Xóa khi tắt Tab)
        const coreCacheKey = `examCoreCache_${uid}`; // Chứa Đề/Câu hỏi (Xóa khi F5)

        // 1. XỬ LÝ META (RATING & FEEDBACKS)
        let ratingMap = {};
        const cachedMeta = sessionStorage.getItem(metaCacheKey);
        if (cachedMeta) {
            ratingMap = JSON.parse(cachedMeta);
        } else {
            const fSnap = await getDocs(collection(db, "feedbacks"));
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
            sessionStorage.setItem(metaCacheKey, JSON.stringify(ratingMap));
        }

        // 2. XỬ LÝ CORE (SỐ LƯỢNG CÂU HỎI & CẤU HÌNH ĐỀ THI)
        let examMap = {};
        const cachedCore = sessionStorage.getItem(coreCacheKey);
        if (cachedCore) {
            examMap = JSON.parse(cachedCore);
        } else {
            const qSnap = await getDocs(collection(db, "questions"));
            qSnap.forEach((doc) => {
                const eId = doc.data().examId;
                if (eId) {
                    if (!examMap[eId]) examMap[eId] = { id: eId, questionCount: 0 };
                    examMap[eId].questionCount++;
                }
            });

            const eSnap = await getDocs(collection(db, "exams"));
            eSnap.forEach((doc) => {
                const eId = doc.id;
                const conf = doc.data();
                const isPublicExam = conf.isPublic === true || (conf.isPublic === undefined && conf.creatorId === undefined);
                const isMyExam = auth.currentUser && conf.creatorId === auth.currentUser.uid;

                if (isPublicExam || isMyExam) {
                    if (examMap[eId]) {
                        examMap[eId].isValid = true; 
                        examMap[eId].examName = conf.examName || ""; 
                        examMap[eId].isVip = conf.isVip || false;
                        examMap[eId].timeLimit = conf.timeLimit ? parseInt(conf.timeLimit) : 15;
                        examMap[eId].attemptCount = conf.attemptCount || 0;
                        examMap[eId].technique = conf.technique || "Hỗn hợp";
                        examMap[eId].level = conf.level || "Trung bình";
                        
                        let parsedTime = 0;
                        const rawTime = conf.createdAt || conf.timestamp; 
                        if (rawTime) {
                            if (typeof rawTime.toMillis === 'function') parsedTime = rawTime.toMillis();
                            else if (rawTime.seconds !== undefined) parsedTime = rawTime.seconds * 1000;
                            else parsedTime = new Date(rawTime).getTime();
                        }
                        examMap[eId].createdAt = isNaN(parsedTime) ? 0 : parsedTime;
                    }
                }
            });
            sessionStorage.setItem(coreCacheKey, JSON.stringify(examMap));
        }

        // 3. GHÉP NỐI CORE VÀ META THÀNH DỮ LIỆU CUỐI CÙNG
        Object.keys(examMap).forEach(eId => {
            if (!examMap[eId].isValid) { delete examMap[eId]; return; }
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

        State.allExamsData = Object.values(examMap);

        const hiddenExamsList = (State.currentUserData && State.currentUserData.hiddenExams) ? State.currentUserData.hiddenExams : [];
        const aiExams = State.allExamsData.filter(e => e.technique === "AI Tự Động" && !hiddenExamsList.includes(e.id)).sort((a, b) => b.createdAt - a.createdAt).slice(0, 10);
        const otherExams = State.allExamsData.filter(e => e.technique !== "AI Tự Động" && !hiddenExamsList.includes(e.id));
        
        State.allExamsData = [...otherExams, ...aiExams];

        document.dispatchEvent(new CustomEvent("examsReady", { detail: { allExamsData: State.allExamsData } }));
        renderExams();

    } catch (error) {
        console.error("Lỗi khi tổng hợp dữ liệu đề thi:", error);
    }
}
