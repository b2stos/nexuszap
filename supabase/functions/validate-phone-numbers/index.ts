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
    const { phoneNumbers } = await req.json();
    
    if (!phoneNumbers || !Array.isArray(phoneNumbers)) {
      throw new Error('phoneNumbers array is required');
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    console.log(`Validating ${phoneNumbers.length} phone numbers`);

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'system',
            content: `Você é um validador especializado de números de telefone do Brasil (WhatsApp).
            
Regras de validação:
- Aceite números com 10 ou 11 dígitos (com DDD)
- Aceite números com ou sem código do país (+55 ou 55)
- Formate todos os números no padrão internacional: +55DDNNNNNNNNN
- Números de celular devem ter 11 dígitos (DDD + 9 + 8 dígitos)
- Números fixos podem ter 10 dígitos (DDD + 8 dígitos)
- Remova caracteres especiais: ( ) - . espaços
- Marque como inválido se não seguir o padrão brasileiro
- Se o número não tiver código de país, adicione +55

Exemplos de entrada -> saída:
- (11) 98765-4321 -> +5511987654321
- 11987654321 -> +5511987654321
- 5511987654321 -> +5511987654321
- +55 11 98765-4321 -> +5511987654321
- 123 -> inválido
- (11) 3333-4444 -> +551133334444 (fixo)`
          },
          {
            role: 'user',
            content: `Valide e formate os seguintes números de telefone:\n\n${phoneNumbers.join('\n')}`
          }
        ],
        tools: [
          {
            type: 'function',
            function: {
              name: 'validate_phone_numbers',
              description: 'Valida e formata números de telefone brasileiros para WhatsApp',
              parameters: {
                type: 'object',
                properties: {
                  results: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        original: { type: 'string', description: 'Número original recebido' },
                        formatted: { type: 'string', description: 'Número formatado no padrão +55DDNNNNNNNNN' },
                        isValid: { type: 'boolean', description: 'Se o número é válido para WhatsApp' },
                        reason: { type: 'string', description: 'Motivo se for inválido' }
                      },
                      required: ['original', 'formatted', 'isValid'],
                      additionalProperties: false
                    }
                  }
                },
                required: ['results'],
                additionalProperties: false
              }
            }
          }
        ],
        tool_choice: { type: 'function', function: { name: 'validate_phone_numbers' } }
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI Gateway error:', response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Limite de requisições excedido. Tente novamente em alguns instantes.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: 'Créditos insuficientes. Adicione créditos ao seu workspace.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      throw new Error(`AI Gateway error: ${response.status}`);
    }

    const data = await response.json();
    console.log('AI response:', JSON.stringify(data));

    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) {
      throw new Error('No tool call in response');
    }

    const validationResults = JSON.parse(toolCall.function.arguments);
    console.log(`Validation complete: ${validationResults.results.length} numbers processed`);

    const validCount = validationResults.results.filter((r: any) => r.isValid).length;
    const invalidCount = validationResults.results.length - validCount;
    
    console.log(`Valid: ${validCount}, Invalid: ${invalidCount}`);

    return new Response(
      JSON.stringify(validationResults),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error in validate-phone-numbers:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
