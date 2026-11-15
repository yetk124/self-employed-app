import { createPortal } from 'react-dom'
import Icon from './Icon'

/** 홈: 큰 입력 버튼이 안 보일 때 나타나는 + 버튼 */
export default function Fab({ show, onClick }: { show: boolean; onClick: () => void }) {
  return createPortal(
    <button className={'fab2' + (show ? ' show' : '')} onClick={onClick} aria-label="오늘 매출 입력하기" tabIndex={show ? 0 : -1} aria-hidden={!show}>
      <Icon name="plus" />
    </button>,
    document.body,
  )
}
