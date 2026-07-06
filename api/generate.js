// File: api/generate.js
export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        const { promptText, questionCount, difficulty } = req.body;

        // 1. Kiểm tra API Key đã được nạp trên Vercel chưa
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            return res.status(500).json({ error: 'Không tìm thấy API Key trên Vercel. Hãy kiểm tra lại biến môi trường.' });
        }

        // 2. Đổi tên model thành gemini-1.5-flash-latest để khắc phục lỗi 404
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${apiKey}`;

        const systemInstruction = `Bạn là một chuyên gia ra đề thi trắc nghiệm chuyên ngành Kỹ thuật Hình ảnh Y học. Hãy dựa vào nội dung tài liệu được cung cấp để tạo ra đúng ${questionCount} câu hỏi trắc nghiệm ở mức độ ${difficulty}. \nQUY TẮC TỐI THƯỢNG: Chỉ trả về duy nhất một mảng JSON chứa các câu hỏi, KHÔNG bọc mảng trong ký tự markdown như \`\`\`json hay \`\`\`. \nCấu trúc chính xác của mỗi object câu hỏi: { "text": "Câu hỏi", "options": ["A", "B", "C", "D"], "correctAnswer": 0, "explanation": "Giải thích" }`;

        // 3. Gộp Instruction vào nội dung để tránh lỗi 400 (Invalid JSON Payload)
        const geminiResponse = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                contents: [{ 
                    role: "user",
                    parts: [{ text: systemInstruction + "\n\n" + promptText }] 
                }],
                generationConfig: { responseMimeType: "application/json" }
            })
        });

        // 4. Bắt lỗi chi tiết nếu Google vẫn từ chối
        if (!geminiResponse.ok) {
            const errorData = await geminiResponse.text(); 
            throw new Error(`Google API báo lỗi ${geminiResponse.status}: ${errorData}`);
        }

        const data = await geminiResponse.json();
        let responseText = data.candidates[0].content.parts[0].text;
        responseText = responseText.replace(/^```json\s*/, '').replace(/\s*```$/, '').trim();
        
        const questions = JSON.parse(responseText);
        return res.status(200).json(questions);

    } catch (error) {
        console.error("Lỗi Server:", error);
        return res.status(500).json({ error: error.message });
    }
}
