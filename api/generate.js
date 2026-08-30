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

        let modelName = 'gemini-2.5-flash'; 
        if (difficulty === 'hard' && action !== 'flashcard' && action !== 'chat') {
            modelName = 'gemini-2.5-pro'; 
        }

        const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;

        let systemInstruction = "";
        let generationConfig = { responseMimeType: "application/json" };
        let requestBody = {};

        if (action === "chat") {
            systemInstruction = "Bạn là Trợ lý AI thông minh chuyên về Kỹ thuật Hình ảnh Y học. Hãy trả lời câu hỏi của người dùng một cách chuyên sâu, chính xác và khoa học. Trình bày bằng định dạng Markdown gọn gàng. Nếu câu hỏi ngoài lề, hãy khéo léo từ chối.";
            
            // Xóa MimeType JSON để trả về Text tự do
            generationConfig = { temperature: 0.7 }; 
            
            requestBody = {
                systemInstruction: { parts: [{ text: systemInstruction }] },
                contents: [{ parts: [{ text: promptText }] }],
                generationConfig: generationConfig
            };
        } else if (action === "flashcard") {
            systemInstruction = "Bạn là một chuyên gia Kỹ thuật Hình ảnh Y học. Hãy chắt lọc các khái niệm, quy trình và thông số kỹ thuật thành các ý chính cực kỳ ngắn gọn để tạo Flashcard ôn tập. Chỉ sử dụng thuật ngữ y khoa chuẩn xác, tuyệt đối không tự bịa thông tin.";
            generationConfig.responseSchema = {
                type: "ARRAY",
                items: {
                    type: "OBJECT",
                    properties: {
                        front: { type: "STRING", description: "Từ khóa, khái niệm hoặc tên kỹ thuật cực ngắn" },
                        back: { type: "STRING", description: "Ý chính cần nhớ, giải thích súc tích" }
                    },
                    required: ["front", "back"]
                }
            };
            generationConfig.temperature = 0.2;
            requestBody = {
                systemInstruction: { parts: [{ text: systemInstruction }] },
                contents: [{ parts: [{ text: "DỮ LIỆU ĐẦU VÀO:\n" + promptText }] }],
                generationConfig: generationConfig
            };
        } else {
            systemInstruction = `Bạn là chuyên gia cấp cao ra đề thi Kỹ thuật Hình ảnh Y học. Hãy tạo đúng ${questionCount || 10} câu hỏi mức độ ${difficulty || 'medium'}. 
            Yêu cầu khắt khe: 
            1. Các câu hỏi khó phải đi sâu vào thông số kỹ thuật, vật lý tia X, hoặc định vị giải phẫu.
            2. Bốn đáp án (A, B, C, D) phải có độ dài tương đương nhau để gây nhiễu tốt.
            3. Phần giải thích phải nêu rõ cơ sở khoa học hoặc trích dẫn ngắn gọn nguyên lý máy.`;
            
            generationConfig.responseSchema = {
                type: "ARRAY",
                items: {
                    type: "OBJECT",
                    properties: {
                        text: { type: "STRING", description: "Nội dung câu hỏi y khoa" },
                        options: { type: "ARRAY", items: { type: "STRING" } },
                        correctAnswer: { type: "INTEGER", description: "Vị trí đáp án đúng" },
                        explanation: { type: "STRING", description: "Giải thích cơ sở khoa học" }
                    },
                    required: ["text", "options", "correctAnswer", "explanation"]
                }
            };
            generationConfig.temperature = 0.2;
            requestBody = {
                systemInstruction: { parts: [{ text: systemInstruction }] },
                contents: [{ parts: [{ text: "DỮ LIỆU ĐẦU VÀO:\n" + promptText }] }],
                generationConfig: generationConfig
            };
        }

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
        
        if (action === "chat") {
            // Phản hồi chuỗi text nguyên bản cho luồng chat
            return res.status(200).json({ response: responseText });
        } else {
            const outputJson = JSON.parse(responseText);
            return res.status(200).json(outputJson);
        }

    } catch (error) {
        console.error("Lỗi Server:", error);
        return res.status(500).json({ error: error.message });
    }
}
