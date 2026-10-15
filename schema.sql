CREATE TABLE IF NOT EXISTS settings(chat_id TEXT NOT NULL,key TEXT NOT NULL,value TEXT NOT NULL,PRIMARY KEY(chat_id,key));
CREATE TABLE IF NOT EXISTS topics(chat_id TEXT NOT NULL,thread_id TEXT NOT NULL,kind TEXT NOT NULL,PRIMARY KEY(chat_id,thread_id));
CREATE TABLE IF NOT EXISTS processed(chat_id TEXT NOT NULL,key TEXT NOT NULL,ts INTEGER NOT NULL,PRIMARY KEY(chat_id,key));
CREATE TABLE IF NOT EXISTS warnings(chat_id TEXT NOT NULL,user_id TEXT NOT NULL,count INTEGER NOT NULL DEFAULT 0,updated INTEGER NOT NULL,PRIMARY KEY(chat_id,user_id));
CREATE TABLE IF NOT EXISTS events(id INTEGER PRIMARY KEY AUTOINCREMENT,chat_id TEXT NOT NULL,thread_id TEXT,user_id TEXT,action TEXT NOT NULL,reason TEXT,ts INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS events_chat_ts ON events(chat_id,ts);

CREATE TABLE IF NOT EXISTS reputation_scores(chat_id TEXT NOT NULL,user_id TEXT NOT NULL,score INTEGER NOT NULL DEFAULT 0,updated INTEGER NOT NULL,PRIMARY KEY(chat_id,user_id));
CREATE TABLE IF NOT EXISTS reputation_votes(chat_id TEXT NOT NULL,vote_key TEXT NOT NULL,giver_id TEXT NOT NULL,receiver_id TEXT NOT NULL,amount INTEGER NOT NULL,ts INTEGER NOT NULL,PRIMARY KEY(chat_id,vote_key));
CREATE INDEX IF NOT EXISTS reputation_votes_chat_ts ON reputation_votes(chat_id,ts);
