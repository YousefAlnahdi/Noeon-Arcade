export const askDeepSeek = async (messages, gameContext, instruction) => {
    try {
        const response = await fetch('/api/chat', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                messages,
                gameContext,
                promptInstruction: instruction
            })
        });

        if (!response.ok) {
            throw new Error('API Request Failed');
        }

        const data = await response.json();
        return data.reply;
    } catch (error) {
        console.error('DeepSeek connection error:', error);
        return "ERROR: Uplink connection to neural network failed.";
    }
};
