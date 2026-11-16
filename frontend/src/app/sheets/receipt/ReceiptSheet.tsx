import { useRef, useState } from 'react'
import { track } from '@/shared/analytics'
import { toast } from '@/shared/toast'
import { hasServer } from '../../api/client'
import { flush, pull, serverId, syncOn } from '../../api/sync'
import { confirmReceipt, parseReceiptPhoto, parseReceiptText } from '../../api/endpoints'
import Icon from '../../components/Icon'
import Sheet from '../../components/Sheet'
import { UNITS } from '../../data/templates'
import { findIng, unitPrice } from '../../lib/calc'
import { todayKey } from '../../lib/date'
import { fmtUnit, uid, won } from '../../lib/format'
import { shrink } from '../../lib/image'
import {
  matchIng,
  parseReceipt,
  rcPlan,
  SAMPLE_RECEIPT,
  toItems,
  type Parsed,
  type Plan,
  type RcItem,
} from '../../lib/receipt'
import { store, useStore } from '../../state/store'
import { useUi } from '../../state/ui'
import type { ReceiptParseRes } from '../../types/api'
import type { ReceiptSource } from '../../types'

type Step = 'pick' | 'text' | 'loading' | 'confirm' | 'review'

/** 서버 응답 → 확인 화면 모양. auto_match(RAG가 고른 식자재)가 있으면 미리 골라 둠 */
const fromServer = (j: ReceiptParseRes): Parsed => ({
  date: j.date,
  store: j.vendor,
  total: j.total,
  items: j.items.map((it) => ({
    name: it.name,
    qty: it.qty,
    unit: it.unit,
    amount: it.amount,
    match: it.auto_match != null ? String(it.auto_match) : undefined,
  })),
})

/**
 * 영수증 인식: 촬영 → (서버) OCR + LLM 구조화 + RAG 매칭 → 확인·수정 → 저장 전 확인 → 저장
 * 서버 주소(VITE_API_BASE)가 없으면 붙여넣기·예시 영수증만 돼요.
 */
export default function ReceiptSheet() {
  const S = useStore()
  const { close } = useUi()
  const [step, setStep] = useState<Step>('pick')
  const [err, setErr] = useState('')
  const [msg, setMsg] = useState('')
  const [text, setText] = useState('')
  const [img, setImg] = useState('')
  const [meta, setMeta] = useState({
    date: todayKey(),
    store: '',
    total: 0,
    source: 'text' as ReceiptSource,
    raw: '',
    imagePath: '',
  })
  const [items, setItems] = useState<RcItem[]>([])
  const [plan, setPlan] = useState<Plan | null>(null)
  const body = useRef<HTMLDivElement>(null)

  const fromParsed = (p: Parsed, source: ReceiptSource, raw: string, imagePath = '') => {
    const t = todayKey()
    setMeta({
      date: p.date && p.date <= t ? p.date : t,
      store: p.store || '',
      total: +p.total || 0,
      source,
      raw,
      imagePath,
    })
    setItems(toItems(store.get(), p))
    setStep('confirm')
  }

  const fail = (e: unknown) => {
    const m =
      e instanceof Error && e.message && !/fetch|network/i.test(e.message)
        ? e.message
        : '인식 서버에 연결하지 못했어요.'
    setErr(m + ' 글자로 붙여넣거나 예시 영수증으로 확인 화면을 써 볼 수 있어요.')
    setStep('pick')
  }

  const runPhoto = async (file: File) => {
    setErr('')
    setMsg('사진을 준비하는 중이에요')
    setStep('loading')
    try {
      if (!hasServer) throw new Error('아직 인식 서버에 연결되지 않았어요.')
      const { blob, url } = await shrink(file)
      setImg(url)
      setMsg('서버에서 영수증을 읽는 중이에요')
      const j = await parseReceiptPhoto(blob)
      fromParsed(fromServer(j), 'server', j.raw_text, j.image_path)
    } catch (e) {
      fail(e)
    }
  }

  const runText = async () => {
    if (!text.trim()) return toast('영수증 글자를 붙여넣으세요.')
    if (!hasServer) return fromParsed(parseReceipt(text), 'text', text)
    setMsg('영수증 글자를 읽는 중이에요')
    setStep('loading')
    try {
      const j = await parseReceiptText(text)
      fromParsed(fromServer(j), 'text', text)
    } catch (e) {
      fail(e)
    }
  }

  const setItem = (i: number, k: keyof RcItem, v: string) => {
    const keep = body.current?.scrollTop ?? 0
    setItems((list) =>
      list.map((it, j) => {
        if (j !== i) return it
        const x = { ...it, [k]: k === 'qty' || k === 'amount' ? +v || 0 : v }
        if (k === 'name' && it.match === 'new') {
          const m = matchIng(store.get(), v)
          if (m !== 'new') x.match = m
        }
        return x
      }),
    )
    requestAnimationFrame(() => body.current && (body.current.scrollTop = keep))
  }

  const review = () => {
    const P = rcPlan(S, items, meta.date)
    if (!(P.upd.length + P.add.length)) return toast('반영할 품목이 없어요. 양과 금액을 확인하세요.')
    setPlan(P)
    setStep('review')
  }

  const save = async () => {
    const P = plan
    if (!P || !(P.upd.length + P.add.length)) return toast('반영할 품목이 없어요.')
    const keys = ['name', 'qty', 'unit', 'amount'] as const
    let fields = 0,
      edited = 0
    items.forEach((it) => {
      if (!it.o.name) return
      keys.forEach((k) => {
        fields++
        if (String(it[k]) !== String(it.o[k])) edited++
      })
    })
    const applied = P.upd.length + P.add.length
    const rec = {
      id: uid(),
      items: items
        .filter((it) => it.name)
        .map((it) => ({ name: it.name, qty: +it.qty || 0, unit: it.unit || '', amount: +it.amount || 0 })),
      date: meta.date,
      store: meta.store,
      total: meta.total || [...P.upd.map((u) => u.it), ...P.add].reduce((a, i) => a + +i.amount, 0),
      count: applied,
      fields,
      edited,
      source: meta.source,
      savedAt: new Date().toISOString(),
    }
    const mis = new Set(P.mism.map((x) => x.it))
    const body = {
      purchased_at: rec.date,
      vendor: rec.store,
      total: rec.total,
      ocr_source: rec.source,
      image_path: meta.imagePath || null,
      raw_text: meta.raw || null,
      fields_total: fields,
      fields_edited: edited,
      items: items.map((i) => {
        const action =
          P.skip.includes(i) || mis.has(i)
            ? ('skip' as const)
            : P.add.includes(i)
              ? ('new' as const)
              : ('update' as const)
        return {
          name: i.name,
          qty: +i.qty,
          unit: i.unit,
          amount: +i.amount,
          action,
          ingredient_id: action === 'update' ? (serverId('ing', i.match) ?? null) : null,
        }
      }),
    }
    if (syncOn()) {
      // 서버 가게에 연결돼 있으면: 서버에 반영하고 서버 데이터로 다시 맞춤 (새 식자재 id 도 서버 기준)
      setStep('loading')
      setMsg('저장하는 중이에요')
      try {
        await flush()
        await confirmReceipt(body)
        await pull()
      } catch (e) {
        setStep('review')
        return toast(e instanceof Error ? e.message : '서버에 저장하지 못했어요. 잠시 후 다시 시도해 주세요.')
      }
    } else {
      store.update((s) => {
        s.ings = P.ings
        s.receipts.unshift(rec)
        s.receipts = s.receipts.slice(0, 100)
      })
    }
    track('receipt_save', { items: applied, edited })
    close()
    toast(
      `저장했어요. 식자재 ${applied}개 반영` +
        (P.menus.length ? `, 메뉴 ${P.menus.length}개 원가가 바뀌었어요.` : '.') +
        (P.past ? ` 지난 ${P.past.days}일 장부도 다시 계산했어요.` : ''),
    )
  }

  const title = step === 'review' ? '저장 전 확인' : step === 'confirm' ? '인식 결과 수정' : '영수증 인식'
  const foot =
    step === 'confirm' ? (
      <>
        <button className="btn" onClick={() => setStep('pick')}>
          다시 찍기
        </button>
        <button className="btn primary" style={{ flex: 1 }} onClick={review}>
          다음
        </button>
      </>
    ) : step === 'review' ? (
      <>
        <button className="btn" onClick={() => setStep('confirm')}>
          수정하기
        </button>
        <button className="btn primary" style={{ flex: 1 }} onClick={save}>
          네, 저장할게요
        </button>
      </>
    ) : undefined

  return (
    <Sheet title={title} foot={foot} center bodyRef={body}>
      {step === 'pick' && (
        <PickStep
          err={err}
          onFile={runPhoto}
          onText={() => {
            setText('')
            setStep('text')
          }}
          onSample={() => {
            fromParsed(parseReceipt(SAMPLE_RECEIPT), 'text', SAMPLE_RECEIPT)
            toast('예시 영수증이에요. 확인 화면을 써 보세요.')
          }}
        />
      )}
      {step === 'text' && (
        <>
          <label className="field">
            <span>영수증 글자</span>
            <textarea
              autoFocus
              autoComplete="off"
              name="rc-ta"
              className="ta"
              placeholder="예: 양파 3kg 6,900…"
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
          </label>
          <div className="row" style={{ marginTop: 12 }}>
            <button className="btn" onClick={() => setStep('pick')}>
              취소
            </button>
            <button className="btn primary" style={{ flex: 1 }} onClick={runText}>
              품목 읽기
            </button>
          </div>
        </>
      )}
      {step === 'loading' && (
        <>
          {img && <img className="prev" src={img} alt="영수증 미리보기" />}
          <div style={{ padding: '28px 0', textAlign: 'center' }}>
            <div className="spin" />
            <p className="label">{msg || '영수증을 읽는 중이에요'}</p>
          </div>
        </>
      )}
      {step === 'confirm' && (
        <ConfirmStep
          img={img}
          meta={meta}
          setMeta={(p) => setMeta({ ...meta, ...p })}
          items={items}
          setItem={setItem}
          del={(i) => setItems(items.filter((_, j) => j !== i))}
          add={() =>
            setItems([
              ...items,
              {
                key: uid(),
                name: '',
                qty: 1,
                unit: '개',
                amount: 0,
                match: 'new',
                o: { name: '', qty: '', unit: '', amount: '' },
              },
            ])
          }
        />
      )}
      {step === 'review' && plan && <ReviewStep plan={plan} meta={meta} />}
    </Sheet>
  )
}

function PickStep({
  err,
  onFile,
  onText,
  onSample,
}: {
  err: string
  onFile: (f: File) => void
  onText: () => void
  onSample: () => void
}) {
  const { open } = useUi()
  return (
    <>
      <label className="drop" htmlFor="rc-file">
        <Icon name="cam" />
        <span>영수증 사진 찍기 · 앨범에서 고르기</span>
        <small>
          {hasServer
            ? '사진을 올리면 품목·양·금액을 자동으로 읽어요'
            : '체험 모드예요 · 사진 인식은 서버 연결 후 열려요'}
        </small>
      </label>
      <input
        type="file"
        id="rc-file"
        accept="image/*"
        capture="environment"
        hidden
        onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
      />
      <div className="opts">
        <button className="opt" onClick={onText}>
          <span className="opt-i">
            <Icon name="text" />
          </span>
          <span className="opt-t">
            <b>글자로 붙여넣기</b>
            <small>복사해 둔 영수증 내용을 붙여 넣어요</small>
          </span>
          <Icon name="chevThin" className="chev" />
        </button>
        <button className="opt" onClick={onSample}>
          <span className="opt-i">
            <Icon name="receipt" strokeWidth={1.8} strokeLinejoin="round" />
          </span>
          <span className="opt-t">
            <b>예시 영수증으로 해보기</b>
            <small>찍기 전에 어떻게 되는지 미리 봐요</small>
          </span>
          <Icon name="chevThin" className="chev" />
        </button>
      </div>
      <button className="how" onClick={() => open({ kind: 'guide', thenReceipt: true })}>
        처음이라면 사용법 보기
      </button>
      {err && (
        <div className="banner">
          <div>
            <b className="warn-t">인식하지 못했어요.</b>
            <br />
            {err}
          </div>
        </div>
      )}
    </>
  )
}

function ConfirmStep({
  img,
  meta,
  setMeta,
  items,
  setItem,
  del,
  add,
}: {
  img: string
  meta: { date: string; store: string; total: number }
  setMeta: (p: Partial<{ date: string; store: string }>) => void
  items: RcItem[]
  setItem: (i: number, k: keyof RcItem, v: string) => void
  del: (i: number) => void
  add: () => void
}) {
  const S = useStore()
  const sum = items.reduce((a, i) => a + (i.match === 'skip' ? 0 : +i.amount || 0), 0),
    all = items.reduce((a, i) => a + (+i.amount || 0), 0)
  return (
    <>
      {img && <img className="prev" src={img} alt="영수증 미리보기" />}
      <div className="grid2">
        <label className="field">
          <span>구매일</span>
          <input
            autoComplete="off"
            name="rc-date"
            className="inp num"
            type="date"
            value={meta.date}
            onChange={(e) => setMeta({ date: e.target.value })}
          />
        </label>
        <label className="field">
          <span>구매처</span>
          <input
            autoComplete="off"
            name="rc-store"
            className="inp"
            value={meta.store}
            onChange={(e) => setMeta({ store: e.target.value })}
          />
        </label>
      </div>
      <p className="hint">읽어 온 내용을 확인하세요. 고친 칸은 회색으로 표시돼요.</p>
      {items.length ? (
        items.map((it, i) => {
          const g = it.match !== 'new' && it.match !== 'skip' ? findIng(S, it.match) : undefined,
            nu = it.qty > 0 ? it.amount / it.qty : 0,
            mis = g && g.unit !== it.unit,
            ed = (k: keyof RcItem['o']) => (String(it[k]) !== String(it.o[k]) ? ' edited' : '')
          let info: React.ReactNode
          if (it.match === 'skip') info = '저장하지 않아요'
          else if (mis)
            info = (
              <span className="warn-t">
                단위가 달라요. {g.name}은(는) {g.unit} 기준이에요.
              </span>
            )
          else if (g) {
            const ou = unitPrice(g),
              dp = ou ? Math.round(((nu - ou) / ou) * 100) : 0
            info = (
              <>
                1{it.unit}당 {fmtUnit(nu)}원 · 지금 {fmtUnit(ou)}원{' '}
                <b className={dp > 0 ? 'warn-t' : ''}>
                  {dp > 0 ? '+' : ''}
                  {dp}%
                </b>
              </>
            )
          } else info = `새 식자재로 추가 · 1${it.unit}당 ${fmtUnit(nu)}원`
          return (
            <div className="ocr" key={it.key}>
              <div className="r1">
                <input
                  autoComplete="off"
                  name={`rc-n-${i}`}
                  className={'inp' + ed('name')}
                  defaultValue={it.name}
                  onBlur={(e) => setItem(i, 'name', e.target.value)}
                  aria-label="품목"
                />
                <select
                  autoComplete="off"
                  name={`rc-m-${i}`}
                  className="inp"
                  value={it.match}
                  onChange={(e) => setItem(i, 'match', e.target.value)}
                  aria-label="반영할 식자재"
                >
                  <option value="new">새 식자재</option>
                  {S.ings.map((x) => (
                    <option key={x.id} value={x.id}>
                      {x.name}에 반영
                    </option>
                  ))}
                  <option value="skip">저장 안 함</option>
                </select>
                <button className="x" onClick={() => del(i)} aria-label="품목 삭제">
                  <Icon name="x" width={20} height={20} />
                </button>
              </div>
              <div className="r2">
                <input
                  autoComplete="off"
                  name={`rc-q-${i}`}
                  className={'inp num' + ed('qty')}
                  type="number"
                  step="any"
                  min="0"
                  defaultValue={it.qty}
                  onBlur={(e) => setItem(i, 'qty', e.target.value)}
                  aria-label="양"
                />
                <select
                  autoComplete="off"
                  name={`rc-u-${i}`}
                  className={'inp' + ed('unit')}
                  value={it.unit}
                  onChange={(e) => setItem(i, 'unit', e.target.value)}
                  aria-label="단위"
                >
                  {UNITS.map((u) => (
                    <option key={u}>{u}</option>
                  ))}
                </select>
                <input
                  autoComplete="off"
                  name={`rc-a-${i}`}
                  className={'inp num' + ed('amount')}
                  type="number"
                  step="10"
                  min="0"
                  defaultValue={it.amount}
                  onBlur={(e) => setItem(i, 'amount', e.target.value)}
                  aria-label="금액(원)"
                />
              </div>
              <div className="hint num" style={{ margin: 0 }}>
                {info}
              </div>
            </div>
          )
        })
      ) : (
        <div className="empty">읽어 온 품목이 없어요. 다시 찍거나 글자로 붙여넣어 보세요.</div>
      )}
      <button className="link" style={{ marginTop: 12 }} onClick={add}>
        품목 추가
      </button>
      <div className="summary num">
        <div className="line">
          <span>품목 합계</span>
          <b>{won(all)}</b>
        </div>
        {meta.total > 0 && (
          <div className="line">
            <span>영수증 합계</span>
            <b className={meta.total !== all ? 'warn-t' : ''}>
              {won(meta.total)}
              {meta.total === all ? ' · 일치' : ' · 차이 ' + won(meta.total - all)}
            </b>
          </div>
        )}
        <div className="line">
          <span>단가에 반영할 금액</span>
          <b>{won(sum)}</b>
        </div>
      </div>
    </>
  )
}

function ReviewStep({ plan: P, meta }: { plan: Plan; meta: { date: string; store: string } }) {
  const n = P.upd.length + P.add.length
  const pct = (a: number, b: number) => (b ? Math.round(((a - b) / b) * 100) : 0)
  const md = (k: string) => {
    const [, mm, dd] = k.split('-')
    return `${+mm}/${+dd}`
  }
  return (
    <>
      <div className="rv-h">이대로 저장할까요?</div>
      <p className="label" style={{ margin: 0 }}>
        {meta.date} · {meta.store || '구매처 없음'} · 식자재 {n}개 반영
      </p>
      {P.past && (
        <div className="rv-sec">
          <span className="label">지난 장부가 바뀌어요</span>
          <p className="hint warn-t" style={{ margin: '6px 0 0' }}>
            영수증 날짜({md(meta.date)})부터 단가가 적용돼서{' '}
            <b className="num">
              {md(P.past.first)}~{md(P.past.last)}
            </b>{' '}
            ({P.past.days}일) 이익이{' '}
            <b className="num">
              {P.past.delta > 0 ? '+' : ''}
              {won(Math.round(P.past.delta))}
            </b>{' '}
            바뀌어요. 맞으면 저장하세요.
          </p>
        </div>
      )}
      {P.upd.length > 0 && (
        <div className="rv-sec">
          <span className="label">단가가 바뀌는 식자재</span>
          <ul className="list">
            {P.upd.map((u) => {
              const d = pct(u.nu, u.old)
              return (
                <li key={u.g.id} className="li">
                  <div className="grow">
                    <div className="t">{u.g.name}</div>
                    <div className="s num">
                      {fmtUnit(u.old)}원<span className="arrow">→</span>
                      {fmtUnit(u.nu)}원 / 1{u.g.unit}
                    </div>
                  </div>
                  <div className="r">
                    <span className={'pill num' + (d > 0 ? ' warn' : '')}>
                      {d > 0 ? '+' : ''}
                      {d}%
                    </span>
                  </div>
                </li>
              )
            })}
          </ul>
        </div>
      )}
      {P.add.length > 0 && (
        <div className="rv-sec">
          <span className="label">새로 추가하는 식자재</span>
          <ul className="list">
            {P.add.map((it, i) => (
              <li key={i} className="li">
                <div className="grow">
                  <div className="t">{it.name}</div>
                  <div className="s num">
                    {(+it.qty).toLocaleString('ko-KR')}
                    {it.unit} {won(it.amount)}
                  </div>
                </div>
                <div className="r num s">
                  1{it.unit}당 {fmtUnit(it.amount / it.qty)}원
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="rv-sec">
        <span className="label">원가가 바뀌는 메뉴</span>
        {P.menus.length ? (
          <>
            <ul className="list">
              {P.menus.map((x) => {
                const rb = (x.b / x.m.price) * 100,
                  ra = (x.a / x.m.price) * 100
                return (
                  <li key={x.m.id} className="li">
                    <div className="grow">
                      <div className="t">{x.m.name}</div>
                      <div className="s num">
                        원가 {won(x.b)}
                        <span className="arrow">→</span>
                        {won(x.a)}
                      </div>
                    </div>
                    <div className="r num">
                      <div className={'t ' + (ra >= 40 ? 'warn-t' : '')}>{ra.toFixed(1)}%</div>
                      <div className="s">원가율 (전 {rb.toFixed(1)}%)</div>
                    </div>
                  </li>
                )
              })}
            </ul>
            {P.menus.some((x) => x.a / x.m.price >= 0.4 && x.b / x.m.price < 0.4) && (
              <p className="hint warn-t">원가율이 40%를 넘는 메뉴가 생겨요.</p>
            )}
          </>
        ) : (
          <p className="hint">바뀌는 메뉴가 없어요.</p>
        )}
      </div>
      {(P.skip.length > 0 || P.mism.length > 0) && (
        <div className="rv-sec">
          <span className="label">저장하지 않는 품목</span>
          <ul className="list">
            {P.skip.map((it, i) => (
              <li key={'s' + i} className="li">
                <div className="grow">
                  <div className="t">{it.name || '이름 없음'}</div>
                  <div className="s">{it.match === 'skip' ? '저장 안 함으로 선택' : '양이나 금액이 비어 있어요'}</div>
                </div>
              </li>
            ))}
            {P.mism.map(({ it, g }, i) => (
              <li key={'m' + i} className="li">
                <div className="grow">
                  <div className="t">{it.name}</div>
                  <div className="s warn-t">
                    단위가 달라요 (영수증 {it.unit} · {g.name} {g.unit})
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
      <p className="hint" style={{ marginTop: 16 }}>
        틀린 곳이 있으면 ‘수정하기’를 눌러 고친 뒤 다시 확인하세요.
      </p>
    </>
  )
}
