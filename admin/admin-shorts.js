// Đảm bảo đường dẫn import đúng với file chứa cấu hình Firebase của bạn
import { db } from './firebase-config.js'; 
import { collection, addDoc, serverTimestamp, onSnapshot, doc, updateDoc, deleteDoc, query, orderBy } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// Sử dụng componentsLoaded (hoặc DOMContentLoaded) để đảm bảo giao diện HTML đã render xong
document.addEventListener('componentsLoaded', () => {
    const btnAddShort = document.getElementById('btnAdminAddShort');
    const inputTitle = document.getElementById('adminShortTitle');
    const inputLink = document.getElementById('adminShortLink');
    const tableBody = document.getElementById('adminShortsTableBody');

    // Nếu không tìm thấy các thẻ giao diện trên trang, dừng script để tránh báo lỗi
    if (!btnAddShort || !tableBody) return;

    // Hàm tự động trích xuất ID Video từ bất kỳ định dạng link YouTube nào (Shorts, Embed, Thường, App mobile...)
    function extractYouTubeId(url) {
        const regex = /(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|shorts\/|watch\?v=|watch\?.+&v=))([^&?\n]{11})/;
        const match = url.match(regex);
        return match ? match[1] : null;
    }

    // 1. TẢI DỮ LIỆU REALTIME TỪ FIRESTORE
    const shortsQuery = query(collection(db, "wikirad_shorts"), orderBy("createdAt", "desc"));
    
    onSnapshot(shortsQuery, (snapshot) => {
        if (snapshot.empty) {
            tableBody.innerHTML = '<tr><td colspan="5" style="text-align: center; padding: 20px; color: #64748b;">Chưa có video nào trong hệ thống.</td></tr>';
            return;
        }

        let html = '';
        snapshot.forEach((docSnap) => {
            const data = docSnap.data();
            const docId = docSnap.id;
            
            // Xử lý ngày tháng định dạng chuẩn
            let dateStr = "Chưa rõ";
            if (data.createdAt) {
                const d = typeof data.createdAt.toDate === 'function' ? data.createdAt.toDate() : new Date(data.createdAt);
                dateStr = `${d.getDate().toString().padStart(2,'0')}/${(d.getMonth()+1).toString().padStart(2,'0')}/${d.getFullYear()}`;
            }

            // Xử lý trạng thái hiển thị
            const statusBadge = data.isActive 
                ? `<span style="background: #dcfce7; color: #16a34a; padding: 4px 10px; border-radius: 12px; font-size: 0.8rem; font-weight: 700;">Đang hiện</span>` 
                : `<span style="background: #f1f5f9; color: #64748b; padding: 4px 10px; border-radius: 12px; font-size: 0.8rem; font-weight: 700;">Đang ẩn</span>`;

            const btnToggleStr = data.isActive ? 'Ẩn video' : 'Bật hiển thị';
            const btnToggleColor = data.isActive ? '#f59e0b' : '#10b981';

            html += `
                <tr style="border-bottom: 1px solid #e2e8f0; transition: background 0.2s;" onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background='transparent'">
                    <td style="padding: 12px 15px; font-weight: 600; color: #1e293b;">${data.title || 'Không có tiêu đề'}</td>
                    <td style="padding: 12px 15px; color: #3b82f6; font-family: monospace;">${data.youtubeId}</td>
                    <td style="padding: 12px 15px; color: #64748b;">${dateStr}</td>
                    <td style="padding: 12px 15px; text-align: center;">${statusBadge}</td>
                    <td style="padding: 12px 15px; text-align: center;">
                        <button class="btn-toggle-short" data-id="${docId}" data-status="${data.isActive}" style="background: ${btnToggleColor}; color: white; border: none; padding: 6px 12px; border-radius: 6px; font-size: 0.8rem; cursor: pointer; margin-right: 5px; transition: 0.2s;">${btnToggleStr}</button>
                        <button class="btn-delete-short" data-id="${docId}" style="background: #ef4444; color: white; border: none; padding: 6px 12px; border-radius: 6px; font-size: 0.8rem; cursor: pointer; transition: 0.2s;"><i class="fa-solid fa-trash"></i></button>
                    </td>
                </tr>
            `;
        });
        tableBody.innerHTML = html;
    });

    // 2. SỰ KIỆN THÊM VIDEO MỚI
    btnAddShort.addEventListener('click', async () => {
        const title = inputTitle.value.trim();
        const link = inputLink.value.trim();

        if (!link) return alert("Bạn phải nhập Link YouTube!");
        
        const ytId = extractYouTubeId(link);
        if (!ytId) return alert("Link không hợp lệ. Vui lòng dán đúng link YouTube hoặc YouTube Shorts!");

        btnAddShort.disabled = true;
        btnAddShort.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Đang xử lý...';

        try {
            await addDoc(collection(db, "wikirad_shorts"), {
                title: title || "Wikirad Shorts",
                youtubeId: ytId,
                isActive: true, // Mặc định bật hiển thị sau khi upload
                createdAt: serverTimestamp()
            });

            inputTitle.value = '';
            inputLink.value = '';
            alert("Thêm video thành công!");
        } catch (error) {
            console.error("Lỗi thêm video: ", error);
            alert("Lỗi kết nối CSDL!");
        } finally {
            btnAddShort.disabled = false;
            btnAddShort.innerHTML = '<i class="fa-solid fa-plus"></i> Đăng Video';
        }
    });

    // 3. SỰ KIỆN BẬT/TẮT VÀ XÓA (Sử dụng Event Delegation)
    tableBody.addEventListener('click', async (e) => {
        const btnToggle = e.target.closest('.btn-toggle-short');
        const btnDelete = e.target.closest('.btn-delete-short');

        // Phân nhánh Xử lý Bật/Tắt hiển thị
        if (btnToggle) {
            const docId = btnToggle.getAttribute('data-id');
            const currentStatus = btnToggle.getAttribute('data-status') === 'true';
            
            btnToggle.disabled = true;
            btnToggle.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
            
            try {
                await updateDoc(doc(db, "wikirad_shorts", docId), { 
                    isActive: !currentStatus 
                });
                // Realtime onSnapshot sẽ tự cập nhật lại giao diện
            } catch (error) {
                console.error(error);
                alert("Lỗi cập nhật trạng thái!");
                btnToggle.disabled = false;
            }
        }

        // Phân nhánh Xử lý Xóa Video
        if (btnDelete) {
            const docId = btnDelete.getAttribute('data-id');
            
            if (!confirm("Hệ thống cảnh báo: Bạn có chắc chắn muốn XÓA VĨNH VIỄN video này khỏi hệ thống không?")) return;
            
            btnDelete.disabled = true;
            btnDelete.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
            
            try {
                await deleteDoc(doc(db, "wikirad_shorts", docId));
                // Realtime onSnapshot sẽ tự cập nhật lại giao diện
            } catch (error) {
                console.error(error);
                alert("Lỗi khi xóa video!");
                btnDelete.disabled = false;
            }
        }
    });
});
