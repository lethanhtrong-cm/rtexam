import { auth, db } from "../dashboard-core.js";
import { collection, getDocs, query, where, orderBy, limit } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { State } from "./exam-state.js";
import { renderExams } from "./exam-ui.js";

// Tải lịch sử làm bài (Chỉ xóa khi tắt Tab)
export async function fetchUserResultsCache(user) {
    if (!user || !user.email) return;
    try {
        const cacheKey = `completedExams_${user.uid}`;

        const resultsRef = collection(db, "results");
        const eSnap = await getDocs(query(collection(db, "exams"), limit(1500)));
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

        // =====================================================================
        // KIỂM TRA HÀNH ĐỘNG F5 RELOAD
        // Chỉ xóa Cache để ép tải lại dữ liệu mới từ Firestore khi người dùng F5.
        // Khi chuyển tab, logic này bị bỏ qua, hệ thống sẽ dùng Cache để tiết kiệm Đọc/Ghi.
        // =====================================================================
        const navEntries = performance.getEntriesByType("navigation");
        if (navEntries.length > 0 && navEntries[0].type === "reload") {
            sessionStorage.removeItem(metaCacheKey);
            sessionStorage.removeItem(coreCacheKey);
            sessionStorage.removeItem(`examExtraCache_${uid}`);
        }

        // 1. XỬ LÝ META (RATING & FEEDBACKS)
        let ratingMap = {};
        const cachedMeta = sessionStorage.getItem(metaCacheKey);
        if (cachedMeta) {
            ratingMap = JSON.parse(cachedMeta);
        } else {
            const fSnap = await getDocs(query(collection(db, "feedbacks"), limit(2500)));
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

        // 2. XỬ LÝ CORE (CẤU HÌNH ĐỀ THI - ĐÃ TỐI ƯU LOẠI BỎ LOAD TOÀN BỘ CÂU HỎI)
        let examMap = {};
        const cachedCore = sessionStorage.getItem(coreCacheKey);
        if (cachedCore) {
            examMap = JSON.parse(cachedCore);
        } else {
            const eSnap = await getDocs(collection(db, "exams"));
            eSnap.forEach((doc) => {
                const eId = doc.id;
                const conf = doc.data();
                const isPublicExam = conf.isPublic === true || (conf.isPublic === undefined && conf.creatorId === undefined);
                const isMyExam = auth.currentUser && conf.creatorId === auth.currentUser.uid;

                if (isPublicExam || isMyExam) {
                    examMap[eId] = {
                        id: eId,
                        isValid: true,
                        examName: conf.examName || "",
                        isVip: conf.isVip || false,
                        timeLimit: conf.timeLimit ? parseInt(conf.timeLimit) : 15,
                        // Tối ưu Đọc: Lấy số lượng câu hỏi từ config, dự phòng bằng timeLimit thay vì đếm thủ công
                        questionCount: conf.questionCount || conf.totalQuestions || (conf.timeLimit ? parseInt(conf.timeLimit) : 0),
                        attemptCount: conf.attemptCount || 0,
                        technique: conf.technique || "Hỗn hợp",
                        level: conf.level || "Trung bình",
                        description: conf.description || ""
                    };
                    
                    let parsedTime = 0;
                    const rawTime = conf.createdAt || conf.timestamp; 
                    if (rawTime) {
                        if (typeof rawTime.toMillis === 'function') parsedTime = rawTime.toMillis();
                        else if (rawTime.seconds !== undefined) parsedTime = rawTime.seconds * 1000;
                        else parsedTime = new Date(rawTime).getTime();
                    }
                    examMap[eId].createdAt = isNaN(parsedTime) ? 0 : parsedTime;
                }
            });
            sessionStorage.setItem(coreCacheKey, JSON.stringify(examMap));
        }

        // 2.5 TÍNH TOÁN DANH HIỆU (BADGES) & AVATAR NGƯỜI THI
        let badgesMap = {};
        let avatarsMap = {};
        const extraCacheKey = `examExtraCache_${uid}`;
        const cachedExtra = sessionStorage.getItem(extraCacheKey);

        if (cachedExtra) {
            const parsed = JSON.parse(cachedExtra);
            badgesMap = parsed.badgesMap || {};
            avatarsMap = parsed.avatarsMap || {};
        } else {
            // =================================================================
            // TỐI ƯU READ LỚN NHẤT: GIỚI HẠN TẢI KẾT QUẢ ĐỂ BẢO VỆ QUOTA FIRESTORE
            // Chỉ lấy 1000 lượt thi mới nhất thay vì toàn bộ lịch sử hệ thống
            // =================================================================
            const resultsQuery = query(collection(db, "results"), limit(2500));
            const resultsSnap = await getDocs(resultsQuery);
            
            const counts = { week: {}, month: {}, year: {} };
            const dynamicAttemptCounts = {}; 
            
            const usersExamsMap = {}; 
            const allUniqueUids = new Set();
            
            const now = Date.now();
            const tWeek = now - (7 * 24 * 60 * 60 * 1000);
            const tMonth = now - (30 * 24 * 60 * 60 * 1000);
            const tYear = now - (365 * 24 * 60 * 60 * 1000);

            resultsSnap.forEach(doc => {
                const data = doc.data();
                const eId = data.examId || data.examCode;
                const userId = data.uid || data.userId || data.email; 
                
                let ts = 0;
                if (data.createdAt) {
                    ts = typeof data.createdAt.toMillis === 'function' ? data.createdAt.toMillis() : new Date(data.createdAt).getTime();
                } else if (data.timestamp) {
                    ts = data.timestamp;
                }
                
                if (eId && examMap[eId] && examMap[eId].isValid) {
                    if (ts) {
                        if (ts >= tWeek) counts.week[eId] = (counts.week[eId] || 0) + 1;
                        if (ts >= tMonth) counts.month[eId] = (counts.month[eId] || 0) + 1;
                        if (ts >= tYear) counts.year[eId] = (counts.year[eId] || 0) + 1;
                    }
                    
                    if (userId) {
                        const totalQ = data.totalQuestions || 1;
                        const answeredQ = data.savedAnswers ? Object.keys(data.savedAnswers).length : 0;
                        
                        // Chỉ lấy Avatar người thi nếu đã làm (trả lời) từ 75% số câu hỏi trở lên
                        if ((answeredQ / totalQ) >= 0.75) {
                            dynamicAttemptCounts[eId] = (dynamicAttemptCounts[eId] || 0) + 1; 

                            if (!usersExamsMap[eId]) usersExamsMap[eId] = {};
                            if (!usersExamsMap[eId][userId] || ts > usersExamsMap[eId][userId].ts) {
                                usersExamsMap[eId][userId] = { ts: ts, email: data.email || data.userEmail || userId };
                            }
                            allUniqueUids.add(userId);
                        }
                    }
                }
            });

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

            if (topYear) badgesMap[topYear] = 'year';
            if (topMonth && !badgesMap[topMonth]) badgesMap[topMonth] = 'month';
            if (topWeek && !badgesMap[topWeek]) badgesMap[topWeek] = 'week';

            const userAvatars = {};
            const userNames = {}; 

            if (allUniqueUids.size > 0) {
                try {
                    // Thay thế dòng: const usersSnap = await getDocs(collection(db, "users"));
// Bằng dòng code dưới đây:

const usersSnap = await getDocs(query(collection(db, "users"), limit(200)));
                    usersSnap.forEach(uDoc => {
                        const uData = uDoc.data();
                        const id = uDoc.id;
                        const mail = uData.email;
                        
                        const photo = uData.photoURL || uData.avatar;
                        const name = String(uData.displayName || mail || id);
                        const defaultAva = `https://ui-avatars.com/api/?name=${name.substring(0,2)}&background=e2e8f0&color=64748b`;
                        
                        if (allUniqueUids.has(id)) { userAvatars[id] = photo || defaultAva; userNames[id] = name; }
                        if (mail && allUniqueUids.has(mail)) { userAvatars[mail] = photo || defaultAva; userNames[mail] = name; }
                    });
                } catch (e) {
                    console.log("Không thể kéo dữ liệu Avatar từ users", e);
                }
            }

            Array.from(allUniqueUids).forEach(userId => {
                if (!userAvatars[userId]) {
                    const prefix = String(userId).substring(0, 2);
                    userAvatars[userId] = `https://ui-avatars.com/api/?name=${prefix}&background=e2e8f0&color=64748b`;
                    userNames[userId] = userId; 
                }
            });

            Object.keys(usersExamsMap).forEach(eId => {
                const sortedUsers = Object.entries(usersExamsMap[eId])
                    .map(([uid, info]) => ({ uid, ...info }))
                    .sort((a, b) => b.ts - a.ts)
                    .slice(0, 5); 
                
                avatarsMap[eId] = sortedUsers.map(u => ({
                    url: userAvatars[u.uid],
                    name: userNames[u.uid] || u.uid
                }));
            });

            sessionStorage.setItem(extraCacheKey, JSON.stringify({ badgesMap, avatarsMap, dynamicAttemptCounts }));
        }

        const dynamicAttemptCounts = cachedExtra ? (JSON.parse(cachedExtra).dynamicAttemptCounts || {}) : {};

        // 3. GHÉP NỐI CORE, META VÀ DỮ LIỆU ĐỘNG THÀNH DỮ LIỆU CUỐI CÙNG
        Object.keys(examMap).forEach(eId => {
            if (!examMap[eId].isValid) { delete examMap[eId]; return; }
            if (examMap[eId].timeLimit === undefined) examMap[eId].timeLimit = 15;
            if (examMap[eId].isVip === undefined) examMap[eId].isVip = false;
            
            examMap[eId].attemptCount = dynamicAttemptCounts[eId] || examMap[eId].attemptCount || 0;

            if (ratingMap[eId]) {
                const avg = ratingMap[eId].total / ratingMap[eId].count;
                examMap[eId].rating = Math.round(avg * 10) / 10; 
                examMap[eId].ratingCount = ratingMap[eId].count;
            } else {
                examMap[eId].rating = 5.0; 
                examMap[eId].ratingCount = 0;
            }
            
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
