# OpenAI Responses API Integration Documentation
## Single Requests + Batch Processing (Full Guide)

This document explains how to integrate with the OpenAI Responses API for:

1. Single real-time question → answer flow
2. High-volume batch processing
3. Variable model routing
4. Token optimization without quality loss
5. Production architecture best practices

---

# 1. Architecture Overview

You have two main integration modes:

A) Real-Time (Synchronous)
Use when:
- User asks a question and expects immediate response.
- You need chat-like UX.

Endpoint:
POST /v1/responses

B) Batch (Asynchronous)
Use when:
- You process many independent questions.
- You want lower cost and higher throughput.
- Real-time response is not required.

Endpoint:
POST /v1/batches

---

# 2. Core Concepts

## 2.1 The Responses API Object Structure

Every request to /v1/responses typically contains:

- model (string)
- instructions (system-style rules)
- input (user question)
- temperature
- seed
- reasoning (optional, model-dependent)
- previous_response_id (optional, for multi-turn)

---

# 3. Real-Time Integration (Single Question)

## 3.1 Recommended Default Parameters

{
  "temperature": 0,
  "seed": 12345
}

Why:
- temperature: 0 → stable, consistent answers
- seed → improves reproducibility

---

## 3.2 cURL Example

curl https://api.openai.com/v1/responses   -H "Authorization: Bearer $OPENAI_API_KEY"   -H "Content-Type: application/json"   -d '{
    "model": "gpt-5.2",
    "instructions": "Be concise and practical. Use clear English. Short sentences.",
    "input": "How do I add a column in Postgres?",
    "temperature": 0,
    "seed": 12345,
    "reasoning": { "effort": "high" }
  }'

Remove reasoning if the selected model does not support it.

---

## 3.3 Python Example

import os
from openai import OpenAI

client = OpenAI(api_key=os.environ["OPENAI_API_KEY"])

response = client.responses.create(
    model="gpt-5.2",
    instructions="Be concise and practical. Short sentences.",
    input="Explain INNER JOIN vs LEFT JOIN.",
    temperature=0,
    seed=12345,
    reasoning={"effort": "high"}
)

print(response.output_text)

---

## 3.4 JavaScript / Node Example

import OpenAI from "openai";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const response = await client.responses.create({
  model: "gpt-5.2",
  instructions: "Be concise and practical. Short sentences.",
  input: "Write a SQL UPDATE example.",
  temperature: 0,
  seed: 12345,
  reasoning: { effort: "high" }
});

console.log(response.output_text);

---

# 4. Multi-Turn Conversations

To preserve context without resending history:

Use previous_response_id.

Example (Python):

first = client.responses.create(
    model="gpt-5.2",
    input="Design a database schema."
)

followup = client.responses.create(
    model="gpt-5.2",
    previous_response_id=first.id,
    input="Now optimize indexes."
)

Important:
- Do not resend full history manually.
- Store response.id in your database.

---

# 5. Batch Processing (High Volume)

Use when handling many independent questions.

## 5.1 JSONL File Format

Each line must contain:

{
  "custom_id": "unique_id",
  "method": "POST",
  "url": "/v1/responses",
  "body": { ... }
}

Example input.jsonl:

{"custom_id":"q1","method":"POST","url":"/v1/responses","body":{"model":"gpt-5.2","instructions":"Be concise.","input":"What is a LEFT JOIN?","temperature":0,"seed":12345}}
{"custom_id":"q2","method":"POST","url":"/v1/responses","body":{"model":"gpt-5.2-mini","instructions":"Be concise.","input":"Explain indexing in Postgres.","temperature":0,"seed":12345}}

---

## 5.2 Upload File

curl https://api.openai.com/v1/files   -H "Authorization: Bearer $OPENAI_API_KEY"   -F "purpose=batch"   -F "file=@input.jsonl"

---

## 5.3 Create Batch Job

curl https://api.openai.com/v1/batches   -H "Authorization: Bearer $OPENAI_API_KEY"   -H "Content-Type: application/json"   -d '{
    "input_file_id": "file_xxx",
    "endpoint": "/v1/responses",
    "completion_window": "24h"
  }'

---

## 5.4 Retrieve Results

curl https://api.openai.com/v1/files/file_output_id/content   -H "Authorization: Bearer $OPENAI_API_KEY"   -o output.jsonl

Match responses using custom_id.

---

# 6. Variable Model Routing Strategy

Implement profiles in your backend.

Example (JavaScript):

const profiles = {
  fast: { model: "gpt-5.2-mini", effort: null },
  standard: { model: "gpt-5.2", effort: "high" },
  deep: { model: "gpt-5-pro", effort: "high" }
};

Logic:
- If effort exists → include reasoning
- If null → omit reasoning

---

# 7. Token Optimization Without Quality Loss

## 7.1 Do

- Keep instructions short.
- Avoid sending conversation history if unnecessary.
- Use batch for independent questions.
- Route simple tasks to smaller models.

## 7.2 Avoid

- Over-truncating outputs with low max token limits.
- Sending logs or large context blocks unnecessarily.
- Repeating system instructions across layers.

---

# 8. Production Best Practices

## 8.1 Security
- Never expose main API key in frontend.
- Proxy through backend or use short-lived tokens.

## 8.2 Observability
Log:
- model
- latency
- token usage
- response.id
- custom_id (batch)

## 8.3 Error Handling
- Retry transient 5xx errors.
- If model rejects reasoning, retry without it.

---

# 9. Recommended Backend Flow

Real-Time:
User → Backend → /v1/responses → Return answer

Batch:
Collect questions → Generate JSONL → Upload → Create batch → Poll → Download → Map by custom_id

---

# 10. Summary

For most “single question → single answer” workloads:

Best setup:
- Use /v1/responses
- temperature: 0
- Fixed seed
- Short instruction block
- Model routing strategy
- Use Batch API for high volume

This guarantees:
- Stable output
- Cost efficiency
- Scalable architecture
- No quality degradation

---

End of documentation.
