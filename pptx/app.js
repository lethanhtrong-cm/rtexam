import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, doc, getDoc, collection, query, orderBy, onSnapshot } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// Cấu hình Firebase
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

let currentUserTier = 'free';
let pptxDataList = []; // Toàn bộ dữ liệu
let currentSelectedCategory = null; // Thể loại đang xem

document.addEventListener('DOMContentLoaded', () => {
    // Bảo vệ bản quyền
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

    // Bắt sự kiện Click vào Card Chuyên Khoa ở Hero Page
    document.querySelectorAll('.category-card').forEach(card => {
        card.addEventListener('click', () => {
            const catId = card.getAttribute('data-cat');
            const catName = card.getAttribute('data-name');
            showViewerPage(catId, catName);
        });
    });

    // Bắt sự kiện quay lại Hero Page
    document.getElementById('btn-back-hero').addEventListener('click', showHeroPage);

    // 1. Kiểm tra Auth và Quyền
    onAuthStateChanged(auth, async (user) => {
        const badge = document.getElementById('user-status-badge');
        
        if (user) {
            try {
                const docSnap = await getDoc(doc(db, "users", user.uid));
                if (docSnap.exists()) {
                    const userData = docSnap.data();
                    let tier = userData.vipTier;
                    if (!tier && userData.isVip) tier = 'plus'; 
                    
                    currentUserTier = tier || 'free';
                    updateAuthUI(currentUserTier, badge);
                    
                    fetchPptxFromDatabase();
                } else {
                    currentUserTier = 'free';
                    updateAuthUI('free', badge);
                    fetchPptxFromDatabase();
                }
            } catch (err) {
                console.error("Lỗi lấy dữ liệu user:", err);
            }
        } else {
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

// Logic Chuyển Giao Diện
function showViewerPage(categoryId, categoryName) {
    currentSelectedCategory = categoryId;
    
    document.getElementById('hero-page').style.display = 'none';
    document.getElementById('viewer-page').style.display = 'flex';
    
    const label = document.getElementById('current-category-label');
    label.innerText = 'Nhóm: ' + categoryName;
    label.style.display = 'inline-block';
    
    document.getElementById('btn-back-hero').style.display = 'inline-flex';
    
    // Gọi lại hàm render để lọc dữ liệu theo Category
    renderPptxList();
}

function showHeroPage() {
    currentSelectedCategory = null;
    
    document.getElementById('hero-page').style.display = 'flex';
    document.getElementById('viewer-page').style.display = 'none';
    
    document.getElementById('current-category-label').style.display = 'none';
    document.getElementById('btn-back-hero').style.display = 'none';
    
    // Tắt iframe để dừng load mạng và âm thanh (nếu có)
    document.getElementById('pptx-viewer').src = '';
}

// Kéo dữ liệu thực từ Firestore Database kèm Cơ chế Bắt Lỗi
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
        
        // Chỉ render lại danh sách nếu đang ở màn hình Viewer
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
    
    // Logic Lọc: Nếu bài giảng cũ không có category, mặc định nó thuộc 'mri'
    const filteredList = pptxDataList.filter(item => {
        const itemCat = item.category || 'mri';
        return itemCat === currentSelectedCategory;
    });
    
    if (filteredList.length === 0) {
        listContainer.innerHTML = '<li style="padding: 20px; color: #64748b; text-align: center; font-size: 0.95rem;">Chưa có bài giảng nào trong nhóm này.</li>';
        document.getElementById('pptx-viewer').src = '';
        return;
    }

    filteredList.forEach((item, index) => {
        const li = document.createElement('li');
        li.className = 'pptx-item';
        if (index === 0) li.classList.add('active'); 
        
        li.innerHTML = `<i class="fa-solid fa-file-powerpoint"></i> <span>${item.title}</span>`;
        
        li.addEventListener('click', () => {
            document.querySelectorAll('.pptx-item').forEach(el => el.classList.remove('active'));
            li.classList.add('active');
            loadPptx(item.embedUrl);
        });
        
        listContainer.appendChild(li);
    });

    // Auto load bài đầu tiên của danh sách đã lọc
    if (filteredList.length > 0) {
        loadPptx(filteredList[0].embedUrl);
    }
}

function loadPptx(embedUrl) {
    const lockOverlay = document.getElementById('premium-lock-overlay');
    const iframeContainer = document.getElementById('iframe-container');
    const iframeViewer = document.getElementById('pptx-viewer');

    if (currentUserTier === 'plus' || currentUserTier === 'pro') {
        lockOverlay.style.display = 'none';
        iframeContainer.style.display = 'block';
        iframeViewer.src = embedUrl;
    } else {
        lockOverlay.style.display = 'flex';
        iframeContainer.style.display = 'none';
        iframeViewer.src = ''; 
    }
}
