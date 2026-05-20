const MAX_DATASET_NAME_LENGTH = 80;

export const MAX_UPLOAD_SIZE_BYTES = 25 * 1024 * 1024;

export function validateDatasetName(name: unknown):
  | { ok: true; name: string }
  | { ok: false; message: string } {
  if (typeof name !== "string") {
    return { ok: false, message: "Dataset name is required." };
  }

  const trimmedName = name.trim();

  if (!trimmedName) {
    return { ok: false, message: "Dataset name is required." };
  }

  if (trimmedName.length > MAX_DATASET_NAME_LENGTH) {
    return {
      ok: false,
      message: `Dataset name must be ${MAX_DATASET_NAME_LENGTH} characters or fewer.`,
    };
  }

  return { ok: true, name: trimmedName };
}

export function validatePdfFile(file: File):
  | { ok: true }
  | { ok: false; message: string } {
  if (file.size === 0) {
    return { ok: false, message: `${file.name} is empty.` };
  }

  if (file.size > MAX_UPLOAD_SIZE_BYTES) {
    return { ok: false, message: `${file.name} is larger than 25 MB.` };
  }

  const hasPdfName = file.name.toLowerCase().endsWith(".pdf");
  const hasPdfType = file.type === "application/pdf";

  if (!hasPdfName && !hasPdfType) {
    return { ok: false, message: `${file.name} must be a PDF file.` };
  }

  return { ok: true };
}

export function isDocumentIdList(value: unknown): value is string[] {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.every((item) => typeof item === "string" && item.trim().length > 0)
  );
}
