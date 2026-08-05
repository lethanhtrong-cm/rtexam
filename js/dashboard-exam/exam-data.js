import { auth, db } from "../dashboard-core.js";
import { collection, getDocs, query, where } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { State } from "./exam-state.js";
import { renderExams } from "./exam-ui.js";

// Tải lịch sử làm bài (Chỉ xóa khi tắt Tab)
export async function fetchUserResultsCache(user) {
    if (!user || !user.email) return;
    try {
        const cacheKey = `completedExams_${user.uid}`;

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
        const metaCacheKey = `examMetaCache_${uid}`; 
        const coreCacheKey = `examCoreCache_${uid}`; 

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
                        examMap[eId].description = conf.description || "";
                        
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

        // 2.5 TÍNH TOÁN DANH HIỆU (BADGES) & AVATAR NGƯỜI THI (Tích hợp xử lý chung để giảm thiểu API call)
        let badgesMap = {};
        let avatarsMap = {};
        const extraCacheKey = `examExtraCache_${uid}`;
        const cachedExtra = sessionStorage.getItem(extraCacheKey);

        if (cachedExtra) {
            const parsed = JSON.parse(cachedExtra);
            badgesMap = parsed.badgesMap || {};
            avatarsMap = parsed.avatarsMap || {};
        } else {
            const resultsSnap = await getDocs(collection(db, "results"));
            const counts = { week: {}, month: {}, year: {} };
            const recentUsersPerExam = {};
            const allUniqueUids = new Set();
            
            const now = Date.now();
            const tWeek = now - (7 * 24 * 60 * 60 * 1000);
            const tMonth = now - (30 * 24 * 60 * 60 * 1000);
            const tYear = now - (365 * 24 * 60 * 60 * 1000);

            resultsSnap.forEach(doc => {
                const data = doc.data();
                const eId = data.examId || data.examCode;
                const userId = data.uid || data.userId;
                
                // Chuẩn hóa timestamp
                let ts = 0;
                if (data.createdAt) {
                    ts = typeof data.createdAt.toMillis === 'function' ? data.createdAt.toMillis() : new Date(data.createdAt).getTime();
                } else if (data.timestamp) {
                    ts = data.timestamp;
                }
                
                if (eId && examMap[eId] && examMap[eId].isValid) {
                    // Đếm lượt thi theo chu kỳ thời gian
                    if (ts) {
                        if (ts >= tWeek) counts.week[eId] = (counts.week[eId] || 0) + 1;
                        if (ts >= tMonth) counts.month[eId] = (counts.month[eId] || 0) + 1;
                        if (ts >= tYear) counts.year[eId] = (counts.year[eId] || 0) + 1;
                    }
                    
                    // Thu thập UID cho Avatar (tối đa 3 người/đề)
                    if (userId) {
                        if (!recentUsersPerExam[eId]) recentUsersPerExam[eId] = new Set();
                        if (recentUsersPerExam[eId].size < 3) {
                            recentUsersPerExam[eId].add(userId);
                            allUniqueUids.add(userId);
                        }
                    }
                }
            });

            // Hàm tìm đề có lượt thi cao nhất
            const getTopExam = (obj) => {
                let max = 0;
                let topId = null;
                for (const id in obj) {
                    if (obj[id] > max) { max = obj[id]; topId = id; }
                }
                return topId;
            };

            const topWeek = getTopExam(counts.week);
            const topMonth = getTopExam(counts.month);
            const topYear = getTopExam(counts.year);

            // Gán danh hiệu (Ưu tiên hiển thị: Năm > Tháng > Tuần)
            if (topYear) badgesMap[topYear] = 'year';
            if (topMonth && !badgesMap[topMonth]) badgesMap[topMonth] = 'month';
            if (topWeek && !badgesMap[topWeek]) badgesMap[topWeek] = 'week';

            // Tạo Avatar giả lập theo tên (có thể thay bằng API query vào bảng users sau này)
            const userAvatars = {};
            if (allUniqueUids.size > 0) {
                Array.from(allUniqueUids).forEach(userId => {
                    userAvatars[userId] = `https://ui-avatars.com/api/?name=${userId.substring(0,2)}&background=e2e8f0&color=64748b`;
                });
            }
            
            Object.keys(recentUsersPerExam).forEach(eId => {
                avatarsMap[eId] = Array.from(recentUsersPerExam[eId]).map(userId => userAvatars[userId]);
            });

            sessionStorage.setItem(extraCacheKey, JSON.stringify({ badgesMap, avatarsMap }));
        }

        // 3. GHÉP NỐI CORE, META VÀ DỮ LIỆU ĐỘNG THÀNH DỮ LIỆU CUỐI CÙNG
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
            
            // Gắn danh hiệu & Avatar vào dữ liệu hiển thị
            examMap[eId].topBadge = badgesMap[eId] || null;
            examMap[eId].recentAvatars = avatarsMap[eId] || [];
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
