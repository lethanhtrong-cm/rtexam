import { db } from './admin-core.js';
import { 
    collection, getDocs, query, where, getCountFromServer
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

let timeChartInstance = null;
let levelChartInstance = null;
let techChartInstance = null;

export function initDashboardRealtime() {
    // Hàm đếm số liệu trực tiếp trên Server Firebase (Tối ưu chi phí Read tuyệt đối)
    const fetchLiveCounts = async () => {
        try {
            const usersRef = collection(db, "users");
            
            // --- ĐẾM SỐ NGƯỜI ĐANG THI ---
            // Yêu cầu Client khi vào thi phải cập nhật field: examStatus = 'testing'
            const qTesting = query(usersRef, where("examStatus", "==", "testing"));
            const snapTesting = await getCountFromServer(qTesting);
            const testingCount = snapTesting.data().count;

            // --- ĐẾM SỐ NGƯỜI ONLINE ---
            // Yêu cầu Client khi đăng nhập phải cập nhật field: isOnline = true
            const qOnline = query(usersRef, where("isOnline", "==", true));
            const snapOnline = await getCountFromServer(qOnline);
            const onlineCount = snapOnline.data().count + 1; // Mặc định cộng 1 cho chính Admin đang trực tuyến

            // In dữ liệu ra giao diện
            const onlineEl = document.getElementById('dash-online-users');
            const testingEl = document.getElementById('dash-testing-users');
            
            if (onlineEl) onlineEl.innerText = onlineCount;
            if (testingEl) testingEl.innerText = testingCount;

        } catch (error) {
            console.error("Lỗi khi đếm dữ liệu từ server:", error);
        }
    };

    // Chỉ thực thi ngay lập tức MỘT LẦN DUY NHẤT khi vừa mở trang hoặc chuyển tab
    fetchLiveCounts();
}

export async function loadDashboardStats() {
    try {
        // Tải toàn bộ Result (Lịch sử làm bài) và Exams (Cấu hình đề)
        const [resultsSnap, examsSnap] = await Promise.all([
            getDocs(collection(db, "results")),
            getDocs(collection(db, "exams"))
        ]);

        // Map cấu hình đề thi (để đối chiếu)
        const examsMap = {};
        examsSnap.forEach(docSnap => {
            examsMap[docSnap.id] = docSnap.data();
        });

        // Nhóm 1: Biến đếm Thời gian nộp bài tích lũy
        let countToday = 0, countWeek = 0, countMonth = 0, countYear = 0;
        const now = new Date();
        now.setHours(0,0,0,0); // Chuẩn hóa mốc tính toán về đầu ngày

        // Nhóm 2: Biến đếm xu hướng lựa chọn
        let timeStats = { "15": 0, "30": 0, "45": 0 };
        let levelStats = { "Dễ": 0, "Trung bình": 0, "Khó": 0 };
        let techStats = { "MRI": 0, "CT": 0, "X quang": 0, "Hỗn hợp": 0 };

        resultsSnap.forEach(docSnap => {
            const data = docSnap.data();
            
            // Phân tích Nhóm 1 (Theo ngày tháng)
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
                
                // Cùng ngày, tháng, năm so với hiện tại
                if (examDate.toDateString() === new Date().toDateString()) countToday++;
                if (diffDays <= 7) countWeek++;
                if (diffDays <= 30) countMonth++;
                if (diffDays <= 365) countYear++;
            }

            // Phân tích Nhóm 2 (Xu hướng cấu hình dựa vào Exam Code)
            const eCode = data.examId || data.examCode || data.quizId;
            
            if (eCode && examsMap[eCode]) {
                const config = examsMap[eCode];
                
                // Map Time
                if (timeStats[config.timeLimit] !== undefined) timeStats[config.timeLimit]++;
                
                // Map Level
                if (levelStats[config.level] !== undefined) levelStats[config.level]++;
                
                // Map Technique
                if (techStats[config.technique] !== undefined) techStats[config.technique]++;
            }
        });

        // Ghi ra giao diện (Nhóm 1)
        document.getElementById('dash-day-users').innerText = countToday;
        document.getElementById('dash-week-users').innerText = countWeek;
        document.getElementById('dash-month-users').innerText = countMonth;
        document.getElementById('dash-year-users').innerText = countYear;

        // Tiến hành vẽ biểu đồ (Nhóm 2)
        renderCharts(timeStats, levelStats, techStats);

    } catch (error) {
        console.error("Lỗi khi tải dữ liệu Dashboard:", error);
    }
}

function renderCharts(timeStats, levelStats, techStats) {
    // 1. Biểu đồ tròn - Mốc Thời Gian
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

    // 2. Biểu đồ cột - Mức Độ Khó
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

    // 3. Biểu đồ Doughnut - Kỹ Thuật
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

// Lắng nghe tín hiệu khi các components HTML đã load xong
document.addEventListener('componentsLoaded', () => {
    initDashboardRealtime();
    loadDashboardStats();
    
    // Tải lại dữ liệu đếm mỗi khi Admin bấm chuyển lại tab Dashboard
    const sidebarMenuItems = document.querySelectorAll('.menu-item');
    sidebarMenuItems.forEach(item => {
        item.addEventListener('click', (e) => {
            const target = item.getAttribute('data-target');
            if (target === 'tab-dashboard') {
                loadDashboardStats(); 
                initDashboardRealtime();
            }
        });
    });
});
