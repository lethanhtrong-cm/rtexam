// File: api/generate.js
export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        const { promptText, questionCount, difficulty } = req.body;
        const apiKey = process.env.GEMINI_API_KEY;
        
        if (!apiKey) {
            return res.status(500).json({ error: 'Không tìm thấy API Key trên Vercel.' });
        }

        // 1. Cập nhật tên mô hình thành gemini-2.5-flash (Vì bản 1.5 đã bị khai tử)
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

        // 2. Viết câu lệnh cực kỳ chặt chẽ để ép model trả về JSON thuần
        const systemInstruction = `Bạn là một chuyên gia ra đề thi trắc nghiệm Kỹ thuật Hình ảnh Y học. Hãy tạo ra đúng ${questionCount} câu hỏi mức độ ${difficulty} dựa vào tài liệu sau.
        QUY TẮC TỐI THƯỢNG: Trả về DUY NHẤT một mảng JSON. TUYỆT ĐỐI KHÔNG dùng ký tự markdown như \`\`\`json. KHÔNG có văn bản chào hỏi.
        Cấu trúc bắt buộc: [{"text": "Câu hỏi", "options": ["A", "B", "C", "D"], "correctAnswer": 0, "explanation": "Giải thích"}]`;

        // 3. Payload tối giản
        const geminiResponse = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                contents: [{ 
                    parts: [{ text: systemInstruction + "\n\n--- TÀI LIỆU ---\n" + promptText }] 
                }]
            })
        });

        // 4. Đọc lỗi chi tiết nếu có
        if (!geminiResponse.ok) {
            const errorData = await geminiResponse.text(); 
            throw new Error(`Google API báo lỗi ${geminiResponse.status}: ${errorData}`);
        }

        const data = await geminiResponse.json();
        let responseText = data.candidates[0].content.parts[0].text;
        
        // 5. Quét dọn các ký tự thừa
        responseText = responseText.replace(/```json/gi, '').replace(/```/g, '').trim();
        
        const questions = JSON.parse(responseText);
        return res.status(200).json(questions);

    } catch (error) {
        console.error("Lỗi Server:", error);
        return res.status(500).json({ error: error.message });
    }
}
