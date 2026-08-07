// =========================================================================
// IMPORT TỪ MODULE FIREBASE & GIAO DIỆN CHUYÊN BIỆT
// =========================================================================
import { app, auth, db } from "./dashboard/firebase-core.js";
import { safeRedirect, formatDate, switchTab, showNotificationModal, renderAuthInfo, setVipInactive } from "./dashboard/dashboard-ui.js";

// Import core logic của Firestore và Auth (Bổ sung thêm increment để làm bộ đếm)
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { doc, getDoc, setDoc, deleteDoc, addDoc, serverTimestamp, onSnapshot, collection, query, where, updateDoc, increment } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// Tái xuất khẩu (Re-export) để đảm bảo các file cũ (như dashboard-exams) vẫn hoạt động hoàn hảo
export { app, auth, db, safeRedirect, formatDate, switchTab, initNotificationListener };

// =========================================================================
// QUẢN LÝ VÒNG ĐỜI & GẮN SỰ KIỆN KHI DOM SẴN SÀNG
// =========================================================================
let isComponentsLoaded = false;
let currentUserInstance = null; 

document.addEventListener('ComponentsLoaded', () => {
    isComponentsLoaded = true;

    // =================================================================
    // TÍNH NĂNG MỚI: BỘ ĐẾM LƯỢT TRUY CẬP THEO CHU KỲ THỜI GIAN
    // =================================================================
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const date = String(now.getDate()).padStart(2, '0');
    
    // Khởi tạo các Key động
    const dateKey = `day_${year}_${month}_${date}`;
    const monthKey = `month_${year}_${month}`;
    const yearKey = `year_${year}`;
    
    // Tính số tuần hiện tại trong năm
    const startDate = new Date(now.getFullYear(), 0, 1);
    const days = Math.floor((now - startDate) / (24 * 60 * 60 * 1000));
    const weekNumber = Math.ceil((now.getDay() + 1 + days) / 7);
    const weekKey = `week_${year}_W${String(weekNumber).padStart(2, '0')}`;

    if (!sessionStorage.getItem('site_visited')) {
        sessionStorage.setItem('site_visited', 'true');
        // Ghi nhận lượt truy cập đồng loạt cho các chu kỳ
        const updates = {
            totalVisits: increment(1),
            [dateKey]: increment(1),
            [weekKey]: increment(1),
            [monthKey]: increment(1),
            [yearKey]: increment(1)
        };
        setDoc(doc(db, "statistics", "global"), updates, { merge: true }).catch(() => {});
    }

    // Lắng nghe dữ liệu thời gian thực và đẩy lên Footer UI
    onSnapshot(doc(db, "statistics", "global"), (docSnap) => {
        if (docSnap.exists()) {
            const data = docSnap.data();
            
            const vTotal = document.getElementById('global-visitor-count');
            const vDaily = document.getElementById('visitor-daily');
            const vWeekly = document.getElementById('visitor-weekly');
            const vMonthly = document.getElementById('visitor-monthly');
            const vYearly = document.getElementById('visitor-yearly');

            if (vTotal) vTotal.innerText = (data.totalVisits || 0).toLocaleString('vi-VN');
            if (vDaily) vDaily.innerText = (data[dateKey] || 0).toLocaleString('vi-VN');
            if (vWeekly) vWeekly.innerText = (data[weekKey] || 0).toLocaleString('vi-VN');
            if (vMonthly) vMonthly.innerText = (data[monthKey] || 0).toLocaleString('vi-VN');
            if (vYearly) vYearly.innerText = (data[yearKey] || 0).toLocaleString('vi-VN');
        }
    });

    initDOMListeners();
    
    if (currentUserInstance) {
        executeAuthUI(currentUserInstance);
    }

    const oldBtnCreateRoom = document.getElementById('topbarNavCreateRoom'); 
    
    if (oldBtnCreateRoom) {
        const btnCreateRoom = oldBtnCreateRoom.cloneNode(true);
        oldBtnCreateRoom.parentNode.replaceChild(btnCreateRoom, oldBtnCreateRoom);

        // Các biến DOM của Modal
        const roomModal = document.getElementById('room-options-modal');
        const btnCloseModal = document.getElementById('btnCloseRoomModal');
        const btnCreateNew = document.getElementById('btnSubmitCreateNewRoom');
        const btnJoin = document.getElementById('btnSubmitJoinRoom');
        const inputJoin = document.getElementById('inputJoinRoomCode');
        const errorMsg = document.getElementById('errorJoinRoom');

        // Mở Modal thay vì tạo phòng ngay
        btnCreateRoom.addEventListener('click', (e) => {
            e.preventDefault(); 
            e.stopPropagation(); 
            
            if (!auth.currentUser) {
                alert("Vui lòng đăng nhập để sử dụng tính năng phòng thi.");
                return;
            }
            
            inputJoin.value = '';
            errorMsg.style.display = 'none';
            roomModal.style.display = 'flex';
            
            // Hiệu ứng Pop-in
            roomModal.querySelector('div').style.transform = 'scale(1)';
        });

        // Đóng Modal
        const closeModal = () => {
            roomModal.querySelector('div').style.transform = 'scale(0.95)';
            setTimeout(() => roomModal.style.display = 'none', 150);
        };
        btnCloseModal.addEventListener('click', closeModal);
        roomModal.addEventListener('click', (e) => {
            if (e.target === roomModal) closeModal();
        });

        // =================================================================
        // TÍNH NĂNG MỚI: BẬT POPUP CHỌN VAI TRÒ KHI NHẤN "TẠO PHÒNG MỚI"
        // =================================================================
        btnCreateNew.addEventListener('click', (e) => {
            e.preventDefault();

            // 1. Tạo giao diện Popup Modal động (Tuân thủ CSS từ modal.html)
            const popupHTML = `
                <div class="custom-modal-overlay" id="roleSelectionModal" style="display: flex; z-index: 100000; background: rgba(15, 23, 42, 0.6); backdrop-filter: blur(4px);">
                    <div class="custom-modal-content" style="max-width: 400px; animation: modalNotifFade 0.25s ease-out;">
                        <div class="custom-modal-header">
                            <h3 style="margin: 0;"><i class="fa-solid fa-users-gear"></i> Vai trò Chủ phòng</h3>
                            <button class="close-modal-btn" id="closeRoleModalBtn"><i class="fa-solid fa-xmark"></i></button>
                        </div>
                        <div class="custom-modal-body" style="text-align: center; padding: 25px 20px;">
                            <p style="margin-bottom: 20px; color: #475569; font-size: 0.95rem;">Bạn muốn tham gia phòng thi này với tư cách gì?</p>
                            <div style="display: flex; gap: 15px;">
                                <button id="btnRoleProctor" style="flex: 1; padding: 15px; background: #0f172a; color: white; border: none; border-radius: 10px; font-weight: 600; cursor: pointer; display: flex; flex-direction: column; align-items: center; gap: 8px; transition: 0.2s; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                                    <i class="fa-solid fa-eye" style="font-size: 1.8rem; color: #38bdf8;"></i> Giám thị
                                </button>
                                <button id="btnRolePlayer" style="flex: 1; padding: 15px; background: #2563eb; color: white; border: none; border-radius: 10px; font-weight: 600; cursor: pointer; display: flex; flex-direction: column; align-items: center; gap: 8px; transition: 0.2s; box-shadow: 0 4px 6px rgba(37, 99, 235, 0.2);">
                                    <i class="fa-solid fa-pen" style="font-size: 1.8rem; color: #93c5fd;"></i> Thi đấu
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            `;
            
            // Thêm Popup vào cuối trang
            document.body.insertAdjacentHTML('beforeend', popupHTML);

            const roleModal = document.getElementById('roleSelectionModal');
            const closeBtn = document.getElementById('closeRoleModalBtn');
            const btnProctor = document.getElementById('btnRoleProctor');
            const btnPlayer = document.getElementById('btnRolePlayer');

            // Hiệu ứng Hover cho nút
            btnProctor.onmouseover = () => btnProctor.style.transform = 'translateY(-3px)';
            btnProctor.onmouseout = () => btnProctor.style.transform = 'translateY(0)';
            btnPlayer.onmouseover = () => btnPlayer.style.transform = 'translateY(-3px)';
            btnPlayer.onmouseout = () => btnPlayer.style.transform = 'translateY(0)';

            const destroyModal = () => roleModal.remove();
            closeBtn.addEventListener('click', destroyModal);
            roleModal.addEventListener('click', (ev) => { if (ev.target === roleModal) destroyModal(); });

            // 2. Hàm xử lý logic gốc sau khi chọn vai trò
            const executeRoomCreation = async (role) => {
                destroyModal(); // Đóng popup chọn vai trò
                
                const originalText = btnCreateNew.innerHTML;
                btnCreateNew.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Đang tạo...';
                btnCreateNew.disabled = true;

                const roomId = Math.floor(10000 + Math.random() * 90000).toString();
                const targetUrl = `lobby.html?roomId=${roomId}`;
                const newTab = window.open('about:blank', '_blank');

                try {
                    const roomRef = doc(db, 'rooms', roomId);
                    await setDoc(roomRef, {
                        hostEmail: auth.currentUser.email,
                        hostUid: auth.currentUser.uid,
                        hostRole: role, // Ghi nhận 'proctor' (Giám thị) hoặc 'player' (Thi đấu)
                        status: 'waiting',
                        isLocked: false,
                        examId: null,   
                        examName: null,
                        createdAt: serverTimestamp()
                    });

                    if (newTab) newTab.location.href = targetUrl;
                    closeModal(); // Đóng form Modal chính
                    
                } catch (error) {
                    console.error("Lỗi Firestore:", error);
                    if (newTab) newTab.close();
                    alert("Không thể tạo phòng! Vui lòng kiểm tra mạng.");
                } finally {
                    btnCreateNew.innerHTML = originalText;
                    btnCreateNew.disabled = false;
                }
            };

            // Lắng nghe click chọn vai trò
            btnProctor.addEventListener('click', () => executeRoomCreation('proctor'));
            btnPlayer.addEventListener('click', () => executeRoomCreation('player'));
        });


        // Xử lý nút: THAM GIA PHÒNG
        btnJoin.addEventListener('click', async () => {
            const rawCode = inputJoin.value.trim().toUpperCase();
            if (!rawCode) {
                errorMsg.textContent = "Vui lòng nhập mã phòng!";
                errorMsg.style.display = 'block';
                return;
            }

            const originalText = btnJoin.innerHTML;
            btnJoin.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i>';
            btnJoin.disabled = true;
            errorMsg.style.display = 'none';

            try {
                const roomRef = doc(db, 'rooms', rawCode);
                const roomSnap = await getDoc(roomRef);

                if (roomSnap.exists()) {
                    window.open(`lobby.html?roomId=${rawCode}`, '_blank');
                    closeModal();
                } else {
                    errorMsg.textContent = "Mã phòng không tồn tại hoặc đã bị đóng!";
                    errorMsg.style.display = 'block';
                }
            } catch (error) {
                errorMsg.textContent = "Lỗi kết nối máy chủ!";
                errorMsg.style.display = 'block';
            } finally {
                btnJoin.innerHTML = originalText;
                btnJoin.disabled = false;
            }
        });

        inputJoin.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') btnJoin.click();
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
                if (targetId) switchTab(targetId, `Tất cả`); 
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
                        if (targetId) switchTab(targetId, `${techniqueName}`);
                        parentHeader.classList.add('active');
                    }
                }
                subItem.classList.add('active');
            });
        });
    }

    // EVENT DELEGATION
    document.addEventListener('click', (e) => {
        const notiDropdown = document.getElementById('notiDropdown');
        const userDropdown = document.getElementById('userDropdown');

        if (e.target.closest('#btnManageProfile')) {
            e.preventDefault();
            e.stopPropagation(); 
            if (userDropdown) userDropdown.classList.remove('show');
            switchTab('tab-profile');
            return;
        }
        if (e.target.closest('#btnUpgradeHeader') || e.target.closest('#btnUpgradeVipTopbar')) {
            e.preventDefault();
            e.stopPropagation();
            if (userDropdown) userDropdown.classList.remove('show');
            switchTab('tab-vip');
            return;
        }
        if (e.target.closest('#btnLogout')) {
            e.preventDefault();
            e.stopPropagation();
            if (userDropdown) userDropdown.classList.remove('show');
            sessionStorage.removeItem('dashboard_user_rank');
            
            // CẬP NHẬT TRẠNG THÁI OFFLINE KHI CHỦ ĐỘNG ĐĂNG XUẤT
            if (auth.currentUser) {
                updateDoc(doc(db, "users", auth.currentUser.uid), { isOnline: false }).catch(() => {});
            }
            
            signOut(auth).catch((error) => alert("Đã xảy ra lỗi khi đăng xuất!"));
            return;
        }

        // --- CẬP NHẬT LOGIC XÁC NHẬN CHUYỂN KHOẢN ---
        if (e.target.closest('#btnConfirmPayment')) {
            e.preventDefault(); e.stopPropagation();
            if (userDropdown) userDropdown.classList.remove('show');
            
            const btn = document.getElementById('btnConfirmPayment');
            if (btn && btn.disabled) return; 
            
            if (auth.currentUser) {
                // Đổi trạng thái giao diện nút Xác nhận TẠM THỜI (Real-time listener sẽ gánh phần còn lại)
                if (btn) {
                    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Chờ phê duyệt...';
                    btn.style.background = '#94a3b8';
                    btn.style.boxShadow = 'none';
                    btn.disabled = true;
                }
                
                const cancelBtn = document.getElementById('btnCancelPayment');
                if (cancelBtn) cancelBtn.style.display = 'block';

                // Ghi dữ liệu lên Firestore với ID là UID của user
                setDoc(doc(db, "payment_requests", auth.currentUser.uid), { 
                    uid: auth.currentUser.uid, 
                    email: auth.currentUser.email, 
                    status: "pending", 
                    amount: 20000, 
                    createdAt: serverTimestamp() 
                }).catch(() => alert("Lỗi kết nối máy chủ, vui lòng thử lại!"));
            }
            return;
        }

        // --- TÍNH NĂNG MỚI: HỦY YÊU CẦU CHUYỂN KHOẢN ---
        if (e.target.closest('#btnCancelPayment')) {
            e.preventDefault(); e.stopPropagation();
            if (auth.currentUser) {
                // Xóa Document yêu cầu khỏi Firestore (Listener sẽ tự động phục hồi nút bấm)
                deleteDoc(doc(db, "payment_requests", auth.currentUser.uid)).catch(() => alert("Lỗi khi hủy thao tác, vui lòng thử lại!"));
            }
            return;
        }

        const bellToggle = e.target.closest('#bellToggle');
        const userMenuToggle = e.target.closest('#userMenuToggle');

        if (bellToggle) {
            e.stopPropagation();
            if (e.target.closest('#notiDropdown')) return; 
            
            if (notiDropdown) notiDropdown.classList.toggle('show');
            if (userDropdown) userDropdown.classList.remove('show');
            return;
        }

        if (userMenuToggle) {
            e.stopPropagation();
            if (e.target.closest('#userDropdown')) return;

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

        const notiItem = e.target.closest('.noti-item');
        if (notiItem) {
            e.preventDefault();
            const notifId = notiItem.getAttribute('data-notif-id');
            if (notifId && window.userNotificationsData && window.userNotificationsData[notifId]) {
                const notif = window.userNotificationsData[notifId];
                
                if (notif.status === 'unread') {
                    try {
                        const notifDocRef = doc(db, "notifications", notifId);
                        updateDoc(notifDocRef, { status: 'read' }).catch(err => console.error(err));
                    } catch (error) {}
                }

                if (notiDropdown) notiDropdown.classList.remove('show');
                showNotificationModal(notif);
            }
            return;
        }

        if (e.target.closest('[data-action="close-notif-modal"]')) {
            const modal = document.getElementById('notifModalDynamic');
            if (modal) modal.remove();
            return;
        }

        const acceptShareBtn = e.target.closest('[data-action="accept-share"]');
        if (acceptShareBtn) {
            const targetUrl = acceptShareBtn.getAttribute('data-url');
            if (targetUrl && targetUrl !== '#') {
                window.location.href = targetUrl;
            } else {
                alert("Đường dẫn phòng thi/đề thi không hợp lệ!");
            }
            return;
        }
    });
}

// =========================================================================
// XỬ LÝ THÔNG BÁO TỪ ADMIN VÀ RENDER GIAO DIỆN
// =========================================================================
function initNotificationListener(user) {
    if (!user) return;
    const userEmail = user.email;

    const notifRef = collection(db, "notifications");
    const q = query(notifRef, where("toEmail", "==", userEmail));

    onSnapshot(q, (snapshot) => {
        const notifList = document.getElementById('notiListContainer');
        const badgeCount = document.getElementById('notiBadgeCount');
        
        let unreadCount = 0;
        let notifications = [];
        window.userNotificationsData = {}; 

        snapshot.forEach(docSnap => {
            const data = docSnap.data();
            const notif = { id: docSnap.id, ...data };
            notifications.push(notif);
            window.userNotificationsData[notif.id] = notif; 
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
                
                let icon = '💬';
                if (notif.type === 'system_broadcast') icon = '📢';
                if (notif.type === 'room_share' || notif.type === 'exam_share') icon = '🎯';
                
                notifList.innerHTML += `
                    <div class="noti-item ${isUnread ? 'unread' : ''}" style="cursor: pointer;" data-notif-id="${notif.id}">
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

// =========================================================================
// XỬ LÝ LẮNG NGHE TRẠNG THÁI THANH TOÁN (GIỮ TRẠNG THÁI KHI RELOAD TRANG)
// =========================================================================
function initPaymentStatusListener(user) {
    if (!user) return;
    
    const paymentRef = doc(db, "payment_requests", user.uid);
    onSnapshot(paymentRef, (docSnap) => {
        const btn = document.getElementById('btnConfirmPayment');
        const cancelBtn = document.getElementById('btnCancelPayment');
        
        // NẾU CÓ YÊU CẦU ĐANG CHỜ PHÊ DUYỆT TRONG DB
        if (docSnap.exists() && docSnap.data().status === 'pending') {
            if (btn) {
                btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Chờ phê duyệt...';
                btn.style.background = '#94a3b8';
                btn.style.boxShadow = 'none';
                btn.disabled = true;
            }
            if (cancelBtn) cancelBtn.style.display = 'block';
        } 
        // NẾU KHÔNG CÓ YÊU CẦU (Bị Hủy, Hoặc Đã Duyệt)
        else {
            // Phục hồi lại nút nếu nó đang bị kẹt chữ "Chờ phê duyệt"
            if (btn && btn.innerHTML.includes('Chờ phê duyệt')) {
                btn.innerHTML = '<i class="fa-regular fa-circle-check" style="font-size: 1.2rem;"></i> Xác nhận tôi đã chuyển khoản';
                btn.style.background = ''; 
                btn.style.boxShadow = '';
                btn.disabled = false;
            }
            if (cancelBtn) cancelBtn.style.display = 'none';
        }
    }, (error) => {
        console.error("Lỗi khi lắng nghe tiến trình thanh toán cá nhân:", error);
    });
}

// =========================================================================
// XỬ LÝ AUTHENTICATION & ĐỒNG BỘ UI THÔNG TIN USER
// =========================================================================
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
                    
                    // =========================================================================
                    // TÍNH NĂNG ĐIỀU HƯỚNG TỰ ĐỘNG, PUSH THÔNG BÁO VÀ POPUP XỊN XÒ KHI ĐƯỢC DUYỆT
                    // =========================================================================
                    const tabVip = document.getElementById('tab-vip');
                    if (tabVip && tabVip.classList.contains('active')) {
                        const btn = document.getElementById('btnConfirmPayment');
                        const btnCancel = document.getElementById('btnCancelPayment');
                        if (btn) { 
                            btn.innerHTML = '<i class="fa-regular fa-circle-check" style="font-size: 1.2rem;"></i> Xác nhận tôi đã chuyển khoản'; 
                            btn.style.background = ''; 
                            btn.style.boxShadow = '';
                            btn.disabled = false; 
                        }
                        if (btnCancel) {
                            btnCancel.style.display = 'none';
                        }
                        
                        // Tìm chính xác mục menu con "Tất cả" của Kho Đề Thi để chuyển hướng về
                        const allExamsMenu = document.querySelector('.sub-menu-item[data-technique="all"]') || document.querySelector('[data-target="tab-dashboard"]');
                        if (allExamsMenu) {
                            allExamsMenu.click();
                        }
                        
                        // XÓA ALERT CŨ - PUSH THÔNG BÁO LÊN FIRESTORE VÀ HIỂN THỊ POPUP HTML/CSS
                        try {
                            addDoc(collection(db, "notifications"), {
                                toEmail: auth.currentUser.email,
                                title: "👑 Kích hoạt tài khoản PRO thành công",
                                message: "Cảm ơn bạn đã đồng hành cùng hệ thống. Tài khoản PRO đã được kích hoạt, mở khóa toàn bộ đề thi độc quyền và tiện ích giải thích chi tiết!",
                                status: "unread",
                                type: "system_broadcast",
                                timestamp: serverTimestamp()
                            });
                        } catch (err) {
                            console.error("Lỗi khi tự động push thông báo:", err);
                        }

                        // Xóa popup cũ nếu bị kẹt
                        const existingModal = document.getElementById('vipSuccessModalCustom');
                        if (existingModal) existingModal.remove();

                        // Bơm Modal Popup mới vào body
                        const popupHTML = `
                            <div class="custom-modal-overlay" id="vipSuccessModalCustom" style="display: flex; position: fixed; top: 0; left: 0; width: 100%; height: 100%; z-index: 100000; background: rgba(15, 23, 42, 0.7); backdrop-filter: blur(5px); justify-content: center; align-items: center;">
                                <div class="custom-modal-content" style="max-width: 450px; background: #fff; border-radius: 16px; padding: 35px 25px; text-align: center; animation: popIn 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275); box-shadow: 0 10px 30px rgba(0,0,0,0.2);">
                                    <div style="width: 80px; height: 80px; background: linear-gradient(135deg, #10b981 0%, #059669 100%); border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 20px; box-shadow: 0 4px 15px rgba(16, 185, 129, 0.3);">
                                        <i class="fa-solid fa-crown" style="font-size: 2.5rem; color: white;"></i>
                                    </div>
                                    <h2 style="color: #0f172a; margin: 0 0 12px 0; font-weight: 800; font-size: 1.6rem;">Nâng Cấp Thành Công!</h2>
                                    <p style="color: #475569; font-size: 1.05rem; line-height: 1.6; margin-bottom: 25px;">
                                        Chào mừng bạn đến với hội viên <strong>PRO</strong>. Bạn đã mở khóa toàn bộ đặc quyền không giới hạn trên hệ thống.
                                    </p>
                                    <button id="closeVipSuccessBtn" style="width: 100%; padding: 14px; background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); color: white; border: none; border-radius: 10px; font-size: 1.1rem; font-weight: bold; cursor: pointer; transition: 0.2s; box-shadow: 0 4px 10px rgba(37, 99, 235, 0.3);">
                                        Khám phá ngay <i class="fa-solid fa-arrow-right ms-2"></i>
                                    </button>
                                </div>
                            </div>
                        `;
                        document.body.insertAdjacentHTML('beforeend', popupHTML);
                        
                        // Lắng nghe sự kiện đóng Popup
                        const successModal = document.getElementById('vipSuccessModalCustom');
                        const closeBtn = document.getElementById('closeVipSuccessBtn');
                        
                        const closeCustomModal = () => { if (successModal) successModal.remove(); };
                        closeBtn.addEventListener('click', closeCustomModal);
                        successModal.addEventListener('click', (e) => { if (e.target === successModal) closeCustomModal(); });
                    }
                    // =========================================================================
                    
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
    initPaymentStatusListener(user); 
    
    // TÍNH NĂNG MỚI: Truy vấn điểm XP và hiển thị ra thẻ Card
    try {
        const xpDoc = await getDoc(doc(db, "users_leaderboard", user.uid));
        const statTotalXP = document.getElementById("statTotalXP");
        if (statTotalXP) {
            statTotalXP.textContent = xpDoc.exists() ? (xpDoc.data().totalXP || 0).toLocaleString('vi-VN') : "0";
        }
    } catch(e) {
        console.error("Lỗi tải XP:", e);
    }

    if (currentUserData) {
        const authReadyEvent = new CustomEvent("authReady", { detail: { user, currentUserData } });
        document.dispatchEvent(authReadyEvent);
    }
}

// =========================================================================
// QUẢN LÝ TRẠNG THÁI ONLINE / OFFLINE REALTIME (CÁCH 2)
// =========================================================================
onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentUserInstance = user; 
        
        // 1. CẬP NHẬT ONLINE NGAY KHI RENDER / RELOAD TRANG
        updateDoc(doc(db, "users", user.uid), { isOnline: true }).catch(() => {});
        
        // 2. TỰ ĐỘNG CHUYỂN OFFLINE KHI F5 / RELOAD / ĐÓNG TAB
        window.addEventListener('beforeunload', () => {
            updateDoc(doc(db, "users", user.uid), { isOnline: false }).catch(() => {});
        });

        // 3. TỰ ĐỘNG CHUYỂN OFFLINE KHI MÁY TÍNH SLEEP / KHÓA MÀN HÌNH (Page Lifecycle)
        document.addEventListener('freeze', () => {
            updateDoc(doc(db, "users", user.uid), { isOnline: false }).catch(() => {});
        });

        // 4. TỰ ĐỘNG CHUYỂN OFFLINE KHI MẤT KẾT NỐI MẠNG INTERNET
        window.addEventListener('offline', () => {
            updateDoc(doc(db, "users", user.uid), { isOnline: false }).catch(() => {});
        });

        // 5. PHỤC HỒI ONLINE KHI MÁY TÍNH WAKE UP HOẶC CÓ MẠNG LẠI
        window.addEventListener('online', () => {
            updateDoc(doc(db, "users", user.uid), { isOnline: true }).catch(() => {});
        });

        if (isComponentsLoaded) {
            executeAuthUI(user);
        }
    } else {
        safeRedirect('index.html');
    }
});
