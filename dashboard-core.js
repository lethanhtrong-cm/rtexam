import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, doc, getDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// =========================================================================
// 1. CẤU HÌNH & KHỞI TẠO FIREBASE
// =========================================================================
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

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

// =========================================================================
// 2. HÀM TIỆN ÍCH
// =========================================================================
export function safeRedirect(path) {
    if (window.location.protocol === 'blob:') {
        console.warn("Đang ở môi trường Preview, giả lập chuyển hướng tới:", path);
        alert(`Chuyển hướng đến: ${path}`);
    } else {
        window.location.href = path;
    }
}

export function formatDate(dateData) {
    if (dateData && typeof dateData.toDate === 'function') {
        return dateData.toDate().toLocaleString('vi-VN');
    }
    return new Date(dateData).toLocaleString('vi-VN');
}

// =========================================================================
// 3. LOGIC UI: ĐIỀU HƯỚNG TAB & ACCORDION SIDEBAR
// =========================================================================
const menuExamsToggle = document.getElementById('menuExamsToggle');
const submenuExams = document.getElementById('submenuExams');
const submenuItems = document.querySelectorAll('.submenu-item');
// Chỉ lấy các menu chuẩn có data-target (vd: Lịch sử)
const standardMenuItems = document.querySelectorAll('.sidebar-menu .menu-item[data-target]');
const tabPanes = document.querySelectorAll('.tab-pane');
const currentTabTitle = document.getElementById("currentTabTitle");

const tabTitleMap = {
    'tab-exams': 'Khám Phá Kho Đề Thi',
    'tab-profile': 'Hồ Sơ Cá Nhân',
    'tab-history': 'Lịch Sử Làm Bài',
    'tab-vip': 'Quản Lý Gói VIP'
};

// Hàm Reset Active toàn bộ menu
function clearAllMenuActives() {
    if(menuExamsToggle) menuExamsToggle.classList.remove('active');
    submenuItems.forEach(m => m.classList.remove('active'));
    standardMenuItems.forEach(m => m.classList.remove('active'));
}

// Xử lý bật/tắt Accordion "Kho Đề Thi"
if (menuExamsToggle && submenuExams) {
    menuExamsToggle.addEventListener('click', () => {
        menuExamsToggle.classList.toggle('expanded');
        submenuExams.classList.toggle('expanded');
    });
}

// Xử lý Click vào Sub-menu (MRI, CT, X quang...)
submenuItems.forEach(item => {
    item.addEventListener('click', (e) => {
        clearAllMenuActives();
        if(menuExamsToggle) menuExamsToggle.classList.add('active'); // Giữ cho thẻ cha sáng lên
        item.classList.add('active'); // Đánh dấu thẻ con

        tabPanes.forEach(pane => pane.classList.remove('active'));
        
        const targetId = item.getAttribute('data-target');
        const targetTab = document.getElementById(targetId);
        if(targetTab) {
            targetTab.classList.add('active');
            currentTabTitle.textContent = tabTitleMap[targetId] || 'Kho Đề Thi';
        }
    });
});

// Xử lý Click vào Standard Menu (Ví dụ: Lịch sử làm bài)
standardMenuItems.forEach(item => {
    item.addEventListener('click', (e) => {
        clearAllMenuActives();
        item.classList.add('active');

        tabPanes.forEach(pane => pane.classList.remove('active'));
        
        const targetId = item.getAttribute('data-target');
        const targetTab = document.getElementById(targetId);
        if(targetTab) {
            targetTab.classList.add('active');
            currentTabTitle.textContent = tabTitleMap[targetId] || 'Bảng Điều Khiển';
        }
    });
});

// Logic Dropdown Menu ở Topbar
const userMenuToggle = document.getElementById('userMenuToggle');
const userDropdown = document.getElementById('userDropdown');
const btnManageProfile = document.getElementById('btnManageProfile');

if (userMenuToggle && userDropdown) {
    userMenuToggle.addEventListener('click', (e) => {
        e.stopPropagation();
        userDropdown.classList.toggle('show');
    });

    document.addEventListener('click', (e) => {
        if (!userMenuToggle.contains(e.target)) {
            userDropdown.classList.remove('show');
        }
    });
}

// Khi bấm "Quản lý Hồ Sơ" trong Dropdown Menu
if (btnManageProfile) {
    btnManageProfile.addEventListener('click', () => {
        clearAllMenuActives();
        tabPanes.forEach(pane => pane.classList.remove('active'));
        
        const profileTab = document.getElementById('tab-profile');
        if(profileTab) {
            profileTab.classList.add('active');
            currentTabTitle.textContent = tabTitleMap['tab-profile'];
        }
    });
}

// =========================================================================
// 4. XỬ LÝ THÔNG TIN AUTHENTICATION & ĐỒNG BỘ UI TOPBAR
// =========================================================================
const topbarVipContainer = document.getElementById('topbar-vip-container');
if (topbarVipContainer) {
    topbarVipContainer.addEventListener('click', (e) => {
        const btn = e.target.closest('#btnUpgradeVipTopbar');
        if (btn) {
            clearAllMenuActives();
            tabPanes.forEach(pane => pane.classList.remove('active'));
            
            const vipTab = document.getElementById('tab-vip');
            if (vipTab) {
                vipTab.classList.add('active');
                currentTabTitle.textContent = tabTitleMap['tab-vip'];
            }
        }
    });
}

function renderAuthInfo(user) {
    const email = user.email;
    const name = user.displayName || "Người dùng ẩn danh";
    const fallbackPhotoUrl = user.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=0056b3&color=fff`;

    const els = {
        topbarName: document.getElementById("topbarName"),
        topbarAvatar: document.getElementById("topbarAvatar"),
        displayEmail: document.getElementById("displayEmail"),
        paymentEmail: document.getElementById("paymentEmail"),
        displayName: document.getElementById("displayName"),
        userAvatar: document.getElementById("userAvatar"),
        inputName: document.getElementById("inputName")
    };

    if(els.topbarName) els.topbarName.textContent = name;
    if(els.topbarAvatar) els.topbarAvatar.src = fallbackPhotoUrl;
    if(els.displayEmail) els.displayEmail.textContent = email;
    if(els.paymentEmail) els.paymentEmail.textContent = email; 
    if(els.displayName) els.displayName.textContent = name;
    if(els.userAvatar) els.userAvatar.src = fallbackPhotoUrl;
    if(els.inputName) els.inputName.value = user.displayName || "";
}

function setVipInactive() {
    const badges = [
        document.getElementById("vipStatusBadge"),
        document.getElementById("vipStatusTab3")
    ];
    
    badges.forEach(b => {
        if(b) {
            b.textContent = "Chưa kích hoạt";
            b.className = "status-badge status-unactive";
        }
    });

    const vipStart = document.getElementById("vipStartDate");
    const vipEnd = document.getElementById("vipEndDate");
    if(vipStart) vipStart.textContent = "Không xác định";
    if(vipEnd) vipEnd.textContent = "Không xác định";
    
    const statAccount = document.getElementById("statAccountStatus");
    if (statAccount) statAccount.textContent = "Thường";

    if (topbarVipContainer) {
        topbarVipContainer.innerHTML = `
            <button id="btnUpgradeVipTopbar" class="topbar-vip-btn">
                🚀 NÂNG CẤP VIP
            </button>
        `;
    }
}

async function fetchUserData(user) {
    let currentUserData = { isVip: false, isBanned: false };
    try {
        const userDocRef = doc(db, "users", user.uid);
        const userDocSnap = await getDoc(userDocRef);

        if (userDocSnap.exists()) {
            currentUserData = userDocSnap.data();

            if (currentUserData.isBanned) {
                alert("Tài khoản của bạn đã bị khóa hệ thống. Vui lòng liên hệ quản trị viên.");
                await signOut(auth);
                return null;
            }

            if (currentUserData.avatarBase64) {
                const ua = document.getElementById("userAvatar");
                const ta = document.getElementById("topbarAvatar");
                if(ua) ua.src = currentUserData.avatarBase64;
                if(ta) ta.src = currentUserData.avatarBase64; 
            }

            if (currentUserData.isVip) {
                const b1 = document.getElementById("vipStatusBadge");
                const b2 = document.getElementById("vipStatusTab3");
                if(b1) { b1.textContent = "Đã kích hoạt VIP"; b1.className = "status-badge status-active"; }
                if(b2) { b2.textContent = "VIP Hoạt động"; b2.className = "status-badge status-active"; }
                
                const vipStart = document.getElementById("vipStartDate");
                const vipEnd = document.getElementById("vipEndDate");
                if(vipStart) vipStart.textContent = currentUserData.vipStart ? formatDate(currentUserData.vipStart) : "Không xác định";
                if(vipEnd) vipEnd.textContent = currentUserData.vipEnd ? formatDate(currentUserData.vipEnd) : "Không xác định";
                
                const statAccount = document.getElementById("statAccountStatus");
                if (statAccount) statAccount.textContent = "VIP";

                if (topbarVipContainer) {
                    topbarVipContainer.innerHTML = `
                        <div class="topbar-vip-badge">
                            <i class="fa-solid fa-crown"></i> TÀI KHOẢN VIP
                        </div>
                    `;
                }
            } else {
                setVipInactive();
            }
        } else {
            setVipInactive(); 
        }
    } catch (error) {
        console.error("Lỗi khi lấy dữ liệu user từ Firestore:", error);
        setVipInactive();
    }
    return currentUserData;
}

// Theo dõi trạng thái đăng nhập hệ thống
onAuthStateChanged(auth, async (user) => {
    if (user) {
        renderAuthInfo(user);
        const currentUserData = await fetchUserData(user);
        
        if (currentUserData) {
            const authReadyEvent = new CustomEvent("authReady", {
                detail: { user, currentUserData }
            });
            document.dispatchEvent(authReadyEvent);
        }
    } else {
        safeRedirect('index.html');
    }
});

// =========================================================================
// 5. CÁC SỰ KIỆN TƯƠNG TÁC CƠ BẢN
// =========================================================================
const btnLogout = document.getElementById("btnLogout");
if (btnLogout) {
    btnLogout.addEventListener("click", () => {
        signOut(auth).catch((error) => {
            console.error("Lỗi đăng xuất:", error);
            alert("Đã xảy ra lỗi khi đăng xuất!");
        });
    });
}

const btnConfirmPayment = document.getElementById("btnConfirmPayment");
if (btnConfirmPayment) {
    btnConfirmPayment.addEventListener("click", () => {
        alert("Hệ thống đã ghi nhận yêu cầu. Chúng tôi sẽ kiểm tra và kích hoạt VIP cho bạn trong thời gian sớm nhất!");
    });
}
