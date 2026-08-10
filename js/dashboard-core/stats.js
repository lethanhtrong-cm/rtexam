import { doc, setDoc, onSnapshot, increment } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

export function initStatistics(db) {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const date = String(now.getDate()).padStart(2, '0');
    
    const dateKey = `day_${year}_${month}_${date}`;
    const monthKey = `month_${year}_${month}`;
    const yearKey = `year_${year}`;
    
    const startDate = new Date(now.getFullYear(), 0, 1);
    const days = Math.floor((now - startDate) / (24 * 60 * 60 * 1000));
    const weekNumber = Math.ceil((now.getDay() + 1 + days) / 7);
    const weekKey = `week_${year}_W${String(weekNumber).padStart(2, '0')}`;

    if (!sessionStorage.getItem('site_visited')) {
        sessionStorage.setItem('site_visited', 'true');
        
        setTimeout(() => {
            const updates = {
                totalVisits: increment(1),
                [dateKey]: increment(1),
                [weekKey]: increment(1),
                [monthKey]: increment(1),
                [yearKey]: increment(1)
            };
            setDoc(doc(db, "statistics", "global"), updates, { merge: true }).catch(() => {});
        }, 3000);
    }

    onSnapshot(doc(db, "statistics", "global"), (docSnap) => {
        if (docSnap.exists()) {
            const data = docSnap.data();
            const vTotal = document.getElementById('global-visitor-count');
            const vDaily = document.getElementById('visitor-daily');
            const vWeekly = document.getElementById('visitor-weekly');
            const vMonthly = document.getElementById('visitor-monthly');
            const vYearly = document.getElementById('visitor-yearly');

            if (vTotal) vTotal.innerText = (data.totalVisits || 0).toLocaleString('vi-VN');
            if (vDaily) vDaily.innerText = (data[dateKey] || 0).toLocaleString('vi-VN');
            if (vWeekly) vWeekly.innerText = (data[weekKey] || 0).toLocaleString('vi-VN');
            if (vMonthly) vMonthly.innerText = (data[monthKey] || 0).toLocaleString('vi-VN');
            if (vYearly) vYearly.innerText = (data[yearKey] || 0).toLocaleString('vi-VN');
        }
    });
}
