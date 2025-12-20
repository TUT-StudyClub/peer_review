import Link from "next/link";

export default function StartPage() {
    return (
        <div className="space-y-6">
            <div className="rounded-xl border bg-white p-6">
                <h1 className="text-2xl font-semibold">Peer Review（匿名ピアレビュー）</h1>
                <div className="mt-4 flex flex-wrap gap-2">
                    <Link
                        href="/assignments"
                        className="rounded-md bg-indigo-600 px-4 py-2 text-sm text-white hover:bg-indigo-700"
                    >
                        課題一覧へ
                    </Link>
                    <Link
                        href="/auth/login"
                        className="rounded-md border px-4 py-2 text-sm hover:bg-slate-50"
                    >
                        ログイン
                    </Link>
                    <Link
                        href="/auth/register"
                        className="rounded-md border px-4 py-2 text-sm hover:bg-slate-50"
                    >
                        新規登録
                    </Link>
                </div>
            </div>

            <div className="rounded-xl border bg-white p-6">
                <h2 className="text-lg font-semibold">まず何をすればいい？</h2>
                <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm text-black">
                    <li>teacher でログインして課題＋ルーブリックを作る</li>
                    <li>student が提出（Markdown推奨）</li>
                    <li>student が「次のレビュー」を取得してレビュー提出</li>
                    <li>提出者がレビューをメタ評価</li>
                    <li>成績（Grade）を確認</li>
                </ol>
            </div>
        </div>
    );
}
