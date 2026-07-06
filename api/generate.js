// File: api/generate.js
export default async function handler(req, res) {
    // 1. Chỉ cho phép gọi bằng phương thức POST
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        // 2. Lấy dữ liệu từ Frontend gửi lên
        const { promptText, questionCount, difficulty } = req.body;

        // 3. Lấy API Key bí mật từ Biến môi trường của Vercel
        const apiKey = process.env.GEMINI_API_KEY;
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

        // 4. Lệnh System Prompt
        const systemInstruction = `Bạn là một chuyên gia ra đề thi trắc nghiệm chuyên ngành Kỹ thuật Hình ảnh Y học. Hãy dựa vào nội dung tài liệu được cung cấp để tạo ra đúng ${questionCount} câu hỏi trắc nghiệm ở mức độ ${difficulty}. 
        QUY TẮC TỐI THƯỢNG: Chỉ trả về duy nhất một mảng JSON chứa các câu hỏi, KHÔNG bọc mảng trong ký tự markdown như \`\`\`json hay \`\`\`. 
        Cấu trúc chính xác của mỗi object câu hỏi: { "text": "Câu hỏi", "options": ["A", "B", "C", "D"], "correctAnswer": 0, "explanation": "Giải thích" }`;

        // 5. Máy chủ Vercel thay mặt bạn gọi Google Gemini
        const geminiResponse = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                contents: [{ parts: [{ text: promptText }] }],
                systemInstruction: { parts: [{ text: systemInstruction }] },
                generationConfig: { responseMimeType: "application/json" }
            })
        });

        if (!geminiResponse.ok) {
            throw new Error(`Gemini API Error: ${geminiResponse.status}`);
        }

        const data = await geminiResponse.json();
        let responseText = data.candidates[0].content.parts[0].text;
        responseText = responseText.replace(/^```json\s*/, '').replace(/\s*```$/, '').trim();
        
        const questions = JSON.parse(responseText);

        // 6. Trả mảng câu hỏi về cho Frontend
        return res.status(200).json(questions);

    } catch (error) {
        console.error("Lỗi Server:", error);
        return res.status(500).json({ error: "Lỗi khi tạo đề: " + error.message });
    }
}
