import type { ComponentType, SVGProps } from "react";
import {
  CoachIcon,
  HomeIcon,
  InsightsIcon,
  RoundIcon,
} from "@/components/icons";

export interface NavItem {
  href: string;
  label: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
}

export const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Home", icon: HomeIcon },
  { href: "/round", label: "Round", icon: RoundIcon },
  { href: "/coach", label: "Coach", icon: CoachIcon },
  { href: "/insights", label: "Insights", icon: InsightsIcon },
];
