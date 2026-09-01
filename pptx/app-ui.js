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
    }
};
