import { doc, setDoc, collection, query, where, getDocs, limit, writeBatch } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
// Tìm dòng số 2 và thay thế bằng dòng dưới đây:
import { safeRedirect } from "../dashboard/dashboard-ui.js";
export function initRandomExam(auth, db) {
    const btnRandomExam = document.getElementById('btnRandomExam');
    if (btnRandomExam) {
        btnRandomExam.addEventListener('click', (e) => {
            e.preventDefault();
            
            if (!auth.currentUser) {
                alert("Vui lòng đăng nhập để sử dụng tính năng tạo đề.");
                return;
            }

            const popupHTML = `
                <div class="custom-modal-overlay" id="randomExamModal" style="display: flex; z-index: 100000; background: rgba(15, 23, 42, 0.6); backdrop-filter: blur(4px); justify-content: center; align-items: center;">
                    <div class="custom-modal-content" style="width: 90%; max-width: 400px; background: white; border-radius: 12px; padding: 25px; animation: modalNotifFade 0.25s ease-out; box-shadow: 0 10px 25px rgba(0,0,0,0.2);">
                        <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #e2e8f0; padding-bottom: 15px; margin-bottom: 20px;">
                            <h3 style="margin: 0; font-size: 1.25rem; color: #0f172a;"><i class="fa-solid fa-dice" style="color: #ef4444;"></i> Tạo Đề Ngẫu Nhiên</h3>
                            <button id="closeRandomModalBtn" style="background: none; border: none; font-size: 1.2rem; cursor: pointer; color: #64748b; transition: 0.2s;"><i class="fa-solid fa-xmark"></i></button>
                        </div>
                        <div style="display: flex; flex-direction: column; gap: 15px;">
                            <div>
                                <label style="font-weight: 600; font-size: 0.9rem; color: #475569; display: block; margin-bottom: 8px;">Kỹ thuật hình ảnh:</label>
                                <select id="randTech" style="width: 100%; padding: 12px; border-radius: 8px; border: 1px solid #cbd5e1; outline: none; font-size: 0.95rem; color: #334155;">
                                    <option value="MRI">MRI</option>
                                    <option value="CT">CT Scanner</option>
                                    <option value="X quang">X quang</option>
                                    <option value="Thuốc tương phản">Thuốc tương phản</option>
                                </select>
                            </div>
                            <div>
                                <label style="font-weight: 600; font-size: 0.9rem; color: #475569; display: block; margin-bottom: 8px;">Mức độ khó:</label>
                                <select id="randLevel" style="width: 100%; padding: 12px; border-radius: 8px; border: 1px solid #cbd5e1; outline: none; font-size: 0.95rem; color: #334155;">
                                    <option value="Dễ">Dễ</option>
                                    <option value="Trung bình">Trung bình</option>
                                    <option value="Khó">Khó</option>
                                </select>
                            </div>
                            <div>
                                <label style="font-weight: 600; font-size: 0.9rem; color: #475569; display: block; margin-bottom: 8px;">Thời gian làm bài:</label>
                                <select id="randTime" style="width: 100%; padding: 12px; border-radius: 8px; border: 1px solid #cbd5e1; outline: none; font-size: 0.95rem; color: #334155;">
                                    <option value="15">15 phút (Bốc 15 câu)</option>
                                    <option value="30">30 phút (Bốc 30 câu)</option>
                                    <option value="45">45 phút (Bốc 45 câu)</option>
                                </select>
                            </div>
                            <button id="btnSubmitRandomExam" style="width: 100%; padding: 14px; background: linear-gradient(135deg, #ef4444, #b91c1c); color: white; border: none; border-radius: 8px; font-weight: bold; font-size: 1.05rem; cursor: pointer; margin-top: 10px; transition: 0.2s; box-shadow: 0 4px 10px rgba(239, 68, 68, 0.3);">
                                <i class="fa-solid fa-wand-magic-sparkles"></i> Khởi tạo & Vào thi
                            </button>
                        </div>
                    </div>
                </div>
            `;
            
            document.body.insertAdjacentHTML('beforeend', popupHTML);

            const modal = document.getElementById('randomExamModal');
            const closeBtn = document.getElementById('closeRandomModalBtn');
            
            const closeModal = () => modal.remove();
            closeBtn.addEventListener('click', closeModal);
            modal.addEventListener('click', (ev) => { if (ev.target === modal) closeModal(); });

            document.getElementById('btnSubmitRandomExam').addEventListener('click', async () => {
                const tech = document.getElementById('randTech').value;
                const level = document.getElementById('randLevel').value;
                const timeLimit = parseInt(document.getElementById('randTime').value);
                const btnSubmit = document.getElementById('btnSubmitRandomExam');

                btnSubmit.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Hệ thống đang xáo trộn...';
                btnSubmit.disabled = true;
                btnSubmit.style.opacity = '0.7';

                try {
                    const examsRef = collection(db, "exams");
                    const qExams = query(examsRef, where("technique", "==", tech), where("level", "==", level));
                    const examSnaps = await getDocs(qExams);

                    if (examSnaps.empty) {
                        alert(`Chưa có dữ liệu nào cho bộ môn ${tech} - Cấp độ ${level}.`);
                        btnSubmit.innerHTML = '<i class="fa-solid fa-wand-magic-sparkles"></i> Khởi tạo & Vào thi';
                        btnSubmit.disabled = false;
                        btnSubmit.style.opacity = '1';
                        return;
                    }

                    let examDocs = examSnaps.docs;
                    for (let i = examDocs.length - 1; i > 0; i--) {
                        const j = Math.floor(Math.random() * (i + 1));
                        [examDocs[i], examDocs[j]] = [examDocs[j], examDocs[i]];
                    }

                    let allQuestions = [];
                    for (let docSnap of examDocs) {
                        if (allQuestions.length >= timeLimit) break; 
                        
                        const remainingNeeded = timeLimit - allQuestions.length;
                        const eId = docSnap.id;
                        const qQs = query(collection(db, "questions"), where("examId", "==", eId), limit(remainingNeeded));
                        const qsSnaps = await getDocs(qQs);
                        qsSnaps.forEach(q => allQuestions.push(q.data()));
                    }

                    if (allQuestions.length < timeLimit) {
                        alert(`Kho dữ liệu không đủ! (Hiện chỉ bốc được ${allQuestions.length}/${timeLimit} câu). Vui lòng giảm thời gian xuống.`);
                        btnSubmit.innerHTML = '<i class="fa-solid fa-wand-magic-sparkles"></i> Khởi tạo & Vào thi';
                        btnSubmit.disabled = false;
                        btnSubmit.style.opacity = '1';
                        return;
                    }

                    for (let i = allQuestions.length - 1; i > 0; i--) {
                        const j = Math.floor(Math.random() * (i + 1));
                        [allQuestions[i], allQuestions[j]] = [allQuestions[j], allQuestions[i]];
                    }
                    const selectedQuestions = allQuestions.slice(0, timeLimit);

                    const randomExamId = "RD-" + Math.floor(100000 + Math.random() * 900000);
                    const batch = writeBatch(db);
                    
                    const examRef = doc(db, "exams", randomExamId);
                    batch.set(examRef, {
                        examName: `Đề Ngẫu Nhiên: ${tech} (${level})`,
                        technique: "Đề Ngẫu Nhiên", // Đã đổi từ "AI Tự Động" để tách nhóm riêng trên Admin
                        sourceTech: tech, // Lưu thêm kỹ thuật gốc (MRI, CT,...)
                        level: level,
                        timeLimit: timeLimit,
                        questionCount: timeLimit,
                        isVip: false,
                        createdAt: Date.now(),
                        authorEmail: auth.currentUser.email, // Tài khoản người tạo
                    });

                    for (let i = 0; i < selectedQuestions.length; i++) {
                        let qData = selectedQuestions[i];
                        qData.examId = randomExamId;
                        qData.order = i;
                        const newQRef = doc(collection(db, "questions")); 
                        batch.set(newQRef, qData);
                    }
                    
                    await batch.commit();

                    closeModal();
                    safeRedirect(`quiz.html?examId=${randomExamId}`);

                } catch (error) {
                    console.error("Lỗi trộn đề: ", error);
                    alert("Có lỗi xảy ra do quyền truy cập hoặc kết nối mạng. Vui lòng thử lại!");
                    btnSubmit.innerHTML = '<i class="fa-solid fa-wand-magic-sparkles"></i> Khởi tạo & Vào thi';
                    btnSubmit.disabled = false;
                    btnSubmit.style.opacity = '1';
                }
            });
        });
    }
}
