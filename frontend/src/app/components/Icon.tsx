import type { ReactNode, SVGProps } from 'react'

type Def = { sw?: number; fill?: boolean; cap?: boolean; join?: boolean; d: ReactNode }

/** 앱 아이콘 (프로토타입 SVG 그대로) */
const I: Record<string, Def> = {
  plus: { sw: 2, d: <path d="M12 5v14M5 12h14" /> },
  l: { sw: 2, d: <path d="M15 5l-7 7 7 7" /> },
  r: { sw: 2, d: <path d="M9 5l7 7-7 7" /> },
  x: { sw: 2, d: <path d="M6 6l12 12M18 6L6 18" /> },
  cam: {
    sw: 1.7,
    d: (
      <>
        <path d="M4 8h3l2-2.5h6L17 8h3v11H4z" />
        <circle cx="12" cy="13" r="3.5" />
      </>
    ),
  },
  receipt: {
    sw: 1.7,
    d: (
      <>
        <path d="M6 3h12v18l-2-1.5-2 1.5-2-1.5-2 1.5-2-1.5L6 21z" />
        <path d="M9 8h6M9 12h6M9 16h3" />
      </>
    ),
  },
  box: {
    sw: 1.7,
    d: (
      <>
        <path d="M4 8l8-4 8 4v8l-8 4-8-4z" />
        <path d="M4 8l8 4 8-4M12 12v8" />
      </>
    ),
  },
  gear: {
    sw: 1.7,
    d: (
      <>
        <circle cx="12" cy="12" r="3" />
        <path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1" />
      </>
    ),
  },
  book: {
    sw: 1.7,
    join: true,
    d: (
      <>
        <path d="M5 4.5h10.5a3 3 0 0 1 3 3V20H8a3 3 0 0 1-3-3z" />
        <path d="M5 17a3 3 0 0 1 3-3h10.5M9 8.5h6M9 11h4" />
      </>
    ),
  },
  manage: {
    sw: 1.7,
    join: true,
    d: (
      <>
        <rect x="5" y="4" width="14" height="17" rx="2.5" />
        <path d="M9 4V3h6v1M9 10h6M9 14h6M9 18h3" />
      </>
    ),
  },
  home: {
    sw: 1.7,
    join: true,
    d: (
      <>
        <path d="M4 11l8-6.5 8 6.5" />
        <path d="M6 9.5V20h12V9.5" />
        <path d="M10 20v-5h4v5" />
      </>
    ),
  },
  bell: {
    sw: 1.8,
    join: true,
    d: (
      <>
        <path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15z" />
        <path d="M10 20a2 2 0 0 0 4 0" />
      </>
    ),
  },
  bars: {
    fill: true,
    d: (
      <>
        <rect x="4" y="12" width="3.6" height="8" rx="1.2" />
        <rect x="10.2" y="7" width="3.6" height="13" rx="1.2" />
        <rect x="16.4" y="3.5" width="3.6" height="16.5" rx="1.2" />
      </>
    ),
  },
  spark: {
    fill: true,
    d: (
      <>
        <path d="M10 3l1.6 4.9L16.5 9.5l-4.9 1.6L10 16l-1.6-4.9L3.5 9.5l4.9-1.6z" />
        <path d="M18 13l.8 2.2 2.2.8-2.2.8L18 19l-.8-2.2-2.2-.8 2.2-.8z" />
      </>
    ),
  },
  doc: {
    sw: 1.8,
    join: true,
    d: (
      <>
        <path d="M6 3h8l4 4v14H6z" />
        <path d="M14 3v4h4M9 12h6M9 16h6" />
      </>
    ),
  },
  bag: {
    sw: 1.9,
    join: true,
    d: (
      <>
        <path d="M5 8h14l-1 12H6z" />
        <path d="M9 8V6.5a3 3 0 0 1 6 0V8" />
      </>
    ),
  },
  cart: {
    sw: 1.9,
    join: true,
    d: (
      <>
        <path d="M4 8h16v11a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1z" />
        <path d="M4 8l2-4h12l2 4M9 12h6" />
      </>
    ),
  },
  bill: { sw: 1.9, join: true, d: <path d="M12 3s-5 5.5-5 10a5 5 0 0 0 10 0c0-4.5-5-10-5-10z" /> },
  bulb: {
    sw: 1.9,
    cap: true,
    join: true,
    d: <path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.6 10.8c.7.6 1.1 1.3 1.1 2.2h5c0-.9.4-1.6 1.1-2.2A6 6 0 0 0 12 3z" />,
  },
  chev: { sw: 2.2, cap: true, join: true, d: <path d="M9 6l6 6-6 6" /> },
  coin: {
    sw: 1.8,
    d: (
      <>
        <ellipse cx="9" cy="7" rx="5.5" ry="2.5" />
        <path d="M3.5 7v4c0 1.4 2.5 2.5 5.5 2.5s5.5-1.1 5.5-2.5V7" />
        <ellipse cx="15" cy="13" rx="5.5" ry="2.5" />
        <path d="M9.5 13v4c0 1.4 2.5 2.5 5.5 2.5s5.5-1.1 5.5-2.5v-4" />
      </>
    ),
  },
  pie: {
    sw: 2,
    d: (
      <>
        <circle cx="12" cy="12" r="8" />
        <path d="M12 4v8l6 5" />
      </>
    ),
  },
  chart: {
    sw: 1.8,
    cap: true,
    join: true,
    d: (
      <>
        <path d="M4 4v15.5h16" />
        <path d="M8 15l3.5-4 3 2.5L19 8" />
      </>
    ),
  },
  text: {
    sw: 1.8,
    cap: true,
    d: (
      <>
        <rect x="4" y="4" width="16" height="16" rx="3" />
        <path d="M8 9h8M12 9v7" />
      </>
    ),
  },
  chevThin: { sw: 2, d: <path d="M9 6l6 6-6 6" /> },
}

export type IconName = keyof typeof I

export default function Icon({ name, ...rest }: { name: IconName } & SVGProps<SVGSVGElement>) {
  const x = I[name]
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 24 24"
      fill={x.fill ? 'currentColor' : 'none'}
      stroke={x.fill ? undefined : 'currentColor'}
      strokeWidth={x.sw}
      strokeLinecap={x.cap ? 'round' : undefined}
      strokeLinejoin={x.join ? 'round' : undefined}
      {...rest}
    >
      {x.d}
    </svg>
  )
}

/** 증감 화살표 (▲▼ 대신) */
export function Arrow({ up }: { up: boolean }) {
  return (
    <svg className="arw" aria-hidden="true" focusable="false" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d={up ? 'M6 9.5v-7M3 5.5l3-3 3 3' : 'M6 2.5v7M3 6.5l3 3 3-3'} />
    </svg>
  )
}
