import { db } from "../dashboard-core.js";
import { collection, getDocs, query } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { state } from "./lobby-state.js";
import { UI } from "./lobby-ui.js";

export async function loadExamsToDropdown() {
    try {
        const examsRef = collection(db, "exams");
        const snapshot = await getDocs(query(examsRef));
        
        let standardExams = '';
        let aiExams = '';

        snapshot.forEach(docSnap => {
            const data = docSnap.data();
            const examId = docSnap.id;
            const tech = data.technique || 'Tổng hợp';
            const title = data.title || examId;
            const optionHtml = `<option value="${examId}">[${tech}] ${title}</option>`;

            if (data.technique === "AI Tự Động") {
                aiExams += optionHtml;
            } else {
                standardExams += optionHtml;
            }
        });

        UI.selectExamInLobby.innerHTML = `
            <option value="">-- Chọn bộ đề để thi --</option>
            <optgroup label="📋 ĐỀ THI CÓ SẴN TRÊN HỆ THỐNG">
                ${standardExams || '<option disabled>Không có đề sẵn trong hệ thống</option>'}
            </optgroup>
            <optgroup label="✨ ĐỀ THI DO AI TỰ ĐỘNG SOẠN">
                ${aiExams || '<option disabled>Chưa có đề AI nào được tạo</option'}
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
