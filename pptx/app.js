import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, doc, getDoc, updateDoc, collection, query, orderBy, onSnapshot, increment } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyDqdo_DJIWa5iqxiCgBq-0iGX7f9sr6soo",
    authDomain: "rt-examination.firebaseapp.com",
    projectId: "rt-examination",
    storageBucket: "rt-examination.firebasestorage.app",
    messagingSenderId: "920482699854",
    appId: "1:920482699854:web:44f9b0d735bdc001c6c11f",
    measurementId: "G-8N7RTTREQM"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const FREE_LIMIT = 3;
const PLUS_LIMIT = 5;

let currentUserTier = 'free';
let currentUserName = 'Bạn'; 
let pptxDataList = []; 
let currentSelectedCategory = null; 

let currentLoadedItemId = null; 
let viewedLectures = []; 
let userStorageKey = 'viewedLectures_guest';

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

    document.querySelectorAll('.category-card').forEach(card => {
        card.addEventListener('click', () => {
            if (card.id === 'card-mri') {
                const subList = card.querySelector('.sub-category-list');
                const isHidden = subList.style.display === 'none';
                subList.style.display = isHidden ? 'flex' : 'none';
                return;
            }
            const catId = card.getAttribute('data-cat');
            const catName = card.getAttribute('data-name');
            if(catId && catName) {
                showViewerPage(catId, catName);
            }
        });
    });

    document.querySelectorAll('.btn-sub-cat').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation(); 
            const catId = btn.getAttribute('data-cat');
            const catName = btn.getAttribute('data-name');
            showViewerPage(catId, catName);
        });
    });

    document.getElementById('btn-back-hero').addEventListener('click', showHeroPage);

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
                    
                    updateAuthUI(currentUserTier, badge);
                    updateQuotaBanner();
                    fetchPptxFromDatabase();
                    syncViewCountToFirestore();
                } else {
                    currentUserTier = 'free';
                    currentUserName = user.displayName || (user.email ? user.email.split('@')[0] : 'Bạn');
                    
                    updateAuthUI('free', badge);
                    updateQuotaBanner();
                    fetchPptxFromDatabase();
                    syncViewCountToFirestore();
                }
            } catch (err) {
                console.error("Lỗi lấy dữ liệu user:", err);
            }
        } else {
            userStorageKey = 'viewedLectures_guest';
            viewedLectures = JSON.parse(localStorage.getItem(userStorageKey)) || [];
            window.location.href = '../dashboard.html';
        }
    });
});

function updateAuthUI(tier, badgeElement) {
    if (tier === 'plus') {
        badgeElement.className = 'badge badge-plus';
        badgeElement.innerHTML = '<i class="fa-solid fa-shield-halved"></i> GÓI PLUS';
    } else if (tier === 'pro') {
        badgeElement.className = 'badge badge-pro';
        badgeElement.innerHTML = '<i class="fa-solid fa-crown"></i> GÓI PRO';
    } else {
        badgeElement.className = 'badge badge-free';
        badgeElement.innerHTML = 'GÓI FREE';
    }
}

function updateQuotaBanner() {
    const banner = document.getElementById('quota-banner');
    const greetingText = document.getElementById('quota-greeting-text');
    const statusText = document.getElementById('quota-status-text');
    const remainingText = document.getElementById('quota-remaining-text');

    if (!banner || !statusText || !remainingText) return;

    if (greetingText) {
        greetingText.innerHTML = `Xin chào, <strong>${currentUserName}</strong>!`;
    }

    const tierName = currentUserTier.toUpperCase();
    statusText.innerHTML = `Bạn đang sử dụng quyền lợi của gói: <strong>${tierName}</strong>`;

    if (currentUserTier === 'pro') {
        remainingText.innerHTML = `Lượt xem bài giảng: <strong>Không giới hạn</strong>`;
        banner.className = 'quota-banner pro-banner';
    } else if (currentUserTier === 'plus') {
        const remaining = PLUS_LIMIT - viewedLectures.length;
        remainingText.innerHTML = `Lượt mở xem bài giảng còn lại: <strong>${remaining > 0 ? remaining : 0} bài</strong>`;
        banner.className = 'quota-banner plus-banner';
    } else {
        const remaining = FREE_LIMIT - viewedLectures.length;
        remainingText.innerHTML = `Lượt mở xem bài giảng còn lại: <strong>${remaining > 0 ? remaining : 0} bài</strong>`;
        banner.className = 'quota-banner free-banner';
    }
}

function showViewerPage(categoryId, categoryName) {
    currentSelectedCategory = categoryId;
    currentLoadedItemId = null; 
    
    document.getElementById('hero-page').style.display = 'none';
    document.getElementById('viewer-page').style.display = 'flex';
    
    const label = document.getElementById('current-category-label');
    label.innerText = 'Nhóm: ' + categoryName;
    label.style.display = 'inline-block';
    
    document.getElementById('btn-back-hero').style.display = 'inline-flex';
    
    renderPptxList();
}

function showHeroPage() {
    currentSelectedCategory = null;
    currentLoadedItemId = null; 
    
    document.getElementById('hero-page').style.display = 'flex';
    document.getElementById('viewer-page').style.display = 'none';
    
    document.getElementById('current-category-label').style.display = 'none';
    document.getElementById('btn-back-hero').style.display = 'none';
    
    document.getElementById('pptx-viewer').src = '';
    document.getElementById('video-viewer').src = '';
}

// THÊM MỚI: Hàm tính toán và cập nhật các ô Thống kê trên giao diện
function updateStatsUI() {
    const statCategories = document.getElementById('stat-categories');
    const statLectures = document.getElementById('stat-lectures');
    const statViews = document.getElementById('stat-views');
    
    if (statCategories && statLectures && statViews) {
        let totalViews = 0;
        const uniqueRootCategories = new Set();
        
        pptxDataList.forEach(item => {
            totalViews += (item.viewCount || 0);
            let cat = item.category || 'mri';
            if (cat === 'mri') cat = 'mri_pptx';
            // Gom nhóm mri_pptx và mri_video thành 1 nhóm chuyên khoa gốc 'mri'
            const rootCat = cat.split('_')[0]; 
            uniqueRootCategories.add(rootCat);
        });

        // Nếu chưa có dữ liệu, hiển thị mặc định 4 nhóm tĩnh (MRI, CT, X-quang, Thuốc TP)
        statCategories.innerText = uniqueRootCategories.size > 0 ? uniqueRootCategories.size : 4;
        statLectures.innerText = pptxDataList.length;
        statViews.innerText = totalViews.toLocaleString('vi-VN');
    }
}

function fetchPptxFromDatabase() {
    const q = query(collection(db, "pptx_lectures"), orderBy("createdAt", "asc"));
    
    onSnapshot(q, (snapshot) => {
        pptxDataList = [];
        snapshot.forEach(docSnap => {
            pptxDataList.push({
                id: docSnap.id,
                ...docSnap.data()
            });
        });
        
        // Gọi hàm cập nhật số liệu thống kê sau khi tải dữ liệu xong
        updateStatsUI();

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
    listContainer.innerHTML = '';
    
    const filteredList = pptxDataList.filter(item => {
        const itemCat = item.category || 'mri';
        const normalizedCat = itemCat === 'mri' ? 'mri_pptx' : itemCat;
        return normalizedCat === currentSelectedCategory;
    });
    
    if (filteredList.length === 0) {
        listContainer.innerHTML = '<li style="padding: 20px; color: #64748b; text-align: center; font-size: 0.95rem;">Chưa có bài giảng nào trong nhóm này.</li>';
        document.getElementById('pptx-viewer').src = '';
        document.getElementById('video-viewer').src = '';
        currentLoadedItemId = null;
        return;
    }

    let activeItem = filteredList.find(item => item.id === currentLoadedItemId);
    if (!activeItem) {
        activeItem = filteredList[0];
    }

    filteredList.forEach((item) => {
        const li = document.createElement('li');
        li.className = 'pptx-item';
        
        if (item.id === activeItem.id) {
            li.classList.add('active'); 
        }
        
        const isVideo = item.embedUrl && item.embedUrl.includes('firebasestorage.googleapis.com');
        const iconClass = isVideo ? 'fa-circle-play' : 'fa-file-powerpoint';
        const viewCount = item.viewCount || 0;
        
        li.innerHTML = `
            <div style="display: flex; align-items: center; gap: 12px;">
                <i class="fa-solid ${iconClass}"></i> <span>${item.title}</span>
            </div>
            <div style="font-size: 0.85rem; color: #94a3b8; font-weight: 600;">
                <i class="fa-solid fa-eye"></i> ${viewCount}
            </div>
        `;
        li.style.justifyContent = 'space-between';
        
        li.addEventListener('click', () => {
            document.querySelectorAll('.pptx-item').forEach(el => el.classList.remove('active'));
            li.classList.add('active');
            
            loadPptx(item.embedUrl, item.id);
        });
        
        listContainer.appendChild(li);
    });

    if (activeItem) {
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
            updateQuotaBanner();
            syncViewCountToFirestore(); 
        } else if (currentUserTier === 'free' && viewedLectures.length < FREE_LIMIT) {
            canView = true;
            viewedLectures.push(itemId);
            localStorage.setItem(userStorageKey, JSON.stringify(viewedLectures));
            updateQuotaBanner();
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

    } else {
        lockOverlay.style.display = 'flex';
        iframeContainer.style.display = 'none';
        iframeViewer.src = ''; 
        videoViewer.src = ''; 
    }
}
