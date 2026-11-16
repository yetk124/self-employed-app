/** 화면 여러 곳에서 쓰는 작은 조각들 */
import { useState, type ReactNode } from 'react'
import { BIZ } from '../data/templates'
import type { Tx } from '../lib/insights'
import { won } from '../lib/format'
import { useUi } from '../state/ui'
import type { BizKey } from '../types'
import Icon, { Arrow, type IconName } from './Icon'

/** 제목 옆 기호 */
export function PageTitle({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <header className="top">
      <h1 className="h1 with-sym">
        <img className="sym" src="/img/symbol.png" width="96" height="96" alt="" aria-hidden="true" />
        {children}
      </h1>
      {right}
    </header>
  )
}

/** 카드 머리: 아이콘 + 제목 + 오른쪽 */
export function CardHead({
  icon,
  title,
  right,
  id,
}: {
  icon?: IconName
  title: ReactNode
  right?: ReactNode
  id: string
}) {
  return (
    <div className="c2-h">
      <h2 id={id}>
        {icon && (
          <span className="c2-ic">
            <Icon name={icon} />
          </span>
        )}
        {title}
      </h2>
      {right}
    </div>
  )
}

/** 홈 요약의 증감 */
export function Delta({ cur, prev }: { cur: number; prev: number }) {
  if (!(prev > 0)) return null
  const p = Math.round(((cur - prev) / prev) * 100)
  if (p === 0) return <span className="s-d flat">0%</span>
  return (
    <span className={`s-d ${p > 0 ? 'up' : 'down'}`}>
      <Arrow up={p > 0} />
      {Math.abs(p)}%
    </span>
  )
}

/** ↑ 3% 알약 + 설명 */
export function PctPill({ c, p, suffix }: { c: number; p: number; suffix?: string }) {
  if (!(p > 0)) return null
  const v = Math.round(((c - p) / p) * 100)
  return (
    <>
      <span className={`wk-d ${v >= 0 ? 'up' : 'down'} num`}>
        {v >= 0 ? '↑' : '↓'} {Math.abs(v)}%
      </span>
      {suffix && <span className="k2-s">{suffix}</span>}
    </>
  )
}

/** 업종 선택 그리드 (온보딩·설정 공용) */
export function BizGrid({ cur, onPick, compact }: { cur: string; onPick: (k: BizKey) => void; compact?: boolean }) {
  return (
    <div className={'bizg' + (compact ? ' sm' : '')} role="radiogroup" aria-label="업종">
      {BIZ.map(([k, l, sub]) => (
        <button key={k} className="biz-c" role="radio" aria-checked={cur === k} onClick={() => onPick(k)}>
          <span className="biz-i">
            <img src={`/img/biz/${k}.webp`} width="256" height="256" alt="" loading="lazy" decoding="async" />
          </span>
          <b>{l}</b>
          {!compact && <small>{sub.join('·')}</small>}
        </button>
      ))}
    </div>
  )
}

const TX: Record<Tx['kind'], [string, string, IconName]> = {
  sale: ['매출', 'tx-sale', 'bag'],
  buy: ['매입', 'tx-buy', 'cart'],
  fix: ['고정비', 'tx-fix', 'bill'],
}

/** 거래 내역 한 줄. 누르면 매출 → 장부 날짜, 매입 → 영수증, 고정비 → 수정 */
export function TxRow({ x }: { x: Tx }) {
  const { gate, open, go, setSel } = useUi()
  const [lab, cls, ic] = TX[x.kind]
  const [, mm, dd] = x.date.split('-')
  const onClick = () => {
    if (x.kind === 'fix') gate({ kind: 'fixed', id: x.id })
    else if (x.kind === 'sale') {
      setSel(x.date)
      go(`/ledger?d=${x.date}`)
    } else open({ kind: 'rcView', id: x.id! })
  }
  return (
    <button className="tx" onClick={onClick}>
      <span className={`tx-i ${cls}`}>
        <Icon name={ic} />
      </span>
      <span className="tx-m">
        <span className="tx-t">{x.title}</span>
        <span className="tx-s num">
          {+mm}. {+dd}.{x.time ? ' ' + x.time : ''}
          <i />
          {lab}
          {x.sub ? ' · ' + x.sub : ''}
        </span>
      </span>
      {x.kind === 'buy' ? (
        <span className="tx-a num muted" title="식자재 단가에만 반영돼요. 지출에는 원가로 이미 들어가 있어요.">
          {won(Math.abs(x.amt))}
        </span>
      ) : (
        <span className={`tx-a num${x.amt > 0 ? ' plus' : ''}`}>
          {x.amt > 0 ? '+' : '−'}
          {won(Math.abs(x.amt)).replace('원', '')}원
        </span>
      )}
    </button>
  )
}

/** 메뉴·식자재 썸네일 */
export function Thumb({ o }: { o: { id: string; img?: string }; kind?: 'menu' | 'ing' }) {
  const src = o.img
  if (src)
    return (
      <span className="thumb">
        <img src={src} alt="" width="56" height="56" />
      </span>
    )
  return (
    <span className="thumb ph" aria-hidden="true">
      <Icon name="cam" />
    </span>
  )
}

/** 두 번 눌러야 실행되는 버튼 (삭제·탈퇴) */
export function ArmButton({
  className,
  onConfirm,
  armed,
  children,
  icon,
  sub,
}: {
  className: string
  onConfirm: () => void
  armed: string
  children: ReactNode
  icon?: IconName
  sub?: ReactNode
}) {
  const [arm, setArm] = useState(false)
  const label = arm ? armed : children
  if (icon)
    return (
      <button className={className} onClick={() => (arm ? onConfirm() : setArm(true))}>
        <span className="sr-i">
          <Icon name={icon} />
        </span>
        <span className="sr-m">
          <b>{label}</b>
          {sub && <small>{sub}</small>}
        </span>
        <Icon name="chev" />
      </button>
    )
  return (
    <button className={className} onClick={() => (arm ? onConfirm() : setArm(true))}>
      {label}
    </button>
  )
}

/** 켜고 끄는 스위치 */
export function Toggle({ on, onClick, label }: { on: boolean; onClick: () => void; label: string }) {
  return <button className="toggle" role="switch" aria-checked={on} onClick={onClick} aria-label={label} />
}
