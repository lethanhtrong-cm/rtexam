import { doc, getDoc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

export function initRoomModals(auth, db) {
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
}
