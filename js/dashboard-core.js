// =========================================================================
// IMPORT TỪ MODULE FIREBASE & GIAO DIỆN CHUYÊN BIỆT
// =========================================================================
import { app, auth, db } from "./dashboard/firebase-core.js";
import { safeRedirect, formatDate, switchTab, showNotificationModal, renderAuthInfo, setVipInactive } from "./dashboard/dashboard-ui.js";

import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { doc, updateDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// IMPORT CÁC MODULE ĐÃ ĐƯỢC CHIA NHỎ
import { initStatistics } from "./js/dashboard-core/stats.js";
import { initRoomModals } from "./js/dashboard-core/rooms.js";
import { initRandomExam } from "./js/dashboard-core/random-exam.js";
import { initDOMListeners } from "./js/dashboard-core/dom-listeners.js";
import { executeAuthUI, initNotificationListener } from "./js/dashboard-core/user-services.js";

// RE-EXPORT ĐỂ BẢO TOÀN KIẾN TRÚC CHO CÁC FILE KHÁC (exam-data.js, exam-modals.js...)
export { app, auth, db, safeRedirect, formatDate, switchTab, initNotificationListener };

let isComponentsLoaded = false;
let currentUserInstance = null; 

document.addEventListener('ComponentsLoaded', () => {
    isComponentsLoaded = true;

    // Khởi tạo các module không phụ thuộc vào User
    initStatistics(db);
    initDOMListeners(auth, db);
    
    if (currentUserInstance) {
        executeAuthUI(currentUserInstance, auth, db);
    }

    // Khởi tạo các module Modal
    initRoomModals(auth, db);
    initRandomExam(auth, db);
});

onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentUserInstance = user; 
        
        let currentOnlineStatus = null;
        const updateOnlineStatus = (status) => {
            if (currentOnlineStatus === status) return;
            currentOnlineStatus = status;
            updateDoc(doc(db, "users", user.uid), { isOnline: status }).catch(() => {});
        };

        updateOnlineStatus(true);
        
        window.addEventListener('beforeunload', () => updateOnlineStatus(false));
        document.addEventListener('freeze', () => updateOnlineStatus(false));
        window.addEventListener('offline', () => updateOnlineStatus(false));
        window.addEventListener('online', () => updateOnlineStatus(true));

        if (isComponentsLoaded) {
            executeAuthUI(user, auth, db);
        }
    } else {
        safeRedirect('index.html');
    }
});
