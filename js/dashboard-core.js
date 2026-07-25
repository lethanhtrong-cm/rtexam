// =========================================================================
// IMPORT TỪ MODULE FIREBASE & GIAO DIỆN CHUYÊN BIỆT
// =========================================================================
import { app, auth, db } from "./dashboard/firebase-core.js";
import { safeRedirect, formatDate, switchTab, showNotificationModal, renderAuthInfo, setVipInactive } from "./dashboard/dashboard-ui.js";

// Import core logic của Firestore và Auth (Đã bổ sung deleteDoc)
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { doc, getDoc, setDoc, deleteDoc, serverTimestamp, onSnapshot, collection, query, where, updateDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// Tái xuất khẩu (Re-export) để đảm bảo các file cũ (như dashboard-exams) vẫn hoạt động hoàn hảo
export { app, auth, db, safeRedirect, formatDate, switchTab, initNotificationListener };

// =========================================================================
// QUẢN LÝ VÒNG ĐỜI & GẮN SỰ KIỆN KHI DOM SẴN SÀNG
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
                    // TÍNH NĂNG ĐIỀU HƯỚNG TỰ ĐỘNG VỀ KHO ĐỀ THI KHI ĐƯỢC DUYỆT
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
                        
                        alert("Chúc mừng! Tài khoản của bạn đã được nâng cấp lên PRO thành công.");
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
