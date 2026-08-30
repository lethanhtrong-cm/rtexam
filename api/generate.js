export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        // Nhận mảng lịch sử thay vì chuỗi promptText đơn lẻ
        const { history } = req.body;
        const apiKey = process.env.GEMINI_API_KEY;
        
        if (!apiKey) {
            return res.status(500).json({ error: 'Không tìm thấy API Key trên Vercel.' });
        }

        const modelName = 'gemini-2.5-flash'; 
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;

        const systemInstruction = "Bạn là Trợ lý AI thông minh chuyên về Kỹ thuật Hình ảnh Y học. Hãy trả lời câu hỏi của người dùng một cách chuyên sâu, chính xác và khoa học. Trình bày bằng định dạng Markdown gọn gàng. Nếu câu hỏi ngoài lề, hãy khéo léo từ chối.";
        
        const generationConfig = { temperature: 0.7 }; 
        
        const requestBody = {
            systemInstruction: { parts: [{ text: systemInstruction }] },
            contents: history, // Đẩy toàn bộ mảng lịch sử chat vào contents
            generationConfig: generationConfig
        };

        const geminiResponse = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(requestBody)
        });

        if (!geminiResponse.ok) {
            const errorData = await geminiResponse.text(); 
            throw new Error(`Google API báo lỗi ${geminiResponse.status}: ${errorData}`);
        }

        const data = await geminiResponse.json();
        const totalTokens = data.usageMetadata ? data.usageMetadata.totalTokenCount : 0;
        const responseText = data.candidates[0].content.parts[0].text;
        
        res.setHeader('X-Token-Usage', totalTokens);
        
        // Phản hồi chuỗi text nguyên bản cho luồng chat
        return res.status(200).json({ response: responseText });

    } catch (error) {
        console.error("Lỗi Server:", error);
        return res.status(500).json({ error: error.message });
    }
}
