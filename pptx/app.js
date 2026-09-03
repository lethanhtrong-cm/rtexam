import { auth, db } from "./firebase-config.js";
import { UI } from "./app-ui.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { doc, getDoc, updateDoc, collection, query, orderBy, onSnapshot, increment, addDoc, serverTimestamp, setDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

const FREE_LIMIT = 3;
const PLUS_LIMIT = 10;

let currentUserTier = 'free';
let currentUserName = 'Bạn'; 
let pptxDataList = []; 
let currentSelectedCategory = null; 

let currentViewMode = 'list'; 
let currentLoadedItemId = null; 
let viewedLectures = []; 
let userStorageKey = 'viewedLectures_guest';
let currentCommentsUnsubscribe = null; 

let currentOpenRootCat = null; 

const defaultTree = [
    { id: 'mri', name: 'Cộng hưởng từ (MRI)', icon: 'fa-magnet', color: '#3b82f6', bg: '#eff6ff', desc: 'Khám phá các bài giảng giải phẫu và kỹ thuật chụp MRI', children: [
        { id: 'mri_video', name: 'Video Clip', icon: 'fa-circle-play', children: [
            { id: 'mri_video_1', name: 'Video Cơ bản', icon: 'fa-play' },
            { id: 'mri_video_2', name: 'Video Nâng cao', icon: 'fa-play' }
        ]},
        { id: 'mri_pptx', name: 'Bản thuyết trình', icon: 'fa-file-powerpoint' }
    ]},
    { id: 'ct', name: 'Cắt lớp vi tính (CT)', icon: 'fa-x-ray', color: '#22c55e', bg: '#f0fdf4', desc: 'Bài giảng về nguyên lý và ứng dụng CT Scanner', children: [
        { id: 'ct_video', name: 'Video Clip', icon: 'fa-circle-play' },
        { id: 'ct_pptx', name: 'Bản thuyết trình', icon: 'fa-file-powerpoint' }
    ]},
    { id: 'xray', name: 'X-quang', icon: 'fa-person-rays', color: '#ec4899', bg: '#fdf2f8', desc: 'Kiến thức cơ bản và nâng cao về chẩn đoán X-quang', children: [
        { id: 'xray_video', name: 'Video Clip', icon: 'fa-circle-play' },
        { id: 'xray_pptx', name: 'Bản thuyết trình', icon: 'fa-file-powerpoint' }
    ]},
    { id: 'contrast', name: 'Thuốc tương phản', icon: 'fa-syringe', color: '#f59e0b', bg: '#fffbeb', desc: 'Hướng dẫn sử dụng và xử trí tai biến thuốc tương phản', children: [
        { id: 'contrast_video', name: 'Video Clip', icon: 'fa-circle-play' },
        { id: 'contrast_pptx', name: 'Bản thuyết trình', icon: 'fa-file-powerpoint' }
    ]}
];

let globalCategoryTree = [];

document.addEventListener('DOMContentLoaded', () => {
    document.addEventListener('contextmenu', event => event.preventDefault());
    document.addEventListener('keydown', event => {
        if (
            event.key === 'F12' || 
            (event.ctrlKey && event.shiftKey && event.key === 'I') || 
            (event.ctrlKey && (event.key === 'p' || event.key === 's' || event.key === 'c'))
        ) {
            event.preventDefault();
        }
    });

    UI.initResizer();
    UI.initStarRating(); 
    UI.initMobileCommentToggle(); 

    document.getElementById('btn-toggle-sidebar').addEventListener('click', (e) => {
        const sidebar = document.querySelector('.pptx-sidebar');
        const resizer = document.getElementById('dragMe');
        const icon = e.currentTarget;
        if (sidebar.style.display === 'none') {
            sidebar.style.display = '';
            if(resizer) resizer.style.display = '';
            icon.innerHTML = '<i class="fa-solid fa-list-ul"></i>';
        } else {
            sidebar.style.display = 'none';
            if(resizer) resizer.style.display = 'none';
            icon.innerHTML = '<i class="fa-solid fa-expand"></i>';
        }
    });

    document.getElementById('btn-toggle-view').addEventListener('click', (e) => {
        currentViewMode = currentViewMode === 'list' ? 'grid' : 'list';
        const videoViewer = document.getElementById('video-viewer');
        if (currentViewMode === 'grid' && videoViewer && typeof videoViewer.pause === 'function') {
            videoViewer.pause();
        }
        UI.toggleViewModeDisplay(currentViewMode, e.currentTarget);
    });

    document.getElementById('btn-submit-comment').addEventListener('click', async () => {
        if (!currentLoadedItemId || !auth.currentUser) return;
        
        const text = document.getElementById('comment-textarea').value.trim();
        const rating = UI.getRating();
        if (!text && rating === 0) {
            alert('Vui lòng nhập nội dung bình luận hoặc chọn số sao đánh giá!');
            return;
        }

        try {
            const btnSubmit = document.getElementById('btn-submit-comment');
            btnSubmit.disabled = true;
            btnSubmit.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Đang xử lý...';

            await addDoc(collection(db, `pptx_lectures/${currentLoadedItemId}/comments`), {
                userId: auth.currentUser.uid,
                userName: currentUserName,
                text: text,
                rating: rating,
                createdAt: serverTimestamp()
            });

            UI.resetRating();
            btnSubmit.disabled = false;
            btnSubmit.innerHTML = '<i class="fa-solid fa-paper-plane"></i> Gửi bình luận';
        } catch (error) {
            console.error("Lỗi khi gửi bình luận:", error);
            alert("Lỗi khi gửi dữ liệu. Vui lòng kiểm tra kết nối mạng!");
            document.getElementById('btn-submit-comment').disabled = false;
        }
    });

    document.getElementById('btn-back-hero').addEventListener('click', () => {
        currentSelectedCategory = null;
        currentLoadedItemId = null; 
        const url = new URL(window.location);
        url.searchParams.delete('lecture');
        window.history.replaceState({}, document.title, url.toString());
        
        if (currentCommentsUnsubscribe) {
            currentCommentsUnsubscribe();
            currentCommentsUnsubscribe = null;
        }
        
        UI.showHeroPage();
        
        if (currentOpenRootCat) {
            const detailSec = document.getElementById('category-detail-section');
            detailSec.style.display = 'flex';
            setTimeout(() => detailSec.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
        } else {
            document.getElementById('category-detail-section').style.display = 'none';
        }
    });

    document.getElementById('btn-close-detail').addEventListener('click', () => {
        currentOpenRootCat = null;
        document.getElementById('category-detail-section').style.display = 'none';
        document.getElementById('dynamic-category-grid').scrollIntoView({ behavior: 'smooth', block: 'start' });
    });

    onAuthStateChanged(auth, async (user) => {
        const badge = document.getElementById('user-status-badge');
        
        if (user) {
            userStorageKey = 'viewedLectures_' + user.uid;
            viewedLectures = JSON.parse(localStorage.getItem(userStorageKey)) || [];

            try {
                const docSnap = await getDoc(doc(db, "users", user.uid));
                if (docSnap.exists()) {
                    const userData = docSnap.data();
                    let tier = userData.vipTier;
                    if (!tier && userData.isVip) tier = 'plus'; 
                    // CHỈNH SỬA: Bảo vệ và đồng bộ hóa chữ thường cho Gói Cước
                    currentUserTier = String(tier || 'free').toLowerCase().trim();
                    currentUserName = userData.fullName || userData.displayName || user.displayName || (user.email ? user.email.split('@')[0] : 'Bạn');
                } else {
                    currentUserTier = 'free';
                    currentUserName = user.displayName || (user.email ? user.email.split('@')[0] : 'Bạn');
                }
            } catch (err) {
                console.error("Lỗi lấy dữ liệu user:", err);
            }
        } else {
            userStorageKey = 'viewedLectures_guest';
            viewedLectures = JSON.parse(localStorage.getItem(userStorageKey)) || [];
            window.location.href = '../dashboard.html';
            return;
        }
        
        UI.updateAuthUI(currentUserTier, badge);
        UI.updateQuotaBanner(currentUserTier, currentUserName, viewedLectures.length, FREE_LIMIT, PLUS_LIMIT);
        
        onSnapshot(doc(db, "settings", "category_tree"), async (docSnap) => {
            if(docSnap.exists() && docSnap.data().tree) {
                globalCategoryTree = docSnap.data().tree;
            } else {
                globalCategoryTree = defaultTree;
                await setDoc(doc(db, "settings", "category_tree"), { tree: globalCategoryTree });
            }
            
            UI.renderCategoryTree(globalCategoryTree, (rootCat) => {
                currentOpenRootCat = rootCat;
                UI.renderCategoryDetail(rootCat, pptxDataList, (lecId, catId, catName) => {
                    currentSelectedCategory = catId;
                    // CHỈNH SỬA: Xóa lệnh ghi đè currentLoadedItemId để loadPptx không bị skip
                    UI.showViewerPage(catName, currentViewMode);
                    renderPptxList(lecId); // Truyền lecId sang hàm render để bôi xanh thẻ
                });
            });
            
            fetchPptxFromDatabase();
        });
        
        syncViewCountToFirestore();
    });
});

function fetchPptxFromDatabase() {
    const q = query(collection(db, "pptx_lectures"), orderBy("createdAt", "asc"));
    
    onSnapshot(q, (snapshot) => {
        pptxDataList = [];
        snapshot.forEach(docSnap => {
            pptxDataList.push({ id: docSnap.id, ...docSnap.data() });
        });
        
        pptxDataList.sort((a, b) => {
            const orderA = a.order !== undefined ? a.order : 999999;
            const orderB = b.order !== undefined ? b.order : 999999;
            if (orderA === orderB) return (a.createdAt?.seconds || 0) - (b.createdAt?.seconds || 0);
            return orderA - orderB;
        });
        
        UI.updateStatsUI(pptxDataList);

        if (currentOpenRootCat && document.getElementById('category-detail-section').style.display !== 'none') {
            UI.renderCategoryDetail(currentOpenRootCat, pptxDataList, (lecId, catId, catName) => {
                currentSelectedCategory = catId;
                // CHỈNH SỬA: Xóa ghi đè ID để loadPptx hoạt động trơn tru
                UI.showViewerPage(catName, currentViewMode);
                renderPptxList(lecId);
            });
        }

        const urlParams = new URLSearchParams(window.location.search);
        const sharedId = urlParams.get('lecture');
        
        if (sharedId && !currentSelectedCategory) {
            const sharedItem = pptxDataList.find(item => item.id === sharedId);
            if (sharedItem) {
                let cat = sharedItem.category || 'mri_pptx';
                let catName = 'Bài giảng được chia sẻ';
                
                const findCatName = (nodes, currentPath = '') => {
                    for(let i=0; i<nodes.length; i++) {
                        const path = currentPath ? `${currentPath} - ${nodes[i].name}` : nodes[i].name;
                        if(nodes[i].id === cat) return path;
                        if(nodes[i].children) {
                            const result = findCatName(nodes[i].children, path);
                            if(result) return result;
                        }
                    }
                    return null;
                };
                
                const foundName = findCatName(globalCategoryTree);
                if(foundName) catName = foundName;

                currentSelectedCategory = cat;
                // CHỈNH SỬA: Xóa lệnh ghi đè ID
                UI.showViewerPage(catName, currentViewMode);
                renderPptxList(sharedId);
                return;
            }
        }

        if (currentSelectedCategory) {
            renderPptxList(); 
        }
    }, (error) => {
        console.error("Lỗi truy xuất Firestore:", error);
        const listContainer = document.getElementById('pptx-list');
        if(listContainer) {
            listContainer.innerHTML = '<li style="padding: 20px; color: #ef4444; text-align: center; font-size: 0.95rem; font-weight: 600;">Lỗi kết nối Database. Vui lòng kiểm tra lại cấu hình Firebase hoặc mạng internet của bạn.</li>';
        }
    });
}

// CHỈNH SỬA: Hàm nhận thêm tham số forceActiveId để biết chính xác bài nào vừa được Click từ trang ngoài
function renderPptxList(forceActiveId = null) {
    const listContainer = document.getElementById('pptx-list');
    const gridContainer = document.getElementById('grid-view-container');
    listContainer.innerHTML = '';
    gridContainer.innerHTML = '';
    
    const filteredList = pptxDataList.filter(item => {
        const itemCat = item.category || 'mri_pptx';
        return itemCat === currentSelectedCategory;
    });
    
    if (filteredList.length === 0) {
        listContainer.innerHTML = '<li style="padding: 20px; color: #64748b; text-align: center; font-size: 0.95rem;">Chưa có bài giảng nào trong nhóm này.</li>';
        gridContainer.innerHTML = '<div style="padding: 20px; color: #64748b; text-align: center; font-size: 0.95rem; width: 100%;">Chưa có bài giảng nào trong nhóm này.</div>';
        document.getElementById('pptx-viewer').src = '';
        document.getElementById('video-viewer').src = '';
        currentLoadedItemId = null;
        UI.hideFeedbackSection(); 
        return;
    }

    // Ưu tiên chọn bài giảng ID được gửi tới, nếu không thì lấy bài giảng đang mở, nếu không có nữa thì lấy bài đầu tiên
    let activeItem = filteredList.find(item => item.id === (forceActiveId || currentLoadedItemId));
    if (!activeItem) activeItem = filteredList[0];

    filteredList.forEach((item) => {
        const isVideo = item.embedUrl && item.embedUrl.includes('firebasestorage.googleapis.com');
        const iconClass = isVideo ? 'fa-circle-play' : 'fa-file-powerpoint';
        const viewCount = item.viewCount || 0;
        
        const li = document.createElement('li');
        li.className = 'pptx-item';
        if (item.id === activeItem.id) li.classList.add('active'); 
        
        li.innerHTML = `
            <div style="display: flex; align-items: flex-start; gap: 12px; flex: 1; padding-right: 10px;">
                <i class="fa-solid ${iconClass}" style="margin-top: 3px; flex-shrink: 0;"></i> 
                <span style="line-height: 1.4; word-break: break-word;">${item.title}</span>
            </div>
            <div style="font-size: 0.85rem; color: #94a3b8; font-weight: 600; display: flex; align-items: center; gap: 10px; flex-shrink: 0;">
                <span><i class="fa-solid fa-eye"></i> ${viewCount}</span>
                <button class="btn-share-item" style="background: none; border: none; color: #3b82f6; cursor: pointer; padding: 5px; font-size: 1rem;" title="Chia sẻ link bài giảng"><i class="fa-solid fa-share-nodes"></i></button>
            </div>
        `;
        li.style.justifyContent = 'space-between';
        
        li.querySelector('.btn-share-item').addEventListener('click', (e) => {
            e.stopPropagation(); 
            const shareUrl = window.location.origin + window.location.pathname + '?lecture=' + item.id;
            navigator.clipboard.writeText(shareUrl).then(() => alert('Đã copy link chia sẻ vào bộ nhớ tạm!\n' + shareUrl));
        });

        li.addEventListener('click', () => {
            document.querySelectorAll('.pptx-item').forEach(el => el.classList.remove('active'));
            li.classList.add('active');
            loadPptx(item.embedUrl, item.id);
        });
        listContainer.appendChild(li);

        const card = document.createElement('div');
        card.className = 'grid-card';
        card.innerHTML = `
            <div class="grid-card-header">
                <i class="fa-solid ${iconClass}"></i>
                <span>${item.title}</span>
            </div>
            <div class="grid-card-thumbnail">
                <i class="fa-solid fa-circle-play play-icon"></i>
                <div class="grid-card-stats" style="display: flex; align-items: center; gap: 12px;">
                    <span><i class="fa-solid fa-eye"></i> ${viewCount}</span>
                    <button class="btn-share-item" style="background: none; border: none; color: white; cursor: pointer; padding: 0;" title="Chia sẻ link bài giảng"><i class="fa-solid fa-share-nodes"></i></button>
                </div>
            </div>
        `;
        card.querySelector('.btn-share-item').addEventListener('click', (e) => {
            e.stopPropagation();
            const shareUrl = window.location.origin + window.location.pathname + '?lecture=' + item.id;
            navigator.clipboard.writeText(shareUrl).then(() => alert('Đã copy link chia sẻ vào bộ nhớ tạm!\n' + shareUrl));
        });

        card.addEventListener('click', () => {
            currentViewMode = 'list';
            const btn = document.getElementById('btn-toggle-view');
            UI.toggleViewModeDisplay(currentViewMode, btn);
            
            document.querySelectorAll('.pptx-item').forEach(el => el.classList.remove('active'));
            li.classList.add('active'); 
            loadPptx(item.embedUrl, item.id);
        });
        gridContainer.appendChild(card);
    });

    if (activeItem && currentViewMode === 'list') {
        loadPptx(activeItem.embedUrl, activeItem.id);
    }
}

async function syncViewCountToFirestore() {
    const user = auth.currentUser;
    if (user) {
        try {
            await updateDoc(doc(db, "users", user.uid), {
                viewedLecturesCount: viewedLectures.length,
                viewedLecturesList: viewedLectures 
            });
        } catch (error) {
            console.error("Lỗi đồng bộ lượt xem lên Admin:", error);
        }
    }
}

async function incrementLectureViewCount(itemId) {
    try {
        await updateDoc(doc(db, "pptx_lectures", itemId), { viewCount: increment(1) });
    } catch (e) {}
}

function loadLectureComments(itemId) {
    if (currentCommentsUnsubscribe) {
        currentCommentsUnsubscribe();
        currentCommentsUnsubscribe = null;
    }
    const q = query(collection(db, `pptx_lectures/${itemId}/comments`), orderBy("createdAt", "desc"));
    currentCommentsUnsubscribe = onSnapshot(q, (snapshot) => {
        const comments = [];
        let totalRate = 0;
        let count = 0;
        snapshot.forEach(doc => {
            const data = doc.data();
            comments.push({ id: doc.id, ...data });
            if (data.rating) {
                totalRate += data.rating;
                count++;
            }
        });
        const avg = count > 0 ? (totalRate / count).toFixed(1) : 0;
        UI.renderComments(comments, avg, count);
    });
}

function loadPptx(embedUrl, itemId) {
    if (currentLoadedItemId === itemId) return;
    
    const lockOverlay = document.getElementById('premium-lock-overlay');
    const iframeContainer = document.getElementById('iframe-container');
    const iframeViewer = document.getElementById('pptx-viewer');
    const videoViewer = document.getElementById('video-viewer');

    let canView = false;
    if (currentUserTier === 'pro') {
        canView = true;
        if (!viewedLectures.includes(itemId)) {
            viewedLectures.push(itemId);
            localStorage.setItem(userStorageKey, JSON.stringify(viewedLectures));
            syncViewCountToFirestore(); 
        }
    } else if (viewedLectures.includes(itemId)) {
        canView = true;
    } else {
        if (currentUserTier === 'plus' && viewedLectures.length < PLUS_LIMIT) {
            canView = true;
            viewedLectures.push(itemId);
            localStorage.setItem(userStorageKey, JSON.stringify(viewedLectures));
            UI.updateQuotaBanner(currentUserTier, currentUserName, viewedLectures.length, FREE_LIMIT, PLUS_LIMIT);
            syncViewCountToFirestore(); 
        } else if (currentUserTier === 'free' && viewedLectures.length < FREE_LIMIT) {
            canView = true;
            viewedLectures.push(itemId);
            localStorage.setItem(userStorageKey, JSON.stringify(viewedLectures));
            UI.updateQuotaBanner(currentUserTier, currentUserName, viewedLectures.length, FREE_LIMIT, PLUS_LIMIT);
            syncViewCountToFirestore(); 
        }
    }

    if (canView) {
        // CHỈNH SỬA: Chỉ chính thức gán ID đã xem khi vượt qua được màng lọc phân quyền
        currentLoadedItemId = itemId;
        incrementLectureViewCount(itemId);

        lockOverlay.style.display = 'none';
        iframeContainer.style.display = 'block';
        
        // CHỈNH SỬA: Bọc Link bằng SafeString phòng hờ Admin quên nhập Link mà web vẫn không sập
        const safeUrl = embedUrl || '';
        const isVideoUpload = safeUrl.includes('firebasestorage.googleapis.com');
        
        if (isVideoUpload) {
            iframeViewer.style.display = 'none';
            iframeViewer.src = '';
            videoViewer.style.display = 'block';
            videoViewer.src = safeUrl;
        } else {
            videoViewer.style.display = 'none';
            videoViewer.src = '';
            iframeViewer.style.display = 'block';
            iframeViewer.src = safeUrl;
        }

        UI.showFeedbackSection();
        UI.resetRating();
        loadLectureComments(itemId);

    } else {
        lockOverlay.style.display = 'flex';
        iframeContainer.style.display = 'none';
        iframeViewer.src = ''; 
        videoViewer.src = ''; 
        UI.hideFeedbackSection();
    }
}
