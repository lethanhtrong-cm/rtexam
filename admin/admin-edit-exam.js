import { db } from './admin-core.js';
import { collection, query, where, getDocs, doc, updateDoc, addDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

const urlParams = new URLSearchParams(window.location.search);
const currentExamId = urlParams.get('examId');

let loadedQuestions = [];

function showToast(msg, isError = false) {
    const toast = document.getElementById('toast');
    toast.innerText = msg;
    toast.style.background = isError ? '#ef4444' : '#10b981';
    toast.style.display = 'block';
    setTimeout(() => { toast.style.display = 'none'; }, 3000);
}

async function fetchQuestions() {
    if (!currentExamId) {
        document.getElementById('loading-spinner').innerHTML = '❌ Không tìm thấy Mã đề thi trong URL.';
        return;
    }
    document.getElementById('header-exam-id').innerText = currentExamId;

    try {
        const qRef = collection(db, "questions");
        const qSnap = await getDocs(query(qRef, where("examId", "==", currentExamId)));
        
        loadedQuestions = [];
        qSnap.forEach(docSnap => {
            loadedQuestions.push({ id: docSnap.id, ...docSnap.data() });
        });

        if (loadedQuestions.length === 0) {
            document.getElementById('loading-spinner').innerHTML = 'Đề thi này chưa có câu hỏi nào.';
            return;
        }

        renderEditor();
    } catch (error) {
        console.error("Lỗi:", error);
        document.getElementById('loading-spinner').innerHTML = '❌ Lỗi kết nối CSDL.';
    }
}

function renderEditor() {
    const container = document.getElementById('editor-container');
    container.innerHTML = '';

    loadedQuestions.forEach((q, index) => {
        const card = document.createElement('div');
        card.className = 'question-card';
        card.dataset.docId = q.id;

        const options = q.options || ["", "", "", ""];
        const correctAns = q.correctAnswer !== undefined ? q.correctAnswer : 0;

        card.innerHTML = `
            <div class="question-header">
                <h3>Câu hỏi ${index + 1}</h3>
            </div>
            
            <div class="form-group">
                <label>Nội dung câu hỏi:</label>
                <textarea class="q-text" rows="3">${q.text || ""}</textarea>
            </div>

            <div class="options-grid">
                <div class="option-item ${correctAns === 0 ? 'correct' : ''}">
                    <input type="radio" name="correct_${q.id}" value="0" ${correctAns === 0 ? 'checked' : ''}>
                    <strong>A.</strong> <input type="text" class="opt-text" data-index="0" value="${options[0] || ''}">
                </div>
                <div class="option-item ${correctAns === 1 ? 'correct' : ''}">
                    <input type="radio" name="correct_${q.id}" value="1" ${correctAns === 1 ? 'checked' : ''}>
                    <strong>B.</strong> <input type="text" class="opt-text" data-index="1" value="${options[1] || ''}">
                </div>
                <div class="option-item ${correctAns === 2 ? 'correct' : ''}">
                    <input type="radio" name="correct_${q.id}" value="2" ${correctAns === 2 ? 'checked' : ''}>
                    <strong>C.</strong> <input type="text" class="opt-text" data-index="2" value="${options[2] || ''}">
                </div>
                <div class="option-item ${correctAns === 3 ? 'correct' : ''}">
                    <input type="radio" name="correct_${q.id}" value="3" ${correctAns === 3 ? 'checked' : ''}>
                    <strong>D.</strong> <input type="text" class="opt-text" data-index="3" value="${options[3] || ''}">
                </div>
            </div>

            <div class="form-group">
                <label>Giải thích đáp án (Không bắt buộc):</label>
                <textarea class="q-explain" rows="2">${q.explanation || ""}</textarea>
            </div>
        `;
        container.appendChild(card);
    });
}

// XỬ LÝ LƯU VÀ GHI LOG LỊCH SỬ
document.getElementById('btn-save-all').addEventListener('click', async () => {
    const btn = document.getElementById('btn-save-all');
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Đang lưu...';

    const cards = document.querySelectorAll('.question-card');
    const updatePromises = [];
    const changesLog = []; // Lưu trữ những gì đã thay đổi
    const newLoadedState = []; // Lưu trạng thái mới để cập nhật bộ nhớ tạm

    cards.forEach((card, index) => {
        const docId = card.dataset.docId;
        const text = card.querySelector('.q-text').value.trim();
        const explanation = card.querySelector('.q-explain').value.trim();
        
        const options = [];
        card.querySelectorAll('.opt-text').forEach(input => options.push(input.value.trim()));
        
        let correctAnswer = 0;
        const radios = card.querySelectorAll(`input[name="correct_${docId}"]`);
        radios.forEach(r => { if(r.checked) correctAnswer = parseInt(r.value); });

        // SO SÁNH (DIFFING) ĐỂ TẠO LỊCH SỬ
        const oldQ = loadedQuestions.find(q => q.id === docId);
        if (oldQ) {
            let qChanges = [];
            if (oldQ.text !== text) qChanges.push("Nội dung câu hỏi");
            if (oldQ.explanation !== explanation) qChanges.push("Giải thích đáp án");
            
            if (oldQ.correctAnswer !== correctAnswer) {
                const mapAns = ['A', 'B', 'C', 'D'];
                qChanges.push(`Đáp án đúng (Từ ${mapAns[oldQ.correctAnswer]} thành ${mapAns[correctAnswer]})`);
            }
            
            let optChanged = false;
            for(let i = 0; i < 4; i++) {
                if ((oldQ.options?.[i] || "") !== options[i]) optChanged = true;
            }
            if (optChanged) qChanges.push("Chỉnh sửa lựa chọn (A, B, C, D)");

            if (qChanges.length > 0) {
                changesLog.push(`<strong>Câu ${index + 1}:</strong> Sửa ${qChanges.join(", ")}`);
            }
        }

        // Cập nhật lên Firestore
        const docRef = doc(db, "questions", docId);
        updatePromises.push(updateDoc(docRef, {
            text: text,
            options: options,
            correctAnswer: correctAnswer,
            explanation: explanation
        }));

        // Ghi nhận state mới vào bộ nhớ tạm
        newLoadedState.push({ id: docId, text, explanation, options, correctAnswer });
    });

    try {
        await Promise.all(updatePromises);
        
        // GHI LỊCH SỬ NẾU CÓ THAY ĐỔI
        if (changesLog.length > 0) {
            await addDoc(collection(db, "exam_history"), {
                examId: currentExamId,
                timestamp: Date.now(),
                changes: changesLog
            });
        }

        // Cập nhật lại bộ nhớ gốc bằng data mới để lần so sánh sau chính xác
        loadedQuestions = newLoadedState;
        
        showToast(`Đã lưu thành công ${updatePromises.length} câu hỏi!`);
    } catch (error) {
        console.error("Lỗi lưu:", error);
        showToast("Lỗi khi lưu dữ liệu. Hãy kiểm tra kết nối mạng.", true);
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Lưu Tất Cả Thay Đổi';
    }
});

// LOGIC XEM LỊCH SỬ
document.getElementById('btn-view-history').addEventListener('click', async () => {
    const modal = document.getElementById('history-modal');
    const container = document.getElementById('history-list-container');
    modal.style.display = 'block';
    container.innerHTML = '<div style="padding: 30px; text-align: center; color: #64748b;"><i class="fa-solid fa-spinner fa-spin"></i> Đang tải lịch sử...</div>';

    try {
        const historyRef = collection(db, "exam_history");
        const q = query(historyRef, where("examId", "==", currentExamId));
        const snap = await getDocs(q);
        
        let historyData = [];
        snap.forEach(doc => { historyData.push(doc.data()); });

        // Sort tại Client để tránh lỗi missing Index trên Firebase
        historyData.sort((a, b) => b.timestamp - a.timestamp);

        if (historyData.length === 0) {
            container.innerHTML = '<div style="padding: 40px; text-align: center; color: #94a3b8; font-style: italic;">Đề thi này chưa có lịch sử chỉnh sửa nào.</div>';
            return;
        }

        let html = '';
        historyData.forEach((item, index) => {
            const timeStr = new Date(item.timestamp).toLocaleString('vi-VN');
            const changesListHtml = item.changes.map(c => `<li>${c}</li>`).join('');
            
            html += `
                <div class="history-item">
                    <div class="history-time"><i class="fa-regular fa-clock"></i> Lần sửa thứ ${historyData.length - index} - ${timeStr}</div>
                    <div class="history-changes">
                        <ul>${changesListHtml}</ul>
                    </div>
                </div>
            `;
        });
        
        container.innerHTML = html;

    } catch (error) {
        console.error("Lỗi lấy lịch sử:", error);
        container.innerHTML = '<div style="padding: 30px; text-align: center; color: #ef4444;">❌ Lỗi khi tải dữ liệu lịch sử.</div>';
    }
});

document.getElementById('close-history-modal').addEventListener('click', () => {
    document.getElementById('history-modal').style.display = 'none';
});

// Khởi chạy
document.addEventListener('DOMContentLoaded', fetchQuestions);
