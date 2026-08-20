import { collection, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { showToast, redirect } from './quiz-utils.js';
import { obfuscateText } from './quiz-anti-cheat.js';

export function initQuizUI(db, ctx, actions) {

    // ==========================================
    // 1. MODULE VẼ CÂU HỎI & ĐIỀU HƯỚNG
    // ==========================================
    function handleOptionSelect(idx) {
        if (ctx.isSubmitted) return; 
        
        ctx.userAnswers[ctx.currentIndex] = idx; 
        actions.saveDraft(); 
        renderQuestion(); 
        renderPalette();  
        
        setTimeout(() => {
            if (ctx.isSubmitted) return; 

            if (ctx.currentIndex < ctx.questions.length - 1) {
                ctx.currentIndex++; 
                actions.saveDraft();
                renderAll();
            } else {
                const firstUnansweredIdx = ctx.questions.findIndex((_, i) => ctx.userAnswers[i] === undefined);
                if (firstUnansweredIdx !== -1) {
                    ctx.currentIndex = firstUnansweredIdx; 
                    actions.saveDraft();
                    renderAll();
                }
            }
        }, 300);
    }

    function renderAll() {
        if (ctx.questions.length === 0) return;
        renderQuestion();
        renderPalette();
    }

    function renderQuestion() {
        const questionData = ctx.questions[ctx.currentIndex];
        const questionText = questionData.text || "Câu hỏi không có nội dung";
        const options = questionData.options || [];

        document.getElementById('question-badge').innerText = `Câu ${ctx.currentIndex + 1}`;
        document.getElementById('question-text').innerHTML = obfuscateText(questionText, ctx.isSubmitted, ctx.isShowExplanation);
        
        const container = document.getElementById('options-container');
        container.innerHTML = ''; 

        options.forEach((opt, idx) => {
            const div = document.createElement('div');
            let extraClasses = '';
            
            if (ctx.isSubmitted) extraClasses += ' disabled';
            if (ctx.userAnswers[ctx.currentIndex] === idx) extraClasses += ' selected';

            div.className = 'option-item' + extraClasses;
            div.innerHTML = `<div class="option-label">${['A','B','C','D', 'E', 'F'][idx]}</div><div>${obfuscateText(opt, ctx.isSubmitted, ctx.isShowExplanation)}</div>`;
            
            div.onclick = () => handleOptionSelect(idx);
            container.appendChild(div);
        });

        const btnFlag = document.getElementById('btn-flag');
        if (ctx.flaggedQuestions[ctx.currentIndex]) {
            btnFlag.classList.add('active');
            btnFlag.innerHTML = '<i class="fa-solid fa-flag"></i> Bỏ đánh dấu';
        } else {
            btnFlag.classList.remove('active');
            btnFlag.innerHTML = '<i class="fa-regular fa-flag"></i> Đánh dấu';
        }
    }

    function renderPalette() {
        const container = document.getElementById('palette-container');
        container.innerHTML = '';
        
        ctx.questions.forEach((q, idx) => {
            const btn = document.createElement('button');
            let btnClasses = 'palette-btn';
            if (idx === ctx.currentIndex) btnClasses += ' current';
            if (ctx.userAnswers[idx] !== undefined) btnClasses += ' answered';
            if (ctx.flaggedQuestions[idx]) btnClasses += ' flagged'; 

            btn.className = btnClasses;
            btn.innerText = idx + 1;
            btn.onclick = () => { ctx.currentIndex = idx; actions.saveDraft(); renderAll(); };
            container.appendChild(btn);
        });
        
        const answeredCount = Object.keys(ctx.userAnswers).length;
        const progressPercent = ctx.questions.length > 0 ? (answeredCount / ctx.questions.length) * 100 : 0;
        const progressBar = document.getElementById('progress-bar');
        if (progressBar) progressBar.style.width = `${progressPercent}%`;
    }

    document.getElementById('btn-flag').onclick = () => {
        if (ctx.isSubmitted) return;
        ctx.flaggedQuestions[ctx.currentIndex] = !ctx.flaggedQuestions[ctx.currentIndex];
        actions.saveDraft(); 
        renderQuestion();
        renderPalette();
    };

    document.getElementById('btn-prev').onclick = () => { if(ctx.currentIndex > 0) { ctx.currentIndex--; actions.saveDraft(); renderAll(); } };
    document.getElementById('btn-next').onclick = () => { if(ctx.currentIndex < ctx.questions.length - 1) { ctx.currentIndex++; actions.saveDraft(); renderAll(); } };

    document.addEventListener('keydown', (e) => {
        if (ctx.questions.length === 0 || document.activeElement.tagName === 'TEXTAREA') return;
        const key = e.key;
        if (key === 'ArrowLeft') { if(ctx.currentIndex > 0) { ctx.currentIndex--; actions.saveDraft(); renderAll(); } } 
        else if (key === 'ArrowRight') { if(ctx.currentIndex < ctx.questions.length - 1) { ctx.currentIndex++; actions.saveDraft(); renderAll(); } } 
        else if (!ctx.isSubmitted && ctx.currentMode !== 'flashcard') {
            const keyMap = { 'a': 0, 'A': 0, 'b': 1, 'B': 1, 'c': 2, 'C': 2, 'd': 3, 'D': 3 };
            const optionIndex = keyMap[key];
            if (optionIndex !== undefined && ctx.questions[ctx.currentIndex].options && optionIndex < ctx.questions[ctx.currentIndex].options.length) {
                handleOptionSelect(optionIndex); 
            }
        }
    });

    function submitExam(isAutoSubmit = false) {
        if (ctx.isSubmitted) return;
        const total = ctx.questions.length;
        const answeredCount = Object.keys(ctx.userAnswers).length;
        
        if (!isAutoSubmit) {
            const confirmModal = document.getElementById('confirm-submit-modal');
            document.getElementById('confirm-submit-text').innerText = `Bạn đã hoàn thành ${answeredCount}/${total} câu hỏi.\nBạn có chắc chắn muốn nộp bài lúc này?`;
            confirmModal.classList.add('active');
            
            document.getElementById('btn-confirm-submit').onclick = () => {
                confirmModal.classList.remove('active');
                actions.executeSubmit();
            };
            document.getElementById('btn-cancel-submit').onclick = () => { confirmModal.classList.remove('active'); };
        } else {
            showToast("Hệ thống đang tự động thu bài!");
            actions.executeSubmit();
        }
    }


    // ==========================================
    // 2. MODULE VẼ CÁC MODAL (BẢNG ĐIỂM, REVIEW)
    // ==========================================
    function openReviewModal(score, correctCount, total) {
        const modal = document.getElementById('reviewExamModal');
        const contentArea = document.getElementById('reviewContentArea');
        modal.classList.add('active');

        let html = `
            <div style="background: linear-gradient(135deg, #e0c3fc 0%, #8ec5fc 100%); padding: 20px; border-radius: 12px; margin-bottom: 25px; box-shadow: 0 4px 10px rgba(0,0,0,0.05); color: #1e1b4b; text-align: center;">
                <h2 style="margin: 0 0 5px 0; font-weight: 900;">ĐIỂM SỐ CỦA BẠN: <span style="color: #ea580c; font-size: 1.5em; background: #fff; padding: 2px 15px; border-radius: 20px;">${score}</span></h2>
                <p style="margin: 0; font-weight: 600; opacity: 0.8;">Trả lời đúng: ${correctCount}/${total} câu</p>
            </div>
        `;

        ctx.questions.forEach((q, idx) => {
            const userAns = ctx.userAnswers[idx];
            const correctAns = q.correctAnswer;
            let isUnanswered = userAns === undefined;

            let optionsHtml = '';
            const opts = q.options || [];
            const labels = ['A','B','C','D', 'E', 'F'];

            opts.forEach((optText, oIdx) => {
                let bg = 'var(--bg-panel)'; let border = '2px solid var(--border-color)'; let color = 'var(--text-main)'; let fw = 'normal'; let icon = '';

                if (oIdx === correctAns) {
                    bg = 'rgba(16, 185, 129, 0.1)'; border = '2px solid #10b981'; color = '#10b981'; fw = 'bold';
                    icon = '<i class="fa-solid fa-check-circle" style="color: #10b981; font-size: 1.2rem; float: right;"></i>';
                } else if (oIdx === userAns && userAns !== correctAns) {
                    bg = 'rgba(239, 68, 68, 0.1)'; border = '2px solid #ef4444'; color = '#ef4444'; fw = 'bold';
                    icon = '<i class="fa-solid fa-circle-xmark" style="color: #ef4444; font-size: 1.2rem; float: right;"></i>';
                }

                optionsHtml += `
                    <div style="padding: 12px 15px; margin-bottom: 10px; background: ${bg}; border: ${border}; border-radius: 8px; color: ${color}; font-weight: ${fw}; display: flex; justify-content: space-between; align-items: center;">
                        <div style="flex: 1;"><span style="display:inline-block; width: 25px; font-weight:900;">${labels[oIdx] !== undefined ? labels[oIdx] : oIdx}.</span> ${optText}</div>
                        <div>${icon}</div>
                    </div>
                `;
            });

            let explanationHtml = '';
            if (q.explanation && q.explanation.trim() !== '' && q.explanation.toLowerCase() !== 'không có giải thích chi tiết') {
                explanationHtml = `
                    <div style="margin-top: 15px; padding: 15px; background: rgba(245, 158, 11, 0.1); border-left: 4px solid #f59e0b; border-radius: 6px; font-size: 0.95rem; color: #d97706;">
                        <b style="color: #b45309;"><i class="fa-solid fa-lightbulb"></i> Giải thích:</b><br>${q.explanation}
                    </div>
                `;
            }

            let statusBadge = isUnanswered ? '<span style="background: var(--bg-hover); color: var(--text-muted); padding: 3px 8px; border-radius: 4px; font-size: 0.8rem; font-weight: bold; margin-left: 10px; white-space: nowrap;">Chưa chọn</span>' : 
                              (userAns === correctAns) ? '<span style="background: rgba(16, 185, 129, 0.2); color: #059669; padding: 3px 8px; border-radius: 4px; font-size: 0.8rem; font-weight: bold; white-space: nowrap;">Đúng</span>' : 
                              '<span style="background: rgba(239, 68, 68, 0.2); color: #dc2626; padding: 3px 8px; border-radius: 4px; font-size: 0.8rem; font-weight: bold; white-space: nowrap;">Sai</span>';

            let safeQuestionText = (q.text || "").replace(/"/g, '&quot;');
            
            html += `
                <div style="background: var(--bg-panel); padding: 20px; border-radius: 12px; margin-bottom: 20px; box-shadow: var(--shadow-sm); border: 1px solid var(--border-color);">
                    
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                        <span style="background: #3b82f6; color: #fff; padding: 4px 12px; border-radius: 6px; font-size: 0.85rem; font-weight: 700; white-space: nowrap;">Câu ${idx+1}</span>
                        <button class="btn-report-error" data-qid="${q.id}" data-qtext="${safeQuestionText}" style="background: rgba(239, 68, 68, 0.1); border: 1px solid #f87171; color: #dc2626; padding: 5px 12px; border-radius: 6px; font-size: 0.85rem; font-weight: bold; cursor: pointer; display: flex; align-items: center; gap: 5px; white-space: nowrap; transition: 0.2s;">
                            <i class="fa-solid fa-flag"></i> Báo lỗi
                        </button>
                    </div>
                    
                    <div style="color: var(--text-main); font-weight: 600; font-size: 1.05rem; line-height: 1.6; margin-bottom: 15px;">
                        ${q.text} 
                        <div style="margin-top: 8px; display: inline-block;">${statusBadge}</div>
                    </div>

                    <div>${optionsHtml}</div>
                    ${explanationHtml}
                </div>
            `;
        });

        contentArea.innerHTML = html;

        document.querySelectorAll('.btn-report-error').forEach(btn => {
            btn.addEventListener('mouseover', function() { this.style.background = 'rgba(239, 68, 68, 0.2)'; });
            btn.addEventListener('mouseout', function() { this.style.background = 'rgba(239, 68, 68, 0.1)'; });
            btn.addEventListener('click', function() {
                openReportModal(this.getAttribute('data-qid'), this.getAttribute('data-qtext'));
            });
        });
    }

    let reportingQuestionId = null;
    let reportingQuestionText = "";

    function openReportModal(qId, qText) {
        reportingQuestionId = qId;
        reportingQuestionText = qText;
        
        let previewText = qText.length > 70 ? qText.substring(0, 70) + '...' : qText;
        document.getElementById('reportQuestionTextPreview').innerText = previewText;
        document.getElementById('reportErrorType').value = 'Sai đáp án';
        document.getElementById('reportDescription').value = '';
        document.getElementById('reportQuestionModal').classList.add('active');
    }

    document.getElementById('btnCancelReport').addEventListener('click', () => { document.getElementById('reportQuestionModal').classList.remove('active'); });

    document.getElementById('btnSubmitReport').addEventListener('click', async () => {
        if (!ctx.currentUser) { showToast("Bạn cần đăng nhập để gửi báo cáo!"); return; }
        
        const errorType = document.getElementById('reportErrorType').value;
        const description = document.getElementById('reportDescription').value.trim();
        
        if (!description) { showToast("Vui lòng nhập mô tả chi tiết lỗi!"); return; }
        
        const btnSubmit = document.getElementById('btnSubmitReport');
        btnSubmit.disabled = true;
        btnSubmit.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Đang gửi...';
        
        try {
            await addDoc(collection(db, "reported_questions"), {
                examId: ctx.currentExamId, questionId: reportingQuestionId, questionText: reportingQuestionText,
                reportedBy: ctx.currentUser.email, errorType: errorType, description: description,
                status: "pending", timestamp: serverTimestamp()
            });
            
            showToast("Đã gửi báo cáo lỗi. Xin cảm ơn sự đóng góp của bạn!");
            document.getElementById('reportQuestionModal').classList.remove('active');
        } catch (error) {
            showToast("Đã xảy ra lỗi khi gửi dữ liệu. Vui lòng thử lại sau!");
        } finally {
            btnSubmit.disabled = false;
            btnSubmit.innerText = "Gửi Báo Cáo";
        }
    });

    let selectedStars = 0;
    const stars = document.querySelectorAll('#star-rating span');

    stars.forEach(star => {
        star.onclick = () => {
            selectedStars = parseInt(star.getAttribute('data-value'));
            stars.forEach(s => {
                if (parseInt(s.getAttribute('data-value')) <= selectedStars) s.classList.add('active');
                else s.classList.remove('active');
            });
        };
    });

    document.getElementById('btn-submit-feedback').onclick = async () => {
        if (selectedStars === 0) { showToast("Vui lòng chọn số sao để đánh giá!"); return; }
        const text = document.getElementById('feedback-text').value;
        const btn = document.getElementById('btn-submit-feedback');
        btn.innerText = "Đang gửi..."; btn.disabled = true;

        try {
            await addDoc(collection(db, "feedbacks"), {
                examId: ctx.currentExamId, email: ctx.currentUser.email, rating: selectedStars, comment: text, timestamp: new Date().toISOString()
            });
            document.getElementById('feedback-section').style.display = 'none';
            document.getElementById('feedback-thankyou').style.display = 'block';
        } catch (error) {
            showToast("Lỗi khi gửi đánh giá. Vui lòng thử lại!");
            btn.innerText = "Gửi Đánh Giá"; btn.disabled = false;
        }
    };

    function resetFeedbackUI() {
        document.getElementById('feedback-section').style.display = 'block';
        document.getElementById('feedback-thankyou').style.display = 'none';
        selectedStars = 0;
        stars.forEach(s => s.classList.remove('active'));
        document.getElementById('feedback-text').value = '';
        const btn = document.getElementById('btn-submit-feedback');
        btn.innerText = "Gửi Đánh Giá"; btn.disabled = false;
    }

    function showResultModal(correctCount, total, score, xp = 0, isRetake = false, isNewRecord = false, attendanceBonus = 0) {
        const modal = document.getElementById('result-modal');
        document.getElementById('modal-score-text').innerText = score;
        document.getElementById('modal-correct-text').innerText = `${correctCount}/${total}`;
        
        const percentage = total > 0 ? (correctCount / total) * 100 : 0;
        const scoreCircle = document.getElementById('modal-score-circle');
        scoreCircle.style.background = `conic-gradient(#10b981 ${percentage}%, #d1fae5 ${percentage}%)`;

        let xpDisplay = document.getElementById('modal-xp-display');
        if (!xpDisplay) {
            xpDisplay = document.createElement('div');
            xpDisplay.id = 'modal-xp-display';
            xpDisplay.style.cssText = "margin-top: 15px; font-weight: bold; font-size: 1.1rem; padding: 5px 15px; border-radius: 20px; display: inline-block; box-shadow: 0 2px 5px rgba(0,0,0,0.05);";
            if (scoreCircle && scoreCircle.parentNode) {
                scoreCircle.parentNode.insertBefore(xpDisplay, scoreCircle.nextSibling);
            }
        }
        
        xpDisplay.style.display = 'inline-block';
        
        let totalXPShow = xp + attendanceBonus;
        let attText = attendanceBonus > 0 ? " + Điểm danh" : "";
        
        if (!isRetake) {
            xpDisplay.innerHTML = `🌟 +${totalXPShow} XP${attendanceBonus > 0 ? ' (Gồm Điểm danh)' : ''}`;
            xpDisplay.style.color = "#ea580c";
            xpDisplay.style.background = "#ffedd5";
        } else {
            if (isNewRecord && xp > 0) {
                xpDisplay.innerHTML = `🔥 +${totalXPShow} XP (Vượt kỷ lục${attText})`;
                xpDisplay.style.color = "#ea580c";
                xpDisplay.style.background = "#ffedd5";
            } else {
                xpDisplay.innerHTML = `💡 +${totalXPShow} XP (Chuyên cần${attText})`;
                xpDisplay.style.color = "#059669"; 
                xpDisplay.style.background = "#d1fae5";
            }
        }

        const btnExplain = document.getElementById('btn-modal-explain');
        if (ctx.isCurrentUserVip) {
            btnExplain.innerText = "Xem lại ĐÁP ÁN và GIẢI THÍCH";
            btnExplain.removeAttribute("style");
        } else {
            btnExplain.innerHTML = '<div style="line-height:1.2"><i class="fa-solid fa-lock"></i> Xem lại ĐÁP ÁN và GIẢI THÍCH</div><div style="font-size:0.85rem; margin-top:5px; color:#fef08a">(Cần nâng cấp PRO)</div>';
            btnExplain.style.cssText = "background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); display:flex; flex-direction:column; padding:10px; box-shadow: 0 4px 12px rgba(239,68,68,0.4); border:none;";
        }

        btnExplain.onclick = () => { 
            if (ctx.isCurrentUserVip) {
                closeModal(); 
                openReviewModal(score, correctCount, total); 
            } else {
                alert("Tính năng Xem lại bài làm và Giải thích chi tiết chỉ dành cho Tài khoản PRO. Hệ thống sẽ chuyển hướng đến trang Nâng cấp.");
                sessionStorage.setItem('triggerUpgradeTab', 'true');
                redirect('dashboard.html');
            }
        };

        resetFeedbackUI(); 
        modal.classList.add('active');
    }

    function closeModal() { document.getElementById('result-modal').classList.remove('active'); }

    document.getElementById('closeReviewModalBtn').addEventListener('click', () => {
        document.getElementById('reviewExamModal').classList.remove('active');
        if (ctx.currentResultId) actions.returnToLobbyOrDashboard();
        else document.getElementById('result-modal').classList.add('active');
    });

    document.getElementById('reviewExamModal').addEventListener('click', (e) => {
        if (e.target.id === 'reviewExamModal') {
            document.getElementById('reviewExamModal').classList.remove('active');
            if (ctx.currentResultId) actions.returnToLobbyOrDashboard();
            else document.getElementById('result-modal').classList.add('active');
        }
    });

    document.getElementById('btn-modal-dashboard-modal').onclick = () => actions.returnToLobbyOrDashboard();
    document.getElementById('btn-modal-retry').onclick = () => { closeModal(); actions.initExamState(); };

    // Trả về các hàm Controller (quiz.js) cần dùng
    return {
        renderAll,
        submitExam,
        openReviewModal,
        showResultModal
    };
}
