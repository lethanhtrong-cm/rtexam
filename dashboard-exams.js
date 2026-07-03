// =========================================================================
// 5. PIPELINE LỌC DỮ LIỆU & RENDER GIAO DIỆN CHUYÊN NGHIỆP
// =========================================================================
function renderExams() {
    if (allExamsData.length === 0) {
        examListContainer.innerHTML = '<div class="loading-text">Hiện tại chưa có khóa học / đề thi nào.</div>';
        return;
    }

    let displayData = [...allExamsData];
    const userBookmarks = (currentUserData && currentUserData.bookmarks) ? currentUserData.bookmarks : [];

    // Lọc theo Technique & Bookmark
    if (currentTechnique === 'saved') {
        displayData = displayData.filter(exam => userBookmarks.includes(exam.id));
    } else if (currentTechnique !== 'all') {
        displayData = displayData.filter(exam => exam.technique === currentTechnique);
    }

    // Lọc Level, Time, Search
    if (currentLevel !== 'all') {
        displayData = displayData.filter(exam => exam.level === currentLevel);
    }
    if (currentTime !== 'all') {
        const timeTarget = parseInt(currentTime);
        displayData = displayData.filter(exam => exam.timeLimit === timeTarget);
    }
    if (currentSearchQuery !== '') {
        displayData = displayData.filter(exam => 
            exam.id.toLowerCase().includes(currentSearchQuery) || 
            (exam.technique && exam.technique.toLowerCase().includes(currentSearchQuery))
        );
    }

    // Lọc VIP/Free & Sắp xếp
    const filterType = sortFilter.value;
    if (filterType === 'only_vip') displayData = displayData.filter(exam => exam.isVip);
    else if (filterType === 'only_free') displayData = displayData.filter(exam => !exam.isVip);

    if (filterType === 'highest_rating') displayData.sort((a, b) => b.rating - a.rating);
    else if (filterType === 'most_attempts') displayData.sort((a, b) => b.attemptCount - a.attemptCount);
    else displayData.sort((a, b) => b.createdAt - a.createdAt); 

    examListContainer.innerHTML = "";
    const isUserVip = currentUserData && currentUserData.isVip === true;

    if (displayData.length === 0) {
        if (currentTechnique === 'saved') {
            examListContainer.innerHTML = '<div class="loading-text">Bạn chưa lưu đề thi nào vào bộ sưu tập.</div>';
        } else {
            examListContainer.innerHTML = '<div class="loading-text">Không tìm thấy đề thi nào phù hợp với các bộ lọc hiện tại.</div>';
        }
        return;
    }

    displayData.forEach(exam => {
        const isExamVip = exam.isVip;
        const isSaved = userBookmarks.includes(exam.id);
        const isCompleted = !!completedExams[exam.id]; 
        
        const badgeHtml = isExamVip 
            ? `<span class="course-badge badge-vip header-badge"><i class="fa-solid fa-crown"></i> PRO</span>`
            : `<span class="course-badge badge-free header-badge">Free</span>`;
            
        const bookmarkHtml = `
            <button class="btn-bookmark header-bookmark ${isSaved ? 'saved' : ''}" onclick="toggleBookmark(event, '${exam.id}')" title="${isSaved ? 'Bỏ lưu đề thi' : 'Lưu đề thi'}">
                <i class="${isSaved ? 'fa-solid' : 'fa-regular'} fa-heart"></i>
            </button>
        `;

        const headerHtml = `
            <div class="header-flex-container" style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 18px; gap: 15px;">
                <div style="display: flex; align-items: center; gap: 8px; flex: 1; overflow: hidden;">
                    <h3 class="card-title" style="margin: 0; padding: 0; font-size: 1.25rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${exam.id}</h3>
                    ${isCompleted ? '<i class="fas fa-check-circle text-success" style="color: #198754; font-size: 1.15rem; flex-shrink: 0;" title="Đã hoàn thành"></i>' : ''}
                </div>
                
                <div style="display: flex; align-items: center; gap: 10px; flex-shrink: 0;">
                    ${badgeHtml}
                    ${bookmarkHtml}
                </div>
            </div>
        `;

        let levelClass = 'bg-warning-subtle text-warning'; 
        let levelStyle = 'background-color: #fff3cd; color: #664d03;'; 
        if (exam.level === 'Dễ') {
            levelClass = 'bg-success-subtle text-success';
            levelStyle = 'background-color: #d1e7dd; color: #0f5132;';
        } else if (exam.level === 'Khó') {
            levelClass = 'bg-danger-subtle text-danger';
            levelStyle = 'background-color: #f8d7da; color: #842029;';
        }

        const pillBaseStyle = "padding: 5px 12px; border-radius: 50rem; font-size: 0.8rem; display: inline-flex; align-items: center; gap: 6px; border: none; letter-spacing: 0.2px;";

        const mergedTagsHtml = `
            <div class="d-flex flex-wrap gap-2 mb-3" style="display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 20px;">
                <span class="badge rounded-pill bg-primary-subtle text-primary" style="${pillBaseStyle} background-color: #cfe2ff; color: #084298;">
                    <i class="fa-solid fa-tag"></i> <span class="fw-normal" style="font-weight: 600;">${exam.technique}</span>
                </span>
                <span class="badge rounded-pill ${levelClass}" style="${pillBaseStyle} ${levelStyle}">
                    <i class="fa-solid fa-signal"></i> <span class="fw-normal" style="font-weight: 600;">${exam.level}</span>
                </span>
                <span class="badge rounded-pill bg-info-subtle text-info" style="${pillBaseStyle} background-color: #cff4fc; color: #055160;">
                    <i class="fa-solid fa-cube"></i> <span class="fw-normal" style="font-weight: 500;"><b>${exam.questionCount}</b> câu</span>
                </span>
                <span class="badge rounded-pill bg-secondary-subtle text-secondary" style="${pillBaseStyle} background-color: #e2e3e5; color: #41464b;">
                    <i class="fa-solid fa-clock"></i> <span class="fw-normal" style="font-weight: 500;"><b>${exam.timeLimit}</b> phút</span>
                </span>
            </div>
        `;

        // ==========================================
        // CẤU TRÚC LẠI PHẦN NÚT BẤM VÀ ĐIỂM SỐ CHUẨN
        // ==========================================
        let actionAreaHtml = '';

        if (isExamVip && !isUserVip) {
            actionAreaHtml = `
                <button class="btn btn-premium-pro w-100" style="padding: 10px; border-radius: 6px;" onclick="handleUpgradeProClick('${exam.id}')">
                    <i class="fa-solid fa-gem me-2"></i> Nâng cấp tài khoản Pro
                </button>
            `;
        } else if (isCompleted) {
            const score = completedExams[exam.id].score;
            const totalQuestions = completedExams[exam.id].total;
            const percent = Math.min(100, Math.round((score / totalQuestions) * 100));

            actionAreaHtml = `
                <div class="mb-3 p-2 bg-light rounded border border-light">
                    <div class="d-flex justify-content-between align-items-center mb-2">
                        <small class="text-muted fw-medium">Lần thi gần nhất</small>
                        <span class="text-success fw-bold" style="font-size: 0.95rem;">${score} / ${totalQuestions} điểm</span>
                    </div>
                    <div class="progress" style="height: 6px; border-radius: 10px;">
                        <div class="progress-bar bg-success" role="progressbar" style="width: ${percent}%; border-radius: 10px;"></div>
                    </div>
                </div>
                <div class="row g-2">
                    <div class="col-6">
                        <button class="btn btn-outline-secondary w-100 fw-medium" style="border-radius: 6px;" onclick="goToHistory('${exam.id}')"><i class="fas fa-history me-1"></i> Lịch sử</button>
                    </div>
                    <div class="col-6">
                        <button class="btn btn-primary-subtle text-primary fw-medium w-100" style="border-radius: 6px;" onclick="handleExamClick('${exam.id}')"><i class="fas fa-redo me-1"></i> Thi lại</button>
                    </div>
                </div>
            `;
        } else {
            actionAreaHtml = `
                <button class="btn btn-primary w-100 fw-bold" style="padding: 10px; border-radius: 6px;" onclick="handleExamClick('${exam.id}')">
                    Bắt đầu thi <i class="fa-solid fa-arrow-right ms-2"></i>
                </button>
            `;
        }

        // ==========================================
        // CẤU TRÚC LẠI THẺ CARD CHUẨN FLEXBOX
        // ==========================================
        const cardHtml = `
            <div class="course-card h-100 exam-card-hover" style="border-radius: 12px; border: 1px solid #eef0f2; background: #fff; overflow: hidden;">
                <div class="card-body p-4 d-flex flex-column h-100">
                    ${headerHtml}
                    ${mergedTagsHtml}
                    
                    <div class="stats-row" style="display: flex; justify-content: space-between; margin-bottom: 20px; font-size: 0.9rem; color: #6c757d; border-top: 1px dashed #e9ecef; padding-top: 15px;">
                        <div class="rating">
                            <span class="fw-bold text-dark">${exam.rating}</span> <i class="fa-solid fa-star text-warning"></i> <span style="font-size: 0.8rem;">(${exam.ratingCount})</span>
                        </div>
                        <div class="users">
                            <i class="fa-solid fa-users"></i> ${exam.attemptCount} lượt thi
                        </div>
                    </div>
                    
                    <div class="mt-auto pt-3">
                        ${actionAreaHtml}
                    </div>
                </div>
            </div>
        `;

        examListContainer.insertAdjacentHTML('beforeend', cardHtml);
    });
}
