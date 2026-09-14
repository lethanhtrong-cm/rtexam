import { collection, addDoc, serverTimestamp, getDoc, doc, updateDoc, increment } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { showToast, redirect } from './quiz-utils.js';

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

        const badge = document.getElementById('question-badge');
        if (badge) badge.innerText = `Câu ${ctx.currentIndex + 1}`;
        
        const textContainer = document.getElementById('question-text');
        if (textContainer) textContainer.innerHTML = questionText;
        
        const container = document.getElementById('options-container');
        if (container) {
            container.innerHTML = ''; 
            options.forEach((opt, idx) => {
                const div = document.createElement('div');
                let extraClasses = '';
                
                if (ctx.isSubmitted) extraClasses += ' disabled';
                if (ctx.userAnswers[ctx.currentIndex] === idx) extraClasses += ' selected';

                div.className = 'option-item' + extraClasses;
                div.innerHTML = `<div class="option-label">${['A','B','C','D', 'E', 'F'][idx]}</div><div>${opt}</div>`;
                
                div.onclick = () => handleOptionSelect(idx);
                container.appendChild(div);
            });
        }

        const btnFlag = document.getElementById('btn-flag');
        if (btnFlag) {
            if (ctx.flaggedQuestions[ctx.currentIndex]) {
                btnFlag.classList.add('active');
                btnFlag.innerHTML = '<i class="fa-solid fa-flag"></i> Bỏ đánh dấu';
            } else {
                btnFlag.classList.remove('active');
                btnFlag.innerHTML = '<i class="fa-regular fa-flag"></i> Đánh dấu';
            }
        }
    }

    function renderPalette() {
        const container = document.getElementById('palette-container');
        if (!container) return;
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

    const btnFlag = document.getElementById('btn-flag');
    if (btnFlag) {
        btnFlag.onclick = () => {
            if (ctx.isSubmitted) return;
            ctx.flaggedQuestions[ctx.currentIndex] = !ctx.flaggedQuestions[ctx.currentIndex];
            actions.saveDraft(); 
            renderQuestion();
            renderPalette();
        };
    }

    const btnPrev = document.getElementById('btn-prev');
    if (btnPrev) {
        btnPrev.onclick = () => { if(ctx.currentIndex > 0) { ctx.currentIndex--; actions.saveDraft(); renderAll(); } };
    }
    
    const btnNext = document.getElementById('btn-next');
    if (btnNext) {
        btnNext.onclick = () => { if(ctx.currentIndex < ctx.questions.length - 1) { ctx.currentIndex++; actions.saveDraft(); renderAll(); } };
    }

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
            if (!confirmModal) { actions.executeSubmit(); return; } 
            
            const confirmText = document.getElementById('confirm-submit-text');
            if (confirmText) confirmText.innerText = `Bạn đã hoàn thành ${answeredCount}/${total} câu hỏi.\nBạn có chắc chắn muốn nộp bài lúc này?`;
            
            confirmModal.classList.add('active');
            
            const btnConfirmSubmit = document.getElementById('btn-confirm-submit');
            if (btnConfirmSubmit) {
                btnConfirmSubmit.onclick = () => {
                    confirmModal.classList.remove('active');
                    actions.executeSubmit();
                };
            }
            
            const btnCancelSubmit = document.getElementById('btn-cancel-submit');
            if (btnCancelSubmit) {
                btnCancelSubmit.onclick = () => { confirmModal.classList.remove('active'); };
            }
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
        if (!modal || !contentArea) return;

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
        const textPreview = document.getElementById('reportQuestionTextPreview');
        if (textPreview) textPreview.innerText = previewText;
        
        const typeInput = document.getElementById('reportErrorType');
        if (typeInput) typeInput.value = 'Sai đáp án';
        
        const descInput = document.getElementById('reportDescription');
        if (descInput) descInput.value = '';
        
        document.getElementById('reportQuestionModal')?.classList.add('active');
    }

    document.getElementById('btnCancelReport')?.addEventListener('click', () => { 
        document.getElementById('reportQuestionModal')?.classList.remove('active'); 
    });

    document.getElementById('btnSubmitReport')?.addEventListener('click', async () => {
        if (!ctx.currentUser) { showToast("Bạn cần đăng nhập để gửi báo cáo!"); return; }
        
        const errorType = document.getElementById('reportErrorType')?.value || 'Khác';
        const description = document.getElementById('reportDescription')?.value.trim() || '';
        
        if (!description) { showToast("Vui lòng nhập mô tả chi tiết lỗi!"); return; }
        
        const btnSubmit = document.getElementById('btnSubmitReport');
        if (btnSubmit) {
            btnSubmit.disabled = true;
            btnSubmit.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Đang gửi...';
        }
        
        try {
            await addDoc(collection(db, "reported_questions"), {
                examId: ctx.currentExamId, questionId: reportingQuestionId, questionText: reportingQuestionText,
                reportedBy: ctx.currentUser.email, errorType: errorType, description: description,
                status: "pending", timestamp: serverTimestamp()
            });
            
            showToast("Đã gửi báo cáo lỗi. Xin cảm ơn sự đóng góp của bạn!");
            document.getElementById('reportQuestionModal')?.classList.remove('active');
        } catch (error) {
            showToast("Đã xảy ra lỗi khi gửi dữ liệu. Vui lòng thử lại sau!");
        } finally {
            if (btnSubmit) {
                btnSubmit.disabled = false;
                btnSubmit.innerText = "Gửi Báo Cáo";
            }
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

    const btnSubmitFeedback = document.getElementById('btn-submit-feedback');
    if (btnSubmitFeedback) {
        btnSubmitFeedback.onclick = async () => {
            if (selectedStars === 0) { showToast("Vui lòng chọn số sao để đánh giá!"); return; }
            const text = document.getElementById('feedback-text')?.value || "";
            
            btnSubmitFeedback.innerText = "Đang gửi..."; 
            btnSubmitFeedback.disabled = true;

            try {
                await addDoc(collection(db, "feedbacks"), {
                    examId: ctx.currentExamId, email: ctx.currentUser.email, rating: selectedStars, comment: text, timestamp: new Date().toISOString()
                });
                const fSection = document.getElementById('feedback-section');
                const fThanks = document.getElementById('feedback-thankyou');
                if(fSection) fSection.style.display = 'none';
                if(fThanks) fThanks.style.display = 'block';
            } catch (error) {
                showToast("Lỗi khi gửi đánh giá. Vui lòng thử lại!");
                btnSubmitFeedback.innerText = "Gửi Đánh Giá"; 
                btnSubmitFeedback.disabled = false;
            }
        };
    }

    function resetFeedbackUI() {
        const fSection = document.getElementById('feedback-section');
        const fThanks = document.getElementById('feedback-thankyou');
        if (fSection) fSection.style.display = 'block';
        if (fThanks) fThanks.style.display = 'none';
        
        selectedStars = 0;
        stars.forEach(s => s.classList.remove('active'));
        
        const fText = document.getElementById('feedback-text');
        if(fText) fText.value = '';
        
        if(btnSubmitFeedback) {
            btnSubmitFeedback.innerText = "Gửi Đánh Giá"; 
            btnSubmitFeedback.disabled = false;
        }
    }

    function showResultModal(correctCount, total, score, xp = 0, isRetake = false, isNewRecord = false, attendanceBonus = 0) {
        const modal = document.getElementById('result-modal');
        if (!modal) return;
        
        const scoreTxt = document.getElementById('modal-score-text');
        if(scoreTxt) scoreTxt.innerText = score;
        
        const correctTxt = document.getElementById('modal-correct-text');
        if(correctTxt) correctTxt.innerText = `${correctCount}/${total}`;
        
        const percentage = total > 0 ? (correctCount / total) * 100 : 0;
        const scoreCircle = document.getElementById('modal-score-circle');
        if (scoreCircle) scoreCircle.style.background = `conic-gradient(#10b981 ${percentage}%, #d1fae5 ${percentage}%)`;

        let xpDisplay = document.getElementById('modal-xp-display');
        if (!xpDisplay && scoreCircle && scoreCircle.parentNode) {
            xpDisplay = document.createElement('div');
            xpDisplay.id = 'modal-xp-display';
            xpDisplay.style.cssText = "margin-top: 15px; font-weight: bold; font-size: 1.1rem; padding: 5px 15px; border-radius: 20px; display: inline-block; box-shadow: 0 2px 5px rgba(0,0,0,0.05);";
            scoreCircle.parentNode.insertBefore(xpDisplay, scoreCircle.nextSibling);
        }
        
        if (xpDisplay) {
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
        }

        const btnExplain = document.getElementById('btn-modal-explain');
        if (btnExplain) {
            if (['plus', 'pro'].includes(ctx.currentUserVipTier)) {
                btnExplain.innerText = "Xem lại ĐÁP ÁN và GIẢI THÍCH";
                btnExplain.removeAttribute("style");
            } else {
                btnExplain.innerHTML = '<div style="line-height:1.2"><i class="fa-solid fa-lock"></i> Xem lại ĐÁP ÁN và GIẢI THÍCH</div><div style="font-size:0.85rem; margin-top:5px; color:#fef08a">(Cần nâng cấp gói Plus/Pro)</div>';
                btnExplain.style.cssText = "background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); display:flex; flex-direction:column; padding:10px; box-shadow: 0 4px 12px rgba(239,68,68,0.4); border:none;";
            }

            btnExplain.onclick = () => { 
                if (['plus', 'pro'].includes(ctx.currentUserVipTier)) {
                    closeModal(); 
                    openReviewModal(score, correctCount, total); 
                } else {
                    alert("Tính năng Xem lại bài làm và Giải thích chi tiết chỉ dành cho Tài khoản Plus hoặc Pro. Hệ thống sẽ chuyển hướng đến trang Nâng cấp.");
                    sessionStorage.setItem('triggerUpgradeTab', 'true');
                    redirect('dashboard.html');
                }
            };
        }

        // ==========================================
        // GHI ĐÈ NÚT FLASHCARD CŨ SANG AI SUMMARY
        // ==========================================
        let btnCreateFlashcard = document.getElementById('btn-create-flashcard');
        if (btnCreateFlashcard) {
            // Đổi giao diện nút
            btnCreateFlashcard.innerHTML = '<i class="fa-solid fa-wand-magic-sparkles"></i> Tóm tắt kiến thức';
            btnCreateFlashcard.style.background = 'linear-gradient(135deg, #a855f7 0%, #7c3aed 100%)';
            btnCreateFlashcard.style.color = 'white';
            
            // Xóa hết Event Listener cũ (nếu có từ quiz-flashcard.js) bằng cách thay thế Node
            let newBtn = btnCreateFlashcard.cloneNode(true);
            btnCreateFlashcard.parentNode.replaceChild(newBtn, btnCreateFlashcard);
            
            newBtn.addEventListener('click', () => {
                document.getElementById('result-modal').classList.remove('active'); 
                executeAiSummary(ctx.currentExamId, ctx.questions);
            });
        }

        const btnRetry = document.getElementById('btn-modal-retry');
        const btnDashModal = document.getElementById('btn-modal-dashboard-modal');
        
        let btnRow = document.getElementById('modal-btn-row');
        if (!btnRow && btnRetry && btnDashModal) {
            const parent = btnRetry.parentNode;
            btnRow = document.createElement('div');
            btnRow.id = 'modal-btn-row';
            btnRow.style.cssText = "display: flex; gap: 10px; width: 100%; margin-top: 10px;";
            
            btnRetry.style.flex = '1'; btnRetry.style.margin = '0'; btnRetry.style.padding = '12px 10px'; btnRetry.style.whiteSpace = 'nowrap';
            btnDashModal.style.flex = '1'; btnDashModal.style.margin = '0'; btnDashModal.style.padding = '12px 10px'; btnDashModal.style.whiteSpace = 'nowrap';
            
            parent.insertBefore(btnRow, btnRetry);
            btnRow.appendChild(btnRetry);
            btnRow.appendChild(btnDashModal);
        }

        let certBtn = document.getElementById('btn-download-cert');
        if (score > 8 && ['plus', 'pro'].includes(ctx.currentUserVipTier)) {
            if (!certBtn && btnRow) {
                certBtn = document.createElement('button');
                certBtn.id = 'btn-download-cert';
                certBtn.innerHTML = '<i class="fa-solid fa-award"></i> Tải Chứng Nhận Xuất Sắc';
                certBtn.style.cssText = "background: linear-gradient(135deg, #f59e0b, #d97706); color: white; border: none; padding: 12px 20px; border-radius: 8px; font-weight: bold; cursor: pointer; margin-bottom: 10px; width: 100%; box-shadow: 0 4px 10px rgba(245, 158, 11, 0.3); display: flex; justify-content: center; align-items: center; gap: 8px; font-size: 1.05rem; transition: 0.2s;";
                
                certBtn.onmouseover = () => certBtn.style.transform = 'translateY(-2px)';
                certBtn.onmouseout = () => certBtn.style.transform = 'translateY(0)';
                
                certBtn.onclick = () => {
                    if (actions.downloadCert) actions.downloadCert(score);
                };
                
                btnRow.parentNode.insertBefore(certBtn, btnRow);
            } else if (certBtn) {
                certBtn.style.display = 'flex';
            }
        } else {
            if (certBtn) certBtn.style.display = 'none';
        }

        resetFeedbackUI(); 
        modal.classList.add('active');
    }

    function closeModal() { 
        document.getElementById('result-modal')?.classList.remove('active'); 
    }

    document.getElementById('closeReviewModalBtn')?.addEventListener('click', () => {
        document.getElementById('reviewExamModal')?.classList.remove('active');
        if (ctx.currentResultId) actions.returnToLobbyOrDashboard();
        else document.getElementById('result-modal')?.classList.add('active');
    });

    document.getElementById('reviewExamModal')?.addEventListener('click', (e) => {
        if (e.target.id === 'reviewExamModal') {
            document.getElementById('reviewExamModal').classList.remove('active');
            if (ctx.currentResultId) actions.returnToLobbyOrDashboard();
            else document.getElementById('result-modal')?.classList.add('active');
        }
    });

    const btnDashModal = document.getElementById('btn-modal-dashboard-modal');
    if (btnDashModal) btnDashModal.onclick = () => actions.returnToLobbyOrDashboard();
    
    const btnRetry = document.getElementById('btn-modal-retry');
    if (btnRetry) btnRetry.onclick = () => { closeModal(); actions.initExamState(); };

    // ==========================================
    // LOGIC GỌI API: AI SUMMARY (NGAY TẠI BÀI THI)
    // ==========================================
    async function executeAiSummary(examId, loadedQuestions) {
        if (!ctx.currentUser) {
            showToast("Vui lòng đăng nhập để sử dụng tính năng này!");
            return;
        }

        const uid = ctx.currentUser.uid;
        const todayStr = new Date().toLocaleDateString('en-CA');
        let currentSummaryCount = 0;
        
        let maxLimit = 0;
        let isUserPro = false;
        let globalAiTier = 'free';

        try {
            const userSnap = await getDoc(doc(db, "users", uid));
            if (userSnap.exists()) {
                const userData = userSnap.data();
                globalAiTier = userData.vipTier || 'free';
                isUserPro = (globalAiTier === 'pro');
                
                if (globalAiTier === 'plus') maxLimit = 1;
                else if (globalAiTier === 'pro') maxLimit = Infinity;
                else maxLimit = 0;

                if (maxLimit === 0) {
                    alert("Tính năng Tóm tắt kiến thức không khả dụng cho tài khoản Free. Vui lòng nâng cấp gói Plus hoặc Pro để sử dụng!");
                    document.getElementById('result-modal').classList.add('active');
                    return;
                }

                if (maxLimit !== Infinity) {
                    const lastDate = userData.aiSummaryLastUsedDate || '';
                    currentSummaryCount = (lastDate === todayStr) ? (userData.aiSummaryDailyCount || 0) : 0;
                    if (currentSummaryCount >= maxLimit) {
                        alert(`Bạn đã hết lượt Tóm tắt kiến thức trong ngày (${maxLimit}/${maxLimit}). Nâng cấp gói Pro để sử dụng không giới hạn!`);
                        document.getElementById('result-modal').classList.add('active');
                        return;
                    }
                }
            }
        } catch (e) {
            showToast("Lỗi kiểm tra quyền hạn AI.");
            document.getElementById('result-modal').classList.add('active');
            return;
        }

        let modal = document.getElementById('aiSummaryModalQuiz');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'aiSummaryModalQuiz';
            modal.style.cssText = "position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(15, 23, 42, 0.75); backdrop-filter: blur(4px); z-index: 100000; display: flex; align-items: center; justify-content: center; padding: 15px;";
            modal.innerHTML = `
                <div style="background: #fff; width: 100%; max-width: 700px; height: 85vh; border-radius: 16px; display: flex; flex-direction: column; overflow: hidden; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.1); animation: scaleIn 0.2s ease-out;">
                    <style>@keyframes scaleIn { from { transform: scale(0.95); opacity: 0; } to { transform: scale(1); opacity: 1; } }</style>
                    <div style="padding: 18px 24px; background: linear-gradient(135deg, #a855f7 0%, #7c3aed 100%); color: white; display: flex; justify-content: space-between; align-items: center; flex-shrink: 0;">
                        <h3 style="margin: 0; font-size: 1.2rem; font-weight: 700;"><i class="fa-solid fa-bolt" style="color: #fde047;"></i> Tóm tắt kiến thức cốt lõi</h3>
                        <button id="closeAiSumModal" style="background: transparent; border: none; color: white; font-size: 1.4rem; cursor: pointer; transition: 0.2s;" onmouseover="this.style.color='#cbd5e1'" onmouseout="this.style.color='white'"><i class="fa-solid fa-xmark"></i></button>
                    </div>
                    <div id="aiSummaryContentQuiz" style="padding: 24px; overflow-y: auto; flex: 1; font-size: 1rem; line-height: 1.7; color: #334155; background: #f8fafc;">
                        <div style="text-align: center; padding: 50px 0;">
                            <i class="fa-solid fa-wand-magic-sparkles fa-spin fa-2x" style="color: #7c3aed; margin-bottom: 15px;"></i>
                            <p style="margin: 0; color: #475569; font-weight: 600; font-size: 1.05rem;">AI đang đọc đề và tổng hợp kiến thức...</p>
                            <p style="margin: 5px 0 0 0; color: #94a3b8; font-size: 0.9rem;">Quá trình này có thể mất vài giây tùy thuộc vào độ dài của đề thi.</p>
                        </div>
                    </div>
                </div>
            `;
            document.body.appendChild(modal);
            
            document.getElementById('closeAiSumModal').onclick = () => {
                modal.remove();
                document.getElementById('result-modal').classList.add('active');
            };
        }

        const contentBox = document.getElementById('aiSummaryContentQuiz');

        try {
            let questionsText = loadedQuestions.map((q, i) => `${i+1}. ${q.text || q.questionText || q.content || q.question || ''}`).join('\n');
            if (!questionsText.trim()) throw new Error("Đề thi này trống hoặc không có nội dung văn bản để tổng hợp.");
            
            questionsText = questionsText.substring(0, 15000); 

            const prompt = `Đóng vai trò là một giảng viên y khoa giàu kinh nghiệm. Hãy đọc nội dung các câu hỏi của đề thi "${examId}" dưới đây và TỔNG HỢP KIẾN THỨC CỐT LÕI nhất.\n\nYêu cầu:\n- Trình bày dạng các gạch đầu dòng (bullet points) dễ học, dễ nhớ.\n- Không chép lại nguyên văn câu hỏi, hãy rút ra bản chất kiến thức/đáp án đúng từ các câu hỏi đó.\n- Trình bày khoa học, hệ thống.\n\nNội dung đề:\n${questionsText}`;

            const response = await fetch('/api/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    history: [{ role: "user", parts: [{ text: prompt }] }]
                })
            });

            const usedTokens = parseInt(response.headers.get('X-Token-Usage')) || 0;

            if (!response.ok) {
                const errData = await response.text();
                if (response.status === 429 || errData.includes('RESOURCE_EXHAUSTED')) throw new Error("Hệ thống AI đang quá tải lượt dùng. Vui lòng thử lại sau ít phút!");
                throw new Error("Lỗi kết nối máy chủ AI.");
            }

            const data = await response.json();
            const resultText = data.response || "Lỗi: Không có dữ liệu trả về.";

            let formattedText = resultText
                .replace(/\*\*(.*?)\*\*/g, '<strong style="color:#0f172a;">$1</strong>')
                .replace(/\*(.*?)\*/g, '<em>$1</em>')
                .replace(/\n/g, '<br>')
                .replace(/- /g, '<span style="color:#7c3aed; font-weight:bold; margin-right:5px;">•</span>');

            const displayCount = currentSummaryCount + 1;

            contentBox.innerHTML = `
                <div style="background: #ffffff; padding: 25px; border-radius: 12px; border: 1px solid #e2e8f0; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); text-align: justify;">
                    ${formattedText}
                </div>
                <div style="margin-top: 15px; text-align: right; font-size: 0.85rem; color: #64748b; font-weight: 600;">
                    ${isUserPro ? '<i class="fa-solid fa-infinity" style="color: #8b5cf6;"></i> Plus/Pro: Không giới hạn' : `Lượt dùng trong ngày: ${displayCount} / ${maxLimit}`}
                </div>
            `;

            if (usedTokens > 0) {
                let updateData = { totalTokensUsed: increment(usedTokens) };
                if (!isUserPro) {
                    updateData.aiSummaryDailyCount = currentSummaryCount + 1;
                    updateData.aiSummaryLastUsedDate = todayStr;
                }
                await updateDoc(doc(db, "users", uid), updateData);
            }

        } catch (error) {
            contentBox.innerHTML = `
                <div style="text-align: center; padding: 40px 20px;">
                    <i class="fa-solid fa-triangle-exclamation fa-3x" style="color: #ef4444; margin-bottom: 15px;"></i>
                    <h4 style="margin: 0 0 10px 0; color: #b91c1c;">Lỗi xử lý</h4>
                    <p style="margin: 0; color: #475569;">${error.message}</p>
                </div>
            `;
        }
    }

    return {
        renderAll,
        submitExam,
        openReviewModal,
        showResultModal
    };
}
