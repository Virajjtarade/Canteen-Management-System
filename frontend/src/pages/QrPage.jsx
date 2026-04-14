import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { api } from "../api";

export default function QrPage() {
  const { id } = useParams();
  const [url, setUrl] = useState("");
  const [slug, setSlug] = useState("");

  useEffect(() => {
    api.get(`/canteens/${id}/qr`).then((r) => {
      setUrl(r.data.url);
      setSlug(r.data.slug);
    });
  }, [id]);

  const img = url
    ? `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(url)}`
    : "";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-3xl font-bold">QR ordering</h1>
        <Link className="text-sm text-brand hover:underline" to="/owner">
          ← Back
        </Link>
      </div>
      <div className="card max-w-md space-y-4 text-center">
        <p className="text-sm text-slate-500">Customers scan to open the guest menu instantly.</p>
        {img && <img src={img} alt="QR" className="mx-auto rounded-xl border border-slate-200 p-2 dark:border-slate-700" />}
        <p className="break-all text-xs text-slate-500">{url}</p>
        <p className="text-sm">
          Slug: <span className="font-mono font-semibold">{slug}</span>
        </p>
      </div>
    </div>
  );
}
