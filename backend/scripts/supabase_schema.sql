-- CareerGuide AI on Supabase: every table the app writes to.
--
-- Generated from the models, not typed by hand:
--     cd backend && ./.venv/Scripts/python.exe scripts/make_supabase_schema.py
-- Regenerate it after changing app/models.py.
--
-- Paste this whole file into Supabase Dashboard -> SQL Editor -> New query -> Run.
-- It creates the schema only. The career, scholarship, resource and institution
-- reference content is inserted by application code, because those rows carry
-- Python-side column defaults and JSON lists:
--     ./.venv/Scripts/python.exe scripts/db_init.py
--
-- The app connects with the pooler URI from Project Settings -> Database ->
-- Connection string -> URI, in this shape (sslmode=require is mandatory):
--     postgresql://postgres.PROJECT-REF:DB-PASSWORD@aws-0-REGION.pooler.supabase.com:6543/postgres?sslmode=require
-- The SQL editor runs as the same role the app logs in as, so the tables it creates
-- here are already owned by it and need no GRANT lines.

CREATE TABLE careers (
	id SERIAL NOT NULL, 
	slug VARCHAR(96) NOT NULL, 
	title VARCHAR(120) NOT NULL, 
	category VARCHAR(64) NOT NULL, 
	summary TEXT NOT NULL, 
	typical_activities JSONB NOT NULL, 
	useful_skills JSONB NOT NULL, 
	school_subjects JSONB NOT NULL, 
	education_pathways JSONB NOT NULL, 
	entry_requirements JSONB NOT NULL, 
	preparation_stages JSONB NOT NULL, 
	typical_day TEXT, 
	costs_and_alternatives TEXT, 
	benefits JSONB NOT NULL, 
	challenges JSONB NOT NULL, 
	explore_activities JSONB NOT NULL, 
	official_links JSONB NOT NULL, 
	related_slugs JSONB NOT NULL, 
	interest_themes JSONB NOT NULL, 
	min_class INTEGER NOT NULL, 
	needs_verification BOOLEAN NOT NULL, 
	created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL, 
	PRIMARY KEY (id)
);

CREATE INDEX ix_careers_category ON careers (category);

CREATE UNIQUE INDEX ix_careers_slug ON careers (slug);

CREATE TABLE institutions (
	id SERIAL NOT NULL, 
	name VARCHAR(160) NOT NULL, 
	city VARCHAR(80) NOT NULL, 
	state VARCHAR(60) NOT NULL, 
	institution_type VARCHAR(24) NOT NULL, 
	mode VARCHAR(16) NOT NULL, 
	education_level VARCHAR(32) NOT NULL, 
	career_areas JSONB NOT NULL, 
	courses JSONB NOT NULL, 
	fee_range TEXT, 
	admission_info TEXT, 
	scholarships_note TEXT, 
	website VARCHAR(400) NOT NULL, 
	verified BOOLEAN NOT NULL, 
	last_verified_at TIMESTAMP WITHOUT TIME ZONE, 
	sponsored BOOLEAN NOT NULL, 
	sponsorship_disclosure TEXT, 
	created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL, 
	PRIMARY KEY (id)
);

CREATE TABLE resources (
	id SERIAL NOT NULL, 
	title VARCHAR(160) NOT NULL, 
	kind VARCHAR(32) NOT NULL, 
	category VARCHAR(64) NOT NULL, 
	level VARCHAR(24) NOT NULL, 
	language VARCHAR(8) NOT NULL, 
	description TEXT NOT NULL, 
	url VARCHAR(500) NOT NULL, 
	verified BOOLEAN NOT NULL, 
	duration_minutes INTEGER, 
	created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL, 
	PRIMARY KEY (id)
);

CREATE INDEX ix_resources_category ON resources (category);

CREATE TABLE scholarships (
	id SERIAL NOT NULL, 
	name VARCHAR(160) NOT NULL, 
	provider VARCHAR(120) NOT NULL, 
	scope VARCHAR(16) NOT NULL, 
	education_levels JSONB NOT NULL, 
	states JSONB NOT NULL, 
	categories JSONB NOT NULL, 
	benefit_summary TEXT NOT NULL, 
	eligibility_summary TEXT NOT NULL, 
	application_steps JSONB NOT NULL, 
	official_url VARCHAR(500) NOT NULL, 
	verified BOOLEAN NOT NULL, 
	last_verified_at TIMESTAMP WITHOUT TIME ZONE, 
	disclaimer TEXT NOT NULL, 
	created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL, 
	PRIMARY KEY (id)
);

CREATE TABLE users (
	id SERIAL NOT NULL, 
	role VARCHAR(16) NOT NULL, 
	display_name VARCHAR(80) NOT NULL, 
	preferred_language VARCHAR(8) NOT NULL, 
	is_active BOOLEAN NOT NULL, 
	comeback_index VARCHAR(64), 
	comeback_hash VARCHAR(128), 
	created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL, 
	PRIMARY KEY (id)
);

CREATE INDEX ix_users_comeback_index ON users (comeback_index);

CREATE TABLE auth_tokens (
	token VARCHAR(64) NOT NULL, 
	user_id INTEGER NOT NULL, 
	expires_at TIMESTAMP WITHOUT TIME ZONE NOT NULL, 
	created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL, 
	PRIMARY KEY (token), 
	FOREIGN KEY(user_id) REFERENCES users (id) ON DELETE CASCADE
);

CREATE TABLE career_reports (
	id SERIAL NOT NULL, 
	student_id INTEGER NOT NULL, 
	content JSONB NOT NULL, 
	is_deleted BOOLEAN NOT NULL, 
	created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(student_id) REFERENCES users (id) ON DELETE CASCADE
);

CREATE TABLE consent_records (
	id SERIAL NOT NULL, 
	user_id INTEGER NOT NULL, 
	scope VARCHAR(48) NOT NULL, 
	granted BOOLEAN NOT NULL, 
	version VARCHAR(16) NOT NULL, 
	note TEXT, 
	created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(user_id) REFERENCES users (id) ON DELETE CASCADE
);

CREATE TABLE conversation_sessions (
	id SERIAL NOT NULL, 
	student_id INTEGER NOT NULL, 
	kind VARCHAR(8) NOT NULL, 
	language VARCHAR(8) NOT NULL, 
	stage INTEGER NOT NULL, 
	status VARCHAR(16) NOT NULL, 
	ended_at TIMESTAMP WITHOUT TIME ZONE, 
	created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(student_id) REFERENCES users (id) ON DELETE CASCADE
);

CREATE TABLE guardianships (
	id SERIAL NOT NULL, 
	parent_id INTEGER NOT NULL, 
	student_id INTEGER NOT NULL, 
	relationship VARCHAR(32), 
	share_conversation_transcripts BOOLEAN NOT NULL, 
	created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL, 
	PRIMARY KEY (id), 
	CONSTRAINT uq_guard UNIQUE (parent_id, student_id), 
	FOREIGN KEY(parent_id) REFERENCES users (id) ON DELETE CASCADE, 
	FOREIGN KEY(student_id) REFERENCES users (id) ON DELETE CASCADE
);

CREATE TABLE journey_events (
	id SERIAL NOT NULL, 
	student_id INTEGER NOT NULL, 
	kind VARCHAR(32) NOT NULL, 
	title VARCHAR(160) NOT NULL, 
	detail TEXT, 
	created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(student_id) REFERENCES users (id) ON DELETE CASCADE
);

CREATE TABLE recommendations (
	id SERIAL NOT NULL, 
	student_id INTEGER NOT NULL, 
	career_id INTEGER NOT NULL, 
	why TEXT NOT NULL, 
	supporting_statements JSONB NOT NULL, 
	open_questions JSONB NOT NULL, 
	skills_to_try JSONB NOT NULL, 
	qualifications_to_check JSONB NOT NULL, 
	alternatives JSONB NOT NULL, 
	evidence_level VARCHAR(16) NOT NULL, 
	next_activity TEXT, 
	created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(student_id) REFERENCES users (id) ON DELETE CASCADE, 
	FOREIGN KEY(career_id) REFERENCES careers (id) ON DELETE CASCADE
);

CREATE TABLE saved_careers (
	id SERIAL NOT NULL, 
	student_id INTEGER NOT NULL, 
	career_id INTEGER NOT NULL, 
	created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL, 
	PRIMARY KEY (id), 
	CONSTRAINT uq_saved_career UNIQUE (student_id, career_id), 
	FOREIGN KEY(student_id) REFERENCES users (id) ON DELETE CASCADE, 
	FOREIGN KEY(career_id) REFERENCES careers (id) ON DELETE CASCADE
);

CREATE TABLE student_profiles (
	user_id INTEGER NOT NULL, 
	class_level VARCHAR(16), 
	age_range VARCHAR(16), 
	board VARCHAR(32), 
	share_code VARCHAR(12), 
	interest_areas JSONB NOT NULL, 
	education_context TEXT, 
	financial_context TEXT, 
	created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL, 
	PRIMARY KEY (user_id), 
	FOREIGN KEY(user_id) REFERENCES users (id) ON DELETE CASCADE, 
	UNIQUE (share_code)
);

CREATE TABLE study_plans (
	id SERIAL NOT NULL, 
	student_id INTEGER NOT NULL, 
	title VARCHAR(120) NOT NULL, 
	goal TEXT NOT NULL, 
	career_id INTEGER, 
	status VARCHAR(16) NOT NULL, 
	created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(student_id) REFERENCES users (id) ON DELETE CASCADE, 
	FOREIGN KEY(career_id) REFERENCES careers (id) ON DELETE SET NULL
);

CREATE TABLE user_settings (
	user_id INTEGER NOT NULL, 
	language VARCHAR(8) NOT NULL, 
	voice VARCHAR(48), 
	speak_responses BOOLEAN NOT NULL, 
	continuous_conversation BOOLEAN NOT NULL, 
	save_history BOOLEAN NOT NULL, 
	reduced_motion BOOLEAN NOT NULL, 
	high_contrast BOOLEAN NOT NULL, 
	created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL, 
	PRIMARY KEY (user_id), 
	FOREIGN KEY(user_id) REFERENCES users (id) ON DELETE CASCADE
);

CREATE TABLE interest_observations (
	id SERIAL NOT NULL, 
	student_id INTEGER NOT NULL, 
	session_id INTEGER, 
	theme VARCHAR(48) NOT NULL, 
	evidence TEXT NOT NULL, 
	source VARCHAR(16) NOT NULL, 
	created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(student_id) REFERENCES users (id) ON DELETE CASCADE, 
	FOREIGN KEY(session_id) REFERENCES conversation_sessions (id) ON DELETE SET NULL
);

CREATE TABLE messages (
	id SERIAL NOT NULL, 
	session_id INTEGER NOT NULL, 
	role VARCHAR(10) NOT NULL, 
	content TEXT NOT NULL, 
	demo_generated BOOLEAN NOT NULL, 
	created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(session_id) REFERENCES conversation_sessions (id) ON DELETE CASCADE
);

CREATE TABLE study_plan_items (
	id SERIAL NOT NULL, 
	plan_id INTEGER NOT NULL, 
	title VARCHAR(160) NOT NULL, 
	detail TEXT, 
	estimated_effort VARCHAR(48), 
	resource_url VARCHAR(400), 
	status VARCHAR(16) NOT NULL, 
	"order" INTEGER NOT NULL, 
	created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(plan_id) REFERENCES study_plans (id) ON DELETE CASCADE
);

-- Keep Supabase's auto-generated REST API from reading the children's data.
--
-- Every table in the public schema is reachable through PostgREST with the anon key,
-- and the app never uses that door: it talks to PostgreSQL directly with psycopg.
-- Enabling row level security with no policies means the anon and authenticated roles
-- see zero rows, while the app is unaffected because it logs in as postgres, the owner
-- of these tables, and a table owner is not subject to RLS.
--
-- This is a second lock on the front door, not the permission model. Which family may
-- read which student is still decided by the backend routes, against the session token.

ALTER TABLE "careers" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "institutions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "resources" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "scholarships" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "auth_tokens" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "career_reports" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "consent_records" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "conversation_sessions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "guardianships" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "journey_events" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "recommendations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "saved_careers" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "student_profiles" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "study_plans" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "user_settings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "interest_observations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "messages" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "study_plan_items" ENABLE ROW LEVEL SECURITY;
