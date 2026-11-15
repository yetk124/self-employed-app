/** 카카오 · 구글 · 이메일 버튼 (로그인 화면·저장 전 로그인 유도 공용) */
export default function SocialButtons({
  onOauth,
  onEmail,
  divider,
}: {
  onOauth: (p: 'kakao' | 'google') => void
  onEmail: () => void
  divider?: boolean
}) {
  return (
    <div className="sbtns">
      <button className="sbtn kakao" onClick={() => onOauth('kakao')}>
        <img className="mk" src="/img/kakao.png" width="22" height="22" alt="" />
        카카오로 시작하기
      </button>
      <button className="sbtn google" onClick={() => onOauth('google')}>
        <img className="mk" src="/img/google.png" width="22" height="22" alt="" />
        구글로 시작하기
      </button>
      {divider && <div className="or">또는</div>}
      <button className="sbtn email" onClick={onEmail}>
        이메일로 가입하기
      </button>
    </div>
  )
}
