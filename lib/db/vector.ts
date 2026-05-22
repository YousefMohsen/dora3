export function toPgVector(embedding: number[]) {
  if (!embedding.length) {
    throw new Error("Embedding vector cannot be empty.");
  }

  return `[${embedding.join(",")}]`;
}
