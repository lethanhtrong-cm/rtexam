export const UI = {
    resetForm: (currentAdminCategory) => {
        document.getElementById('pptx-title').value = '';
        document.getElementById('pptx-url').value = '';
        document.getElementById('video-upload').value = '';
        document.getElementById('upload-progress').style.display = 'none';
        document.getElementById('btn-save').disabled = false;
        document.getElementById('btn-save').innerHTML = '<i class="fa-solid fa-cloud-arrow-up"></i> Lưu Dữ Liệu';
        document.getElementById('btn-cancel').style.display = 'none';
        document.getElementById('pptx-category').value = currentAdminCategory;
    },

    renderSidebarAndSelect: (adminCategoryTree, currentAdminCategory) => {
        let selectHtml = '';
        let sidebarHtml = `<h3>Danh mục quản lý</h3>`;
        sidebarHtml += `<button id="btn-config-tree" style="margin: 0 20px 15px; padding: 10px; background: #8b5cf6; color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: bold;"><i class="fa-solid fa-sitemap"></i> Cấu Hình Menu (User)</button>`;

        adminCategoryTree.forEach((cat) => {
             // Cấp 1: Chuyên khoa gốc (Cho phép click)
             const isActive1 = currentAdminCategory === cat.id ? 'active' : '';
             selectHtml += `<option value="${cat.id}">${cat.name}</option>`;
             sidebarHtml += `<div class="admin-menu-item ${isActive1}" data-cat="${cat.id}" style="font-weight: 700;"><i class="fa-solid ${cat.icon}" style="color: ${cat.color || '#3b82f6'}; width: 20px;"></i> ${cat.name}</div>`;
             
             if(cat.children && cat.children.length > 0) {
                 cat.children.forEach(child => {
                     // Cấp 2: Nhánh con (Cho phép click để xem bài cũ)
                     const isActive2 = currentAdminCategory === child.id ? 'active' : '';
                     selectHtml += `<option value="${child.id}">${cat.name} - ${child.name}</option>`;
                     sidebarHtml += `<div class="admin-menu-item ${isActive2}" data-cat="${child.id}" style="padding-left: 35px; font-size: 0.95rem;"><i class="fa-solid ${child.icon}" style="width: 20px;"></i> ${child.name}</div>`;

                     if (child.children && child.children.length > 0) {
                         // Cấp 3: Nhánh con sâu nhất (Cho phép click)
                         child.children.forEach(sub => {
                             const isActive3 = currentAdminCategory === sub.id ? 'active' : '';
                             selectHtml += `<option value="${sub.id}">${cat.name} - ${child.name} - ${sub.name}</option>`;
                             sidebarHtml += `<div class="admin-menu-item ${isActive3}" data-cat="${sub.id}" style="padding-left: 55px; font-size: 0.9rem; color: #64748b;"><i class="fa-solid ${sub.icon}" style="width: 20px;"></i> ${sub.name}</div>`;
                         });
                     }
                 });
             }
        });
        return { selectHtml, sidebarHtml };
    },

    renderTreeEditorHtml: (adminCategoryTree) => {
        let html = '';
        adminCategoryTree.forEach((cat, i) => {
            html += `
            <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 15px; margin-bottom: 15px;">
                <div style="display: flex; gap: 10px; margin-bottom: 10px;">
                    <input type="text" value="${cat.name}" placeholder="Tên chuyên khoa" style="flex: 1; padding: 8px; border: 1px solid #cbd5e1; border-radius: 6px; font-weight: bold;" onchange="updateTreeData(${i}, null, null, 'name', this.value)">
                    <input type="text" value="${cat.id}" placeholder="Mã ID" style="width: 120px; padding: 8px; border: 1px solid #cbd5e1; border-radius: 6px;" onchange="updateTreeData(${i}, null, null, 'id', this.value)">
                    <input type="text" value="${cat.icon}" placeholder="Icon" style="width: 140px; padding: 8px; border: 1px solid #cbd5e1; border-radius: 6px;" onchange="updateTreeData(${i}, null, null, 'icon', this.value)">
                    <button class="btn-cancel" style="display:inline-flex;" onclick="removeTreeCat(${i})" title="Xóa chuyên khoa"><i class="fa-solid fa-trash"></i></button>
                </div>
                <div style="padding-left: 30px; border-left: 2px dashed #cbd5e1; display: flex; flex-direction: column; gap: 8px;">
            `;
            
            if (cat.children && cat.children.length > 0) {
                cat.children.forEach((child, j) => {
                    html += `
                    <div style="display: flex; flex-direction: column; gap: 5px; position: relative; margin-top: 5px;">
                        <div style="display: flex; gap: 10px; position: relative; align-items: center;">
                            <span style="position: absolute; left: -30px; top: 15px; width: 20px; height: 2px; background: #cbd5e1;"></span>
                            <input type="text" value="${child.name}" placeholder="Tên nhánh con cấp 2" style="flex: 1; padding: 6px; border: 1px solid #cbd5e1; border-radius: 6px; font-weight: 600;" onchange="updateTreeData(${i}, ${j}, null, 'name', this.value)">
                            <input type="text" value="${child.id}" placeholder="Mã ID nhánh" style="width: 150px; padding: 6px; border: 1px solid #cbd5e1; border-radius: 6px;" onchange="updateTreeData(${i}, ${j}, null, 'id', this.value)">
                            <input type="text" value="${child.icon}" placeholder="Icon" style="width: 140px; padding: 6px; border: 1px solid #cbd5e1; border-radius: 6px;" onchange="updateTreeData(${i}, ${j}, null, 'icon', this.value)">
                            <button class="btn-cancel" style="display:inline-flex; padding: 6px 12px;" onclick="removeTreeChild(${i}, ${j}, null)"><i class="fa-solid fa-xmark"></i></button>
                        </div>`;

                    if (child.children && child.children.length > 0) {
                        html += `<div style="margin-left: 20px; padding-left: 20px; border-left: 2px dotted #cbd5e1; display: flex; flex-direction: column; gap: 8px; margin-top: 5px; margin-bottom: 10px;">`;
                        child.children.forEach((sub, k) => {
                            html += `
                            <div style="display: flex; gap: 10px; position: relative; align-items: center;">
                                <span style="position: absolute; left: -20px; top: 15px; width: 15px; height: 2px; background: #cbd5e1;"></span>
                                <input type="text" value="${sub.name}" placeholder="Tên nhánh cấp 3" style="flex: 1; padding: 4px 6px; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 0.9rem;" onchange="updateTreeData(${i}, ${j}, ${k}, 'name', this.value)">
                                <input type="text" value="${sub.id}" placeholder="Mã ID" style="width: 150px; padding: 4px 6px; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 0.9rem;" onchange="updateTreeData(${i}, ${j}, ${k}, 'id', this.value)">
                                <input type="text" value="${sub.icon}" placeholder="Icon" style="width: 140px; padding: 4px 6px; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 0.9rem;" onchange="updateTreeData(${i}, ${j}, ${k}, 'icon', this.value)">
                                <button class="btn-cancel" style="display:inline-flex; padding: 4px 10px;" onclick="removeTreeChild(${i}, ${j}, ${k})"><i class="fa-solid fa-xmark"></i></button>
                            </div>`;
                        });
                        html += `</div>`;
                    }
                    html += `<div style="margin-left: 40px; margin-bottom: 10px;"><button onclick="addTreeSubChild(${i}, ${j})" style="padding: 4px 10px; background: #8b5cf6; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 0.85rem;">+ Thêm nhánh cấp 3</button></div></div>`;
                });
            }
            html += `<button onclick="addTreeChild(${i})" style="margin-top: 5px; align-self: flex-start; padding: 6px 12px; background: #3b82f6; color: white; border: none; border-radius: 6px; cursor: pointer;">+ Thêm nhánh cấp 2</button>
                </div>
            </div>`;
        });
        return html;
    }
};
