import { db, showToast } from './admin-core.js';
import { collection, doc, setDoc, deleteDoc, updateDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// Biến lưu trữ ID của Voucher đang được chỉnh sửa (Nếu null là chế độ Tạo Mới)
let editingVoucherId = null;

document.addEventListener('componentsLoaded', () => {
    initVoucherManager();
});

// Hàm hỗ trợ format timestamp sang định dạng chuẩn của input datetime-local
function formatForDateTimeLocal(timestamp) {
    const d = new Date(timestamp);
    const pad = (n) => n.toString().padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// Hàm reset form về trạng thái Tạo Mới ban đầu
function resetVoucherForm() {
    editingVoucherId = null;
    const vCodeInput = document.getElementById('v-code');
    if(!vCodeInput) return;
    
    vCodeInput.value = '';
    vCodeInput.readOnly = false; // Mở khóa cho phép nhập mã
    vCodeInput.style.backgroundColor = ""; // Bỏ màu xám
    
    document.getElementById('v-duration').value = '30';
    document.getElementById('v-max').value = '100';
    document.getElementById('v-start').value = '';
    document.getElementById('v-end').value = '';

    const createBtn = document.getElementById('btn-create-voucher');
    if(createBtn) {
        createBtn.innerHTML = '<i class="fa-solid fa-plus"></i> Phát Hành Mã';
        createBtn.style.backgroundColor = '#10b981';
    }

    const cancelBtn = document.getElementById('btn-cancel-edit-vc');
    if (cancelBtn) cancelBtn.style.display = 'none';
}

function initVoucherManager() {
    const btnCreate = document.getElementById('btn-create-voucher');
    if (btnCreate) {
        btnCreate.addEventListener('click', handleCreateVoucher);
        
        // Tự động bọc nút Phát hành vào một khung Flex để gắn thêm nút Hủy Kế bên
        const parentDiv = btnCreate.parentNode;
        if (parentDiv && parentDiv.style.display !== 'flex') {
            const flexContainer = document.createElement('div');
            flexContainer.style.display = 'flex';
            flexContainer.style.gap = '10px';
            parentDiv.insertBefore(flexContainer, btnCreate);
            flexContainer.appendChild(btnCreate);
            btnCreate.style.flex = '1';
            
            const cancelBtn = document.createElement('button');
            cancelBtn.id = 'btn-cancel-edit-vc';
            cancelBtn.innerHTML = '<i class="fa-solid fa-xmark"></i> Hủy Sửa';
            cancelBtn.style.cssText = 'background: #ef4444; color: white; padding: 10px; border: none; border-radius: 6px; font-weight: bold; cursor: pointer; transition: 0.2s; display: none;';
            cancelBtn.onclick = resetVoucherForm;
            flexContainer.appendChild(cancelBtn);
        }
    }

    const tbody = document.getElementById('vouchers-table-body');
    if (tbody) {
        onSnapshot(collection(db, "vouchers"), (snapshot) => {
            tbody.innerHTML = '';
            if (snapshot.empty) {
                tbody.innerHTML = '<tr><td colspan="6" class="empty-message text-center" style="padding: 20px;">Chưa có voucher nào được tạo trên hệ thống.</td></tr>';
                return;
            }

            snapshot.forEach(docSnap => {
                const data = docSnap.data();
                const id = docSnap.id;
                
                const startStr = new Date(data.startDate).toLocaleString('vi-VN');
                const endStr = new Date(data.endDate).toLocaleString('vi-VN');
                
                const now = Date.now();
                let statusHtml = '';
                if (!data.isActive) {
                    statusHtml = '<span style="background:#64748b; color:white; padding: 4px 8px; border-radius: 4px; font-size: 11px; font-weight: bold;">Tạm tắt</span>';
                } else if (now < data.startDate) {
                    statusHtml = '<span style="background:#f59e0b; color:white; padding: 4px 8px; border-radius: 4px; font-size: 11px; font-weight: bold;">Chưa bắt đầu</span>';
                } else if (now > data.endDate) {
                    statusHtml = '<span style="background:#ef4444; color:white; padding: 4px 8px; border-radius: 4px; font-size: 11px; font-weight: bold;">Hết hạn</span>';
                } else if (data.usedCount >= data.maxUses) {
                    statusHtml = '<span style="background:#ef4444; color:white; padding: 4px 8px; border-radius: 4px; font-size: 11px; font-weight: bold;">Đã hết lượt</span>';
                } else {
                    statusHtml = '<span style="background:#10b981; color:white; padding: 4px 8px; border-radius: 4px; font-size: 11px; font-weight: bold;">Đang chạy</span>';
                }

                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td><strong style="color: #2563eb; font-size: 15px; border: 1px dashed #2563eb; padding: 4px 8px; border-radius: 6px;">${data.code}</strong></td>
                    <td class="text-center"><span style="background:#e0e7ff; color:#3730a3; padding: 4px 8px; border-radius:10px; font-weight:bold;">${data.durationDays} ngày</span></td>
                    <td class="text-center"><strong style="color: ${data.usedCount >= data.maxUses ? '#ef4444' : '#10b981'}; font-size: 15px;">${data.usedCount}</strong> / ${data.maxUses}</td>
                    <td class="text-center" style="font-size: 12px; color:#475569; line-height: 1.6;">
                        <div style="border-bottom: 1px solid #e2e8f0; padding-bottom: 4px;">Từ: <strong>${startStr}</strong></div>
                        <div style="padding-top: 4px;">Đến: <strong>${endStr}</strong></div>
                    </td>
                    <td class="text-center">${statusHtml}</td>
                    <td class="text-center">
                        <!-- NÚT SỬA ĐƯỢC CHÈN VÀO ĐÂY -->
                        <button class="btn-edit-vc" data-id="${id}" data-duration="${data.durationDays}" data-max="${data.maxUses}" data-start="${data.startDate}" data-end="${data.endDate}" style="padding:6px 10px; border:none; border-radius:6px; cursor:pointer; background:#3b82f6; color:white; font-size:12px; margin-bottom: 5px; width: 100%;">
                            <i class="fa-solid fa-pen"></i> Sửa thông tin
                        </button>
                        <button class="btn-toggle-vc" data-id="${id}" data-active="${data.isActive}" style="padding:6px 10px; border:none; border-radius:6px; cursor:pointer; background:${data.isActive ? '#f59e0b' : '#10b981'}; color:white; font-size:12px; margin-bottom: 5px; width: 100%;">
                            ${data.isActive ? '<i class="fa-solid fa-pause"></i> Tạm ngưng' : '<i class="fa-solid fa-play"></i> Bật lại mã'}
                        </button>
                        <button class="btn-delete-vc" data-id="${id}" style="padding:6px 10px; border:none; border-radius:6px; cursor:pointer; background:#ef4444; color:white; font-size:12px; width: 100%;">
                            <i class="fa-solid fa-trash"></i> Xóa vĩnh viễn
                        </button>
                    </td>
                `;
                tbody.appendChild(tr);
            });

            // Gắn sự kiện Xóa
            document.querySelectorAll('.btn-delete-vc').forEach(btn => {
                btn.onclick = async (e) => {
                    const vId = e.currentTarget.getAttribute('data-id');
                    if (confirm(`Bạn có chắc chắn muốn xóa mã voucher ${vId} không? Hành động này không thể hoàn tác.`)) {
                        await deleteDoc(doc(db, "vouchers", vId));
                        showToast("Đã xóa mã voucher thành công", "success");
                        // Nếu đang sửa cái vừa xóa thì reset form
                        if (editingVoucherId === vId) resetVoucherForm();
                    }
                }
            });

            // Gắn sự kiện Bật/Tắt
            document.querySelectorAll('.btn-toggle-vc').forEach(btn => {
                btn.onclick = async (e) => {
                    const vId = e.currentTarget.getAttribute('data-id');
                    const currentStatus = e.currentTarget.getAttribute('data-active') === 'true';
                    await updateDoc(doc(db, "vouchers", vId), { isActive: !currentStatus });
                    showToast(`Đã ${!currentStatus ? 'bật lại' : 'tạm ngưng'} mã voucher!`, "success");
                }
            });

            // Gắn sự kiện Đẩy dữ liệu lên Form Sửa
            document.querySelectorAll('.btn-edit-vc').forEach(btn => {
                btn.onclick = (e) => {
                    const target = e.currentTarget;
                    const vId = target.getAttribute('data-id');
                    
                    // Khóa không cho đổi mã Voucher
                    const vCodeInput = document.getElementById('v-code');
                    vCodeInput.value = vId;
                    vCodeInput.readOnly = true; 
                    vCodeInput.style.backgroundColor = "#f1f5f9"; 

                    // Nạp số liệu
                    document.getElementById('v-duration').value = target.getAttribute('data-duration');
                    document.getElementById('v-max').value = target.getAttribute('data-max');
                    
                    // Nạp ngày tháng
                    const startMs = Number(target.getAttribute('data-start'));
                    const endMs = Number(target.getAttribute('data-end'));
                    document.getElementById('v-start').value = formatForDateTimeLocal(startMs);
                    document.getElementById('v-end').value = formatForDateTimeLocal(endMs);

                    editingVoucherId = vId;

                    // Thay đổi giao diện nút bấm
                    const createBtn = document.getElementById('btn-create-voucher');
                    createBtn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Lưu Thay Đổi';
                    createBtn.style.backgroundColor = '#3b82f6';

                    const cancelBtn = document.getElementById('btn-cancel-edit-vc');
                    if (cancelBtn) cancelBtn.style.display = 'block';

                    // Tự động cuộn trang lên khung Form
                    document.getElementById('tab-vouchers').scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
            });
        });
    }
}

// Xử lý tạo mới hoặc lưu chỉnh sửa
async function handleCreateVoucher() {
    const codeInput = document.getElementById('v-code').value.trim().toUpperCase();
    const duration = parseInt(document.getElementById('v-duration').value);
    const maxUses = parseInt(document.getElementById('v-max').value);
    const startStr = document.getElementById('v-start').value;
    const endStr = document.getElementById('v-end').value;

    if (!codeInput || isNaN(duration) || isNaN(maxUses) || !startStr || !endStr) {
        showToast("Vui lòng điền đầy đủ và chính xác tất cả thông tin!", "error");
        return;
    }

    if (codeInput.includes(" ")) {
        showToast("Mã voucher không được chứa khoảng trắng!", "error");
        return;
    }

    const startTimestamp = new Date(startStr).getTime();
    const endTimestamp = new Date(endStr).getTime();

    if (startTimestamp >= endTimestamp) {
        showToast("Lỗi: Thời gian kết thúc phải lớn hơn thời gian bắt đầu!", "error");
        return;
    }

    const btn = document.getElementById('btn-create-voucher');
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Đang xử lý...';

    try {
        if (editingVoucherId) {
            // LƯU CHỈNH SỬA
            await updateDoc(doc(db, "vouchers", editingVoucherId), {
                durationDays: duration,
                maxUses: maxUses,
                startDate: startTimestamp,
                endDate: endTimestamp
            });
            showToast("Đã cập nhật mã Voucher thành công!", "success");
            resetVoucherForm();
        } else {
            // TẠO MÃ MỚI
            const voucherData = {
                code: codeInput,
                durationDays: duration,
                isActive: true,
                startDate: startTimestamp,
                endDate: endTimestamp,
                maxUses: maxUses,
                usedCount: 0,
                usedBy: []
            };
            await setDoc(doc(db, "vouchers", codeInput), voucherData);
            showToast("Phát hành mã Voucher thành công!", "success");
            resetVoucherForm();
        }
    } catch (error) {
        console.error("Lỗi tạo/sửa voucher:", error);
        showToast("Có lỗi xảy ra khi kết nối CSDL.", "error");
    } finally {
        btn.disabled = false;
        if (!editingVoucherId) {
            btn.innerHTML = '<i class="fa-solid fa-plus"></i> Phát Hành Mã';
        }
    }
}
