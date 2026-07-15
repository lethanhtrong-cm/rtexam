export function redirect(url) {
    try { window.location.href = url; } 
    catch (error) { console.warn("Môi trường Preview chặn chuyển hướng:", error); }
}

export function showToast(msg) {
    const toast = document.getElementById('toast-message');
    if (!toast) return;
    toast.innerText = msg;
    toast.style.transform = 'translateX(-50%) translateY(0)';
    toast.style.opacity = '1';
    setTimeout(() => {
        toast.style.transform = 'translateX(-50%) translateY(100px)';
        toast.style.opacity = '0';
    }, 3000);
}

export function initThemeToggle() {
    const btnThemeToggle = document.getElementById('btn-theme-toggle');
    if (!btnThemeToggle) return;
    
    function applyTheme(isDark) {
        if (isDark) {
            document.body.classList.add('dark-mode');
            btnThemeToggle.innerHTML = '<i class="fa-solid fa-sun"></i>';
        } else {
            document.body.classList.remove('dark-mode');
            btnThemeToggle.innerHTML = '<i class="fa-solid fa-moon"></i>';
        }
    }

    const savedTheme = localStorage.getItem('quiz_theme');
    if (savedTheme === 'dark') applyTheme(true);

    btnThemeToggle.addEventListener('click', () => {
        const isNowDark = document.body.classList.toggle('dark-mode');
        localStorage.setItem('quiz_theme', isNowDark ? 'dark' : 'light');
        applyTheme(isNowDark);
    });
}

export function initMobilePanel() {
    const fabPalette = document.getElementById('fab-palette');
    const rightPanelMobile = document.getElementById('right-panel-mobile');
    const btnClosePalette = document.getElementById('btn-close-palette');

    if (fabPalette && rightPanelMobile && btnClosePalette) {
        fabPalette.addEventListener('click', () => rightPanelMobile.classList.add('active'));
        btnClosePalette.addEventListener('click', () => rightPanelMobile.classList.remove('active'));
        document.addEventListener('click', (e) => {
            if (rightPanelMobile.classList.contains('active') && !rightPanelMobile.contains(e.target) && !fabPalette.contains(e.target)) {
                rightPanelMobile.classList.remove('active');
            }
        });
    }
}
