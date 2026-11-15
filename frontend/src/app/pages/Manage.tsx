import { useSearchParams } from 'react-router'
import { track } from '@/shared/analytics'
import { toast } from '@/shared/toast'
import { PageTitle } from '../components/bits'
import Icon from '../components/Icon'
import { useStore } from '../state/store'
import { useUi } from '../state/ui'
import FixedTab from './manage/FixedTab'
import IngTab from './manage/IngTab'
import MenuTab from './manage/MenuTab'

type Tab = 'menu' | 'ing' | 'fix'
const TABS: [Tab, string][] = [
  ['menu', '메뉴'],
  ['ing', '식자재'],
  ['fix', '고정비'],
]

/** 관리: 메뉴(마진) · 식자재(단가) · 고정비 탭 */
export default function Manage() {
  const S = useStore()
  const { gate, openReceipt } = useUi()
  const [params, setParams] = useSearchParams()
  const q = params.get('tab') as Tab | null
  const tab: Tab = q && ['menu', 'ing', 'fix'].includes(q) ? q : 'menu'
  const add = () => {
    if (tab === 'menu') {
      if (!S.ings.length) return toast('식자재를 먼저 등록하세요.')
      gate({ kind: 'menu' })
    } else if (tab === 'ing') gate({ kind: 'ing' })
    else gate({ kind: 'fixed' })
  }
  return (
    <>
      <PageTitle
        right={
          <div className="row" style={{ gap: 0 }}>
            {tab === 'ing' && (
              <button className="iconbtn" onClick={openReceipt} aria-label="영수증 인식">
                <Icon name="cam" />
              </button>
            )}
            <button className="iconbtn" onClick={add} aria-label={{ menu: '메뉴 추가', ing: '식자재 추가', fix: '고정비 추가' }[tab]}>
              <Icon name="plus" />
            </button>
          </div>
        }
      >
        관리
      </PageTitle>
      <div className="seg seg3" role="tablist" aria-label="관리 항목 전환">
        {TABS.map(([k, l]) => (
          <button
            key={k}
            role="tab"
            aria-selected={tab === k}
            onClick={() => {
              track('margin_tab', { tab: k })
              setParams(k === 'menu' ? {} : { tab: k }, { replace: true })
            }}
          >
            {l}
          </button>
        ))}
      </div>
      {tab === 'ing' ? <IngTab /> : tab === 'fix' ? <FixedTab /> : <MenuTab />}
    </>
  )
}
