import { db } from "./dashboard-core.js";
import { collection, query, where, orderBy, limit, onSnapshot } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

document.addEventListener('ComponentsLoaded', () => {
    const shortsContainer = document.querySelector('#wikirad-shorts-container .hide-scrollbar');
    const mainContainer = document.getElementById('wikirad-shorts-container');
    
    if (!shortsContainer || !mainContainer) return;

    try {
        // Truy vấn tối đa 10 video đang được bật hiển thị, sắp xếp mới nhất lên đầu
        const q = query(
            collection(db, "wikirad_shorts"),
            where("isActive", "==", true),
            orderBy("createdAt", "desc"),
            limit(10)
        );

        // Lắng nghe Realtime để tự động cập nhật khi Admin thêm/xóa video
        onSnapshot(q, (snapshot) => {
            if (snapshot.empty) {
                mainContainer.style.display = 'none';
                return;
            }

            mainContainer.style.display = 'block';
            let htmlBuffer = '';
            
            snapshot.forEach((doc) => {
                const data = doc.data();
                if (data.youtubeId) {
                    htmlBuffer += `
                        <div style="flex: 0 0 220px; border-radius: 12px; overflow: hidden; background: #000; border: 1px solid #cbd5e1; position: relative;">
                            <iframe width="220" height="390" src="https://www.youtube.com/embed/${data.youtubeId}" title="${data.title || 'Wikirad Shorts'}" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen style="display: block;"></iframe>
                        </div>
                    `;
                }
            });

            // Ghi đè các video mẫu (tĩnh) bằng video lấy từ Firebase
            shortsContainer.innerHTML = htmlBuffer;
            
        }, (error) => {
            console.error("Lỗi tải Wikirad Shorts:", error);
        });
    } catch (error) {
        console.error("Lỗi khởi tạo truy vấn Shorts:", error);
    }
});
