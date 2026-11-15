/** 작은 창들: 장부 날짜, 알림, 거래 전체, 매입 영수증, 로그인 유도, 약관 */
import { toast } from '@/shared/toast'
import { AUTH_MOCK, Auth, PROV } from '../auth/auth'
import { TxRow } from '../components/bits'
import Icon from '../components/Icon'
import Sheet from '../components/Sheet'
import SocialButtons from '../components/SocialButtons'
import { DOCS, type DocKey } from '../data/docs'
import { dayStats, isOffDay, regularOff, toggleOff } from '../lib/calc'
import { fmtDay, todayKey } from '../lib/date'
import { pad, won } from '../lib/format'
import { alerts, txList } from '../lib/insights'
import { store, useStore } from '../state/store'
import { useUi } from '../state/ui'

/** 장부 날짜: 그날 판매 영수증 + 휴무 표시 */
export function DaySheet({ date: k }: { date: string }) {
  const S = useStore()
  const { gate, setSel } = useUi()
  const t = todayKey(),
    st = dayStats(S, k),
    has = st.cnt > 0,
    fut = k > t,
    off = !has && isOffDay(S, k),
    reg = regularOff(S, k)
  const sales = () => {
    setSel(k)
    gate({ kind: 'sales' })
  }
  return (
    <Sheet
      title={`${k === t ? '오늘 · ' : ''}${fmtDay(k)}`}
      foot={
        fut || off ? undefined : (
          <button className="btn primary block" onClick={sales}>
            {has ? '판매 수정' : '판매 입력'}
          </button>
        )
      }
    >
      <div className="day-sheet">
        {fut ? (
          <p className="hint" style={{ margin: '0 0 4px' }}>
            아직 오지 않은 날이에요. 쉬는 날이면 미리 표시해 두세요.
          </p>
        ) : off ? null : (
          <div className="dayd2">
            <div className="row between">
              <span className="dayd-t">
                {k === t ? '오늘 · ' : ''}
                {fmtDay(k)}
              </span>
              <button className="link" onClick={sales}>
                {has ? '판매 수정' : '판매 입력'}
              </button>
            </div>
            {has ? (
              <div className="rc3 rc3-sm">
                <dl className="rc3-rows num">
                  <div>
                    <dt>
                      매출 <small>{st.cnt}개</small>
                    </dt>
                    <dd>{won(st.gross)}</dd>
                  </div>
                  {st.disc + st.ref > 0 && (
                    <div>
                      <dt>할인·환불</dt>
                      <dd>− {won(st.disc + st.ref)}</dd>
                    </div>
                  )}
                  <div>
                    <dt>식자재 원가</dt>
                    <dd>− {won(st.cost)}</dd>
                  </div>
                  <div>
                    <dt>채널 수수료</dt>
                    <dd>− {won(st.fee)}</dd>
                  </div>
                </dl>
                <div className="rc3-total">
                  <span>{st.profit < 0 ? '손해' : '남은 돈'}</span>
                  <b className={'num' + (st.profit < 0 ? ' loss' : '')}>{won(st.profit)}</b>
                </div>
              </div>
            ) : (
              <p className="hint" style={{ margin: '6px 0 0' }}>
                {k === t ? '아직 입력한 판매가 없어요. 영업이 끝나면 1분 만에 입력하세요.' : '이날 입력한 판매가 없어요.'}
              </p>
            )}
          </div>
        )}
        {!has && (
          <button
            className={'off-tg' + (off ? ' on' : '')}
            onClick={() => {
              let nowOff = false
              store.update((s) => {
                toggleOff(s, k)
                nowOff = isOffDay(s, k)
              })
              toast(nowOff ? '휴무로 표시했어요.' : '휴무를 해제했어요.')
            }}
          >
            <span className="grow">
              <b>{off ? '휴무일이에요' : reg ? '이날은 영업해요' : '이날 휴무로 표시'}</b>
              <small>
                {off
                  ? reg
                    ? '정기 휴무 · 누르면 이날만 영업으로 바꿔요'
                    : '임시 휴무 · 누르면 해제해요'
                  : reg
                    ? '정기 휴무 요일 · 누르면 다시 휴무로'
                    : '알림·평균·예상 매출 계산에서 빠져요'}
              </small>
            </span>
            <span className="toggle" role="switch" aria-checked={off} aria-hidden="true" />
          </button>
        )}
      </div>
    </Sheet>
  )
}

export function BellSheet() {
  const S = useStore()
  const { go, salesToday } = useUi()
  const al = alerts(S)
  return (
    <Sheet title="알림">
      {al.length ? (
        <ul className="list">
          {al.map((a) => (
            <li key={a.t}>
              <button className="li" onClick={() => ('sales' in a.act ? salesToday() : go(a.act.go))}>
                <span className="tx-i tx-sale">
                  <Icon name="bell" />
                </span>
                <div className="grow">
                  <div className="t">{a.t}</div>
                  <div className="s">{a.s}</div>
                </div>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="hint" style={{ margin: '8px 0 16px' }}>
          지금은 확인할 알림이 없어요.
        </p>
      )}
    </Sheet>
  )
}

export function TxAllSheet({ y, m }: { y: number; m: number }) {
  const S = useStore()
  const all = txList(S, y, m)
  return (
    <Sheet title={`${m + 1}월 거래 내역`}>
      {all.length ? (
        <div className="txs">
          {all.map((x) => (
            <TxRow key={x.kind + (x.id ?? x.date)} x={x} />
          ))}
        </div>
      ) : (
        <p className="hint">이 달의 거래가 없어요.</p>
      )}
    </Sheet>
  )
}

/** 매입 영수증 보기 */
export function RcViewSheet({ id }: { id: string }) {
  const S = useStore()
  const { go } = useUi()
  const r = S.receipts.find((x) => x.id === id)
  if (!r) return null
  const t = r.savedAt ? new Date(r.savedAt) : null,
    [, mm, dd] = r.date.split('-'),
    items = r.items ?? []
  return (
    <Sheet
      title={r.store || '매입 영수증'}
      foot={
        <button className="btn" style={{ flex: 1 }} onClick={() => go('/manage?tab=ing')}>
          식자재 보기
        </button>
      }
    >
      <div className="rc3">
        <dl className="rc3-rows num">
          <div>
            <dt>날짜</dt>
            <dd>
              {+mm}월 {+dd}일{t ? ` ${pad(t.getHours())}:${pad(t.getMinutes())}` : ''}
            </dd>
          </div>
          <div>
            <dt>단가를 바꾼 식자재</dt>
            <dd>{r.count || 0}개</dd>
          </div>
        </dl>
        <div className="rc3-total">
          <span>영수증 합계</span>
          <b className="num">{won(+r.total || 0)}</b>
        </div>
      </div>
      {items.length ? (
        <ul className="list" style={{ marginTop: 12 }}>
          {items.map((it, i) => (
            <li key={i} className="li">
              <div className="grow">
                <div className="t">{it.name}</div>
                <div className="s num">{it.qty ? it.qty + it.unit : ''}</div>
              </div>
              <b className="num">{won(it.amount)}</b>
            </li>
          ))}
        </ul>
      ) : (
        <p className="hint" style={{ marginTop: 12 }}>
          이 영수증은 품목 상세가 저장되지 않았어요. 앞으로 저장하는 영수증부터 품목이 보여요.
        </p>
      )}
      <p className="hint" style={{ marginTop: 12 }}>
        매입 금액은 지출에 따로 더하지 않아요. 식자재 단가를 바꾸는 데 쓰이고, 팔린 메뉴의 원가로 지출에 들어가요.
      </p>
    </Sheet>
  )
}

/** 비회원이 저장하려 할 때 */
export function GateSheet() {
  const { skipGate, openAuth, signedIn } = useUi()
  const oauth = async (p: 'kakao' | 'google') => {
    try {
      const r = await Auth.oauth(p, !!store.get().onboarded)
      if (r && 'user' in r) {
        if (AUTH_MOCK) toast(`체험 모드라 실제 ${PROV[p]} 연결 없이 로그인했어요.`)
        signedIn(r.user, r.isNew)
      }
    } catch {
      toast(`${PROV[p]} 로그인에 실패했어요. 잠시 후 다시 시도해 주세요.`)
    }
  }
  return (
    <Sheet title="기록을 저장하려면">
      <div style={{ textAlign: 'center', padding: '4px 0 8px' }}>
        <img src="/img/logo.png" width="455" height="102" alt="domain" style={{ width: 150, height: 'auto', margin: '6px auto 14px' }} />
        <p style={{ margin: '0 0 18px', color: 'var(--hwp-color-text-secondary)' }}>
          가입하면 입력한 메뉴·판매 기록이 안전하게 저장돼요.
          <br />
          3초면 끝나요.
        </p>
        <SocialButtons onOauth={oauth} onEmail={() => openAuth({ mode: 'email', tab: 'signup' })} />
        <button className="later" onClick={skipGate}>
          나중에 할게요
        </button>
      </div>
    </Sheet>
  )
}

export function DocSheet({ doc }: { doc: DocKey }) {
  return (
    <Sheet title={DOCS[doc].title}>
      <p className="doc">{DOCS[doc].body}</p>
    </Sheet>
  )
}
