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
            // Lệnh tạo Flashcard ôn tập (AI trả về JSON)
            systemInstruction = `Bạn là một chuyên gia y khoa. Dựa vào nội dung câu hỏi và giải thích mà người dùng cung cấp, hãy chắt lọc ra các ý chính cực kỳ ngắn gọn để tạo Flashcard ôn tập.
            QUY TẮC TỐI THƯỢNG: Trả về DUY NHẤT một mảng JSON. TUYỆT ĐỐI KHÔNG dùng ký tự markdown như \`\`\`json. KHÔNG có văn bản chào hỏi.
            Cấu trúc bắt buộc: [{"front": "Từ khóa, khái niệm hoặc câu hỏi cực ngắn", "back": "Ý chính cần nhớ, giải thích cực kỳ xúc tích"}]`;
            
        } else if (action === "summary") {
            // Lệnh tạo Tóm tắt kiến thức (AI CHỈ TRẢ VỀ HTML THUẦN)
            systemInstruction = `Bạn là một chuyên gia y khoa và giảng viên xuất sắc. Dựa vào nội dung các câu hỏi, đáp án đúng và lời giải thích mà người dùng cung cấp, hãy tổng hợp lại thành một bản "Tóm tắt kiến thức cốt lõi" (Cheat Sheet) cực kỳ khoa học và dễ hiểu.
            Yêu cầu:
            - Trình bày trực tiếp bằng các thẻ HTML cơ bản (như <h3>, <ul>, <li>, <strong>, <p>) để hiển thị đẹp mắt trên nền tảng web.
            - Phân chia thành các nhóm chủ đề/ý chính rõ ràng, rành mạch.
            - QUY TẮC TỐI THƯỢNG: TUYỆT ĐỐI CHỈ TRẢ VỀ MÃ HTML THUẦN TÚY. KHÔNG bọc kết quả trong cấu trúc JSON. KHÔNG dùng ký tự markdown như \`\`\`html. KHÔNG có văn bản chào hỏi.`;
            
        } else {
            // Lệnh tạo Đề thi (AI trả về JSON)
            systemInstruction = `Bạn là một chuyên gia ra đề thi trắc nghiệm Kỹ thuật Hình ảnh Y học. Hãy tạo ra đúng ${questionCount \vert{}\vert{} 10} câu hỏi mức độ ${difficulty || 'medium'} dựa vào tài liệu sau.
            QUY TẮC TỐI THƯỢNG: Trả về DUY NHẤT một mảng JSON. TUYỆT ĐỐI KHÔNG dùng ký tự markdown như \`\`\`json. KHÔNG có văn bản chào hỏi.
            Cấu trúc bắt buộc: [{"text": "Câu hỏi", "options": ["A", "B", "C", "D"], "correctAnswer": 0, "explanation": "Giải thích"}]`;
        }

        const geminiResponse = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                contents: [{ 
                    parts: [{ text: systemInstruction + "\n\n--- DỮ LIỆU ĐẦU VÀO ---\n" + promptText }] 
                }]
            })
        });

        if (!geminiResponse.ok) {
            const errorData = await geminiResponse.text(); 
            throw new Error(`Google API báo lỗi ${geminiResponse.status}: ${errorData}`);
        }

        const data = await geminiResponse.json();
        let responseText = data.candidates[0].content.parts[0].text;
        
        // Quét dọn các ký tự thừa markdown
        responseText = responseText.replace(/```json/gi, '').replace(/```html/gi, '').replace(/```/g, '').trim();
        
        // KIỂM SOÁT LUỒNG TRẢ VỀ (TRÁNH LỖI PARSE JSON)
        if (action === "summary") {
            // Tự bọc HTML vào JSON một cách an toàn ở phía Backend
            return res.status(200).json({ summary: responseText });
        } else {
            // Đối với Flashcard và Đề thi thì parse JSON như cũ
            const outputJson = JSON.parse(responseText);
            return res.status(200).json(outputJson);
        }

    } catch (error) {
        console.error("Lỗi Server:", error);
        return res.status(500).json({ error: error.message });
    }
}
