import { auth, db } from "./dashboard-core.js";
import { collection, query, where, onSnapshot, doc, updateDoc, orderBy } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// Khai báo mảng lưu trữ các ID thông báo chưa đọc
let unreadNotiIds = [];

// =========================================================================
// 1. GẮN SỰ KIỆN ĐÓNG MỞ CHUÔNG SAU KHI GIAO DIỆN SẴN SÀNG
// =========================================================================
document.addEventListener('ComponentsLoaded', () => {
    const bellToggle = document.getElementById('bellToggle');
    const notiDropdown = document.getElementById('notiDropdown');

    if (bellToggle && notiDropdown) {
        bellToggle.addEventListener('click', (e) => {
            e.stopPropagation();
            if (e.target.closest('.notification-dropdown')) return; 
            notiDropdown.classList.toggle('show');

            // TỰ ĐỘNG ĐÁNH DẤU "ĐÃ ĐỌC" KHI MỞ CHUÔNG THÔNG BÁO
            if (notiDropdown.classList.contains('show') && unreadNotiIds.length > 0) {
                unreadNotiIds.forEach(id => {
                    updateDoc(doc(db, 'notifications', id), { status: 'read' }).catch(err => console.error(err));
                });
                unreadNotiIds = []; // Làm rỗng mảng sau khi xử lý
                
                // Ẩn lập tức huy hiệu số màu đỏ trên UI
                const notiBadgeCount = document.getElementById('notiBadgeCount');
                if (notiBadgeCount) notiBadgeCount.style.display = 'none'; 
            }
        });

        document.addEventListener('click', (e) => {
            if (!bellToggle.contains(e.target) && !notiDropdown.contains(e.target)) {
                notiDropdown.classList.remove('show');
            }
        });
    }
});

// =========================================================================
// 2. LẮNG NGHE REAL-TIME KHI USER ĐĂNG NHẬP & KIỂM TRA NGƯỜI MỚI
// =========================================================================
document.addEventListener('authReady', (e) => {
    const user = e.detail ? e.detail.user : auth.currentUser;
    if (user && user.email) {
        initNotifications(user.email);
        checkAndShowWelcomeModal(user); // GỌI HÀM KIỂM TRA VÀ HIỂN THỊ CHÀO MỪNG
    }
});

// HÀM MỚI: Hiển thị thông báo chào mừng cho người dùng lần đầu
function checkAndShowWelcomeModal(user) {
    const welcomeKey = `hasSeenWelcome_${user.uid}`;
    
    if (!localStorage.getItem(welcomeKey)) {
        const welcomeHtml = `
            <div id="welcome-new-user-modal" style="position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(15, 23, 42, 0.75); z-index: 100000; display: flex; align-items: center; justify-content: center; backdrop-filter: blur(5px);">
                <div style="background: white; width: 90%; max-width: 450px; border-radius: 16px; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25); overflow: hidden; animation: welcomePopIn 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);">
                    <div style="background: linear-gradient(135deg, #0ea5e9 0%, #2563eb 100%); padding: 30px 20px; text-align: center; color: white;">
                        <i class="fa-solid fa-hands-clapping fa-bounce" style="font-size: 3.5rem; margin-bottom: 15px; color: #fde047;"></i>
                        <h2 style="margin: 0; font-size: 1.5rem; font-weight: 800; letter-spacing: 0.5px;">Chào mừng bạn mới!</h2>
                    </div>
                    <div style="padding: 30px; text-align: center; color: #334155; font-size: 1.05rem; line-height: 1.6;">
                        <p style="margin-bottom: 20px;">Cảm ơn bạn đã tham gia hệ thống trắc nghiệm <b>RT-quiz</b>. Chúng tôi đã chuẩn bị sẵn rất nhiều đề thi thú vị để giúp bạn nâng cao kiến thức.</p>
                        <p style="margin-bottom: 0;">Chúc bạn có những giờ phút học tập thật hiệu quả!</p>
                    </div>
                    <div style="padding: 20px 30px 30px; text-align: center;">
                        <button onclick="document.getElementById('welcome-new-user-modal').remove()" style="background: #2563eb; color: white; border: none; padding: 12px 35px; border-radius: 50px; font-weight: bold; font-size: 1.1rem; cursor: pointer; transition: 0.3s; box-shadow: 0 4px 14px rgba(37, 99, 235, 0.3);">
                            Bắt đầu ngay <i class="fa-solid fa-arrow-right ms-2"></i>
                        </button>
                    </div>
                </div>
            </div>
            <style>
                @keyframes welcomePopIn { 
                    0% { opacity: 0; transform: scale(0.8); } 
                    100% { opacity: 1; transform: scale(1); } 
                }
            </style>
        `;
        document.body.insertAdjacentHTML('beforeend', welcomeHtml);
        
        // Đánh dấu là đã xem để không hiện lại ở các lần F5 sau
        localStorage.setItem(welcomeKey, 'true');
    }
}

function initNotifications(userEmail) {
    const notiListContainer = document.getElementById('notiListContainer');
    const notiBadgeCount = document.getElementById('notiBadgeCount');

    if (!notiListContainer || !notiBadgeCount) return;

    const notiRef = collection(db, "notifications");
    
    // Lấy thông báo theo email người nhận, sắp xếp theo thời gian
    const q = query(
        notiRef, 
        where("toEmail", "==", userEmail),
        orderBy("timestamp", "desc")
    );

    onSnapshot(q, (snapshot) => {
        let unreadCount = 0;
        unreadNotiIds = []; // Reset mảng mỗi khi có dữ liệu mới
        notiListContainer.innerHTML = '';

        if (snapshot.empty) {
            notiListContainer.innerHTML = '<div class="noti-empty">Bạn chưa có thông báo nào.</div>';
            notiBadgeCount.style.display = 'none';
            return;
        }

        snapshot.forEach((docSnapshot) => {
            const data = docSnapshot.data();
            const id = docSnapshot.id;
            
            if (data.status === 'unread') {
                unreadCount++;
                unreadNotiIds.push(id); // Đưa ID chưa đọc vào mảng
            }

            let timeString = 'Vừa xong';
            if (data.timestamp) {
                const date = data.timestamp.toDate();
                timeString = date.toLocaleTimeString('vi-VN', {hour: '2-digit', minute:'2-digit'}) + ' ' + date.toLocaleDateString('vi-VN');
            }

            const itemClass = data.status === 'unread' ? 'noti-item unread' : 'noti-item';
            
            // XỬ LÝ NỘI DUNG VÀ ICON TÙY THEO LOẠI THÔNG BÁO
            let iconHtml = '';
            let textHtml = '';

            if (data.type === 'admin_reply') {
                iconHtml = '<i class="fa-solid fa-comment-dots" style="color: #3b82f6;"></i>';
                textHtml = `<b>Admin</b> đã phản hồi báo cáo lỗi câu hỏi của bạn.`;
            } else if (data.type === 'system_broadcast' || data.type === 'admin_direct') {
                // XỬ LÝ THÔNG BÁO MỚI TỪ TRANG ADMIN (HỆ THỐNG / CÁ NHÂN)
                const iconColor = data.type === 'system_broadcast' ? '#8b5cf6' : '#f59e0b';
                const iconClass = data.type === 'system_broadcast' ? 'fa-bullhorn' : 'fa-bell';
                iconHtml = `<i class="fa-solid ${iconClass}" style="color: ${iconColor};"></i>`;
                textHtml = `<b>${data.title || 'Thông báo từ Hệ thống'}</b><br><span style="font-size: 0.9em; opacity: 0.8;">${data.message || ''}</span>`;
            } else if (data.type === 'room_invite') {
                iconHtml = '<i class="fa-solid fa-envelope-open-text" style="color: #10b981;"></i>';
                textHtml = data.message || `<b>${data.fromEmail}</b> đã mời bạn vào phòng.`;
            } else {
                iconHtml = '<i class="fa-solid fa-share-nodes"></i>';
                textHtml = data.message || `<b>${data.fromEmail}</b> đã chia sẻ đề thi <b>${data.examId}</b> với bạn.`;
            }

            const html = `
                <div class="${itemClass}" data-id="${id}" style="cursor: pointer; transition: background 0.2s;">
                    <div class="noti-icon">
                        ${iconHtml}
                    </div>
                    <div class="noti-content">
                        <div class="noti-text" style="line-height: 1.4;">
                            ${textHtml}
                        </div>
                        <div class="noti-time">${timeString}</div>
                    </div>
                </div>
            `;
            notiListContainer.insertAdjacentHTML('beforeend', html);
        });

        // Cập nhật số đếm chuông
        if (unreadCount > 0) {
            notiBadgeCount.textContent = unreadCount > 99 ? '99+' : unreadCount;
            notiBadgeCount.style.display = 'block';
        } else {
            notiBadgeCount.style.display = 'none';
        }

        // ===================================================================
        // XỬ LÝ SỰ KIỆN CLICK THÔNG BÁO (Tích hợp logic Admin Reply)
        // ===================================================================
        document.querySelectorAll('.noti-item').forEach(item => {
            item.addEventListener('click', async () => {
                const notiId = item.getAttribute('data-id');
                // Lấy toàn bộ data gốc từ snapshot (Tuyệt đối an toàn không lo escape HTML)
                const notiDataDoc = snapshot.docs.find(d => d.id === notiId);
                const notiData = notiDataDoc ? notiDataDoc.data() : null;

                // 1. Cập nhật trạng thái thành đã đọc (chung cho mọi loại thông báo)
                if (item.classList.contains('unread')) {
                    try {
                        const docRef = doc(db, 'notifications', notiId);
                        await updateDoc(docRef, { status: 'read' });
                    } catch (error) {
                        console.error("Lỗi cập nhật thông báo:", error);
                    }
                }

                // 2. Phân loại chuyển hướng hoặc hiển thị Popup
                if (notiData) {
                    if (notiData.type === 'admin_reply') {
                        // Gọi hàm hiển thị Modal phản hồi từ Admin
                        window.openAdminReplyModal(notiData.adminMessage);
                    } 
                    else if (notiData.type === 'system_broadcast' || notiData.type === 'admin_direct') {
                        // Gọi hàm hiển thị Modal nội dung thông báo chung
                        const displayMsg = `[${notiData.title}]\n\n${notiData.message}`;
                        window.openAdminReplyModal(displayMsg);
                    }
                    else if (notiData.type === 'room_invite' || notiData.roomId) {
                        // HIỂN THỊ POPUP THAY VÌ CHUYỂN TRANG TRỰC TIẾP
                        window.openShareInviteModal(notiData, 'room');
                    } 
                    else if (notiData.examId) {
                        // HIỂN THỊ POPUP THAY VÌ CHUYỂN TRANG TRỰC TIẾP
                        window.openShareInviteModal(notiData, 'exam');
                    }
                }
            });
        });
    }, (error) => {
        console.error("Lỗi khi lắng nghe thông báo Realtime:", error);
    });
}

// =========================================================================
// 3. HÀM TOÀN CỤC: MỞ MODAL ĐỌC PHẢN HỒI / THÔNG BÁO CỦA ADMIN
// =========================================================================
window.openAdminReplyModal = function(message) {
    const modal = document.getElementById('user-admin-reply-modal');
    const msgContainer = document.getElementById('user-admin-message');
    
    if (modal && msgContainer) {
        let safeMsg = message || "Không có nội dung.";
        
        // 1. Lọc an toàn XSS cơ bản (Do ta sẽ chuyển sang dùng innerHTML)
        safeMsg = safeMsg.replace(/</g, "&lt;").replace(/>/g, "&gt;");
        
        // 2. Regex nhận diện đường link (http, https) và bọc thẻ <a>
        const urlRegex = /(https?:\/\/[^\s]+)/g;
        safeMsg = safeMsg.replace(urlRegex, '<a href="$1" target="_blank" style="color: #2563eb; text-decoration: underline; word-break: break-all;">$1</a>');
        
        // 3. Giữ nguyên định dạng xuống dòng
        safeMsg = safeMsg.replace(/\n/g, '<br>');
        
        msgContainer.innerHTML = safeMsg;
        modal.style.display = 'block';
    } else {
        console.error("Không tìm thấy HTML của Modal hiển thị thông báo.");
        alert("Thông báo hệ thống:\n\n" + message);
    }
}

// =========================================================================
// 4. HÀM TOÀN CỤC: MỞ MODAL XÁC NHẬN LỜI MỜI VÀO PHÒNG / CHIA SẺ ĐỀ THI
// =========================================================================
window.openShareInviteModal = function(notiData, type) {
    // Xóa modal cũ nếu đang tồn tại để tránh trùng lặp
    const existingModal = document.getElementById('dynamic-invite-modal');
    if (existingModal) existingModal.remove();

    // Xác định tiêu đề, nội dung và link đích dựa vào loại thông báo
    const title = type === 'room' ? 'Lời mời tham gia phòng thi' : 'Chia sẻ đề thi';
    const detailText = notiData.message || (type === 'room' ? `Bạn nhận được lời mời tham gia phòng thi: <b>${notiData.roomId}</b>` : `Bạn được chia sẻ đề thi mã: <b>${notiData.examId}</b>`);
    const targetUrl = type === 'room' ? `lobby.html?roomId=${notiData.roomId}` : `quiz.html?examId=${notiData.examId}`;
    const iconClass = type === 'room' ? 'fa-people-roof' : 'fa-file-lines';

    // Tạo HTML Modal động
    const modalHtml = `
        <div id="dynamic-invite-modal" style="position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(15, 23, 42, 0.6); z-index: 100000; display: flex; align-items: center; justify-content: center; backdrop-filter: blur(4px);">
            <div style="background: white; width: 90%; max-width: 420px; border-radius: 12px; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1); overflow: hidden; animation: inviteFadeIn 0.2s ease-out;">
                
                <div style="padding: 16px 20px; border-bottom: 1px solid #e2e8f0; font-weight: 700; font-size: 1.1rem; color: #0f172a; display: flex; justify-content: space-between; align-items: center; background: #f8fafc;">
                    <span style="display: flex; align-items: center; gap: 8px;">
                        <i class="fa-solid ${iconClass}" style="color: #084298;"></i> ${title}
                    </span>
                    <i class="fa-solid fa-xmark" style="cursor: pointer; color: #64748b; font-size: 1.2rem;" onclick="document.getElementById('dynamic-invite-modal').remove()"></i>
                </div>
                
                <div style="padding: 24px; color: #475569; font-size: 1rem; line-height: 1.5; text-align: center;">
                    ${detailText}
                </div>
                
                <div style="padding: 16px 20px; border-top: 1px solid #e2e8f0; background: #f8fafc; display: flex; justify-content: flex-end; gap: 12px;">
                    <button onclick="document.getElementById('dynamic-invite-modal').remove()" style="padding: 8px 20px; background: #e2e8f0; border: none; border-radius: 6px; cursor: pointer; font-weight: 600; color: #334155; transition: 0.2s;">Hủy</button>
                    <button onclick="window.location.href='${targetUrl}'" style="padding: 8px 20px; background: #084298; border: none; border-radius: 6px; cursor: pointer; font-weight: 600; color: white; transition: 0.2s; box-shadow: 0 4px 6px rgba(8,66,152,0.2);">Vào thi ngay</button>
                </div>
                
            </div>
        </div>
        <style>
            @keyframes inviteFadeIn { 
                from { opacity: 0; transform: scale(0.95) translateY(10px); } 
                to { opacity: 1; transform: scale(1) translateY(0); } 
            }
        </style>
    `;
    
    // Gắn Modal vào Body
    document.body.insertAdjacentHTML('beforeend', modalHtml);
}
