import { db } from './admin-core.js';
import { collection, query, where, getDocs, doc, updateDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

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

document.getElementById('btn-save-all').addEventListener('click', async () => {
    const btn = document.getElementById('btn-save-all');
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Đang lưu...';

    const cards = document.querySelectorAll('.question-card');
    const updatePromises = [];

    cards.forEach(card => {
        const docId = card.dataset.docId;
        const text = card.querySelector('.q-text').value.trim();
        const explanation = card.querySelector('.q-explain').value.trim();
        
        const options = [];
        card.querySelectorAll('.opt-text').forEach(input => options.push(input.value.trim()));
        
        let correctAnswer = 0;
        const radios = card.querySelectorAll(`input[name="correct_${docId}"]`);
        radios.forEach(r => { if(r.checked) correctAnswer = parseInt(r.value); });

        const docRef = doc(db, "questions", docId);
        updatePromises.push(updateDoc(docRef, {
            text: text,
            options: options,
            correctAnswer: correctAnswer,
            explanation: explanation
        }));
    });

    try {
        await Promise.all(updatePromises);
        showToast(`Đã lưu thành công ${updatePromises.length} câu hỏi!`);
    } catch (error) {
        console.error("Lỗi lưu:", error);
        showToast("Lỗi khi lưu dữ liệu. Hãy kiểm tra kết nối mạng.", true);
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Lưu Tất Cả Thay Đổi';
    }
});

// Khởi chạy
document.addEventListener('DOMContentLoaded', fetchQuestions);
