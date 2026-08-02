// Все значки — контурные SVG дизайн-системы. Цвет всегда наследуется через
// currentColor: конкретный токен задаёт вызывающий.

import type { SVGProps } from 'react'

type IconProps = SVGProps<SVGSVGElement> & { size?: number }

function Svg({ size = 15, children, strokeWidth = 1.7, ...rest }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...rest}
    >
      {children}
    </svg>
  )
}

// Категории: дом, работа, здоровье, деньги, учёба, люди, быт.

export function IconHome(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M4 11 L12 4 L20 11" />
      <path d="M6.2 9.5 V20 H17.8 V9.5" />
    </Svg>
  )
}

export function IconWork(p: IconProps) {
  return (
    <Svg {...p}>
      <rect x="4" y="8" width="16" height="11" rx="1" />
      <path d="M9 8 V6.5 A1.5 1.5 0 0 1 10.5 5 H13.5 A1.5 1.5 0 0 1 15 6.5 V8" />
    </Svg>
  )
}

export function IconHealth(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M12 20 C6.5 15.5 4 12 4 8.9 C4 6.3 6 4.5 8.2 4.5 C9.8 4.5 11.2 5.4 12 6.8 C12.8 5.4 14.2 4.5 15.8 4.5 C18 4.5 20 6.3 20 8.9 C20 12 17.5 15.5 12 20 Z" />
    </Svg>
  )
}

export function IconMoney(p: IconProps) {
  return (
    <Svg {...p}>
      <circle cx="12" cy="12" r="7.5" />
      <path d="M12 8.5 V15.5 M9.8 14 C10.2 15 11 15.5 12.1 15.5 C13.4 15.5 14.2 14.9 14.2 13.9 C14.2 11.9 10 12.7 10 10.5 C10 9.6 10.8 8.9 12 8.9 C13 8.9 13.7 9.4 14 10.2" />
    </Svg>
  )
}

export function IconStudy(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M12 6.2 C10 4.9 7.5 4.6 4 4.6 V18 C7.5 18 10 18.4 12 19.6 C14 18.4 16.5 18 20 18 V4.6 C16.5 4.6 14 4.9 12 6.2 Z" />
      <path d="M12 6.2 V19.6" />
    </Svg>
  )
}

export function IconPeople(p: IconProps) {
  return (
    <Svg {...p}>
      <circle cx="9" cy="8.5" r="3" />
      <path d="M4 19 C4 15.9 6.2 14 9 14 C11.8 14 14 15.9 14 19" />
      <circle cx="16.5" cy="9.5" r="2.2" />
      <path d="M15.8 13.4 C18.4 13.6 20 15.3 20 18" />
    </Svg>
  )
}

export function IconChores(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M4 10 H20 L18.4 19.5 H5.6 Z" />
      <path d="M8.2 10 L12 4.5 L15.8 10" />
    </Svg>
  )
}

export const CATEGORY_ICONS: Record<string, (p: IconProps) => ReturnType<typeof Svg>> = {
  home: IconHome,
  work: IconWork,
  health: IconHealth,
  money: IconMoney,
  study: IconStudy,
  people: IconPeople,
  chores: IconChores,
}

export function CategoryIcon({ icon, ...p }: IconProps & { icon: string }) {
  const Cmp = CATEGORY_ICONS[icon] ?? IconChores
  return <Cmp {...p} />
}

/** Кольцо повтора рядом со значком категории. */
export function IconRepeatRing(p: IconProps) {
  return (
    <Svg size={11} strokeWidth={2.2} {...p}>
      <circle cx="12" cy="12" r="7.5" />
    </Svg>
  )
}

// Навигация и обвязка.

export function IconChevronLeft(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M14.5 5 L7.5 12 L14.5 19" />
    </Svg>
  )
}

export function IconChevronRight(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M9.5 5 L16.5 12 L9.5 19" />
    </Svg>
  )
}

export function IconChevronDown(p: IconProps) {
  return (
    <Svg strokeWidth={2} {...p}>
      <path d="M5 9.5 L12 16.5 L19 9.5" />
    </Svg>
  )
}

export function IconPlus(p: IconProps) {
  return (
    <Svg strokeWidth={2} {...p}>
      <path d="M12 5 V19 M5 12 H19" />
    </Svg>
  )
}

export function IconClose(p: IconProps) {
  return (
    <Svg strokeWidth={2} {...p}>
      <path d="M6 6 L18 18 M18 6 L6 18" />
    </Svg>
  )
}

// Вкладки.

export function IconTabDay(p: IconProps) {
  return (
    <Svg size={22} {...p}>
      <rect x="4" y="5.5" width="16" height="14.5" rx="1" />
      <path d="M4 10 H20 M8.5 3.5 V7 M15.5 3.5 V7" />
      <rect x="8" y="13" width="3.4" height="3.4" fill="currentColor" stroke="none" />
    </Svg>
  )
}

export function IconTabWeek(p: IconProps) {
  return (
    <Svg size={22} {...p}>
      <rect x="4" y="5" width="16" height="3.8" rx="0.5" />
      <rect x="4" y="10.6" width="11" height="3.8" rx="0.5" />
      <rect x="4" y="16.2" width="14" height="3.8" rx="0.5" />
    </Svg>
  )
}

export function IconTabMonth(p: IconProps) {
  return (
    <Svg size={22} {...p}>
      <rect x="4" y="4" width="7" height="7" rx="0.5" />
      <rect x="13" y="4" width="7" height="7" rx="0.5" />
      <rect x="4" y="13" width="7" height="7" rx="0.5" />
      <rect x="13" y="13" width="7" height="7" rx="0.5" />
    </Svg>
  )
}

export function IconTabStats(p: IconProps) {
  return (
    <Svg size={22} strokeWidth={2} {...p}>
      <path d="M5 19.5 V13 M10 19.5 V6 M15 19.5 V10 M20 19.5 V15" />
    </Svg>
  )
}

export function IconSettings(p: IconProps) {
  return (
    <Svg {...p}>
      <circle cx="12" cy="12" r="3.2" />
      <path d="M12 3.5 V6 M12 18 V20.5 M20.5 12 H18 M6 12 H3.5 M18 6 L16.3 7.7 M7.7 16.3 L6 18 M18 18 L16.3 16.3 M7.7 7.7 L6 6" />
    </Svg>
  )
}

export function IconSearch(p: IconProps) {
  return (
    <Svg {...p}>
      <circle cx="11" cy="11" r="6" />
      <path d="M15.5 15.5 L20 20" />
    </Svg>
  )
}

export function IconInbox(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M4 5.5 H20 V18.5 H4 Z" />
      <path d="M4 13 H8.5 C8.5 14.7 10 16 12 16 C14 16 15.5 14.7 15.5 13 H20" />
    </Svg>
  )
}
