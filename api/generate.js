// File: api/generate.js
export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        const { promptText, questionCount, difficulty, action } = req.body;
        const apiKey = process.env.GEMINI_API_KEY;
        
        if (!apiKey) {
            return res.status(500).json({ error: 'Không tìm thấy API Key trên Vercel.' });
        }

        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

        let systemInstruction = "";
        
        if (action === "flashcard") {
            // Lệnh tạo Flashcard ôn tập
            systemInstruction = `Bạn là một chuyên gia y khoa. Hãy chắt lọc ý chính cực kỳ ngắn gọn để tạo Flashcard.
            QUY TẮC: Trả về DUY NHẤT mảng JSON, KHÔNG bọc markdown \`\`\`json.
            Cấu trúc: [{"front": "Hỏi ngắn gọn", "back": "Đáp án súc tích"}]`;
            
        } else if (action === "summary") {
            // Lệnh tạo Tóm tắt kiến thức (TỐI ƯU HÓA TỐC ĐỘ ĐỂ CHỐNG TIMEOUT VERCEL)
            systemInstruction = `Bạn là giảng viên y khoa. Dựa vào các câu hỏi sau, hãy TÓM TẮT SIÊU NGẮN GỌN kiến thức lõi (tối đa 300 từ) để học viên ôn thi nhanh.
            Yêu cầu:
            - Trình bày trực tiếp bằng các thẻ HTML (như <h3>, <ul>, <li>, <b>).
            - KHÔNG giải thích dông dài, tập trung thẳng vào key word.
            - QUY TẮC TỐI THƯỢNG: Trả về DUY NHẤT MÃ HTML THUẦN TÚY. KHÔNG bọc kết quả trong cấu trúc JSON. KHÔNG dùng ký tự markdown như \`\`\`html.`;
            
        } else {
            // Lệnh tạo Đề thi (Mặc định)
            systemInstruction = `Bạn là một chuyên gia ra đề thi trắc nghiệm Kỹ thuật Hình ảnh Y học. Hãy tạo ra đúng ${questionCount \vert{}\vert{} 10} câu hỏi mức độ ${difficulty || 'medium'} dựa vào tài liệu sau.
            QUY TẮC TỐI THƯỢNG: Trả về DUY NHẤT một mảng JSON. TUYỆT ĐỐI KHÔNG dùng ký tự markdown như \`\`\`json.
            Cấu trúc bắt buộc: [{"text": "Câu hỏi", "options": ["A", "B", "C", "D"], "correctAnswer": 0, "explanation": "Giải thích"}]`;
        }

        const geminiResponse = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                contents: [{ 
                    parts: [{ text: systemInstruction + "\n\n--- DỮ LIỆU ĐẦU VÀO ---\n" + promptText }] 
                }],
                // Tắt màng lọc để tránh bị Google chặn nhầm thuật ngữ y khoa
                safetySettings: [
                    { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" },
                    { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
                    { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
                    { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" }
                ],
                // Giới hạn Token để tăng tốc độ phản hồi, tránh lỗi 10s Timeout của Vercel
                generationConfig: {
                    maxOutputTokens: 1200
                }
            })
        });

        if (!geminiResponse.ok) {
            const errorData = await geminiResponse.text(); 
            throw new Error(`Lỗi Google API (${geminiResponse.status}): ${errorData}`);
        }

        const data = await geminiResponse.json();
        
        // CƠ CHẾ BẢO VỆ KHI AI TỪ CHỐI TRẢ LỜI
        if (!data.candidates || data.candidates.length === 0) {
            let blockReason = "AI không trả về kết quả hợp lệ.";
            if (data.promptFeedback && data.promptFeedback.blockReason) {
                blockReason = `Yêu cầu bị chặn bởi màng lọc Google: ${data.promptFeedback.blockReason}`;
            }
            throw new Error(blockReason);
        }

        let responseText = data.candidates[0].content.parts[0].text;
        
        // Quét dọn các ký tự thừa markdown
        responseText = responseText.replace(/```json/gi, '').replace(/```html/gi, '').replace(/```/g, '').trim();
        
        // ĐIỀU HƯỚNG DỮ LIỆU TRẢ VỀ
        if (action === "summary") {
            return res.status(200).json({ summary: responseText });
        } else {
            const outputJson = JSON.parse(responseText);
            return res.status(200).json(outputJson);
        }

    } catch (error) {
        console.error("Lỗi Server Vercel:", error);
        
        // TRẢ VỀ HTML BÁO LỖI TRỰC TIẾP LÊN POPUP TÓM TẮT THAY VÌ SẬP SERVER
        if (req.body && req.body.action === "summary") {
            return res.status(200).json({ 
                summary: `<div style="padding: 20px; border: 2px dashed #ef4444; border-radius: 12px; background: #fef2f2; color: #b91c1c;">
                    <h3 style="margin-top: 0; color: #dc2626;"><i class="fa-solid fa-triangle-exclamation"></i> Lỗi Trích Xuất AI</h3>
                    <p style="margin-bottom: 0;"><b>Nguyên nhân:</b> ${error.message}</p>
                </div>` 
            });
        }
        
        return res.status(500).json({ error: error.message });
    }
}
