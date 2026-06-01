"""
BI Chatbot Agent - Backend
Uses Groq (FREE) — database created automatically on startup
Run: python app.py
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
import sqlite3
import json
import re
import os
import random
from datetime import datetime, timedelta
from groq import Groq

app = Flask(__name__)
CORS(app)

DB_PATH = "sales.db"
client = Groq(api_key=os.environ.get("GROQ_API_KEY"))
MODEL = "llama-3.3-70b-versatile"

# ── Auto-create database on startup ──────────────────────────────────────────

def create_database():
    """Creates and seeds the sales database automatically."""
    if os.path.exists(DB_PATH):
        return  # already exists

    print("📦 Creating database...")
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()

    c.executescript('''
        CREATE TABLE IF NOT EXISTS sales (
            id INTEGER PRIMARY KEY,
            date TEXT,
            product TEXT,
            category TEXT,
            revenue REAL,
            units INTEGER,
            region TEXT
        );
        CREATE TABLE IF NOT EXISTS customers (
            id INTEGER PRIMARY KEY,
            name TEXT,
            region TEXT,
            segment TEXT,
            join_date TEXT
        );
        CREATE TABLE IF NOT EXISTS products (
            id INTEGER PRIMARY KEY,
            name TEXT,
            category TEXT,
            price REAL,
            cost REAL
        );
    ''')

    categories = {
        'Electronics': ['Laptop','Phone','Tablet','Headphones','Smartwatch'],
        'Clothing':    ['Jacket','Shoes','T-Shirt','Jeans','Dress'],
        'Food':        ['Coffee','Tea','Snacks','Juice','Protein Bar'],
        'Home':        ['Chair','Lamp','Rug','Pillow','Vase']
    }
    regions   = ['North','South','East','West']
    segments  = ['Enterprise','SMB','Consumer']

    pid = 1
    for cat, prods in categories.items():
        for p in prods:
            price = round(random.uniform(10, 500), 2)
            c.execute("INSERT OR IGNORE INTO products VALUES (?,?,?,?,?)",
                      (pid, p, cat, price, round(price * 0.6, 2)))
            pid += 1

    names = ['Acme Corp','TechStart','Global Inc','Local Biz','MegaCo',
             'SmallShop','QuickBuy','TopStore','FastCo','BestDeals']
    for i, name in enumerate(names, 1):
        c.execute("INSERT OR IGNORE INTO customers VALUES (?,?,?,?,?)",
                  (i, name, random.choice(regions), random.choice(segments),
                   (datetime(2022,1,1)+timedelta(days=random.randint(0,365))).strftime('%Y-%m-%d')))

    all_products = [(p, cat) for cat, prods in categories.items() for p in prods]
    base = datetime(2023, 1, 1)
    for i in range(1, 501):
        date    = (base + timedelta(days=random.randint(0,364))).strftime('%Y-%m-%d')
        prod, cat = random.choice(all_products)
        units   = random.randint(1, 20)
        revenue = round(random.uniform(500, 50000), 2)
        c.execute("INSERT OR IGNORE INTO sales VALUES (?,?,?,?,?,?,?)",
                  (i, date, prod, cat, revenue, units, random.choice(regions)))

    conn.commit()
    conn.close()
    print("✅ Database ready — 500 sales records created!")

# ── DB helpers ────────────────────────────────────────────────────────────────

def get_schema():
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute("SELECT name FROM sqlite_master WHERE type='table'")
    tables = c.fetchall()
    schema = []
    for (table,) in tables:
        c.execute(f"PRAGMA table_info({table})")
        cols = c.fetchall()
        col_defs = ", ".join(f"{col[1]} {col[2]}" for col in cols)
        schema.append(f"{table}({col_defs})")
    conn.close()
    return "\n".join(schema)


def run_query(sql: str):
    sql = sql.strip()
    if not sql.upper().startswith("SELECT"):
        return None, "Only SELECT queries are allowed."
    try:
        conn = sqlite3.connect(DB_PATH)
        c = conn.cursor()
        c.execute(sql)
        rows = c.fetchall()
        cols = [d[0] for d in c.description]
        conn.close()
        return {"columns": cols, "rows": rows[:50]}, None
    except Exception as e:
        return None, str(e)


def extract_sql(text: str):
    match = re.search(r"```sql\s*(.*?)```", text, re.DOTALL | re.IGNORECASE)
    if match:
        return match.group(1).strip()
    match = re.search(r"(SELECT\s+.+?;)", text, re.DOTALL | re.IGNORECASE)
    return match.group(1).strip() if match else None


def build_system_prompt():
    schema = get_schema()
    return f"""You are a senior Business Intelligence AI Agent connected to a real SQLite sales database.

DATABASE SCHEMA:
{schema}

YOUR JOB:
1. Understand the user's business question
2. Write a precise SQL query (in a ```sql code block)
3. The system will run it and give you the results
4. Explain results in plain business English — clear, concise, actionable
5. Add 1-2 strategic insights or recommendations when relevant

RULES:
- Always write valid SQLite SQL
- Use only SELECT statements
- For dates use: strftime('%Y-%m', date) for month grouping
- Keep explanations friendly and non-technical
- Format numbers with R for South African Rand
- If results are empty, say so and suggest why
"""

# ── API routes ────────────────────────────────────────────────────────────────

@app.route("/chat", methods=["POST"])
def chat():
    data = request.json
    history     = data.get("history", [])
    user_message = data.get("message", "")

    if not user_message:
        return jsonify({"error": "No message provided"}), 400

    messages = [{"role": "system", "content": build_system_prompt()}]
    messages += history
    messages.append({"role": "user", "content": user_message})

    try:
        response = client.chat.completions.create(
            model=MODEL, messages=messages, max_tokens=1000)
        ai_text = response.choices[0].message.content

        sql = extract_sql(ai_text)
        query_result = None
        query_error  = None

        if sql:
            query_result, query_error = run_query(sql)
            if query_result:
                result_str = json.dumps(query_result, indent=2)
                followup = messages + [
                    {"role": "assistant", "content": ai_text},
                    {"role": "user", "content": f"Results:\n{result_str}\n\nGive a clear business summary with specific numbers in Rands (R)."},
                ]
                final = client.chat.completions.create(
                    model=MODEL, messages=followup, max_tokens=800)
                final_text = final.choices[0].message.content
            else:
                final_text = ai_text + (f"\n\n⚠️ Query error: {query_error}" if query_error else "")
        else:
            final_text = ai_text

        return jsonify({"reply": final_text, "sql": sql, "data": query_result, "error": query_error})

    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/schema", methods=["GET"])
def schema():
    return jsonify({"schema": get_schema()})


@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok", "db": DB_PATH, "model": MODEL, "provider": "Groq (Free)"})


# ── Start ─────────────────────────────────────────────────────────────────────

create_database()  # Auto-create DB on every startup

if __name__ == "__main__":
    print("🚀 BI Agent running FREE on Groq!")
    print("🌐 http://localhost:5000")
    app.run(debug=True, port=5000)
