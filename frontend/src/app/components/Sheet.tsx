import type { ReactNode } from 'react'
import { useUi } from '../state/ui'
import Icon from './Icon'

interface Props {
  title: string
  children: ReactNode
  foot?: ReactNode
  /** 가운데 뜨는 창 (영수증) */
  center?: boolean
  bodyRef?: React.Ref<HTMLDivElement>
}

/** 아래에서 올라오는 창. 바깥(어두운 부분)을 누르면 닫혀요. */
export default function Sheet({ title, children, foot, center, bodyRef }: Props) {
  const { close } = useUi()
  return (
    <div className={'mask' + (center ? ' center' : '')} onClick={(e) => e.target === e.currentTarget && close()}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={title}>
        <div className="sh-head">
          <h2>{title}</h2>
          <button className="x" onClick={close} aria-label="닫기">
            <Icon name="x" width={20} height={20} />
          </button>
        </div>
        <div className="sh-body" ref={bodyRef}>
          {children}
        </div>
        {foot && <div className="sh-foot">{foot}</div>}
      </div>
    </div>
  )
}
