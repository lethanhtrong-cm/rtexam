import { db } from "./dashboard-core.js";
import { collection, query, where, orderBy, limit, onSnapshot } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

document.addEventListener('ComponentsLoaded', () => {
    const tabShorts = document.getElementById('tab-shorts');
    if (!tabShorts) return;

    try {
        const q = query(
            collection(db, "wikirad_shorts"),
            where("isActive", "==", true),
            orderBy("createdAt", "desc"),
            limit(20) // Lấy nhiều video hơn do đã chuyển sang trang riêng
        );

        onSnapshot(q, (snapshot) => {
            if (snapshot.empty) {
                tabShorts.innerHTML = '<div style="padding: 30px; text-align: center; color: #64748b; font-size: 1.1rem;">Chưa có video Shorts nào được đăng tải.</div>';
                return;
            }

            // Giao diện lưới chứa nhiều video
            let htmlBuffer = `
                <div style="padding: 0 10px 30px 10px;">
                    <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 25px;">
                        <i class="fa-brands fa-youtube" style="color: #ef4444; font-size: 1.8rem;"></i>
                        <h2 style="margin: 0; color: #0f172a; font-size: 1.4rem; font-weight: 800;">Wikirad Shorts</h2>
                    </div>
                    <div style="display: flex; gap: 20px; flex-wrap: wrap;">
            `;
            
            snapshot.forEach((doc) => {
                const data = doc.data();
                if (data.youtubeId) {
                    htmlBuffer += `
                        <div style="flex: 0 0 280px; border-radius: 16px; overflow: hidden; background: #000; border: 1px solid #cbd5e1; box-shadow: 0 6px 15px rgba(0,0,0,0.08);">
                            <iframe width="280" height="498" src="https://www.youtube.com/embed/${data.youtubeId}" title="${data.title || 'Wikirad Shorts'}" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen style="display: block;"></iframe>
                        </div>
                    `;
                }
            });

            htmlBuffer += `</div></div>`;
            tabShorts.innerHTML = htmlBuffer;
            
        }, (error) => {
            console.error("Lỗi tải Wikirad Shorts:", error);
            tabShorts.innerHTML = '<div style="padding: 20px; color: #ef4444;">Lỗi kết nối dữ liệu. Vui lòng thử lại sau.</div>';
        });
    } catch (error) {
        console.error("Lỗi khởi tạo truy vấn Shorts:", error);
    }
});
