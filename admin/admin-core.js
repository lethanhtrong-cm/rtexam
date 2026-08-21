import { db, auth } from './firebase-config.js'; 
import { onAuthStateChanged, signOut, signInWithPopup, GoogleAuthProvider } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { collection, query, orderBy, onSnapshot, doc, updateDoc, deleteDoc, getDoc, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

export { db };

// Email Quản trị viên duy nhất được phép truy cập
const ADMIN_EMAIL = "thanhtrong.yds@gmail.com";
const provider = new GoogleAuthProvider();

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

// THEO DÕI & BẢO VỆ XÁC THỰC ADMIN
onAuthStateChanged(auth, async (user) => {
    const body = document.body;
    const loginOverlay = document.getElementById('admin-login-overlay');
    
    if (user && user.email === ADMIN_EMAIL) {
        // Đúng tài khoản Admin: Mở khóa giao diện
        body.classList.remove('admin-locked');
        if (loginOverlay) loginOverlay.style.opacity = '0';
        setTimeout(() => { if (loginOverlay) loginOverlay.style.display = 'none'; }, 500);
        
        // Hiển thị email Admin góc phải
        const adminEmailDisplay = document.getElementById('display-admin-email');
        if (adminEmailDisplay) adminEmailDisplay.innerHTML = `<i class="fa-solid fa-user-shield"></i> ${user.email}`;
    } else {
        // Chưa đăng nhập hoặc Sai tài khoản: Ép đăng xuất và Khóa giao diện
        if (user) await signOut(auth); // Đăng xuất người dùng trái phép
        body.classList.add('admin-locked');
        if (loginOverlay) {
            loginOverlay.style.display = 'flex';
            // Trigger reflow
            void loginOverlay.offsetWidth;
            loginOverlay.style.opacity = '1';
        }
    }
});

// XỬ LÝ NÚT ĐĂNG NHẬP GOOGLE TRÊN MÀN HÌNH KHÓA
document.addEventListener('DOMContentLoaded', () => {
    const btnLogin = document.getElementById('btn-admin-login');
    if (btnLogin) {
        btnLogin.addEventListener('click', async () => {
            const errorMsg = document.getElementById('login-error-message');
            errorMsg.style.display = 'none';
            btnLogin.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Đang xác thực...';
            btnLogin.disabled = true;

            try {
                const result = await signInWithPopup(auth, provider);
                if (result.user.email !== ADMIN_EMAIL) {
                    await signOut(auth);
                    throw new Error(`Tài khoản "${result.user.email}" không được cấp quyền Admin.`);
                }
            } catch (error) {
                console.error("Lỗi đăng nhập:", error);
                errorMsg.innerText = error.message;
                errorMsg.style.display = 'block';
            } finally {
                btnLogin.innerHTML = '<img src="https://upload.wikimedia.org/wikipedia/commons/c/c1/Google_%22G%22_logo.svg" alt="Google"> Xác thực với Google';
                btnLogin.disabled = false;
            }
        });
    }
});

// VÁ LỖI: Thêm khối kiểm tra phần tử (container) tồn tại trước khi gán innerHTML
async function loadComponent(elementId, filePath) {
    try {
        const response = await fetch(filePath);
        if (!response.ok) throw new Error(`Lỗi HTTP status: ${response.status}`);
        const html = await response.text();
        const container = document.getElementById(elementId);
        if (container) {
            container.innerHTML = html;
        }
    } catch (error) {
        console.error(`Không thể tải component ${filePath}:`, error);
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    // VÁ LỖI: Chỉ tải nội dung file html vào khi thẻ container đang rỗng
    const sidebar = document.getElementById('sidebar-container');
    if (sidebar && sidebar.innerHTML.trim() === '') {
        await loadComponent('sidebar-container', './components/sidebar.html');
    }

    const modals = document.getElementById('modals-container');
    if (modals && modals.innerHTML.trim() === '') {
        await loadComponent('modals-container', './components/modal.html');
    }

    initSidebarEvents();
    initModalEvents();
    initAuthEvents();

    document.dispatchEvent(new Event('componentsLoaded'));
});

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
                // F5 lại trang để kích hoạt màn hình khóa
                window.location.reload(); 
            }).catch((error) => {
                showToast("Lỗi khi đăng xuất: " + error.message, "error");
            });
        });
    }
}
