import { signOut } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { doc, setDoc, deleteDoc, updateDoc, serverTimestamp, getDoc, arrayUnion, increment } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { switchTab, showNotificationModal } from "../dashboard/dashboard-ui.js";

export function initDOMListeners(auth, db) {
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
            
            if (auth.currentUser) {
                updateDoc(doc(db, "users", auth.currentUser.uid), { isOnline: false }).catch(() => {});
            }
            
            signOut(auth).catch((error) => alert("Đã xảy ra lỗi khi đăng xuất!"));
            return;
        }

        // ==========================================
        // ĐÃ SỬA: Lấy loại Gói (Tier) khi Xác nhận CK
        // ==========================================
        if (e.target.closest('#btnConfirmPayment')) {
            e.preventDefault(); e.stopPropagation();
            if (userDropdown) userDropdown.classList.remove('show');
            
            const btn = document.getElementById('btnConfirmPayment');
            if (btn && btn.disabled) return; 
            
            if (auth.currentUser) {
                // Đọc gói cước người dùng đang chọn trên giao diện
                let selectedTier = 'plus'; // Mặc định
                let selectedAmount = 30000;
                
                const checkedRadio = document.querySelector('input[name="packageSelect"]:checked');
                if (checkedRadio) {
                    selectedAmount = parseInt(checkedRadio.value);
                    if (selectedAmount === 50000) selectedTier = 'pro';
                }

                if (btn) {
                    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Chờ phê duyệt...';
                    btn.style.background = '#94a3b8';
                    btn.style.boxShadow = 'none';
                    btn.disabled = true;
                }
                
                const cancelBtn = document.getElementById('btnCancelPayment');
                if (cancelBtn) cancelBtn.style.display = 'block';

                setDoc(doc(db, "payment_requests", auth.currentUser.uid), { 
                    uid: auth.currentUser.uid, 
                    email: auth.currentUser.email, 
                    status: "pending", 
                    amount: selectedAmount,
                    requestedTier: selectedTier, // Push chữ 'plus' hoặc 'pro' lên Database
                    createdAt: serverTimestamp() 
                }).catch(() => alert("Lỗi kết nối máy chủ, vui lòng thử lại!"));
            }
            return;
        }

        if (e.target.closest('#btnCancelPayment')) {
            e.preventDefault(); e.stopPropagation();
            if (auth.currentUser) {
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

        // ==========================================
        // ĐÃ SỬA: XỬ LÝ NHẬP MÃ VOUCHER
        // ==========================================
        if (e.target.closest('#btnApplyVoucher')) {
            e.preventDefault();
            e.stopPropagation();
            
            const inputEl = document.getElementById('inputVoucherCode');
            const msgEl = document.getElementById('voucherMessage');
            const btn = e.target.closest('#btnApplyVoucher');
            const voucherCode = inputEl.value.trim().toUpperCase();

            if (!voucherCode) {
                msgEl.style.display = 'block';
                msgEl.style.color = '#ef4444';
                msgEl.innerText = "Vui lòng nhập mã voucher!";
                return;
            }

            if (!auth || !auth.currentUser) {
                alert("Vui lòng đăng nhập để sử dụng voucher!");
                return;
            }

            btn.disabled = true;
            btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Xử lý...';
            msgEl.style.display = 'none';

            (async () => {
                try {
                    const voucherRef = doc(db, "vouchers", voucherCode);
                    const voucherSnap = await getDoc(voucherRef);

                    if (!voucherSnap.exists()) throw new Error("Mã voucher không tồn tại!");

                    const vData = voucherSnap.data();
                    const now = Date.now();

                    if (!vData.isActive) throw new Error("Mã voucher này đã bị khóa!");
                    if (vData.startDate && now < vData.startDate) throw new Error("Mã voucher chưa đến thời gian sử dụng!");
                    if (vData.endDate && now > vData.endDate) throw new Error("Mã voucher đã hết hạn!");
                    if (vData.maxUses && vData.usedCount >= vData.maxUses) throw new Error("Mã voucher đã đạt giới hạn số lượt sử dụng!");
                    if (vData.usedBy && vData.usedBy.includes(auth.currentUser.uid)) throw new Error("Bạn đã sử dụng mã này rồi!");

                    const durationMs = (vData.durationDays || 30) * 24 * 60 * 60 * 1000;
                    const vipExpirationDate = now + durationMs;
                    
                    // Lấy loại gói từ Voucher (hoặc mặc định kích hoạt gói cơ bản là PLUS)
                    const grantTier = vData.tier || 'plus'; 

                    await updateDoc(doc(db, "users", auth.currentUser.uid), {
                        vipTier: grantTier, // Gán kiến trúc 3 cấp mới
                        vipActivationDate: now,
                        vipExpirationDate: vipExpirationDate,
                        // Lưu vết xóa sạch isVip cũ để tránh xung đột
                        isVip: null 
                    });

                    await updateDoc(voucherRef, {
                        usedCount: increment(1),
                        usedBy: arrayUnion(auth.currentUser.uid)
                    });

                    msgEl.style.display = 'block';
                    msgEl.style.color = '#10b981';
                    msgEl.innerText = `🎉 Kích hoạt gói ${grantTier.toUpperCase()} thành công! Đang tải lại hệ thống...`;
                    inputEl.value = '';
                    
                    setTimeout(() => window.location.reload(), 2000);

                } catch (error) {
                    msgEl.style.display = 'block';
                    msgEl.style.color = '#ef4444';
                    msgEl.innerText = error.message || "Lỗi xử lý, vui lòng thử lại!";
                } finally {
                    btn.disabled = false;
                    btn.innerHTML = 'Áp dụng';
                }
            })();
            return;
        }
    });
}
