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

        // Tối ưu 1: Chuyển đổi Model dựa trên độ khó để cân bằng chi phí/độ chính xác
        let modelName = 'gemini-1.5-flash'; // Mặc định cho Dễ/Trung bình/Flashcard (Nhanh, Rẻ)
        if (difficulty === 'hard' && action !== 'flashcard') {
            modelName = 'gemini-1.5-pro'; // Dùng Pro cho câu hỏi khó (Thông minh hơn, Suy luận sâu)
        }

        const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;

        let systemInstruction = "";
        let responseSchema = {};

        // Tối ưu 2: Xây dựng câu lệnh chuyên môn & Cấu trúc Schema (Khuôn đúc dữ liệu)
        if (action === "flashcard") {
            systemInstruction = "Bạn là một chuyên gia Kỹ thuật Hình ảnh Y học. Hãy chắt lọc các khái niệm, quy trình và thông số kỹ thuật thành các ý chính cực kỳ ngắn gọn để tạo Flashcard ôn tập. Chỉ sử dụng thuật ngữ y khoa chuẩn xác, tuyệt đối không tự bịa thông tin.";
            
            responseSchema = {
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
        } else {
            systemInstruction = `Bạn là chuyên gia cấp cao ra đề thi Kỹ thuật Hình ảnh Y học. Hãy tạo đúng ${questionCount || 10} câu hỏi mức độ ${difficulty || 'medium'}. 
            Yêu cầu khắt khe: 
            1. Các câu hỏi khó phải đi sâu vào thông số kỹ thuật, vật lý tia X, hoặc định vị giải phẫu.
            2. Bốn đáp án (A, B, C, D) phải có độ dài tương đương nhau để gây nhiễu tốt.
            3. Phần giải thích phải nêu rõ cơ sở khoa học hoặc trích dẫn ngắn gọn nguyên lý máy.`;
            
            responseSchema = {
                type: "ARRAY",
                items: {
                    type: "OBJECT",
                    properties: {
                        text: { type: "STRING", description: "Nội dung câu hỏi y khoa" },
                        options: { 
                            type: "ARRAY", 
                            items: { type: "STRING" }, 
                            description: "Mảng chứa đúng 4 đáp án gây nhiễu" 
                        },
                        correctAnswer: { type: "INTEGER", description: "Vị trí của đáp án đúng (từ 0 đến 3)" },
                        explanation: { type: "STRING", description: "Giải thích cơ sở khoa học của đáp án đúng" }
                    },
                    required: ["text", "options", "correctAnswer", "explanation"]
                }
            };
        }

        // Tạo gói dữ liệu (Payload) gửi lên Google
        const requestBody = {
            systemInstruction: {
                parts: [{ text: systemInstruction }]
            },
            contents: [{ 
                parts: [{ text: "DỮ LIỆU ĐẦU VÀO:\n" + promptText }] 
            }],
            generationConfig: {
                responseMimeType: "application/json",
                responseSchema: responseSchema,
                temperature: 0.2 // Giữ mức thấp để câu trả lời mang tính học thuật cao, ít tính bay bổng
            }
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
        
        // Lấy số lượng token thực tế
        const totalTokens = data.usageMetadata ? data.usageMetadata.totalTokenCount : 0;
        
        // Vì đã ép Schema, dữ liệu trả về chắc chắn 100% là chuỗi JSON chuẩn, không cần quét dọn ký tự thừa
        const responseText = data.candidates[0].content.parts[0].text;
        const outputJson = JSON.parse(responseText);
        
        // Truyền token qua Header để lưu vào Firebase[cite: 2]
        res.setHeader('X-Token-Usage', totalTokens);
        
        return res.status(200).json(outputJson);

    } catch (error) {
        console.error("Lỗi Server:", error);
        return res.status(500).json({ error: error.message });
    }
}
