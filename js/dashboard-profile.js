import { auth, db } from "./dashboard-core.js";
import { updateProfile, updatePassword } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { doc, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// =========================================================================
// HÀM XỬ LÝ NÉN ẢNH VÀ CHUYỂN ĐỔI SANG BASE64
// =========================================================================
function resizeImageToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file); 
        
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target.result;
            
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const MAX_WIDTH = 200;
                const MAX_HEIGHT = 200;
                let width = img.width;
                let height = img.height;

                if (width > height) {
                    if (width > MAX_WIDTH) { height *= MAX_WIDTH / width; width = MAX_WIDTH; }
                } else {
                    if (height > MAX_HEIGHT) { width *= MAX_HEIGHT / height; height = MAX_HEIGHT; }
                }

                canvas.width = width; canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                resolve(canvas.toDataURL('image/jpeg', 0.7));
            };
            img.onerror = (error) => reject(error);
        };
        reader.onerror = (error) => reject(error);
    });
}

// =========================================================================
// HÀM ĐỒNG BỘ DỮ LIỆU LÊN TAB PROFILE (Quét toàn bộ cấu trúc dữ liệu)
// =========================================================================
async function syncProfileUI() {
    const user = auth.currentUser;
    if (!user) return;
    
    const profileTabName = document.getElementById("profileTabName");
    const profileTabEmail = document.getElementById("profileTabEmail");
    const profileTabAvatar = document.getElementById("profileTabAvatar");
    
    if (profileTabName) profileTabName.textContent = user.displayName || "Chưa cập nhật";
    if (profileTabEmail) profileTabEmail.textContent = user.email || "Không có email";
    
    if (profileTabAvatar) {
        try {
            const userDocRef = doc(db, "users", user.uid);
            const docSnap = await getDoc(userDocRef);
            
            let finalAvatarUrl = null;

            // 1. Quét tìm ảnh trong Firestore (Hỗ trợ nhiều tên biến dự phòng)
            if (docSnap.exists()) {
                const data = docSnap.data();
                finalAvatarUrl = data.avatarBase64 || data.avatar || data.photoURL;
            }

            // 2. Nếu Firestore không có, quét tiếp trong Firebase Auth gốc
            if (!finalAvatarUrl && user.photoURL) {
                finalAvatarUrl = user.photoURL;
            }

            // 3. Render ảnh ra giao diện
            if (finalAvatarUrl) {
                profileTabAvatar.src = finalAvatarUrl;
            } else {
                const name = user.displayName ? encodeURIComponent(user.displayName) : 'User';
                profileTabAvatar.src = `https://ui-avatars.com/api/?name=${name}&background=0056b3&color=fff`;
            }
        } catch (error) {
            console.error("Lỗi khi tải ảnh đại diện từ hệ thống:", error);
        }
    }
}

// Lắng nghe khi Auth sẵn sàng
document.addEventListener('authReady', syncProfileUI);

// =========================================================================
// KHỞI TẠO DOM & SỰ KIỆN KHI UI ĐÃ SẴN SÀNG
// =========================================================================
document.addEventListener('ComponentsLoaded', () => {
    
    if (auth.currentUser) {
        syncProfileUI();
    }

    const updateProfileForm = document.getElementById("updateProfileForm");
    const btnUpdateProfile = document.getElementById("btnUpdateProfile");
    const inputName = document.getElementById("inputName");
    const inputAvatarFile = document.getElementById("inputAvatarFile");
    
    // Các ID bên Topbar
    const displayName = document.getElementById("displayName");
    const topbarName = document.getElementById("topbarName");
    const userAvatar = document.getElementById("userAvatar");
    const topbarAvatar = document.getElementById("topbarAvatar");

    // Các ID bên tab Hồ Sơ
    const profileTabName = document.getElementById("profileTabName");
    const profileTabAvatar = document.getElementById("profileTabAvatar");

    const changePasswordForm = document.getElementById("changePasswordForm");
    const inputNewPassword = document.getElementById("inputNewPassword");
    const btnChangePassword = document.getElementById("btnChangePassword");

    if (updateProfileForm) {
        updateProfileForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            btnUpdateProfile.textContent = "Đang lưu...";
            btnUpdateProfile.disabled = true;

            const newName = inputName.value.trim();
            let newBase64Avatar = null;

            try {
                // Cập nhật tên vào Firebase Auth gốc
                await updateProfile(auth.currentUser, { displayName: newName });
                
                // Nếu có upload file ảnh
                if (inputAvatarFile.files.length > 0) {
                    const file = inputAvatarFile.files[0];
                    newBase64Avatar = await resizeImageToBase64(file);
                    
                    const userDocRef = doc(db, "users", auth.currentUser.uid);
                    // Cập nhật vào Firestore (Lưu cả 2 trường để dự phòng đồng bộ cho topbar)
                    await setDoc(userDocRef, { 
                        avatarBase64: newBase64Avatar,
                        avatar: newBase64Avatar 
                    }, { merge: true });
                }

                alert("Cập nhật hồ sơ thành công!");
                
                // Đồng bộ tên ra UI lập tức
                if (displayName) displayName.textContent = newName;
                if (topbarName) topbarName.textContent = newName; 
                if (profileTabName) profileTabName.textContent = newName;

                // Đồng bộ ảnh ra UI lập tức
                if (newBase64Avatar) {
                    if (userAvatar) userAvatar.src = newBase64Avatar;
                    if (topbarAvatar) topbarAvatar.src = newBase64Avatar; 
                    if (profileTabAvatar) profileTabAvatar.src = newBase64Avatar;
                }
                
                inputAvatarFile.value = ""; 
            } catch (error) {
                console.error("Lỗi cập nhật hồ sơ cá nhân:", error);
                alert("Đã xảy ra lỗi: " + error.message);
            } finally {
                btnUpdateProfile.textContent = "Lưu thay đổi";
                btnUpdateProfile.disabled = false;
            }
        });
    }

    if (changePasswordForm) {
        changePasswordForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const newPassword = inputNewPassword.value;
            
            btnChangePassword.textContent = "Đang xử lý...";
            btnChangePassword.disabled = true;

            try {
                await updatePassword(auth.currentUser, newPassword);
                alert("Đổi mật khẩu thành công!");
                inputNewPassword.value = ""; 
            } catch (error) {
                console.error("Lỗi đổi mật khẩu:", error);
                if (error.code === 'auth/requires-recent-login') {
                    alert("Vì lý do bảo mật, phiên đăng nhập đã hết hạn. Vui lòng Đăng xuất và Đăng nhập lại để thực hiện đổi mật khẩu.");
                } else {
                    alert("Lỗi hệ thống: " + error.message);
                }
            } finally {
                btnChangePassword.textContent = "Cập nhật mật khẩu";
                btnChangePassword.disabled = false;
            }
        });
    }
});
