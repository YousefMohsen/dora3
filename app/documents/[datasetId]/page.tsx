import { DatasetDetail } from "@/components/documents/DatasetDetail";

type DatasetDetailPageProps = {
  params: Promise<{
    datasetId: string;
  }>;
};

export default async function DatasetDetailPage({
  params,
}: DatasetDetailPageProps) {
  const { datasetId } = await params;

  return <DatasetDetail datasetId={datasetId} />;
}
