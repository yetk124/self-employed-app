/** 사진 줄이기 (메뉴·식자재 썸네일, 영수증 업로드) */

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((res, rej) => {
    const fr = new FileReader()
    fr.onerror = rej
    fr.onload = () => {
      const im = new Image()
      im.onerror = rej
      im.onload = () => res(im)
      im.src = String(fr.result)
    }
    fr.readAsDataURL(file)
  })
}

/** 240×240 정사각 썸네일 (data URL). 서버가 생기면 Supabase Storage에 올리고 주소만 저장 */
export async function readPhoto(file: File) {
  const im = await loadImage(file)
  const S2 = 240,
    c = document.createElement('canvas')
  c.width = c.height = S2
  const k = Math.max(S2 / im.width, S2 / im.height),
    w = im.width * k,
    h = im.height * k
  c.getContext('2d')!.drawImage(im, (S2 - w) / 2, (S2 - h) / 2, w, h)
  return c.toDataURL('image/jpeg', 0.8)
}

/** 영수증 사진: 긴 변 1600px 로 줄여서 서버로 보냄 */
export async function shrink(file: File): Promise<{ blob: Blob; url: string }> {
  const im = await loadImage(file)
  const k = Math.min(1, 1600 / Math.max(im.width, im.height)),
    c = document.createElement('canvas')
  c.width = im.width * k
  c.height = im.height * k
  c.getContext('2d')!.drawImage(im, 0, 0, c.width, c.height)
  return new Promise((res, rej) =>
    c.toBlob((b) => (b ? res({ blob: b, url: c.toDataURL('image/jpeg', 0.7) }) : rej(new Error('사진을 줄이지 못했어요.'))), 'image/jpeg', 0.85),
  )
}
