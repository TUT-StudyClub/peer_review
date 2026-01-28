"use client";

import React from "react";

export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <label className="block space-y-1">
      <div className="text-sm font-medium text-black">{label}</div>
      {children}
      {hint ? <div className="text-xs text-black">{hint}</div> : null}
    </label>
  );
}

export function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={[
        "w-full rounded-md border px-3 py-2 text-sm outline-none",
        "focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100",
        props.className ?? "",
      ].join(" ")}
    />
  );
}

export function TextArea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={[
        "w-full rounded-md border px-3 py-2 text-sm outline-none",
        "focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100",
        props.className ?? "",
      ].join(" ")}
    />
  );
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={[
        "w-full rounded-md border px-3 py-2 text-sm outline-none",
        "focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100",
        props.className ?? "",
      ].join(" ")}
    />
  );
}

export function PrimaryButton(props: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={[
        "rounded-md bg-indigo-600 px-4 py-2 text-sm text-white hover:bg-indigo-700 disabled:opacity-50",
        props.className ?? "",
      ].join(" ")}
    />
  );
}

export function SecondaryButton(props: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={[
        "rounded-md border px-4 py-2 text-sm hover:bg-slate-50 disabled:opacity-50",
        props.className ?? "",
      ].join(" ")}
    />
  );
}
