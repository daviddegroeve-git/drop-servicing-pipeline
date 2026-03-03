CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE chat_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    place_id TEXT REFERENCES leads(place_id) ON DELETE CASCADE,
    phone TEXT NOT NULL,
    message_in TEXT NOT NULL,
    message_out TEXT NOT NULL,
    status TEXT DEFAUlT 'pending' CHECK (status IN ('pending', 'approved', 'corrected')),
    corrected_text TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);
