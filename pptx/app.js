import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, doc, getDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// Cấu hình Firebase (Lấy lại cấu hình từ file main.js của bạn)
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

// Data giả lập: Danh sách các bài giảng PPTX (Bạn sẽ thay link iframe thật vào thuộc tính embedUrl)
const pptxDataList = [
    { id: 1, title: "Giải phẫu MRI Sọ não cơ bản", embedUrl: "https://docs.google.com/presentation/d/e/2PACX-1vQ_T_YOUR_LINK_HERE/embed?start=false&loop=false&delayms=3000" },
    { id: 2, title: "Kỹ thuật chụp MRI Cột sống", embedUrl: "https://docs.google.com/presentation/d/e/2PACX-1vQ_T_YOUR_LINK_HERE/embed?start=false&loop=false&delayms=3000" },
    { id: 3, title: "Nhận diện xảo ảnh trong MRI", embedUrl: "https://docs.google.com/presentation/d/e/2PACX-1vQ_T_YOUR_LINK_HERE/embed?start=false&loop=false&delayms=3000" }
];

let currentUserTier = 'free';

document.addEventListener('DOMContentLoaded', () => {
    // Lắng nghe trạng thái đăng nhập
    onAuthStateChanged(auth, async (user) => {
        const badge = document.getElementById('user-status-badge');
        
        if (user) {
            try {
                const docSnap = await getDoc(doc(db, "users", user.uid));
                if (docSnap.exists()) {
                    const userData = docSnap.data();
                    let tier = userData.vipTier;
                    // Xử lý fallback nếu account là vip nhưng chưa có vipTier định danh
                    if (!tier && userData.isVip) tier = 'plus'; 
                    
                    currentUserTier = tier || 'free';
                    updateAuthUI(currentUserTier, badge);
                    renderPptxList();
                } else {
                    currentUserTier = 'free';
                    updateAuthUI('free', badge);
                    renderPptxList();
                }
            } catch (err) {
                console.error("Lỗi lấy dữ liệu user:", err);
            }
        } else {
            // Chưa đăng nhập đẩy về trang dashboard/login
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

function renderPptxList() {
    const listContainer = document.getElementById('pptx-list');
    listContainer.innerHTML = '';

    pptxDataList.forEach((item, index) => {
        const li = document.createElement('li');
        li.className = 'pptx-item';
        if (index === 0) li.classList.add('active'); // Mặc định active bài đầu tiên
        
        li.innerHTML = `<i class="fa-solid fa-file-powerpoint"></i> <span>${item.title}</span>`;
        
        li.addEventListener('click', () => {
            // Xóa active cũ, gán active mới
            document.querySelectorAll('.pptx-item').forEach(el => el.classList.remove('active'));
            li.classList.add('active');
            
            // Xử lý nạp file
            loadPptx(item.embedUrl);
        });
        
        listContainer.appendChild(li);
    });

    // Mặc định load bài đầu tiên
    if (pptxDataList.length > 0) {
        loadPptx(pptxDataList[0].embedUrl);
    }
}

function loadPptx(embedUrl) {
    const lockOverlay = document.getElementById('premium-lock-overlay');
    const iframeContainer = document.getElementById('iframe-container');
    const iframeViewer = document.getElementById('pptx-viewer');

    if (currentUserTier === 'plus' || currentUserTier === 'pro') {
        // Cho phép xem
        lockOverlay.style.display = 'none';
        iframeContainer.style.display = 'block';
        iframeViewer.src = embedUrl;
    } else {
        // Khóa đối với gói Free
        lockOverlay.style.display = 'flex';
        iframeContainer.style.display = 'none';
        iframeViewer.src = ''; 
    }
}
