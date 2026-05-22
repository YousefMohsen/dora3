CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS index_runs (
  id text PRIMARY KEY,
  dataset_id text NOT NULL,
  status text NOT NULL CHECK (status IN ('running', 'completed', 'failed')),
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS indexed_documents (
  id text PRIMARY KEY,
  dataset_id text NOT NULL,
  document_id text NOT NULL UNIQUE,
  original_name text NOT NULL,
  file_path text NOT NULL,
  content_hash text,
  status text NOT NULL CHECK (status IN ('indexing', 'indexed', 'failed')),
  error_message text,
  chunk_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS document_chunks (
  id text PRIMARY KEY,
  dataset_id text NOT NULL,
  document_id text NOT NULL,
  indexed_document_id text NOT NULL REFERENCES indexed_documents(id) ON DELETE CASCADE,
  chunk_index integer NOT NULL,
  original_name text NOT NULL,
  page_start integer,
  page_end integer,
  section_heading text,
  text text NOT NULL,
  token_count integer NOT NULL,
  embedding vector(1536),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS document_chunks_dataset_id_idx
  ON document_chunks(dataset_id);

CREATE INDEX IF NOT EXISTS document_chunks_document_id_idx
  ON document_chunks(document_id);

CREATE INDEX IF NOT EXISTS document_chunks_embedding_idx
  ON document_chunks
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);
