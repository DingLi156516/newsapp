/**
 * lib/ai/gemini-client.ts — Gemini API client wrapper.
 *
 * Provides typed methods for embedding generation and text generation
 * using Google's Gemini API. Used by the clustering and summary pipelines.
 */

const GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta'
const EMBEDDING_MODEL = 'models/gemini-embedding-001'
const EMBEDDING_DIMENSIONS = 768
const DEFAULT_GENERATION_MODEL = process.env.GEMINI_DEFAULT_MODEL ?? 'models/gemini-2.5-flash-lite'

export const SUMMARY_GENERATION_MODEL = process.env.GEMINI_SUMMARY_MODEL ?? 'models/gemini-2.5-flash'
export const CHEAP_GENERATION_MODEL = process.env.GEMINI_CHEAP_MODEL ?? DEFAULT_GENERATION_MODEL

function getApiKey(): string {
  const key = process.env.GEMINI_API_KEY
  if (!key) {
    throw new Error('Missing GEMINI_API_KEY environment variable')
  }
  return key
}

export interface EmbeddingResponse {
  readonly embedding: readonly number[]
}

export interface GenerationResponse {
  readonly text: string
}

export async function generateEmbedding(text: string): Promise<EmbeddingResponse> {
  const apiKey = getApiKey()

  const response = await fetch(
    `${GEMINI_BASE_URL}/${EMBEDDING_MODEL}:embedContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: EMBEDDING_MODEL,
        content: { parts: [{ text }] },
        outputDimensionality: EMBEDDING_DIMENSIONS,
      }),
    }
  )

  if (!response.ok) {
    const body = await response.text()
    throw new Error(`Gemini embedding failed (${response.status}): ${body}`)
  }

  const data = await response.json()
  return { embedding: data.embedding.values }
}

export async function generateEmbeddingBatch(
  texts: readonly string[]
): Promise<readonly EmbeddingResponse[]> {
  const apiKey = getApiKey()

  const requests = texts.map((text) => ({
    model: EMBEDDING_MODEL,
    content: { parts: [{ text }] },
    outputDimensionality: EMBEDDING_DIMENSIONS,
  }))

  const response = await fetch(
    `${GEMINI_BASE_URL}/${EMBEDDING_MODEL}:batchEmbedContents?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ requests }),
    }
  )

  if (!response.ok) {
    const body = await response.text()
    throw new Error(`Gemini batch embedding failed (${response.status}): ${body}`)
  }

  const data = await response.json()
  return (data.embeddings as Array<{ values: number[] }>).map((e) => ({
    embedding: e.values,
  }))
}

export interface GenerationOptions {
  readonly jsonMode?: boolean
  readonly model?: string
}

export async function generateText(
  prompt: string,
  options?: GenerationOptions
): Promise<GenerationResponse> {
  const apiKey = getApiKey()

  const generationConfig: Record<string, unknown> = {
    temperature: 0.3,
    maxOutputTokens: 2048,
  }

  if (options?.jsonMode) {
    generationConfig.responseMimeType = 'application/json'
  }

  const model = options?.model ?? DEFAULT_GENERATION_MODEL

  const response = await fetch(
    `${GEMINI_BASE_URL}/${model}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig,
      }),
    }
  )

  if (!response.ok) {
    const body = await response.text()
    throw new Error(`Gemini generation failed (${response.status}): ${body}`)
  }

  const data = await response.json()
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
  return { text }
}
