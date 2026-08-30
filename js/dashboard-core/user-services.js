import { doc, getDoc, setDoc, addDoc, serverTimestamp, onSnapshot, collection, query, where, updateDoc, limit } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { signOut } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { formatDate, setVipInactive, renderAuthInfo } from "../dashboard/dashboard-ui.js";

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
                // Hỗ trợ luồng cũ (isVip) bằng cách tạm ánh xạ sang 'plus' nếu hệ thống cũ chưa update triệt để
                let activeTier = currentUserData.vipTier;
                if (!activeTier && currentUserData.isVip) activeTier = 'plus';

                if (activeTier === 'plus' || activeTier === 'pro') {
                    const startField = currentUserData.vipActivationDate || currentUserData.vipStart;
                    const expiryField = currentUserData.vipExpirationDate || currentUserData.vipEnd;
                    
                    let startDateObj = null;
                    if (startField) {
                        startDateObj = startField.toDate ? startField.toDate() : new Date(startField);
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

                            const existingModal = document.getElementById('vipSuccessModalCustom');
                            if (existingModal) existingModal.remove();

                            const popupHTML = `
                                <div class="custom-modal-overlay" id="vipSuccessModalCustom" style="display: flex; position: fixed; top: 0; left: 0; width: 100%; height: 100%; z-index: 100000; background: rgba(15, 23, 42, 0.7); backdrop-filter: blur(5px); justify-content: center; align-items: center;">
                                    <div class="custom-modal-content" style="max-width: 450px; background: #fff; border-radius: 16px; padding: 35px 25px; text-align: center; animation: popIn 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275); box-shadow: 0 10px 30px rgba(0,0,0,0.2);">
                                        <div style="width: 80px; height: 80px; background: ${tierColor}; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 20px; box-shadow: 0 4px 15px rgba(0,0,0, 0.2);">
                                            ${tierIcon.replace('>', ' style="font-size: 2.5rem; color: white;">')}
                                        </div>
                                        <h2 style="color: #0f172a; margin: 0 0 12px 0; font-weight: 800; font-size: 1.6rem;">Nâng Cấp Thành Công!</h2>
                                        <p style="color: #475569; font-size: 1.05rem; line-height: 1.6; margin-bottom: 25px;">
                                            Chào mừng bạn đến với hội viên <strong>${tierName}</strong>. Cùng nhau khám phá những tính năng học tập tuyệt vời nhất.
                                        </p>
                                        <button id="closeVipSuccessBtn" style="width: 100%; padding: 14px; background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); color: white; border: none; border-radius: 10px; font-size: 1.1rem; font-weight: bold; cursor: pointer; transition: 0.2s; box-shadow: 0 4px 10px rgba(37, 99, 235, 0.3);">
                                            Khám phá ngay <i class="fa-solid fa-arrow-right ms-2"></i>
                                        </button>
                                    </div>
                                </div>
                            `;
                            document.body.insertAdjacentHTML('beforeend', popupHTML);
                            
                            const successModal = document.getElementById('vipSuccessModalCustom');
                            const closeBtn = document.getElementById('closeVipSuccessBtn');
                            
                            const closeCustomModal = () => { if (successModal) successModal.remove(); };
                            closeBtn.addEventListener('click', closeCustomModal);
                            successModal.addEventListener('click', (e) => { if (e.target === successModal) closeCustomModal(); });
                        }
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
