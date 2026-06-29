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
// 3. LOGIC UI: SIDEBAR ACCORDION, ĐIỀU HƯỚNG TAB & TOPBAR
// =========================================================================

// Khởi tạo các Node Elements cho Sidebar & Tabs
const mainMenuItems = document.querySelectorAll('.sidebar-menu > .menu-item[data-target]');
const accordionHeaders = document.querySelectorAll('.accordion-header');
const subMenuItems = document.querySelectorAll('.sub-menu-item');
const tabPanes = document.querySelectorAll('.tab-pane');
const currentTabTitle = document.getElementById("currentTabTitle");

const tabTitleMap = {
    'tab-exams': 'Kho Đề Thi',
    'tab-profile': 'Hồ Sơ Cá Nhân',
    'tab-history': 'Lịch Sử Làm Bài',
    'tab-vip': 'Quản Lý Gói VIP'
};

// Hàm Reset toàn bộ state của menu
function resetAllMenuStates() {
    mainMenuItems.forEach(m => m.classList.remove('active'));
    accordionHeaders.forEach(h => h.classList.remove('active'));
    subMenuItems.forEach(sm => sm.classList.remove('active'));
    tabPanes.forEach(pane => pane.classList.remove('active'));
}

// Xử lý Click cho các Menu độc lập (VD: Lịch sử làm bài)
mainMenuItems.forEach(item => {
    item.addEventListener('click', () => {
        resetAllMenuStates();
        item.classList.add('active');
        const targetId = item.getAttribute('data-target');
        document.getElementById(targetId).classList.add('active');
        currentTabTitle.textContent = tabTitleMap[targetId] || 'Bảng Điều Khiển';
    });
});

// Xử lý Click cho Accordion Header (Kho đề thi)
accordionHeaders.forEach(header => {
    header.addEventListener('click', () => {
        // Mở/Đóng Dropdown con
        const content = header.nextElementSibling;
        const icon = header.querySelector('.accordion-icon');
        
        content.classList.toggle('show');
        if (content.classList.contains('show')) {
            icon.style.transform = 'rotate(180deg)';
        } else {
            icon.style.transform = 'rotate(0deg)';
        }

        // Vẫn kích hoạt tab Khám phá khi ấn vào header
        resetAllMenuStates();
        header.classList.add('active');
        
        // Cố gắng giữ lại Active cho sub-menu "Tất cả" nếu chưa có ai được click
        const allSubMenu = content.querySelector('.sub-menu-item[data-technique="all"]');
        if (allSubMenu) allSubMenu.classList.add('active');

        const targetId = header.getAttribute('data-target');
        document.getElementById(targetId).classList.add('active');
        currentTabTitle.textContent = `${tabTitleMap[targetId]} - Tất cả`;
    });
});

// Xử lý Click cho các Sub-menus (MRI, CT, X Quang...)
subMenuItems.forEach(subItem => {
    subItem.addEventListener('click', (e) => {
        e.stopPropagation(); // Ngăn chặn nổi bọt lên Accordion Header
        resetAllMenuStates();
        
        // Kích hoạt Sub-menu
        subItem.classList.add('active');
        
        // Giữ sáng Accordion Header cha
        const parentHeader = subItem.closest('.menu-accordion').querySelector('.accordion-header');
        parentHeader.classList.add('active');
        
        // Mở Tab nội dung tương ứng
        const targetId = parentHeader.getAttribute('data-target');
        document.getElementById(targetId).classList.add('active');

        // Cập nhật Tiêu đề Topbar
        const techniqueName = subItem.textContent.trim();
        currentTabTitle.textContent = `${tabTitleMap[targetId]} - ${techniqueName}`;
    });
});

// Xử lý Logic Dropdown Menu ở Topbar
const userMenuToggle = document.getElementById('userMenuToggle');
const userDropdown = document.getElementById('userDropdown');
const btnManageProfile = document.getElementById('btnManageProfile');

userMenuToggle.addEventListener('click', (e) => {
    e.stopPropagation();
    userDropdown.classList.toggle('show');
});

document.addEventListener('click', (e) => {
    if (!userMenuToggle.contains(e.target)) {
        userDropdown.classList.remove('show');
    }
});

btnManageProfile.addEventListener('click', () => {
    resetAllMenuStates();
    document.getElementById('tab-profile').classList.add('active');
    currentTabTitle.textContent = tabTitleMap['tab-profile'];
});

// =========================================================================
// 4. XỬ LÝ AUTHENTICATION & ĐỒNG BỘ UI
// =========================================================================

const topbarVipContainer = document.getElementById('topbar-vip-container');
if (topbarVipContainer) {
    topbarVipContainer.addEventListener('click', (e) => {
        if (e.target.closest('#btnUpgradeVipTopbar')) {
            resetAllMenuStates();
            document.getElementById('tab-vip').classList.add('active');
            currentTabTitle.textContent = tabTitleMap['tab-vip'];
        }
    });
}

function renderAuthInfo(user) {
    const email = user.email;
    const name = user.displayName || "Người dùng ẩn danh";
    const fallbackPhotoUrl = user.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=0056b3&color=fff`;

    document.getElementById("topbarName").textContent = name;
    document.getElementById("topbarAvatar").src = fallbackPhotoUrl;

    document.getElementById("displayEmail").textContent = email;
    document.getElementById("paymentEmail").textContent = email; 
    document.getElementById("displayName").textContent = name;
    document.getElementById("userAvatar").src = fallbackPhotoUrl;
    
    const inputName = document.getElementById("inputName");
    if(inputName) inputName.value = user.displayName || "";
}

function setVipInactive() {
    document.getElementById("vipStatusBadge").textContent = "Chưa kích hoạt";
    document.getElementById("vipStatusBadge").className = "status-badge status-unactive";
    document.getElementById("vipStatusTab3").textContent = "Chưa kích hoạt VIP";
    document.getElementById("vipStatusTab3").className = "status-badge status-unactive";
    document.getElementById("vipStartDate").textContent = "Không xác định";
    document.getElementById("vipEndDate").textContent = "Không xác định";
    
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
                document.getElementById("userAvatar").src = currentUserData.avatarBase64;
                document.getElementById("topbarAvatar").src = currentUserData.avatarBase64; 
            }

            if (currentUserData.isVip) {
                document.getElementById("vipStatusBadge").textContent = "Đã kích hoạt VIP";
                document.getElementById("vipStatusBadge").className = "status-badge status-active";
                document.getElementById("vipStatusTab3").textContent = "VIP Hoạt động";
                document.getElementById("vipStatusTab3").className = "status-badge status-active";
                document.getElementById("vipStartDate").textContent = currentUserData.vipStart ? formatDate(currentUserData.vipStart) : "Không xác định";
                document.getElementById("vipEndDate").textContent = currentUserData.vipEnd ? formatDate(currentUserData.vipEnd) : "Không xác định";
                document.getElementById("statAccountStatus").textContent = "VIP";

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

onAuthStateChanged(auth, async (user) => {
    if (user) {
        renderAuthInfo(user);
        const currentUserData = await fetchUserData(user);
        
        if (currentUserData) {
            const authReadyEvent = new CustomEvent("authReady", { detail: { user, currentUserData } });
            document.dispatchEvent(authReadyEvent);
        }
    } else {
        safeRedirect('index.html');
    }
});

// =========================================================================
// 5. SỰ KIỆN NÚT CƠ BẢN
// =========================================================================
document.getElementById("btnLogout").addEventListener("click", () => {
    signOut(auth).catch((error) => alert("Đã xảy ra lỗi khi đăng xuất!"));
});

document.getElementById("btnConfirmPayment").addEventListener("click", () => {
    alert("Hệ thống đã ghi nhận yêu cầu. Chúng tôi sẽ kiểm tra và kích hoạt VIP cho bạn trong thời gian sớm nhất!");
});
