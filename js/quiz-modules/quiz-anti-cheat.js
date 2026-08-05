import { showToast } from './quiz-utils.js';

let warningCount = 0;

export function resetAntiCheatWarning() {
    warningCount = 0;
}

export function updateAntiCheatState(state) {
    if (!state.isAntiCheatEnabled) {
        document.body.classList.remove('no-select');
        return;
    }
    
    if (!state.isSubmitted && !state.isShowExplanation && state.currentMode !== 'flashcard') {
        document.body.classList.add('no-select');
    } else {
        document.body.classList.remove('no-select');
    }
}

export function setupAntiCheatEvents(getState, executeSubmitCb) {
    ['contextmenu', 'copy', 'cut', 'paste'].forEach(evt => {
        document.addEventListener(evt, (e) => {
            const state = getState();
            if (!state.isAntiCheatEnabled) return; // Bỏ qua nếu tính năng bị tắt
            
            if (!state.isSubmitted && !state.isShowExplanation && state.currentMode !== 'flashcard') {
                e.preventDefault();
                showToast("⚠️ Hành động này bị vô hiệu hóa trong phòng thi!");
            }
        });
    });

    document.addEventListener('visibilitychange', () => {
        const state = getState();
        if (!state.isAntiCheatEnabled) return; // Bỏ qua nếu tính năng bị tắt
        
        if (document.hidden && !state.isSubmitted && !state.isShowExplanation && state.currentMode !== 'flashcard' && !document.getElementById('reviewExamModal').classList.contains('active')) {
            warningCount++;
            const warningModal = document.getElementById('cheat-warning-modal');
            const warningText = document.getElementById('cheat-warning-text');
            
            if (warningCount >= 3) {
                warningText.innerHTML = `<b>Vi phạm lần ${warningCount}:</b> Bạn vừa rời khỏi phòng thi!<br><br>Bạn đã vi phạm quá 3 lần, hệ thống sẽ tự động thu bài.`;
                document.getElementById('btn-close-warning').innerText = "Đóng & Nộp bài";
                warningModal.classList.add('active');
                document.getElementById('btn-close-warning').onclick = () => { warningModal.classList.remove('active'); };
                executeSubmitCb();
            } else {
                warningText.innerHTML = `<b>Vi phạm lần ${warningCount}:</b> Bạn vừa rời khỏi phòng thi!<br><br>Nếu vi phạm quá 3 lần, hệ thống sẽ tự động thu bài.`;
                document.getElementById('btn-close-warning').innerText = "Tôi đã hiểu";
                warningModal.classList.add('active');
                document.getElementById('btn-close-warning').onclick = () => { warningModal.classList.remove('active'); };
            }
        }
    });
}

export function obfuscateText(text, isSubmitted, isShowExplanation) {
    // TÍNH NĂNG 2 (Làm rối DOM chống AI): Tự động bật cho mọi đề (Gỡ bỏ check isAntiCheatEnabled)
    if (isSubmitted || isShowExplanation || !text) return text;
    
    let result = '';
    const garbageWords = [" [nội dung bị ẩn] ", " [đáp án giả] ", " sai ", " [đánh lừa bot] "];
    
    for (let i = 0; i < text.length; i++) {
        result += text[i];
        
        // Chèn ngẫu nhiên ký tự Zero-width
        if (Math.random() < 0.25) {
            result += '&#8204;';
        }
        
        // Chèn Honeypot vào khoảng trắng
        if (text[i] === ' ' && Math.random() < 0.15) {
            const randomWord = garbageWords[Math.floor(Math.random() * garbageWords.length)];
            result += `<span style="display:inline-block; width:0px; height:0px; overflow:hidden; opacity:0; position:absolute; z-index:-1; user-select:none;">${randomWord}</span>`;
        }
    }
    return result;
}
