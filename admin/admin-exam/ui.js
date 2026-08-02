import { appState } from './state.js';

export function generateStatsHtml() {
    const stats = {};
    let totalExams = 0;
    
    appState.cachedExams.forEach(ex => {
        totalExams++;
        const t = ex.technique || "Chưa phân loại";
        const l = ex.level || "Không xác định";
        const time = ex.timeLimit || 0;

        if(!stats[t]) stats[t] = { total: 0, levels: {} };
        stats[t].total++;

        if(!stats[t].levels[l]) stats[t].levels[l] = { total: 0, times: {} };
        stats[t].levels[l].total++;

        if(!stats[t].levels[l].times[time]) stats[t].levels[l].times[time] = 0;
        stats[t].levels[l].times[time]++;
    });

    let tableContent = '';
    if (appState.isStatsVisible) {
        tableContent = `
        <div style="overflow-x: auto; border-radius: 8px; border: 1px solid #cbd5e1; margin-top: 20px;">
        <table style="width:100%; border-collapse:collapse; background: #fff; min-width: 600px;">
            <thead style="background:#f8fafc; color:#475569; font-size:13px; text-transform:uppercase; border-bottom: 2px solid #cbd5e1;">
                <tr>
                    <th style="padding:12px 15px; text-align:left; width: 30%;">Chuyên khoa</th>
                    <th style="padding:12px 15px; text-align:center; width: 25%;">Cấp độ</th>
                    <th style="padding:12px 15px; text-align:center; width: 25%;">Thời gian</th>
                    <th style="padding:12px 15px; text-align:center; width: 20%;">Số lượng đề</th>
                </tr>
            </thead>
            <tbody>`;

        for(const t in stats) {
            const techData = stats[t];
            const levels = Object.keys(techData.levels);
            
            let techRowSpan = 0;
            levels.forEach(l => { techRowSpan += Object.keys(techData.levels[l].times).length; });

            let firstTech = true;
            for(const l of levels) {
                const times = Object.keys(techData.levels[l].times);
                let firstLevel = true;
                
                for(const time of times) {
                    tableContent += `<tr style="border-bottom: 1px solid #e2e8f0; transition: background 0.2s;" onmouseover="this.style.background='#f1f5f9'" onmouseout="this.style.background='transparent'">`;
                    
                    if(firstTech) {
                        tableContent += `<td rowspan="${techRowSpan}" style="padding:15px; vertical-align:middle; font-weight:700; color:#1e293b; border-right:1px solid #e2e8f0; background: #fff;">
                                    ${t} <br><span style="font-size:12px; font-weight: normal; color: #64748b;">(Tổng: ${techData.total} đề)</span>
                                 </td>`;
                        firstTech = false;
                    }
                    if(firstLevel) {
                        let lvlColor = l === 'Khó' ? '#ef4444' : (l === 'Dễ' ? '#10b981' : '#f59e0b');
                        tableContent += `<td rowspan="${times.length}" style="padding:15px; vertical-align:middle; text-align:center; font-weight:700; color:${lvlColor}; border-right:1px solid #e2e8f0; background: #fff;">
                                    ${l} <br><span style="font-size:12px; font-weight: normal; color: #64748b;">(Có ${techData.levels[l].total} đề)</span>
                                 </td>`;
                        firstLevel = false;
                    }
                    
                    tableContent += `<td style="padding:12px 15px; text-align:center; color:#475569; font-weight: 500;">${time} phút</td>`;
                    tableContent += `<td style="padding:12px 15px; text-align:center; font-weight:bold; color:#0f172a; font-size: 15px;">
                                <span style="background: #e0f2fe; color: #0369a1; padding: 4px 12px; border-radius: 20px;">${techData.levels[l].times[time]}</span>
                             </td>`;
                    tableContent += `</tr>`;
                }
            }
        }
        tableContent += `</tbody></table></div>`;
    }

    let btnStyle = appState.isStatsVisible 
        ? "background: #f8fafc; color: #475569; border: 1px solid #cbd5e1;" 
        : "background: #3b82f6; color: white; border: 1px solid #3b82f6; box-shadow: 0 2px 4px rgba(59,130,246,0.3);";
    let btnText = appState.isStatsVisible ? '<i class="fa-solid fa-eye-slash"></i> Ẩn thống kê' : '<i class="fa-solid fa-chart-pie"></i> Xem thống kê nhanh';

    let html = `
    <div style="background: white; border-radius: 12px; padding: 20px; margin-bottom: 25px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); border: 1px solid #e2e8f0;">
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 15px;">
            <h3 style="margin: 0; color: #0f172a; display: flex; align-items: center; gap: 10px; font-size: 17px;">
                <i class="fa-solid fa-layer-group" style="color: #3b82f6;"></i> Ngân Hàng Đề (Tổng: <span style="color:#ef4444;">${totalExams}</span> đề)
            </h3>
            <button id="btn-toggle-stats" style="padding: 8px 16px; border-radius: 6px; cursor: pointer; font-size: 13px; font-weight: 600; transition: 0.2s; ${btnStyle}">
                ${btnText}
            </button>
        </div>
        ${tableContent}
    </div>`;

    return html;
}

export function injectHistoryModal() {
    if (document.getElementById('exam-history-modal')) return;
    const modalHtml = `
    <div id="exam-history-modal" style="display:none; position:fixed; z-index:9999; left:0; top:0; width:100%; height:100%; background-color:rgba(15, 23, 42, 0.75); backdrop-filter: blur(4px);">
        <div style="background-color:#fff; margin:5vh auto; padding:0; border-radius:12px; width:95%; max-width:800px; max-height:90vh; display:flex; flex-direction:column; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.25); overflow: hidden;">
            <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid #e2e8f0; padding:15px 20px; background: #f8fafc;">
                <h3 style="margin:0; color:#0f172a; font-size:16px;"><i class="fa-solid fa-users" style="color:#3b82f6;"></i> Danh sách thi đề: <span id="history-modal-exam-id" style="color:#2563eb; font-weight: 800;"></span></h3>
                
                <div style="display:flex; gap: 15px; align-items:center;">
                    <!-- THẺ SELECT SORT ĐƯỢC CHÈN VÀO ĐÂY -->
                    <select id="history-sort-select" style="padding: 6px 12px; border-radius: 6px; border: 1px solid #cbd5e1; font-size: 13px; font-weight: 600; color: #475569; outline: none; cursor: pointer; background-color: #fff;">
                        <option value="newest">Sắp xếp: Mới nhất</option>
                        <option value="score_desc">Sắp xếp: Điểm từ cao đến thấp</option>
                    </select>
                    
                    <span id="close-exam-history-modal" style="cursor:pointer; font-size:24px; color:#94a3b8; line-height: 1;">&times;</span>
                </div>
            </div>
            <div style="overflow-y:auto; flex:1; padding: 0;">
                <table style="width:100%; border-collapse:collapse; text-align:left;">
                    <thead style="background:#f1f5f9; border-bottom:2px solid #cbd5e1; position: sticky; top: 0; z-index: 10;">
                        <tr>
                            <th style="padding:12px 15px; color:#475569; font-size:13px; text-transform:uppercase;">Email Học viên</th>
                            <th style="padding:12px 15px; color:#475569; font-size:13px; text-transform:uppercase; text-align:center;">Điểm số</th>
                            <th style="padding:12px 15px; color:#475569; font-size:13px; text-transform:uppercase; text-align:right;">Thời gian nộp (Mới nhất)</th>
                        </tr>
                    </thead>
                    <tbody id="history-table-body">
                    </tbody>
                </table>
            </div>
        </div>
    </div>`;
    document.body.insertAdjacentHTML('beforeend', modalHtml);

    document.getElementById('close-exam-history-modal').onclick = () => {
        document.getElementById('exam-history-modal').style.display = 'none';
    };
}

export function openEditPropertiesModal(examId, examName, technique, time, level, description) {
    appState.currentEditingExamId = examId;
    const modal = document.getElementById('edit-properties-modal');
    if (!modal) return;
    
    document.getElementById('edit-modal-exam-id').innerText = examId;
    document.getElementById('edit-exam-name').value = examName || ""; 
    document.getElementById('edit-select-technique').value = technique || "Hỗn hợp";
    document.getElementById('edit-select-time').value = time || "15";
    document.getElementById('edit-select-level').value = level || "Trung bình";
    
    const descInput = document.getElementById('edit-exam-description');
    if (descInput) descInput.value = description || "";
    
    modal.style.display = "block";
}

export function renderPreview() {
    const previewBody = document.getElementById('preview-list-body');
    const publishBtn = document.getElementById('btn-publish');
    if (!previewBody) return;
    previewBody.innerHTML = '';

    if (appState.draftData.length === 0) {
        previewBody.innerHTML = '<tr><td colspan="9" class="empty-message">Chưa có dữ liệu nào được nạp để xem trước.</td></tr>';
        if (publishBtn) publishBtn.disabled = true;
        return;
    }

    let stt = 1;
    appState.draftData.forEach((row) => {
        const tr = document.createElement('tr');
        const mapCorrectText = ['A', 'B', 'C', 'D'];
        const correctChar = mapCorrectText[row.correctAnswer] || 'Không rõ';

        tr.innerHTML = `
            <td class="text-center">${stt++}</td>
            <td><span class="badge-count" style="background:#eff6ff; color:#2563eb;">${row.examId}</span></td>
            <td><div style="max-width:250px; font-weight:500; font-size:13.5px;">${row.text}</div></td>
            <td><div style="max-width:150px; font-size:13px; color:#475569;">${row.options[0]}</div></td>
            <td><div style="max-width:150px; font-size:13px; color:#475569;">${row.options[1]}</div></td>
            <td><div style="max-width:150px; font-size:13px; color:#475569;">${row.options[2]}</div></td>
            <td><div style="max-width:150px; font-size:13px; color:#475569;">${row.options[3]}</div></td>
            <td class="text-center"><strong style="color:#10b981; font-size:16px;">${correctChar}</strong></td>
            <td><div style="max-width:200px; font-size:12.5px; color:#64748b; font-style: italic;">${row.explanation}</div></td>
        `;
        previewBody.appendChild(tr);
    });

    if (publishBtn) {
        publishBtn.removeAttribute('disabled');
        publishBtn.innerHTML = `🔓 Xác Nhận & Publish ${appState.draftData.length} Câu Lên Hệ Thống`;
    }
}

export function renderExamList() {
    const container = document.getElementById('exam-list-body');
    if (!container) return;

    container.innerHTML = '';

    if (appState.currentTechnique === "Chưa phân loại") {
        const statsWrapper = document.createElement('div');
        statsWrapper.innerHTML = generateStatsHtml();
        container.appendChild(statsWrapper);

        const toggleBtn = statsWrapper.querySelector('#btn-toggle-stats');
        if (toggleBtn) {
            toggleBtn.addEventListener('click', () => {
                appState.isStatsVisible = !appState.isStatsVisible;
                renderExamList();
            });
        }
    }

    const filteredExams = appState.cachedExams.filter(exam => {
        const matchTech = exam.technique === appState.currentTechnique;
        const matchLevel = appState.currentLevel === "all" || exam.level === appState.currentLevel;
        const matchTime = appState.currentTime === "all" || String(exam.timeLimit) === String(appState.currentTime);
        const searchTarget = (exam.examId + " " + exam.examName).toLowerCase();
        const matchSearch = !appState.currentSearchQuery || searchTarget.includes(appState.currentSearchQuery);
        return matchTech && matchLevel && matchTime && matchSearch;
    });

    const sortSelect = document.getElementById('examSortSelect');
    const sortMode = sortSelect ? sortSelect.value : 'newest';

    filteredExams.sort((a, b) => {
        if (sortMode === 'most_attempts') return b.attemptCount - a.attemptCount;
        if (sortMode === 'most_feedbacks') return b.feedbackCount - a.feedbackCount;
        if (sortMode === 'highest_rating') return b.rating - a.rating;
        return b.createdAt - a.createdAt;
    });

    if (filteredExams.length === 0) {
        const emptyMsg = document.createElement('div');
        emptyMsg.className = 'empty-message';
        emptyMsg.style.cssText = 'width: 100%; background: #ffffff; padding: 40px; border-radius: 12px; border: 1px dashed #cbd5e1;';
        emptyMsg.innerHTML = '🔍 Không tìm thấy mã đề thi nào thỏa mãn điều kiện lọc hiện tại.';
        container.appendChild(emptyMsg);
        return;
    }

    filteredExams.forEach(exam => {
        let levelClass = 'level-medium';
        if (exam.level === 'Dễ') levelClass = 'level-easy';
        else if (exam.level === 'Khó') levelClass = 'level-hard';

        let formattedDate = 'Không rõ';
        if (exam.createdAt) {
            if (typeof exam.createdAt.toDate === 'function') {
                formattedDate = exam.createdAt.toDate().toLocaleDateString('vi-VN');
            } else {
                const numDate = Number(exam.createdAt);
                if (!isNaN(numDate) && numDate > 100000000) {
                    let finalMs = numDate > 1000000000000 ? numDate : numDate * 1000;
                    formattedDate = new Date(finalMs).toLocaleDateString('vi-VN');
                } else {
                    formattedDate = new Date(exam.createdAt).toLocaleDateString('vi-VN');
                }
            }
        }

        const displayTitle = exam.examName ? exam.examName : `Đề: ${exam.examId}`;
        const displaySubId = exam.examName ? `<span class="exam-subtitle-id">Mã: ${exam.examId}</span>` : '';

        let feedbackBadgeHtml = '';
        if (exam.feedbackCount > 0) {
            const formattedRating = Number.isInteger(exam.rating) ? exam.rating : exam.rating.toFixed(1);
            feedbackBadgeHtml = `<span style="background: #f59e0b; color: white; border-radius: 10px; padding: 2px 6px; font-size: 0.75rem; margin-left: 4px; line-height: 1; box-shadow: 0 1px 2px rgba(0,0,0,0.1);">${formattedRating}★ (${exam.feedbackCount})</span>`;
        }
        const feedbackBtnClass = exam.feedbackCount > 0 ? "btn-modern-action btn-view-feedback has-feedback" : "btn-modern-action btn-view-feedback";

        const safeDescription = encodeURIComponent(exam.description || "");

        const cardDiv = document.createElement('div');
        cardDiv.className = 'exam-premium-card';
        
        cardDiv.innerHTML = `
            <div class="card-premium-header">
                <div class="header-left">
                    <h3 class="exam-premium-title">${displayTitle}</h3>
                    ${displaySubId}
                </div>
                <div class="header-right">
                    ${exam.isVip ? '<span class="badge-premium-vip"><i class="fa-solid fa-crown"></i> PRO</span>' : '<span class="badge-premium-free">Miễn Phí</span>'}
                </div>
            </div>
            
            <div class="card-premium-meta">
                <div class="meta-tags-container">
                    <span class="premium-tag tech-tag"><i class="fa-solid fa-microchip"></i> ${exam.technique}</span>
                    <span class="premium-tag ${levelClass}"><i class="fa-solid fa-chart-simple"></i> ${exam.level}</span>
                    <span class="premium-tag time-tag"><i class="fa-regular fa-clock"></i> ${exam.timeLimit} phút</span>
                    <span class="premium-tag count-tag"><i class="fa-solid fa-list-check"></i> ${exam.count} Câu</span>
                </div>
                <div class="meta-stats-container">
                    <span class="stat-item"><i class="fa-solid fa-calendar-day"></i> Tạo: ${formattedDate}</span>
                    <span class="stat-item"><i class="fa-solid fa-users"></i> Lượt thi: <strong>${exam.attemptCount}</strong></span>
                </div>
            </div>

            <hr class="premium-divider">

            <div class="card-premium-footer">
                <div style="display: flex; gap: 8px;">
                    <button class="btn-modern-action btn-edit-properties" data-examid="${exam.examId}" data-examname="${exam.examName}" data-technique="${exam.technique}" data-time="${exam.timeLimit}" data-level="${exam.level}" data-description="${safeDescription}">
                        <i class="fa-solid fa-gear"></i> Sửa Thuộc Tính
                    </button>
                    <button class="btn-modern-action btn-edit-content" data-examid="${exam.examId}" style="color: #0284c7; border-color: #bae6fd;">
                        <i class="fa-solid fa-pen-to-square"></i> Sửa Nội Dung
                    </button>
                </div>
                
                <div class="footer-actions-right">
                    <button class="btn-modern-action btn-view-history" data-examid="${exam.examId}" style="color: #4f46e5; border-color: #c7d2fe; background: #e0e7ff;">
                        <i class="fa-solid fa-users"></i> Xem Lịch Sử
                    </button>

                    <button class="${feedbackBtnClass}" data-examid="${exam.examId}">
                        <i class="fa-solid fa-star"></i> Đánh Giá ${feedbackBadgeHtml}
                    </button>
                    ${exam.isVip 
                        ? `<button class="btn-modern-action toggle-vip off" data-examid="${exam.examId}" data-vip="true"><i class="fa-solid fa-unlock"></i> Hủy VIP</button>` 
                        : `<button class="btn-modern-action toggle-vip on" data-examid="${exam.examId}" data-vip="false"><i class="fa-solid fa-lock"></i> Kích VIP</button>`
                    }
                    <button class="btn-modern-action btn-delete-danger btn-delete" data-examid="${exam.examId}">
                        <i class="fa-solid fa-trash-can"></i> Xóa Đề
                    </button>
                </div>
            </div>
        `;
        container.appendChild(cardDiv);
    });
}
