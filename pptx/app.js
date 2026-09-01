import { auth, db } from "./firebase-config.js";
import { UI } from "./app-ui.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { doc, getDoc, updateDoc, collection, query, orderBy, onSnapshot, increment, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

const FREE_LIMIT = 3;
const PLUS_LIMIT = 5;

let currentUserTier = 'free';
let currentUserName = 'Bạn'; 
let pptxDataList = []; 
let currentSelectedCategory = null; 

let currentViewMode = 'list'; 
let currentLoadedItemId = null; 
let viewedLectures = []; 
let userStorageKey = 'viewedLectures_guest';

let currentCommentsUnsubscribe = null; 

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
    UI.initMobileCommentToggle(); // Gọi thêm hàm cho Mobile

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

    document.querySelectorAll('.category-card').forEach(card => {
        card.addEventListener('click', () => {
            const catId = card.getAttribute('data-cat');
            const catName = card.getAttribute('data-name');
            if(catId && catName) {
                currentSelectedCategory = catId;
                currentLoadedItemId = null; 
                UI.showViewerPage(catName, currentViewMode);
                renderPptxList();
            }
        });
    });

    document.querySelectorAll('.btn-sub-cat').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation(); 
            const catId = btn.getAttribute('data-cat');
            const catName = btn.getAttribute('data-name');
            if(catId && catName) {
                currentSelectedCategory = catId;
                currentLoadedItemId = null; 
                UI.showViewerPage(catName, currentViewMode);
                renderPptxList();
            }
        });
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
                    
                    currentUserTier = tier || 'free';
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
        fetchPptxFromDatabase();
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
        
        UI.updateStatsUI(pptxDataList);

        const urlParams = new URLSearchParams(window.location.search);
        const sharedId = urlParams.get('lecture');
        
        if (sharedId && !currentSelectedCategory) {
            const sharedItem = pptxDataList.find(item => item.id === sharedId);
            if (sharedItem) {
                let cat = sharedItem.category || 'mri';
                const normalizedCat = cat === 'mri' ? 'mri_pptx' : cat;
                let catName = 'Bài giảng được chia sẻ';
                
                document.querySelectorAll('.category-card, .btn-sub-cat').forEach(el => {
                    if (el.getAttribute('data-cat') === normalizedCat) {
                        catName = el.getAttribute('data-name');
                    }
                });

                currentSelectedCategory = normalizedCat;
                currentLoadedItemId = sharedId;
                UI.showViewerPage(catName, currentViewMode);
                renderPptxList();
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

function renderPptxList() {
    const listContainer = document.getElementById('pptx-list');
    const gridContainer = document.getElementById('grid-view-container');
    
    listContainer.innerHTML = '';
    gridContainer.innerHTML = '';
    
    const filteredList = pptxDataList.filter(item => {
        const itemCat = item.category || 'mri';
        const normalizedCat = itemCat === 'mri' ? 'mri_pptx' : itemCat;
        return normalizedCat === currentSelectedCategory;
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

    let activeItem = filteredList.find(item => item.id === currentLoadedItemId);
    if (!activeItem) {
        activeItem = filteredList[0];
    }

    filteredList.forEach((item) => {
        const isVideo = item.embedUrl && item.embedUrl.includes('firebasestorage.googleapis.com');
        const iconClass = isVideo ? 'fa-circle-play' : 'fa-file-powerpoint';
        const viewCount = item.viewCount || 0;
        
        const li = document.createElement('li');
        li.className = 'pptx-item';
        if (item.id === activeItem.id) li.classList.add('active'); 
        
        li.innerHTML = `
            <div style="display: flex; align-items: center; gap: 12px; max-width: 65%; overflow: hidden;">
                <i class="fa-solid ${iconClass}"></i> 
                <span style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${item.title}">${item.title}</span>
            </div>
            <div style="font-size: 0.85rem; color: #94a3b8; font-weight: 600; display: flex; align-items: center; gap: 10px;">
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
        await updateDoc(doc(db, "pptx_lectures", itemId), {
            viewCount: increment(1)
        });
    } catch (e) {
        console.error("Lỗi tăng lượt xem bài giảng:", e);
    }
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
        currentLoadedItemId = itemId;
        incrementLectureViewCount(itemId);

        lockOverlay.style.display = 'none';
        iframeContainer.style.display = 'block';
        
        const isVideoUpload = embedUrl.includes('firebasestorage.googleapis.com');
        if (isVideoUpload) {
            iframeViewer.style.display = 'none';
            iframeViewer.src = '';
            
            videoViewer.style.display = 'block';
            videoViewer.src = embedUrl;
        } else {
            videoViewer.style.display = 'none';
            videoViewer.src = '';
            
            iframeViewer.style.display = 'block';
            iframeViewer.src = embedUrl;
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
