// =========================================================================
// IMPORT TỪ MODULE FIREBASE & GIAO DIỆN CHUYÊN BIỆT
// =========================================================================
import { app, auth, db } from "./dashboard/firebase-core.js";
import { safeRedirect, formatDate, switchTab, showNotificationModal, renderAuthInfo, setVipInactive } from "./dashboard/dashboard-ui.js";

import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { doc, getDoc, setDoc, deleteDoc, addDoc, serverTimestamp, onSnapshot, collection, query, where, updateDoc, increment, getDocs, limit, writeBatch } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

export { app, auth, db, safeRedirect, formatDate, switchTab, initNotificationListener };

let isComponentsLoaded = false;
let currentUserInstance = null; 

document.addEventListener('ComponentsLoaded', () => {
    isComponentsLoaded = true;

    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const date = String(now.getDate()).padStart(2, '0');
    
    const dateKey = `day_${year}_${month}_${date}`;
    const monthKey = `month_${year}_${month}`;
    const yearKey = `year_${year}`;
    
    const startDate = new Date(now.getFullYear(), 0, 1);
    const days = Math.floor((now - startDate) / (24 * 60 * 60 * 1000));
    const weekNumber = Math.ceil((now.getDay() + 1 + days) / 7);
    const weekKey = `week_${year}_W${String(weekNumber).padStart(2, '0')}`;

    if (!sessionStorage.getItem('site_visited')) {
        sessionStorage.setItem('site_visited', 'true');
        
        setTimeout(() => {
            const updates = {
                totalVisits: increment(1),
                [dateKey]: increment(1),
                [weekKey]: increment(1),
                [monthKey]: increment(1),
                [yearKey]: increment(1)
            };
            setDoc(doc(db, "statistics", "global"), updates, { merge: true }).catch(() => {});
        }, 3000);
    }

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

        const roomModal = document.getElementById('room-options-modal');
        const btnCloseModal = document.getElementById('btnCloseRoomModal');
        const btnCreateNew = document.getElementById('btnSubmitCreateNewRoom');
        const btnJoin = document.getElementById('btnSubmitJoinRoom');
        const inputJoin = document.getElementById('inputJoinRoomCode');
        const errorMsg = document.getElementById('errorJoinRoom');

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
            roomModal.querySelector('div').style.transform = 'scale(1)';
        });

        const closeModal = () => {
            roomModal.querySelector('div').style.transform = 'scale(0.95)';
            setTimeout(() => roomModal.style.display = 'none', 150);
        };
        btnCloseModal.addEventListener('click', closeModal);
        roomModal.addEventListener('click', (e) => {
            if (e.target === roomModal) closeModal();
        });

        btnCreateNew.addEventListener('click', (e) => {
            e.preventDefault();

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
            
            document.body.insertAdjacentHTML('beforeend', popupHTML);

            const roleModal = document.getElementById('roleSelectionModal');
            const closeBtn = document.getElementById('closeRoleModalBtn');
            const btnProctor = document.getElementById('btnRoleProctor');
            const btnPlayer = document.getElementById('btnRolePlayer');

            btnProctor.onmouseover = () => btnProctor.style.transform = 'translateY(-3px)';
            btnProctor.onmouseout = () => btnProctor.style.transform = 'translateY(0)';
            btnPlayer.onmouseover = () => btnPlayer.style.transform = 'translateY(-3px)';
            btnPlayer.onmouseout = () => btnPlayer.style.transform = 'translateY(0)';

            const destroyModal = () => roleModal.remove();
            closeBtn.addEventListener('click', destroyModal);
            roleModal.addEventListener('click', (ev) => { if (ev.target === roleModal) destroyModal(); });

            const executeRoomCreation = async (role) => {
                destroyModal(); 
                
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
                        hostRole: role, 
                        status: 'waiting',
                        isLocked: false,
                        examId: null,   
                        examName: null,
                        createdAt: serverTimestamp()
                    });

                    if (newTab) newTab.location.href = targetUrl;
                    closeModal(); 
                    
                } catch (error) {
                    console.error("Lỗi Firestore:", error);
                    if (newTab) newTab.close();
                    alert("Không thể tạo phòng! Vui lòng kiểm tra mạng.");
                } finally {
                    btnCreateNew.innerHTML = originalText;
                    btnCreateNew.disabled = false;
                }
            };

            btnProctor.addEventListener('click', () => executeRoomCreation('proctor'));
            btnPlayer.addEventListener('click', () => executeRoomCreation('player'));
        });

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

    const btnRandomExam = document.getElementById('btnRandomExam');
    if (btnRandomExam) {
        btnRandomExam.addEventListener('click', (e) => {
            e.preventDefault();
            
            if (!auth.currentUser) {
                alert("Vui lòng đăng nhập để sử dụng tính năng tạo đề.");
                return;
            }

            const popupHTML = `
                <div class="custom-modal-overlay" id="randomExamModal" style="display: flex; z-index: 100000; background: rgba(15, 23, 42, 0.6); backdrop-filter: blur(4px); justify-content: center; align-items: center;">
                    <div class="custom-modal-content" style="width: 90%; max-width: 400px; background: white; border-radius: 12px; padding: 25px; animation: modalNotifFade 0.25s ease-out; box-shadow: 0 10px 25px rgba(0,0,0,0.2);">
                        <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #e2e8f0; padding-bottom: 15px; margin-bottom: 20px;">
                            <h3 style="margin: 0; font-size: 1.25rem; color: #0f172a;"><i class="fa-solid fa-dice" style="color: #ef4444;"></i> Tạo Đề Ngẫu Nhiên</h3>
                            <button id="closeRandomModalBtn" style="background: none; border: none; font-size: 1.2rem; cursor: pointer; color: #64748b; transition: 0.2s;"><i class="fa-solid fa-xmark"></i></button>
                        </div>
                        <div style="display: flex; flex-direction: column; gap: 15px;">
                            <div>
                                <label style="font-weight: 600; font-size: 0.9rem; color: #475569; display: block; margin-bottom: 8px;">Kỹ thuật hình ảnh:</label>
                                <select id="randTech" style="width: 100%; padding: 12px; border-radius: 8px; border: 1px solid #cbd5e1; outline: none; font-size: 0.95rem; color: #334155;">
                                    <option value="MRI">MRI</option>
                                    <option value="CT">CT Scanner</option>
                                    <option value="X quang">X quang</option>
                                    <option value="Thuốc tương phản">Thuốc tương phản</option>
                                </select>
                            </div>
                            <div>
                                <label style="font-weight: 600; font-size: 0.9rem; color: #475569; display: block; margin-bottom: 8px;">Mức độ khó:</label>
                                <select id="randLevel" style="width: 100%; padding: 12px; border-radius: 8px; border: 1px solid #cbd5e1; outline: none; font-size: 0.95rem; color: #334155;">
                                    <option value="Dễ">Dễ</option>
                                    <option value="Trung bình">Trung bình</option>
                                    <option value="Khó">Khó</option>
                                </select>
                            </div>
                            <div>
                                <label style="font-weight: 600; font-size: 0.9rem; color: #475569; display: block; margin-bottom: 8px;">Thời gian làm bài:</label>
                                <select id="randTime" style="width: 100%; padding: 12px; border-radius: 8px; border: 1px solid #cbd5e1; outline: none; font-size: 0.95rem; color: #334155;">
                                    <option value="15">15 phút (Bốc 15 câu)</option>
                                    <option value="30">30 phút (Bốc 30 câu)</option>
                                    <option value="45">45 phút (Bốc 45 câu)</option>
                                </select>
                            </div>
                            <button id="btnSubmitRandomExam" style="width: 100%; padding: 14px; background: linear-gradient(135deg, #ef4444, #b91c1c); color: white; border: none; border-radius: 8px; font-weight: bold; font-size: 1.05rem; cursor: pointer; margin-top: 10px; transition: 0.2s; box-shadow: 0 4px 10px rgba(239, 68, 68, 0.3);">
                                <i class="fa-solid fa-wand-magic-sparkles"></i> Khởi tạo & Vào thi
                            </button>
                        </div>
                    </div>
                </div>
            `;
            
            document.body.insertAdjacentHTML('beforeend', popupHTML);

            const modal = document.getElementById('randomExamModal');
            const closeBtn = document.getElementById('closeRandomModalBtn');
            
            const closeModal = () => modal.remove();
            closeBtn.addEventListener('click', closeModal);
            modal.addEventListener('click', (ev) => { if (ev.target === modal) closeModal(); });

            document.getElementById('btnSubmitRandomExam').addEventListener('click', async () => {
                const tech = document.getElementById('randTech').value;
                const level = document.getElementById('randLevel').value;
                const timeLimit = parseInt(document.getElementById('randTime').value);
                const btnSubmit = document.getElementById('btnSubmitRandomExam');

                btnSubmit.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Hệ thống đang xáo trộn...';
                btnSubmit.disabled = true;
                btnSubmit.style.opacity = '0.7';

                try {
                    const examsRef = collection(db, "exams");
                    const qExams = query(examsRef, where("technique", "==", tech), where("level", "==", level));
                    const examSnaps = await getDocs(qExams);

                    if (examSnaps.empty) {
                        alert(`Chưa có dữ liệu nào cho bộ môn ${tech} - Cấp độ ${level}.`);
                        btnSubmit.innerHTML = '<i class="fa-solid fa-wand-magic-sparkles"></i> Khởi tạo & Vào thi';
                        btnSubmit.disabled = false;
                        btnSubmit.style.opacity = '1';
                        return;
                    }

                    let examDocs = examSnaps.docs;
                    for (let i = examDocs.length - 1; i > 0; i--) {
                        const j = Math.floor(Math.random() * (i + 1));
                        [examDocs[i], examDocs[j]] = [examDocs[j], examDocs[i]];
                    }

                    let allQuestions = [];
                    for (let docSnap of examDocs) {
                        if (allQuestions.length >= timeLimit) break;
                        
                        const remainingNeeded = timeLimit - allQuestions.length;
                        const eId = docSnap.id;
                        const qQs = query(collection(db, "questions"), where("examId", "==", eId), limit(remainingNeeded));
                        const qsSnaps = await getDocs(qQs);
                        qsSnaps.forEach(q => allQuestions.push(q.data()));
                    }

                    if (allQuestions.length < timeLimit) {
                        alert(`Kho dữ liệu không đủ! (Hiện chỉ bốc được ${allQuestions.length}/${timeLimit} câu). Vui lòng giảm thời gian xuống.`);
                        btnSubmit.innerHTML = '<i class="fa-solid fa-wand-magic-sparkles"></i> Khởi tạo & Vào thi';
                        btnSubmit.disabled = false;
                        btnSubmit.style.opacity = '1';
                        return;
                    }

                    for (let i = allQuestions.length - 1; i > 0; i--) {
                        const j = Math.floor(Math.random() * (i + 1));
                        [allQuestions[i], allQuestions[j]] = [allQuestions[j], allQuestions[i]];
                    }
                    const selectedQuestions = allQuestions.slice(0, timeLimit);

                    const randomExamId = "RD-" + Math.floor(100000 + Math.random() * 900000);
                    const batch = writeBatch(db);
                    
                    const examRef = doc(db, "exams", randomExamId);
                    batch.set(examRef, {
                        examName: `Đề Ngẫu Nhiên: ${tech} (${level})`,
                        technique: "AI Tự Động", 
                        level: level,
                        timeLimit: timeLimit,
                        questionCount: timeLimit,
                        isVip: false,
                        createdAt: Date.now(),
                        authorEmail: auth.currentUser.email,
                    });

                    for (let i = 0; i < selectedQuestions.length; i++) {
                        let qData = selectedQuestions[i];
                        qData.examId = randomExamId;
                        qData.order = i;
                        const newQRef = doc(collection(db, "questions")); 
                        batch.set(newQRef, qData);
                    }
                    
                    await batch.commit();

                    closeModal();
                    safeRedirect(`quiz.html?examId=${randomExamId}`);

                } catch (error) {
                    console.error("Lỗi trộn đề: ", error);
                    alert("Có lỗi xảy ra do quyền truy cập hoặc kết nối mạng. Vui lòng thử lại!");
                    btnSubmit.innerHTML = '<i class="fa-solid fa-wand-magic-sparkles"></i> Khởi tạo & Vào thi';
                    btnSubmit.disabled = false;
                    btnSubmit.style.opacity = '1';
                }
            });
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

        if (e.target.closest('#btnConfirmPayment')) {
            e.preventDefault(); e.stopPropagation();
            if (userDropdown) userDropdown.classList.remove('show');
            
            const btn = document.getElementById('btnConfirmPayment');
            if (btn && btn.disabled) return; 
            
            if (auth.currentUser) {
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
                    amount: 20000, 
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
    });
}

function initNotificationListener(user) {
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

function initPaymentStatusListener(user) {
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
                        currentUserData.isVip = false;
                        setDoc(userDocRef, { isVip: false }, { merge: true }).catch(err => console.error(err));
                        setVipInactive();
                        resolve(currentUserData);
                        return; 
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
                            <div class="topbar-vip-badge" style="background: background: linear-gradient(135deg, #10b981, #059669); color: white; padding: 6px 14px; border-radius: 20px; font-weight: 700; font-size: 0.9rem; display: flex; align-items: center; gap: 6px; box-shadow: 0 2px 6px rgba(16, 185, 129, 0.3);">
                                <i class="fa-solid fa-gem"></i> PRO
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
                                title: "👑 Kích hoạt tài khoản PRO thành công",
                                message: "Cảm ơn bạn đã đồng hành cùng hệ thống. Tài khoản PRO đã được kích hoạt, mở khóa toàn bộ đề thi độc quyền và tiện ích giải thích chi tiết!",
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
                        
                        const successModal = document.getElementById('vipSuccessModalCustom');
                        const closeBtn = document.getElementById('closeVipSuccessBtn');
                        
                        const closeCustomModal = () => { if (successModal) successModal.remove(); };
                        closeBtn.addEventListener('click', closeCustomModal);
                        successModal.addEventListener('click', (e) => { if (e.target === successModal) closeCustomModal(); });
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
    initPaymentStatusListener(user); 
    
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

onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentUserInstance = user; 
        
        let currentOnlineStatus = null;
        const updateOnlineStatus = (status) => {
            if (currentOnlineStatus === status) return;
            currentOnlineStatus = status;
            updateDoc(doc(db, "users", user.uid), { isOnline: status }).catch(() => {});
        };

        updateOnlineStatus(true);
        
        window.addEventListener('beforeunload', () => updateOnlineStatus(false));
        document.addEventListener('freeze', () => updateOnlineStatus(false));
        window.addEventListener('offline', () => updateOnlineStatus(false));
        window.addEventListener('online', () => updateOnlineStatus(true));

        if (isComponentsLoaded) {
            executeAuthUI(user);
        }
    } else {
        safeRedirect('index.html');
    }
});
