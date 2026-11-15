import { useRef, useState } from 'react'
import { track } from '@/shared/analytics'
import { toast } from '@/shared/toast'
import { ArmButton } from '../components/bits'
import Sheet from '../components/Sheet'
import { FIX_NAMES } from '../data/templates'
import { todayKey } from '../lib/date'
import { uid } from '../lib/format'
import { store, useStore } from '../state/store'
import { useUi } from '../state/ui'

/** 고정비 입력·수정. 서버: POST /api/fixed-costs · PUT /api/fixed-costs/{id} */
export default function FixedSheet({ id }: { id?: string }) {
  const S = useStore()
  const { close } = useUi()
  const f0 = S.fixed.find((x) => x.id === id)
  const [d, setD] = useState(() => ({ id: f0?.id ?? uid(), name: f0?.name ?? '', amount: f0 ? String(f0.amount) : '', date: f0?.date ?? todayKey() }))
  const amtRef = useRef<HTMLInputElement>(null)

  const save = () => {
    const amt = +d.amount
    if (!d.name.trim() || !(amt > 0) || !d.date) return toast('항목 이름, 금액, 날짜를 입력하세요.')
    store.update((s) => {
      const x = { id: d.id, name: d.name.trim(), amount: amt, date: d.date }
      const i = s.fixed.findIndex((f) => f.id === d.id)
      if (i >= 0) s.fixed[i] = x
      else s.fixed.push(x)
      s.sample = false
    })
    track('fixed_save')
    close()
    toast(`저장했어요. ${+d.date.slice(5, 7)}월 지출에 반영했어요.`)
  }

  return (
    <Sheet
      title={f0 ? '고정비 수정' : '고정비 입력'}
      foot={
        <>
          {f0 && (
            <ArmButton
              className="btn danger"
              armed="한 번 더 누르면 삭제"
              onConfirm={() => {
                store.update((s) => {
                  s.fixed = s.fixed.filter((x) => x.id !== d.id)
                })
                close()
                toast('고정비를 삭제했어요.')
              }}
            >
              삭제
            </ArmButton>
          )}
          <button className="btn primary" style={{ flex: 1 }} onClick={save}>
            저장
          </button>
        </>
      }
    >
      <p className="hint" style={{ margin: '0 0 4px' }}>
        월세·공과금처럼 매달 나가는 돈이에요. 이번 달 지출과 이익에 바로 반영돼요.
      </p>
      <div className="field">
        <span>자주 쓰는 항목</span>
        <div className="row fx-chips">
          {FIX_NAMES.map((n) => (
            <button
              key={n}
              className="chip"
              aria-pressed={d.name === n}
              onClick={() => {
                setD({ ...d, name: n })
                amtRef.current?.focus()
              }}
            >
              {n}
            </button>
          ))}
        </div>
      </div>
      <label className="field">
        <span>항목 이름</span>
        <input autoComplete="off" name="fx-name" className="inp" value={d.name} placeholder="예: 월세…" onChange={(e) => setD({ ...d, name: e.target.value })} />
      </label>
      <div className="grid2">
        <label className="field">
          <span>금액 (원)</span>
          <input
            ref={amtRef}
            autoComplete="off"
            name="fx-amt"
            className="inp num"
            type="number"
            min="0"
            step="1000"
            inputMode="numeric"
            value={d.amount}
            placeholder="예: 1500000…"
            onChange={(e) => setD({ ...d, amount: e.target.value })}
          />
        </label>
        <label className="field">
          <span>낸 날짜</span>
          <input autoComplete="off" name="fx-date" className="inp num" type="date" value={d.date} onChange={(e) => setD({ ...d, date: e.target.value })} />
        </label>
      </div>
    </Sheet>
  )
}
