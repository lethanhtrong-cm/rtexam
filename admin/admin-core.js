import { db, auth } from './firebase-config.js'; 
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
// IMPORT ĐẦY ĐỦ CÁC HÀM CẦN THIẾT TỪ FIRESTORE
import { collection, query, orderBy, onSnapshot, doc, updateDoc, deleteDoc, getDoc, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

export { db };

// =========================================================================
// HÀM TOAST THÔNG BÁO CHUNG HỆ THỐNG
// =========================================================================
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

// HÀM TẢI COMPONENT HTML ĐỘNG
async function loadComponent(elementId, filePath) {
    try {
        const response = await fetch(filePath);
        if (!response.ok) throw new Error(`Lỗi HTTP status: ${response.status}`);
        const html = await response.text();
        document.getElementById(elementId).innerHTML = html;
    } catch (error) {
        console.error(`Không thể tải component ${filePath}:`, error);
    }
}

// KHỞI TẠO HỆ THỐNG GIAO DIỆN
document.addEventListener('DOMContentLoaded', async () => {
    await loadComponent('sidebar-container', './components/sidebar.html');
    await loadComponent('modals-container', './components/modal.html');

    initSidebarEvents();
    initModalEvents();
    initAuthEvents();

    document.dispatchEvent(new Event('componentsLoaded'));
});

// =========================================================================
// CÁC HÀM XỬ LÝ SỰ KIỆN GIAO DIỆN CƠ BẢN
// =========================================================================
function initSidebarEvents() {
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

    const menuItems = document.querySelectorAll('.menu-item');
    menuItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            
            menuItems.forEach(nav => nav.classList.remove('active'));
            item.classList.add('active');

            const title = item.getAttribute('data-title');
            const topbarTitle = document.getElementById('topbar-title');
            if (topbarTitle) topbarTitle.innerText = title;

            document.querySelectorAll('.content-section').forEach(section => {
                section.classList.remove('active');
            });
            
            const targetId = item.getAttribute('data-target');
            const targetSection = document.getElementById(targetId);
            if (targetSection) targetSection.classList.add('active');
        });
    });
}

function initModalEvents() {
    window.onclick = function(event) {
        const editPropsModal = document.getElementById("edit-properties-modal");
        const feedbackModal = document.getElementById("feedback-modal");
        const historyModal = document.getElementById("historyModal");
        const questionDetailModal = document.getElementById("question-detail-modal");
        const adminReplyModal = document.getElementById("admin-reply-modal");

        if (event.target === editPropsModal) editPropsModal.style.display = "none";
        if (event.target === feedbackModal) feedbackModal.style.display = "none";
        if (event.target === historyModal) historyModal.style.display = "none";
        if (event.target === questionDetailModal) questionDetailModal.style.display = "none";
        if (event.target === adminReplyModal) adminReplyModal.style.display = "none";
    };

    // Lắng nghe đóng Modal bằng nút X
    document.addEventListener('click', (e) => {
        if (e.target && e.target.id === 'close-qd-modal') {
            const m = document.getElementById("question-detail-modal");
            if (m) m.style.display = "none";
        }
        if (e.target && e.target.id === 'close-admin-reply-modal') {
            const r = document.getElementById("admin-reply-modal");
            if (r) r.style.display = "none";
        }
    });
}

function initAuthEvents() {
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
}
