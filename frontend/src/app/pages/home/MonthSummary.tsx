import { useUi } from '../../state/ui'
import { Delta } from '../../components/bits'
import Icon from '../../components/Icon'
import { bepInfo, monthSum } from '../../lib/calc'
import { now } from '../../lib/date'
import { manN } from '../../lib/format'
import type { AppState } from '../../types'

/** 홈 맨 위: 이번 달 매출·지출·이익 + 손익분기점 */
export default function MonthSummary({ S, y, m }: { S: AppState; y: number; m: number }) {
  const { go } = useUi()
  const t = now(),
    isCur = y === t.getFullYear() && m === t.getMonth(),
    isFuture = new Date(y, m, 1) > t
  const upto = isCur ? t.getDate() : null
  const cur = monthSum(S, y, m, upto),
    py = m ? y : y - 1,
    pm = m ? m - 1 : 11,
    prev = monthSum(S, py, pm, upto)
  const b = isCur ? bepInfo(S) : null
  return (
    <section className="hcard" aria-label={`${m + 1}월 요약`}>
      <dl className="sum3">
        <div>
          <dt>이번 달 매출</dt>
          <dd className="s-v num">
            {manN(cur.rev)}
            <small>만원</small>
          </dd>
          {!isFuture && <Delta cur={cur.rev} prev={prev.rev} />}
          <span className="s-p num">지난달 {manN(prev.rev)}만원</span>
        </div>
        <div>
          <dt>이번 달 지출</dt>
          <dd className="s-v num">
            {manN(cur.spend)}
            <small>만원</small>
          </dd>
          <span className="s-d flat" aria-hidden="true">
            &nbsp;
          </span>
          <span className="s-p num">지난달 {manN(prev.spend)}만원</span>
        </div>
        <div>
          <dt>이번 달 이익</dt>
          <dd className={'s-v num' + (cur.profit < 0 ? ' loss' : '')}>
            {manN(cur.profit)}
            <small>만원</small>
          </dd>
          {!isFuture && <Delta cur={cur.profit} prev={prev.profit} />}
          <span className="s-p num">지난달 {manN(prev.profit)}만원</span>
        </div>
      </dl>
      <p className="s-note">
        {isCur ? `지난달은 같은 기간(1~${t.getDate()}일) 기준 · ` : ''}매출 = 할인·환불 뺀 금액 · 지출 = 식자재 원가+포장비·수수료+고정비(낸 날 전액)
      </p>
      {b?.month && b.rate != null && (
        <button className="h-bep" onClick={() => go('/metrics#mx-bep')}>
          <span className="grow">
            <span className="t">
              이번 달 손익분기점 <b className="num">{Math.round(b.rate * 100)}%</b> 달성 · 목표 {manN(b.month)}만원
            </span>
            <span className="mx-prog" aria-hidden="true">
              <i style={{ width: `${Math.min(100, b.rate * 100).toFixed(1)}%` }} />
            </span>
          </span>
          <Icon name="chev" />
        </button>
      )}
    </section>
  )
}
