import { createFileRoute, Link } from "@tanstack/react-router";
import { Preview } from "../components/Preview";
import { useViewQuery } from "../lib/queries";

export const Route = createFileRoute("/view")({
  component: ViewPage,
});

function ViewPage() {
  const { data } = useViewQuery();
  const previewData = data?.status === "ok" ? data.data : undefined;
  const fallback =
    data?.status === "empty" ? data.message : "No preview available.";

  return (
    <div className="view-page">
      <Preview data={previewData} fallbackText={fallback} />
      <Link className="btn" to="/">
        Back
      </Link>
    </div>
  );
}
