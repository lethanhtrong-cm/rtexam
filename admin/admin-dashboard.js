import { db } from './admin-core.js';
import { 
    collection, getDocs, query, where, getCountFromServer
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

let timeChartInstance = null;
let levelChartInstance = null;
let techChartInstance = null;
let isDashboardStatsLoaded = false; // CỜ CACHE CHỐNG SPAM DỮ LIỆU TỔNG

// --- CỜ CACHE CHO ĐẾM SỐ LƯỢNG REALTIME ---
let isLiveCountsLoaded = false;
let cachedOnlineCount = 0;
let cachedTestingCount = 0;

export function initDashboardRealtime(forceRefresh = false) {
    // NẾU KHÔNG ÉP LÀM MỚI VÀ ĐÃ CÓ DATA -> DÙNG CACHE, KHÔNG GỌI API FIREBASE
    if (!forceRefresh && isLiveCountsLoaded) {
        const onlineEl = document.getElementById('dash-online-users');
        const testingEl = document.getElementById('dash-testing-users');
        if (onlineEl) onlineEl.innerText = cachedOnlineCount;
        if (testingEl) testingEl.innerText = cachedTestingCount;
        return;
    }

    const fetchLiveCounts = async () => {
        try {
            const usersRef = collection(db, "users");
            
            // --- ĐẾM SỐ NGƯỜI ĐANG THI ---
            const qTesting = query(usersRef, where("examStatus", "==", "testing"));
            const snapTesting = await getCountFromServer(qTesting);
            cachedTestingCount = snapTesting.data().count;

            // --- ĐẾM SỐ NGƯỜI ONLINE ---
            const qOnline = query(usersRef, where("isOnline", "==", true));
            const snapOnline = await getCountFromServer(qOnline);
            cachedOnlineCount = snapOnline.data().count + 1; // Mặc định cộng 1 cho Admin

            // In dữ liệu ra giao diện
            const onlineEl = document.getElementById('dash-online-users');
            const testingEl = document.getElementById('dash-testing-users');
            
            if (onlineEl) onlineEl.innerText = cachedOnlineCount;
            if (testingEl) testingEl.innerText = cachedTestingCount;
            
            isLiveCountsLoaded = true; // LƯU CỜ THÀNH CÔNG ĐỂ TÁI SỬ DỤNG LẦN SAU

        } catch (error) {
            console.error("Lỗi khi đếm dữ liệu từ server:", error);
            isLiveCountsLoaded = false;
            
            // Hiển thị cảnh báo trực quan khi bị Firebase chặn (Quota/Rate Limit)
            if (error.message && (error.message.includes('Quota') || error.message.includes('resource-exhausted') || error.code === 'resource-exhausted')) {
                const onlineEl = document.getElementById('dash-online-users');
                const testingEl = document.getElementById('dash-testing-users');
                
                if (onlineEl) {
                    onlineEl.innerHTML = `<span style="font-size: 13px; color: #ef4444; font-weight: 700;"><i class="fa-solid fa-triangle-exclamation"></i> Hết hạn mức</span>`;
                }
                if (testingEl) {
                    testingEl.innerHTML = `<span style="font-size: 13px; color: #ef4444; font-weight: 700;"><i class="fa-solid fa-triangle-exclamation"></i> Hết hạn mức</span>`;
                }
            }
        }
    };

    fetchLiveCounts();
}

export async function loadDashboardStats(forceRefresh = false) {
    if (!forceRefresh && isDashboardStatsLoaded) return;

    try {
        const [resultsSnap, examsSnap] = await Promise.all([
            getDocs(collection(db, "results")),
            getDocs(collection(db, "exams"))
        ]);

        const examsMap = {};
        examsSnap.forEach(docSnap => {
            examsMap[docSnap.id] = docSnap.data();
        });

        let countToday = 0, countWeek = 0, countMonth = 0, countYear = 0;
        const now = new Date();
        now.setHours(0,0,0,0); 

        let timeStats = { "15": 0, "30": 0, "45": 0 };
        let levelStats = { "Dễ": 0, "Trung bình": 0, "Khó": 0 };
        let techStats = { "MRI": 0, "CT": 0, "X quang": 0, "Hỗn hợp": 0 };

        resultsSnap.forEach(docSnap => {
            const data = docSnap.data();
            
            let examDate = null;
            if (data.timestamp) {
                if (typeof data.timestamp.toDate === 'function') {
                    examDate = data.timestamp.toDate();
                } else {
                    examDate = new Date(data.timestamp);
                }
            }

            if (examDate) {
                const diffTime = Math.abs(new Date() - examDate);
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
                
                if (examDate.toDateString() === new Date().toDateString()) countToday++;
                if (diffDays <= 7) countWeek++;
                if (diffDays <= 30) countMonth++;
                if (diffDays <= 365) countYear++;
            }

            const eCode = data.examId || data.examCode || data.quizId;
            
            if (eCode && examsMap[eCode]) {
                const config = examsMap[eCode];
                if (timeStats[config.timeLimit] !== undefined) timeStats[config.timeLimit]++;
                if (levelStats[config.level] !== undefined) levelStats[config.level]++;
                if (techStats[config.technique] !== undefined) techStats[config.technique]++;
            }
        });

        document.getElementById('dash-day-users').innerText = countToday;
        document.getElementById('dash-week-users').innerText = countWeek;
        document.getElementById('dash-month-users').innerText = countMonth;
        document.getElementById('dash-year-users').innerText = countYear;

        renderCharts(timeStats, levelStats, techStats);
        isDashboardStatsLoaded = true; 

    } catch (error) {
        console.error("Lỗi khi tải dữ liệu Dashboard:", error);
        isDashboardStatsLoaded = false;
        
        if (error.message && (error.message.includes('Quota') || error.message.includes('resource-exhausted') || error.code === 'resource-exhausted')) {
            const els = ['dash-day-users', 'dash-week-users', 'dash-month-users', 'dash-year-users'];
            els.forEach(id => {
                const el = document.getElementById(id);
                if (el) el.innerHTML = `<span style="font-size: 13px; color: #ef4444;"><i class="fa-solid fa-triangle-exclamation"></i> Hết hạn mức</span>`;
            });
        }
    }
}

function renderCharts(timeStats, levelStats, techStats) {
    const ctxTime = document.getElementById('chart-time');
    if (ctxTime) {
        if (timeChartInstance) timeChartInstance.destroy();
        timeChartInstance = new Chart(ctxTime.getContext('2d'), {
            type: 'pie',
            data: {
                labels: ['15 Phút', '30 Phút', '45 Phút'],
                datasets: [{
                    data: [timeStats['15'], timeStats['30'], timeStats['45']],
                    backgroundColor: ['#3b82f6', '#10b981', '#f59e0b'],
                    borderWidth: 0
                }]
            },
            options: { responsive: true, maintainAspectRatio: false }
        });
    }

    const ctxLevel = document.getElementById('chart-level');
    if (ctxLevel) {
        if (levelChartInstance) levelChartInstance.destroy();
        levelChartInstance = new Chart(ctxLevel.getContext('2d'), {
            type: 'bar',
            data: {
                labels: ['Dễ', 'Trung bình', 'Khó'],
                datasets: [{
                    label: 'Số lượt chọn',
                    data: [levelStats['Dễ'], levelStats['Trung bình'], levelStats['Khó']],
                    backgroundColor: ['#10b981', '#f59e0b', '#ef4444'],
                    borderRadius: 5
                }]
            },
            options: { 
                responsive: true, 
                maintainAspectRatio: false,
                scales: { y: { beginAtZero: true, ticks: { precision: 0 } } },
                plugins: { legend: { display: false } }
            }
        });
    }

    const ctxTech = document.getElementById('chart-tech');
    if (ctxTech) {
        if (techChartInstance) techChartInstance.destroy();
        techChartInstance = new Chart(ctxTech.getContext('2d'), {
            type: 'doughnut',
            data: {
                labels: ['MRI', 'CT', 'X quang', 'Hỗn hợp'],
                datasets: [{
                    data: [techStats['MRI'], techStats['CT'], techStats['X quang'], techStats['Hỗn hợp']],
                    backgroundColor: ['#3b82f6', '#8b5cf6', '#ec4899', '#64748b'],
                    borderWidth: 0
                }]
            },
            options: { responsive: true, maintainAspectRatio: false }
        });
    }
}

document.addEventListener('componentsLoaded', () => {
    // Lần đầu mở trang: Gọi hàm để đọc từ Firebase (Load thực tế)
    initDashboardRealtime();
    loadDashboardStats();
    
    // Tải lại dữ liệu đếm mỗi khi Admin bấm chuyển lại tab Dashboard
    const sidebarMenuItems = document.querySelectorAll('.menu-item');
    sidebarMenuItems.forEach(item => {
        item.addEventListener('click', (e) => {
            const target = item.getAttribute('data-target');
            if (target === 'tab-dashboard') {
                loadDashboardStats(false); // Truỳn false để tái sử dụng CACHE
                initDashboardRealtime(false); // Truỳn false để tái sử dụng CACHE, chống lỗi 429
            }
        });
    });
});
