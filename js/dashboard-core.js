import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, serverTimestamp, onSnapshot, collection, query, where, updateDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

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
// 3. LOGIC UI: XỬ LÝ CHUYỂN TAB ĐỘNG
// =========================================================================
const tabTitleMap = {
    'tab-exams': 'Kho Đề Thi',
    'tab-profile': 'Hồ Sơ Cá Nhân',
    'tab-history': 'Lịch Sử Làm Bài',
    'tab-vip': 'Nâng Cấp Tài Khoản Pro',
    'leaderboard': 'Bảng Xếp Hạng'
};

export function switchTab(targetTabId, titleOverride) {
    const mainMenuItems = document.querySelectorAll('.sidebar-menu > .menu-item[data-target]');
    const accordionHeaders = document.querySelectorAll('.accordion-header');
    const subMenuItems = document.querySelectorAll('.sub-menu-item');
    const tabPanes = document.querySelectorAll('.tab-pane');
    const currentTabTitle = document.getElementById("currentTabTitle");

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

// =========================================================================
// 4. QUẢN LÝ VÒNG ĐỜI & GẮN SỰ KIỆN KHI DOM SẴN SÀNG
// =========================================================================
let isComponentsLoaded = false;
let currentUserInstance = null; 

document.addEventListener('ComponentsLoaded', () => {
    isComponentsLoaded = true;
    initDOMListeners();
    
    if (currentUserInstance) {
        executeAuthUI(currentUserInstance);
    }

    const oldBtnCreateRoom = document.getElementById('topbarNavCreateRoom'); 
    
    if (oldBtnCreateRoom) {
        const btnCreateRoom = oldBtnCreateRoom.cloneNode(true);
        oldBtnCreateRoom.parentNode.replaceChild(btnCreateRoom, oldBtnCreateRoom);

        btnCreateRoom.addEventListener('click', async (e) => {
            e.preventDefault(); 
            e.stopPropagation(); 
            e.stopImmediatePropagation(); 

            if (!auth.currentUser) {
                alert("Vui lòng đăng nhập để tạo phòng thi.");
                return;
            }

            const originalText = btnCreateRoom.innerHTML;
            btnCreateRoom.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Đang xử lý...';
            btnCreateRoom.style.pointerEvents = 'none'; 

            const roomId = Math.random().toString(36).substring(2, 8).toUpperCase();
            const targetUrl = `lobby.html?roomId=${roomId}`;

            const newTab = window.open('about:blank', '_blank');

            try {
                const roomRef = doc(db, 'rooms', roomId);
                await setDoc(roomRef, {
                    hostEmail: auth.currentUser.email,
                    hostUid: auth.currentUser.uid,
                    status: 'waiting',
                    isLocked: false,
                    examId: null,   
                    examName: null,
                    createdAt: serverTimestamp()
                });

                if (newTab) {
                    newTab.location.href = targetUrl;
                }
                
                btnCreateRoom.innerHTML = originalText;
                btnCreateRoom.style.pointerEvents = 'auto';
                
            } catch (error) {
                console.error("Lỗi Firestore:", error);
                if (newTab) newTab.close();
                alert("Không thể tạo phòng! Vui lòng kiểm tra lại quyền ghi Database hoặc mạng.");
                btnCreateRoom.innerHTML = originalText;
                btnCreateRoom.style.pointerEvents = 'auto';
            }
        });
    }
});

function initDOMListeners() {
    const mainMenuItems = document.querySelectorAll('.sidebar-menu > .menu-item[data-target]');
    const accordionHeaders = document.querySelectorAll('.accordion-header');
    const subMenuItems = document.querySelectorAll('.sub-menu-item');
    
    if (mainMenuItems) {
        mainMenuItems.forEach(item => {
            item.addEventListener('click', () => {
                const targetId = item.getAttribute('data-target');
                if (targetId) switchTab(targetId);
                item.classList.add('active');
            });
        });
    }

    if (accordionHeaders) {
        accordionHeaders.forEach(header => {
            header.addEventListener('click', () => {
                const content = header.nextElementSibling;
                if (!content) return;
                
                const icon = header.querySelector('.accordion-icon');
                content.classList.toggle('show');
                if (icon) icon.style.transform = content.classList.contains('show') ? 'rotate(180deg)' : 'rotate(0deg)';

                const targetId = header.getAttribute('data-target');
                if (targetId) switchTab(targetId, `${tabTitleMap[targetId]} - Tất cả`);
                header.classList.add('active');
                
                const allSubMenu = content.querySelector('.sub-menu-item[data-technique="all"]');
                if (allSubMenu) allSubMenu.classList.add('active');
            });
        });
    }

    if (subMenuItems) {
        subMenuItems.forEach(subItem => {
            subItem.addEventListener('click', (e) => {
                e.stopPropagation();
                const parentAccordion = subItem.closest('.menu-accordion');
                if (parentAccordion) {
                    const parentHeader = parentAccordion.querySelector('.accordion-header');
                    if (parentHeader) {
                        const targetId = parentHeader.getAttribute('data-target');
                        const techniqueName = subItem.textContent.trim();
                        if (targetId) switchTab(targetId, `${tabTitleMap[targetId]} - ${techniqueName}`);
                        parentHeader.classList.add('active');
                    }
                }
                subItem.classList.add('active');
            });
        });
    }

    document.addEventListener('click', (e) => {
        const bellToggle = e.target.closest('#bellToggle');
        const userMenuToggle = e.target.closest('#userMenuToggle');
        const notiDropdown = document.getElementById('notiDropdown');
        const userDropdown = document.getElementById('userDropdown');

        if (bellToggle) {
            e.stopPropagation();
            if (notiDropdown) notiDropdown.classList.toggle('show');
            if (userDropdown) userDropdown.classList.remove('show');
            return;
        }

        if (userMenuToggle) {
            e.stopPropagation();
            if (userDropdown) userDropdown.classList.toggle('show');
            if (notiDropdown) notiDropdown.classList.remove('show');
            return;
        }

        if (notiDropdown && notiDropdown.classList.contains('show') && !e.target.closest('#notiDropdown')) {
            notiDropdown.classList.remove('show');
        }
        if (userDropdown && userDropdown.classList.contains('show') && !e.target.closest('#userDropdown')) {
            userDropdown.classList.remove('show');
        }

        if (e.target.closest('#btnManageProfile')) {
            e.preventDefault();
            switchTab('tab-profile');
        }
        if (e.target.closest('#btnUpgradeHeader') || e.target.closest('#btnUpgradeVipTopbar')) {
            switchTab('tab-vip');
        }
        if (e.target.closest('#btnLogout')) {
            e.preventDefault();
            sessionStorage.removeItem('dashboard_user_rank'); 
            signOut(auth).catch((error) => alert("Đã xảy ra lỗi khi đăng xuất!"));
        }
        if (e.target.closest('#btnConfirmPayment')) {
            alert("Hệ thống đã ghi nhận yêu cầu. Chúng tôi sẽ kiểm tra và kích hoạt gói PRO cho bạn trong thời gian sớm nhất!");
        }
    });
}

// =========================================================================
// 5. XỬ LÝ THÔNG BÁO TỪ ADMIN VÀ HIỂN THỊ POPUP (REAL-TIME)
// =========================================================================
export function initNotificationListener(user) {
    if (!user) return;
    const userEmail = user.email;

    const notifRef = collection(db, "notifications");
    const q = query(notifRef, where("toEmail", "==", userEmail));

    onSnapshot(q, (snapshot) => {
        const notifList = document.getElementById('notiListContainer');
        const badgeCount = document.getElementById('notiBadgeCount');
        
        let unreadCount = 0;
        let notifications = [];
        window.userNotificationsData = {}; // Khởi tạo kho lưu trữ tạm thời

        snapshot.forEach(docSnap => {
            const data = docSnap.data();
            const notif = { id: docSnap.id, ...data };
            notifications.push(notif);
            window.userNotificationsData[notif.id] = notif; // Lưu data để dùng cho Popup
            if (data.status === 'unread') unreadCount++;
        });

        notifications.sort((a, b) => {
            const timeA = a.timestamp ? (a.timestamp.toMillis ? a.timestamp.toMillis() : new Date(a.timestamp).getTime()) : 0;
            const timeB = b.timestamp ? (b.timestamp.toMillis ? b.timestamp.toMillis() : new Date(b.timestamp).getTime()) : 0;
            return timeB - timeA;
        });

        if (badgeCount) {
            badgeCount.innerText = unreadCount;
            badgeCount.style.display = unreadCount > 0 ? 'flex' : 'none'; 
        }

        if (notifList) {
            notifList.innerHTML = '';
            if (notifications.length === 0) {
                notifList.innerHTML = '<div class="noti-empty">Bạn chưa có thông báo nào.</div>';
                return;
            }

            notifications.forEach(notif => {
                const isUnread = notif.status === 'unread';
                const fw = isUnread ? 'bold' : 'normal';
                
                // Cập nhật icon dựa trên loại thông báo
                let icon = '💬';
                if (notif.type === 'system_broadcast') icon = '📢';
                if (notif.type === 'room_share' || notif.type === 'exam_share') icon = '🎯';
                
                notifList.innerHTML += `
                    <div class="noti-item ${isUnread ? 'unread' : ''}" style="cursor: pointer;" onclick="handleNotificationClick('${notif.id}')">
                        <div class="noti-icon">${icon}</div>
                        <div class="noti-content">
                            <div class="noti-text" style="font-weight: ${fw}">${notif.title}</div>
                            <div class="noti-time" style="color: #64748b; font-size: 0.85rem;">Nhấp để xem chi tiết</div>
                        </div>
                    </div>
                `;
            });
        }
    }, (error) => {
        console.error("Lỗi khi tải thông báo Realtime:", error);
    });
}

// Hàm Xử lý khi click vào 1 thông báo
window.handleNotificationClick = async function(notifId) {
    const notif = window.userNotificationsData[notifId];
    if (!notif) return;

    // 1. Cập nhật trạng thái "Đã đọc" trên Firestore
    if (notif.status === 'unread') {
        try {
            const notifDocRef = doc(db, "notifications", notifId);
            await updateDoc(notifDocRef, { status: 'read' });
        } catch (error) {
            console.error("Lỗi khi update status thông báo:", error);
        }
    }

    // 2. Ẩn dropdown thông báo
    const notiDropdown = document.getElementById('notiDropdown');
    if (notiDropdown) notiDropdown.classList.remove('show');

    // 3. Render Popup Modal
    showNotificationModal(notif);
}

// Hàm tạo và hiển thị Popup Modal
function showNotificationModal(notif) {
    const existingModal = document.getElementById('notifModalDynamic');
    if (existingModal) existingModal.remove();

    let actionButtonsHTML = `<button onclick="document.getElementById('notifModalDynamic').remove()" style="padding: 8px 20px; background: #e2e8f0; color: #334155; border: none; border-radius: 6px; cursor: pointer; font-weight: 600; transition: 0.2s;">Đóng</button>`;
    
    // Nếu là thông báo mời thi (có type đặc biệt hoặc có link actionUrl)
    if (notif.type === 'room_share' || notif.type === 'exam_share' || notif.actionUrl) {
        const targetLink = notif.actionUrl || '#'; 
        actionButtonsHTML = `
            <button onclick="document.getElementById('notifModalDynamic').remove()" style="padding: 8px 20px; background: #e2e8f0; color: #334155; border: none; border-radius: 6px; cursor: pointer; font-weight: 600; transition: 0.2s;">Hủy</button>
            <button onclick="window.location.href='${targetLink}'" style="padding: 8px 20px; background: #084298; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: 600; transition: 0.2s; box-shadow: 0 4px 6px rgba(8, 66, 152, 0.2);">Vào thi</button>
        `;
    }

    const modalHtml = `
        <div id="notifModalDynamic" style="position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(15, 23, 42, 0.6); z-index: 100000; display: flex; align-items: center; justify-content: center; backdrop-filter: blur(4px);">
            <div style="background: white; width: 90%; max-width: 480px; border-radius: 12px; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04); overflow: hidden; animation: modalNotifFade 0.25s ease-out;">
                
                <div style="padding: 18px 24px; border-bottom: 1px solid #e2e8f0; background: #f8fafc; font-weight: 700; font-size: 1.15rem; color: #0f172a; display: flex; justify-content: space-between; align-items: center;">
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <i class="fa-solid fa-bell" style="color: #084298;"></i> Chi tiết thông báo
                    </div>
                    <i class="fa-solid fa-xmark" style="cursor: pointer; color: #64748b; font-size: 1.2rem;" onclick="document.getElementById('notifModalDynamic').remove()"></i>
                </div>
                
                <div style="padding: 24px;">
                    <h3 style="margin: 0 0 12px 0; font-size: 1.15rem; color: #1e293b; font-weight: 600;">${notif.title}</h3>
                    <p style="margin: 0; color: #475569; line-height: 1.6; font-size: 0.95rem; white-space: pre-wrap;">${notif.message}</p>
                </div>
                
                <div style="padding: 16px 24px; border-top: 1px solid #e2e8f0; background: #f8fafc; display: flex; justify-content: flex-end; gap: 12px;">
                    ${actionButtonsHTML}
                </div>

            </div>
        </div>
        <style>
            @keyframes modalNotifFade {
                from { opacity: 0; transform: scale(0.95) translateY(10px); }
                to { opacity: 1; transform: scale(1) translateY(0); }
            }
        </style>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalHtml);
}

// =========================================================================
// 6. XỬ LÝ AUTHENTICATION & ĐỒNG BỘ UI THÔNG TIN USER
// =========================================================================
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
    
    const topbarVipContainer = document.getElementById('topbar-vip-container');
    if (topbarVipContainer) {
        topbarVipContainer.innerHTML = `
            <button class="btn-premium-pro" id="btnUpgradeHeader" style="background: linear-gradient(135deg, #f59e0b, #d97706); border: none; color: white; padding: 8px 16px; border-radius: 8px; font-weight: 600; cursor: pointer; transition: 0.2s; display: flex; align-items: center; gap: 8px; box-shadow: 0 2px 6px rgba(245, 158, 11, 0.3);">
                <i class="fa-solid fa-crown"></i> Nâng cấp Pro
            </button>
        `;
    }
}

function fetchUserData(user) {
    return new Promise((resolve) => {
        const userDocRef = doc(db, "users", user.uid);
        
        onSnapshot(userDocRef, async (userDocSnap) => {
            let currentUserData = { isVip: false, isBanned: false, bookmarks: [] };
            
            if (userDocSnap.exists()) {
                currentUserData = userDocSnap.data();
                
                if (!currentUserData.bookmarks) {
                    currentUserData.bookmarks = [];
                }

                if (currentUserData.isBanned) {
                    alert("Tài khoản của bạn đã bị khóa hệ thống. Vui lòng liên hệ quản trị viên.");
                    await signOut(auth);
                    return resolve(null); 
                }

                if (currentUserData.avatarBase64) {
                    const elUserAvatar = document.getElementById("userAvatar");
                    if (elUserAvatar) elUserAvatar.src = currentUserData.avatarBase64;

                    const elTopbarAvatar = document.getElementById("topbarAvatar");
                    if (elTopbarAvatar) elTopbarAvatar.src = currentUserData.avatarBase64; 
                }

                if (currentUserData.isVip) {
                    
                    let needsDateUpdate = false;
                    
                    if (!currentUserData.vipStart || !currentUserData.vipEnd) {
                        needsDateUpdate = true;
                    } else {
                        const endDate = currentUserData.vipEnd.toDate ? currentUserData.vipEnd.toDate() : new Date(currentUserData.vipEnd);
                        if (endDate.getTime() < Date.now()) {
                            needsDateUpdate = true;
                        }
                    }

                    if (needsDateUpdate) {
                        const now = new Date();
                        const expire = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); 
                        
                        currentUserData.vipStart = now;
                        currentUserData.vipEnd = expire;
                        
                        setDoc(userDocRef, { vipStart: now, vipEnd: expire }, { merge: true }).catch(err => console.error(err));
                    }
                    
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

                    const topbarVipContainer = document.getElementById('topbar-vip-container');
                    if (topbarVipContainer) {
                        topbarVipContainer.innerHTML = `
                            <div class="topbar-vip-badge" style="background: linear-gradient(135deg, #10b981, #059669); color: white; padding: 6px 14px; border-radius: 20px; font-weight: 700; font-size: 0.9rem; display: flex; align-items: center; gap: 6px; box-shadow: 0 2px 6px rgba(16, 185, 129, 0.3);">
                                <i class="fa-solid fa-gem"></i> PRO
                            </div>
                        `;
                    }
                } else {
                    setVipInactive();
                }
            } else {
                setVipInactive(); 
            }
            
            resolve(currentUserData);
            
        }, (error) => {
            console.error("Lỗi khi lắng nghe dữ liệu user từ Firestore:", error);
            setVipInactive();
            resolve({ isVip: false, isBanned: false, bookmarks: [] });
        });
    });
}

async function executeAuthUI(user) {
    renderAuthInfo(user);
    const currentUserData = await fetchUserData(user);
    
    initNotificationListener(user);
    
    if (currentUserData) {
        const authReadyEvent = new CustomEvent("authReady", { detail: { user, currentUserData } });
        document.dispatchEvent(authReadyEvent);
    }
}

onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentUserInstance = user; 
        if (isComponentsLoaded) {
            executeAuthUI(user);
        }
    } else {
        safeRedirect('index.html');
    }
});
