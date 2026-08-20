// =========================================================================
// MODULE: TÙY CHỈNH GIAO DIỆN HIỂN THỊ (ĐÃ FIX LỖI NULL/NaN)
// =========================================================================
export function initDisplaySettings() {
    const dynamicStyle = document.createElement('style');
    dynamicStyle.innerHTML = `
        body.sepia-mode {
            --bg-body: #f4ecd8 !important;
            --bg-panel: #fdf6e3 !important;
            --bg-header: #fdf6e3 !important;
            --text-main: #4c3b2b !important;
            --text-muted: #795e4b !important;
            --border-color: #d3c4a1 !important;
            --option-bg: #fdf6e3 !important;
            --option-label-bg: #eaddc0 !important;
        }
    `;
    document.head.appendChild(dynamicStyle);

    const headerActions = document.querySelector('.header-actions');
    if (!headerActions) return;

    const btnSettings = document.createElement('button');
    btnSettings.className = 'btn-header btn-theme';
    btnSettings.title = 'Tùy chỉnh giao diện làm bài';
    btnSettings.innerHTML = '<i class="fa-solid fa-font"></i>';
    
    const panel = document.createElement('div');
    panel.id = 'display-settings-panel';
    panel.style.cssText = 'position:absolute; top:65px; right:30px; background:var(--bg-panel); padding:15px; border-radius:10px; box-shadow:var(--shadow-md); display:none; z-index:1000; border:1px solid var(--border-color); color:var(--text-main); min-width:260px;';
    
    panel.innerHTML = `
        <div style="font-weight:bold; margin-bottom:12px; border-bottom:1px solid var(--border-color); padding-bottom:8px; font-size:16px;">
            <i class="fa-solid fa-sliders"></i> Tùy chỉnh hiển thị
        </div>
        
        <div style="margin-bottom:12px;">
            <label style="font-size:14px; font-weight:600; display:block; margin-bottom:6px; color:var(--text-muted);">Cỡ chữ:</label>
            <div style="display:flex; gap:6px;">
                <button id="btn-font-dec" style="flex:1; padding:6px; cursor:pointer; background:var(--bg-body); color:var(--text-main); border:1px solid var(--border-color); border-radius:4px; font-weight:bold;">A -</button>
                <button id="btn-font-reset" style="flex:1; padding:6px; cursor:pointer; background:var(--bg-body); color:var(--text-main); border:1px solid var(--border-color); border-radius:4px; font-weight:bold;">Chuẩn</button>
                <button id="btn-font-inc" style="flex:1; padding:6px; cursor:pointer; background:var(--bg-body); color:var(--text-main); border:1px solid var(--border-color); border-radius:4px; font-weight:bold;">A +</button>
            </div>
        </div>
        
        <div style="margin-bottom:12px;">
            <label style="font-size:14px; font-weight:600; display:block; margin-bottom:6px; color:var(--text-muted);">Phông chữ:</label>
            <select id="select-font-family" style="width:100%; padding:8px; background:var(--bg-body); color:var(--text-main); border:1px solid var(--border-color); border-radius:4px; font-family:inherit; cursor:pointer; outline:none;">
                <option value="inherit">Mặc định hệ thống</option>
                <option value="'Times New Roman', Times, serif">Serif (Có chân)</option>
                <option value="Arial, Helvetica, sans-serif">Sans-serif (Không chân)</option>
            </select>
        </div>
        
        <div>
            <label style="font-size:14px; font-weight:600; display:block; margin-bottom:6px; color:var(--text-muted);">Nền đọc dịu mắt:</label>
            <div style="display:flex; gap:6px;">
                <button id="btn-bg-default" style="flex:1; padding:8px; cursor:pointer; background:var(--bg-body); color:var(--text-main); border:1px solid var(--border-color); border-radius:4px; font-weight:bold;">Tắt</button>
                <button id="btn-bg-sepia" style="flex:1; padding:8px; cursor:pointer; background:#f4ecd8; color:#5b4636; border:1px solid #d3c4a1; border-radius:4px; font-weight:bold;">Mở Sepia</button>
            </div>
        </div>
    `;
    
    headerActions.insertBefore(btnSettings, headerActions.firstChild);
    document.body.appendChild(panel);

    btnSettings.addEventListener('click', (e) => {
        e.stopPropagation();
        panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
    });
    document.addEventListener('click', (e) => {
        if (!panel.contains(e.target) && !btnSettings.contains(e.target)) panel.style.display = 'none';
    });

    let currentFontSize = 100;
    const updateFontSize = (val) => {
        // CHỐT CHẶN BẢO VỆ CHỐNG LỖI NULL HAY NaN
        if (!val || isNaN(val)) val = 100;
        currentFontSize = val;
        const quizBody = document.querySelector('.quiz-body');
        if (quizBody) quizBody.style.fontSize = `${currentFontSize}%`;
        localStorage.setItem('quiz_font_size', currentFontSize.toString());
    };
    
    document.getElementById('btn-font-dec').onclick = () => updateFontSize(Math.max(80, currentFontSize - 10));
    document.getElementById('btn-font-inc').onclick = () => updateFontSize(Math.min(150, currentFontSize + 10));
    document.getElementById('btn-font-reset').onclick = () => updateFontSize(100);

    const selectFont = document.getElementById('select-font-family');
    selectFont.onchange = (e) => {
        const font = e.target.value;
        if (font && font !== 'null') { // BẢO VỆ CHỐNG CHUỖI 'null'
            document.body.style.fontFamily = font;
            localStorage.setItem('quiz_font_family', font);
        }
    };

    const applySepia = (isSepia) => {
        if (isSepia) {
            document.body.classList.add('sepia-mode');
            const btnThemeToggle = document.getElementById('btn-theme-toggle');
            if(document.body.classList.contains('dark-mode')) {
                document.body.classList.remove('dark-mode');
                if (btnThemeToggle) btnThemeToggle.innerHTML = '<i class="fa-solid fa-moon"></i>';
                localStorage.setItem('quiz_theme', 'light');
            }
            localStorage.setItem('quiz_bg_mode', 'sepia');
        } else {
            document.body.classList.remove('sepia-mode');
            localStorage.setItem('quiz_bg_mode', 'default');
        }
    };

    document.getElementById('btn-bg-sepia').onclick = () => applySepia(true);
    document.getElementById('btn-bg-default').onclick = () => applySepia(false);

    const themeBtn = document.getElementById('btn-theme-toggle');
    if (themeBtn) {
        themeBtn.addEventListener('click', () => {
            document.body.classList.remove('sepia-mode');
            localStorage.setItem('quiz_bg_mode', 'default');
        });
    }

    // KHÔI PHỤC AN TOÀN
    const savedSize = localStorage.getItem('quiz_font_size');
    if (savedSize && savedSize !== 'null') updateFontSize(parseInt(savedSize));
    
    const savedFont = localStorage.getItem('quiz_font_family');
    if (savedFont && savedFont !== 'null') {
        selectFont.value = savedFont;
        document.body.style.fontFamily = savedFont;
    }

    const savedBg = localStorage.getItem('quiz_bg_mode');
    if (savedBg === 'sepia') applySepia(true);
}
