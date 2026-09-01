<!DOCTYPE html>
<html lang="vi">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Quản lý Bài giảng PPTX</title>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
    <style>
        * { box-sizing: border-box; margin: 0; padding: 0; font-family: 'Segoe UI', sans-serif; }
        body { background: #f1f5f9; color: #1e293b; padding: 30px; display: flex; justify-content: center; }
        .admin-container { width: 100%; max-width: 1200px; background: white; border-radius: 12px; box-shadow: 0 4px 15px rgba(0,0,0,0.05); overflow: hidden; display: flex; flex-direction: column; }
        .admin-header { background: #0f172a; color: white; padding: 20px 30px; display: flex; justify-content: space-between; align-items: center; }
        .admin-header h1 { font-size: 1.4rem; display: flex; align-items: center; gap: 10px; }
        .admin-header a { color: #cbd5e1; text-decoration: none; font-size: 0.95rem; display: flex; align-items: center; gap: 5px; }
        
        .admin-layout { display: flex; flex: 1; min-height: 600px; }
        
        .admin-sidebar { width: 280px; background: #f8fafc; border-right: 1px solid #e2e8f0; padding: 20px 0; display: flex; flex-direction: column; }
        .admin-sidebar h3 { padding: 0 20px 15px; font-size: 0.9rem; color: #64748b; text-transform: uppercase; letter-spacing: 1px; border-bottom: 1px solid #e2e8f0; margin-bottom: 10px; }
        
        /* Chỉnh sửa style Menu để phân cấp nhóm con */
        .admin-menu-parent { padding: 10px 20px; font-weight: 700; color: #334155; display: flex; align-items: center; gap: 10px; margin-top: 5px; }
        .admin-menu-item { padding: 12px 20px 12px 45px; cursor: pointer; display: flex; align-items: center; gap: 10px; color: #475569; font-weight: 600; transition: 0.2s; border-left: 4px solid transparent; font-size: 0.95rem; }
        .admin-menu-item.root-item { padding-left: 20px; margin-top: 5px; }
        .admin-menu-item:hover { background: #f1f5f9; }
        .admin-menu-item.active { background: #eff6ff; color: #3b82f6; border-left-color: #3b82f6; }
        .admin-menu-item i { width: 16px; text-align: center; }
        
        .admin-main { flex: 1; padding: 30px; overflow-y: auto; }
        
        .form-group { margin-bottom: 20px; }
        .form-group label { display: block; font-weight: 600; margin-bottom: 8px; color: #475569; }
        .form-group input { width: 100%; padding: 12px; border: 1px solid #cbd5e1; border-radius: 8px; outline: none; font-size: 1rem; }
        .btn-submit { background: #3b82f6; color: white; border: none; padding: 12px 25px; border-radius: 8px; font-weight: bold; cursor: pointer; transition: 0.2s; display: inline-flex; align-items: center; gap: 8px; }
        .btn-submit:hover { background: #2563eb; }
        .btn-submit:disabled { background: #94a3b8; cursor: not-allowed; }
        .btn-cancel { background: #ef4444; color: white; border: none; padding: 12px 25px; border-radius: 8px; font-weight: bold; cursor: pointer; display: none; margin-left: 10px; }
        
        table { width: 100%; border-collapse: collapse; margin-top: 20px; }
        th, td { padding: 15px; text-align: left; border-bottom: 1px solid #e2e8f0; }
        th { background: #f8fafc; font-weight: 600; color: #475569; }
        td.link-cell { max-width: 300px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: #64748b; font-size: 0.9rem; }
        .btn-action { border: none; padding: 8px 12px; border-radius: 6px; cursor: pointer; font-weight: bold; font-size: 0.85rem; color: white; }
        .btn-edit { background: #f59e0b; margin-right: 5px; }
        .btn-delete { background: #ef4444; }
        
        .current-cat-badge { display: inline-block; background: #dbeafe; color: #1d4ed8; padding: 5px 12px; border-radius: 20px; font-size: 0.85rem; font-weight: bold; margin-left: 10px; vertical-align: middle; }
    </style>
</head>
<body>
    <div class="admin-container">
        <div class="admin-header">
            <h1><i class="fa-solid fa-file-powerpoint"></i> Quản lý Bài giảng PPTX & Video</h1>
            <a href="../../dashboard.html"><i class="fa-solid fa-arrow-left"></i> Về Dashboard</a>
        </div>
        
        <div class="admin-layout">
            <div class="admin-sidebar">
                <h3>Danh mục quản lý</h3>
                
                <!-- Nhóm MRI (Được chia làm 2 nhánh) -->
                <div class="admin-menu-parent">
                    <i class="fa-solid fa-magnet" style="color: #3b82f6; width: 16px; text-align: center;"></i> Cộng hưởng từ (MRI)
                </div>
                <div class="admin-menu-item active" data-cat="mri_pptx" data-name="MRI - Bản thuyết trình">
                    <i class="fa-solid fa-file-powerpoint"></i> Bản thuyết trình
                </div>
                <div class="admin-menu-item" data-cat="mri_video" data-name="MRI - Video Clip">
                    <i class="fa-solid fa-circle-play"></i> Video Clip
                </div>
                
                <!-- Các nhóm còn lại -->
                <div class="admin-menu-item root-item" data-cat="ct" data-name="CT">
                    <i class="fa-solid fa-x-ray" style="color: #22c55e;"></i> Cắt lớp vi tính (CT)
                </div>
                <div class="admin-menu-item root-item" data-cat="xray" data-name="X-quang">
                    <i class="fa-solid fa-person-rays" style="color: #ec4899;"></i> X-quang
                </div>
                <div class="admin-menu-item root-item" data-cat="contrast" data-name="Thuốc tương phản">
                    <i class="fa-solid fa-syringe" style="color: #f59e0b;"></i> Thuốc tương phản
                </div>
            </div>
            
            <div class="admin-main">
                <div style="background: #f8fafc; padding: 25px; border-radius: 8px; border: 1px dashed #cbd5e1; margin-bottom: 30px;">
                    <h3 style="margin-bottom: 20px; color: #334155; display: flex; align-items: center;">
                        <i class="fa-solid fa-plus-circle" style="margin-right: 10px;"></i> Thêm/Sửa Bài Giảng
                        <span id="form-cat-badge" class="current-cat-badge">Nhóm: MRI - Bản thuyết trình</span>
                    </h3>
                    <div class="form-group">
                        <label>Tên bài giảng:</label>
                        <input type="text" id="pptx-title" placeholder="VD: Giải phẫu MRI Sọ não cơ bản">
                    </div>
                    <div class="form-group">
                        <label>Link nhúng (Google Slides / Youtube URL):</label>
                        <input type="text" id="pptx-url" placeholder="VD: https://docs.google.com/presentation/d/e/2PACX.../embed">
                    </div>
                    
                    <div class="form-group" style="border-top: 1px solid #e2e8f0; padding-top: 15px;">
                        <label><i class="fa-solid fa-upload"></i> Hoặc Tải Video Trực Tiếp (.mp4):</label>
                        <input type="file" id="video-upload" accept="video/*" style="background: white;">
                        <div id="upload-progress" style="font-size: 0.95rem; color: #3b82f6; margin-top: 8px; display: none; font-weight: bold;">Đang tải lên: 0%</div>
                    </div>

                    <button id="btn-save" class="btn-submit"><i class="fa-solid fa-cloud-arrow-up"></i> Lưu Dữ Liệu</button>
                    <button id="btn-cancel" class="btn-cancel"><i class="fa-solid fa-xmark"></i> Hủy Sửa</button>
                </div>

                <h3 style="display: flex; align-items: center; justify-content: space-between;">
                    <span>Danh sách hiện tại</span>
                </h3>
                <table>
                    <thead>
                        <tr>
                            <th>Tên bài giảng</th>
                            <th>Link Nhúng / File Video</th>
                            <th style="width: 150px; text-align: center;">Thao tác</th>
                        </tr>
                    </thead>
                    <tbody id="pptx-tbody">
                        <tr><td colspan="3" style="text-align: center; color: #64748b;">Đang tải dữ liệu...</td></tr>
                    </tbody>
                </table>
            </div>
        </div>
    </div>

    <script type="module" src="admin.js"></script>
</body>
</html>
