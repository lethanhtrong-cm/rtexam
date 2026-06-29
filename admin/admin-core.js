// admin-core.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";

// 1. CẤU HÌNH FIREBASE
const firebaseConfig = {
    apiKey: "AIzaSyDqdo_DJIWa5iqxiCgBq-0iGX7f9sr6soo",
    authDomain: "rt-examination.firebaseapp.com",
    databaseURL: "https://rt-examination-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "rt-examination",
    storageBucket: "rt-examination.firebasestorage.app",
    messagingSenderId: "920482699854",
    appId: "1:920482699854:web:44f9b0d735bdc001c6c11f",
    measurementId: "G-8N7RTTREQM"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);

// 2. HÀM HIỂN THỊ THÔNG BÁO (TOAST)
export function showToast(message, type = 'success') {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast show ${type}`;
    toast.innerText = message;
    container.appendChild(toast);

    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// 3. KIỂM TRA QUYỀN ADMIN & ĐĂNG XUẤT
onAuthStateChanged(auth, (user) => {
    if (!user) {
        // Nếu muốn bảo mật nghiêm ngặt, mở khóa dòng dưới để ép văng ra trang Login
        // window.location.href = 'login.html'; 
    }
});

document.getElementById('btnLogout').addEventListener('click', () => {
    signOut(auth).then(() => {
        window.location.href = 'login.html';
    }).catch((error) => {
        showToast("Lỗi đăng xuất: " + error.message, "error");
    });
});

// 4. LOGIC CHUYỂN TAB GIAO DIỆN (SIDEBAR)
document.addEventListener('DOMContentLoaded', () => {
    const menuItems = document.querySelectorAll('.menu-item');
    
    menuItems.forEach(button => {
        button.addEventListener('click', () => {
            // Đổi style menu
            menuItems.forEach(nav => nav.classList.remove('active'));
            button.classList.add('active');

            // Cập nhật tiêu đề
            const title = button.getAttribute('data-title');
            document.getElementById('topbar-title').innerText = title;

            // Ẩn/Hiện Section
            document.querySelectorAll('.content-section').forEach(section => {
                section.classList.remove('active');
            });
            const targetId = button.getAttribute('data-target');
            document.getElementById(targetId).classList.add('active');
        });
    });

    // Đóng Modals chung nếu click ra ngoài
    window.onclick = function(event) {
        const feedbackModal = document.getElementById("feedback-modal");
        const historyModal = document.getElementById("historyModal");
        if (event.target == feedbackModal) feedbackModal.style.display = "none";
        if (event.target == historyModal) historyModal.style.display = "none";
    }
});