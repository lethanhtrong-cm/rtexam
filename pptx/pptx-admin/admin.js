import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
// Thêm hàm getDocs để truy xuất danh sách bình luận
import { getFirestore, collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, serverTimestamp, query, orderBy, getDocs } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { getStorage, ref, uploadBytesResumable, getDownloadURL } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-storage.js";

const firebaseConfig = {
    apiKey: "AIzaSyDqdo_DJIWa5iqxiCgBq-0iGX7f9sr6soo",
    authDomain: "rt-examination.firebaseapp.com",
    projectId: "rt-examination",
    storageBucket: "rt-examination.firebasestorage.app",
    messagingSenderId: "920482699854",
    appId: "1:920482699854:web:44f9b0d735bdc001c6c11f",
    measurementId: "G-8N7RTTREQM"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

let editingId = null;
let currentAdminCategory = 'mri_pptx'; 
let allAdminPptx = []; 

document.addEventListener('DOMContentLoaded', () => {
    onAuthStateChanged(auth, (user) => {
        if (!user) {
            alert("Bạn cần đăng nhập bằng tài khoản Quản trị!");
            window.location.href = '../../dashboard.html';
        } else {
            loadPptxData();
        }
    });

    const btnSave = document.getElementById('btn-save');
    const btnCancel = document.getElementById('btn-cancel');

    btnSave.addEventListener('click', handleSavePptx);
    btnCancel.addEventListener('click', resetForm);

    document.querySelectorAll('.admin-menu-item').forEach(item => {
        item.addEventListener('click', (e) => {
            document.querySelectorAll('.admin-menu-item').forEach(el => el.classList.remove('active'));
            const target = e.currentTarget;
            target.classList.add('active');
            
            currentAdminCategory = target.getAttribute('data-cat');
            resetForm();
            renderAdminTable();
        });
    });

    // Sự kiện đóng Modal Bình luận
    document.getElementById('close-comments-modal').addEventListener('click', () => {
        document.getElementById('comments-modal').style.display = 'none';
    });
});

function loadPptxData() {
    const q = query(collection(db, "pptx_lectures"), orderBy("createdAt", "asc"));
    
    onSnapshot(q, (snapshot) => {
        allAdminPptx = [];
        snapshot.forEach(docSnap => {
            allAdminPptx.push({
                id: docSnap.id,
                ...docSnap.data()
            });
        });
        
        renderAdminTable(); 
    }, (error) => {
        console.error("Lỗi truy xuất Firestore:", error);
        document.getElementById('pptx-tbody').innerHTML = `<tr><td colspan="4" style="text-align: center; color: #ef4444; font-weight: 600;">Lỗi kết nối Database. Nhấn F12 xem chi tiết.</td></tr>`;
    });
}

function renderAdminTable() {
    const tbody = document.getElementById('pptx-tbody');
    tbody.innerHTML = '';
    
    const filteredData = allAdminPptx.filter(item => {
        const itemCat = item.category || 'mri';
        const normalizedCat = itemCat === 'mri' ? 'mri_pptx' : itemCat;
        return normalizedCat === currentAdminCategory;
    });

    if (filteredData.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" style="text-align: center; color: #64748b;">Chưa có bài giảng nào trong nhóm này.</td></tr>`;
        return;
    }

    filteredData.forEach(data => {
        const id = data.id;
        const safeTitle = data.title ? data.title.replace(/</g, "&lt;").replace(/>/g, "&gt;") : '';
        const safeUrl = data.embedUrl ? data.embedUrl.replace(/</g, "&lt;").replace(/>/g, "&gt;") : '';
        
        const itemCat = data.category || 'mri';
        const normalizedCat = itemCat === 'mri' ? 'mri_pptx' : itemCat;
        const viewCount = data.viewCount || 0;

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td style="font-weight: 600; color: #1e293b;">${safeTitle}</td>
            <td class="link-cell">${safeUrl}</td>
            <td style="text-align: center; font-weight: bold; color: #3b82f6;"><i class="fa-solid fa-eye"></i> ${viewCount}</td>
            <td style="text-align: center; white-space: nowrap;">
                <button class="btn-action btn-comment" data-id="${id}" data-title="${safeTitle}" title="Xem bình luận & đánh giá"><i class="fa-solid fa-comments"></i></button>
                <button class="btn-action btn-reset" data-id="${id}" title="Khôi phục lượt xem về 0"><i class="fa-solid fa-rotate-left"></i></button>
                <button class="btn-action btn-edit" data-id="${id}" data-title="${safeTitle}" data-url="${safeUrl}" data-category="${normalizedCat}" title="Sửa bài giảng"><i class="fa-solid fa-pen"></i></button>
                <button class="btn-action btn-delete" data-id="${id}" title="Xóa bài giảng"><i class="fa-solid fa-trash"></i></button>
            </td>
        `;
        tbody.appendChild(tr);
    });

    // Cài đặt sự kiện Xóa bài giảng
    document.querySelectorAll('.btn-delete').forEach(btn => {
        btn.onclick = async (e) => {
            const id = e.currentTarget.getAttribute('data-id');
            if (confirm('Xóa dữ liệu này khỏi hệ thống?')) {
                await deleteDoc(doc(db, "pptx_lectures", id));
            }
        }
    });

    // Cài đặt sự kiện Reset View
    document.querySelectorAll('.btn-reset').forEach(btn => {
        btn.onclick = async (e) => {
            const id = e.currentTarget.getAttribute('data-id');
            if (confirm('Bạn có chắc chắn muốn khôi phục số lượt xem của bài này về 0?')) {
                try {
                    await updateDoc(doc(db, "pptx_lectures", id), { viewCount: 0 });
                } catch (error) {
                    console.error("Lỗi reset lượt xem:", error);
                    alert("Lỗi khi reset: " + error.message);
                }
            }
        }
    });

    // Cài đặt sự kiện Sửa bài giảng
    document.querySelectorAll('.btn-edit').forEach(btn => {
        btn.onclick = (e) => {
            const target = e.currentTarget;
            editingId = target.getAttribute('data-id');
            document.getElementById('pptx-title').value = target.getAttribute('data-title');
            document.getElementById('pptx-url').value = target.getAttribute('data-url');
            document.getElementById('pptx-category').value = target.getAttribute('data-category');
            
            document.getElementById('btn-save').innerHTML = '<i class="fa-solid fa-check"></i> Cập nhật';
            document.getElementById('btn-cancel').style.display = 'inline-flex';
        }
    });

    // THÊM MỚI: Cài đặt sự kiện Xem Bình luận
    document.querySelectorAll('.btn-comment').forEach(btn => {
        btn.onclick = (e) => {
            const id = e.currentTarget.getAttribute('data-id');
            const title = e.currentTarget.getAttribute('data-title');
            openCommentsModal(id, title);
        }
    });
}

// THÊM MỚI: Hàm mở Modal và lấy danh sách bình luận
async function openCommentsModal(lectureId, lectureTitle) {
    document.getElementById('modal-lecture-title').innerText = lectureTitle;
    const listContainer = document.getElementById('modal-comments-list');
    listContainer.innerHTML = '<p style="text-align: center; color: #64748b;"><i class="fa-solid fa-spinner fa-spin"></i> Đang tải bình luận...</p>';
    document.getElementById('comments-modal').style.display = 'flex';

    try {
        const q = query(collection(db, `pptx_lectures/${lectureId}/comments`), orderBy("createdAt", "desc"));
        const querySnapshot = await getDocs(q);
        
        if (querySnapshot.empty) {
            listContainer.innerHTML = '<div style="text-align: center; color: #94a3b8; font-style: italic; padding: 20px;">Chưa có bình luận hoặc đánh giá nào cho bài này.</div>';
            return;
        }

        let html = '';
        querySnapshot.forEach((docSnap) => {
            const c = docSnap.data();
            
            // Format Thời gian
            let timeStr = '';
            if (c.createdAt) {
                const dateObj = c.createdAt.toDate();
                timeStr = dateObj.toLocaleDateString('vi-VN') + ' ' + dateObj.toLocaleTimeString('vi-VN', {hour: '2-digit', minute:'2-digit'});
            }
            
            // Render số sao
            let starsHtml = '';
            if (c.rating > 0) {
                for(let i=1; i<=5; i++) {
                    starsHtml += `<i class="fa-solid fa-star" style="color: ${i <= c.rating ? '#f59e0b' : '#cbd5e1'}"></i>`;
                }
            }

            html += `
                <div style="background: #f8fafc; padding: 15px; border-radius: 8px; border: 1px solid #e2e8f0; position: relative;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 5px;">
                        <strong style="color: #0f172a; font-size: 1.05rem;">${c.userName || 'Người dùng'}</strong>
                        <span style="font-size: 0.8rem; color: #94a3b8;"><i class="fa-regular fa-clock"></i> ${timeStr}</span>
                    </div>
                    ${starsHtml ? `<div style="font-size: 0.85rem; margin-bottom: 10px;">${starsHtml}</div>` : ''}
                    <div style="color: #334155; font-size: 0.95rem; white-space: pre-wrap; margin-bottom: 15px;">${c.text ? c.text.replace(/</g, "&lt;").replace(/>/g, "&gt;") : '<em style="color:#94a3b8;">(Chỉ để lại đánh giá sao, không có lời bình)</em>'}</div>
                    
                    <div style="text-align: right; border-top: 1px dashed #e2e8f0; padding-top: 10px;">
                        <button class="btn-delete-comment" data-lecture-id="${lectureId}" data-comment-id="${docSnap.id}" style="background: #ef4444; color: white; border: none; padding: 6px 12px; border-radius: 6px; cursor: pointer; font-size: 0.85rem; font-weight: bold; transition: 0.2s;"><i class="fa-solid fa-trash"></i> Xóa bình luận</button>
                    </div>
                </div>
            `;
        });
        listContainer.innerHTML = html;

        // Cài đặt sự kiện Xóa bình luận
        document.querySelectorAll('.btn-delete-comment').forEach(btn => {
            btn.onclick = async (e) => {
                if (confirm('Bạn có chắc chắn muốn XÓA VĨNH VIỄN bình luận này không?')) {
                    const lid = e.currentTarget.getAttribute('data-lecture-id');
                    const cid = e.currentTarget.getAttribute('data-comment-id');
                    try {
                        await deleteDoc(doc(db, `pptx_lectures/${lid}/comments`, cid));
                        e.currentTarget.closest('div').parentElement.remove();
                        if(listContainer.children.length === 0) {
                            listContainer.innerHTML = '<div style="text-align: center; color: #94a3b8; font-style: italic; padding: 20px;">Đã xóa toàn bộ bình luận.</div>';
                        }
                    } catch (error) {
                        console.error("Lỗi xóa bình luận:", error);
                        alert("Không thể xóa bình luận: " + error.message);
                    }
                }
            }
        });

    } catch (err) {
        console.error("Lỗi tải bình luận:", err);
        listContainer.innerHTML = '<p style="text-align: center; color: #ef4444;">Đã có lỗi xảy ra khi tải dữ liệu.</p>';
    }
}

async function handleSavePptx() {
    const title = document.getElementById('pptx-title').value.trim();
    let url = document.getElementById('pptx-url').value.trim();
    const fileInput = document.getElementById('video-upload');
    const selectedCategory = document.getElementById('pptx-category').value;
    const file = fileInput.files[0];

    if (!title) {
        alert("Vui lòng nhập tên bài giảng!");
        return;
    }
    
    if (!url && !file) {
        alert("Vui lòng dán Link nhúng hoặc chọn File Video tải lên!");
        return;
    }

    if (file) {
        const btnSave = document.getElementById('btn-save');
        const progressDiv = document.getElementById('upload-progress');
        btnSave.disabled = true;
        progressDiv.style.display = 'block';

        const storageRef = ref(storage, 'videos/' + Date.now() + '_' + file.name);
        const uploadTask = uploadBytesResumable(storageRef, file);

        uploadTask.on('state_changed',
            (snapshot) => {
                const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                progressDiv.innerText = 'Đang tải lên: ' + Math.floor(progress) + '%';
            },
            (error) => {
                console.error(error);
                alert("Lỗi tải video lên máy chủ: " + error.message);
                progressDiv.style.display = 'none';
                btnSave.disabled = false;
            },
            async () => {
                const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
                progressDiv.style.display = 'none';
                btnSave.disabled = false;
                await processSave(title, downloadURL, selectedCategory);
            }
        );
    } else {
        if (url.toLowerCase().includes('<iframe')) {
            const match = url.match(/src=["'](.*?)["']/);
            if (match && match[1]) {
                url = match[1];
            } else {
                alert("Không thể trích xuất link từ mã iframe bạn dán.");
                return;
            }
        }
        await processSave(title, url, selectedCategory);
    }
}

async function processSave(title, finalUrl, selectedCategory) {
    try {
        if (editingId) {
            await updateDoc(doc(db, "pptx_lectures", editingId), { 
                title: title, 
                embedUrl: finalUrl,
                category: selectedCategory 
            });
        } else {
            await addDoc(collection(db, "pptx_lectures"), {
                title: title,
                embedUrl: finalUrl,
                category: selectedCategory,
                viewCount: 0,
                createdAt: serverTimestamp()
            });
        }
        resetForm();
    } catch (err) {
        console.error("Lỗi lưu trữ:", err);
        alert("Đã xảy ra lỗi hệ thống: " + err.message);
    }
}

function resetForm() {
    editingId = null;
    document.getElementById('pptx-title').value = '';
    document.getElementById('pptx-url').value = '';
    document.getElementById('video-upload').value = '';
    document.getElementById('upload-progress').style.display = 'none';
    document.getElementById('btn-save').disabled = false;
    document.getElementById('btn-save').innerHTML = '<i class="fa-solid fa-cloud-arrow-up"></i> Lưu Dữ Liệu';
    document.getElementById('btn-cancel').style.display = 'none';
    
    document.getElementById('pptx-category').value = currentAdminCategory;
}
