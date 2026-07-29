# Nthinya BI — AI Business Intelligence Chatbot

An enterprise-style AI analytics assistant that turns plain-English business
questions into SQL, runs them against a real database, and returns
executive-level insights — no manual querying or dashboard building required.

🔗 **Live demo:** [bi-chatbot.netlify.app](https://bi-chatbot.netlify.app)

## What it does

Ask a question like *"How much is revenue?"* or *"What's the average total
amount by product category?"* and the assistant will:
1. Understand the intent behind the question
2. Write the correct SQL query
3. Run it against the connected database
4. Explain the result in plain business English, with a strategic
   recommendation where relevant

## Features

- Natural language → SQL, powered by Groq (LLaMA 3.3 70B)
- Voice input for hands-free querying
- Chart.js visualizations of query results
- Excel/PDF export of results
- Dual data source support: a local SQLite demo dataset, and a live
  Supabase PostgreSQL connection to a real `retail_sales` table
- Read-only by design — only SELECT queries are ever executed

## Tech stack

- **Backend:** Flask (Python), Groq API, SQLite, PostgreSQL (via `psycopg2`)
- **Frontend:** React (`BIChatbot_with_backend.jsx`)
- **Hosting:** Netlify (frontend), PythonAnywhere (backend)

## Data sources

The backend switches between two data sources via a `DATA_SOURCE`
environment variable:
- `demo` (default) — auto-generated SQLite sales data
- `retail_sales` — live Supabase PostgreSQL table with real retail
  transaction data

## Repo structure
