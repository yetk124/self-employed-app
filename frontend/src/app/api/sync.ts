/**
 * 기기 저장소(state/store.ts) ↔ 서버(FastAPI) 동기화.
 *
 * 화면은 지금처럼 기기 저장소를 읽고 고쳐요. 로그인해서 서버 가게가 연결되면
 *   - 내려받기: GET /api/state 로 서버 데이터를 기기 저장소에 통째로 넣고
 *   - 올리기: 기기 저장소가 바뀔 때마다 마지막으로 맞춘 상태(base)와 비교해서
 *             바뀐 것만 각 API(POST/PUT/DELETE)로 보내요.
 *
 * 기기의 문자열 id ↔ 서버의 숫자 id 는 idmap 에 적어 둬요.
 * (서버에서 받은 건 'g12'·'m3'·'f7' 같은 id, 기기에서 새로 만든 건 올린 뒤 서버 id 를 연결)
 */
import { toast } from '@/shared/toast'
import { D0 } from '../lib/calc'
import { todayKey } from '../lib/date'
import { store } from '../state/store'
import type { AppState, Channel, FixedCost, Ingredient, Menu, OffMark, ReceiptRecord, Unit } from '../types'
import type { StateDto } from '../types/api'
import { api, ApiFail, hasServer } from './client'

type Kind = 'ch' | 'ing' | 'menu' | 'fixed'
type IdMap = Record<Kind, Record<string, number>>
/** 서버와 마지막으로 맞춘 상태 (비교 기준) */
type Base = Pick<AppState, 'settings' | 'tpl' | 'channels' | 'ings' | 'menus' | 'sales' | 'adj' | 'off' | 'fixed'>

const K = { sid: 'domain.storeId', map: 'domain.idmap', base: 'domain.syncBase' }
const emptyMap = (): IdMap => ({ ch: {}, ing: {}, menu: {}, fixed: {} })

const read = <T>(k: string): T | null => {
  try {
    const s = localStorage.getItem(k)
    return s ? (JSON.parse(s) as T) : null
  } catch {
    return null
  }
}
const write = (k: string, v: unknown) => {
  try {
    if (v === null) localStorage.removeItem(k)
    else localStorage.setItem(k, typeof v === 'string' ? v : JSON.stringify(v))
  } catch {
    /* 저장 공간이 없거나 막힌 경우 */
  }
}

let idmap: IdMap = read<IdMap>(K.map) ?? emptyMap()
let base: Base | null = read<Base>(K.base)
let busy = false
let again = false
let timer: ReturnType<typeof setTimeout> | undefined
let failToast = 0

const sid = () => {
  try {
    return localStorage.getItem(K.sid)
  } catch {
    return null
  }
}

/** 서버 가게가 연결돼 있고 로그인 상태인지 */
export const syncOn = () => hasServer && !!sid() && !!store.get().user && !!base

/** 기기 id → 서버 id (없으면 undefined) */
export const serverId = (k: Kind, id: string): number | undefined => idmap[k][id]

const snap = (S: AppState): Base =>
  structuredClone({
    settings: S.settings,
    tpl: S.tpl,
    channels: S.channels,
    ings: S.ings,
    menus: S.menus,
    sales: S.sales,
    adj: S.adj,
    off: S.off,
    fixed: S.fixed,
  })
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)
const saveBase = () => write(K.base, base)
const saveMap = () => write(K.map, idmap)

/* ---------------- 내려받기 ---------------- */

/** 서버 데이터 → 기기 저장소 모양 */
function fromServer(d: StateDto, cur: AppState): AppState {
  const map = emptyMap()
  const chId = (c: { id: number; name: string }, used: Set<string>) => {
    // 홀·포장은 기기 id 를 그대로 써요 (테이블 회전율 계산이 'hall' 을 봐요)
    const want = c.name === '홀' ? 'hall' : c.name === '포장' ? 'takeout' : `c${c.id}`
    const id = used.has(want) ? `c${c.id}` : want
    used.add(id)
    return id
  }
  const used = new Set<string>()
  const channels: Channel[] = d.channels.map((c) => {
    const id = chId(c, used)
    map.ch[id] = c.id
    return { id, name: c.name, fee: c.fee_rate, fixed: c.fixed_fee }
  })
  const ingKey = (n: number) => `g${n}`
  const menuKey = (n: number) => `m${n}`
  const chKey = Object.fromEntries(Object.entries(map.ch).map(([k, v]) => [v, k]))
  const ings: Ingredient[] = d.ingredients.map((g) => {
    map.ing[ingKey(g.id)] = g.id
    return {
      id: ingKey(g.id),
      name: g.name,
      unit: g.unit as Unit,
      buyPrice: g.buy_price,
      buyQty: g.buy_qty,
      hist: g.history.length
        ? g.history.map((h) => ({ from: h.from, buyPrice: h.buy_price, buyQty: h.buy_qty }))
        : [{ from: D0, buyPrice: g.buy_price, buyQty: g.buy_qty }],
      ...(g.image_url ? { img: g.image_url } : {}),
    }
  })
  const recipe = (r: { ingredient_id: number; qty: number }[]) =>
    r.map((x) => ({ ing: ingKey(x.ingredient_id), qty: x.qty }))
  const menus: Menu[] = d.menus.map((m) => {
    map.menu[menuKey(m.id)] = m.id
    const items = recipe(m.recipe)
    return {
      id: menuKey(m.id),
      name: m.name,
      price: m.price,
      items,
      hist: m.history.length
        ? m.history.map((h) => ({ from: h.from, price: h.price, items: recipe(h.recipe) }))
        : [{ from: D0, price: m.price, items }],
      ...(m.image_url ? { img: m.image_url } : {}),
    }
  })
  const sales: AppState['sales'] = {}
  for (const [day, byMenu] of Object.entries(d.sales)) {
    const out: Record<string, Record<string, number>> = {}
    for (const [mid, byCh] of Object.entries(byMenu)) {
      const row: Record<string, number> = {}
      for (const [cid, qty] of Object.entries(byCh)) if (chKey[+cid]) row[chKey[+cid]] = qty
      out[menuKey(+mid)] = row
    }
    sales[day] = out
  }
  const adj: AppState['adj'] = {}
  d.adjustments.forEach((a) => (adj[a.date] = { disc: a.discount, ref: a.refund }))
  const off: AppState['off'] = {}
  d.off_days.forEach((o) => (off[o.date] = o.status as OffMark))
  const fixed: FixedCost[] = d.fixed_costs.map((f) => {
    map.fixed[`f${f.id}`] = f.id
    return { id: `f${f.id}`, name: f.name, amount: f.amount, date: f.paid_on }
  })
  const receipts: ReceiptRecord[] = d.receipts.map((r) => ({
    id: `r${r.id}`,
    date: r.purchased_at,
    store: r.vendor,
    total: r.total,
    count: r.count,
    fields: r.fields_total,
    edited: r.fields_edited,
    source: r.ocr_source === 'server' ? 'server' : 'text',
    items: (r.items ?? []).map((i) => ({ name: i.name, qty: i.qty, unit: i.unit, amount: i.amount })),
  }))
  const s = d.settings
  idmap = map
  saveMap()
  return {
    ...cur,
    tpl: (s.biz_type as AppState['tpl']) || cur.tpl,
    settings: {
      ...cur.settings,
      store: s.name,
      open: s.open_time,
      close: s.close_time,
      goal: s.daily_goal ?? '',
      tables: s.tables ?? '',
      offDays: s.off_weekdays ?? [],
      notify: s.notify,
      ...(s.biz_sub ? { bizSub: s.biz_sub } : {}),
    },
    channels,
    ings,
    menus,
    sales,
    adj,
    off,
    fixed,
    receipts,
    onboarded: true,
  }
}

/** 서버 → 기기 (올릴 게 남아 있으면 먼저 올려요) */
export async function pull() {
  if (!hasServer || !sid()) return false
  if (base) await flush()
  const d = await api<StateDto>('/state')
  const next = fromServer(d, store.get())
  store.replace(next)
  base = snap(store.get())
  saveBase()
  return true
}

/* ---------------- 로그인 직후 ---------------- */

/** 기기 데이터 → POST /api/import 모양 */
function importBody(S: AppState) {
  const num = (v: unknown) => (+String(v ?? '') > 0 ? Math.round(+String(v)) : null)
  return {
    store: {
      name: S.settings.store || '내 가게',
      biz_type: S.tpl,
      biz_sub: S.settings.bizSub ?? null,
      open_time: S.settings.open,
      close_time: S.settings.close,
      use_template: false,
    },
    channels: S.channels.map((c) => ({
      key: c.id,
      name: c.name,
      fee_rate: +c.fee || 0,
      fixed_fee: Math.round(+c.fixed || 0),
    })),
    ingredients: S.ings.map((g) => ({
      key: g.id,
      name: g.name,
      unit: g.unit,
      buy_price: Math.round(g.buyPrice),
      buy_qty: g.buyQty,
      history: (g.hist ?? []).map((h) => ({ from: h.from, buy_price: Math.round(h.buyPrice), buy_qty: h.buyQty })),
    })),
    menus: S.menus.map((m) => ({
      key: m.id,
      name: m.name,
      price: Math.round(m.price),
      recipe: m.items.map((i) => ({ ingredient: i.ing, qty: +i.qty })),
      history: (m.hist ?? []).map((h) => ({
        from: h.from,
        price: Math.round(h.price),
        recipe: h.items.map((i) => ({ ingredient: i.ing, qty: +i.qty })),
      })),
    })),
    sales: Object.entries(S.sales).flatMap(([date, day]) =>
      date > todayKey()
        ? []
        : Object.entries(day).flatMap(([menu, byCh]) =>
            Object.entries(byCh).map(([channel, qty]) => ({ date, menu, channel, qty: +qty || 0 })),
          ),
    ),
    adjustments: Object.entries(S.adj).map(([date, a]) => ({ date, discount: +a.disc || 0, refund: +a.ref || 0 })),
    off_days: Object.entries(S.off).map(([date, status]) => ({ date, status })),
    fixed_costs: S.fixed
      .filter((f) => f.amount > 0 && f.name)
      .map((f) => ({ name: f.name, amount: Math.round(f.amount), paid_on: f.date })),
    daily_goal: num(S.settings.goal),
    tables: num(S.settings.tables),
    off_weekdays: S.settings.offDays,
  }
}

/** 지금 기기 데이터로 서버에 가게를 만들고 내려받기 */
export async function importLocal() {
  if (!hasServer || !store.get().user) return false
  const r = await api<{ store_id: number }>('/import', { method: 'POST', body: importBody(store.get()) })
  write(K.sid, String(r.store_id))
  await pull()
  return true
}

/**
 * 로그인 직후 한 번.
 * - 서버에 가게가 있으면 → 서버 데이터로 바꿈 ('pulled')
 * - 없는데 기기에서 쓰던 가게가 있으면 → 서버로 옮김 ('imported')
 * - 둘 다 없으면 → 온보딩에서 가게를 만든 뒤 importLocal ('none')
 */
export async function connect(): Promise<'pulled' | 'imported' | 'none' | 'off'> {
  if (!hasServer) return 'off'
  try {
    const { items } = await api<{ items: { id: number }[] }>('/stores')
    if (items.length) {
      if (sid() !== String(items[0].id)) {
        base = null
        write(K.sid, String(items[0].id))
      }
      await pull()
      return 'pulled'
    }
    write(K.sid, null)
    base = null
    if (store.get().onboarded) {
      await importLocal()
      return 'imported'
    }
    return 'none'
  } catch (e) {
    toast(e instanceof ApiFail && e.status ? e.message : '서버에 연결하지 못했어요. 기록은 이 기기에 먼저 저장할게요.')
    return 'off'
  }
}

/** 앱을 다시 열었을 때: 로그인돼 있으면 서버 최신 데이터로 맞춤 */
export async function resume() {
  if (!hasServer || !store.get().user) return
  try {
    if (sid() && base) await pull()
    else await connect()
  } catch {
    /* 오프라인이면 기기 데이터로 계속 */
  }
}

/** 로그아웃·탈퇴: 연결 정보와 비교 기준을 지움 */
export function disconnect() {
  clearTimeout(timer)
  base = null
  idmap = emptyMap()
  write(K.sid, null)
  write(K.map, null)
  write(K.base, null)
}

/* ---------------- 올리기 ---------------- */

type Op = { run: () => Promise<void>; done: (b: Base) => void }

const sendIng = (g: Ingredient) => ({ name: g.name, unit: g.unit })
const recipeOut = (items: Menu['items']) =>
  items.flatMap((i) => (idmap.ing[i.ing] ? [{ ingredient_id: idmap.ing[i.ing], qty: +i.qty }] : []))

/** base 와 지금을 비교해서 보낼 요청 목록 만들기 (순서: 만들기·고치기 → 판매 → 지우기) */
function plan(S: AppState, B: Base): Op[] {
  const ops: Op[] = []
  const upsert = <T extends { id: string }>(list: T[], item: T) => {
    const i = list.findIndex((x) => x.id === item.id)
    if (i >= 0) list[i] = structuredClone(item)
    else list.push(structuredClone(item))
  }

  // 설정
  const st = S.settings,
    bs = B.settings
  const body: Record<string, unknown> = {}
  if (st.store !== bs.store && st.store.trim()) body.name = st.store.trim()
  if (st.open !== bs.open) body.open_time = st.open
  if (st.close !== bs.close) body.close_time = st.close
  if (String(st.goal ?? '') !== String(bs.goal ?? ''))
    body.daily_goal = +String(st.goal ?? '') > 0 ? Math.round(+String(st.goal)) : null
  if (String(st.tables ?? '') !== String(bs.tables ?? ''))
    body.tables = +String(st.tables ?? '') > 0 ? Math.round(+String(st.tables)) : null
  if (!same(st.offDays, bs.offDays)) body.off_weekdays = st.offDays
  if (st.notify !== bs.notify) body.notify = st.notify
  if ((st.bizSub ?? '') !== (bs.bizSub ?? '')) body.biz_sub = st.bizSub || null
  if (S.tpl !== B.tpl) body.biz_type = S.tpl
  if (Object.keys(body).length)
    ops.push({
      run: () => api('/settings', { method: 'PUT', body }).then(() => undefined),
      done: (b) => {
        b.settings = structuredClone(st)
        b.tpl = S.tpl
      },
    })

  // 채널
  for (const c of S.channels) {
    const old = B.channels.find((x) => x.id === c.id)
    const out = {
      name: c.name.trim() || '채널',
      fee_rate: Math.min(100, Math.max(0, +c.fee || 0)),
      fixed_fee: Math.max(0, Math.round(+c.fixed || 0)),
    }
    if (!idmap.ch[c.id])
      ops.push({
        run: async () => {
          const r = await api<{ id: number }>('/channels', { method: 'POST', body: out })
          idmap.ch[c.id] = r.id
        },
        done: (b) => upsert(b.channels, c),
      })
    else if (!same(old, c))
      ops.push({
        run: () => api(`/channels/${idmap.ch[c.id]}`, { method: 'PUT', body: out }).then(() => undefined),
        done: (b) => upsert(b.channels, c),
      })
  }

  // 식자재
  for (const g of S.ings) {
    const old = B.ings.find((x) => x.id === g.id)
    const hist = g.hist?.length ? g.hist : [{ from: D0, buyPrice: g.buyPrice, buyQty: g.buyQty }]
    const isNew = !idmap.ing[g.id]
    if (!isNew && same(old, g)) continue
    ops.push({
      run: async () => {
        if (isNew) {
          const first = hist[0]
          const r = await api<{ id: number }>('/ingredients', {
            method: 'POST',
            body: {
              ...sendIng(g),
              buy_price: Math.max(1, Math.round(first.buyPrice)),
              buy_qty: first.buyQty > 0 ? first.buyQty : 1,
            },
          })
          idmap.ing[g.id] = r.id
        } else if (old && (old.name !== g.name || old.unit !== g.unit)) {
          await api(`/ingredients/${idmap.ing[g.id]}`, { method: 'PUT', body: sendIng(g) })
        }
        // 가격 이력: 새로 생기거나 바뀐 날짜만
        const prev = isNew ? [hist[0]] : (old?.hist ?? [])
        for (const h of hist) {
          const p = prev.find((x) => x.from === h.from)
          if (p && p.buyPrice === h.buyPrice && p.buyQty === h.buyQty) continue
          if (!(h.buyPrice > 0 && h.buyQty > 0)) continue
          await api(`/ingredients/${idmap.ing[g.id]}`, {
            method: 'PUT',
            body: {
              buy_price: Math.round(h.buyPrice),
              buy_qty: h.buyQty,
              valid_from: h.from === D0 ? '2000-01-01' : h.from,
            },
          })
        }
      },
      done: (b) => upsert(b.ings, g),
    })
  }

  // 메뉴
  for (const m of S.menus) {
    const old = B.menus.find((x) => x.id === m.id)
    const hist = m.hist?.length ? m.hist : [{ from: D0, price: m.price, items: m.items }]
    const isNew = !idmap.menu[m.id]
    if (!isNew && same(old, m)) continue
    ops.push({
      run: async () => {
        if (isNew) {
          const first = hist[0]
          const r = await api<{ id: number }>('/menus', {
            method: 'POST',
            body: {
              name: m.name.trim() || '메뉴',
              price: Math.max(1, Math.round(first.price)),
              recipe: recipeOut(first.items),
            },
          })
          idmap.menu[m.id] = r.id
        } else if (old && old.name !== m.name) {
          await api(`/menus/${idmap.menu[m.id]}`, { method: 'PUT', body: { name: m.name.trim() || '메뉴' } })
        }
        const prev = isNew ? [hist[0]] : (old?.hist ?? [])
        for (const h of hist) {
          const p = prev.find((x) => x.from === h.from)
          if (p && p.price === h.price && same(p.items, h.items)) continue
          if (!(h.price > 0)) continue
          await api(`/menus/${idmap.menu[m.id]}`, {
            method: 'PUT',
            body: { price: Math.round(h.price), recipe: recipeOut(h.items), valid_from: h.from },
          })
        }
      },
      done: (b) => upsert(b.menus, m),
    })
  }

  // 고정비
  for (const f of S.fixed) {
    if (!(f.amount > 0 && f.name.trim() && f.date)) continue
    const old = B.fixed.find((x) => x.id === f.id)
    const out = { name: f.name.trim().slice(0, 30), amount: Math.round(f.amount), paid_on: f.date }
    if (!idmap.fixed[f.id])
      ops.push({
        run: async () => {
          const r = await api<{ id: number }>('/fixed-costs', { method: 'POST', body: out })
          idmap.fixed[f.id] = r.id
        },
        done: (b) => upsert(b.fixed, f),
      })
    else if (!same(old, f))
      ops.push({
        run: () => api(`/fixed-costs/${idmap.fixed[f.id]}`, { method: 'PUT', body: out }).then(() => undefined),
        done: (b) => upsert(b.fixed, f),
      })
  }

  // 판매 · 할인·환불 (하루 단위로 통째로)
  const today = todayKey()
  const hadSales = Object.keys(B.sales).length > 0
  if (hadSales && !Object.keys(S.sales).length && !Object.keys(S.adj).length) {
    ops.push({
      run: () => api('/sales', { method: 'DELETE' }).then(() => undefined),
      done: (b) => {
        b.sales = {}
        b.adj = {}
      },
    })
  } else {
    const days = new Set([
      ...Object.keys(S.sales),
      ...Object.keys(B.sales),
      ...Object.keys(S.adj),
      ...Object.keys(B.adj),
    ])
    for (const d of [...days].sort()) {
      if (d > today) continue
      if (same(S.sales[d] ?? {}, B.sales[d] ?? {}) && same(S.adj[d] ?? null, B.adj[d] ?? null)) continue
      const day = S.sales[d] ?? {},
        a = S.adj[d]
      ops.push({
        run: () => {
          const items = Object.entries(day).flatMap(([mid, byCh]) =>
            idmap.menu[mid]
              ? Object.entries(byCh).flatMap(([cid, qty]) =>
                  idmap.ch[cid] && +qty > 0
                    ? [{ menu_id: idmap.menu[mid], channel_id: idmap.ch[cid], qty: Math.round(+qty) }]
                    : [],
                )
              : [],
          )
          return api(`/sales/${d}`, {
            method: 'PUT',
            body: {
              items,
              discount: Math.max(0, Math.round(+(a?.disc ?? 0))),
              refund: Math.max(0, Math.round(+(a?.ref ?? 0))),
            },
          }).then(() => undefined)
        },
        done: (b) => {
          if (S.sales[d]) b.sales[d] = structuredClone(S.sales[d])
          else delete b.sales[d]
          if (a) b.adj[d] = { ...a }
          else delete b.adj[d]
        },
      })
    }
  }

  // 휴무
  const offDays = new Set([...Object.keys(S.off), ...Object.keys(B.off)])
  for (const d of offDays) {
    if (S.off[d] === B.off[d]) continue
    const v = S.off[d] ?? null
    ops.push({
      run: () => api(`/off-days/${d}`, { method: 'PUT', body: { status: v } }).then(() => undefined),
      done: (b) => {
        if (v) b.off[d] = v
        else delete b.off[d]
      },
    })
  }

  // 지우기 (메뉴 → 식자재 → 채널 → 고정비 순서)
  const gone = <T extends { id: string }>(prev: T[], now: T[]) => prev.filter((x) => !now.some((y) => y.id === x.id))
  const del = (k: Kind, path: string, id: string, drop: (b: Base) => void) => {
    const n = idmap[k][id]
    ops.push({
      run: async () => {
        if (!n) return
        try {
          await api(`${path}/${n}`, { method: 'DELETE' })
        } catch (e) {
          // 판매 기록·레시피에 쓰여서 못 지우는 건 서버에 남겨 둬요
          if (!(e instanceof ApiFail && (e.status === 409 || e.status === 404 || e.status === 400))) throw e
        }
        delete idmap[k][id]
      },
      done: drop,
    })
  }
  gone(B.menus, S.menus).forEach((m) =>
    del('menu', '/menus', m.id, (b) => (b.menus = b.menus.filter((x) => x.id !== m.id))),
  )
  gone(B.ings, S.ings).forEach((g) =>
    del('ing', '/ingredients', g.id, (b) => (b.ings = b.ings.filter((x) => x.id !== g.id))),
  )
  gone(B.channels, S.channels).forEach((c) =>
    del('ch', '/channels', c.id, (b) => (b.channels = b.channels.filter((x) => x.id !== c.id))),
  )
  gone(B.fixed, S.fixed).forEach((f) =>
    del('fixed', '/fixed-costs', f.id, (b) => (b.fixed = b.fixed.filter((x) => x.id !== f.id))),
  )
  return ops
}

/** 바뀐 것 지금 바로 올리기 */
export async function flush(): Promise<void> {
  if (!syncOn() || !base) return
  if (busy) {
    again = true
    return
  }
  busy = true
  try {
    const ops = plan(store.get(), base)
    for (const op of ops) {
      try {
        await op.run()
      } catch (e) {
        // 입력값 문제(400·422)는 그 항목만 건너뛰고, 나머지(네트워크·서버)는 다음에 다시 시도
        if (e instanceof ApiFail && (e.status === 400 || e.status === 422)) {
          toast(e.message)
        } else throw e
      }
      op.done(base)
      saveMap()
      saveBase()
    }
  } catch (e) {
    if (Date.now() - failToast > 30000) {
      failToast = Date.now()
      toast(
        e instanceof ApiFail && e.status
          ? `서버 저장 실패: ${e.message}`
          : '서버에 저장하지 못했어요. 이 기기에 저장해 두고 다시 시도할게요.',
      )
    }
    clearTimeout(timer)
    timer = setTimeout(() => void flush(), 15000)
  } finally {
    busy = false
    if (again) {
      again = false
      void flush()
    }
  }
}

/** 기기 저장소가 바뀌면 잠깐 모았다가 올리기 */
store.subscribe(() => {
  if (!syncOn()) return
  clearTimeout(timer)
  timer = setTimeout(() => void flush(), 700)
})
