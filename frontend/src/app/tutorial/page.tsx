"use client";

import Link from "next/link";
import { useState } from "react";
import {
    ArrowLeft,
    ArrowRight,
    CheckCircle,
    FileText,
    MessageSquare,
    Send,
    Star,
    Trophy,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

const tutorialSteps = [
    {
        icon: FileText,
        title: "レポートを提出する",
        description:
            "課題に対して、PDFまたはMarkdown形式でレポートを提出します。ファイル名は自動的に匿名化されるので、安心して提出できます。",
        tips: [
            "Markdown形式がおすすめです",
            "提出後も締切前なら再提出が可能です",
        ],
        iconClassName: "bg-emerald-100 text-emerald-700",
    },
    {
        icon: MessageSquare,
        title: "レビューを受け取る",
        description:
            "他の学生があなたのレポートをレビューします。レビューは匿名で行われるため、公平で率直なフィードバックを受け取ることができます。",
        tips: [
            "レビューは通知されます",
            "複数のレビューを受け取る可能性があります",
        ],
        iconClassName: "bg-sky-100 text-sky-700",
    },
    {
        icon: Send,
        title: "他の人のレポートをレビューする",
        description:
            "ランダムに割り当てられた他の学生のレポートをルーブリックに沿ってレビューします。レビューを書くことで、あなた自身のスキルも向上します。",
        tips: [
            "ルーブリックの全項目に回答が必要です",
            "建設的なコメントを心がけましょう",
        ],
        iconClassName: "bg-amber-100 text-amber-700",
    },
    {
        icon: Star,
        title: "レビューを評価する",
        description:
            "受け取ったレビューの有用性を5段階で評価します。この評価は、レビュアーのスキル向上に役立ちます。",
        tips: [
            "各レビューにつき1回のみ評価できます",
            "正直な評価をお願いします",
        ],
        iconClassName: "bg-purple-100 text-purple-700",
    },
    {
        icon: Trophy,
        title: "成績・貢献度を確認する",
        description:
            "課題スコア、レビュー貢献度、最終スコアを確認できます。レビューを積極的に行うほど、あなたの貢献度と称号がアップします！",
        tips: [
            "レビューを1本提出するとcredits +1",
            "creditsが増えると称号がランクアップ",
        ],
        iconClassName: "bg-rose-100 text-rose-700",
    },
];

export default function TutorialPage() {
    const [currentStep, setCurrentStep] = useState(0);
    const totalSteps = tutorialSteps.length;
    const step = tutorialSteps[currentStep];
    const isLastStep = currentStep === totalSteps - 1;
    const isFirstStep = currentStep === 0;

    const handleNext = () => {
        if (!isLastStep) {
            setCurrentStep((prev) => prev + 1);
        }
    };

    const handlePrev = () => {
        if (!isFirstStep) {
            setCurrentStep((prev) => prev - 1);
        }
    };

    return (
        <div className="space-y-6">
            <section className="relative left-1/2 right-1/2 -ml-[50vw] -mr-[50vw] -mt-8 w-[100vw] overflow-hidden bg-[radial-gradient(circle_at_top,_var(--tw-gradient-stops))] from-indigo-50 via-white to-sky-50">
                <div className="pointer-events-none absolute inset-0">
                    <div className="absolute -top-24 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-indigo-200/50 blur-3xl motion-safe:animate-[float-slow_12s_ease-in-out_infinite]" />
                    <div className="absolute bottom-0 right-0 h-64 w-64 translate-x-1/3 rounded-full bg-sky-200/50 blur-3xl motion-safe:animate-[float-slow_10s_ease-in-out_infinite] motion-safe:[animation-delay:-3s]" />
                </div>
                <div className="relative mx-auto max-w-6xl px-6 py-12 sm:py-16">
                    <div className="mx-auto max-w-3xl text-center">
                        <h1 className="text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl motion-safe:animate-[fade-up_0.6s_ease-out_both]">
                            Peer Review の使い方
                        </h1>
                        <p className="mt-4 text-base text-slate-600 motion-safe:animate-[fade-up_0.6s_ease-out_both] motion-safe:[animation-delay:100ms]">
                            5つのステップで、システムの使い方をマスターしましょう
                        </p>
                    </div>
                </div>
            </section>

            {/* Progress bar */}
            <div className="mx-auto max-w-2xl">
                <div className="flex items-center justify-between gap-2">
                    {tutorialSteps.map((_, index) => (
                        <button
                            key={index}
                            type="button"
                            onClick={() => setCurrentStep(index)}
                            className={`h-2 flex-1 rounded-full transition-all ${index <= currentStep
                                    ? "bg-indigo-600"
                                    : "bg-slate-200"
                                }`}
                            aria-label={`ステップ ${index + 1} に移動`}
                        />
                    ))}
                </div>
                <p className="mt-2 text-center text-sm text-muted-foreground">
                    ステップ {currentStep + 1} / {totalSteps}
                </p>
            </div>

            {/* Step content */}
            <Card className="mx-auto max-w-2xl motion-safe:animate-[fade-up_0.4s_ease-out_both]" key={currentStep}>
                <CardContent className="p-6 sm:p-8">
                    <div className="flex flex-col items-center text-center">
                        <div
                            className={`mb-6 flex h-16 w-16 items-center justify-center rounded-2xl ${step.iconClassName}`}
                        >
                            <step.icon className="h-8 w-8" />
                        </div>
                        <h2 className="text-xl font-semibold text-slate-900 sm:text-2xl">
                            {step.title}
                        </h2>
                        <p className="mt-4 text-slate-600">{step.description}</p>

                        <div className="mt-6 w-full space-y-2">
                            {step.tips.map((tip, index) => (
                                <div
                                    key={index}
                                    className="flex items-center gap-2 rounded-lg bg-slate-50 px-4 py-2 text-left text-sm"
                                >
                                    <CheckCircle className="h-4 w-4 shrink-0 text-emerald-600" />
                                    <span className="text-slate-700">{tip}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Navigation */}
            <div className="mx-auto flex max-w-2xl items-center justify-between gap-4">
                <Button
                    variant="outline"
                    onClick={handlePrev}
                    disabled={isFirstStep}
                    className="gap-2"
                >
                    <ArrowLeft className="h-4 w-4" />
                    戻る
                </Button>

                {isLastStep ? (
                    <Button asChild className="gap-2 bg-indigo-600 hover:bg-indigo-700">
                        <Link href="/assignments">
                            始める
                            <ArrowRight className="h-4 w-4" />
                        </Link>
                    </Button>
                ) : (
                    <Button onClick={handleNext} className="gap-2 bg-indigo-600 hover:bg-indigo-700">
                        次へ
                        <ArrowRight className="h-4 w-4" />
                    </Button>
                )}
            </div>

            {/* Skip link */}
            <div className="text-center">
                <Link
                    href="/assignments"
                    className="text-sm text-muted-foreground hover:text-slate-900 hover:underline"
                >
                    スキップして授業一覧へ
                </Link>
            </div>
        </div>
    );
}
