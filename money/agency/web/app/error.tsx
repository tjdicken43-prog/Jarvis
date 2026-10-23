"use client";

export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="panel">
      <p className="err">{error.message || "Something went wrong"}</p>
      <button className="btn" onClick={reset}>Retry</button>
    </div>
  );
}
