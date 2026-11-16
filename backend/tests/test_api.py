"""API 전체 흐름 테스트 (메모리 SQLite, 개발용 로그인). 실행: pytest"""

import os
from datetime import date, timedelta

os.environ["DATABASE_URL"] = "sqlite:///:memory:"
os.environ["AUTH_MODE"] = "dev"
os.environ["LLM_API_KEY"] = ""
os.environ["EMBED_API_KEY"] = ""

from fastapi.testclient import TestClient  # noqa: E402
from sqlalchemy.pool import StaticPool  # noqa: E402

import app.database as dbm  # noqa: E402

# 메모리 DB를 모든 연결이 같이 쓰도록
dbm.engine = dbm.create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
dbm.SessionLocal.configure(bind=dbm.engine)

from main import app  # noqa: E402

c = TestClient(app)
T = date.today()
SAMPLE = "행복식자재마트\n2026-10-20 07:42\n양파 3kg 6,900\n대파 1kg 3,200\n돈육 앞다리 2kg 25,800\n깐마늘 500g 5,500\n합계 41,400"


def setup_module():
    with c:  # lifespan → init_db
        pass
    dbm.init_db()


def test_store_and_template():
    r = c.post("/api/stores", json={"name": "예은 한식당", "biz_type": "hansik", "close_time": "21:30"})
    assert r.status_code == 201, r.text
    assert r.json()["created"] == {"menus": 4, "ingredients": 10}
    assert len(c.get("/api/channels").json()["items"]) == 2
    s = c.put("/api/settings", json={"daily_goal": 400000, "off_weekdays": [0]}).json()
    assert s["daily_goal"] == 400000 and s["off_weekdays"] == [0]


def test_margin_and_menu_crud():
    m = c.get("/api/margin").json()
    kjj = next(x for x in m["items"] if x["name"] == "김치찌개")
    assert kjj["cost"] > 0 and kjj["margin_by_channel"][0]["margin"] == kjj["price"] - kjj["cost"]
    ings = c.get("/api/ingredients").json()["items"]
    r = c.post("/api/menus", json={"name": "테스트", "price": 5000, "recipe": [{"ingredient_id": ings[0]["id"], "qty": 100}]})
    assert r.status_code == 201
    mid = r.json()["id"]
    assert c.delete(f"/api/menus/{mid}").json() == {"ok": True}
    assert c.post("/api/menus", json={"name": "x", "price": 0}).status_code == 422


def _ids():
    menus = {m["name"]: m["id"] for m in c.get("/api/menus").json()["items"]}
    ch = {x["name"]: x["id"] for x in c.get("/api/channels").json()["items"]}
    ings = {g["name"]: g for g in c.get("/api/ingredients").json()["items"]}
    return menus, ch, ings


def test_sales_snapshot_keeps_past_profit():
    menus, ch, ings = _ids()
    past = (T - timedelta(days=5)).isoformat()
    r = c.put(f"/api/sales/{past}", json={"items": [{"menu_id": menus["김치찌개"], "channel_id": ch["홀"], "qty": 10}], "discount": 1000})
    assert r.status_code == 200, r.text
    before = r.json()["totals"]["profit"]
    # 오늘 김치값 2배 → 지난 판매 이익은 그대로
    kim = ings["김치"]
    up = c.put(f"/api/ingredients/{kim['id']}", json={"buy_price": kim["buy_price"] * 2}).json()
    assert any(x["name"] == "김치찌개" for x in up["changed_menus"])
    assert c.get(f"/api/sales/{past}").json()["totals"]["profit"] == before
    # 오늘 판매는 새 단가
    today = c.put(f"/api/sales/{T.isoformat()}", json={"items": [{"menu_id": menus["김치찌개"], "channel_id": ch["홀"], "qty": 10}]}).json()
    assert today["totals"]["profit"] < before + 1000
    hist = c.get(f"/api/ingredients/{kim['id']}/price-history").json()["items"]
    assert len(hist) == 2
    assert c.put(f"/api/sales/{(T + timedelta(days=1)).isoformat()}", json={"items": []}).status_code == 400


def test_receipt_parse_match_confirm_recompute():
    r = c.post("/api/receipts/parse", json={"text": SAMPLE})
    assert r.status_code == 200, r.text
    j = r.json()
    assert j["structured_by"] == "rule" and j["total"] == 41400
    byname = {i["name"]: i for i in j["items"]}
    assert byname["양파"]["candidates"][0]["name"] == "양파" and byname["양파"]["auto_match"]
    assert byname["돈육 앞다리"]["candidates"][0]["name"] == "돼지고기 앞다리"
    # 지난 날짜 영수증으로 양파 단가 갱신 → 그 뒤 판매 원가 재계산
    menus, ch, ings = _ids()
    d = (T - timedelta(days=3)).isoformat()
    c.put(f"/api/sales/{d}", json={"items": [{"menu_id": menus["제육볶음"], "channel_id": ch["홀"], "qty": 5}]})
    pdate = (T - timedelta(days=4)).isoformat()
    items = [
        {"name": "양파", "qty": 3000, "unit": "g", "amount": 9000, "action": "update", "ingredient_id": byname["양파"]["auto_match"]},
        {"name": "돈육 앞다리", "qty": 2000, "unit": "g", "amount": 25800, "action": "update", "ingredient_id": ings["돼지고기 앞다리"]["id"]},
        {"name": "애호박말고", "qty": 1, "unit": "개", "amount": 1000, "action": "skip"},
        {"name": "깐마늘", "qty": 500, "unit": "g", "amount": 5500, "action": "new"},
    ]
    r = c.post(
        "/api/receipts/confirm",
        json={"purchased_at": pdate, "vendor": "행복식자재마트", "total": 41400, "fields_total": 16, "fields_edited": 1, "items": items},
    )
    assert r.status_code == 200, r.text
    k = r.json()
    assert k["updated"] == 2 and k["added"] == 1
    assert k["past_changed"] and k["past_changed"]["days"] >= 1
    # 학습: 다음엔 '돈육 앞다리'가 바로 1.0
    again = c.post("/api/receipts/parse", json={"text": "돈육 앞다리 1kg 13,000"}).json()
    assert again["items"][0]["candidates"][0]["score"] == 1.0
    lst = c.get("/api/receipts").json()
    assert lst["items"][0]["count"] == 3 and lst["ocr_edit_rate"] > 0
    assert c.get(f"/api/receipts/{k['receipt_id']}").json()["items"][0]["name"] == "양파"
    # 단위가 다르면 409
    bad = c.post(
        "/api/receipts/confirm",
        json={
            "purchased_at": pdate,
            "items": [{"name": "양파", "qty": 1, "unit": "개", "amount": 100, "action": "update", "ingredient_id": byname["양파"]["auto_match"]}],
        },
    )
    assert bad.status_code == 409 and bad.json()["error"]["code"] == "UNIT_MISMATCH"


def test_views():
    c.post("/api/fixed-costs", json={"name": "월세", "amount": 1500000, "paid_on": T.replace(day=1).isoformat()})
    d = c.get("/api/dashboard").json()
    assert d["month"]["revenue"] > 0 and len(d["week"]) == 7
    led = c.get(f"/api/ledger?month={T.strftime('%Y-%m')}").json()
    assert len(led["days"]) >= 28 and led["transactions"]
    for p in ("d", "w", "m"):
        mx = c.get(f"/api/metrics?period={p}").json()
        assert "cost_ratio" in mx and mx["series"]
    s = c.get("/api/summary").json()
    assert s["source"] == "rule" and s["text"]
    assert c.put(f"/api/off-days/{T.isoformat()}", json={"status": "off"}).json() == {"ok": True}


def test_errors_and_isolation():
    r = c.get("/api/menus/99999")
    assert r.status_code in (404, 405)
    other = {"Authorization": "Bearer dev:someone-else"}
    assert c.get("/api/menus", headers=other).json()["error"]["code"] == "NO_STORE"
    assert c.get("/api/menus", headers={**other, "X-Store-Id": "1"}).status_code == 403


def test_import_and_delete_me():
    h = {"Authorization": "Bearer dev:newbie"}
    body = {
        "store": {"name": "옮긴 가게", "biz_type": "cafe"},
        "channels": [{"key": "hall", "name": "홀"}, {"key": "takeout", "name": "포장", "fixed_fee": 300}],
        "ingredients": [{"key": "bean", "name": "원두", "unit": "g", "buy_price": 28000, "buy_qty": 1000}],
        "menus": [{"key": "ame", "name": "아메리카노", "price": 4000, "recipe": [{"ingredient": "bean", "qty": 20}]}],
        "sales": [{"date": (T - timedelta(days=1)).isoformat(), "menu": "ame", "channel": "hall", "qty": 30}],
    }
    r = c.post("/api/import", json=body, headers=h)
    assert r.status_code == 201, r.text
    assert r.json()["imported"]["sales_days"] == 1
    assert c.get("/api/margin", headers=h).json()["items"][0]["cost"] == 560
    assert c.delete("/api/me", headers=h).json() == {"ok": True}
    assert c.get("/api/menus", headers=h).json()["error"]["code"] == "NO_STORE"


def test_state_and_past_price_change():
    menus, ch, _ = _ids()
    mid, hall = menus["김치찌개"], ch["홀"]
    d = (T - timedelta(days=3)).isoformat()
    assert c.put(f"/api/sales/{d}", json={"items": [{"menu_id": mid, "channel_id": hall, "qty": 2}]}).status_code == 200
    st = c.get("/api/state").json()
    assert st["sales"][d][str(mid)][str(hall)] == 2
    assert {"settings", "channels", "ingredients", "menus", "fixed_costs", "receipts"} <= st.keys()
    menu = next(m for m in st["menus"] if m["id"] == mid)
    assert menu["history"] and menu["recipe"]
    # 지난 날짜부터 판매가를 바꾸면 그날 이후 판매 스냅샷도 바뀜
    vf = (T - timedelta(days=5)).isoformat()
    r = c.put(f"/api/menus/{mid}", json={"price": 12345, "valid_from": vf})
    assert r.status_code == 200 and r.json()["price"] == 12345
    day = c.get(f"/api/sales/{d}").json()
    assert next(i for i in day["items"] if i["menu_id"] == mid)["unit_price"] == 12345
