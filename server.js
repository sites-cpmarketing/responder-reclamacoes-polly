const express = require('express');
const multer = require('multer');
const { GoogleGenAI } = require('@google/genai');
const path = require('path');

const app = express();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const SYSTEM_PROMPT = `Você é um especialista em atendimento ao cliente para uma agência profissional.

Sua tarefa é analisar a reclamação ou mensagem do cliente e gerar uma resposta curta, profissional e empática em português.

Regras obrigatórias:
- Seja cordial, nunca agressivo ou defensivo
- Assuma responsabilidade quando necessário, com empatia
- A resposta deve ser CURTA (máximo 4-5 linhas) e pronta para copiar e enviar
- Use linguagem formal mas acessível
- Ofereça sempre uma solução ou próximo passo concreto
- Nunca prometa o que não pode cumprir
- Se for uma crítica dura, mantenha a calma e profissionalismo
- Comece sempre com uma saudação breve como "Olá!" ou "Bom dia!"
- Termine com algo como "Atenciosamente, [Nome da Agência]" ou similar

Retorne APENAS o texto da resposta, sem explicações adicionais, sem markdown, sem aspas.`;

app.post('/api/responder', upload.single('imagem'), async (req, res) => {
  const apiKey = req.headers['x-api-key'];
  if (!apiKey) {
    return res.status(400).json({ error: 'API Key não fornecida. Configure sua chave nas configurações.' });
  }

  const { mensagem, tom } = req.body;
  const imagem = req.file;

  if (!mensagem && !imagem) {
    return res.status(400).json({ error: 'Envie uma mensagem ou imagem.' });
  }

  const tomInstrucao = {
    formal: 'Use tom extremamente formal e corporativo.',
    neutro: 'Use tom neutro e profissional.',
    simpatico: 'Use tom amigável, caloroso e próximo, mas ainda profissional.',
  }[tom] || '';

  try {
    const ai = new GoogleGenAI({ apiKey });

    const contents = [];

    if (imagem) {
      contents.push({
        inlineData: {
          data: imagem.buffer.toString('base64'),
          mimeType: imagem.mimetype,
        },
      });
    }

    const textoMensagem = mensagem
      ? `Reclamação/mensagem do cliente:\n\n${mensagem}`
      : 'Analise a imagem acima que contém a reclamação ou mensagem do cliente.';

    contents.push({ text: textoMensagem + (tomInstrucao ? `\n\nInstrução de tom: ${tomInstrucao}` : '') });

    const result = await ai.models.generateContent({
      model: 'gemini-2.5-flash-preview-04-17',
      config: { systemInstruction: SYSTEM_PROMPT },
      contents,
    });

    const resposta = result.text.trim();
    res.json({ resposta });
  } catch (err) {
    if (err.message?.includes('API_KEY_INVALID') || err.status === 400) {
      return res.status(401).json({ error: 'API Key inválida. Verifique sua chave do Google AI Studio.' });
    }
    console.error(err);
    res.status(500).json({ error: 'Erro ao gerar resposta. Tente novamente.' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`\n✅ Central de Respostas rodando em http://localhost:${PORT}\n`);
});
