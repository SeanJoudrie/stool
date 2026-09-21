/**
 * Line icons, 24×24, stroked in currentColor. Deliberately plain and
 * instrument-like — the app should read as a record system, not a lifestyle
 * product, and there is no illustration anywhere in it.
 */
import type { SVGProps } from 'react'

type IconProps = SVGProps<SVGSVGElement>

function Icon({ children, ...props }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      {children}
    </svg>
  )
}

export const IconToday = (p: IconProps) => (
  <Icon {...p}>
    <rect x="3" y="4.5" width="18" height="16" rx="2.5" />
    <path d="M3 9.5h18M8 2.5v4M16 2.5v4" />
    <path d="M8 14h3" />
  </Icon>
)

export const IconInsights = (p: IconProps) => (
  <Icon {...p}>
    <path d="M3 20.5h18" />
    <path d="M6 20.5v-6M11 20.5v-11M16 20.5v-8M21 20.5v-4" />
  </Icon>
)

export const IconReport = (p: IconProps) => (
  <Icon {...p}>
    <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
    <path d="M14 3v5h5M9 13h6M9 17h4" />
  </Icon>
)

export const IconSettings = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1A1.6 1.6 0 0 0 9 19.4a1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1A1.6 1.6 0 0 0 4.6 9a1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3H9a1.6 1.6 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8V9a1.6 1.6 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1z" />
  </Icon>
)

export const IconMic = (p: IconProps) => (
  <Icon {...p}>
    <rect x="9" y="2.5" width="6" height="11" rx="3" />
    <path d="M5 11a7 7 0 0 0 14 0M12 18v3.5M8.5 21.5h7" />
  </Icon>
)

export const IconPlus = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 5v14M5 12h14" />
  </Icon>
)

export const IconCamera = (p: IconProps) => (
  <Icon {...p}>
    <path d="M3 8.5A2.5 2.5 0 0 1 5.5 6h1.8a1 1 0 0 0 .84-.46l.92-1.42A1 1 0 0 1 9.9 3.7h4.2a1 1 0 0 1 .84.42l.92 1.42a1 1 0 0 0 .84.46h1.8A2.5 2.5 0 0 1 21 8.5v9A2.5 2.5 0 0 1 18.5 20h-13A2.5 2.5 0 0 1 3 17.5z" />
    <circle cx="12" cy="13" r="3.5" />
  </Icon>
)

export const IconEye = (p: IconProps) => (
  <Icon {...p}>
    <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" />
    <circle cx="12" cy="12" r="3" />
  </Icon>
)

export const IconEyeOff = (p: IconProps) => (
  <Icon {...p}>
    <path d="M10.6 6.2A8.7 8.7 0 0 1 12 6c6 0 9.5 6 9.5 6a16 16 0 0 1-2.7 3.4M6.5 7.7A16 16 0 0 0 2.5 12S6 18 12 18a8.9 8.9 0 0 0 3.6-.75" />
    <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2M3 3l18 18" />
  </Icon>
)

export const IconAlert = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 3.6 2.7 19a1.4 1.4 0 0 0 1.2 2.1h16.2A1.4 1.4 0 0 0 21.3 19z" />
    <path d="M12 9.5v4.5M12 17.6h.01" />
  </Icon>
)

export const IconInfo = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="9.2" />
    <path d="M12 11v5.5M12 7.6h.01" />
  </Icon>
)

export const IconCheck = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4.5 12.5 9.5 17.5 19.5 7" />
  </Icon>
)

export const IconCheckCircle = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="9.2" />
    <path d="M8 12.2l2.8 2.8L16.2 9.6" />
  </Icon>
)

export const IconClose = (p: IconProps) => (
  <Icon {...p}>
    <path d="M6 6l12 12M18 6 6 18" />
  </Icon>
)

export const IconBack = (p: IconProps) => (
  <Icon {...p}>
    <path d="M15 5l-7 7 7 7" />
  </Icon>
)

export const IconChevron = (p: IconProps) => (
  <Icon {...p}>
    <path d="M9 5l7 7-7 7" />
  </Icon>
)

export const IconTrash = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4 7h16M10 4.5h4M6.5 7l.8 12.1a2 2 0 0 0 2 1.9h5.4a2 2 0 0 0 2-1.9L17.5 7" />
    <path d="M10.5 11v6M13.5 11v6" />
  </Icon>
)

export const IconFood = (p: IconProps) => (
  <Icon {...p}>
    <path d="M6 3v8.5a2.5 2.5 0 0 0 5 0V3M8.5 11.5V21" />
    <path d="M17.5 3c-1.4 1.4-2 3.4-2 5.5v3.5h4V8.5c0-2.1-.6-4.1-2-5.5zM17.5 12.5V21" />
  </Icon>
)

export const IconDroplet = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 3.2s6 6.1 6 10.1a6 6 0 0 1-12 0c0-4 6-10.1 6-10.1z" />
  </Icon>
)

export const IconClock = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="9.2" />
    <path d="M12 7v5.3l3.2 2" />
  </Icon>
)

export const IconPrint = (p: IconProps) => (
  <Icon {...p}>
    <path d="M7 9V3.5h10V9" />
    <path d="M7 18H5.5A2.5 2.5 0 0 1 3 15.5v-4A2.5 2.5 0 0 1 5.5 9h13a2.5 2.5 0 0 1 2.5 2.5v4a2.5 2.5 0 0 1-2.5 2.5H17" />
    <rect x="7" y="14.5" width="10" height="6" rx="1" />
  </Icon>
)

export const IconDownload = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 3.5v12M7.5 11l4.5 4.5 4.5-4.5" />
    <path d="M4 17.5v1.5a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-1.5" />
  </Icon>
)

export const IconUpload = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 15.5v-12M7.5 8 12 3.5 16.5 8" />
    <path d="M4 17.5v1.5a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-1.5" />
  </Icon>
)

export const IconLock = (p: IconProps) => (
  <Icon {...p}>
    <rect x="4.5" y="10" width="15" height="10.5" rx="2.5" />
    <path d="M8 10V7a4 4 0 0 1 8 0v3" />
  </Icon>
)

export const IconEdit = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4 20h4L19.5 8.5a2.1 2.1 0 0 0-3-3L5 17v3z" />
  </Icon>
)

export const IconStethoscope = (p: IconProps) => (
  <Icon {...p}>
    <path d="M6 3v5a4 4 0 0 0 8 0V3" />
    <path d="M4.5 3h3M12.5 3h3" />
    <path d="M10 16v-4" />
    <path d="M10 16a5.5 5.5 0 0 0 9 4.2" />
    <circle cx="19.5" cy="15.5" r="2.5" />
  </Icon>
)
