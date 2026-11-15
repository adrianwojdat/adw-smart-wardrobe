import type { ZodType } from 'zod';

import {
  aiAnalysisSchema,
  aiLanguageInstruction,
  localizeAnalysis,
  orientationSchema,
} from '@wardrobe/shared';

export class AiUnavailable extends Error {}

function config() {
  const base = process.env.OLLAMA_BASE_URL,
    model = process.env.OLLAMA_VISION_MODEL;

  if (!base || !model) throw new AiUnavailable('Nie skonfigurowano komputera AI.');

  const url = new URL(base);

  if (['localhost', '127.0.0.1', '::1', '[::1]', '0.0.0.0'].includes(url.hostname))
    throw new AiUnavailable('Ollama wymaga adresu LAN oddzielnego PC.');

  return { base: url.toString().replace(/\/$/, ''), model };
}

async function vision<T>(
  image: Buffer,
  prompt: string,
  schema: ZodType<T>,
  timeout: number,
  signal?: AbortSignal,
): Promise<T> {
  const { base, model } = config();
  let r: Response;

  try {
    r = await fetch(base + '/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.any([AbortSignal.timeout(timeout), ...(signal ? [signal] : [])]),
      body: JSON.stringify({
        model,
        stream: false,
        keep_alive: -1,
        format: 'json',
        options: { temperature: 0, num_predict: 1600 },
        messages: [
          {
            role: 'user',
            content: aiLanguageInstruction + '\n' + prompt,
            images: [image.toString('base64')],
          },
        ],
      }),
    });
  } catch {
    if (signal?.aborted) throw signal.reason;
    throw new AiUnavailable('The AI host is unavailable. The task will be retried later.');
  }

  if (!r.ok) {
    if ([404, 408, 429, 500, 502, 503, 504].includes(r.status))
      throw new AiUnavailable('The vision model is unavailable on the AI host.');
    throw Error('Ollama rejected the request.');
  }

  const data = (await r.json()) as { message?: { content?: string } };

  return schema.parse(JSON.parse(data.message?.content ?? ''));
}

export async function orient(image: Buffer) {
  return vision(
    image,
    'Inspect the actual garment. What clockwise rotation makes its collar/waist/opening upright? Do not infer upright from aspect ratio alone. Return JSON {"rotation":"0"|"90"|"180"|"270","confidence":0..1,"reason":"Polish explanation"}. When uncertain confidence must be low.',
    orientationSchema,
    6000,
  );
}

export async function analyze(image: Buffer, label: boolean, signal?: AbortSignal) {
  const prompt = label
    ? `Read the clothing label literally (OCR). Return JSON {source:"label",confidence:0..1,uncertainties:[Polish descriptions of unclear fields],text:"verbatim visible text",suggestions:{brand?,size?,material?:"composition and percentages only if legible",material_source:"label"},care:["legible care instructions in Polish"]}. Never invent illegible percentages or symbols. Omit uncertain values.`
    : `Analyze this owned garment. Return JSON {source:"photo",confidence:0..1,uncertainties:["Polish uncertainty notes"],suggestions:{name:"Polish name",category:"tops|bottoms|dresses|outerwear|shoes|accessories",subcategory?:"Polish",primary_color?:"Polish",secondary_color?:"Polish",brand?:"only clearly visible logo/text",style?:"Polish",seasons?:["spring|summer|autumn|winter"],occasions?:["office|everyday|date|evening|weekend|travel"],thickness?:"thin|medium|thick",warmth?:1..5}}. Never guess size, fabric composition, brand from design. Use only enumerated category values. No markdown.`;
  const result = await vision(image, prompt, aiAnalysisSchema, 120000, signal);

  if (result.source !== (label ? 'label' : 'photo')) throw Error('Invalid analysis source.');
  if (!label) {
    delete result.suggestions.size;
    delete result.suggestions.material;
    delete result.suggestions.material_source;
  } else if (result.suggestions.material) result.suggestions.material_source = 'label';

  return localizeAnalysis(result);
}
