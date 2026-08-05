function getDraftKey(examId, uid) { 
    return `quiz_draft_${examId}_${uid}`; 
}

export function saveDraftToLocal(state) {
    if (state.isSubmitted || !state.currentUser || !state.currentExamId || state.currentMode === 'flashcard') return;
    const draft = { 
        userAnswers: state.userAnswers, 
        flaggedQuestions: state.flaggedQuestions, 
        timeRemaining: state.timeRemaining, 
        currentIndex: state.currentIndex 
    };
    localStorage.setItem(getDraftKey(state.currentExamId, state.currentUser.uid), JSON.stringify(draft));
}

export function loadDraftFromLocal(currentUser, currentExamId, currentMode) {
    if (!currentUser || !currentExamId || currentMode === 'flashcard') return null;
    const draftStr = localStorage.getItem(getDraftKey(currentExamId, currentUser.uid));
    if (draftStr) {
        try {
            return JSON.parse(draftStr);
        } catch(e) {
            console.error("Lỗi đọc file nháp:", e);
        }
    }
    return null;
}

export function clearDraftFromLocal(currentUser, currentExamId) { 
    if (currentUser && currentExamId) {
        localStorage.removeItem(getDraftKey(currentExamId, currentUser.uid));
    }
}
