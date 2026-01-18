"use client";

import {
  Chart as ChartJS,
  Filler,
  Legend,
  LineElement,
  PointElement,
  RadialLinearScale,
  Tooltip,
} from "chart.js";
import { Radar } from "react-chartjs-2";

import { REVIEWER_SKILL_AXES } from "@/lib/reviewerSkill";
import type { ReviewerSkill } from "@/lib/types";

ChartJS.register(RadialLinearScale, PointElement, LineElement, Filler, Tooltip, Legend);

export function RadarSkillChart({ skill }: { skill: ReviewerSkill }) {
  const data = {
    labels: REVIEWER_SKILL_AXES.map((axis) => axis.label),
    datasets: [
      {
        label: "Reviewer Skill (1-5)",
        data: REVIEWER_SKILL_AXES.map((axis) => skill[axis.key]),
        backgroundColor: "rgba(24, 24, 27, 0.12)",
        borderColor: "rgba(24, 24, 27, 0.7)",
        borderWidth: 2,
        pointBackgroundColor: "rgba(24, 24, 27, 0.9)",
      },
    ],
  };

  const options = {
    responsive: true,
    scales: {
      r: {
        min: 0,
        max: 5,
        ticks: { stepSize: 1 },
      },
    },
    plugins: {
      legend: { display: false },
    },
  } as const;

  return <Radar data={data} options={options} />;
}
