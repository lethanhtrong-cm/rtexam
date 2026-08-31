import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { 
    getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword,
    GoogleAuthProvider, signInWithPopup, setPersistence, 
    browserLocalPersistence, browserSessionPersistence, sendPasswordResetEmail
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
// THÊM: Import hàm getDoc để kiểm tra tồn tại
import { getFirestore, doc, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// ==========================================
// PHẦN 1: HỆ THỐNG LOAD MODULE (HTML LOADER)
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    const components = document.querySelectorAll('[data-component]');
    
    components.forEach(async (container) => {
        const filePath = container.getAttribute('data-component');
        
        try {
            const response = await fetch(filePath);
            if (!response.ok) throw new Error(`Lỗi: ${response.status}`);
            
            const html = await response.text();
            container.innerHTML = html;
            
            // Kích hoạt hiệu ứng Fade-in mượt mà
            setTimeout(() => {
                if (container.firstElementChild) {
                    container.firstElementChild.classList.add('fade-in-module');
                } else {
                    container.classList.add('fade-in-module');
                }
            }, 50);

        } catch (error) {
            console.error(`Không thể load module [${filePath}]:`, error);
            container.innerHTML = `
                <div class="p-6 m-4 rounded-xl border border-red-100 bg-red-50 text-red-500 text-sm text-center">
                    <b>Lỗi tải giao diện:</b> Không thể tìm thấy file <i>${filePath}</i>
                </div>
            `;
        }
    });
});

// ==========================================
// PHẦN 2: LOGIC XỬ LÝ FIREBASE & GIAO DIỆN FORM
// ==========================================

// Cấu hình Firebase
const firebaseConfig = {
    apiKey: "AIzaSyDqdo_DJIWa5iqxiCgBq-0iGX7f9sr6soo",
    authDomain: "rt-examination.firebaseapp.com",
    projectId: "rt-examination",
    storageBucket: "rt-examination.firebasestorage.app",
    messagingSenderId: "920482699854",
    appId: "1:920482699854:web:44f9b0d735bdc001c6c11f",
    measurementId: "G-8N7RTTREQM"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Hàm tiện ích UI hiển thị thông báo
function showMsg(elementId, message, type) {
    const el = document.getElementById(elementId);
    if (!el) return;
    el.textContent = message;
    el.className = 'p-3 rounded-lg text-sm text-center mb-4 font-medium block transition-all';
    if (type === 'error') {
        el.classList.add('bg-red-50', 'text-red-600', 'border', 'border-red-100');
    } else {
        el.classList.add('bg-emerald-50', 'text-emerald-600', 'border', 'border-emerald-100');
    }
}

function hideMsg(elementId) {
    const el = document.getElementById(elementId);
    if (el) el.className = 'hidden';
}

function setLoadingBtn(btn, isLoading, text = '') {
    if (!btn) return;
    if (isLoading) {
        if (!btn.dataset.originalHtml) btn.dataset.originalHtml = btn.innerHTML;
        btn.disabled = true;
        btn.classList.add('opacity-70', 'cursor-not-allowed');
        btn.innerHTML = `<svg class="animate-spin h-5 w-5 mr-2 text-current" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> ${text}`;
    } else {
        btn.disabled = false;
        btn.classList.remove('opacity-70', 'cursor-not-allowed');
        if (btn.dataset.originalHtml) btn.innerHTML = btn.dataset.originalHtml;
    }
}

// Bắt sự kiện trên toàn bộ trang (Event Delegation)
document.addEventListener('click', async (e) => {
    
    // 1. Xử lý click từ Navbar để cuộn trang mượt mà và chuyển Tab Form tương ứng
    if (e.target.closest('.nav-auth-trigger')) {
        const triggerBtn = e.target.closest('.nav-auth-trigger');
        const targetTab = triggerBtn.getAttribute('data-tab'); 
        
        const authSection = document.getElementById('hero-auth-section');
        if (authSection) {
            const yOffset = -80; 
            const y = authSection.getBoundingClientRect().top + window.scrollY + yOffset;
            window.scrollTo({ top: y, behavior: 'smooth' });
        }

        if (targetTab === 'register') {
            hideMsg('login-msg');
            const loginForm = document.getElementById('login-form');
            const regForm = document.getElementById('register-form');
            if (loginForm) loginForm.classList.add('hidden');
            if (regForm) regForm.classList.remove('hidden');
        } else {
            hideMsg('register-msg');
            const loginForm = document.getElementById('login-form');
            const regForm = document.getElementById('register-form');
            if (regForm) regForm.classList.add('hidden');
            if (loginForm) loginForm.classList.remove('hidden');
        }
    }

    // 2. Chuyển đổi qua lại giữa Form Đăng nhập và Đăng ký tại chỗ
    if (e.target.id === 'go-to-register') {
        hideMsg('login-msg');
        document.getElementById('login-form').classList.add('hidden');
        document.getElementById('register-form').classList.remove('hidden');
    }
    
    if (e.target.id === 'go-to-login') {
        hideMsg('register-msg');
        document.getElementById('register-form').classList.add('hidden');
        document.getElementById('login-form').classList.remove('hidden');
    }

    // 3. Xử lý Nút Đăng Ký Firebase
    if (e.target.closest('#btn-register')) {
        const btn = e.target.closest('#btn-register');
        hideMsg('register-msg');
        const emailInput = document.getElementById('register-email');
        const passInput = document.getElementById('register-password');
        
        if(!emailInput || !passInput) return;
        const email = emailInput.value;
        const password = passInput.value;

        if(!email || !password) {
            showMsg('register-msg', 'Vui lòng nhập đầy đủ Email và Mật khẩu!', 'error');
            return;
        }

        setLoadingBtn(btn, true, 'Đang đăng ký...');
        createUserWithEmailAndPassword(auth, email, password)
            .then(async (userCredential) => {
                // ĐÃ SỬA: Tính toán ngày hết hạn (5 ngày sau) cho tài khoản mới
                const expireDate = new Date();
                expireDate.setDate(expireDate.getDate() + 5);
                
                // Đăng ký mới chắc chắn chưa có profile nên chỉ cần gọi setDoc với cấu trúc VIP Plus
                await setDoc(doc(db, "users", userCredential.user.uid), { 
                    email: email, 
                    isVip: true,
                    vipTier: 'plus',
                    vipExpiration: expireDate.toISOString()
                });
                showMsg('register-msg', '✅ Đăng ký thành công! Đang vào hệ thống...', 'success');
                window.location.href = 'dashboard.html';
            })
            .catch((error) => {
                setLoadingBtn(btn, false);
                const code = error.code;
                if (code === 'auth/email-already-in-use') showMsg('register-msg', 'Email này đã được đăng ký!', 'error');
                else if (code === 'auth/weak-password') showMsg('register-msg', 'Mật khẩu quá ngắn (ít nhất 6 ký tự)!', 'error');
                else showMsg('register-msg', 'Lỗi hệ thống: ' + error.message, 'error');
            });
    }

    // 4. Xử lý Nút Đăng Nhập Email Firebase
    if (e.target.closest('#btn-login')) {
        const btn = e.target.closest('#btn-login');
        hideMsg('login-msg');
        const emailInput = document.getElementById('login-email');
        const passInput = document.getElementById('login-password');
        
        if(!emailInput || !passInput) return;
        const email = emailInput.value;
        const password = passInput.value;
        
        const rememberCheckbox = document.getElementById('remember-me');
        const isRememberMe = rememberCheckbox ? rememberCheckbox.checked : false;

        if(!email || !password) {
            showMsg('login-msg', 'Vui lòng nhập đầy đủ Email và Mật khẩu!', 'error');
            return;
        }

        setLoadingBtn(btn, true, 'Đang kết nối...');
        const persistenceType = isRememberMe ? browserLocalPersistence : browserSessionPersistence;
        
        setPersistence(auth, persistenceType)
            .then(() => signInWithEmailAndPassword(auth, email, password))
            .then(async (userCredential) => { 
                // Kỹ thuật bảo vệ cấu trúc VIP: Chỉ khởi tạo nếu profile không tồn tại
                const userRef = doc(db, "users", userCredential.user.uid);
                const userSnap = await getDoc(userRef);
                if (!userSnap.exists()) {
                    // Phòng trường hợp tạo user trên console mà chưa có trong firestore
                    const expireDate = new Date();
                    expireDate.setDate(expireDate.getDate() + 5);
                    await setDoc(userRef, { 
                        email: userCredential.user.email, 
                        isVip: true,
                        vipTier: 'plus',
                        vipExpiration: expireDate.toISOString()
                    });
                }
                
                const redirectUrl = localStorage.getItem('redirectAfterLogin');
                if (redirectUrl) {
                    localStorage.removeItem('redirectAfterLogin');
                    window.location.href = redirectUrl;
                } else {
                    window.location.href = 'dashboard.html';
                }
            })
            .catch((error) => {
                setLoadingBtn(btn, false);
                if (error.code.includes('auth/invalid-credential') || error.code.includes('auth/user-not-found')) {
                    showMsg('login-msg', 'Lỗi: Sai email hoặc mật khẩu!', 'error');
                } else {
                    showMsg('login-msg', 'Lỗi đăng nhập: ' + error.message, 'error');
                }
            });
    }

    // 5. Xử lý Đăng Nhập Google
    if (e.target.closest('#btn-google')) {
        const btn = e.target.closest('#btn-google');
        hideMsg('login-msg');
        setLoadingBtn(btn, true, 'Đang kết nối...');
        
        const rememberCheckbox = document.getElementById('remember-me');
        const isRememberMe = rememberCheckbox ? rememberCheckbox.checked : false;
        const persistenceType = isRememberMe ? browserLocalPersistence : browserSessionPersistence;

        setPersistence(auth, persistenceType)
            .then(() => signInWithPopup(auth, new GoogleAuthProvider()))
            .then(async (result) => { 
                // Kỹ thuật bảo vệ cấu trúc VIP: Chỉ khởi tạo nếu profile không tồn tại (Người dùng mới hoàn toàn)
                const userRef = doc(db, "users", result.user.uid);
                const userSnap = await getDoc(userRef);
                if (!userSnap.exists()) {
                    // ĐÃ SỬA: Tính toán ngày hết hạn (5 ngày sau) cho tài khoản mới qua Google
                    const expireDate = new Date();
                    expireDate.setDate(expireDate.getDate() + 5);
                    await setDoc(userRef, { 
                        email: result.user.email, 
                        isVip: true,
                        vipTier: 'plus',
                        vipExpiration: expireDate.toISOString()
                    });
                }

                const redirectUrl = localStorage.getItem('redirectAfterLogin');
                if (redirectUrl) {
                    localStorage.removeItem('redirectAfterLogin');
                    window.location.href = redirectUrl;
                } else {
                    window.location.href = 'dashboard.html';
                }
            })
            .catch((error) => {
                setLoadingBtn(btn, false);
                if (error.code !== 'auth/popup-closed-by-user') showMsg('login-msg', 'Lỗi: ' + error.message, 'error');
            });
    }

    // 6. Xử lý Quên Mật Khẩu
    if (e.target.id === 'btn-forgot-password') {
        hideMsg('login-msg');
        const emailField = document.getElementById('login-email');
        let email = emailField ? emailField.value.trim() : '';
        if (!email) {
            email = prompt("Vui lòng nhập địa chỉ email bạn đã dùng để đăng ký:");
            if (!email) return;
        }
        showMsg('login-msg', 'Đang gửi yêu cầu...', 'success');
        sendPasswordResetEmail(auth, email.trim())
            .then(() => showMsg('login-msg', `✅ Đã gửi link reset đến email: ${email}`, 'success'))
            .catch(err => showMsg('login-msg', 'Lỗi: ' + err.message, 'error'));
    }
});
