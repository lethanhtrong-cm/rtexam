// File: api/generate.js
export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        const { promptText, questionCount, difficulty } = req.body;

        // 1. Kiểm tra biến môi trường có tồn tại không trước khi gọi
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            return res.status(500).json({ error: 'Missing GEMINI_API_KEY in environment variables' });
        }

        // 2. Sử dụng đúng endpoint chuẩn của Google Gemini 1.5 Flash
        const url = `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

        const systemInstruction = `Bạn là một chuyên gia ra đề thi trắc nghiệm... (giữ nguyên phần này của bạn)`;

        const geminiResponse = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                contents: [{ parts: [{ text: promptText }] }],
                systemInstruction: { parts: [{ text: systemInstruction }] },
                generationConfig: { responseMimeType: "application/json" }
            })
        });

        // 3. Bắt lỗi chi tiết hơn
        if (!geminiResponse.ok) {
            const errorData = await geminiResponse.text(); // Đọc nội dung lỗi từ Google
            throw new Error(`Gemini API Error: ${geminiResponse.status} - ${errorData}`);
        }

        const data = await geminiResponse.json();
        // ... (phần xử lý JSON giữ nguyên)
        const questions = JSON.parse(responseText);

        return res.status(200).json(questions);

    } catch (error) {
        console.error("Lỗi Server:", error);
        return res.status(500).json({ error: error.message });
    }
}
