import { db, showToast } from './admin-core.js';
import { collection, doc, setDoc, deleteDoc, updateDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

document.addEventListener('componentsLoaded', () => {
    initVoucherManager();
});

function initVoucherManager() {
    const btnCreate = document.getElementById('btn-create-voucher');
    if (btnCreate) {
        btnCreate.addEventListener('click', handleCreateVoucher);
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

            document.querySelectorAll('.btn-delete-vc').forEach(btn => {
                btn.onclick = async (e) => {
                    const vId = e.currentTarget.getAttribute('data-id');
                    if (confirm(`Bạn có chắc chắn muốn xóa mã voucher ${vId} không? Hành động này không thể hoàn tác.`)) {
                        await deleteDoc(doc(db, "vouchers", vId));
                        showToast("Đã xóa mã voucher thành công", "success");
                    }
                }
            });

            document.querySelectorAll('.btn-toggle-vc').forEach(btn => {
                btn.onclick = async (e) => {
                    const vId = e.currentTarget.getAttribute('data-id');
                    const currentStatus = e.currentTarget.getAttribute('data-active') === 'true';
                    await updateDoc(doc(db, "vouchers", vId), { isActive: !currentStatus });
                    showToast(`Đã ${!currentStatus ? 'bật lại' : 'tạm ngưng'} mã voucher!`, "success");
                }
            });
        });
    }
}

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
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Đang khởi tạo...';

    try {
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
        
        document.getElementById('v-code').value = '';
    } catch (error) {
        console.error("Lỗi tạo voucher:", error);
        showToast("Có lỗi xảy ra khi kết nối CSDL tạo voucher.", "error");
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="fa-solid fa-plus"></i> Phát Hành Mã';
    }
}
