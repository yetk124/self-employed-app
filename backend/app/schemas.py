"""요청 body 모양 (Pydantic). 이름은 명세서대로 snake_case, 돈은 원 정수, 날짜는 YYYY-MM-DD."""

from datetime import date
from typing import Literal

from pydantic import BaseModel, Field

Unit = Literal["g", "ml", "개", "장", "모", "봉", "팩", "단", "병", "마리"]


class StoreCreate(BaseModel):
    name: str = Field(min_length=1, max_length=40)
    biz_type: str = "etc"
    biz_sub: str | None = None
    open_time: str = "11:00"
    close_time: str = "21:30"
    use_template: bool = True


class SettingsUpdate(BaseModel):
    """보낸 칸만 바뀌어요"""

    name: str | None = Field(default=None, max_length=40)
    biz_type: str | None = None
    biz_sub: str | None = None
    open_time: str | None = None
    close_time: str | None = None
    daily_goal: int | None = Field(default=None, ge=0)
    tables: int | None = Field(default=None, ge=0)
    off_weekdays: list[int] | None = None
    notify: bool | None = None


class ChannelIn(BaseModel):
    name: str = Field(min_length=1, max_length=20)
    fee_rate: float = Field(default=0, ge=0, le=100)
    fixed_fee: int = Field(default=0, ge=0)


class ChannelUpdate(BaseModel):
    name: str | None = Field(default=None, max_length=20)
    fee_rate: float | None = Field(default=None, ge=0, le=100)
    fixed_fee: int | None = Field(default=None, ge=0)


class IngredientIn(BaseModel):
    name: str = Field(min_length=1, max_length=40)
    unit: Unit
    buy_price: int = Field(gt=0)
    buy_qty: float = Field(gt=0)
    image_url: str | None = None


class IngredientUpdate(BaseModel):
    name: str | None = Field(default=None, max_length=40)
    unit: Unit | None = None
    buy_price: int | None = Field(default=None, gt=0)
    buy_qty: float | None = Field(default=None, gt=0)
    image_url: str | None = None
    valid_from: date | None = None  # 비우면 오늘부터 적용


class RecipeIn(BaseModel):
    ingredient_id: int
    qty: float = Field(gt=0)


class MenuIn(BaseModel):
    name: str = Field(min_length=1, max_length=40)
    price: int = Field(gt=0)
    image_url: str | None = None
    recipe: list[RecipeIn] = []


class MenuUpdate(BaseModel):
    name: str | None = Field(default=None, max_length=40)
    price: int | None = Field(default=None, gt=0)
    image_url: str | None = None
    recipe: list[RecipeIn] | None = None
    valid_from: date | None = None  # 비우면 오늘부터 적용 (지난 날짜면 그날부터 장부를 다시 계산)


class SalesItem(BaseModel):
    menu_id: int
    channel_id: int
    qty: int = Field(ge=0)


class SalesPut(BaseModel):
    items: list[SalesItem]
    discount: int = Field(default=0, ge=0)
    refund: int = Field(default=0, ge=0)


class AdjustPut(BaseModel):
    discount: int = Field(default=0, ge=0)
    refund: int = Field(default=0, ge=0)


class OffDayPut(BaseModel):
    status: Literal["off", "open"] | None


class FixedIn(BaseModel):
    name: str = Field(min_length=1, max_length=30)
    amount: int = Field(gt=0)
    paid_on: date


class FixedUpdate(BaseModel):
    name: str | None = Field(default=None, max_length=30)
    amount: int | None = Field(default=None, gt=0)
    paid_on: date | None = None


class ParseText(BaseModel):
    text: str = Field(min_length=1, max_length=20000)


class ConfirmItem(BaseModel):
    name: str
    qty: float = Field(ge=0)
    unit: str
    amount: int = Field(ge=0)
    action: Literal["update", "new", "skip"]
    ingredient_id: int | str | None = None


class ReceiptConfirm(BaseModel):
    purchased_at: date
    vendor: str = ""
    total: int = 0
    ocr_source: str = "text"
    image_path: str | None = None
    raw_text: str | None = None
    fields_total: int = 0
    fields_edited: int = 0
    items: list[ConfirmItem]


class PushSub(BaseModel):
    endpoint: str
    keys: dict[str, str]


class EventIn(BaseModel):
    name: str = Field(min_length=1, max_length=40)
    props: dict = {}


# ---------- 비회원 기록 옮기기 (POST /api/import) ----------
# 프론트 기기 저장소의 key(문자열 id)를 그대로 보내면 서버가 새 숫자 id 로 바꿔 연결해요.
class ImportIngredient(BaseModel):
    key: str
    name: str
    unit: str
    buy_price: int
    buy_qty: float
    history: list[dict] = []  # [{"from": "2026-11-01", "buy_price": 4500, "buy_qty": 3000}]


class ImportMenu(BaseModel):
    key: str
    name: str
    price: int
    recipe: list[dict] = []  # [{"ingredient": "<key>", "qty": 200}]
    history: list[dict] = []  # [{"from": ..., "price": ..., "recipe": [...]}]


class ImportChannel(BaseModel):
    key: str
    name: str
    fee_rate: float = 0
    fixed_fee: int = 0


class ImportSale(BaseModel):
    date: date
    menu: str
    channel: str
    qty: int


class ImportPayload(BaseModel):
    store: StoreCreate
    channels: list[ImportChannel] = []
    ingredients: list[ImportIngredient] = []
    menus: list[ImportMenu] = []
    sales: list[ImportSale] = []
    adjustments: list[dict] = []  # [{"date", "discount", "refund"}]
    off_days: list[dict] = []  # [{"date", "status"}]
    fixed_costs: list[FixedIn] = []
    daily_goal: int | None = None
    tables: int | None = None
    off_weekdays: list[int] = []
