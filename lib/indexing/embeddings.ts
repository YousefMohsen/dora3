const DEFAULT_EMBEDDING_MODEL = "text-embedding-3-small";
const OPENAI_EMBEDDINGS_URL = "https://api.openai.com/v1/embeddings";
const BATCH_SIZE = 64;

type EmbeddingResponse = {
  data?: Array<{
    embedding?: number[];
    index?: number;
  }>;
  error?: {
    message?: string;
  };
};

export async function embedTexts(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) {
    return [];
  }

  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    console.error("[indexing] Missing OPENAI_API_KEY for embeddings.");
    throw new Error("Missing OPENAI_API_KEY. Set it before indexing documents.");
  }

  console.log("[indexing] Starting embedding batches.", {
    batchSize: BATCH_SIZE,
    model: process.env.EMBEDDING_MODEL || DEFAULT_EMBEDDING_MODEL,
    textCount: texts.length,
  });

  const embeddings: number[][] = [];

  for (let index = 0; index < texts.length; index += BATCH_SIZE) {
    const batchTexts = texts.slice(index, index + BATCH_SIZE);
    console.log("[indexing] Sending embedding batch.", {
      batchNumber: Math.floor(index / BATCH_SIZE) + 1,
      batchTextCount: batchTexts.length,
    });
    const batchEmbeddings = await embedBatch(batchTexts, apiKey);

    embeddings.push(...batchEmbeddings);
  }

  console.log("[indexing] Finished embedding batches.", {
    embeddingCount: embeddings.length,
  });

  return embeddings;
}

async function embedBatch(texts: string[], apiKey: string) {
  const response = await fetch(OPENAI_EMBEDDINGS_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      input: texts,
      model: process.env.EMBEDDING_MODEL || DEFAULT_EMBEDDING_MODEL,
    }),
  });

  const body = (await response.json().catch(() => ({}))) as EmbeddingResponse;

  if (!response.ok) {
    console.error("[indexing] OpenAI embeddings request failed.", {
      message: body.error?.message,
      status: response.status,
    });

    throw new Error(
      body.error?.message || `OpenAI embeddings failed with ${response.status}.`,
    );
  }

  const embeddings = body.data
    ?.slice()
    .sort((first, second) => (first.index ?? 0) - (second.index ?? 0))
    .map((item) => item.embedding);

  if (!embeddings || embeddings.some((embedding) => !embedding)) {
    throw new Error("OpenAI embeddings response did not include all vectors.");
  }

  return embeddings as number[][];
}
