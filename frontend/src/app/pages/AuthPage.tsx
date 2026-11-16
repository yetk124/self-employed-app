import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router'
import { toast } from '@/shared/toast'
import { AUTH_MOCK, Auth, PROV, emailOk, pwOk } from '../auth/auth'
import Icon from '../components/Icon'
import SocialButtons from '../components/SocialButtons'
import { store, useStore } from '../state/store'
import { useUi } from '../state/ui'

type Err = Partial<Record<'email' | 'pw' | 'pw2' | 'agree' | 'form', string>>

/** 로그인·가입: 카카오 · 구글 · 이메일 */
export default function AuthPage() {
  const S = useStore()
  const nav = useNavigate()
  const { auth, setAuth, signedIn, open } = useUi()
  const [email, setEmail] = useState('')
  const [pw, setPw] = useState('')
  const [pw2, setPw2] = useState('')
  const [agree, setAgree] = useState({ terms: false, privacy: false, mkt: false })
  const [err, setErr] = useState<Err>({})
  const [busy, setBusy] = useState(false)

  const leave = () => {
    if (auth.mode === 'email') {
      setAuth({ mode: 'main' })
      setErr({})
      return
    }
    nav(auth.from && !['/auth', '/onboarding'].includes(auth.from) ? auth.from : '/')
  }

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

  const back = (
    <header className="top">
      <button className="iconbtn" onClick={leave} aria-label="뒤로">
        <Icon name="l" />
      </button>
      <span />
      <span style={{ width: 40 }} />
    </header>
  )

  if (auth.mode === 'main')
    return (
      <>
        {back}
        <div className="auth">
          <img className="logo" src="/img/logo.png" width="455" height="102" alt="domain" />
          <h1>3초 만에 시작하기</h1>
          <p className="sub">
            가입하면 입력한 기록이 안전하게 저장되고
            <br />
            휴대폰을 바꿔도 그대로 이어서 쓸 수 있어요.
          </p>
          <SocialButtons onOauth={oauth} onEmail={() => setAuth({ mode: 'email', tab: 'signup' })} divider />
          <p
            style={{
              margin: '16px 0 0',
              fontSize: 'var(--hwp-font-headline-2)',
              color: 'var(--hwp-color-text-secondary)',
            }}
          >
            이미 이메일로 가입했나요?{' '}
            <button
              className="link"
              style={{ fontSize: 'inherit' }}
              onClick={() => setAuth({ mode: 'email', tab: 'login' })}
            >
              이메일 로그인
            </button>
          </p>
          {!S.user && (
            <button className="later" onClick={() => (S.onboarded ? leave() : nav('/onboarding'))}>
              가입 없이 시작할게요
            </button>
          )}
          {AUTH_MOCK && (
            <p className="mode">지금은 체험 모드예요. 실제 카카오·구글 연결 없이 이 기기 안에서만 로그인돼요.</p>
          )}
        </div>
      </>
    )

  const su = auth.tab === 'signup',
    all = agree.terms && agree.privacy && agree.mkt

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const em = email.trim(),
      er: Err = {}
    if (!emailOk(em)) er.email = '이메일 형식을 확인해 주세요. 예: owner@example.com'
    if (su && !pwOk(pw)) er.pw = '비밀번호는 영문과 숫자를 섞어 8자 이상으로 만들어 주세요.'
    if (!su && !pw) er.pw = '비밀번호를 입력해 주세요.'
    if (su && pw2 !== pw) er.pw2 = '비밀번호가 서로 달라요.'
    if (su && !(agree.terms && agree.privacy)) er.agree = '필수 항목에 동의해야 가입할 수 있어요.'
    if (Object.keys(er).length) return setErr(er)
    setBusy(true)
    setErr({})
    try {
      const r = su ? await Auth.signUp(em, pw, agree.mkt) : await Auth.signIn(em, pw)
      setBusy(false)
      if (r && 'confirm' in r) {
        setAuth({ mode: 'main' })
        toast(`${em}로 인증 메일을 보냈어요. 메일의 링크를 누르면 가입이 끝나요.`)
        return
      }
      if (r) signedIn(r.user, r.isNew)
    } catch (x) {
      setBusy(false)
      setErr({ form: (x as Error).message || '잠시 후 다시 시도해 주세요.' })
    }
  }

  const reset = async () => {
    if (!emailOk(email)) return setErr({ email: '비밀번호를 재설정할 이메일을 먼저 입력해 주세요.' })
    try {
      await Auth.reset(email)
      toast(`${email}로 비밀번호 재설정 링크를 보냈어요.${AUTH_MOCK ? ' (체험 모드라 실제로 보내지는 않아요)' : ''}`)
    } catch {
      toast('메일을 보내지 못했어요. 이메일을 확인해 주세요.')
    }
  }

  return (
    <>
      {back}
      <div className="auth" style={{ paddingTop: 4 }}>
        <h1 style={{ marginTop: 0 }}>{su ? '이메일로 가입하기' : '이메일 로그인'}</h1>
        <div className="tabs2" role="tablist">
          <button role="tab" aria-selected={su} onClick={() => (setAuth({ tab: 'signup' }), setErr({}))}>
            회원가입
          </button>
          <button role="tab" aria-selected={!su} onClick={() => (setAuth({ tab: 'login' }), setErr({}))}>
            로그인
          </button>
        </div>
        <form className="form" noValidate onSubmit={submit}>
          <label className="field">
            <span>이메일</span>
            <input
              name="email"
              className="inp"
              type="email"
              autoComplete="email"
              inputMode="email"
              value={email}
              placeholder="예: owner@example.com…"
              spellCheck={false}
              autoCapitalize="off"
              onChange={(e) => (setEmail(e.target.value), setErr((x) => ({ ...x, email: '' })))}
            />
            <span className="ferr">{err.email}</span>
          </label>
          <label className="field" style={{ marginTop: 6 }}>
            <span>비밀번호</span>
            <input
              name="password"
              className="inp"
              type="password"
              autoComplete={su ? 'new-password' : 'current-password'}
              value={pw}
              placeholder={su ? '영문과 숫자 포함 8자 이상…' : '비밀번호…'}
              onChange={(e) => (setPw(e.target.value), setErr((x) => ({ ...x, pw: '' })))}
            />
            <span className="ferr">{err.pw}</span>
          </label>
          {su ? (
            <>
              <label className="field" style={{ marginTop: 6 }}>
                <span>비밀번호 확인</span>
                <input
                  name="password-confirm"
                  className="inp"
                  type="password"
                  autoComplete="new-password"
                  value={pw2}
                  placeholder="한 번 더 입력…"
                  onChange={(e) => (setPw2(e.target.value), setErr((x) => ({ ...x, pw2: '' })))}
                />
                <span className="ferr">{err.pw2}</span>
              </label>
              <div className="agrees">
                <label className="agree all">
                  <input
                    type="checkbox"
                    checked={all}
                    onChange={(e) =>
                      setAgree({ terms: e.target.checked, privacy: e.target.checked, mkt: e.target.checked })
                    }
                  />
                  <span className="grow">전체 동의</span>
                </label>
                {(
                  [
                    ['terms', '이용약관', true],
                    ['privacy', '개인정보 수집·이용', true],
                  ] as const
                ).map(([k, l]) => (
                  <label className="agree" key={k}>
                    <input
                      type="checkbox"
                      checked={agree[k]}
                      onChange={(e) => setAgree({ ...agree, [k]: e.target.checked })}
                    />
                    <span className="grow">
                      <span className="req">[필수]</span> {l}
                    </span>
                    <button
                      type="button"
                      className="view-doc"
                      onClick={(e) => {
                        e.preventDefault()
                        open({ kind: 'doc', doc: k })
                      }}
                    >
                      보기
                    </button>
                  </label>
                ))}
                <label className="agree">
                  <input
                    type="checkbox"
                    checked={agree.mkt}
                    onChange={(e) => setAgree({ ...agree, mkt: e.target.checked })}
                  />
                  <span className="grow">
                    <span className="opt">[선택]</span> 이벤트·혜택 알림 받기
                  </span>
                </label>
              </div>
              <p className="ferr" style={{ margin: '6px 0 0' }}>
                {err.agree}
              </p>
            </>
          ) : (
            <div style={{ textAlign: 'right', marginTop: 2 }}>
              <button type="button" className="link" style={{ fontSize: 'var(--hwp-font-headline-2)' }} onClick={reset}>
                비밀번호를 잊었어요
              </button>
            </div>
          )}
          {err.form && (
            <div className="banner">
              <div className="warn-t">{err.form}</div>
            </div>
          )}
          <button className="btn primary block" type="submit" style={{ marginTop: 18 }} disabled={busy}>
            {busy ? '잠시만요…' : su ? '가입하기' : '로그인'}
          </button>
        </form>
        {AUTH_MOCK && <p className="mode">체험 모드: 가입 정보는 이 기기에만 저장돼요.</p>}
      </div>
    </>
  )
}
