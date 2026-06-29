// admin-core.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";

// CẤU HÌNH CLOUD FIREBASE
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

// HÀM TOAST THÔNG BÁO CHUNG HỆ THỐNG
export function showToast(message, type = 'success') {
    const container = document.getElementById('toastContainer');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = `toast show ${type}`;
    toast.innerText = message;
    container.appendChild(toast);

    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// THEO DÕI XÁC THỰC
onAuthStateChanged(auth, (user) => {
    if (!user) {
        // window.location.href = 'login.html'; 
    }
});

const btnLogout = document.getElementById('btnLogout');
if (btnLogout) {
    btnLogout.addEventListener('click', () => {
        signOut(auth).then(() => {
            window.location.href = 'login.html';
        }).catch((error) => {
            showToast("Lỗi khi đăng xuất: " + error.message, "error");
        });
    });
}

// LOGIC SIDEBAR ACCORDION & ĐIỀU HƯỚNG TAB
document.addEventListener('DOMContentLoaded', () => {
    
    // 1. Nhấp chọn menu mẹ để Toggle khối accordion con
    const parentMenus = document.querySelectorAll('.menu-parent');
    parentMenus.forEach(parent => {
        parent.addEventListener('click', (e) => {
            e.preventDefault();
            const submenu = parent.nextElementSibling;
            if (submenu && submenu.classList.contains('submenu')) {
                parent.classList.toggle('open');
                submenu.classList.toggle('show');
            }
        });
    });

    // 2. Nhấp chọn menu con để chuyển đổi Tab và kích hoạt lọc theo Chuyên khoa
    const menuItems = document.querySelectorAll('.menu-item');
    menuItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            
            // Đổi active trực quan menu
            menuItems.forEach(nav => nav.classList.remove('active'));
            item.classList.add('active');

            // Đổi tiêu đề Topbar động
            const title = item.getAttribute('data-title');
            const topbarTitle = document.getElementById('topbar-title');
            if (topbarTitle) topbarTitle.innerText = title;

            // Ẩn toàn bộ tab cũ
            document.querySelectorAll('.content-section').forEach(section => {
                section.classList.remove('active');
            });
            
            // Kích hoạt hiển thị tab đích
            const targetId = item.getAttribute('data-target');
            const targetSection = document.getElementById(targetId);
            if (targetSection) targetSection.classList.add('active');
        });
    });

    // Nhấp ra vùng ngoài modal để ẩn giao diện
    window.onclick = function(event) {
        const editPropsModal = document.getElementById("edit-properties-modal");
        const feedbackModal = document.getElementById("feedback-modal");
        const historyModal = document.getElementById("historyModal");
        if (event.target === editPropsModal) editPropsModal.style.display = "none";
        if (event.target === feedbackModal) feedbackModal.style.display = "none";
        if (event.target === historyModal) historyModal.style.display = "none";
    };
});
