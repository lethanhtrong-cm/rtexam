import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
// SỬA ĐỔI: Import thêm updateDoc để cập nhật dữ liệu lên Firestore
import { getFirestore, doc, getDoc, updateDoc, collection, query, orderBy, onSnapshot } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

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
                } else {
                    currentUserTier = 'free';
                    currentUserName = user.displayName || (user.email ? user.email.split('@')[0] : 'Bạn');
                    
                    updateAuthUI('free', badge);
                    updateQuotaBanner();
                    fetchPptxFromDatabase();
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
    
    document.getElementById('hero-page').style.display = 'flex';
    document.getElementById('viewer-page').style.display = 'none';
    
    document.getElementById('current-category-label').style.display = 'none';
    document.getElementById('btn-back-hero').style.display = 'none';
    
    document.getElementById('pptx-viewer').src = '';
    document.getElementById('video-viewer').src = '';
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
        return;
    }

    filteredList.forEach((item, index) => {
        const li = document.createElement('li');
        li.className = 'pptx-item';
        if (index === 0) li.classList.add('active'); 
        
        const isVideo = item.embedUrl && item.embedUrl.includes('firebasestorage.googleapis.com');
        const iconClass = isVideo ? 'fa-circle-play' : 'fa-file-powerpoint';
        
        li.innerHTML = `<i class="fa-solid ${iconClass}"></i> <span>${item.title}</span>`;
        
        li.addEventListener('click', () => {
            document.querySelectorAll('.pptx-item').forEach(el => el.classList.remove('active'));
            li.classList.add('active');
            
            loadPptx(item.embedUrl, item.id);
        });
        
        listContainer.appendChild(li);
    });

    if (filteredList.length > 0) {
        loadPptx(filteredList[0].embedUrl, filteredList[0].id);
    }
}

// SỬA ĐỔI: Hàm đồng bộ số lượt xem lên Firebase để Admin đọc
async function syncViewCountToFirestore() {
    const user = auth.currentUser;
    if (user) {
        try {
            await updateDoc(doc(db, "users", user.uid), {
                viewedLecturesCount: viewedLectures.length,
                viewedLecturesList: viewedLectures // Lưu cả danh sách ID bài đã xem
            });
        } catch (error) {
            console.error("Lỗi đồng bộ lượt xem lên Admin:", error);
        }
    }
}

function loadPptx(embedUrl, itemId) {
    const lockOverlay = document.getElementById('premium-lock-overlay');
    const iframeContainer = document.getElementById('iframe-container');
    const iframeViewer = document.getElementById('pptx-viewer');
    const videoViewer = document.getElementById('video-viewer');

    let canView = false;

    if (currentUserTier === 'pro') {
        canView = true;
        // SỬA ĐỔI: Lưu vết cho cả tài khoản PRO để Admin có thể thống kê
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
            syncViewCountToFirestore(); // Gửi lên Firestore
        } else if (currentUserTier === 'free' && viewedLectures.length < FREE_LIMIT) {
            canView = true;
            viewedLectures.push(itemId);
            localStorage.setItem(userStorageKey, JSON.stringify(viewedLectures));
            updateQuotaBanner();
            syncViewCountToFirestore(); // Gửi lên Firestore
        }
    }

    if (canView) {
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
