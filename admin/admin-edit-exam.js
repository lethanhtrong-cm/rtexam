import { db } from './admin-core.js';
import { collection, query, where, getDocs, doc, updateDoc, addDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

const urlParams = new URLSearchParams(window.location.search);
const currentExamId = urlParams.get('examId');

let loadedQuestions = [];
let quillInstances = {}; // Lưu trữ instance của Quill Editor
let autoSaveInterval = null;

// Cấu hình thanh công cụ Quill (Hỗ trợ hình ảnh & công thức)
const quillToolbarOptions = [
    ['bold', 'italic', 'underline', 'strike'],
    [{ 'list': 'ordered'}, { 'list': 'bullet' }],
    [{ 'script': 'sub'}, { 'script': 'super' }],
    ['image', 'formula'],
    ['clean']
];

function showToast(msg, isError = false) {
    const toast = document.getElementById('toast');
    toast.innerHTML = isError ? `<i class="fa-solid fa-triangle-exclamation"></i> ${msg}` : `<i class="fa-solid fa-check-circle"></i> ${msg}`;
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

        // Hỗ trợ Order (Sắp xếp)
        loadedQuestions.sort((a, b) => (a.order || 0) - (b.order || 0));

        if (loadedQuestions.length === 0) {
            document.getElementById('loading-spinner').innerHTML = 'Đề thi này chưa có câu hỏi nào.';
            return;
        }

        // Kiểm tra Draft trong LocalStorage
        checkAndLoadDraft();

    } catch (error) {
        console.error("Lỗi:", error);
        document.getElementById('loading-spinner').innerHTML = '❌ Lỗi kết nối Cơ sở dữ liệu.';
    }
}

function checkAndLoadDraft() {
    const draftStr = localStorage.getItem(`draft_${currentExamId}`);
    if (draftStr) {
        try {
            const draftObj = JSON.parse(draftStr);
            // Nếu draft tồn tại, hỏi Admin có muốn khôi phục không
            if (confirm(`Phát hiện bản nháp chưa lưu lúc ${new Date(draftObj.time).toLocaleTimeString('vi-VN')}. Bạn có muốn khôi phục tiếp tục chỉnh sửa không?`)) {
                loadedQuestions = draftObj.data;
                showToast("Đã khôi phục dữ liệu từ bản nháp nội bộ.");
            } else {
                localStorage.removeItem(`draft_${currentExamId}`);
            }
        } catch (e) {
            console.error("Lỗi parse Draft", e);
        }
    }
    
    renderEditor();
    initAutoSave();
}

function renderEditor() {
    const container = document.getElementById('editor-container');
    container.innerHTML = '';
    quillInstances = {};

    loadedQuestions.forEach((q, index) => {
        const card = document.createElement('div');
        card.className = 'question-card';
        card.dataset.docId = q.id;

        const options = q.options || ["", "", "", ""];
        const correctAns = q.correctAnswer !== undefined ? q.correctAnswer : 0;

        card.innerHTML = `
            <div class="question-header">
                <h3><i class="fa-solid fa-grip-vertical drag-handle" title="Kéo để di chuyển"></i> Câu hỏi ${index + 1}</h3>
            </div>
            
            <div class="form-group">
                <label>Nội dung câu hỏi (Hỗ trợ chèn ảnh, công thức):</label>
                <div id="q-text-${q.id}">${q.text || ""}</div>
            </div>

            <div class="options-grid">
                <div class="option-item ${correctAns === 0 ? 'correct' : ''}">
                    <input type="radio" name="correct_${q.id}" value="0" ${correctAns === 0 ? 'checked' : ''} onclick="updateOptionHighlight(this)">
                    <strong>A.</strong> <input type="text" class="opt-text" data-index="0" value="${options[0] || ''}">
                </div>
                <div class="option-item ${correctAns === 1 ? 'correct' : ''}">
                    <input type="radio" name="correct_${q.id}" value="1" ${correctAns === 1 ? 'checked' : ''} onclick="updateOptionHighlight(this)">
                    <strong>B.</strong> <input type="text" class="opt-text" data-index="1" value="${options[1] || ''}">
                </div>
                <div class="option-item ${correctAns === 2 ? 'correct' : ''}">
                    <input type="radio" name="correct_${q.id}" value="2" ${correctAns === 2 ? 'checked' : ''} onclick="updateOptionHighlight(this)">
                    <strong>C.</strong> <input type="text" class="opt-text" data-index="2" value="${options[2] || ''}">
                </div>
                <div class="option-item ${correctAns === 3 ? 'correct' : ''}">
                    <input type="radio" name="correct_${q.id}" value="3" ${correctAns === 3 ? 'checked' : ''} onclick="updateOptionHighlight(this)">
                    <strong>D.</strong> <input type="text" class="opt-text" data-index="3" value="${options[3] || ''}">
                </div>
            </div>

            <div class="form-group">
                <label>Giải thích đáp án (Tùy chọn):</label>
                <div id="q-explain-${q.id}">${q.explanation || ""}</div>
            </div>
        `;
        container.appendChild(card);

        // Khởi tạo Quill Editor cho Text và Explanation
        const quillText = new Quill(`#q-text-${q.id}`, { theme: 'snow', modules: { toolbar: quillToolbarOptions } });
        const quillExplain = new Quill(`#q-explain-${q.id}`, { theme: 'snow', modules: { toolbar: quillToolbarOptions } });
        
        quillInstances[q.id] = { text: quillText, explain: quillExplain };
    });

    // Kích hoạt tính năng Kéo Thả (Sortable.js)
    Sortable.create(container, {
        handle: '.drag-handle',
        animation: 150,
        ghostClass: 'sortable-ghost',
        dragClass: 'sortable-drag',
        onEnd: function () {
            // Cập nhật lại số thứ tự câu hỏi hiển thị
            const cards = document.querySelectorAll('.question-card');
            cards.forEach((card, idx) => {
                const header = card.querySelector('h3');
                header.innerHTML = `<i class="fa-solid fa-grip-vertical drag-handle" title="Kéo để di chuyển"></i> Câu hỏi ${idx + 1}`;
            });
            showToast("Đã thay đổi vị trí câu hỏi. Đang tự động lưu nháp...", false);
            triggerAutoSave();
        }
    });
}

// Cập nhật CSS xanh viền (Highlight) khi click chọn đáp án đúng
window.updateOptionHighlight = function(radioElem) {
    const parentGrid = radioElem.closest('.options-grid');
    parentGrid.querySelectorAll('.option-item').forEach(item => item.classList.remove('correct'));
    radioElem.closest('.option-item').classList.add('correct');
};

// =================== AUTO SAVE LOGIC ===================
function getCurrentEditorState() {
    const currentState = [];
    document.querySelectorAll('.question-card').forEach((card, index) => {
        const docId = card.dataset.docId;
        const text = quillInstances[docId].text.root.innerHTML;
        const explanation = quillInstances[docId].explain.root.innerHTML;
        
        const options = [];
        card.querySelectorAll('.opt-text').forEach(input => options.push(input.value.trim()));
        
        let correctAnswer = 0;
        card.querySelectorAll(`input[name="correct_${docId}"]`).forEach(r => { if(r.checked) correctAnswer = parseInt(r.value); });

        // Bảo lưu các ID và thêm thuộc tính Order
        currentState.push({ id: docId, examId: currentExamId, text, explanation, options, correctAnswer, order: index });
    });
    return currentState;
}

function triggerAutoSave() {
    const state = getCurrentEditorState();
    localStorage.setItem(`draft_${currentExamId}`, JSON.stringify({ time: Date.now(), data: state }));
    const draftUI = document.getElementById('draft-status');
    draftUI.innerHTML = `<i class="fa-solid fa-cloud-arrow-up"></i> Đã lưu nháp: ${new Date().toLocaleTimeString('vi-VN')}`;
    draftUI.style.display = 'block';
}

function initAutoSave() {
    if (autoSaveInterval) clearInterval(autoSaveInterval);
    autoSaveInterval = setInterval(triggerAutoSave, 30000); // 30s lưu 1 lần
}

// =================== XỬ LÝ LƯU GỐC & DIFFING ===================
document.getElementById('btn-save-all').addEventListener('click', async () => {
    const btn = document.getElementById('btn-save-all');
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Đang tải lên...';

    const newState = getCurrentEditorState();
    const updatePromises = [];
    const changesLog = []; 
    const mapAns = ['A', 'B', 'C', 'D'];

    newState.forEach((newQ) => {
        const oldQ = loadedQuestions.find(q => q.id === newQ.id);
        if (oldQ) {
            let diffs = [];
            // Bắt DIFF Text
            if (oldQ.text !== newQ.text) {
                diffs.push({ field: "Nội dung câu hỏi", old: oldQ.text, new: newQ.text });
            }
            if (oldQ.explanation !== newQ.explanation) {
                diffs.push({ field: "Giải thích đáp án", old: oldQ.explanation, new: newQ.explanation });
            }
            if (oldQ.correctAnswer !== newQ.correctAnswer) {
                diffs.push({ field: "Đáp án đúng", old: `Đáp án ${mapAns[oldQ.correctAnswer || 0]}`, new: `Đáp án ${mapAns[newQ.correctAnswer]}` });
            }
            let optChanged = false;
            let oldOptStr = (oldQ.options || []).join(' | ');
            let newOptStr = newQ.options.join(' | ');
            if (oldOptStr !== newOptStr) {
                diffs.push({ field: "Thay đổi lựa chọn (A,B,C,D)", old: oldOptStr, new: newOptStr });
            }
            if ((oldQ.order || 0) !== newQ.order) {
                diffs.push({ field: "Vị trí câu hỏi", old: `Vị trí thứ ${(oldQ.order || 0) + 1}`, new: `Vị trí thứ ${newQ.order + 1}` });
            }

            if (diffs.length > 0) {
                changesLog.push({ questionIndex: newQ.order + 1, diffs: diffs });
            }
        }

        const docRef = doc(db, "questions", newQ.id);
        updatePromises.push(updateDoc(docRef, {
            text: newQ.text,
            options: newQ.options,
            correctAnswer: newQ.correctAnswer,
            explanation: newQ.explanation,
            order: newQ.order
        }));
    });

    try {
        await Promise.all(updatePromises);
        
        // NẾU CÓ THAY ĐỔI, GHI LẠI TOÀN BỘ SNAPSHOT VÀ LỊCH SỬ DIFF
        if (changesLog.length > 0) {
            await addDoc(collection(db, "exam_history"), {
                examId: currentExamId,
                timestamp: Date.now(),
                changes: changesLog,
                snapshot: loadedQuestions // Chìa khóa để tính năng Rollback hoạt động
            });
        }

        // Cập nhật lại state tĩnh và Xóa Draft
        loadedQuestions = newState;
        localStorage.removeItem(`draft_${currentExamId}`);
        document.getElementById('draft-status').style.display = 'none';
        
        showToast(`Tuyệt vời! Đã phát hành bản cập nhật cho ${updatePromises.length} câu hỏi.`);
    } catch (error) {
        console.error("Lỗi lưu:", error);
        showToast("Lỗi khi lưu dữ liệu. Hãy kiểm tra kết nối mạng.", true);
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Phát Hành Lên Hệ Thống';
    }
});

// =================== LOGIC XEM LỊCH SỬ DIFF & KHÔI PHỤC ===================
document.getElementById('btn-view-history').addEventListener('click', async () => {
    const modal = document.getElementById('history-modal');
    const container = document.getElementById('history-list-container');
    modal.style.display = 'block';
    container.innerHTML = '<div class="loading-screen"><i class="fa-solid fa-circle-notch fa-spin"></i> Đang tải và phân tích dữ liệu lịch sử...</div>';

    try {
        const historyRef = collection(db, "exam_history");
        const q = query(historyRef, where("examId", "==", currentExamId));
        const snap = await getDocs(q);
        
        let historyData = [];
        snap.forEach(doc => { historyData.push({ docId: doc.id, ...doc.data() }); });

        historyData.sort((a, b) => b.timestamp - a.timestamp);

        if (historyData.length === 0) {
            container.innerHTML = '<div style="padding: 50px; text-align: center; color: #94a3b8; font-style: italic;"><i class="fa-solid fa-clock-rotate-left fa-3x" style="opacity:0.2; margin-bottom:15px;"></i><br>Chưa có ghi nhận chỉnh sửa nào đối với đề thi này.</div>';
            return;
        }

        let html = '';
        historyData.forEach((item) => {
            const timeStr = new Date(item.timestamp).toLocaleString('vi-VN');
            
            // Xây dựng giao diện Diff Before/After CÓ TÍNH TƯƠNG THÍCH NGƯỢC
            let diffHtml = '';
            (item.changes || []).forEach(changeObj => {
                if (typeof changeObj === 'string') {
                    // Cấu trúc dữ liệu cũ (chỉ lưu text)
                    diffHtml += `<div class="diff-block" style="padding: 10px 15px; font-size: 13.5px; color: #475569; background: white;">${changeObj}</div>`;
                } else if (changeObj && changeObj.diffs) {
                    // Cấu trúc dữ liệu mới (Diff chuyên sâu)
                    diffHtml += `<div class="diff-block">
                                    <div class="diff-title">Câu ${changeObj.questionIndex}: Đã thay đổi</div>`;
                    changeObj.diffs.forEach(diff => {
                        diffHtml += `<div style="padding: 5px 15px; font-size: 13px; color: #64748b; border-bottom: 1px dashed #e2e8f0;">Trường: <strong>${diff.field}</strong></div>
                                     <div class="diff-content">
                                         <div class="diff-old">${diff.old}</div>
                                         <div class="diff-new">${diff.new}</div>
                                     </div>`;
                    });
                    diffHtml += `</div>`;
                }
            });
            
            // Chỉ hiển thị nút Rollback nếu bản ghi có chứa thuộc tính snapshot (dữ liệu mới)
            const rollbackBtnHtml = item.snapshot ? `
                <button class="btn-rollback" data-hid="${item.docId}">
                    <i class="fa-solid fa-rotate-left"></i> Khôi phục phiên bản này
                </button>
            ` : `<span style="font-size:12px; color:#94a3b8; font-style:italic;">(Bản lưu cũ không hỗ trợ khôi phục)</span>`;

            html += `
                <div class="history-item">
                    <div class="history-header">
                        <div class="history-time"><i class="fa-solid fa-code-commit" style="color: #3b82f6;"></i> Bản sửa đổi ngày: ${timeStr}</div>
                        ${rollbackBtnHtml}
                    </div>
                    <div class="diff-container">
                        ${diffHtml}
                    </div>
                </div>
            `;
        });
        
        container.innerHTML = html;

        // Bắt sự kiện Rollback
        document.querySelectorAll('.btn-rollback').forEach(btn => {
            btn.addEventListener('click', async function() {
                const hid = this.getAttribute('data-hid');
                const targetHistory = historyData.find(h => h.docId === hid);
                
                if (!confirm(`CẢNH BÁO: Hành động này sẽ GHI ĐÈ dữ liệu hiện tại bằng phiên bản lúc [${new Date(targetHistory.timestamp).toLocaleString('vi-VN')}].\n\nBạn có chắc chắn muốn KHÔI PHỤC không?`)) return;

                const origText = this.innerHTML;
                this.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Đang khôi phục...';
                this.disabled = true;

                try {
                    const rollbackPromises = [];
                    // Trích xuất mảng snapshot từ bản ghi lịch sử
                    const snapshotData = targetHistory.snapshot;
                    
                    snapshotData.forEach(sq => {
                        const docRef = doc(db, "questions", sq.id);
                        rollbackPromises.push(updateDoc(docRef, {
                            text: sq.text,
                            options: sq.options,
                            correctAnswer: sq.correctAnswer,
                            explanation: sq.explanation,
                            order: sq.order || 0
                        }));
                    });

                    await Promise.all(rollbackPromises);
                    showToast("Khôi phục dữ liệu thành công! Đang tải lại trang...");
                    setTimeout(() => location.reload(), 1500); // F5 lại để editor ăn data mới
                } catch (err) {
                    console.error("Lỗi rollback:", err);
                    showToast("Lỗi khôi phục dữ liệu. Vui lòng thử lại.", true);
                    this.innerHTML = origText;
                    this.disabled = false;
                }
            });
        });

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
