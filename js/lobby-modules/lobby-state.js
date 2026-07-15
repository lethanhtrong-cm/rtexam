/**
 * LOBBY STATE - QUẢN LÝ TRẠNG THÁI TOÀN CỤC
 * Bọc trong một const Object để các module khác có thể import và thay đổi (mutate) giá trị bên trong
 * một cách an toàn mà không bị lỗi read-only của ES6 Modules.
 */

const urlParams = new URLSearchParams(window.location.search);

export const state = {
    // Thông tin phòng
    roomId: urlParams.get('roomId'),
    currentRoomStatus: 'waiting',
    currentHostEmail: null,
    currentHostUid: null, // Thêm dòng này để lưu UID của chủ phòng
    isKicked: false,

    // Thông tin người dùng hiện tại
    currentUser: null,
    myParticipantStatus: 'waiting',
    
    // Quản lý Đề thi
    isExamsLoaded: false,
    currentActiveExamId: null,
    currentViewedExamId: null,

    // Quản lý danh sách người tham gia
    currentParticipantsArray: [],

    // Trạng thái giao diện UI
    forceLobbyView: false,
    viewingHistoryMode: false
};

// Log cảnh báo sớm nếu không có roomId để xử lý bên file chính
if (!state.roomId) {
    console.warn("[Lobby State]: Không tìm thấy roomId trên URL!");
}
