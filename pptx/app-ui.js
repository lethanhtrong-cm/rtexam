let selectedRating = 0;

export const UI = {
    updateAuthUI: (tier, badgeElement) => {
        if (!badgeElement) return;
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
    },

    updateQuotaBanner: (tier, userName, viewedCount, FREE_LIMIT, PLUS_LIMIT) => {
        const banner = document.getElementById('quota-banner');
        const greetingText = document.getElementById('quota-greeting-text');
        const statusText = document.getElementById('quota-status-text');
        const remainingText = document.getElementById('quota-remaining-text');

        if (!banner || !statusText || !remainingText) return;
        if (greetingText) greetingText.innerHTML = `Xin chào, <strong>${userName}</strong>!`;

        const tierName = tier.toUpperCase();
        statusText.innerHTML = `Bạn đang sử dụng quyền lợi của gói: <strong>${tierName}</strong>`;

        if (tier === 'pro') {
            remainingText.innerHTML = `Lượt xem bài giảng: <strong>Không giới hạn</strong>`;
            banner.className = 'quota-banner pro-banner';
        } else if (tier === 'plus') {
            const remaining = PLUS_LIMIT - viewedCount;
            remainingText.innerHTML = `Lượt mở xem bài giảng còn lại: <strong>${remaining > 0 ? remaining : 0} bài</strong>`;
            banner.className = 'quota-banner plus-banner';
        } else {
            const remaining = FREE_LIMIT - viewedCount;
            remainingText.innerHTML = `Lượt mở xem bài giảng còn lại: <strong>${remaining > 0 ? remaining : 0} bài</strong>`;
            banner.className = 'quota-banner free-banner';
        }
    },

    updateStatsUI: (pptxDataList) => {
        const statCategories = document.getElementById('stat-categories');
        const statLectures = document.getElementById('stat-lectures');
        const statViews = document.getElementById('stat-views');
        
        if (statCategories && statLectures && statViews) {
            let totalViews = 0;
            const uniqueRootCategories = new Set();
            
            pptxDataList.forEach(item => {
                totalViews += (item.viewCount || 0);
                let cat = item.category || 'mri';
                if (cat === 'mri') cat = 'mri_pptx';
                const rootCat = cat.split('_')[0]; 
                uniqueRootCategories.add(rootCat);
            });

            statCategories.innerText = uniqueRootCategories.size > 0 ? uniqueRootCategories.size : 4;
            statLectures.innerText = pptxDataList.length;
            statViews.innerText = totalViews.toLocaleString('vi-VN');
        }
    },

    initResizer: () => {
        const resizer = document.getElementById('dragMe');
        const leftSide = document.querySelector('.pptx-sidebar');
        if (!resizer || !leftSide) return;
        
        let x = 0;
        let leftWidth = 0;

        const mouseDownHandler = function(e) {
            x = e.clientX;
            const rect = leftSide.getBoundingClientRect();
            leftWidth = rect.width;
            document.addEventListener('mousemove', mouseMoveHandler);
            document.addEventListener('mouseup', mouseUpHandler);
            resizer.classList.add('resizing');
            document.body.style.cursor = 'col-resize';
        };

        const mouseMoveHandler = function(e) {
            const dx = e.clientX - x;
            const newWidth = leftWidth + dx;
            if (newWidth >= 200 && newWidth <= 600) {
                leftSide.style.width = `${newWidth}px`;
            }
        };

        const mouseUpHandler = function() {
            resizer.classList.remove('resizing');
            document.body.style.cursor = '';
            document.removeEventListener('mousemove', mouseMoveHandler);
            document.removeEventListener('mouseup', mouseUpHandler);
        };

        resizer.addEventListener('mousedown', mouseDownHandler);
    },

    toggleViewModeDisplay: (currentViewMode, btnToggle) => {
        if (currentViewMode === 'grid') {
            btnToggle.innerHTML = '<i class="fa-solid fa-list"></i> Danh Sách';
            btnToggle.style.background = '#10b981'; 
            document.querySelector('.pptx-sidebar').style.display = 'none';
            document.querySelector('.pptx-main').style.display = 'none';
            const resizer = document.getElementById('dragMe');
            if(resizer) resizer.style.display = 'none';
            document.getElementById('grid-view-container').style.display = 'grid';
        } else {
            btnToggle.innerHTML = '<i class="fa-solid fa-border-all"></i> Lưới';
            btnToggle.style.background = '#3b82f6';
            document.querySelector('.pptx-sidebar').style.display = '';
            document.querySelector('.pptx-main').style.display = '';
            const resizer = document.getElementById('dragMe');
            if(resizer) resizer.style.display = '';
            document.getElementById('grid-view-container').style.display = 'none';
        }
    },

    showViewerPage: (categoryName, currentViewMode) => {
        document.getElementById('hero-page').style.display = 'none';
        document.getElementById('viewer-page').style.display = 'flex';
        
        const label = document.getElementById('current-category-label');
        label.innerText = 'Nhóm: ' + categoryName;
        label.style.display = 'inline-block';
        
        document.getElementById('btn-back-hero').style.display = 'inline-flex';
        const btnToggle = document.getElementById('btn-toggle-view');
        btnToggle.style.display = 'inline-flex';
        
        UI.toggleViewModeDisplay(currentViewMode, btnToggle);
    },

    showHeroPage: () => {
        document.getElementById('hero-page').style.display = 'flex';
        document.getElementById('viewer-page').style.display = 'none';
        
        document.getElementById('current-category-label').style.display = 'none';
        document.getElementById('btn-back-hero').style.display = 'none';
        document.getElementById('btn-toggle-view').style.display = 'none';
        
        const resizer = document.getElementById('dragMe');
        if(resizer) resizer.style.display = 'none';
        
        document.getElementById('pptx-viewer').src = '';
        document.getElementById('video-viewer').src = '';
        
        // Ẩn khu vực comment khi ra ngoài
        UI.hideFeedbackSection();
    },

    // THÊM MỚI: CÁC HÀM XỬ LÝ GIAO DIỆN BÌNH LUẬN
    initStarRating: () => {
        const stars = document.querySelectorAll('#star-rating-input i');
        stars.forEach(star => {
            star.addEventListener('mouseover', (e) => {
                const val = parseInt(e.target.dataset.val);
                stars.forEach(s => s.classList.toggle('active', parseInt(s.dataset.val) <= val));
            });
            star.addEventListener('mouseout', () => {
                stars.forEach(s => s.classList.toggle('active', parseInt(s.dataset.val) <= selectedRating));
            });
            star.addEventListener('click', (e) => {
                selectedRating = parseInt(e.target.dataset.val);
                stars.forEach(s => s.classList.toggle('active', parseInt(s.dataset.val) <= selectedRating));
            });
        });
    },

    getRating: () => selectedRating,
    
    resetRating: () => {
        selectedRating = 0;
        document.querySelectorAll('#star-rating-input i').forEach(s => s.classList.remove('active'));
        document.getElementById('comment-textarea').value = '';
    },

    showFeedbackSection: () => {
        const feedbackSec = document.getElementById('feedback-section');
        if(feedbackSec) feedbackSec.style.display = 'flex';
    },

    hideFeedbackSection: () => {
        const feedbackSec = document.getElementById('feedback-section');
        if(feedbackSec) feedbackSec.style.display = 'none';
    },

    renderComments: (commentsArr, avgRating, totalRatings) => {
        const listEl = document.getElementById('comments-list');
        const avgEl = document.getElementById('average-rating-display');
        
        // Render Điểm trung bình
        if (totalRatings > 0) {
            avgEl.innerHTML = `<i class="fa-solid fa-star"></i> ${avgRating} <span style="font-size: 0.9rem; color: #64748b; font-weight: normal;">(${totalRatings} đánh giá)</span>`;
        } else {
            avgEl.innerHTML = `<span style="font-size: 0.95rem; color: #64748b; font-weight: normal;">Chưa có đánh giá</span>`;
        }

        // Render Danh sách bình luận
        if (commentsArr.length === 0) {
            listEl.innerHTML = '<div class="no-comment-msg">Chưa có bình luận nào. Hãy là người đầu tiên chia sẻ cảm nghĩ của bạn!</div>';
            return;
        }

        let html = '';
        commentsArr.forEach(c => {
            const letter = (c.userName || 'U').charAt(0).toUpperCase();
            
            // Format Thời gian
            let timeStr = '';
            if (c.createdAt) {
                const dateObj = (typeof c.createdAt.toDate === 'function') ? c.createdAt.toDate() : new Date(c.createdAt);
                timeStr = dateObj.toLocaleDateString('vi-VN') + ' ' + dateObj.toLocaleTimeString('vi-VN', {hour: '2-digit', minute:'2-digit'});
            }

            // Tạo chuỗi HTML ngôi sao
            let starsHtml = '';
            if (c.rating > 0) {
                for(let i=1; i<=5; i++) {
                    starsHtml += `<i class="fa-solid fa-star" style="color: ${i <= c.rating ? '#f59e0b' : '#e2e8f0'}"></i>`;
                }
            }

            html += `
                <div class="comment-item">
                    <div class="comment-avatar">${letter}</div>
                    <div class="comment-content">
                        <div class="comment-user">
                            <span>${c.userName || 'Học viên'}</span>
                            <span class="time"><i class="fa-regular fa-clock"></i> ${timeStr}</span>
                        </div>
                        ${starsHtml ? `<div class="comment-stars">${starsHtml}</div>` : ''}
                        <div class="comment-text">${c.text ? c.text.replace(/</g, "&lt;").replace(/>/g, "&gt;") : ''}</div>
                    </div>
                </div>
            `;
        });
        listEl.innerHTML = html;
    }
};
