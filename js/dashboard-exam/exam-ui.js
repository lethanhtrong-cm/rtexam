import { State } from "./exam-state.js";

export function renderExams() {
    const examListContainer = document.getElementById('examListContainer');
    const sortFilter = document.getElementById('sortFilter');

    if (!examListContainer) return;
    
    try {
        // Tích hợp CSS cho Nút ẩn đề và Hiệu ứng nổi bật của Avatar Stack
        if (!document.getElementById('custom-exam-ui-styles')) {
            document.head.insertAdjacentHTML('beforeend', `
            <style id="custom-exam-ui-styles">
                .exam-card-hover:hover .btn-hide-exam { display: flex !important; }
                
                /* Hiệu ứng đẹp cho Avatar Stack */
                .avatar-stack-img { 
                    transition: all 0.25s cubic-bezier(0.34, 1.56, 0.64, 1); 
                    cursor: pointer; 
                }
                .avatar-stack-img:hover { 
                    transform: translateY(-4px) scale(1.2); 
                    z-index: 50 !important; 
                    box-shadow: 0 6px 12px rgba(0,0,0,0.2) !important; 
                    border-color: #3b82f6 !important; 
                }
                .attempt-pill { 
                    background: #f8fafc; 
                    padding: 3px 10px; 
                    border-radius: 20px; 
                    font-weight: 700; 
                    color: #475569; 
                    font-size: 0.8rem; 
                    border: 1px solid #e2e8f0; 
                }
            </style>`);
        }

        if (State.allExamsData.length === 0) {
            examListContainer.innerHTML = '<div style="text-align:center; padding:40px; font-size:1.1rem; color:#64748b;">Hiện tại chưa có khóa học / đề thi nào.</div>';
            return;
        }

        let displayData = [...State.allExamsData];
        const userBookmarks = (State.currentUserData && State.currentUserData.bookmarks) ? State.currentUserData.bookmarks : [];

        if (State.currentTechnique === 'saved') displayData = displayData.filter(exam => userBookmarks.includes(exam.id));
        else if (State.currentTechnique !== 'all') displayData = displayData.filter(exam => exam.technique === State.currentTechnique);
        
        if (State.currentLevel !== 'all') displayData = displayData.filter(exam => exam.level === State.currentLevel);
        if (State.currentTime !== 'all') displayData = displayData.filter(exam => exam.timeLimit === parseInt(State.currentTime));
        
        if (State.currentSearchQuery !== '') {
            displayData = displayData.filter(exam => 
                exam.id.toLowerCase().includes(State.currentSearchQuery) || 
                (exam.examName && exam.examName.toLowerCase().includes(State.currentSearchQuery)) || 
                (exam.technique && exam.technique.toLowerCase().includes(State.currentSearchQuery))
            );
        }

        if (sortFilter) {
            const filterType = sortFilter.value;
            if (filterType === 'only_vip') displayData = displayData.filter(exam => exam.isVip);
            else if (filterType === 'only_free') displayData = displayData.filter(exam => !exam.isVip);

            if (filterType === 'highest_rating') displayData.sort((a, b) => b.rating - a.rating);
            else if (filterType === 'most_attempts') displayData.sort((a, b) => b.attemptCount - a.attemptCount);
            else displayData.sort((a, b) => b.createdAt - a.createdAt); 
        }

        examListContainer.innerHTML = "";
        examListContainer.className = State.currentView === 'grid' ? "grid-view swimlane-view" : "list-view";

        if (displayData.length === 0) {
            examListContainer.innerHTML = '<div style="text-align:center; padding:40px; font-size:1.1rem; color:#64748b;">Không tìm thấy đề thi phù hợp với bộ lọc.</div>';
            return;
        }

        const isUserVip = State.currentUserData && State.currentUserData.isVip === true;

        let groups = [];
        
        if (State.currentTechnique === 'all') {
            groups.push(
                { mainCategory: null, title: "⭐ Đề HOT", data: [...displayData].sort((a, b) => b.attemptCount !== a.attemptCount ? b.attemptCount - a.attemptCount : b.rating - a.rating).slice(0, 5) },
                { mainCategory: null, title: "✨ Đề Mới", data: [...displayData].sort((a, b) => b.createdAt - a.createdAt).slice(0, 5) },
                { mainCategory: null, title: "📝 Đề cần ôn tập", data: displayData.filter(exam => State.completedExams[exam.id] && ((State.completedExams[exam.id].score / (State.completedExams[exam.id].total || 1)) * 10) < 7).slice(0, 5) }
            );
        } else if (['MRI', 'CT', 'X quang'].includes(State.currentTechnique)) {
            groups.push({ mainCategory: null, title: `⭐ Đề HOT ${State.currentTechnique}`, data: [...displayData].sort((a, b) => b.attemptCount !== a.attemptCount ? b.attemptCount - a.attemptCount : b.rating - a.rating).slice(0, 5) });
        }

        groups.push(
            { mainCategory: "🧲 KHỐI KIẾN THỨC MRI", title: "Mức độ Dễ", data: displayData.filter(exam => exam.technique === 'MRI' && exam.level === 'Dễ') },
            { mainCategory: "🧲 KHỐI KIẾN THỨC MRI", title: "Mức độ Trung bình", data: displayData.filter(exam => exam.technique === 'MRI' && exam.level === 'Trung bình') },
            { mainCategory: "🧲 KHỐI KIẾN THỨC MRI", title: "Mức độ Khó", data: displayData.filter(exam => exam.technique === 'MRI' && exam.level === 'Khó') },
            
            { mainCategory: "☢️ KHỐI KIẾN THỨC CT SCANNER", title: "Mức độ Dễ", data: displayData.filter(exam => exam.technique === 'CT' && exam.level === 'Dễ') },
            { mainCategory: "☢️ KHỐI KIẾN THỨC CT SCANNER", title: "Mức độ Trung bình", data: displayData.filter(exam => exam.technique === 'CT' && exam.level === 'Trung bình') },
            { mainCategory: "☢️ KHỐI KIẾN THỨC CT SCANNER", title: "Mức độ Khó", data: displayData.filter(exam => exam.technique === 'CT' && exam.level === 'Khó') },
            
            { mainCategory: "🩻 KHỐI KIẾN THỨC X-QUANG", title: "Mức độ Dễ", data: displayData.filter(exam => exam.technique === 'X quang' && exam.level === 'Dễ') },
            { mainCategory: "🩻 KHỐI KIẾN THỨC X-QUANG", title: "Mức độ Trung bình", data: displayData.filter(exam => exam.technique === 'X quang' && exam.level === 'Trung bình') },
            { mainCategory: "🩻 KHỐI KIẾN THỨC X-QUANG", title: "Mức độ Khó", data: displayData.filter(exam => exam.technique === 'X quang' && exam.level === 'Khó') },
            
            { mainCategory: "🧩 KHỐI KIẾN THỨC HỖN HỢP & AI", title: "Mức độ Dễ", data: displayData.filter(exam => (exam.technique === 'Hỗn hợp' || exam.technique === 'AI Tự Động' || !['MRI', 'CT', 'X quang'].includes(exam.technique)) && exam.level === 'Dễ') },
            { mainCategory: "🧩 KHỐI KIẾN THỨC HỖN HỢP & AI", title: "Mức độ Trung bình", data: displayData.filter(exam => (exam.technique === 'Hỗn hợp' || exam.technique === 'AI Tự Động' || !['MRI', 'CT', 'X quang'].includes(exam.technique)) && exam.level === 'Trung bình') },
            { mainCategory: "🧩 KHỐI KIẾN THỨC HỖN HỢP & AI", title: "Mức độ Khó", data: displayData.filter(exam => (exam.technique === 'Hỗn hợp' || exam.technique === 'AI Tự Động' || !['MRI', 'CT', 'X quang'].includes(exam.technique)) && exam.level === 'Khó') }
        );

        let currentMainCategoryTracker = null;

        groups.forEach(group => {
            if (group.data.length === 0) return; 

            let rowHtml = '';

            if (group.mainCategory && group.mainCategory !== currentMainCategoryTracker) {
                rowHtml += `
                    <div class="main-category-header mt-5 mb-3" style="border-bottom: 2px solid #e2e8f0; padding-bottom: 8px;">
                        <h3 class="fw-bold text-dark" style="font-size: 1.4rem; margin: 0; color: #1e293b !important;">${group.mainCategory}</h3>
                    </div>`;
                currentMainCategoryTracker = group.mainCategory;
            } else if (!group.mainCategory && currentMainCategoryTracker !== null) {
                currentMainCategoryTracker = null; 
            }

            let titleHtml = group.mainCategory
                ? `<h5 class="fw-semibold mb-3 text-secondary" style="font-size: 1rem; margin-left: 15px; border-left: 3px solid #94a3b8; padding-left: 10px; color: #475569;">${group.title}</h5>`
                : `<h4 class="fw-bold mb-3 text-dark" style="font-size: 1.15rem; border-left: 4px solid #084298; padding-left: 10px;">${group.title}</h4>`;

            rowHtml += `
                <div class="exam-category-row mb-4">
                    ${titleHtml}
                    <div class="swimlane-wrapper">
                        <button class="slider-btn left" onclick="slideLeft(this)"><i class="fa-solid fa-chevron-left"></i></button>
                        <div class="swimlane-scroll-container hide-scrollbar" style="padding-top: 15px; padding-right: 15px; margin-top: -5px;">
            `;

            group.data.forEach(exam => {
                const safeExamId = exam.id ? exam.id.replace(/'/g, "\\'") : '';
                const isExamVip = exam.isVip;
                const isSaved = userBookmarks.includes(exam.id);
                const isCompleted = !!State.completedExams[exam.id];
                
                const badgeHtml = isExamVip ? `<span class="course-badge badge-vip header-badge"><i class="fa-solid fa-crown"></i> PRO</span>` : `<span class="course-badge badge-free header-badge">Free</span>`;
                const bookmarkHtml = `<button class="btn-bookmark header-bookmark ${isSaved ? 'saved' : ''}" onclick="toggleBookmark(event, '${safeExamId}')" title="Lưu đề thi"><i class="${isSaved ? 'fa-solid' : 'fa-regular'} fa-heart"></i></button>`;
                const pillBaseStyle = "padding: 4px 8px; border-radius: 6px; font-size: 0.72rem; font-weight: 600; display: inline-flex; align-items: center; gap: 4px; border: 1px solid #e9ecef; background-color: #f8f9fa; white-space: nowrap; flex-shrink: 0;";

                const displayTitle = exam.examName && exam.examName.trim() !== "" ? exam.examName : exam.id;

                const headerHtml = `
                    <div class="header-flex-container" style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 18px; gap: 8px;">
                        <div style="display: flex; align-items: center; gap: 8px; flex: 1; overflow: hidden;" title="${displayTitle} (${exam.id})">
                            <h3 class="card-title" style="margin: 0; padding: 0; font-size: 1.25rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${displayTitle}</h3>
                            ${isCompleted ? '<i class="fas fa-check-circle text-success" style="color: #198754; font-size: 1.15rem; flex-shrink: 0;" title="Đã hoàn thành"></i>' : ''}
                        </div>
                        <div style="display: flex; align-items: center; flex-shrink: 0;">
                            <span style="${pillBaseStyle} color: #0284c7;"> <i class="fa-solid fa-microchip" style="font-size: 0.7rem;"></i> ${exam.technique} </span>
                        </div>
                        <div style="display: flex; align-items: center; gap: 10px; flex-shrink: 0;">${badgeHtml}${bookmarkHtml}</div>
                    </div>
                `;

                let levelColor = '#d97706'; let levelIcon = 'fa-chart-bar';
                if (exam.level === 'Dễ') { levelColor = '#059669'; levelIcon = 'fa-arrow-trend-up'; } 
                else if (exam.level === 'Khó') { levelColor = '#dc2626'; levelIcon = 'fa-fire'; }

                let datePillHtml = "";
                if (exam.createdAt > 0) {
                    const dateObj = new Date(exam.createdAt);
                    datePillHtml = `<span style="${pillBaseStyle} color: #4b5563;"> <i class="fa-regular fa-calendar-days" style="font-size: 0.7rem;"></i> ${String(dateObj.getDate()).padStart(2, '0')}/${String(dateObj.getMonth() + 1).padStart(2, '0')}/${dateObj.getFullYear()} </span>`;
                }

                const mergedTagsHtml = `
                    <div style="display: flex; justify-content: space-between; align-items: center; width: 100%; margin-bottom: 20px;">
                        <span style="${pillBaseStyle} color: ${levelColor};"> <i class="fa-solid ${levelIcon}" style="font-size: 0.7rem;"></i> ${exam.level === 'Trung bình' ? 'T.Bình' : exam.level} </span>
                        <span style="${pillBaseStyle} color: #4b5563;"> <i class="fa-solid fa-list-check" style="font-size: 0.7rem;"></i> ${exam.questionCount} câu </span>
                        <span style="${pillBaseStyle} color: #4b5563;"> <i class="fa-regular fa-clock" style="font-size: 0.7rem;"></i> ${exam.timeLimit} phút </span>
                        ${datePillHtml}
                    </div>
                `;

                const descriptionHtml = `<div style="font-size: 0.85rem; color: #334155; margin-bottom: 15px; line-height: 1.5; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; text-overflow: ellipsis; background: #eff6ff; padding: 10px 12px; border-radius: 8px; border: 1px solid #bfdbfe; border-left: 4px solid #3b82f6; box-shadow: 0 2px 4px rgba(59, 130, 246, 0.05);" title="${exam.description || 'Chưa có mô tả chi tiết'}">${exam.description || '<i style="opacity: 0.7;">Đề thi này chưa có mô tả chi tiết.</i>'}</div>`;

                let actionAreaHtml = '';
                if (isExamVip && !isUserVip) {
                    actionAreaHtml = `
                        <button onclick="goToUpgrade()" style="width: 100%; display: block; padding: 12px; border: none; background: linear-gradient(135deg, #fff3cd 0%, #ffe69c 100%); color: #997404; border-radius: 8px; font-weight: 600; cursor: pointer; transition: all 0.3s ease; box-shadow: 0 2px 4px rgba(255, 230, 156, 0.4);">
                            <i class="fa-solid fa-crown me-2"></i> Nâng cấp tài khoản Pro
                        </button>`;
                } else if (isCompleted) {
                    let displayScore = State.completedExams[exam.id].score || 0;
                    displayScore = Number.isInteger(displayScore) ? displayScore : parseFloat(displayScore.toFixed(1));

                    actionAreaHtml = `
                        <div style="margin-bottom: 20px; padding: 12px 16px; background-color: #f8f9fa; border: 1px solid #e9ecef; border-radius: 12px; display: flex; align-items: center; justify-content: space-between;">
                            <div><span style="font-size: 0.85rem; color: #6c757d; font-weight: 600; display: block; margin-bottom: 4px;">Lần thi gần nhất</span>
                            <span style="font-size: 1.15rem; color: #0ba360; font-weight: 800;">${displayScore} <span style="font-size:0.85rem; color:#6c757d; font-weight:600;">/ 10</span></span></div>
                        </div>
                        <div style="display: flex; gap: 8px; width: 100%; flex-wrap: wrap;">
                            <div style="display: flex; gap: 8px; width: 100%; margin-bottom: 4px;">
                                <button onclick="goToFlashcard('${safeExamId}')" style="flex: 1; padding: 10px 0; border: none; background: linear-gradient(135deg, #a855f7 0%, #7c3aed 100%); color: white; border-radius: 8px; font-weight: 600; cursor: pointer; transition: all 0.2s;"><i class="fa-solid fa-bolt"></i> Flashcard</button>
                            </div>
                            <div style="display: flex; gap: 8px; width: 100%;">
                                <button onclick="goToReview('${State.completedExams[exam.id].resultId}')" style="flex: 1; padding: 10px 0; border: 1px solid #adb5bd; background: transparent; color: #495057; border-radius: 8px; font-weight: 600; cursor: pointer; transition: all 0.2s;"><i class="fa-solid fa-eye"></i> Xem lại</button>
                                <button onclick="goToQuiz('${safeExamId}')" style="flex: 1; padding: 10px 0; border: none; background: #cfe2ff; color: #084298; border-radius: 8px; font-weight: 600; cursor: pointer; transition: all 0.2s;"><i class="fas fa-redo"></i> Thi lại</button>
                                <button onclick="openShareModal('${safeExamId}')" style="width: 44px; flex-shrink: 0; background: #e0e7ff; color: #3730a3; border: none; border-radius: 8px; cursor: pointer; transition: all 0.2s;" title="Chia sẻ"><i class="fa-solid fa-share-nodes"></i></button>
                            </div>
                        </div>`;
                } else {
                    actionAreaHtml = `
                        <div style="display: flex; gap: 8px; width: 100%;">
                            <button class="btn-primary" style="flex: 1; padding: 10px; font-size: 1rem; border-radius: 8px; border: none;" onclick="goToQuiz('${safeExamId}')">Vào thi ngay <i class="fa-solid fa-arrow-right ms-2"></i></button>
                            <button onclick="openShareModal('${safeExamId}')" style="width: 44px; flex-shrink: 0; background: #e0e7ff; color: #3730a3; border: none; border-radius: 8px; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.2s;" title="Chia sẻ đề thi"><i class="fa-solid fa-share-nodes"></i></button>
                        </div>`;
                }
                
                const hideBtnHtml = exam.technique === 'AI Tự Động' ? `<button class="btn-hide-exam" onclick="hideExam(event, '${safeExamId}')" style="position: absolute; top: -12px; right: -12px; background: #ef4444; color: #fff; border: 2px solid #fff; border-radius: 50%; width: 28px; height: 28px; display: none; align-items: center; justify-content: center; cursor: pointer; z-index: 20; box-shadow: 0 2px 5px rgba(0,0,0,0.2); transition: 0.2s;" title="Xóa đề này khỏi danh sách của bạn"><i class="fa-solid fa-xmark"></i></button>` : '';

                // CẬP NHẬT GIAO DIỆN AVATAR (Size lớn hơn, class Hover đẹp hơn)
                let avatarStackHtml = `<div class="attempts" style="display: flex; align-items: center; gap: 10px;">`;
                
                let avatarsToRender = (exam.recentAvatars && exam.recentAvatars.length > 0) 
                    ? exam.recentAvatars.slice(0, 5) 
                    : (exam.attemptCount > 0 ? [{ url: 'https://ui-avatars.com/api/?name=U&background=e2e8f0&color=64748b', name: 'Người ẩn danh' }] : []);

                if (avatarsToRender.length > 0) {
                    avatarStackHtml += `<div style="display: flex; align-items: center; padding-left: 4px;">`;
                    avatarsToRender.forEach((ava, idx) => {
                        const avaUrl = typeof ava === 'string' ? ava : ava.url;
                        const avaName = typeof ava === 'string' ? 'Người dùng' : (ava.name || 'Người dùng');
                        
                        avatarStackHtml += `<img class="avatar-stack-img" src="${avaUrl}" title="${avaName}" style="width: 28px; height: 28px; border-radius: 50%; border: 2px solid #fff; object-fit: cover; margin-left: ${idx > 0 ? '-12px' : '0'}; z-index: ${10 - idx}; box-shadow: 0 2px 4px rgba(0,0,0,0.1);" onerror="this.src='https://ui-avatars.com/api/?name=U&background=e2e8f0&color=64748b'">`;
                    });
                    avatarStackHtml += `</div>`;
                } else {
                    avatarStackHtml += `<div style="width: 28px; height: 28px; border-radius: 50%; background: #f1f5f9; display: flex; align-items: center; justify-content: center; border: 2px solid #fff;"><i class="fa-solid fa-users" style="color: #94a3b8; font-size: 11px;"></i></div>`;
                }
                
                avatarStackHtml += `<span class="attempt-pill">${exam.attemptCount} lượt thi</span></div>`;

                let topBadgeHtml = '';
                if (exam.topBadge === 'week') {
                    topBadgeHtml = `<div style="position: absolute; top: -12px; left: -12px; background: linear-gradient(135deg, #ef4444, #b91c1c); color: white; padding: 4px 12px; border-radius: 8px; font-weight: 800; font-size: 0.75rem; z-index: 10; box-shadow: 0 4px 6px rgba(0,0,0,0.2); border: 2px solid #fff;"><i class="fa-solid fa-fire"></i> HOT TUẦN</div>`;
                } else if (exam.topBadge === 'month') {
                    topBadgeHtml = `<div style="position: absolute; top: -12px; left: -12px; background: linear-gradient(135deg, #f59e0b, #d97706); color: white; padding: 4px 12px; border-radius: 8px; font-weight: 800; font-size: 0.75rem; z-index: 10; box-shadow: 0 4px 6px rgba(0,0,0,0.2); border: 2px solid #fff;"><i class="fa-solid fa-medal"></i> ĐỈNH THÁNG</div>`;
                } else if (exam.topBadge === 'year') {
                    topBadgeHtml = `<div style="position: absolute; top: -12px; left: -12px; background: linear-gradient(135deg, #3b82f6, #1d4ed8); color: white; padding: 4px 12px; border-radius: 8px; font-weight: 800; font-size: 0.75rem; z-index: 10; box-shadow: 0 4px 6px rgba(0,0,0,0.2); border: 2px solid #fff;"><i class="fa-solid fa-trophy"></i> ĐỀ CỦA NĂM</div>`;
                }

                rowHtml += `
                    <div class="course-card exam-card-hover h-100 d-flex flex-column" style="min-width: 340px; max-width: 340px; flex-shrink: 0; scroll-snap-align: start; margin-right: 24px; margin-bottom: 10px; border-radius: 12px; border: 1px solid #eef0f2; background: #fff; overflow: visible; position: relative;">
                        ${topBadgeHtml}
                        ${hideBtnHtml}
                        <div class="card-body p-4 d-flex flex-column h-100">
                            ${headerHtml}${mergedTagsHtml}${descriptionHtml}
                            <div class="card-meta mt-auto" style="border-top: 1px dashed #e9ecef; padding-top: 15px; display: flex; justify-content: space-between; align-items: center; font-size: 0.85rem; color: #6b7280; font-weight: normal; margin-bottom: 20px;">
                                <div class="rating" style="display: flex; align-items: center; gap: 5px;"><span>${exam.rating}</span> <i class="fa-solid fa-star" style="color: #fbbf24;"></i> <span>(${exam.ratingCount})</span></div>
                                ${avatarStackHtml}
                            </div>
                            <div>${actionAreaHtml}</div>
                        </div>
                    </div>`;
            });

            rowHtml += `</div><button class="slider-btn right" onclick="slideRight(this)"><i class="fa-solid fa-chevron-right"></i></button></div></div>`;
            examListContainer.insertAdjacentHTML('beforeend', rowHtml);
        });

    } catch (err) {
        console.error("LỖI HIỂN THỊ ĐỀ THI: ", err);
        examListContainer.innerHTML = `<div style="text-align:center; padding:50px; color:#ef4444; border: 2px dashed #f87171; border-radius: 12px; background: #fef2f2; margin-top: 20px;"><i class="fa-solid fa-triangle-exclamation fa-3x" style="margin-bottom: 15px;"></i><h3 style="margin-bottom: 10px;">Lỗi kết xuất giao diện</h3><p>Đã xảy ra sự cố khi tải thẻ đề thi. Chi tiết lỗi: <b>${err.message}</b></p><button onclick="location.reload()" style="margin-top: 15px; padding: 8px 20px; background: #dc2626; color: white; border: none; border-radius: 6px; cursor: pointer;">Tải lại trang</button></div>`;
    }
}
