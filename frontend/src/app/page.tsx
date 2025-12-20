import Link from "next/link";

export default function Home() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center space-y-6 text-center">
      <h1 className="text-4xl font-bold tracking-tight text-slate-900">
        Peer Review
      </h1>
      <p className="max-w-md text-lg text-slate-600">
        互いに学び、成長するための
        <br />
        匿名ピアレビュープラットフォーム
      </p>
      <div className="mt-4">
        <Link
          href="/start"
          className="rounded-lg bg-indigo-600 px-6 py-3 text-base font-medium text-white shadow-sm hover:bg-indigo-700 transition-colors"
        >
          始める
        </Link>
      </div>
    </div>
  );
}
