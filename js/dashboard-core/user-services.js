import { doc, getDoc, setDoc, addDoc, serverTimestamp, onSnapshot, collection, query, where, updateDoc, limit } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { signOut } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { formatDate, setVipInactive, renderAuthInfo } from "../dashboard/dashboard-ui.js";

// ============================================================================
// HÀM MỚI BỔ SUNG ĐỂ GHI ĐÈ GIAO DIỆN FREE KHI HỆ THỐNG CŨ XÓA MẤT
// ============================================================================
function renderFreeBadgeUI() {
    const topbarVipContainer = document.getElementById('topbar-vip-container');
    if (topbarVipContainer) {
        topbarVipContainer.style.display = 'flex';
        topbarVipContainer.style.alignItems = 'center';
        topbarVipContainer.style.gap = '12px';
        topbarVipContainer.innerHTML = `
            <span style="background: rgba(34, 197, 94, 0.2); border: 1px solid rgba(34, 197, 94, 0.5); color: #4ade80; padding: 6px 12px; border-radius: 20px; font-size: 0.85rem; font-weight: 700; display: flex; align-items: center; gap: 6px; white-space: nowrap;"><i class="fa-solid fa-paper-plane"></i> Free</span>
            <button id="btnUpgradeHeader" style="background: linear-gradient(135deg, #f59e0b, #d97706); border: none; color: white; padding: 8px 16px; border-radius: 8px; font-weight: 600; cursor: pointer; transition: 0.2s; display: flex; align-items: center; gap: 8px; box-shadow: 0 2px 6px rgba(245, 158, 11, 0.3); white-space: nowrap;">
                <i class="fa-solid fa-crown"></i> <span>Nâng cấp</span>
            </button>
        `;
    }
}

export function initNotificationListener(auth, db) {
    const user = auth.currentUser;
    if (!user) return;
    const userEmail = user.email;

    const notifRef = collection(db, "notifications");
    const q = query(notifRef, where("toEmail", "==", userEmail), limit(10));

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

function initPaymentStatusListener(user, db) {
    if (!user) return;
    
    const paymentRef = doc(db, "payment_requests", user.uid);
    onSnapshot(paymentRef, (docSnap) => {
        const btn = document.getElementById('btnConfirmPayment');
        const cancelBtn = document.getElementById('btnCancelPayment');
        
        if (docSnap.exists() && docSnap.data().status === 'pending') {
            if (btn) {
                btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Chờ phê duyệt...';
                btn.style.background = '#94a3b8';
                btn.style.boxShadow = 'none';
                btn.disabled = true;
            }
            if (cancelBtn) cancelBtn.style.display = 'block';
        } 
        else {
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

function fetchUserData(user, auth, db) {
    return new Promise((resolve) => {
        const userDocRef = doc(db, "users", user.uid);
        
        onSnapshot(userDocRef, async (userDocSnap) => {
            let currentUserData = { vipTier: null, isBanned: false, bookmarks: [] };
            
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

                // KIỂM TRA ĐIỀU KIỆN 3 HẠNG (THƯỜNG / PLUS / PRO)
                let activeTier = currentUserData.vipTier;
                if (!activeTier && currentUserData.isVip) activeTier = 'plus';

                if (activeTier === 'plus' || activeTier === 'pro') {
                    const startField = currentUserData.vipActivationDate || currentUserData.vipStart;
                    const expiryField = currentUserData.vipExpirationDate || currentUserData.vipExpiration || currentUserData.vipEnd;
                    
                    let startDateObj = null;
                    if (startField) {
                        startDateObj = startField.toDate ? startField.toDate() : new Date(startField);
                    } else if (expiryField) {
                        startDateObj = new Date();
                    }
                    
                    let expiryDateObj = null;
                    let isExpired = false;

                    if (expiryField) {
                        expiryDateObj = expiryField.toDate ? expiryField.toDate() : new Date(expiryField);
                        if (expiryDateObj.getTime() < Date.now()) {
                            isExpired = true;
                        }
                    }
                    
                    if (isExpired) {
                        setDoc(userDocRef, { vipTier: null, isVip: false }, { merge: true }).catch(err => console.error(err));
                        setVipInactive();
                        renderFreeBadgeUI(); 
                        currentUserData.vipTier = null;
                    } else {
                        // TẠO UI DỰA TRÊN TIER
                        let tierName = activeTier === 'pro' ? 'PRO' : 'PLUS';
                        let tierIcon = activeTier === 'pro' ? '<i class="fa-solid fa-crown"></i>' : '<i class="fa-solid fa-shield-halved"></i>';
                        let tierColor = activeTier === 'pro' ? 'linear-gradient(135deg, #f59e0b, #d97706)' : 'linear-gradient(135deg, #3b82f6, #2563eb)';

                        const elVipStatusBadge = document.getElementById("vipStatusBadge");
                        if (elVipStatusBadge) {
                            elVipStatusBadge.textContent = `Đã kích hoạt ${tierName}`;
                            elVipStatusBadge.className = "status-badge status-active";
                        }

                        const elVipStatusTab3 = document.getElementById("vipStatusTab3");
                        if (elVipStatusTab3) {
                            elVipStatusTab3.textContent = `Tài khoản ${tierName} đang hoạt động`;
                            elVipStatusTab3.className = "status-badge status-active";
                        }

                        const elVipStartDate = document.getElementById("vipStartDate");
                        if (elVipStartDate) elVipStartDate.textContent = startDateObj ? formatDate(startDateObj) : "Không xác định";

                        const elVipEndDate = document.getElementById("vipEndDate");
                        if (elVipEndDate) elVipEndDate.textContent = expiryDateObj ? formatDate(expiryDateObj) : "Vĩnh viễn / Không xác định";

                        // RENDER HUY HIỆU TRÊN TOPBAR
                        const topbarVipContainer = document.getElementById('topbar-vip-container');
                        if (topbarVipContainer) {
                            topbarVipContainer.innerHTML = `
                                <div class="topbar-vip-badge" style="background: ${tierColor}; color: white; padding: 6px 14px; border-radius: 20px; font-weight: 700; font-size: 0.9rem; display: flex; align-items: center; gap: 6px; box-shadow: 0 2px 6px rgba(0,0,0, 0.2);">
                                    ${tierIcon} ${tierName}
                                </div>
                            `;
                        }
                        
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
                            
                            const allExamsMenu = document.querySelector('.sub-menu-item[data-technique="all"]') || document.querySelector('[data-target="tab-dashboard"]');
                            if (allExamsMenu) {
                                allExamsMenu.click();
                            }
                            
                            try {
                                addDoc(collection(db, "notifications"), {
                                    toEmail: auth.currentUser.email,
                                    title: `👑 Kích hoạt tài khoản ${tierName} thành công`,
                                    message: `Cảm ơn bạn đã đồng hành cùng hệ thống. Tài khoản ${tierName} đã được kích hoạt, mở khóa các đặc quyền độc quyền!`,
                                    status: "unread",
                                    type: "system_broadcast",
                                    timestamp: serverTimestamp()
                                });
                            } catch (err) {
                                console.error("Lỗi khi tự động push thông báo:", err);
                            }
                        }

                        // HIỂN THỊ POPUP TÂN THỦ NỔI BẬT VÀ ĐẸP MẮT HƠN
                        if (!sessionStorage.getItem('welcomedVipNewbie')) {
                            const existingModal = document.getElementById('vipSuccessModalCustom');
                            if (existingModal) existingModal.remove();

                            const popupHTML = `
                                <div class="custom-modal-overlay" id="vipSuccessModalCustom" style="display: flex; position: fixed; top: 0; left: 0; width: 100%; height: 100%; z-index: 100000; background: rgba(15, 23, 42, 0.85); backdrop-filter: blur(8px); justify-content: center; align-items: center; padding: 15px;">
                                    <div class="custom-modal-content" style="max-width: 400px; width: 100%; background: #ffffff; border-radius: 24px; text-align: center; animation: popIn 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275); box-shadow: 0 25px 50px -12px rgba(0,0,0,0.5); overflow: hidden; position: relative;">
                                        
                                        <!-- Vùng trang trí Header Popup -->
                                        <div style="background: linear-gradient(135deg, #6366f1, #3b82f6, #0ea5e9); height: 130px; width: 100%; position: relative; display: flex; justify-content: center;">
                                            <div style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; opacity: 0.2; background-image: radial-gradient(#ffffff 2px, transparent 2px); background-size: 20px 20px;"></div>
                                        </div>
                                        
                                        <!-- Vùng chứa Avatar/Icon nổi -->
                                        <div style="width: 90px; height: 90px; background: #ffffff; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: -45px auto 15px; box-shadow: 0 8px 25px rgba(59, 130, 246, 0.3); position: relative; z-index: 2; border: 5px solid #ffffff;">
                                            <div style="width: 100%; height: 100%; border-radius: 50%; background: ${tierColor}; display: flex; align-items: center; justify-content: center;">
                                                ${tierIcon.replace('>', ' style="font-size: 2.2rem; color: white;">')}
                                            </div>
                                        </div>
                                        
                                        <!-- Vùng nội dung chữ và nút bấm -->
                                        <div style="padding: 0 30px 35px 30px;">
                                            <span style="display: inline-block; background: #fef08a; color: #854d0e; font-size: 0.75rem; font-weight: 800; padding: 6px 16px; border-radius: 20px; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 12px; box-shadow: 0 2px 8px rgba(254, 240, 138, 0.5);">🎁 Quà Tặng Tân Thủ</span>
                                            
                                            <h2 style="color: #0f172a; margin: 0 0 12px 0; font-weight: 800; font-size: 1.8rem; line-height: 1.2;">Chào mừng bạn!</h2>
                                            
                                            <p style="color: #475569; font-size: 1.05rem; line-height: 1.6; margin-bottom: 25px;">
                                                Hệ thống đã tự động tặng bạn <span style="background: #dbeafe; color: #1d4ed8; font-weight: 800; padding: 2px 8px; border-radius: 6px;">5 NGÀY</span> trải nghiệm gói <span style="background: #ffedd5; color: #c2410c; font-weight: 800; padding: 2px 8px; border-radius: 6px;">${tierName}</span> hoàn toàn miễn phí. Cùng bắt đầu học tập ngay nhé!
                                            </p>
                                            
                                            <button id="closeVipSuccessBtn" style="width: 100%; padding: 16px; background: linear-gradient(135deg, #3b82f6, #2563eb); color: white; border: none; border-radius: 14px; font-size: 1.15rem; font-weight: bold; cursor: pointer; box-shadow: 0 8px 20px rgba(37, 99, 235, 0.35); transition: transform 0.2s, box-shadow 0.2s;">
                                                Khám phá ngay <i class="fa-solid fa-rocket ms-2"></i>
                                            </button>
                                        </div>
                                    </div>
                                    <style>
                                        @keyframes popIn { 0% { transform: scale(0.8); opacity: 0; } 100% { transform: scale(1); opacity: 1; } }
                                        #closeVipSuccessBtn:hover { transform: translateY(-3px); box-shadow: 0 12px 25px rgba(37, 99, 235, 0.45) !important; }
                                    </style>
                                </div>
                            `;
                            document.body.insertAdjacentHTML('beforeend', popupHTML);
                            
                            const successModal = document.getElementById('vipSuccessModalCustom');
                            const closeBtn = document.getElementById('closeVipSuccessBtn');
                            
                            const closeCustomModal = () => { if (successModal) successModal.remove(); };
                            closeBtn.addEventListener('click', closeCustomModal);
                            successModal.addEventListener('click', (e) => { if (e.target === successModal) closeCustomModal(); });

                            sessionStorage.setItem('welcomedVipNewbie', 'true');
                        }
                    }
                } else {
                    setVipInactive();
                    renderFreeBadgeUI(); 
                }
            } else {
                setVipInactive(); 
                renderFreeBadgeUI(); 
            }
            
            resolve(currentUserData);
            
        }, (error) => {
            console.error("Lỗi khi lắng nghe dữ liệu user từ Firestore:", error);
            setVipInactive();
            renderFreeBadgeUI(); 
            resolve({ vipTier: null, isBanned: false, bookmarks: [] });
        });
    });
}

export async function executeAuthUI(user, auth, db) {
    renderAuthInfo(user);
    const currentUserData = await fetchUserData(user, auth, db);
    
    initNotificationListener(auth, db);
    initPaymentStatusListener(user, db); 
    
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

    if (sessionStorage.getItem('triggerUpgradeTab') === 'true') {
        sessionStorage.removeItem('triggerUpgradeTab'); 
        setTimeout(() => {
            const btnVip = document.getElementById('btnUpgradeHeader');
            if (btnVip) btnVip.click(); 
        }, 400); 
    }
}
