// Tải thư viện html2canvas vào bộ nhớ
export function loadHtml2Canvas() {
    if (typeof window.html2canvas === 'undefined') {
        const script = document.createElement('script');
        script.src = "https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js";
        document.head.appendChild(script);
    }
}

// Tiêm template chứng nhận vào DOM (ẩn)
export function injectCertificateTemplate() {
    if (document.getElementById('certificate-template')) return;
    const certHtml = `
        <div id="certificate-template" style="position: absolute; left: -9999px; top: 0; width: 800px; height: 565px; background: linear-gradient(135deg, #f8fafc, #e2e8f0); padding: 40px; text-align: center; color: #1e293b; font-family: 'Times New Roman', serif; box-sizing: border-box; display: flex; flex-direction: column; justify-content: center; align-items: center; border: 15px solid #084298; overflow: hidden;">
            
            <!-- Hoa văn trang trí góc trên trái -->
            <svg style="position: absolute; top: -10px; left: -10px; width: 150px; height: 150px; opacity: 0.1;" viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
                <path fill="#084298" d="M 0,0 L 200,0 L 0,200 Z" />
                <circle cx="50" cy="50" r="30" fill="none" stroke="#084298" stroke-width="4"/>
            </svg>

            <!-- Hoa văn trang trí góc dưới phải -->
            <svg style="position: absolute; bottom: -10px; right: -10px; width: 150px; height: 150px; opacity: 0.1; transform: rotate(180deg);" viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
                <path fill="#084298" d="M 0,0 L 200,0 L 0,200 Z" />
                <circle cx="50" cy="50" r="30" fill="none" stroke="#084298" stroke-width="4"/>
            </svg>

            <!-- Hoa văn nền nhẹ (Watermark mờ) -->
            <svg style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 300px; height: 300px; opacity: 0.03;" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
                <path fill="#084298" d="M50 0 L100 50 L50 100 L0 50 Z" />
            </svg>

            <!-- Logo -->
            <div style="z-index: 1; flex-shrink: 0; width: 85px; height: 85px; background-color: #fff; background-image: url('https://i.postimg.cc/nLxgvY8f/Gemini-Generated-Image-51v46051v46051v4.png'); background-size: cover; background-position: center; border-radius: 50%; box-shadow: 0 4px 10px rgba(0,0,0,0.1); margin-bottom: 15px; border: 2px solid #fbbf24;">
            </div>
            
            <h1 style="z-index: 1; font-size: 2.2rem; color: #b45309; margin: 0 0 8px 0; text-transform: uppercase; letter-spacing: 2px;">Chứng Nhận Xuất Sắc</h1>
            <p style="z-index: 1; font-size: 1.1rem; color: #475569; margin-bottom: 20px;">Hệ thống thi trắc nghiệm Online trực tuyến trân trọng chứng nhận học viên</p>
            
            <h2 id="cert-user-name" style="z-index: 1; font-size: 2.8rem; margin: 0 0 15px 0; color: #0f172a; font-style: italic;">Lê Thanh Trọng</h2>
            
            <p style="z-index: 1; font-size: 1rem; color: #334155; line-height: 1.6; padding: 0 50px;">
                Đã hoàn thành xuất sắc bài thi 
                <strong id="cert-exam-name" style="color: #084298;">MRI-E01</strong><br>
                với số điểm <strong id="cert-score" style="color: #dc2626; font-size: 1.3rem;">10/10</strong>
            </p>
            
            <div style="z-index: 1; display: flex; justify-content: space-between; align-items: flex-end; width: 100%; padding: 0 40px; margin-top: 15px;">
                <div style="text-align: center; display: flex; flex-direction: column; align-items: center; gap: 8px; margin-bottom: 10px;">
                    <p id="cert-date" style="margin: 0; font-size: 1rem; color: #475569; font-weight: bold;">Ngày 26/08/2026</p>
                    <p style="margin: 0; font-size: 0.9rem; color: #64748b;"></p>
                </div>
                
                <div style="text-align: center; display: flex; flex-direction: column; align-items: center; gap: 8px;">
                    <img crossorigin="anonymous" src="https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=https://exam.ktv3mien.com" alt="QR Right" style="width: 75px; height: 75px; border: 2px solid #fff; border-radius: 4px; box-shadow: 0 2px 5px rgba(0,0,0,0.1);">
                    <p style="margin: 0; font-size: 0.9rem; color: #64748b;">Quét để truy cập Website</p>
                </div>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', certHtml);
}

// Xử lý tạo và tải ảnh chứng nhận
export async function downloadCertificate(userName, examName, score) {
    injectCertificateTemplate();
    
    document.getElementById('cert-user-name').innerText = userName;
    document.getElementById('cert-exam-name').innerText = examName;
    document.getElementById('cert-score').innerText = `${score}/10`;
    
    const today = new Date();
    document.getElementById('cert-date').innerText = `Ngày ${today.getDate().toString().padStart(2, '0')}/${(today.getMonth() + 1).toString().padStart(2, '0')}/${today.getFullYear()}`;

    const certElement = document.getElementById('certificate-template');
    
    try {
        certElement.style.left = '0';
        certElement.style.zIndex = '-9999';

        if(typeof window.html2canvas !== 'function') {
            // import showToast is omitted to avoid circular dependencies or complex passing, use alert as fallback or pass it in
            alert("Đang tải bộ xử lý ảnh, vui lòng thử lại trong vài giây!");
            return;
        }

        const canvas = await window.html2canvas(certElement, { scale: 2, useCORS: true, allowTaint: true });
        const imgData = canvas.toDataURL('image/png');
        
        const link = document.createElement('a');
        link.download = `Chung_Nhan_${userName.replace(/\s+/g, '_')}.png`;
        link.href = imgData;
        link.click();
        
    } catch (err) {
        console.error("Lỗi xuất chứng nhận: ", err);
        alert("Có lỗi xảy ra khi tạo chứng nhận!");
    } finally {
        certElement.style.left = '-9999px'; 
    }
}
