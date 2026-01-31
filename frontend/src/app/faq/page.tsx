import Link from "next/link";

type FaqItem = {
  q: string;
  a: string;
  link?: { href: string; label: string };
};

type FaqSection = {
  title: string;
  items: FaqItem[];
};

const faqSections: FaqSection[] = [
  {
    title: "基本/提出",
    items: [
      {
        q: "Peer Review とは？",
        a: "PDF/Markdownレポートを提出し、匿名で割り当てられた相互レビューとメタ評価を通じてスコア化するピアレビューシステムです。",
      },
      {
        q: "使い方は？",
        a: "ステップ形式のチュートリアルを用意しています。",
        link: { href: "/tutorial", label: "チュートリアルはこちら" },
      },
      {
        q: "対応ファイル形式は？",
        a: "PDF または Markdown のみ対応です。提出ファイル名は匿名化されます。",
      },
      {
        q: "提出は何回できますか？",
        a: "同一課題でも再提出できます。",
      },
      {
        q: "匿名性はどの程度？",
        a: "表示名は User_XXXXXXXX / Reviewer_XXXXXXXX の疑似IDで、同一課題内では固定・課題を跨ぐと別IDになります。",
      },
      {
        q: "Markdownは推奨？",
        a: "形式として対応しており、取り回しが良いので推奨です。",
      },
    ],
  },
  {
    title: "レビュー",
    items: [
      {
        q: "レビューはどう割り当てられる？",
        a: "自動割当です。自分の提出物は対象外で、レビュー数の少ない提出が優先され、同条件なら提出者のcreditsが高いものが先になります。",
      },
      {
        q: "「次のレビュー」を押しても同じ内容が出るのは？",
        a: "未提出のレビュータスクがある場合、同じタスクが再表示されます。まず提出を完了してください。",
      },
      {
        q: "ルーブリックは必須？",
        a: "全項目の採点が必須です（範囲外の点数や未入力はエラー）。",
      },
      {
        q: "レビューコメントの文字数制限は？",
        a: "1〜20,000文字の範囲です。",
      },
      {
        q: "不適切表現はどう扱われる？",
        a: "投稿時に検知されるとエラーになります（禁止語/毒性判定）。",
      },
      {
        q: "レビュー文の推敲機能はある？",
        a: "あります。",
      },
      {
        q: "レビューの下書きは保存できる？",
        a: "ブラウザ内に下書き保存できます（同じ端末・ブラウザで復元）。",
      },
    ],
  },
  {
    title: "受信レビュー/成績",
    items: [
      {
        q: "受け取ったレビューは評価できる？",
        a: "各レビューに対し5段階で1回だけ評価できます（コメントは任意）。",
      },
      {
        q: "課題スコアはどう決まる？",
        a: "先生の採点がある場合はそれが優先され、無い場合はピアレビューの平均から算出されます。",
      },
      {
        q: "最終スコアはどう計算される？",
        a: "課題スコアにレビュー貢献度が加算され、上限は100点です。",
      },
      {
        q: "レビュー貢献度の評価基準は？",
        a: "受け手の有用性評価、教師採点との一致度、レビュー品質などを基に加点されます。",
      },
      {
        q: "コピペや類似レビューはどうなる？",
        a: "重複/類似検知の対象となり、警告やレビュー貢献度の減点が入る場合があります。",
      },
    ],
  },
  {
    title: "クレジット/ランク/TA",
    items: [
      {
        q: "クレジットはどう増える？",
        a: "レビュー提出で最低1クレジット付与され、内容の一致度などで加算される場合があります。",
      },
      {
        q: "ランク（称号）は？",
        a: "creditsに応じてランクが上がります（例: 0=見習い、5=ブロンズ、15=シルバー、30=ゴールド、50=プラチナ、80=ダイヤモンド）。",
      },
      {
        q: "TA資格はどう得る？",
        a: "credits が閾値（デフォルト20）に達するとTA資格になります。",
      },
      {
        q: "TAになると何が変わる？",
        a: "TA依頼を受け取れるようになり、レビューのクレジット加算が倍率（デフォルト2倍）になります。",
      },
      {
        q: "ランキングは誰が対象？",
        a: "TA資格を満たすユーザーのみが対象です（週間/月間/総合）。",
      },
    ],
  },
  {
    title: "教員向け",
    items: [
      {
        q: "教員は何ができる？",
        a: "授業・課題の作成、ルーブリック設定、提出一覧の確認、教師採点が可能です。",
      },
      {
        q: "TA依頼とは？",
        a: "特定の提出物についてTAにレビュー依頼を送れます。TAは受諾/辞退を選べます。",
      },
      {
        q: "ルーブリックは固定？",
        a: "課題作成時に設定され、レビュー時はそのルーブリックに従って採点されます。",
      },
    ],
  },
];

export default function FaqPage() {
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-10 px-4 py-10">
      <div className="space-y-3">
        <h1 className="text-3xl font-semibold text-slate-900">FAQ</h1>
        <p className="text-sm text-slate-500">よくある質問と回答をまとめています。</p>
      </div>

      <div className="flex flex-col gap-10">
        {faqSections.map((section) => (
          <section key={section.title} className="space-y-4">
            <h2 className="text-xl font-semibold text-slate-900">{section.title}</h2>
            <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              {section.items.map((item) => (
                <div key={item.q} className="space-y-2 border-b border-slate-100 pb-4 last:border-b-0 last:pb-0">
                  <div className="text-sm font-semibold text-slate-900">Q: {item.q}</div>
                  <div className="text-sm text-slate-600">
                    A: {item.a}{" "}
                    {item.link ? (
                      <Link href={item.link.href} className="font-medium text-sky-600 hover:text-sky-700">
                        {item.link.label}
                      </Link>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
