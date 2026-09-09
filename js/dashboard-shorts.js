import { db } from "./dashboard-core.js";
import { collection, query, where, orderBy, limit, onSnapshot } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

function initWikiradShorts() {
    const tabShorts = document.getElementById('tab-shorts');
    if (!tabShorts) return;

    try {
        // Truy vấn 20 video mới nhất
        const q = query(
            collection(db, "wikirad_shorts"),
            where("isActive", "==", true),
            orderBy("createdAt", "desc"),
            limit(20)
        );

        onSnapshot(q, (snapshot) => {
            if (snapshot.empty) {
                tabShorts.innerHTML = '<div style="padding: 30px; text-align: center; color: #64748b; font-size: 1.1rem;">Chưa có video Shorts nào được đăng tải.</div>';
                return;
            }

            // Giao diện dải cuộn ngang (Horizontal Carousel)
            let htmlBuffer = `
                <div style="padding: 10px 20px 30px 20px;">
                    <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 25px;">
                        <i class="fa-brands fa-youtube" style="color: #ef4444; font-size: 1.8rem;"></i>
                        <h2 style="margin: 0; color: #0f172a; font-size: 1.5rem; font-weight: 800;">Wikirad Shorts</h2>
                    </div>
                    
                    <!-- Container cuộn ngang -->
                    <div style="display: flex; gap: 20px; overflow-x: auto; padding-bottom: 20px; scrollbar-width: thin;" class="hide-scrollbar">
            `;
            
            snapshot.forEach((doc) => {
                const data = doc.data();
                if (data.youtubeId) {
                    htmlBuffer += `
                        <div style="flex: 0 0 280px; border-radius: 16px; overflow: hidden; background: #000; border: 1px solid #cbd5e1; box-shadow: 0 6px 15px rgba(0,0,0,0.08); position: relative;">
                            <iframe width="280" height="498" src="https://www.youtube.com/embed/${data.youtubeId}" title="${data.title || 'Wikirad Shorts'}" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen style="display: block;"></iframe>
                        </div>
                    `;
                }
            });

            htmlBuffer += `
                    </div>
                </div>
            `;
            
            tabShorts.innerHTML = htmlBuffer;
            
        }, (error) => {
            console.error("Lỗi tải Wikirad Shorts:", error);
            tabShorts.innerHTML = '<div style="padding: 20px; color: #ef4444;">Lỗi kết nối dữ liệu. Vui lòng thử lại sau.</div>';
        });
    } catch (error) {
        console.error("Lỗi khởi tạo truy vấn Shorts:", error);
    }
}

// Chống lỗi bất đồng bộ: Chạy ngay nếu trang đã tải xong, hoặc chờ DOMContentLoaded
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initWikiradShorts);
} else {
    initWikiradShorts();
}

// Bọc thêm dự phòng cho hệ thống load component động
document.addEventListener('ComponentsLoaded', initWikiradShorts);
