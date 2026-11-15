import { useState } from 'react'
import { track } from '@/shared/analytics'
import { toast } from '@/shared/toast'
import { Auth, PROV } from '../auth/auth'
import { ArmButton, BizGrid, PageTitle, Toggle } from '../components/bits'
import Icon from '../components/Icon'
import { TPL } from '../data/templates'
import { autoGoal } from '../lib/calc'
import { WD } from '../lib/date'
import { clearDemo, fillDemo, seed } from '../lib/demo'
import { uid, won } from '../lib/format'
import { askNotify, install } from '../lib/pwa'
import { store, useStore } from '../state/store'
import { useUi } from '../state/ui'
import type { BizKey, Settings as SettingsT } from '../types'

export default function Settings() {
  const S = useStore()
  const { openAuth, go } = useUi()
  const s = S.settings,
    u = S.user
  const [notifyMsg, setNotifyMsg] = useState('')
  const [installMsg, setInstallMsg] = useState('iPhone은 Safari 공유 버튼 → ‘홈 화면에 추가’')
  const [tplArm, setTplArm] = useState<BizKey | null>(null)

  const set = <K extends keyof SettingsT>(k: K, v: SettingsT[K]) =>
    store.update((x) => {
      x.settings[k] = v
      if (k === 'close') x.settings.lastNotified = ''
    })

  const pickTpl = (k: BizKey) => {
    if (tplArm !== k) return setTplArm(k)
    setTplArm(null)
    const next = seed(k, false)
    next.user = S.user
    next.onboarded = S.onboarded
    store.replace(next)
    go('/manage')
    toast(`${TPL[k].label} 템플릿을 불러왔어요. 가격을 내 가게 기준으로 고쳐 주세요.`)
  }

  return (
    <>
      <PageTitle>설정</PageTitle>
      <div className="hstack">
        <section className="hcard" aria-label="계정과 가게">
          {u ? (
            <div className="acct">
              <span className="av">{(u.name || '사')[0]}</span>
              <div className="grow">
                <div className="t">
                  {u.name}
                  <span className={`ptag ${u.provider}`}>{PROV[u.provider] || ''}</span>
                </div>
                <div className="s">{u.email}</div>
              </div>
              <ArmButton
                className="link logout"
                armed="한 번 더 누르면 로그아웃"
                onConfirm={async () => {
                  await Auth.signOut()
                  store.update((x) => {
                    x.user = null
                  })
                  go('/')
                  toast('로그아웃했어요.')
                }}
              >
                로그아웃
              </ArmButton>
            </div>
          ) : (
            <button className="acct" onClick={() => openAuth()} style={{ width: '100%', textAlign: 'left' }}>
              <span className="av" style={{ background: 'var(--hwp-color-border-disabled)' }}>
                ?
              </span>
              <div className="grow">
                <div className="t">로그인하고 기록 저장하기</div>
                <div className="s">카카오 · 구글 · 이메일</div>
              </div>
              <span style={{ color: 'var(--hwp-color-text-muted)' }}>
                <Icon name="r" width={20} height={20} />
              </span>
            </button>
          )}
          <label className="field">
            <span>가게 이름</span>
            <input autoComplete="off" name="set-store" className="inp" value={s.store} onChange={(e) => set('store', e.target.value)} />
          </label>
        </section>

        <section className="hcard">
          <div className="hc-h">
            <h2>하루 목표 매출</h2>
          </div>
          <label className="field">
            <span>목표 금액 (원)</span>
            <input
              autoComplete="off"
              name="set-goal"
              id="set-goal"
              className="inp num"
              type="number"
              min="0"
              step="10000"
              inputMode="numeric"
              value={+(s.goal ?? 0) > 0 ? s.goal : ''}
              placeholder={`비우면 자동: ${won(autoGoal(S))}…`}
              onChange={(e) => set('goal', e.target.value)}
            />
          </label>
          <p className="hint">장부 달력의 목표 달성 표시와 ‘연속 목표 달성’ 알림이 이 금액 기준이에요. 비워 두면 최근 4주 평균 매출로 정해요.</p>
        </section>

        <section className="hcard">
          <div className="hc-h">
            <h2>판매 채널 · 홀/포장</h2>
            <button
              className="more"
              onClick={() =>
                store.update((x) => {
                  x.channels.push({ id: uid(), name: '새 채널', fee: 0, fixed: 0 })
                })
              }
            >
              채널 추가 <Icon name="chev" />
            </button>
          </div>
          <div className="chrow label" style={{ marginTop: 10 }}>
            <span>채널</span>
            <span>수수료 %</span>
            <span>개당 비용</span>
            <span style={{ width: 36 }} />
          </div>
          {S.channels.map((c, i) => {
            const setCh = (k: 'name' | 'fee' | 'fixed', v: string) =>
              store.update((x) => {
                const ch = x.channels[i]
                if (k === 'name') ch.name = v
                else ch[k] = Math.max(0, +v || 0)
              })
            return (
              <div className="chrow" key={c.id}>
                <input autoComplete="off" name={`ch-n-${c.id}`} className="inp" value={c.name} onChange={(e) => setCh('name', e.target.value)} aria-label="채널 이름" />
                <input autoComplete="off" name={`ch-f-${c.id}`} className="inp num" type="number" step="0.1" min="0" value={c.fee} onChange={(e) => setCh('fee', e.target.value)} aria-label="수수료 %" />
                <input autoComplete="off" name={`ch-x-${c.id}`} className="inp num" type="number" step="10" min="0" value={c.fixed || 0} onChange={(e) => setCh('fixed', e.target.value)} aria-label="개당 추가비용(원)" />
                <button
                  className="x"
                  aria-label="채널 삭제"
                  disabled={S.channels.length < 2}
                  onClick={() =>
                    store.update((x) => {
                      x.channels.splice(i, 1)
                    })
                  }
                >
                  <Icon name="x" width={20} height={20} />
                </button>
              </div>
            )
          })}
          <p className="hint">기본값은 예시예요. 카드 수수료율과 포장용기 값을 내 가게 기준으로 바꿔 주세요.</p>
        </section>

        <section className="hcard">
          <div className="hc-h">
            <h2>정리 알림</h2>
          </div>
          <div className="row between" style={{ marginTop: 10 }}>
            <div>
              <div style={{ color: 'var(--hwp-color-foreground)', fontWeight: 500 }}>영업 종료 시각에 판매 입력 알림</div>
              <div className="hint" style={{ margin: 0 }}>
                앱이 열려 있거나 설치돼 있을 때 알려드려요.
              </div>
            </div>
            <Toggle
              on={s.notify}
              label="정리 알림"
              onClick={async () => {
                const on = !s.notify
                set('notify', on)
                if (!on) return setNotifyMsg('')
                const p = await askNotify()
                setNotifyMsg(p === 'granted' ? `매일 ${s.close}에 알려드려요.` : '휴대폰 알림이 꺼져 있어 앱 안에서만 알려드려요. 홈 화면에 설치하면 휴대폰 알림을 켤 수 있어요.')
              }}
            />
          </div>
          <div className="grid2">
            <label className="field">
              <span>영업 시작 시각</span>
              <input autoComplete="off" name="set-open" className="inp num" type="time" value={s.open || '11:00'} onChange={(e) => set('open', e.target.value)} />
            </label>
            <label className="field">
              <span>영업 종료 시각</span>
              <input autoComplete="off" name="set-close" className="inp num" type="time" value={s.close} onChange={(e) => set('close', e.target.value)} />
            </label>
          </div>
          <p className="hint">{notifyMsg}</p>
        </section>

        <section className="hcard">
          <div className="hc-h">
            <h2>휴무일</h2>
          </div>
          <div className="field" style={{ marginTop: 0 }}>
            <span>매주 쉬는 요일</span>
            <div className="row fx-chips off-wd">
              {[1, 2, 3, 4, 5, 6, 0].map((w) => (
                <button
                  key={w}
                  className="chip"
                  aria-pressed={s.offDays.includes(w)}
                  onClick={() =>
                    store.update((x) => {
                      const arr = x.settings.offDays,
                        i = arr.indexOf(w)
                      if (i >= 0) arr.splice(i, 1)
                      else arr.push(w)
                      arr.sort()
                    })
                  }
                >
                  {WD[w]}
                </button>
              ))}
            </div>
          </div>
          <p className="hint">임시 휴무는 장부 달력에서 날짜를 눌러 표시해요. 휴무일은 마감 알림을 보내지 않고, 평균과 이번 달 예상 매출 계산에서 빠져요.</p>
        </section>

        <section className="hcard">
          <div className="hc-h">
            <h2>업종 템플릿으로 시작</h2>
          </div>
          <p className="hint">식자재와 메뉴 샘플을 불러와요. 지금 데이터는 모두 바뀌어요.</p>
          <div style={{ marginTop: 12 }}>
            <BizGrid cur={tplArm || S.tpl} onPick={pickTpl} compact />
          </div>
          {tplArm && (
            <div className="banner">
              <div>
                <b>{TPL[tplArm].label} 템플릿</b>으로 바꾸면 지금 메뉴·식자재·판매 기록이 사라져요.{' '}
                <button className="link" onClick={() => pickTpl(tplArm)}>
                  바꾸기
                </button>
              </div>
            </div>
          )}
        </section>

        <section className="hcard">
          <div className="hc-h">
            <h2>앱</h2>
          </div>
          <div className="setlist">
            <button className="setrow" onClick={async () => setInstallMsg(await install())}>
              <span className="sr-i">
                <Icon name="plus" />
              </span>
              <span className="sr-m">
                <b>홈 화면에 설치</b>
                <small>{installMsg}</small>
              </span>
              <Icon name="chev" />
            </button>
            {S.demo?.days.length ? (
              <ArmButton
                className="setrow"
                icon="bars"
                armed="한 번 더 누르면 지워요"
                sub={`그래프 확인용으로 넣은 예시 매출 ${S.demo.days.length}일치`}
                onConfirm={() => {
                  let n = 0
                  store.update((x) => {
                    n = clearDemo(x)
                  })
                  toast(`임시 데이터 ${n}일치를 지웠어요. 직접 입력한 기록은 그대로예요.`)
                }}
              >
                임시 데이터 지우기
              </ArmButton>
            ) : (
              <button
                className="setrow"
                onClick={() => {
                  store.update((x) => {
                    x.demoOff = false
                    fillDemo(x)
                  })
                  toast('임시 데이터를 넣었어요. 홈 그래프에서 확인해 보세요.')
                }}
              >
                <span className="sr-i">
                  <Icon name="bars" />
                </span>
                <span className="sr-m">
                  <b>임시 데이터 넣기</b>
                  <small>그래프를 확인할 수 있게 예시 매출을 채워요</small>
                </span>
                <Icon name="chev" />
              </button>
            )}
            <ArmButton
              className="setrow danger"
              icon="x"
              armed="한 번 더 누르면 비워요"
              sub="입력한 판매 기록이 모두 지워져요"
              onConfirm={() => {
                store.update((x) => {
                  x.sales = {}
                  x.sample = false
                })
                toast('판매 기록을 비웠어요.')
              }}
            >
              판매 기록 비우기
            </ArmButton>
          </div>
        </section>
        {u && (
          <section className="hcard">
            <div className="hc-h">
              <h2>계정</h2>
            </div>
            <div className="setlist">
              <ArmButton
                className="setrow danger"
                icon="x"
                armed="한 번 더 누르면 모든 기록이 삭제돼요"
                sub="이 계정에 저장된 메뉴·식자재·판매 기록이 모두 삭제돼요"
                onConfirm={async () => {
                  await Auth.signOut()
                  track('withdraw')
                  store.replace(seed('hansik', true))
                  go('/')
                  toast('탈퇴했어요. 그동안 이용해 주셔서 고마워요.')
                }}
              >
                회원 탈퇴
              </ArmButton>
            </div>
          </section>
        )}
      </div>
    </>
  )
}
