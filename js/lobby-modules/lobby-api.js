import { db } from "../dashboard-core.js";
import { collection, getDocs, query } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { state } from "./lobby-state.js";
import { UI } from "./lobby-ui.js";

export async function loadExamsToDropdown() {
    try {
        const examsRef = collection(db, "exams");
        const snapshot = await getDocs(query(examsRef));
        
        let standardExams = '';

        snapshot.forEach(docSnap => {
            const data = docSnap.data();
            const examId = docSnap.id;
            
            // FIX: Bỏ qua (ẩn) toàn bộ các đề thi do AI tạo
            if (data.technique === "AI Tự Động") return;

            const tech = data.technique || 'Tổng hợp';
            const title = data.title || examId;
            standardExams += `<option value="${examId}">[${tech}] ${title}</option>`;
        });

        UI.selectExamInLobby.innerHTML = `
            <option value="">-- Chọn bộ đề để thi --</option>
            <optgroup label="📋 ĐỀ THI THỦ CÔNG TRÊN HỆ THỐNG">
                ${standardExams || '<option disabled>Không có đề sẵn trong hệ thống</option>'}
            </optgroup>
        `;
        state.isExamsLoaded = true;
    } catch (error) {
        console.error("Lỗi lấy danh sách đề:", error);
        UI.selectExamInLobby.innerHTML = '<option value="">-- Lỗi tải dữ liệu danh sách đề --</option>';
    }
}

export function parseTimeSafely(timeVal) {
    if (typeof timeVal === 'number') return timeVal;
    if (typeof timeVal === 'string') {
        const parts = timeVal.split(':');
        if (parts.length === 2) return parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
    }
    return 999999;
}
