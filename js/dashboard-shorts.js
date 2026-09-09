import { db } from "./dashboard-core.js";
import { collection, query, where, orderBy, limit, onSnapshot } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// Biến lưu trữ listener để tránh rò rỉ bộ nhớ khi load lại component
let unsubscribeShorts = null;

function initWikiradShorts() {
    // 1. Tìm container ở Dashboard (Cuộn ngang)
    const dashboardContainer = document.getElementById('wikirad-shorts-container');
    const dashboardScrollArea = dashboardContainer ? dashboardContainer.querySelector('.hide-scrollbar') : null;
    
    // 2. Tìm container ở Tab Riêng (Lưới to)
    const tabShorts = document.getElementById('tab-shorts');

    // Nếu HTML chưa tải xong thì bỏ qua
    if (!dashboardContainer && !tabShorts) return;

    try {
        const q = query(
            collection(db, "wikirad_shorts"),
            where("isActive", "==", true),
            orderBy("createdAt", "desc"),
            limit(20)
        );

        // Xóa listener cũ nếu có trước khi tạo mới
        if (unsubscribeShorts) {
            unsubscribeShorts();
        }

        unsubscribeShorts = onSnapshot(q, (snapshot) => {
            if (snapshot.empty) {
                if (dashboardContainer) dashboardContainer.style.display = 'none';
                if (tabShorts) tabShorts.innerHTML = '<div style="padding: 30px; text-align: center; color: #64748b; font-size: 1.1rem;">Chưa có video Shorts nào được đăng tải.</div>';
                return;
            }

            // ==============================================================
            // RENDER 1: CHO TRANG DASHBOARD (DẢI CUỘN NGANG - SIZE NHỎ VỪA)
            // ==============================================================
            if (dashboardContainer && dashboardScrollArea) {
                dashboardContainer.style.display = 'block';
                let dashHtml = '';
                snapshot.forEach((doc) => {
                    const data = doc.data();
                    if (data.youtubeId) {
                        dashHtml += `
                            <div style="flex: 0 0 220px; border-radius: 12px; overflow: hidden; background: #000; border: 1px solid #cbd5e1; box-shadow: 0 4px 10px rgba(0,0,0,0.05); position: relative;">
                                <iframe width="220" height="390" src="https://www.youtube.com/embed/${data.youtubeId}" title="${data.title || 'Wikirad Shorts'}" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen style="display: block;"></iframe>
                            </div>
                        `;
                    }
                });
                dashboardScrollArea.innerHTML = dashHtml;
            }

            // ==============================================================
            // RENDER 2: CHO TAB "WIKIRAD SHORTS" RIÊNG (DẠNG LƯỚI - SIZE TO)
            // ==============================================================
            if (tabShorts) {
                let tabHtml = `
                    <div style="padding: 20px 30px;">
                        <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 25px;">
                            <i class="fa-brands fa-youtube" style="color: #ef4444; font-size: 1.8rem;"></i>
                            <h2 style="margin: 0; color: #0f172a; font-size: 1.5rem; font-weight: 800;">Kho Wikirad Shorts</h2>
                        </div>
                        <div style="display: flex; gap: 20px; flex-wrap: wrap;">
                `;
                
                snapshot.forEach((doc) => {
                    const data = doc.data();
                    if (data.youtubeId) {
                        tabHtml += `
                            <div style="flex: 0 0 280px; border-radius: 16px; overflow: hidden; background: #000; border: 1px solid #cbd5e1; box-shadow: 0 6px 15px rgba(0,0,0,0.08);">
                                <iframe width="280" height="498" src="https://www.youtube.com/embed/${data.youtubeId}" title="${data.title || 'Wikirad Shorts'}" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen style="display: block;"></iframe>
                            </div>
                        `;
                    }
                });

                tabHtml += `</div></div>`;
                tabShorts.innerHTML = tabHtml;
            }
            
        }, (error) => {
            console.error("Lỗi tải Wikirad Shorts:", error);
        });
    } catch (error) {
        console.error("Lỗi khởi tạo truy vấn Shorts:", error);
    }
}

// Gọi hàm khi HTML DOM tải xong
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initWikiradShorts);
} else {
    initWikiradShorts();
}

// Bắt thêm sự kiện ComponentsLoaded của hệ thống để nạp lại khi chuyển tab
document.addEventListener('ComponentsLoaded', initWikiradShorts);
