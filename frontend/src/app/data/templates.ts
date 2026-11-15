import type { BizKey, Channel, Unit } from '../types'

/** 업종 대분류 10개 + 대표 업종 (온보딩·설정 공용). 가격은 예시예요. */
export const BIZ: [BizKey, string, string[]][] = [
  ['hansik', '한식', ['한식당', '고깃집', '국밥집']],
  ['junsik', '중식', ['중국집', '마라탕']],
  ['ilsik', '일식', ['초밥', '라멘', '돈카츠']],
  ['yangsik', '양식', ['파스타', '피자', '스테이크']],
  ['bunsik', '분식', ['떡볶이', '김밥']],
  ['cafe', '카페·디저트', ['카페', '베이커리']],
  ['fastfood', '패스트푸드', ['햄버거', '치킨']],
  ['pub', '주점', ['호프', '포차', '이자카야']],
  ['asian', '아시아 음식', ['쌀국수', '태국 음식']],
  ['salad', '샐러드', ['샐러드', '포케']],
  ['dosirak', '도시락', ['도시락', '반찬']],
  ['etc', '기타', ['뷔페', '푸드트럭']],
]

export const CH_DEFAULT: Channel[] = [
  { id: 'hall', name: '홀', fee: 0, fixed: 0 },
  { id: 'takeout', name: '포장', fee: 0, fixed: 300 },
]

type IngRow = [id: string, name: string, unit: Unit, buyPrice: number, buyQty: number]
type MenuRow = [id: string, name: string, price: number, items: [ing: string, qty: number][]]
export interface Template {
  label: string
  store: string
  ings: IngRow[]
  menus: MenuRow[]
}

export const TPL: Record<BizKey, Template> = {
  hansik: {
    label: '한식',
    store: '예시 한식당',
    ings: [
      ['rice', '쌀', 'g', 52000, 20000],
      ['pork', '돼지고기 앞다리', 'g', 13000, 1000],
      ['kimchi', '김치', 'g', 30000, 10000],
      ['tofu', '두부', '모', 1500, 1],
      ['onion', '양파', 'g', 4500, 3000],
      ['scallion', '대파', 'g', 3000, 1000],
      ['chili', '고춧가루', 'g', 25000, 1000],
      ['egg', '계란', '개', 7500, 30],
      ['doenjang', '된장', 'g', 9000, 1000],
      ['zucchini', '애호박', '개', 1500, 1],
    ],
    menus: [
      ['kjj', '김치찌개', 9000, [['kimchi', 200], ['pork', 100], ['tofu', 0.5], ['scallion', 20], ['rice', 200]]],
      ['jeyuk', '제육볶음', 11000, [['pork', 200], ['onion', 100], ['chili', 15], ['scallion', 30], ['rice', 200]]],
      ['djj', '된장찌개', 8000, [['tofu', 1], ['doenjang', 40], ['zucchini', 0.5], ['onion', 50], ['scallion', 20], ['rice', 200]]],
      ['egg', '계란말이', 7000, [['egg', 4], ['scallion', 20], ['onion', 30]]],
    ],
  },
  cafe: {
    label: '카페·디저트',
    store: '예시 카페',
    ings: [
      ['bean', '원두', 'g', 28000, 1000],
      ['milk', '우유', 'ml', 2800, 1000],
      ['cup', '컵·뚜껑', '개', 120, 1],
      ['syrup', '바닐라 시럽', 'ml', 12000, 1000],
      ['ice', '얼음', 'g', 3000, 3000],
    ],
    menus: [
      ['ame', '아메리카노', 4000, [['bean', 20], ['cup', 1], ['ice', 150]]],
      ['latte', '카페라떼', 4800, [['bean', 20], ['milk', 200], ['cup', 1], ['ice', 150]]],
      ['vanilla', '바닐라라떼', 5300, [['bean', 20], ['milk', 200], ['syrup', 20], ['cup', 1], ['ice', 150]]],
    ],
  },
  bunsik: {
    label: '분식',
    store: '예시 분식집',
    ings: [
      ['tteok', '떡', 'g', 5000, 1000],
      ['fishcake', '어묵', 'g', 8000, 1000],
      ['gochujang', '고추장', 'g', 10000, 1000],
      ['laver', '김', '장', 6000, 100],
      ['danmuji', '단무지', 'g', 4000, 1000],
      ['rice', '쌀', 'g', 52000, 20000],
      ['egg', '계란', '개', 7500, 30],
      ['scallion', '대파', 'g', 3000, 1000],
    ],
    menus: [
      ['tbk', '떡볶이', 5000, [['tteok', 300], ['fishcake', 100], ['gochujang', 50], ['scallion', 20]]],
      ['gimbap', '김밥', 4000, [['rice', 150], ['laver', 1], ['danmuji', 20], ['egg', 1]]],
      ['odeng', '어묵탕', 3000, [['fishcake', 150], ['scallion', 10]]],
    ],
  },
  junsik: {
    label: '중식',
    store: '예시 중국집',
    ings: [
      ['noodle', '중화면', 'g', 3000, 1000],
      ['chunjang', '춘장', 'g', 6000, 1000],
      ['pork', '돼지고기', 'g', 13000, 1000],
      ['onion', '양파', 'g', 4500, 3000],
      ['squid', '오징어', 'g', 15000, 1000],
      ['chili', '고춧가루', 'g', 25000, 1000],
      ['starch', '전분', 'g', 3000, 1000],
      ['oil', '식용유', 'ml', 8000, 1800],
      ['danmuji', '단무지', 'g', 4000, 1000],
    ],
    menus: [
      ['jjm', '짜장면', 7000, [['noodle', 200], ['chunjang', 40], ['pork', 50], ['onion', 80], ['oil', 15], ['danmuji', 20]]],
      ['jjb', '짬뽕', 8500, [['noodle', 200], ['squid', 60], ['pork', 40], ['onion', 60], ['chili', 10], ['danmuji', 20]]],
      ['tsy', '탕수육', 18000, [['pork', 300], ['starch', 80], ['oil', 120], ['onion', 50]]],
    ],
  },
  ilsik: {
    label: '일식',
    store: '예시 일식당',
    ings: [
      ['rice', '쌀', 'g', 52000, 20000],
      ['salmon', '연어', 'g', 45000, 1000],
      ['wasabi', '와사비', 'g', 12000, 500],
      ['loin', '돼지 등심', 'g', 15000, 1000],
      ['panko', '빵가루', 'g', 5000, 1000],
      ['oil', '식용유', 'ml', 8000, 1800],
      ['egg', '계란', '개', 7500, 30],
      ['rnoodle', '라멘면', 'g', 4000, 1000],
      ['broth', '돈코츠 육수', 'ml', 10000, 2000],
    ],
    menus: [
      ['sushi', '연어 초밥', 16000, [['rice', 200], ['salmon', 120], ['wasabi', 5]]],
      ['katsu', '돈카츠', 12000, [['loin', 180], ['panko', 40], ['oil', 80], ['egg', 1], ['rice', 200]]],
      ['ramen', '돈코츠 라멘', 11000, [['rnoodle', 150], ['broth', 400], ['loin', 50], ['egg', 1]]],
    ],
  },
  yangsik: {
    label: '양식',
    store: '예시 양식당',
    ings: [
      ['pasta', '파스타면', 'g', 4500, 1000],
      ['tomato', '토마토 소스', 'ml', 8000, 2000],
      ['cream', '생크림', 'ml', 6000, 1000],
      ['bacon', '베이컨', 'g', 15000, 1000],
      ['garlic', '마늘', 'g', 5500, 500],
      ['olive', '올리브유', 'ml', 15000, 1000],
      ['dough', '피자 도우', '개', 1500, 1],
      ['mozza', '모짜렐라', 'g', 18000, 1000],
      ['beef', '소고기 채끝', 'g', 60000, 1000],
    ],
    menus: [
      ['tpasta', '토마토 파스타', 14000, [['pasta', 120], ['tomato', 150], ['garlic', 10], ['olive', 15]]],
      ['cpasta', '크림 파스타', 15000, [['pasta', 120], ['cream', 150], ['bacon', 40], ['garlic', 10]]],
      ['pizza', '마르게리타 피자', 18000, [['dough', 1], ['tomato', 80], ['mozza', 150], ['olive', 10]]],
      ['steak', '채끝 스테이크', 32000, [['beef', 220], ['olive', 10], ['garlic', 10]]],
    ],
  },
  fastfood: {
    label: '패스트푸드',
    store: '예시 치킨·버거',
    ings: [
      ['chicken', '생닭', '마리', 6500, 1],
      ['flour', '튀김가루', 'g', 4000, 1000],
      ['oil', '식용유', 'ml', 8000, 1800],
      ['sauce', '양념 소스', 'g', 8000, 1000],
      ['mu', '치킨무', '개', 300, 1],
      ['box', '포장 박스', '개', 300, 1],
      ['bun', '버거 번', '개', 500, 1],
      ['patty', '소고기 패티', '개', 1200, 1],
      ['cheese', '슬라이스 치즈', '장', 200, 1],
      ['lettuce', '양상추', 'g', 4000, 1000],
      ['fries', '냉동 감자', 'g', 6000, 2000],
    ],
    menus: [
      ['fried', '후라이드 치킨', 20000, [['chicken', 1], ['flour', 150], ['oil', 300], ['mu', 1], ['box', 1]]],
      ['yangnyeom', '양념치킨', 21000, [['chicken', 1], ['flour', 150], ['oil', 300], ['sauce', 80], ['mu', 1], ['box', 1]]],
      ['burger', '치즈버거', 7500, [['bun', 1], ['patty', 1], ['cheese', 1], ['lettuce', 20]]],
      ['fries', '감자튀김', 3000, [['fries', 150], ['oil', 50]]],
    ],
  },
  pub: {
    label: '주점',
    store: '예시 호프',
    ings: [
      ['beer', '생맥주', 'ml', 2800, 1000],
      ['soju', '소주', '병', 1600, 1],
      ['wing', '닭날개', 'g', 9000, 1000],
      ['oil', '식용유', 'ml', 8000, 1800],
      ['tofu', '두부', '모', 1500, 1],
      ['kimchi', '김치', 'g', 30000, 10000],
      ['pork', '돼지고기', 'g', 13000, 1000],
      ['dsquid', '건오징어', 'g', 30000, 1000],
    ],
    menus: [
      ['beer500', '생맥주 500cc', 4500, [['beer', 500]]],
      ['soju', '소주', 5000, [['soju', 1]]],
      ['wing', '치킨윙', 15000, [['wing', 400], ['oil', 100]]],
      ['dubu', '두부김치', 15000, [['tofu', 1], ['kimchi', 150], ['pork', 120]]],
      ['ojing', '마른오징어', 12000, [['dsquid', 60]]],
    ],
  },
  asian: {
    label: '아시아 음식',
    store: '예시 쌀국수집',
    ings: [
      ['rnoodle', '쌀국수면', 'g', 6000, 1000],
      ['brisket', '소고기 양지', 'g', 35000, 1000],
      ['broth', '쌀국수 육수', 'ml', 6000, 2000],
      ['sprout', '숙주', 'g', 3000, 1000],
      ['cilantro', '고수', 'g', 10000, 500],
      ['lime', '라임', '개', 500, 1],
      ['ptsauce', '팟타이 소스', 'ml', 9000, 1000],
      ['shrimp', '새우', 'g', 25000, 1000],
      ['egg', '계란', '개', 7500, 30],
      ['rice', '쌀', 'g', 52000, 20000],
    ],
    menus: [
      ['pho', '소고기 쌀국수', 12000, [['rnoodle', 150], ['brisket', 60], ['broth', 450], ['sprout', 50], ['cilantro', 5], ['lime', 0.5]]],
      ['padthai', '팟타이', 13000, [['rnoodle', 150], ['shrimp', 80], ['ptsauce', 40], ['sprout', 40], ['egg', 1]]],
      ['nasi', '나시고랭', 12000, [['rice', 200], ['shrimp', 50], ['egg', 1], ['ptsauce', 20]]],
    ],
  },
  salad: {
    label: '샐러드',
    store: '예시 샐러드 가게',
    ings: [
      ['lettuce', '양상추', 'g', 4000, 1000],
      ['breast', '닭가슴살', 'g', 12000, 1000],
      ['salmon', '연어', 'g', 45000, 1000],
      ['ctomato', '방울토마토', 'g', 8000, 1000],
      ['dressing', '드레싱', 'ml', 7000, 1000],
      ['rice', '쌀', 'g', 52000, 20000],
      ['avocado', '아보카도', '개', 1800, 1],
      ['bowl', '샐러드 용기', '개', 350, 1],
    ],
    menus: [
      ['csalad', '닭가슴살 샐러드', 9500, [['lettuce', 120], ['breast', 100], ['ctomato', 60], ['dressing', 30], ['bowl', 1]]],
      ['ssalad', '연어 샐러드', 13500, [['lettuce', 120], ['salmon', 80], ['ctomato', 50], ['dressing', 30], ['bowl', 1]]],
      ['poke', '연어 포케', 14000, [['rice', 150], ['salmon', 90], ['avocado', 0.5], ['dressing', 25], ['bowl', 1]]],
    ],
  },
  dosirak: {
    label: '도시락',
    store: '예시 도시락 가게',
    ings: [
      ['rice', '쌀', 'g', 52000, 20000],
      ['pork', '돼지고기', 'g', 13000, 1000],
      ['beef', '소고기 불고기용', 'g', 30000, 1000],
      ['kimchi', '김치', 'g', 30000, 10000],
      ['egg', '계란', '개', 7500, 30],
      ['onion', '양파', 'g', 4500, 3000],
      ['side', '반찬 세트', '개', 600, 1],
      ['dbox', '도시락 용기', '개', 250, 1],
    ],
    menus: [
      ['jbox', '제육 도시락', 8500, [['rice', 220], ['pork', 120], ['onion', 40], ['kimchi', 40], ['side', 1], ['dbox', 1]]],
      ['bbox', '불고기 도시락', 9500, [['rice', 220], ['beef', 100], ['onion', 40], ['side', 1], ['dbox', 1]]],
      ['ebox', '계란말이 도시락', 7500, [['rice', 220], ['egg', 3], ['kimchi', 40], ['side', 1], ['dbox', 1]]],
    ],
  },
  etc: {
    label: '기타',
    store: '예시 가게',
    ings: [
      ['lettuce', '양상추', 'g', 4000, 1000],
      ['breast', '닭가슴살', 'g', 12000, 1000],
      ['ctomato', '방울토마토', 'g', 8000, 1000],
      ['dressing', '드레싱', 'ml', 7000, 1000],
      ['rice', '쌀', 'g', 52000, 20000],
      ['pork', '돼지고기', 'g', 13000, 1000],
      ['kimchi', '김치', 'g', 30000, 10000],
      ['egg', '계란', '개', 7500, 30],
      ['dbox', '도시락 용기', '개', 250, 1],
    ],
    menus: [
      ['salad', '닭가슴살 샐러드', 9500, [['lettuce', 120], ['breast', 100], ['ctomato', 60], ['dressing', 30]]],
      ['jbox', '제육 도시락', 8500, [['rice', 220], ['pork', 120], ['kimchi', 40], ['egg', 1], ['dbox', 1]]],
      ['ebox', '계란말이 도시락', 7500, [['rice', 220], ['egg', 3], ['kimchi', 40], ['dbox', 1]]],
    ],
  },
}

/** 고정비 자주 쓰는 항목 */
export const FIX_NAMES = ['월세', '관리비', '전기세', '가스비', '수도세', '통신비']

export const UNITS: string[] = ['g', 'ml', '개', '장', '모', '봉', '팩', '단', '병', '마리']

/** 예시 메뉴 임시 사진 */
export const SAMPLE_IMG: Record<string, string> = {
  kjj: '/img/menu-kjj.webp',
  jeyuk: '/img/menu-jeyuk.webp',
  djj: '/img/menu-djj.webp',
  egg: '/img/menu-egg.webp',
}
