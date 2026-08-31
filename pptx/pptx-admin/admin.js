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

document.addEventListener('DOMContentLoaded', () => {
    // Tạm thời bảo mật cơ bản: Phải đăng nhập mới dùng được Admin
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
});

function loadPptxData() {
    const tbody = document.getElementById('pptx-tbody');
    const q = query(collection(db, "pptx_lectures"), orderBy("createdAt", "asc"));
    
    onSnapshot(q, (snapshot) => {
        tbody.innerHTML = '';
        if (snapshot.empty) {
            tbody.innerHTML = '<tr><td colspan="3" style="text-align: center; color: #64748b;">Chưa có bài giảng nào.</td></tr>';
            return;
        }

        snapshot.forEach(docSnap => {
            const data = docSnap.data();
            const id = docSnap.id;

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td style="font-weight: 600; color: #1e293b;">${data.title}</td>
                <td class="link-cell">${data.embedUrl}</td>
                <td style="text-align: center;">
                    <button class="btn-action btn-edit" data-id="${id}" data-title="${data.title}" data-url="${data.embedUrl}"><i class="fa-solid fa-pen"></i></button>
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
    });
}

async function handleSavePptx() {
    const title = document.getElementById('pptx-title').value.trim();
    const url = document.getElementById('pptx-url').value.trim();

    if (!title || !url) {
        alert("Vui lòng nhập đầy đủ tên và link!");
        return;
    }

    try {
        if (editingId) {
            await updateDoc(doc(db, "pptx_lectures", editingId), { title: title, embedUrl: url });
        } else {
            await addDoc(collection(db, "pptx_lectures"), {
                title: title,
                embedUrl: url,
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
