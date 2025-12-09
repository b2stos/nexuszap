import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Normaliza telefone para formato internacional
function normalizePhone(input: any): { phone: string; isValid: boolean; error: string | null } {
  try {
    if (input === null || input === undefined || input === '') {
      return { phone: '', isValid: false, error: 'Telefone vazio' };
    }

    let value = String(input).trim();
    
    // Converte notação científica (Excel às vezes exporta assim)
    if (value.includes('E') || value.includes('e')) {
      try {
        value = Number(value).toFixed(0);
      } catch {
        // mantém valor original se falhar
      }
    }
    
    // Remove todos os caracteres não numéricos
    let numbers = value.replace(/\D/g, '');
    
    // Se vazio após limpeza
    if (!numbers || numbers.length === 0) {
      return { phone: '', isValid: false, error: 'Telefone sem dígitos válidos' };
    }
    
    // Se muito curto
    if (numbers.length < 10) {
      return { phone: '+' + numbers, isValid: false, error: 'Telefone muito curto (mínimo 10 dígitos)' };
    }
    
    // Se muito longo
    if (numbers.length > 15) {
      return { phone: '+' + numbers, isValid: false, error: 'Telefone muito longo (máximo 15 dígitos)' };
    }
    
    // Adiciona código do Brasil se necessário
    if (numbers.length === 10 || numbers.length === 11) {
      numbers = '55' + numbers;
    }
    
    // Valida formato brasileiro
    if (numbers.startsWith('55')) {
      const isValid = numbers.length >= 12 && numbers.length <= 13;
      if (!isValid) {
        return { phone: '+' + numbers, isValid: false, error: 'Formato brasileiro inválido' };
      }
    }
    
    return { phone: '+' + numbers, isValid: true, error: null };
  } catch (e) {
    return { phone: '', isValid: false, error: 'Erro ao processar telefone' };
  }
}

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

    console.log(`Processing ${rawData.length} contacts`);

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      console.error("LOVABLE_API_KEY not configured");
      return new Response(
        JSON.stringify({ error: "Configuração da IA não encontrada" }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Pega apenas amostra para IA detectar colunas (máximo 5 linhas)
    const sampleData = rawData.slice(0, Math.min(5, rawData.length));
    
    const systemPrompt = `Você é um assistente que analisa planilhas de contatos.
Sua ÚNICA tarefa é identificar qual coluna contém NOMES e qual contém TELEFONES.

Analise os cabeçalhos e dados de exemplo e retorne APENAS o mapeamento das colunas.

Possíveis nomes de colunas para NOME: nome, name, cliente, contato, responsável, pessoa, etc.
Possíveis nomes de colunas para TELEFONE: telefone, phone, celular, whatsapp, tel, número, contato, fone, etc.

Retorne um JSON com APENAS esta estrutura:
{
  "columnMapping": {
    "nameColumn": "nome exato da coluna de nomes",
    "phoneColumn": "nome exato da coluna de telefones"
  }
}`;

    const userPrompt = `Analise esta amostra de planilha e identifique as colunas de nome e telefone:

${JSON.stringify(sampleData, null, 2)}

Retorne APENAS o mapeamento das colunas.`;

    console.log("Calling AI to detect columns...");
    
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

    const aiResult = JSON.parse(resultText);
    const { columnMapping } = aiResult;
    
    console.log("AI detected columns:", columnMapping);

    if (!columnMapping?.nameColumn || !columnMapping?.phoneColumn) {
      return new Response(
        JSON.stringify({ error: "Não foi possível identificar as colunas de nome e telefone" }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Agora processa TODOS os contatos localmente (muito rápido!)
    console.log("Processing all contacts locally...");
    
    const processedContacts = rawData.map((row: any, index: number) => {
      const rawName = row[columnMapping.nameColumn];
      const rawPhone = row[columnMapping.phoneColumn];
      
      const name = rawName ? String(rawName).trim() : '';
      const phoneResult = normalizePhone(rawPhone);
      
      return {
        name,
        phone: phoneResult.phone,
        isValid: phoneResult.isValid && name.length > 0,
        originalPhone: rawPhone ? String(rawPhone) : '',
        error: !name ? 'Nome vazio' : phoneResult.error
      };
    });

    const validCount = processedContacts.filter((c: any) => c.isValid).length;
    const invalidCount = processedContacts.length - validCount;
    
    console.log(`Processing complete: ${validCount} valid, ${invalidCount} invalid`);

    return new Response(
      JSON.stringify({
        columnMapping,
        processedContacts,
        stats: {
          total: processedContacts.length,
          valid: validCount,
          invalid: invalidCount
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Error in smart-contact-import:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message || "Erro ao processar contatos",
        details: error.toString()
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
