import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { api } from "../api";

export default function Forecast() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [pairs, setPairs] = useState(null);

  useEffect(() => {
    api.get(`/forecast/canteen/${id}`).then((r) => setData(r.data));
    api.get(`/recommendations/canteen/${id}`).then((r) => setPairs(r.data));
  }, [id]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-3xl font-bold">AI demand & pairs</h1>
        <Link className="text-sm text-brand hover:underline" to="/owner">
          ← Back
        </Link>
      </div>
      {data && (
        <div className="card space-y-3">
          <p className="text-sm text-slate-500">Target {data.target_date}</p>
          <h2 className="text-xl font-semibold">Suggested prep (bulk hints)</h2>
          <ul className="space-y-2">
            {data.suggestions?.map((s) => (
              <li key={s.item} className="flex justify-between rounded-lg bg-slate-50 px-3 py-2 dark:bg-slate-800">
                <span>{s.item}</span>
                <span className="font-mono text-sm">~{s.estimated_portions} portions</span>
              </li>
            ))}
          </ul>
          {data.note && <p className="text-sm text-amber-600">{data.note}</p>}
        </div>
      )}
      {pairs?.popular_pairs?.length > 0 && (
        <div className="card space-y-2">
          <h2 className="text-xl font-semibold">Frequently ordered together</h2>
          <ul className="text-sm text-slate-600 dark:text-slate-300">
            {pairs.popular_pairs.map((p, i) => (
              <li key={i}>
                {p.a} + {p.b} ({p.count}x)
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
