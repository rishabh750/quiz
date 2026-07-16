-- Reference DDL. The app also auto-creates these via SQLAlchemy on startup.
-- Encrypted columns hold Fernet ciphertext (TEXT); they are decrypted in the app layer.

CREATE TABLE IF NOT EXISTS users (
    id              UUID PRIMARY KEY,
    email           VARCHAR(255) NOT NULL UNIQUE,
    password_hash   VARCHAR(255) NOT NULL,
    provider        VARCHAR(32)  NOT NULL DEFAULT 'gemini',
    api_key         TEXT,                       -- encrypted (Fernet)
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS courses (
    id           UUID PRIMARY KEY,
    user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name         VARCHAR(255) NOT NULL,
    notes        TEXT,                          -- encrypted (Fernet)
    is_archived  BOOLEAN NOT NULL DEFAULT FALSE,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_course_user_name UNIQUE (user_id, name)
);
CREATE INDEX IF NOT EXISTS ix_courses_user_id ON courses(user_id);

CREATE TABLE IF NOT EXISTS questions (
    id               UUID PRIMARY KEY,
    course_id        UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    section          VARCHAR(255) NOT NULL DEFAULT 'main',
    question_number  INTEGER NOT NULL,
    qtype            VARCHAR(8) NOT NULL DEFAULT 'mcq',
    question         TEXT NOT NULL,             -- encrypted (Fernet)
    option1          TEXT,                      -- encrypted
    option2          TEXT,                      -- encrypted
    option3          TEXT,                      -- encrypted
    option4          TEXT,                      -- encrypted
    correct_option   INTEGER,
    answer           TEXT,                      -- encrypted
    CONSTRAINT uq_question_course_num UNIQUE (course_id, question_number)
);
CREATE INDEX IF NOT EXISTS ix_questions_course_id ON questions(course_id);

CREATE TABLE IF NOT EXISTS answers (
    id               UUID PRIMARY KEY,
    course_id        UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    question_number  INTEGER NOT NULL,
    candidate_answer VARCHAR(64) NOT NULL,
    marks            INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT uq_answer_course_num UNIQUE (course_id, question_number)
);
CREATE INDEX IF NOT EXISTS ix_answers_course_id ON answers(course_id);
