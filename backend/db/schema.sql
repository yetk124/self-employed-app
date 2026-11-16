-- domain 테이블 (scripts/gen_schema.py 로 생성, 직접 고치지 말고 models.py 를 고치세요)
-- Supabase → SQL Editor 에서 실행. 백엔드는 service 연결(DATABASE_URL)로만 접근하므로
-- 모든 테이블에 RLS 를 켜 두면 프론트에서 anon 키로 직접 읽는 것을 막을 수 있어요.


CREATE TABLE IF NOT EXISTS events (
	id SERIAL NOT NULL, 
	user_id VARCHAR(64) NOT NULL, 
	store_id INTEGER, 
	name VARCHAR(40) NOT NULL, 
	props JSON NOT NULL, 
	at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS ix_events_user_id ON events (user_id);

CREATE TABLE IF NOT EXISTS ingredient_dictionary (
	id SERIAL NOT NULL, 
	name VARCHAR(40) NOT NULL, 
	aliases JSON NOT NULL, 
	default_unit VARCHAR(4) NOT NULL, 
	embedding JSON, 
	embedding_model VARCHAR(60), 
	PRIMARY KEY (id), 
	UNIQUE (name)
);

CREATE TABLE IF NOT EXISTS stores (
	id SERIAL NOT NULL, 
	owner_id VARCHAR(64) NOT NULL, 
	name VARCHAR(40) NOT NULL, 
	biz_type VARCHAR(20) NOT NULL, 
	biz_sub VARCHAR(20), 
	open_time VARCHAR(5) NOT NULL, 
	close_time VARCHAR(5) NOT NULL, 
	daily_goal INTEGER, 
	tables INTEGER, 
	off_weekdays JSON NOT NULL, 
	notify BOOLEAN NOT NULL, 
	last_notified DATE, 
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS ix_stores_owner_id ON stores (owner_id);

CREATE TABLE IF NOT EXISTS channels (
	id SERIAL NOT NULL, 
	store_id INTEGER NOT NULL, 
	name VARCHAR(20) NOT NULL, 
	fee_rate FLOAT NOT NULL, 
	fixed_fee INTEGER NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(store_id) REFERENCES stores (id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS ix_channels_store_id ON channels (store_id);

CREATE TABLE IF NOT EXISTS daily_adjustments (
	id SERIAL NOT NULL, 
	store_id INTEGER NOT NULL, 
	date DATE NOT NULL, 
	discount INTEGER NOT NULL, 
	refund INTEGER NOT NULL, 
	PRIMARY KEY (id), 
	UNIQUE (store_id, date), 
	FOREIGN KEY(store_id) REFERENCES stores (id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS ix_daily_adjustments_store_id ON daily_adjustments (store_id);

CREATE TABLE IF NOT EXISTS daily_summaries (
	id SERIAL NOT NULL, 
	store_id INTEGER NOT NULL, 
	date DATE NOT NULL, 
	text TEXT NOT NULL, 
	facts JSON NOT NULL, 
	source VARCHAR(6) NOT NULL, 
	model VARCHAR(60), 
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	PRIMARY KEY (id), 
	UNIQUE (store_id, date), 
	FOREIGN KEY(store_id) REFERENCES stores (id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS ix_daily_summaries_store_id ON daily_summaries (store_id);

CREATE TABLE IF NOT EXISTS fixed_costs (
	id SERIAL NOT NULL, 
	store_id INTEGER NOT NULL, 
	name VARCHAR(30) NOT NULL, 
	amount INTEGER NOT NULL, 
	paid_on DATE NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(store_id) REFERENCES stores (id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS ix_fixed_costs_store_id ON fixed_costs (store_id);

CREATE TABLE IF NOT EXISTS ingredients (
	id SERIAL NOT NULL, 
	store_id INTEGER NOT NULL, 
	name VARCHAR(40) NOT NULL, 
	unit VARCHAR(4) NOT NULL, 
	buy_price INTEGER NOT NULL, 
	buy_qty FLOAT NOT NULL, 
	image_url TEXT, 
	embedding JSON, 
	embedding_model VARCHAR(60), 
	PRIMARY KEY (id), 
	FOREIGN KEY(store_id) REFERENCES stores (id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS ix_ingredients_store_id ON ingredients (store_id);

CREATE TABLE IF NOT EXISTS menus (
	id SERIAL NOT NULL, 
	store_id INTEGER NOT NULL, 
	name VARCHAR(40) NOT NULL, 
	price INTEGER NOT NULL, 
	image_url TEXT, 
	archived BOOLEAN NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(store_id) REFERENCES stores (id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS ix_menus_store_id ON menus (store_id);

CREATE TABLE IF NOT EXISTS off_days (
	id SERIAL NOT NULL, 
	store_id INTEGER NOT NULL, 
	date DATE NOT NULL, 
	status VARCHAR(4) NOT NULL, 
	PRIMARY KEY (id), 
	UNIQUE (store_id, date), 
	FOREIGN KEY(store_id) REFERENCES stores (id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS ix_off_days_store_id ON off_days (store_id);

CREATE TABLE IF NOT EXISTS push_subscriptions (
	id SERIAL NOT NULL, 
	user_id VARCHAR(64) NOT NULL, 
	store_id INTEGER, 
	endpoint TEXT NOT NULL, 
	p256dh TEXT NOT NULL, 
	auth TEXT NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(store_id) REFERENCES stores (id) ON DELETE CASCADE, 
	UNIQUE (endpoint)
);

CREATE INDEX IF NOT EXISTS ix_push_subscriptions_user_id ON push_subscriptions (user_id);

CREATE TABLE IF NOT EXISTS receipts (
	id SERIAL NOT NULL, 
	store_id INTEGER NOT NULL, 
	purchased_at DATE NOT NULL, 
	vendor VARCHAR(60) NOT NULL, 
	total INTEGER NOT NULL, 
	image_path TEXT, 
	raw_text TEXT, 
	ocr_source VARCHAR(10) NOT NULL, 
	fields_total INTEGER NOT NULL, 
	fields_edited INTEGER NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(store_id) REFERENCES stores (id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS ix_receipts_store_id ON receipts (store_id);

CREATE TABLE IF NOT EXISTS ingredient_aliases (
	id SERIAL NOT NULL, 
	store_id INTEGER NOT NULL, 
	alias VARCHAR(60) NOT NULL, 
	ingredient_id INTEGER NOT NULL, 
	PRIMARY KEY (id), 
	UNIQUE (store_id, alias), 
	FOREIGN KEY(store_id) REFERENCES stores (id) ON DELETE CASCADE, 
	FOREIGN KEY(ingredient_id) REFERENCES ingredients (id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS ix_ingredient_aliases_store_id ON ingredient_aliases (store_id);

CREATE TABLE IF NOT EXISTS ingredient_price_history (
	id SERIAL NOT NULL, 
	ingredient_id INTEGER NOT NULL, 
	buy_price INTEGER NOT NULL, 
	buy_qty FLOAT NOT NULL, 
	valid_from DATE NOT NULL, 
	source VARCHAR(10) NOT NULL, 
	receipt_id INTEGER, 
	PRIMARY KEY (id), 
	UNIQUE (ingredient_id, valid_from), 
	FOREIGN KEY(ingredient_id) REFERENCES ingredients (id) ON DELETE CASCADE, 
	FOREIGN KEY(receipt_id) REFERENCES receipts (id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS ix_ingredient_price_history_ingredient_id ON ingredient_price_history (ingredient_id);

CREATE TABLE IF NOT EXISTS menu_price_history (
	id SERIAL NOT NULL, 
	menu_id INTEGER NOT NULL, 
	price INTEGER NOT NULL, 
	recipe JSON NOT NULL, 
	valid_from DATE NOT NULL, 
	PRIMARY KEY (id), 
	UNIQUE (menu_id, valid_from), 
	FOREIGN KEY(menu_id) REFERENCES menus (id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS ix_menu_price_history_menu_id ON menu_price_history (menu_id);

CREATE TABLE IF NOT EXISTS receipt_items (
	id SERIAL NOT NULL, 
	receipt_id INTEGER NOT NULL, 
	name VARCHAR(60) NOT NULL, 
	qty FLOAT NOT NULL, 
	unit VARCHAR(4) NOT NULL, 
	amount INTEGER NOT NULL, 
	action VARCHAR(6) NOT NULL, 
	ingredient_id INTEGER, 
	PRIMARY KEY (id), 
	FOREIGN KEY(receipt_id) REFERENCES receipts (id) ON DELETE CASCADE, 
	FOREIGN KEY(ingredient_id) REFERENCES ingredients (id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS ix_receipt_items_receipt_id ON receipt_items (receipt_id);

CREATE TABLE IF NOT EXISTS recipe_items (
	id SERIAL NOT NULL, 
	menu_id INTEGER NOT NULL, 
	ingredient_id INTEGER NOT NULL, 
	qty FLOAT NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(menu_id) REFERENCES menus (id) ON DELETE CASCADE, 
	FOREIGN KEY(ingredient_id) REFERENCES ingredients (id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS ix_recipe_items_menu_id ON recipe_items (menu_id);

CREATE TABLE IF NOT EXISTS sales (
	id SERIAL NOT NULL, 
	store_id INTEGER NOT NULL, 
	date DATE NOT NULL, 
	menu_id INTEGER NOT NULL, 
	channel_id INTEGER NOT NULL, 
	qty INTEGER NOT NULL, 
	unit_price INTEGER NOT NULL, 
	unit_cost FLOAT NOT NULL, 
	fee FLOAT NOT NULL, 
	PRIMARY KEY (id), 
	UNIQUE (store_id, date, menu_id, channel_id), 
	FOREIGN KEY(store_id) REFERENCES stores (id) ON DELETE CASCADE, 
	FOREIGN KEY(menu_id) REFERENCES menus (id) ON DELETE CASCADE, 
	FOREIGN KEY(channel_id) REFERENCES channels (id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS ix_sales_date ON sales (date);

CREATE INDEX IF NOT EXISTS ix_sales_store_id ON sales (store_id);


-- RLS 켜기 (anon 키로 직접 접근 차단)

alter table events enable row level security;

alter table ingredient_dictionary enable row level security;

alter table stores enable row level security;

alter table channels enable row level security;

alter table daily_adjustments enable row level security;

alter table daily_summaries enable row level security;

alter table fixed_costs enable row level security;

alter table ingredients enable row level security;

alter table menus enable row level security;

alter table off_days enable row level security;

alter table push_subscriptions enable row level security;

alter table receipts enable row level security;

alter table ingredient_aliases enable row level security;

alter table ingredient_price_history enable row level security;

alter table menu_price_history enable row level security;

alter table receipt_items enable row level security;

alter table recipe_items enable row level security;

alter table sales enable row level security;
