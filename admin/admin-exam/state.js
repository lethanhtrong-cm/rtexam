// Kho lưu trữ trạng thái toàn cục (State Management)
export const appState = {
    currentTechnique: "MRI",
    currentLevel: "all",
    currentTime: "all",
    currentSearchQuery: "",
    cachedExams: [],
    draftData: [],
    currentEditingExamId: "",
    rawExams: [],
    rawQuestions: [],
    rawFeedbacks: [],
    loadedStatus: { exams: false, questions: false, feedbacks: false },
    listenersInitialized: false,
    isStatsVisible: false
};
