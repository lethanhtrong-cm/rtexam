import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
// THÊM MỚI setDoc để lưu cấu hình cây
import { getFirestore, collection, addDoc, updateDoc, deleteDoc, doc, setDoc, onSnapshot, serverTimestamp, query, orderBy, getDocs } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
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
let currentAdminCategory = null; 
let allAdminPptx = []; 

let draggedRow = null;
let isReordering = false;

// Dữ liệu mảng cây thư mục toàn cục của Admin
let adminCategoryTree = [];

document.addEventListener('DOMContentLoaded', () => {
    onAuthStateChanged(auth, (user) => {
        if (!user) {
            alert("Bạn cần đăng nhập bằng tài khoản Quản trị!");
            window.location.href = '../../dashboard.html';
        } else {
            // Khởi tạo Lắng nghe Cây cấu hình từ DB
            listenToCategoryTree();
            loadPptxData();
        }
    });

    const btnSave = document.getElementById('btn-save');
    const btnCancel = document.getElementById('btn-cancel');

    btnSave.addEventListener('click', handleSavePptx);
    btnCancel.addEventListener('click', resetForm);

    document.getElementById('close-comments-modal').addEventListener('click', () => {
        document.getElementById('comments-modal').style.display = 'none';
        renderAdminTable(); 
    });

    // Sự kiện Lưu Cây cấu hình
    document.getElementById('btn-save-tree').addEventListener('click', async () => {
        try {
            document.getElementById('btn-save-tree').innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Đang lưu...';
            await setDoc(doc(db, "settings", "category_tree"), { tree: adminCategoryTree });
            alert("Đã lưu cấu hình cây thư mục thành công! (Thay đổi sẽ lập tức hiển thị trên trang User)");
            document.getElementById('tree-modal').style.display = 'none';
        } catch(e) {
            console.error(e);
            alert("Lỗi khi lưu cấu hình!");
        } finally {
            document.getElementById('btn-save-tree').innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Lưu & Áp Dụng Ngay';
        }
    });

    document.getElementById('close-tree-modal').addEventListener('click', () => {
        document.getElementById('tree-modal').style.display = 'none';
    });
});

function listenToCategoryTree() {
    onSnapshot(doc(db, "settings", "category_tree"), (docSnap) => {
        if(docSnap.exists() && docSnap.data().tree) {
            adminCategoryTree = docSnap.data().tree;
        } else {
            adminCategoryTree = [];
        }
        
        if (!currentAdminCategory && adminCategoryTree.length > 0) {
            // Tự động gán category mặc định nếu chưa chọn
            const firstCat = adminCategoryTree[0];
            currentAdminCategory = (firstCat.children && firstCat.children.length > 0) ? firstCat.children[0].id : firstCat.id;
        }

        updateCategorySelectOptions();
        renderAdminTable(); 
    });
}

// Render Select Option và Sidebar từ Mảng Tree
function updateCategorySelectOptions() {
    const select = document.getElementById('pptx-category');
    const sidebar = document.getElementById('dynamic-admin-sidebar');
    
    select.innerHTML = '';
    let sidebarHtml = `<h3>Danh mục quản lý</h3>`;
    sidebarHtml += `<button id="btn-config-tree" style="margin: 0 20px 15px; padding: 10px; background: #8b5cf6; color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: bold;"><i class="fa-solid fa-sitemap"></i> Cấu Hình Menu (User)</button>`;

    adminCategoryTree.forEach((cat) => {
         sidebarHtml += `<div class="admin-menu-parent"><i class="fa-solid ${cat.icon}" style="color: ${cat.color}; width: 16px; text-align: center;"></i> ${cat.name}</div>`;
         
         if(cat.children && cat.children.length > 0) {
             cat.children.forEach(child => {
                 select.innerHTML += `<option value="${child.id}">${cat.name} - ${child.name}</option>`;
                 const isActive = currentAdminCategory === child.id ? 'active' : '';
                 sidebarHtml += `<div class="admin-menu-item ${isActive}" data-cat="${child.id}"><i class="fa-solid ${child.icon}"></i> ${child.name}</div>`;
             });
         } else {
             select.innerHTML += `<option value="${cat.id}">${cat.name}</option>`;
             const isActive = currentAdminCategory === cat.id ? 'active' : '';
             sidebarHtml += `<div class="admin-menu-item ${isActive}" data-cat="${cat.id}"><i class="fa-solid ${cat.icon}"></i> ${cat.name}</div>`;
         }
    });
    sidebar.innerHTML = sidebarHtml;
    
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

    document.getElementById('btn-config-tree').addEventListener('click', () => {
        renderTreeEditor();
        document.getElementById('tree-modal').style.display = 'flex';
    });
}

// CÁC HÀM XỬ LÝ EDITOR (Treo vào cửa sổ Window để onClick HTML gọi được)
window.renderTreeEditor = function() {
    const container = document.getElementById('tree-editor-container');
    let html = '';
    adminCategoryTree.forEach((cat, i) => {
        html += `
        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 15px; margin-bottom: 15px;">
            <div style="display: flex; gap: 10px; margin-bottom: 10px;">
                <input type="text" value="${cat.name}" placeholder="Tên chuyên khoa" style="flex: 1; padding: 8px; border: 1px solid #cbd5e1; border-radius: 6px;" onchange="updateTreeData(${i}, null, 'name', this.value)">
                <input type="text" value="${cat.id}" placeholder="Mã ID (vd: mri)" style="width: 120px; padding: 8px; border: 1px solid #cbd5e1; border-radius: 6px;" onchange="updateTreeData(${i}, null, 'id', this.value)">
                <input type="text" value="${cat.icon}" placeholder="Icon (vd: fa-magnet)" style="width: 140px; padding: 8px; border: 1px solid #cbd5e1; border-radius: 6px;" onchange="updateTreeData(${i}, null, 'icon', this.value)">
                <button class="btn-cancel" style="display:inline-flex;" onclick="removeTreeCat(${i})" title="Xóa chuyên khoa"><i class="fa-solid fa-trash"></i></button>
            </div>
            <div style="padding-left: 30px; border-left: 2px dashed #cbd5e1; display: flex; flex-direction: column; gap: 8px;">
        `;
        if (cat.children && cat.children.length > 0) {
            cat.children.forEach((child, j) => {
                html += `
                <div style="display: flex; gap: 10px; position: relative; align-items: center;">
                    <span style="position: absolute; left: -30px; top: 15px; width: 20px; height: 2px; background: #cbd5e1;"></span>
                    <input type="text" value="${child.name}" placeholder="Tên nhánh con" style="flex: 1; padding: 6px; border: 1px solid #cbd5e1; border-radius: 6px;" onchange="updateTreeData(${i}, ${j}, 'name', this.value)">
                    <input type="text" value="${child.id}" placeholder="Mã ID nhánh (vd: mri_video)" style="width: 150px; padding: 6px; border: 1px solid #cbd5e1; border-radius: 6px;" onchange="updateTreeData(${i}, ${j}, 'id', this.value)">
                    <input type="text" value="${child.icon}" placeholder="Icon (fa-circle-play)" style="width: 140px; padding: 6px; border: 1px solid #cbd5e1; border-radius: 6px;" onchange="updateTreeData(${i}, ${j}, 'icon', this.value)">
                    <button class="btn-cancel" style="display:inline-flex; padding: 6px 12px;" onclick="removeTreeChild(${i}, ${j})"><i class="fa-solid fa-xmark"></i></button>
                </div>`;
            });
        }
        html += `
                <button onclick="addTreeChild(${i})" style="margin-top: 5px; align-self: flex-start; padding: 6px 12px; background: #3b82f6; color: white; border: none; border-radius: 6px; cursor: pointer;">+ Thêm nhánh con</button>
            </div>
        </div>`;
    });
    container.innerHTML = html;
};

window.updateTreeData = (i, j, key, val) => {
    if (j === null) adminCategoryTree[i][key] = val;
    else adminCategoryTree[i].children[j][key] = val;
};
window.removeTreeCat = (i) => {
    if(confirm('Bạn có chắc muốn xóa toàn bộ chuyên khoa này khỏi Menu? (Không làm mất dữ liệu bài giảng cũ)')) {
        adminCategoryTree.splice(i, 1); 
        window.renderTreeEditor();
    }
};
window.removeTreeChild = (i, j) => {
    adminCategoryTree[i].children.splice(j, 1); 
    window.renderTreeEditor();
};
window.addTreeChild = (i) => { 
    if(!adminCategoryTree[i].children) adminCategoryTree[i].children = [];
    adminCategoryTree[i].children.push({id: `sub_${Date.now()}`, name: 'Nhánh mới', icon: 'fa-circle-play'});
    window.renderTreeEditor();
};
window.addMainCat = () => {
    adminCategoryTree.push({id: `main_${Date.now()}`, name: 'Chuyên khoa mới', icon: 'fa-folder', color: '#3b82f6', bg: '#eff6ff', desc: 'Mô tả chuyên khoa', children: []});
    window.renderTreeEditor();
};

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
        
        allAdminPptx.sort((a, b) => {
            const orderA = a.order !== undefined ? a.order : 999999;
            const orderB = b.order !== undefined ? b.order : 999999;
            if (orderA === orderB) {
                return (a.createdAt?.seconds || 0) - (b.createdAt?.seconds || 0);
            }
            return orderA - orderB;
        });

        if (!isReordering) {
            renderAdminTable(); 
        }
    }, (error) => {
        console.error("Lỗi truy xuất Firestore:", error);
    });
}

async function fetchLectureStatsForTable(lectureId) {
    try {
        const q = query(collection(db, `pptx_lectures/${lectureId}/comments`));
        const snap = await getDocs(q);
        const count = snap.size;
        
        let totalRate = 0;
        let rateCount = 0;
        snap.forEach(doc => {
            const data = doc.data();
            if (data.rating) {
                totalRate += data.rating;
                rateCount++;
            }
        });
        
        const avg = rateCount > 0 ? (totalRate / rateCount).toFixed(1) : 0;
        const col = document.getElementById(`rating-col-${lectureId}`);
        
        if (col) {
            if (count > 0) {
                col.innerHTML = `
                    <div style="color: #f59e0b; font-weight: bold;"><i class="fa-solid fa-star"></i> ${avg}</div>
                    <div style="font-size: 0.8rem; color: #64748b; font-weight: 500;">(${count} bình luận)</div>
                `;
            } else {
                col.innerHTML = `<div style="font-size: 0.85rem; color: #cbd5e1; font-weight: 500;">Chưa có</div>`;
            }
        }
    } catch (e) {}
}

function renderAdminTable() {
    const tbody = document.getElementById('pptx-tbody');
    tbody.innerHTML = '';
    
    if(!currentAdminCategory) return;

    const filteredData = allAdminPptx.filter(item => item.category === currentAdminCategory);

    if (filteredData.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: #64748b;">Chưa có bài giảng nào trong nhóm này.</td></tr>`;
        return;
    }

    filteredData.forEach(data => {
        const id = data.id;
        const safeTitle = data.title ? data.title.replace(/</g, "&lt;").replace(/>/g, "&gt;") : '';
        const safeUrl = data.embedUrl ? data.embedUrl.replace(/</g, "&lt;").replace(/>/g, "&gt;") : '';
        const viewCount = data.viewCount || 0;

        const tr = document.createElement('tr');
        
        tr.setAttribute('draggable', 'true');
        tr.setAttribute('data-id', id);
        tr.style.transition = 'background-color 0.2s';
        
        tr.innerHTML = `
            <td style="font-weight: 600; color: #1e293b;">
                <div style="display: flex; align-items: center; gap: 12px; cursor: grab;" title="Kéo thả để đổi vị trí">
                    <i class="fa-solid fa-grip-vertical" style="color: #94a3b8; font-size: 1.1rem;"></i>
                    <span>${safeTitle}</span>
                </div>
            </td>
            <td class="link-cell">${safeUrl}</td>
            <td style="text-align: center; font-weight: bold; color: #3b82f6;"><i class="fa-solid fa-eye"></i> ${viewCount}</td>
            <td style="text-align: center;" id="rating-col-${id}">
                <i class="fa-solid fa-spinner fa-spin" style="color: #cbd5e1;"></i>
            </td>
            <td style="text-align: center; white-space: nowrap;">
                <button class="btn-action btn-comment" data-id="${id}" data-title="${safeTitle}" title="Xem bình luận & đánh giá"><i class="fa-solid fa-comments"></i></button>
                <button class="btn-action btn-reset" data-id="${id}" title="Khôi phục lượt xem về 0"><i class="fa-solid fa-rotate-left"></i></button>
                <button class="btn-action btn-edit" data-id="${id}" data-title="${safeTitle}" data-url="${safeUrl}" data-category="${data.category}" title="Sửa bài giảng"><i class="fa-solid fa-pen"></i></button>
                <button class="btn-action btn-delete" data-id="${id}" title="Xóa bài giảng"><i class="fa-solid fa-trash"></i></button>
            </td>
        `;

        tr.addEventListener('dragstart', function(e) {
            draggedRow = this;
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', id);
            setTimeout(() => this.style.opacity = '0.4', 0);
        });

        tr.addEventListener('dragenter', function(e) {
            e.preventDefault();
            if (this !== draggedRow) this.style.background = '#f1f5f9';
        });

        tr.addEventListener('dragover', function(e) {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            if (this !== draggedRow) {
                const bounding = this.getBoundingClientRect();
                const offset = e.clientY - bounding.top;
                if (offset > bounding.height / 2) {
                    this.style.borderBottom = '2px solid #3b82f6';
                    this.style.borderTop = '';
                } else {
                    this.style.borderTop = '2px solid #3b82f6';
                    this.style.borderBottom = '';
                }
            }
        });

        tr.addEventListener('dragleave', function(e) {
            this.style.background = '';
            this.style.borderTop = '';
            this.style.borderBottom = '';
        });

        tr.addEventListener('drop', function(e) {
            e.preventDefault();
            this.style.background = '';
            this.style.borderTop = '';
            this.style.borderBottom = '';
            
            if (this !== draggedRow) {
                const bounding = this.getBoundingClientRect();
                const offset = e.clientY - bounding.top;
                if (offset > bounding.height / 2) {
                    this.parentNode.insertBefore(draggedRow, this.nextSibling);
                } else {
                    this.parentNode.insertBefore(draggedRow, this);
                }
                updateOrderInFirestore();
            }
        });

        tr.addEventListener('dragend', function() {
            this.style.opacity = '1';
            document.querySelectorAll('#pptx-tbody tr').forEach(row => {
                row.style.background = '';
                row.style.borderTop = '';
                row.style.borderBottom = '';
            });
        });

        tbody.appendChild(tr);
        fetchLectureStatsForTable(id);
    });

    document.querySelectorAll('.btn-delete').forEach(btn => {
        btn.onclick = async (e) => {
            const id = e.currentTarget.getAttribute('data-id');
            if (confirm('Xóa dữ liệu này khỏi hệ thống?')) {
                await deleteDoc(doc(db, "pptx_lectures", id));
            }
        }
    });

    document.querySelectorAll('.btn-reset').forEach(btn => {
        btn.onclick = async (e) => {
            const id = e.currentTarget.getAttribute('data-id');
            if (confirm('Bạn có chắc chắn muốn khôi phục số lượt xem của bài này về 0?')) {
                await updateDoc(doc(db, "pptx_lectures", id), { viewCount: 0 });
            }
        }
    });

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

    document.querySelectorAll('.btn-comment').forEach(btn => {
        btn.onclick = (e) => {
            const id = e.currentTarget.getAttribute('data-id');
            const title = e.currentTarget.getAttribute('data-title');
            openCommentsModal(id, title);
        }
    });
}

async function updateOrderInFirestore() {
    isReordering = true;
    const rows = document.querySelectorAll('#pptx-tbody tr');
    const promises = [];
    
    rows.forEach((row, index) => {
        const id = row.getAttribute('data-id');
        if (id) {
            promises.push(updateDoc(doc(db, "pptx_lectures", id), { order: index }));
        }
    });
    
    try {
        document.getElementById('pptx-tbody').style.opacity = '0.5';
        await Promise.all(promises);
    } catch (err) {} finally {
        document.getElementById('pptx-tbody').style.opacity = '1';
        isReordering = false;
        renderAdminTable(); 
    }
}

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
            let timeStr = '';
            if (c.createdAt) {
                const dateObj = c.createdAt.toDate();
                timeStr = dateObj.toLocaleDateString('vi-VN') + ' ' + dateObj.toLocaleTimeString('vi-VN', {hour: '2-digit', minute:'2-digit'});
            }
            let starsHtml = '';
            if (c.rating > 0) {
                for(let i=1; i<=5; i++) starsHtml += `<i class="fa-solid fa-star" style="color: ${i <= c.rating ? '#f59e0b' : '#cbd5e1'}"></i>`;
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

        document.querySelectorAll('.btn-delete-comment').forEach(btn => {
            btn.onclick = async (e) => {
                if (confirm('Bạn có chắc chắn muốn XÓA VĨNH VIỄN bình luận này không?')) {
                    const lid = e.currentTarget.getAttribute('data-lecture-id');
                    const cid = e.currentTarget.getAttribute('data-comment-id');
                    await deleteDoc(doc(db, `pptx_lectures/${lid}/comments`, cid));
                    e.currentTarget.closest('div').parentElement.remove();
                }
            }
        });

    } catch (err) {}
}

async function handleSavePptx() {
    const title = document.getElementById('pptx-title').value.trim();
    let url = document.getElementById('pptx-url').value.trim();
    const fileInput = document.getElementById('video-upload');
    const selectedCategory = document.getElementById('pptx-category').value;
    const file = fileInput.files[0];

    if (!title) return alert("Vui lòng nhập tên bài giảng!");
    if (!url && !file) return alert("Vui lòng dán Link nhúng hoặc chọn File Video!");

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
            if (match && match[1]) url = match[1];
            else return alert("Không thể trích xuất link từ mã iframe bạn dán.");
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
    } catch (err) {}
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
