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

const mainMenuItems = document.querySelectorAll('.sidebar-menu > .menu-item[data-target]');
const accordionHeaders = document.querySelectorAll('.accordion-header');
const subMenuItems = document.querySelectorAll('.sub-menu-item');
const tabPanes = document.querySelectorAll('.tab-pane');
const currentTabTitle = document.getElementById("currentTabTitle");

const tabTitleMap = {
    'tab-exams': 'Kho Đề Thi',
    'tab-profile': 'Hồ Sơ Cá Nhân',
    'tab-history': 'Lịch Sử Làm Bài',
    'tab-vip': 'Nâng Cấp Tài Khoản Pro'
};

// Hàm điều hướng tab dùng chung toàn bộ hệ thống (Export để file khác có thể gọi)
export function switchTab(targetTabId, titleOverride) {
    if (mainMenuItems) mainMenuItems.forEach(m => m.classList.remove('active'));
    if (accordionHeaders) accordionHeaders.forEach(h => h.classList.remove('active'));
    if (subMenuItems) subMenuItems.forEach(sm => sm.classList.remove('active'));
    if (tabPanes) tabPanes.forEach(pane => pane.classList.remove('active'));

    const targetPane = document.getElementById(targetTabId);
    if (targetPane) {
        targetPane.classList.add('active');
    }
    
    if (currentTabTitle) {
        currentTabTitle.textContent = titleOverride || tabTitleMap[targetTabId] || 'Bảng Điều Khiển';
    }
}

// Đăng ký sự kiện Click cho các Menu độc lập
if (mainMenuItems) {
    mainMenuItems.forEach(item => {
        if (item) {
            item.addEventListener('click', () => {
                const targetId = item.getAttribute('data-target');
                if (targetId) {
                    switchTab(targetId);
                }
                item.classList.add('active');
            });
        }
    });
}

// Đăng ký sự kiện Click cho Accordion Header
if (accordionHeaders) {
    accordionHeaders.forEach(header => {
        if (header) {
            header.addEventListener('click', () => {
                const content = header.nextElementSibling;
                if (!content) return;
                
                const icon = header.querySelector('.accordion-icon');
                
                content.classList.toggle('show');
                if (icon) icon.style.transform = content.classList.contains('show') ? 'rotate(180deg)' : 'rotate(0deg)';

                const targetId = header.getAttribute('data-target');
                if (targetId) {
                    switchTab(targetId, `${tabTitleMap[targetId]} - Tất cả`);
                }
                header.classList.add('active');
                
                const allSubMenu = content.querySelector('.sub-menu-item[data-technique="all"]');
                if (allSubMenu) allSubMenu.classList.add('active');
            });
        }
    });
}

// Đăng ký sự kiện Click cho các Sub-menus (MRI, CT, Đã lưu...)
if (subMenuItems) {
    subMenuItems.forEach(subItem => {
        if (subItem) {
            subItem.addEventListener('click', (e) => {
                e.stopPropagation();
                const parentAccordion = subItem.closest('.menu-accordion');
                
                if (parentAccordion) {
                    const parentHeader = parentAccordion.querySelector('.accordion-header');
                    if (parentHeader) {
                        const targetId = parentHeader.getAttribute('data-target');
                        const techniqueName = subItem.textContent.trim();
                        if (targetId) {
                            switchTab(targetId, `${tabTitleMap[targetId]} - ${techniqueName}`);
                        }
                        parentHeader.classList.add('active');
                    }
                }
                
                subItem.classList.add('active');
            });
        }
    });
}

// Xử lý Logic Dropdown Menu ở Topbar
const userMenuToggle = document.getElementById('userMenuToggle');
const userDropdown = document.getElementById('userDropdown');
const btnManageProfile = document.getElementById('btnManageProfile');

if (userMenuToggle) {
    userMenuToggle.addEventListener('click', (e) => {
        e.stopPropagation();
        if (userDropdown) {
            userDropdown.classList.toggle('show');
        }
    });
}

document.addEventListener('click', (e) => {
    if (userMenuToggle && !userMenuToggle.contains(e.target)) {
        if (userDropdown) {
            userDropdown.classList.remove('show');
        }
    }
});

if (btnManageProfile) {
    btnManageProfile.addEventListener('click', () => {
        switchTab('tab-profile');
    });
}

// =========================================================================
// 4. XỬ LÝ AUTHENTICATION & ĐỒNG BỘ UI TOPBAR
// =========================================================================

const topbarVipContainer = document.getElementById('topbar-vip-container');
if (topbarVipContainer) {
    topbarVipContainer.addEventListener('click', (e) => {
        if (e.target.closest('#btnUpgradeVipTopbar')) {
            switchTab('tab-vip');
        }
    });
}

function renderAuthInfo(user) {
    const email = user.email;
    const name = user.displayName || "Người dùng ẩn danh";
    const fallbackPhotoUrl = user.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=0056b3&color=fff`;

    const elTopbarName = document.getElementById("topbarName");
    if (elTopbarName) elTopbarName.textContent = name;

    const elTopbarAvatar = document.getElementById("topbarAvatar");
    if (elTopbarAvatar) elTopbarAvatar.src = fallbackPhotoUrl;

    const elDisplayEmail = document.getElementById("displayEmail");
    if (elDisplayEmail) elDisplayEmail.textContent = email;

    const elPaymentEmail = document.getElementById("paymentEmail");
    if (elPaymentEmail) elPaymentEmail.textContent = email; 

    const elDisplayName = document.getElementById("displayName");
    if (elDisplayName) elDisplayName.textContent = name;

    const elUserAvatar = document.getElementById("userAvatar");
    if (elUserAvatar) elUserAvatar.src = fallbackPhotoUrl;
    
    const inputName = document.getElementById("inputName");
    if(inputName) inputName.value = user.displayName || "";
}

function setVipInactive() {
    const elVipStatusBadge = document.getElementById("vipStatusBadge");
    if (elVipStatusBadge) {
        elVipStatusBadge.textContent = "Chưa kích hoạt";
        elVipStatusBadge.className = "status-badge status-unactive";
    }

    const elVipStatusTab3 = document.getElementById("vipStatusTab3");
    if (elVipStatusTab3) {
        elVipStatusTab3.textContent = "Chưa kích hoạt Tài khoản Pro";
        elVipStatusTab3.className = "status-badge status-unactive";
    }

    const elVipStartDate = document.getElementById("vipStartDate");
    if (elVipStartDate) elVipStartDate.textContent = "Không xác định";

    const elVipEndDate = document.getElementById("vipEndDate");
    if (elVipEndDate) elVipEndDate.textContent = "Không xác định";
    
    const statAccount = document.getElementById("statAccountStatus");
    if (statAccount) statAccount.textContent = "Thường";

    if (topbarVipContainer) {
        topbarVipContainer.innerHTML = `
            <button id="btnUpgradeVipTopbar" class="topbar-vip-btn">
                🚀 Nâng cấp Pro
            </button>
        `;
    }
}

async function fetchUserData(user) {
    let currentUserData = { isVip: false, isBanned: false, bookmarks: [] };
    try {
        const userDocRef = doc(db, "users", user.uid);
        const userDocSnap = await getDoc(userDocRef);

        if (userDocSnap.exists()) {
            currentUserData = userDocSnap.data();
            
            // Khởi tạo mảng bookmarks mặc định rỗng nếu chưa tồn tại
            if (!currentUserData.bookmarks) {
                currentUserData.bookmarks = [];
            }

            if (currentUserData.isBanned) {
                alert("Tài khoản của bạn đã bị khóa hệ thống. Vui lòng liên hệ quản trị viên.");
                await signOut(auth);
                return null;
            }

            if (currentUserData.avatarBase64) {
                const elUserAvatar = document.getElementById("userAvatar");
                if (elUserAvatar) elUserAvatar.src = currentUserData.avatarBase64;

                const elTopbarAvatar = document.getElementById("topbarAvatar");
                if (elTopbarAvatar) elTopbarAvatar.src = currentUserData.avatarBase64; 
            }

            if (currentUserData.isVip) {
                const elVipStatusBadge = document.getElementById("vipStatusBadge");
                if (elVipStatusBadge) {
                    elVipStatusBadge.textContent = "Đã kích hoạt Pro";
                    elVipStatusBadge.className = "status-badge status-active";
                }

                const elVipStatusTab3 = document.getElementById("vipStatusTab3");
                if (elVipStatusTab3) {
                    elVipStatusTab3.textContent = "Tài khoản PRO đang hoạt động";
                    elVipStatusTab3.className = "status-badge status-active";
                }

                const elVipStartDate = document.getElementById("vipStartDate");
                if (elVipStartDate) elVipStartDate.textContent = currentUserData.vipStart ? formatDate(currentUserData.vipStart) : "Không xác định";

                const elVipEndDate = document.getElementById("vipEndDate");
                if (elVipEndDate) elVipEndDate.textContent = currentUserData.vipEnd ? formatDate(currentUserData.vipEnd) : "Không xác định";

                const statAccount = document.getElementById("statAccountStatus");
                if (statAccount) statAccount.textContent = "PRO";

                if (topbarVipContainer) {
                    topbarVipContainer.innerHTML = `
                        <div class="topbar-vip-badge">
                            <i class="fa-solid fa-gem"></i> TÀI KHOẢN PRO
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
const btnLogout = document.getElementById("btnLogout");
if (btnLogout) {
    btnLogout.addEventListener("click", () => {
        signOut(auth).catch((error) => alert("Đã xảy ra lỗi khi đăng xuất!"));
    });
}

const btnConfirmPayment = document.getElementById("btnConfirmPayment");
if (btnConfirmPayment) {
    btnConfirmPayment.addEventListener("click", () => {
        alert("Hệ thống đã ghi nhận yêu cầu. Chúng tôi sẽ kiểm tra và kích hoạt gói PRO cho bạn trong thời gian sớm nhất!");
    });
}
