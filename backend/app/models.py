"""DB 테이블 (SQLAlchemy). 모든 데이터는 store_id 로 가게별로 나뉘어요.

가격 이력 규칙
 - ingredient_price_history / menu_price_history 에 valid_from(적용 시작일)과 함께 쌓아요.
 - sales 에는 판매한 날의 판매가·원가·수수료를 스냅샷으로 저장해요 → 단가가 바뀌어도 지난 이익은 그대로.
"""

from datetime import date, datetime

from sqlalchemy import JSON, Boolean, Date, DateTime, Float, ForeignKey, Integer, String, Text, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import Base


class Store(Base):
    __tablename__ = "stores"
    id: Mapped[int] = mapped_column(primary_key=True)
    owner_id: Mapped[str] = mapped_column(String(64), index=True)  # Supabase auth 사용자 id
    name: Mapped[str] = mapped_column(String(40))
    biz_type: Mapped[str] = mapped_column(String(20), default="etc")
    biz_sub: Mapped[str | None] = mapped_column(String(20))
    open_time: Mapped[str] = mapped_column(String(5), default="11:00")
    close_time: Mapped[str] = mapped_column(String(5), default="21:30")
    daily_goal: Mapped[int | None] = mapped_column(Integer)
    tables: Mapped[int | None] = mapped_column(Integer)
    off_weekdays: Mapped[list[int]] = mapped_column(JSON, default=list)  # 0=일
    notify: Mapped[bool] = mapped_column(Boolean, default=False)
    last_notified: Mapped[date | None] = mapped_column(Date)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class Channel(Base):
    __tablename__ = "channels"
    id: Mapped[int] = mapped_column(primary_key=True)
    store_id: Mapped[int] = mapped_column(ForeignKey("stores.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(String(20))
    fee_rate: Mapped[float] = mapped_column(Float, default=0)  # %
    fixed_fee: Mapped[int] = mapped_column(Integer, default=0)  # 개당 원 (포장 용기 등)


class Ingredient(Base):
    __tablename__ = "ingredients"
    id: Mapped[int] = mapped_column(primary_key=True)
    store_id: Mapped[int] = mapped_column(ForeignKey("stores.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(String(40))
    unit: Mapped[str] = mapped_column(String(4))  # g · ml · 개 …
    buy_price: Mapped[int] = mapped_column(Integer)  # 지금(오늘 기준) 단가
    buy_qty: Mapped[float] = mapped_column(Float)
    image_url: Mapped[str | None] = mapped_column(Text)
    embedding: Mapped[list[float] | None] = mapped_column(JSON)  # RAG 검색용 벡터 (캐시)
    embedding_model: Mapped[str | None] = mapped_column(String(60))
    history: Mapped[list["IngredientPriceHistory"]] = relationship(cascade="all, delete-orphan", order_by="IngredientPriceHistory.valid_from")


class IngredientPriceHistory(Base):
    __tablename__ = "ingredient_price_history"
    id: Mapped[int] = mapped_column(primary_key=True)
    ingredient_id: Mapped[int] = mapped_column(ForeignKey("ingredients.id", ondelete="CASCADE"), index=True)
    buy_price: Mapped[int] = mapped_column(Integer)
    buy_qty: Mapped[float] = mapped_column(Float)
    valid_from: Mapped[date] = mapped_column(Date)
    source: Mapped[str] = mapped_column(String(10), default="manual")  # manual · receipt · import
    receipt_id: Mapped[int | None] = mapped_column(ForeignKey("receipts.id", ondelete="SET NULL"))
    __table_args__ = (UniqueConstraint("ingredient_id", "valid_from"),)


class IngredientAlias(Base):
    """사장님이 영수증에서 고른 연결을 기억 (예: '돈육 앞다리' → 돼지고기 앞다리). 쓸수록 매칭이 정확해져요."""

    __tablename__ = "ingredient_aliases"
    id: Mapped[int] = mapped_column(primary_key=True)
    store_id: Mapped[int] = mapped_column(ForeignKey("stores.id", ondelete="CASCADE"), index=True)
    alias: Mapped[str] = mapped_column(String(60))
    ingredient_id: Mapped[int] = mapped_column(ForeignKey("ingredients.id", ondelete="CASCADE"))
    __table_args__ = (UniqueConstraint("store_id", "alias"),)


class Menu(Base):
    __tablename__ = "menus"
    id: Mapped[int] = mapped_column(primary_key=True)
    store_id: Mapped[int] = mapped_column(ForeignKey("stores.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(String(40))
    price: Mapped[int] = mapped_column(Integer)
    image_url: Mapped[str | None] = mapped_column(Text)
    # 판매 기록이 있는 메뉴를 지우면 실제로 지우지 않고 숨김 (지난 장부가 사라지지 않게)
    archived: Mapped[bool] = mapped_column(Boolean, default=False)
    recipe: Mapped[list["RecipeItem"]] = relationship(cascade="all, delete-orphan")
    history: Mapped[list["MenuPriceHistory"]] = relationship(cascade="all, delete-orphan", order_by="MenuPriceHistory.valid_from")


class RecipeItem(Base):
    __tablename__ = "recipe_items"
    id: Mapped[int] = mapped_column(primary_key=True)
    menu_id: Mapped[int] = mapped_column(ForeignKey("menus.id", ondelete="CASCADE"), index=True)
    ingredient_id: Mapped[int] = mapped_column(ForeignKey("ingredients.id", ondelete="RESTRICT"))
    qty: Mapped[float] = mapped_column(Float)


class MenuPriceHistory(Base):
    __tablename__ = "menu_price_history"
    id: Mapped[int] = mapped_column(primary_key=True)
    menu_id: Mapped[int] = mapped_column(ForeignKey("menus.id", ondelete="CASCADE"), index=True)
    price: Mapped[int] = mapped_column(Integer)
    recipe: Mapped[list[dict]] = mapped_column(JSON)  # [{"ingredient_id": 1, "qty": 200}]
    valid_from: Mapped[date] = mapped_column(Date)
    __table_args__ = (UniqueConstraint("menu_id", "valid_from"),)


class Sale(Base):
    __tablename__ = "sales"
    id: Mapped[int] = mapped_column(primary_key=True)
    store_id: Mapped[int] = mapped_column(ForeignKey("stores.id", ondelete="CASCADE"), index=True)
    date: Mapped[date] = mapped_column(Date, index=True)
    menu_id: Mapped[int] = mapped_column(ForeignKey("menus.id", ondelete="CASCADE"))
    channel_id: Mapped[int] = mapped_column(ForeignKey("channels.id", ondelete="CASCADE"))
    qty: Mapped[int] = mapped_column(Integer)
    # 스냅샷 (개당)
    unit_price: Mapped[int] = mapped_column(Integer)
    unit_cost: Mapped[float] = mapped_column(Float)
    fee: Mapped[float] = mapped_column(Float)
    __table_args__ = (UniqueConstraint("store_id", "date", "menu_id", "channel_id"),)


class DailyAdjustment(Base):
    __tablename__ = "daily_adjustments"
    id: Mapped[int] = mapped_column(primary_key=True)
    store_id: Mapped[int] = mapped_column(ForeignKey("stores.id", ondelete="CASCADE"), index=True)
    date: Mapped[date] = mapped_column(Date)
    discount: Mapped[int] = mapped_column(Integer, default=0)
    refund: Mapped[int] = mapped_column(Integer, default=0)
    __table_args__ = (UniqueConstraint("store_id", "date"),)


class OffDay(Base):
    """임시 휴무(off) · 정기 휴무 요일인데 영업(open)"""

    __tablename__ = "off_days"
    id: Mapped[int] = mapped_column(primary_key=True)
    store_id: Mapped[int] = mapped_column(ForeignKey("stores.id", ondelete="CASCADE"), index=True)
    date: Mapped[date] = mapped_column(Date)
    status: Mapped[str] = mapped_column(String(4))
    __table_args__ = (UniqueConstraint("store_id", "date"),)


class FixedCost(Base):
    __tablename__ = "fixed_costs"
    id: Mapped[int] = mapped_column(primary_key=True)
    store_id: Mapped[int] = mapped_column(ForeignKey("stores.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(String(30))
    amount: Mapped[int] = mapped_column(Integer)
    paid_on: Mapped[date] = mapped_column(Date)


class Receipt(Base):
    __tablename__ = "receipts"
    id: Mapped[int] = mapped_column(primary_key=True)
    store_id: Mapped[int] = mapped_column(ForeignKey("stores.id", ondelete="CASCADE"), index=True)
    purchased_at: Mapped[date] = mapped_column(Date)
    vendor: Mapped[str] = mapped_column(String(60), default="")
    total: Mapped[int] = mapped_column(Integer, default=0)
    image_path: Mapped[str | None] = mapped_column(Text)
    raw_text: Mapped[str | None] = mapped_column(Text)
    ocr_source: Mapped[str] = mapped_column(String(10), default="text")  # server · text
    fields_total: Mapped[int] = mapped_column(Integer, default=0)  # OCR 정확도 지표
    fields_edited: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    items: Mapped[list["ReceiptItem"]] = relationship(cascade="all, delete-orphan")


class ReceiptItem(Base):
    __tablename__ = "receipt_items"
    id: Mapped[int] = mapped_column(primary_key=True)
    receipt_id: Mapped[int] = mapped_column(ForeignKey("receipts.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(String(60))
    qty: Mapped[float] = mapped_column(Float)
    unit: Mapped[str] = mapped_column(String(4))
    amount: Mapped[int] = mapped_column(Integer)
    action: Mapped[str] = mapped_column(String(6))  # update · new · skip
    ingredient_id: Mapped[int | None] = mapped_column(ForeignKey("ingredients.id", ondelete="SET NULL"))


class IngredientDictionary(Base):
    """RAG 용 표준 식자재 사전 (모든 가게 공용). scripts/seed_dictionary.py 로 채워요."""

    __tablename__ = "ingredient_dictionary"
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(40), unique=True)
    aliases: Mapped[list[str]] = mapped_column(JSON, default=list)
    default_unit: Mapped[str] = mapped_column(String(4), default="g")
    embedding: Mapped[list[float] | None] = mapped_column(JSON)
    embedding_model: Mapped[str | None] = mapped_column(String(60))


class DailySummary(Base):
    """AI 요약 캐시 (하루 1번 생성)"""

    __tablename__ = "daily_summaries"
    id: Mapped[int] = mapped_column(primary_key=True)
    store_id: Mapped[int] = mapped_column(ForeignKey("stores.id", ondelete="CASCADE"), index=True)
    date: Mapped[date] = mapped_column(Date)
    text: Mapped[str] = mapped_column(Text)
    facts: Mapped[dict] = mapped_column(JSON, default=dict)
    source: Mapped[str] = mapped_column(String(6))  # llm · rule
    model: Mapped[str | None] = mapped_column(String(60))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    __table_args__ = (UniqueConstraint("store_id", "date"),)


class PushSubscription(Base):
    __tablename__ = "push_subscriptions"
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[str] = mapped_column(String(64), index=True)
    store_id: Mapped[int | None] = mapped_column(ForeignKey("stores.id", ondelete="CASCADE"))
    endpoint: Mapped[str] = mapped_column(Text, unique=True)
    p256dh: Mapped[str] = mapped_column(Text)
    auth: Mapped[str] = mapped_column(Text)


class Event(Base):
    """사용 기록 (성공 지표 측정: 첫 마진 확인률, 4주 유지율 …)"""

    __tablename__ = "events"
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[str] = mapped_column(String(64), index=True)
    store_id: Mapped[int | None] = mapped_column(Integer)
    name: Mapped[str] = mapped_column(String(40))
    props: Mapped[dict] = mapped_column(JSON, default=dict)
    at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
