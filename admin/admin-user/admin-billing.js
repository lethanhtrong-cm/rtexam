// ==========================================
// FILE: admin-billing.js
// QUẢN LÝ LOGIC TÍNH TOÁN CHI PHÍ VÀ DÒNG TIỀN
// ==========================================

// Hằng số tỷ giá quy đổi: 1 Triệu Token = 42,638 VNĐ
const COST_PER_MILLION_TOKENS = 42638;

/**
 * Tính toán chi phí thực tế dựa trên số lượng token đã dùng
 * @param {number} totalTokensUsed - Tổng token AI đã tiêu thụ
 * @returns {number} - Chi phí quy ra VNĐ (đã làm tròn)
 */
export function calculateAICostVND(totalTokensUsed) {
    if (!totalTokensUsed || totalTokensUsed <= 0) return 0;
    return Math.round((totalTokensUsed / 1000000) * COST_PER_MILLION_TOKENS);
}

/**
 * Trả về chuỗi HTML chứa badge hiển thị chi phí AI cho người dùng
 * @param {number} totalTokensUsed - Tổng token AI đã tiêu thụ
 * @returns {string} - Chuỗi HTML thẻ Badge
 */
export function getCostBadgeHtml(totalTokensUsed) {
    if (!totalTokensUsed || totalTokensUsed <= 0) return '';
    
    const costVND = calculateAICostVND(totalTokensUsed);
    
    return `<span style="font-size: 11px; color: #059669; font-weight: 700; margin-left: 8px; display: inline-block; background: #d1fae5; padding: 2px 6px; border-radius: 6px;"><i class="fa-solid fa-microchip"></i> Đã dùng AI: ${costVND.toLocaleString('vi-VN')}đ</span>`;
}
