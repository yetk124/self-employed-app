import { toast } from '@/shared/toast'
import { SAMPLE_IMG } from '../data/templates'
import { readPhoto } from '../lib/image'
import Icon from './Icon'

/** 메뉴·식자재 사진 고르기. 서버가 생기면 Supabase Storage 에 올리고 주소(image_url)만 저장 */
export default function PhotoField({ kind, id, img, onChange }: { kind: 'menu' | 'ing'; id: string; img?: string; onChange: (u: string | undefined) => void }) {
  const src = img || (kind === 'menu' ? SAMPLE_IMG[id] : undefined)
  const label = kind === 'menu' ? '메뉴' : '식자재'
  return (
    <div className="photo">
      <span className="photo-box">
        {src ? (
          <img src={src} alt={`${label} 사진 미리보기`} />
        ) : (
          <span>
            <Icon name="cam" />
          </span>
        )}
      </span>
      <div className="photo-txt">
        <b>{label} 사진</b>
        <span>목록에서 한눈에 알아보기 쉬워져요.</span>
        <div className="row" style={{ gap: 6, marginTop: 6 }}>
          <label className="link" htmlFor="ph-file">
            {src ? '사진 바꾸기' : '사진 추가'}
          </label>
          {img && (
            <button className="link" type="button" onClick={() => onChange(undefined)} style={{ color: 'var(--hwp-color-text-muted)' }}>
              지우기
            </button>
          )}
        </div>
      </div>
      <input
        type="file"
        id="ph-file"
        accept="image/*"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f)
            readPhoto(f)
              .then(onChange)
              .catch(() => toast('사진을 읽지 못했어요. 다른 사진을 골라 주세요.'))
        }}
      />
    </div>
  )
}
