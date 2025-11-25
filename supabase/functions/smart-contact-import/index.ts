import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { rawData } = await req.json();
    
    if (!rawData || !Array.isArray(rawData) || rawData.length === 0) {
      return new Response(
        JSON.stringify({ error: "Dados inválidos ou vazios" }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      console.error("LOVABLE_API_KEY not configured");
      return new Response(
        JSON.stringify({ error: "Configuração da IA não encontrada" }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Prepare sample data for AI analysis (first 5 rows + headers)
    const sampleData = rawData.slice(0, Math.min(6, rawData.length));
    
    const systemPrompt = `Você é um assistente especializado em análise e normalização de dados de contatos.
Sua tarefa é analisar planilhas de contatos em qualquer formato e identificar:
1. Qual coluna contém NOMES (pode ser: nome, name, cliente, contato, responsável, pessoa, etc.)
2. Qual coluna contém TELEFONES (pode ser: telefone, phone, celular, whatsapp, tel, número, contato, fone, etc.)

Além disso, você deve normalizar TODOS os telefones para o formato internacional correto:
- Brasil: +55DDNNNNNNNNN (ex: +5511987654321)
- Outros países: formato internacional apropriado

IMPORTANTE sobre telefones:
- Aceite QUALQUER formato: (11) 98765-4321, +55 11 98765-4321, 11987654321, 5.51199E+10 (notação científica do Excel)
- Remova todos os caracteres não numéricos
- Se não começar com código de país, assuma Brasil (+55)
- Se tiver menos de 10 dígitos, marque como inválido
- Valide se tem DDD válido (para Brasil: 11-99)
- Para notação científica (ex: 5.51199E+10), converta para número inteiro primeiro

Retorne um JSON com esta estrutura:
{
  "columnMapping": {
    "nameColumn": "nome da coluna identificada",
    "phoneColumn": "nome da coluna identificada"
  },
  "processedContacts": [
    {
      "name": "Nome extraído e limpo",
      "phone": "+5511987654321",
      "isValid": true,
      "originalPhone": "valor original",
      "error": null
    }
  ]
}`;

    const userPrompt = `Analise esta amostra de dados de uma planilha de contatos:

${JSON.stringify(sampleData, null, 2)}

Identifique as colunas de nome e telefone, depois processe TODOS os ${rawData.length} contatos a seguir normalizando os telefones:

${JSON.stringify(rawData, null, 2)}`;

    console.log("Calling Lovable AI for intelligent parsing...");
    
    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        response_format: { type: "json_object" },
        temperature: 0.1,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI API error:", response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em alguns instantes." }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Créditos esgotados. Adicione créditos ao seu workspace Lovable." }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ error: "Erro na análise com IA" }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const aiResponse = await response.json();
    const resultText = aiResponse.choices?.[0]?.message?.content;
    
    if (!resultText) {
      throw new Error("Resposta da IA vazia");
    }

    const result = JSON.parse(resultText);
    
    console.log("AI Analysis complete:", {
      totalContacts: result.processedContacts?.length,
      columnMapping: result.columnMapping
    });

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Error in smart-contact-import:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message || "Erro ao processar contatos com IA",
        details: error.toString()
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
