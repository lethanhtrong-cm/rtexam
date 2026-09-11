import { auth, db } from "../dashboard-core.js";
import { doc, updateDoc, increment, getDoc, collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// ==========================================
// TÍNH NĂNG MỚI: AI TỔNG HỢP KIẾN THỨC ĐỀ THI
// ==========================================
window.generateExamSummary = async function(examId) {
    if (!auth.currentUser) {
        alert("Vui lòng đăng nhập để sử dụng tính năng này!");
        return;
    }

    const uid = auth.currentUser.uid;
    const todayStr = new Date().toLocaleDateString('en-CA');
    let currentSummaryCount = 0;
    let maxLimit = 1;
    let isUserPro = false;

    // 1. Kiểm tra giới hạn (Tách biệt bộ đếm với AI Chat)
    try {
        const userSnap = await getDoc(doc(db, "users", uid));
        if (userSnap.exists()) {
            const userData = userSnap.data();
            let globalAiTier = userData.vipTier || 'free';
            isUserPro = (globalAiTier === 'pro');
            
            if (globalAiTier === 'plus') maxLimit = 5;
            if (globalAiTier === 'pro') maxLimit = Infinity;

            if (!isUserPro) {
                const lastDate = userData.aiSummaryLastUsedDate || '';
                currentSummaryCount = (lastDate === todayStr) ? (userData.aiSummaryDailyCount || 0) : 0;
                if (currentSummaryCount >= maxLimit) {
                    alert(`Bạn đã hết lượt Tóm tắt kiến thức trong ngày (${maxLimit}/${maxLimit}). Nâng cấp PRO để sử dụng không giới hạn!`);
                    return;
                }
            }
        }
    } catch (e) {
        console.error("Lỗi kiểm tra quyền:", e);
        alert("Lỗi xác thực dữ liệu người dùng. Vui lòng thử lại.");
        return;
    }

    // 2. Hiển thị UI Loading
    let modal = document.getElementById('aiSummaryModal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'aiSummaryModal';
        modal.style.cssText = "position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(15, 23, 42, 0.75); backdrop-filter: blur(4px); z-index: 100000; display: flex; align-items: center; justify-content: center; padding: 15px;";
        modal.innerHTML = `
            <div style="background: #fff; width: 100%; max-width: 700px; height: 85vh; border-radius: 16px; display: flex; flex-direction: column; overflow: hidden; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.1); animation: scaleIn 0.2s ease-out;">
                <style>@keyframes scaleIn { from { transform: scale(0.95); opacity: 0; } to { transform: scale(1); opacity: 1; } }</style>
                <div style="padding: 18px 24px; background: linear-gradient(135deg, #a855f7 0%, #7c3aed 100%); color: white; display: flex; justify-content: space-between; align-items: center; flex-shrink: 0;">
                    <h3 style="margin: 0; font-size: 1.2rem; font-weight: 700;"><i class="fa-solid fa-bolt" style="color: #fde047;"></i> Tóm tắt kiến thức cốt lõi</h3>
                    <button onclick="document.getElementById('aiSummaryModal').remove()" style="background: transparent; border: none; color: white; font-size: 1.4rem; cursor: pointer; transition: 0.2s;" onmouseover="this.style.color='#cbd5e1'" onmouseout="this.style.color='white'"><i class="fa-solid fa-xmark"></i></button>
                </div>
                <div id="aiSummaryContent" style="padding: 24px; overflow-y: auto; flex: 1; font-size: 1rem; line-height: 1.7; color: #334155; background: #f8fafc;">
                    <div style="text-align: center; padding: 50px 0;">
                        <i class="fa-solid fa-wand-magic-sparkles fa-spin fa-2x" style="color: #7c3aed; margin-bottom: 15px;"></i>
                        <p style="margin: 0; color: #475569; font-weight: 600; font-size: 1.05rem;">AI đang đọc đề và tổng hợp kiến thức...</p>
                        <p style="margin: 5px 0 0 0; color: #94a3b8; font-size: 0.9rem;">Quá trình này có thể mất vài giây tùy thuộc vào độ dài của đề thi.</p>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    }

    const contentBox = document.getElementById('aiSummaryContent');

    // 3. Lấy dữ liệu câu hỏi từ đề
    try {
        const examSnap = await getDoc(doc(db, "exams", examId));
        if (!examSnap.exists()) throw new Error("Không tìm thấy dữ liệu đề thi!");
        
        const examData = examSnap.data();
        let questionsText = "";
        
        // ĐÃ SỬA: Lấy đúng trường "text" và bổ sung thêm Đáp án đúng để AI học chuẩn xác
        if (examData.questions && Array.isArray(examData.questions)) {
            questionsText = examData.questions.map((q, i) => {
                const text = q.text || q.questionText || q.content || q.question || '';
                const correctOpt = (q.options && q.correctAnswer !== undefined) ? q.options[q.correctAnswer] : 'Không rõ';
                return `${i+1}. Hỏi: ${text} | Đáp án đúng: ${correctOpt}`;
            }).join('\n');
        } else {
            const qRef = collection(db, "questions");
            const qQuery = query(qRef, where("examId", "==", examId));
            const qSnap = await getDocs(qQuery);
            let idx = 1;
            qSnap.forEach(document => {
                const q = document.data();
                const text = q.text || q.questionText || q.content || q.question || '';
                const correctOpt = (q.options && q.correctAnswer !== undefined) ? q.options[q.correctAnswer] : 'Không rõ';
                questionsText += `${idx++}. Hỏi: ${text} | Đáp án đúng: ${correctOpt}\n`;
            });
        }

        if (!questionsText.trim()) throw new Error("Đề thi này trống hoặc không có nội dung văn bản để tổng hợp.");
        
        // Cắt chuỗi để chống lỗi quá tải Token API
        questionsText = questionsText.substring(0, 15000); 

        // 4. Gửi Request API
        const prompt = `Đóng vai trò là một giảng viên y khoa giàu kinh nghiệm. Hãy đọc nội dung các câu hỏi và đáp án đúng của đề thi "${examData.examName || examId}" dưới đây và TỔNG HỢP KIẾN THỨC CỐT LÕI nhất.\n\nYêu cầu:\n- Trình bày dạng các gạch đầu dòng (bullet points) dễ học, dễ nhớ.\n- Không chép lại nguyên văn câu hỏi, hãy rút ra bản chất kiến thức/lý thuyết y khoa từ các câu hỏi và đáp án đó.\n- Trình bày khoa học, hệ thống.\n\nNội dung đề:\n${questionsText}`;

        const response = await fetch('/api/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                history: [{ role: "user", parts: [{ text: prompt }] }]
            })
        });

        const usedTokens = parseInt(response.headers.get('X-Token-Usage')) || 0;

        if (!response.ok) {
            const errData = await response.text();
            if (response.status === 429 || errData.includes('RESOURCE_EXHAUSTED')) throw new Error("Hệ thống AI đang quá tải lượt dùng. Vui lòng thử lại sau ít phút!");
            throw new Error("Lỗi kết nối máy chủ AI.");
        }

        const data = await response.json();
        const resultText = data.response || "Lỗi: Không có dữ liệu trả về.";

        // 5. Render kết quả (Format Markdown cơ bản)
        let formattedText = resultText
            .replace(/\*\*(.*?)\*\*/g, '<strong style="color:#0f172a;">$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>')
            .replace(/\n/g, '<br>')
            .replace(/- /g, '<span style="color:#7c3aed; font-weight:bold; margin-right:5px;">•</span>');

        contentBox.innerHTML = `
            <div style="background: #ffffff; padding: 25px; border-radius: 12px; border: 1px solid #e2e8f0; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); text-align: justify;">
                ${formattedText}
            </div>
            <div style="margin-top: 15px; text-align: right; font-size: 0.85rem; color: #64748b; font-weight: 600;">
                ${isUserPro ? '<i class="fa-solid fa-infinity" style="color: #8b5cf6;"></i> Gói Pro: Không giới hạn' : `Lượt dùng trong ngày: ${currentSummaryCount + 1} / ${maxLimit}`}
            </div>
        `;

        // 6. Cập nhật lượt dùng lên Firestore
        if (usedTokens > 0) {
            try {
                let updateData = { totalTokensUsed: increment(usedTokens) };
                if (!isUserPro) {
                    updateData.aiSummaryDailyCount = currentSummaryCount + 1;
                    updateData.aiSummaryLastUsedDate = todayStr;
                }
                await updateDoc(doc(db, "users", uid), updateData);
            } catch (dbErr) {
                console.warn("Chưa cập nhật được giới hạn sử dụng:", dbErr);
            }
        }

    } catch (error) {
        contentBox.innerHTML = `
            <div style="text-align: center; padding: 40px 20px;">
                <i class="fa-solid fa-triangle-exclamation fa-3x" style="color: #ef4444; margin-bottom: 15px;"></i>
                <h4 style="margin: 0 0 10px 0; color: #b91c1c;">Lỗi xử lý</h4>
                <p style="margin: 0; color: #475569;">${error.message}</p>
            </div>
        `;
    }
};

window.goToFlashcard = window.generateExamSummary;
