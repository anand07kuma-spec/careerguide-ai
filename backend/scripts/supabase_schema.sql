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

CREATE TABLE assessment_questions (
	id SERIAL NOT NULL, 
	assessment_type VARCHAR(16) NOT NULL, 
	code VARCHAR(12) NOT NULL, 
	dimension VARCHAR(24) NOT NULL, 
	"order" INTEGER NOT NULL, 
	response_type VARCHAR(8) NOT NULL, 
	keyed VARCHAR(2) NOT NULL, 
	text_en TEXT NOT NULL, 
	text_hi TEXT NOT NULL, 
	options_json JSONB NOT NULL, 
	correct_value VARCHAR(8), 
	created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL, 
	PRIMARY KEY (id), 
	CONSTRAINT uq_assessment_code UNIQUE (assessment_type, code)
);

CREATE INDEX ix_assessment_questions_assessment_type ON assessment_questions (assessment_type);

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
	source_url VARCHAR(500), 
	verified_at TIMESTAMP WITHOUT TIME ZONE, 
	created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL, 
	PRIMARY KEY (id)
);

CREATE INDEX ix_careers_category ON careers (category);

CREATE UNIQUE INDEX ix_careers_slug ON careers (slug);

CREATE TABLE exam_groups (
	id SERIAL NOT NULL, 
	title VARCHAR(120) NOT NULL, 
	description TEXT NOT NULL, 
	is_active BOOLEAN NOT NULL, 
	sort_order INTEGER NOT NULL, 
	created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL, 
	PRIMARY KEY (id)
);

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

CREATE TABLE organizations (
	id SERIAL NOT NULL, 
	slug VARCHAR(40) NOT NULL, 
	kind VARCHAR(16) NOT NULL, 
	name VARCHAR(120) NOT NULL, 
	tier_code VARCHAR(24) NOT NULL, 
	verified BOOLEAN NOT NULL, 
	verified_at TIMESTAMP WITHOUT TIME ZONE, 
	is_active BOOLEAN NOT NULL, 
	created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL, 
	PRIMARY KEY (id)
);

CREATE INDEX ix_organizations_kind ON organizations (kind);

CREATE INDEX ix_organizations_kind_active ON organizations (kind, is_active);

CREATE UNIQUE INDEX ix_organizations_slug ON organizations (slug);

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
	source_url VARCHAR(500), 
	verified BOOLEAN NOT NULL, 
	last_verified_at TIMESTAMP WITHOUT TIME ZONE, 
	disclaimer TEXT NOT NULL, 
	created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL, 
	PRIMARY KEY (id)
);

CREATE TABLE study_countries (
	id SERIAL NOT NULL, 
	slug VARCHAR(40) NOT NULL, 
	name VARCHAR(80) NOT NULL, 
	code VARCHAR(3) NOT NULL, 
	overview TEXT NOT NULL, 
	language_note TEXT, 
	intake_note TEXT, 
	cost_note TEXT, 
	work_after_note TEXT, 
	to_check JSONB NOT NULL, 
	visa_portal_url VARCHAR(500), 
	visa_portal_label VARCHAR(120), 
	qualifications_portal_url VARCHAR(500), 
	qualifications_portal_label VARCHAR(120), 
	checked_at TIMESTAMP WITHOUT TIME ZONE, 
	is_active BOOLEAN NOT NULL, 
	sort_order INTEGER NOT NULL, 
	created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL, 
	PRIMARY KEY (id)
);

CREATE UNIQUE INDEX ix_study_countries_slug ON study_countries (slug);

CREATE TABLE study_services (
	id SERIAL NOT NULL, 
	slug VARCHAR(60) NOT NULL, 
	title VARCHAR(120) NOT NULL, 
	summary TEXT NOT NULL, 
	detail TEXT, 
	steps JSONB NOT NULL, 
	includes JSONB NOT NULL, 
	not_included JSONB NOT NULL, 
	who_for TEXT, 
	fees_note TEXT, 
	available BOOLEAN NOT NULL, 
	sort_order INTEGER NOT NULL, 
	created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL, 
	PRIMARY KEY (id)
);

CREATE UNIQUE INDEX ix_study_services_slug ON study_services (slug);

CREATE TABLE users (
	id SERIAL NOT NULL, 
	role VARCHAR(16) NOT NULL, 
	display_name VARCHAR(80) NOT NULL, 
	preferred_language VARCHAR(8) NOT NULL, 
	is_active BOOLEAN NOT NULL, 
	contact_email VARCHAR(254), 
	email_confirm_hash VARCHAR(64), 
	email_confirm_expires_at TIMESTAMP WITHOUT TIME ZONE, 
	email_confirmed_at TIMESTAMP WITHOUT TIME ZONE, 
	device_hash VARCHAR(64), 
	clerk_user_id VARCHAR(40), 
	clerk_linked_at TIMESTAMP WITHOUT TIME ZONE, 
	google_sub VARCHAR(255), 
	google_linked_at TIMESTAMP WITHOUT TIME ZONE, 
	login_email VARCHAR(254), 
	password_hash VARCHAR(255), 
	password_updated_at TIMESTAMP WITHOUT TIME ZONE, 
	password_reset_hash VARCHAR(64), 
	password_reset_expires_at TIMESTAMP WITHOUT TIME ZONE, 
	password_reset_used_at TIMESTAMP WITHOUT TIME ZONE, 
	failed_login_count INTEGER, 
	locked_until TIMESTAMP WITHOUT TIME ZONE, 
	is_admin BOOLEAN, 
	erased_at TIMESTAMP WITHOUT TIME ZONE, 
	created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL, 
	PRIMARY KEY (id)
);

CREATE UNIQUE INDEX ix_users_clerk_user_id ON users (clerk_user_id);

CREATE UNIQUE INDEX ix_users_contact_email ON users (contact_email);

CREATE INDEX ix_users_device_hash ON users (device_hash);

CREATE INDEX ix_users_email_confirm_hash ON users (email_confirm_hash);

CREATE UNIQUE INDEX ix_users_google_sub ON users (google_sub);

CREATE UNIQUE INDEX ix_users_login_email ON users (login_email);

CREATE INDEX ix_users_password_reset_hash ON users (password_reset_hash);

CREATE TABLE assessments (
	id SERIAL NOT NULL, 
	user_id INTEGER NOT NULL, 
	assessment_type VARCHAR(16) NOT NULL, 
	language VARCHAR(8) NOT NULL, 
	bank_version VARCHAR(8) NOT NULL, 
	started_at TIMESTAMP WITHOUT TIME ZONE NOT NULL, 
	completed_at TIMESTAMP WITHOUT TIME ZONE, 
	status VARCHAR(16) NOT NULL, 
	created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(user_id) REFERENCES users (id) ON DELETE CASCADE
);

CREATE INDEX ix_assessments_user_id ON assessments (user_id);

CREATE TABLE audit_events (
	id SERIAL NOT NULL, 
	actor_user_id INTEGER, 
	actor_name VARCHAR(80), 
	action VARCHAR(48) NOT NULL, 
	subject_type VARCHAR(24), 
	subject_id VARCHAR(48), 
	detail VARCHAR(400), 
	origin VARCHAR(16) NOT NULL, 
	created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(actor_user_id) REFERENCES users (id) ON DELETE SET NULL
);

CREATE INDEX ix_audit_events_action ON audit_events (action, created_at);

CREATE INDEX ix_audit_events_actor_time ON audit_events (actor_user_id, created_at);

CREATE INDEX ix_audit_events_actor_user_id ON audit_events (actor_user_id);

CREATE TABLE auth_tokens (
	token_hash VARCHAR(64) NOT NULL, 
	user_id INTEGER NOT NULL, 
	expires_at TIMESTAMP WITHOUT TIME ZONE NOT NULL, 
	created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL, 
	PRIMARY KEY (token_hash), 
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

CREATE TABLE email_jobs (
	id SERIAL NOT NULL, 
	user_id INTEGER NOT NULL, 
	purpose VARCHAR(32) NOT NULL, 
	ref_id INTEGER, 
	ref_key VARCHAR(24), 
	status VARCHAR(12) NOT NULL, 
	attempts INTEGER NOT NULL, 
	next_attempt_at TIMESTAMP WITHOUT TIME ZONE NOT NULL, 
	sent_at TIMESTAMP WITHOUT TIME ZONE, 
	detail VARCHAR(60), 
	created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(user_id) REFERENCES users (id) ON DELETE CASCADE
);

CREATE INDEX ix_email_jobs_due ON email_jobs (status, next_attempt_at);

CREATE INDEX ix_email_jobs_user_id ON email_jobs (user_id);

CREATE UNIQUE INDEX ux_email_jobs_ref ON email_jobs (user_id, purpose, ref_id) WHERE ref_id is not null;

CREATE UNIQUE INDEX ux_email_jobs_week ON email_jobs (user_id, purpose, ref_key) WHERE ref_key is not null;

CREATE TABLE exams (
	id SERIAL NOT NULL, 
	group_id INTEGER NOT NULL, 
	name VARCHAR(120) NOT NULL, 
	authority VARCHAR(160) NOT NULL, 
	description TEXT NOT NULL, 
	careers TEXT NOT NULL, 
	timeline TEXT NOT NULL, 
	preparation TEXT NOT NULL, 
	exam_date VARCHAR(120), 
	fee_note TEXT, 
	source_url VARCHAR(500), 
	verified BOOLEAN NOT NULL, 
	verified_at TIMESTAMP WITHOUT TIME ZONE, 
	is_active BOOLEAN NOT NULL, 
	sort_order INTEGER NOT NULL, 
	created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(group_id) REFERENCES exam_groups (id) ON DELETE CASCADE
);

CREATE INDEX ix_exams_group_active ON exams (group_id, is_active);

CREATE INDEX ix_exams_group_id ON exams (group_id);

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

CREATE TABLE memberships (
	id SERIAL NOT NULL, 
	organization_id INTEGER NOT NULL, 
	user_id INTEGER, 
	org_role VARCHAR(16) NOT NULL, 
	status VARCHAR(12) NOT NULL, 
	invited_email VARCHAR(254), 
	invite_hash VARCHAR(64), 
	invite_expires_at TIMESTAMP WITHOUT TIME ZONE, 
	joined_at TIMESTAMP WITHOUT TIME ZONE, 
	revoked_at TIMESTAMP WITHOUT TIME ZONE, 
	display_label VARCHAR(80), 
	share_results BOOLEAN NOT NULL, 
	assigned_counsellor_id INTEGER, 
	created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(organization_id) REFERENCES organizations (id) ON DELETE CASCADE, 
	FOREIGN KEY(user_id) REFERENCES users (id) ON DELETE CASCADE, 
	FOREIGN KEY(assigned_counsellor_id) REFERENCES memberships (id) ON DELETE SET NULL
);

CREATE INDEX ix_memberships_invite_hash ON memberships (invite_hash);

CREATE INDEX ix_memberships_org_status ON memberships (organization_id, status);

CREATE INDEX ix_memberships_organization_id ON memberships (organization_id);

CREATE INDEX ix_memberships_user_id ON memberships (user_id);

CREATE UNIQUE INDEX ux_memberships_org_email ON memberships (organization_id, invited_email) WHERE invited_email is not null;

CREATE UNIQUE INDEX ux_memberships_org_user ON memberships (organization_id, user_id) WHERE user_id is not null;

CREATE TABLE organization_branding (
	organization_id INTEGER NOT NULL, 
	portal_title VARCHAR(80), 
	welcome_note TEXT, 
	logo_url VARCHAR(500), 
	accent_color VARCHAR(7), 
	changed_at TIMESTAMP WITHOUT TIME ZONE NOT NULL, 
	created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL, 
	PRIMARY KEY (organization_id), 
	FOREIGN KEY(organization_id) REFERENCES organizations (id) ON DELETE CASCADE
);

CREATE TABLE payments (
	id SERIAL NOT NULL, 
	user_id INTEGER NOT NULL, 
	provider VARCHAR(16) NOT NULL, 
	order_id VARCHAR(64) NOT NULL, 
	payment_id VARCHAR(64), 
	plan_code VARCHAR(24) NOT NULL, 
	interval VARCHAR(12) NOT NULL, 
	amount_paise INTEGER NOT NULL, 
	currency VARCHAR(3) NOT NULL, 
	status VARCHAR(12) NOT NULL, 
	failure_reason VARCHAR(200), 
	receipt VARCHAR(48) NOT NULL, 
	captured_at TIMESTAMP WITHOUT TIME ZONE, 
	adult_attested BOOLEAN NOT NULL, 
	test_mode BOOLEAN NOT NULL, 
	created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(user_id) REFERENCES users (id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX ix_payments_order_id ON payments (order_id);

CREATE UNIQUE INDEX ix_payments_payment_id ON payments (payment_id);

CREATE INDEX ix_payments_user_id ON payments (user_id);

CREATE TABLE profile_photos (
	user_id INTEGER NOT NULL, 
	content_type VARCHAR(32) NOT NULL, 
	image BYTEA NOT NULL, 
	width INTEGER NOT NULL, 
	height INTEGER NOT NULL, 
	byte_size INTEGER NOT NULL, 
	updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL, 
	PRIMARY KEY (user_id), 
	FOREIGN KEY(user_id) REFERENCES users (id) ON DELETE CASCADE
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

CREATE TABLE resumes (
	user_id INTEGER NOT NULL, 
	target_role VARCHAR(120), 
	education JSONB NOT NULL, 
	skills JSONB NOT NULL, 
	projects JSONB NOT NULL, 
	created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL, 
	updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL, 
	PRIMARY KEY (user_id), 
	FOREIGN KEY(user_id) REFERENCES users (id) ON DELETE CASCADE
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
	age SMALLINT, 
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

CREATE TABLE study_leads (
	id SERIAL NOT NULL, 
	name VARCHAR(80) NOT NULL, 
	email VARCHAR(254) NOT NULL, 
	phone VARCHAR(24), 
	stage VARCHAR(32), 
	country_id INTEGER, 
	service_id INTEGER, 
	message TEXT, 
	source_page VARCHAR(120), 
	consent_contact BOOLEAN NOT NULL, 
	consent_contact_at TIMESTAMP WITHOUT TIME ZONE, 
	status VARCHAR(16) NOT NULL, 
	admin_note TEXT, 
	handled_at TIMESTAMP WITHOUT TIME ZONE, 
	created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(country_id) REFERENCES study_countries (id) ON DELETE SET NULL, 
	FOREIGN KEY(service_id) REFERENCES study_services (id) ON DELETE SET NULL
);

CREATE INDEX ix_study_leads_email ON study_leads (email);

CREATE INDEX ix_study_leads_status ON study_leads (status, created_at);

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

CREATE TABLE study_universities (
	id SERIAL NOT NULL, 
	country_id INTEGER NOT NULL, 
	slug VARCHAR(120) NOT NULL, 
	name VARCHAR(160) NOT NULL, 
	city VARCHAR(80) NOT NULL, 
	kind VARCHAR(16) NOT NULL, 
	official_url VARCHAR(400) NOT NULL, 
	founded_year INTEGER, 
	summary TEXT, 
	areas JSONB NOT NULL, 
	tuition_note TEXT, 
	intakes JSONB NOT NULL, 
	application_urls JSONB NOT NULL, 
	english_test_note TEXT, 
	deadline_note TEXT, 
	source_url VARCHAR(500), 
	verified BOOLEAN NOT NULL, 
	verified_at TIMESTAMP WITHOUT TIME ZONE, 
	sponsored BOOLEAN NOT NULL, 
	sponsorship_disclosure TEXT, 
	is_active BOOLEAN NOT NULL, 
	sort_order INTEGER NOT NULL, 
	created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(country_id) REFERENCES study_countries (id) ON DELETE CASCADE
);

CREATE INDEX ix_study_universities_country ON study_universities (country_id, is_active);

CREATE INDEX ix_study_universities_country_id ON study_universities (country_id);

CREATE UNIQUE INDEX ix_study_universities_slug ON study_universities (slug);

CREATE TABLE subscriptions (
	user_id INTEGER NOT NULL, 
	plan_code VARCHAR(24) NOT NULL, 
	source VARCHAR(12) NOT NULL, 
	interval VARCHAR(12), 
	started_at TIMESTAMP WITHOUT TIME ZONE, 
	expires_at TIMESTAMP WITHOUT TIME ZONE, 
	changed_at TIMESTAMP WITHOUT TIME ZONE NOT NULL, 
	created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL, 
	PRIMARY KEY (user_id), 
	FOREIGN KEY(user_id) REFERENCES users (id) ON DELETE CASCADE
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

CREATE TABLE assessment_responses (
	id SERIAL NOT NULL, 
	assessment_id INTEGER NOT NULL, 
	code VARCHAR(12) NOT NULL, 
	question_id INTEGER, 
	value VARCHAR(8) NOT NULL, 
	created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL, 
	PRIMARY KEY (id), 
	CONSTRAINT uq_assessment_answer UNIQUE (assessment_id, code), 
	FOREIGN KEY(assessment_id) REFERENCES assessments (id) ON DELETE CASCADE, 
	FOREIGN KEY(question_id) REFERENCES assessment_questions (id) ON DELETE SET NULL
);

CREATE INDEX ix_assessment_responses_assessment_id ON assessment_responses (assessment_id);

CREATE TABLE assessment_results (
	id SERIAL NOT NULL, 
	assessment_id INTEGER NOT NULL, 
	user_id INTEGER NOT NULL, 
	assessment_type VARCHAR(16) NOT NULL, 
	score_json JSONB NOT NULL, 
	traits_json JSONB NOT NULL, 
	detail_json JSONB NOT NULL, 
	roadmap_json JSONB, 
	completed_at TIMESTAMP WITHOUT TIME ZONE NOT NULL, 
	created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL, 
	PRIMARY KEY (id), 
	UNIQUE (assessment_id), 
	FOREIGN KEY(assessment_id) REFERENCES assessments (id) ON DELETE CASCADE, 
	FOREIGN KEY(user_id) REFERENCES users (id) ON DELETE CASCADE
);

CREATE INDEX ix_assessment_results_user_id ON assessment_results (user_id);

CREATE TABLE interest_observations (
	id SERIAL NOT NULL, 
	student_id INTEGER NOT NULL, 
	session_id INTEGER, 
	theme VARCHAR(48) NOT NULL, 
	evidence TEXT NOT NULL, 
	source VARCHAR(32) NOT NULL, 
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

CREATE TABLE session_notes (
	id SERIAL NOT NULL, 
	organization_id INTEGER NOT NULL, 
	client_membership_id INTEGER NOT NULL, 
	author_user_id INTEGER NOT NULL, 
	body TEXT NOT NULL, 
	shared_with_family BOOLEAN NOT NULL, 
	shared_at TIMESTAMP WITHOUT TIME ZONE, 
	edited_at TIMESTAMP WITHOUT TIME ZONE, 
	created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(organization_id) REFERENCES organizations (id) ON DELETE CASCADE, 
	FOREIGN KEY(client_membership_id) REFERENCES memberships (id) ON DELETE CASCADE, 
	FOREIGN KEY(author_user_id) REFERENCES users (id) ON DELETE CASCADE
);

CREATE INDEX ix_session_notes_author ON session_notes (author_user_id, created_at);

CREATE INDEX ix_session_notes_client ON session_notes (client_membership_id, created_at);

CREATE INDEX ix_session_notes_organization_id ON session_notes (organization_id);

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

CREATE TABLE study_stories (
	id SERIAL NOT NULL, 
	headline VARCHAR(160) NOT NULL, 
	body TEXT NOT NULL, 
	attribution VARCHAR(80) NOT NULL, 
	country_id INTEGER, 
	university_id INTEGER, 
	year INTEGER, 
	consent_confirmed_at TIMESTAMP WITHOUT TIME ZONE, 
	published BOOLEAN NOT NULL, 
	published_at TIMESTAMP WITHOUT TIME ZONE, 
	created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(country_id) REFERENCES study_countries (id) ON DELETE SET NULL, 
	FOREIGN KEY(university_id) REFERENCES study_universities (id) ON DELETE SET NULL
);

CREATE TABLE report_pdfs (
	id SERIAL NOT NULL, 
	student_id INTEGER NOT NULL, 
	anchor_result_id INTEGER NOT NULL, 
	language VARCHAR(8) NOT NULL, 
	filename VARCHAR(96) NOT NULL, 
	result_ids JSONB NOT NULL, 
	pdf_bytes BYTEA NOT NULL, 
	size_bytes INTEGER NOT NULL, 
	generated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL, 
	is_deleted BOOLEAN NOT NULL, 
	created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL, 
	PRIMARY KEY (id), 
	CONSTRAINT uq_report_pdf UNIQUE (student_id, language), 
	FOREIGN KEY(student_id) REFERENCES users (id) ON DELETE CASCADE, 
	FOREIGN KEY(anchor_result_id) REFERENCES assessment_results (id) ON DELETE CASCADE
);

CREATE INDEX ix_report_pdfs_anchor_result_id ON report_pdfs (anchor_result_id);

CREATE INDEX ix_report_pdfs_student_id ON report_pdfs (student_id);

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

ALTER TABLE "assessment_questions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "careers" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "exam_groups" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "institutions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "organizations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "resources" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "scholarships" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "study_countries" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "study_services" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "assessments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "audit_events" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "auth_tokens" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "career_reports" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "consent_records" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "conversation_sessions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "email_jobs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "exams" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "guardianships" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "journey_events" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "memberships" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "organization_branding" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "payments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "profile_photos" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "recommendations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "resumes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "saved_careers" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "student_profiles" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "study_leads" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "study_plans" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "study_universities" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "subscriptions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "user_settings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "assessment_responses" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "assessment_results" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "interest_observations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "messages" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "session_notes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "study_plan_items" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "study_stories" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "report_pdfs" ENABLE ROW LEVEL SECURITY;
