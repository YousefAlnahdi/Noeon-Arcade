// app/api/chat/route.js
import { NextResponse } from 'next/server';

const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;

export async function POST(req) {
    try {
        const { messages, gameContext, promptInstruction } = await req.json();

        if (!DEEPSEEK_API_KEY) {
            return NextResponse.json({ error: 'DeepSeek API Key missing' }, { status: 500 });
        }

        // Prepare system instructions with the game state / context
        const systemMessage = {
            role: 'system',
            content: `${promptInstruction}
      
Game Context:
${JSON.stringify(gameContext)}
      `
        };

        const payload = {
            model: 'deepseek-chat', // Assuming base tier chat model, adjust if it should be deepseek-reasoner
            messages: [systemMessage, ...messages],
            temperature: 0.7,
            max_tokens: 150 // Keep responses quick for the game chat
        };

        const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${DEEPSEEK_API_KEY}`
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('DeepSeek Error:', errorText);
            return NextResponse.json({ error: 'Failed to fetch from DeepSeek API' }, { status: response.status });
        }

        const data = await response.json();
        return NextResponse.json({ reply: data.choices[0].message.content });

    } catch (error) {
        console.error('API Route Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
