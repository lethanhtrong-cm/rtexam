import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, serverTimestamp, query, orderBy } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// Cấu hình Firebase
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

let editingId = null;
let currentAdminCategory = 'mri'; // Trạng thái nhóm đang được chọn quản lý
let allAdminPptx = []; // Mảng chứa toàn bộ dữ liệu từ DB

document.addEventListener('DOMContentLoaded', () => {
    // Bảo mật cơ bản: Phải đăng nhập mới dùng được Admin
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

    // Gắn sự kiện click cho Sidebar Menu để đổi Nhóm
    document.querySelectorAll('.admin-menu-item').forEach(item => {
        item.addEventListener('click', (e) => {
            // Xóa active cũ, thêm active mới
            document.querySelectorAll('.admin-menu-item').forEach(el => el.classList.remove('active'));
            const target = e.currentTarget;
            target.classList.add('active');
            
            // Cập nhật trạng thái
            currentAdminCategory = target.getAttribute('data-cat');
            const catName = target.getAttribute('data-name');
            
            // Cập nhật UI
            document.getElementById('form-cat-badge').innerText = 'Nhóm: ' + catName;
            
            // Hủy sửa nếu đang sửa dở dang và render lại bảng
            resetForm();
            renderAdminTable();
        });
    });
});

// Load TOÀN BỘ dữ liệu từ DB (Realtime)
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
        
        renderAdminTable(); // Gọi hàm render để lọc dữ liệu theo Nhóm hiện tại
    });
}

// Render dữ liệu ra bảng dựa theo currentAdminCategory
function renderAdminTable() {
    const tbody = document.getElementById('pptx-tbody');
    tbody.innerHTML = '';
    
    // Lọc data theo category (nếu bài cũ không có category thì mặc định là 'mri' để bảo toàn)
    const filteredData = allAdminPptx.filter(item => {
        const itemCat = item.category || 'mri';
        return itemCat === currentAdminCategory;
    });

    if (filteredData.length === 0) {
        tbody.innerHTML = `<tr><td colspan="3" style="text-align: center; color: #64748b;">Chưa có bài giảng nào trong nhóm này.</td></tr>`;
        return;
    }

    filteredData.forEach(data => {
        const id = data.id;
        // Mã hóa thẻ HTML để chống render nhầm iframe ra bảng Admin
        const safeTitle = data.title ? data.title.replace(/</g, "&lt;").replace(/>/g, "&gt;") : '';
        const safeUrl = data.embedUrl ? data.embedUrl.replace(/</g, "&lt;").replace(/>/g, "&gt;") : '';

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td style="font-weight: 600; color: #1e293b;">${safeTitle}</td>
            <td class="link-cell">${safeUrl}</td>
            <td style="text-align: center;">
                <button class="btn-action btn-edit" data-id="${id}" data-title="${safeTitle}" data-url="${safeUrl}"><i class="fa-solid fa-pen"></i></button>
                <button class="btn-action btn-delete" data-id="${id}"><i class="fa-solid fa-trash"></i></button>
            </td>
        `;
        tbody.appendChild(tr);
    });

    // Gắn sự kiện Xóa
    document.querySelectorAll('.btn-delete').forEach(btn => {
        btn.onclick = async (e) => {
            const id = e.currentTarget.getAttribute('data-id');
            if (confirm('Xóa bài giảng này khỏi hệ thống?')) {
                await deleteDoc(doc(db, "pptx_lectures", id));
            }
        }
    });

    // Gắn sự kiện Sửa
    document.querySelectorAll('.btn-edit').forEach(btn => {
        btn.onclick = (e) => {
            const target = e.currentTarget;
            editingId = target.getAttribute('data-id');
            document.getElementById('pptx-title').value = target.getAttribute('data-title');
            document.getElementById('pptx-url').value = target.getAttribute('data-url');
            
            document.getElementById('btn-save').innerHTML = '<i class="fa-solid fa-check"></i> Cập nhật';
            document.getElementById('btn-cancel').style.display = 'inline-flex';
        }
    });
}

async function handleSavePptx() {
    const title = document.getElementById('pptx-title').value.trim();
    let url = document.getElementById('pptx-url').value.trim();

    if (!title || !url) {
        alert("Vui lòng nhập đầy đủ tên và link!");
        return;
    }

    // Trích xuất Link nếu dán nhầm toàn bộ thẻ <iframe>
    if (url.toLowerCase().includes('<iframe')) {
        const match = url.match(/src=["'](.*?)["']/);
        if (match && match[1]) {
            url = match[1]; // Bóc tách chính xác phần link bên trong thuộc tính src
        } else {
            alert("Không thể trích xuất link từ mã iframe bạn dán. Vui lòng chỉ copy phần đường dẫn bắt đầu bằng https://...");
            return;
        }
    }

    try {
        if (editingId) {
            // Khi cập nhật, lưu lại đè lên nhóm hiện tại để lỡ muốn chuyển nhóm cũng được
            await updateDoc(doc(db, "pptx_lectures", editingId), { 
                title: title, 
                embedUrl: url,
                category: currentAdminCategory 
            });
        } else {
            // Khi tạo mới, đính kèm category hiện tại
            await addDoc(collection(db, "pptx_lectures"), {
                title: title,
                embedUrl: url,
                category: currentAdminCategory,
                createdAt: serverTimestamp()
            });
        }
        resetForm();
    } catch (err) {
        console.error("Lỗi lưu trữ:", err);
        alert("Đã xảy ra lỗi hệ thống.");
    }
}

function resetForm() {
    editingId = null;
    document.getElementById('pptx-title').value = '';
    document.getElementById('pptx-url').value = '';
    document.getElementById('btn-save').innerHTML = '<i class="fa-solid fa-cloud-arrow-up"></i> Lưu Bài Giảng';
    document.getElementById('btn-cancel').style.display = 'none';
}
