import { db, showToast } from './admin-core.js';
import { collection, doc, setDoc, deleteDoc, updateDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// Biến lưu trữ ID của Voucher đang được chỉnh sửa (Nếu null là chế độ Tạo Mới)
let editingVoucherId = null;

document.addEventListener('componentsLoaded', () => {
    initVoucherManager();
});

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

    const createBtn = document.getElementById('btn-create-voucher');
    if(createBtn) {
        createBtn.innerHTML = '<i class="fa-solid fa-plus"></i> Phát Hành Mã';
        createBtn.style.backgroundColor = '#10b981';
    }

    const cancelBtn = document.getElementById('btn-cancel-edit-vc');
    if (cancelBtn) cancelBtn.style.display = 'none';
}

function initVoucherManager() {
    // TỰ ĐỘNG ẨN 2 Ô NHẬP NGÀY THÁNG KHỎI GIAO DIỆN MÀ KHÔNG CẦN SỬA HTML
    const vStart = document.getElementById('v-start');
    if (vStart && vStart.parentNode) vStart.parentNode.style.display = 'none';
    const vEnd = document.getElementById('v-end');
    if (vEnd && vEnd.parentNode) vEnd.parentNode.style.display = 'none';

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
                
                let statusHtml = '';
                if (!data.isActive) {
                    statusHtml = '<span style="background:#64748b; color:white; padding: 4px 8px; border-radius: 4px; font-size: 11px; font-weight: bold;">Tạm tắt</span>';
                } else if (data.usedCount >= data.maxUses) {
                    statusHtml = '<span style="background:#ef4444; color:white; padding: 4px 8px; border-radius: 4px; font-size: 11px; font-weight: bold;">Đã hết lượt</span>';
                } else {
                    statusHtml = '<span style="background:#10b981; color:white; padding: 4px 8px; border-radius: 4px; font-size: 11px; font-weight: bold;">Đang chạy</span>';
                }

                // ĐÃ THÊM: Đọc trường tier, mặc định hiển thị PLUS nếu chưa có
                const tierDisplay = data.tier ? data.tier.toUpperCase() : 'PLUS';

                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>
                        <strong style="color: #2563eb; font-size: 15px; border: 1px dashed #2563eb; padding: 4px 8px; border-radius: 6px;">${data.code}</strong>
                        <div style="margin-top: 8px;">
                            <span style="background: #dbeafe; color: #1d4ed8; padding: 2px 8px; border-radius: 4px; font-size: 10px; font-weight: bold;">GÓI ${tierDisplay}</span>
                        </div>
                    </td>
                    <td class="text-center"><span style="background:#e0e7ff; color:#3730a3; padding: 4px 8px; border-radius:10px; font-weight:bold;">${data.durationDays} ngày</span></td>
                    <td class="text-center"><strong style="color: ${data.usedCount >= data.maxUses ? '#ef4444' : '#10b981'}; font-size: 15px;">${data.usedCount}</strong> / ${data.maxUses}</td>
                    <td class="text-center" style="font-size: 12px; color:#475569;">
                        <span style="background: #f1f5f9; padding: 4px 8px; border-radius: 4px; border: 1px solid #e2e8f0;">Không giới hạn</span>
                    </td>
                    <td class="text-center">${statusHtml}</td>
                    <td style="display: flex; gap: 5px; justify-content: center; flex-wrap: wrap; align-items: center; border: none; padding: 12px;">
                        <button class="btn-edit-vc" data-id="${id}" data-duration="${data.durationDays}" data-max="${data.maxUses}" style="padding: 6px 12px; border: none; border-radius: 6px; cursor: pointer; background: #3b82f6; color: white; font-size: 12px; font-weight: bold; white-space: nowrap; transition: 0.2s;">
                            <i class="fa-solid fa-pen"></i> Sửa
                        </button>
                        <button class="btn-toggle-vc" data-id="${id}" data-active="${data.isActive}" style="padding: 6px 12px; border: none; border-radius: 6px; cursor: pointer; background: ${data.isActive ? '#f59e0b' : '#10b981'}; color: white; font-size: 12px; font-weight: bold; white-space: nowrap; transition: 0.2s;">
                            ${data.isActive ? '<i class="fa-solid fa-pause"></i> Tạm ngưng' : '<i class="fa-solid fa-play"></i> Bật'}
                        </button>
                        <button class="btn-delete-vc" data-id="${id}" style="padding: 6px 12px; border: none; border-radius: 6px; cursor: pointer; background: #ef4444; color: white; font-size: 12px; font-weight: bold; white-space: nowrap; transition: 0.2s;">
                            <i class="fa-solid fa-trash"></i> Xóa
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

    if (!codeInput || isNaN(duration) || isNaN(maxUses)) {
        showToast("Vui lòng điền đầy đủ Mã Voucher, Số ngày và Giới hạn lượt!", "error");
        return;
    }

    if (codeInput.includes(" ")) {
        showToast("Mã voucher không được chứa khoảng trắng!", "error");
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
                maxUses: maxUses
            });
            showToast("Đã cập nhật mã Voucher thành công!", "success");
            resetVoucherForm();
        } else {
            // TẠO MÃ MỚI (Bỏ startDate và endDate)
            const voucherData = {
                code: codeInput,
                durationDays: duration,
                isActive: true,
                maxUses: maxUses,
                usedCount: 0,
                usedBy: [],
                tier: 'plus' // ĐÃ THÊM: Định danh rõ ràng mã này cấp quyền Plus
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
