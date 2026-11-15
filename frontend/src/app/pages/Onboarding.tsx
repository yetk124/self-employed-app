import { useState } from 'react'
import { useNavigate } from 'react-router'
import { track } from '@/shared/analytics'
import { toast } from '@/shared/toast'
import { BizGrid, Toggle } from '../components/bits'
import Icon from '../components/Icon'
import { BIZ } from '../data/templates'
import { seed } from '../lib/demo'
import { askNotify } from '../lib/pwa'
import { store, useStore } from '../state/store'
import { useUi } from '../state/ui'
import type { BizKey } from '../types'

/** 첫 설정 3단계: 업종 → 가게 이름 → 영업 시간·알림. 끝나면 POST /api/stores */
export default function Onboarding() {
  const S = useStore()
  const nav = useNavigate()
  const { skipGate } = useUi()
  const [step, setStep] = useState(1)
  const [biz, setBiz] = useState<BizKey | 'blank' | ''>('')
  const [sub, setSub] = useState('')
  const [name, setName] = useState(S.sample ? '' : S.settings.store)
  const [open, setOpen] = useState('11:00')
  const [close, setClose] = useState(S.settings.close || '21:30')
  const [notify, setNotify] = useState(true)

  const finish = (skip: boolean) => {
    const cur = store.get()
    let next = structuredClone(cur)
    if (cur.sample && biz && biz !== 'blank') next = seed(biz, false)
    else if (cur.sample && biz === 'blank') {
      next = seed('hansik', false)
      next.menus = []
      next.ings = []
      next.tpl = 'etc'
    }
    next.user = cur.user
    if (biz && biz !== 'blank') {
      next.tpl = biz
      next.settings.bizSub = sub
    }
    if (name.trim()) next.settings.store = name.trim()
    next.settings.open = open
    next.settings.close = close
    if (!skip && notify) {
      next.settings.notify = true
      void askNotify()
    }
    next.onboarded = true
    next.sample = false
    store.replace(next)
    track('onboard_done', { biz: biz || 'skip' })
    nav(biz === 'blank' ? '/manage?tab=ing' : '/')
    scrollTo(0, 0)
    toast(biz === 'blank' ? '식자재부터 등록해 볼까요? 오른쪽 위 + 를 누르세요.' : '준비 끝! 오늘 판매를 입력해 보세요.')
    skipGate()
  }

  const next = () => {
    if (step === 1 && !biz) return toast('업종을 골라 주세요.')
    if (step < 3) return setStep(step + 1)
    finish(false)
  }

  const b = BIZ.find((x) => x[0] === biz)
  return (
    <>
      <header className="top">
        {step > 1 ? (
          <button className="iconbtn" onClick={() => setStep(step - 1)} aria-label="이전">
            <Icon name="l" />
          </button>
        ) : (
          <span style={{ width: 40 }} />
        )}
        <span className="label num">{step} / 3</span>
        <button className="link" onClick={() => finish(true)} style={{ paddingInline: 8 }}>
          건너뛰기
        </button>
      </header>
      <div className="ob">
        <div className="prog" aria-label={`${step}/3단계`}>
          {[1, 2, 3].map((i) => (
            <i key={i} className={i <= step ? 'on' : ''} />
          ))}
        </div>
        {step === 1 && (
          <>
            <h1>어떤 가게를 하시나요?</h1>
            <p className="sub">고르시면 비슷한 메뉴와 식자재를 미리 채워 드려요.</p>
            <BizGrid
              cur={biz}
              onPick={(k) => {
                setBiz(k)
                setSub('')
              }}
            />
            {b && (
              <div className="biz-sub">
                <span>
                  어떤 가게에 더 가까워요? <small>(선택)</small>
                </span>
                <div className="row">
                  {b[2].map((n) => (
                    <button key={n} className="chip" aria-pressed={sub === n} onClick={() => setSub(sub === n ? '' : n)}>
                      {n}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <button
              className="how"
              onClick={() => {
                setBiz('blank')
                setStep(2)
              }}
            >
              템플릿 없이 빈 가게로 시작할게요
            </button>
            {!S.sample && (
              <p className="hint" style={{ marginTop: 12 }}>
                이미 입력한 메뉴와 식자재는 그대로 둘게요.
              </p>
            )}
          </>
        )}
        {step === 2 && (
          <>
            <h1>가게 이름을 알려 주세요</h1>
            <p className="sub">장부와 알림에 표시돼요.</p>
            <label className="field">
              <span>가게 이름</span>
              <input autoFocus autoComplete="off" name="ob-store" className="inp" maxLength={20} value={name} placeholder="예: 월곡 김치찌개…" onChange={(e) => setName(e.target.value)} />
            </label>
          </>
        )}
        {step === 3 && (
          <>
            <h1>영업 시간을 알려 주세요</h1>
            <p className="sub">닫는 시간에 오늘 판매 정리 알림을 보내 드려요.</p>
            <div className="grid2">
              <label className="field">
                <span>영업 시작 시각</span>
                <input autoComplete="off" name="ob-open" className="inp num" type="time" value={open} onChange={(e) => setOpen(e.target.value)} />
              </label>
              <label className="field">
                <span>영업 종료 시각</span>
                <input autoComplete="off" name="ob-close" className="inp num" type="time" value={close} onChange={(e) => setClose(e.target.value)} />
              </label>
            </div>
            <div className="row between" style={{ marginTop: 16 }}>
              <span style={{ color: 'var(--hwp-color-foreground)', fontWeight: 500 }}>정리 알림 받기</span>
              <Toggle on={notify} onClick={() => setNotify(!notify)} label="정리 알림" />
            </div>
          </>
        )}
        <button className="btn primary block" style={{ marginTop: 28 }} onClick={next}>
          {step < 3 ? '다음' : '시작하기'}
        </button>
      </div>
    </>
  )
}

