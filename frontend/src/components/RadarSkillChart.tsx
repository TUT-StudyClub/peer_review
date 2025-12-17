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

import type { ReviewerSkill } from "@/lib/types";

ChartJS.register(RadialLinearScale, PointElement, LineElement, Filler, Tooltip, Legend);

export function RadarSkillChart({ skill }: { skill: ReviewerSkill }) {
  const data = {
    labels: ["Logic", "Specificity", "Empathy", "Insight"],
    datasets: [
      {
        label: "Reviewer Skill (1-5)",
        data: [skill.logic, skill.specificity, skill.empathy, skill.insight],
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

