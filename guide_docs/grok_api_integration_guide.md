# xAI Grok API – Full Integration Documentation

**Version**: Based on xAI API as of February 2026  
**Base URL**: `https://api.x.ai/v1`  
**Official Documentation**: [docs.x.ai](https://docs.x.ai)  
**Console**: [console.x.ai](https://console.x.ai) – for API keys, billing, and usage monitoring

This Markdown document provides a **comprehensive integration guide** for the xAI Grok API. It covers:

1. **Synchronous Chat Completions** – real-time requests (standard `/chat/completions` endpoint)
2. **Batch Processing** – asynchronous bulk requests via the Batch API (ideal for cost savings on large volumes without quality loss)

Both approaches use the same underlying Grok models and parameters, so **output quality remains identical**. Batch mode simply defers processing and offers **50% lower pricing** (e.g., input/output tokens cost half compared to synchronous calls).

## 1. Prerequisites

- xAI account → sign up at https://x.ai or https://console.x.ai
- API Key → generate in Console → API Keys section
- Authentication: `Authorization: Bearer YOUR_API_KEY`
- Supported SDKs: OpenAI Python/JS SDK (compatible), xAI SDK (`pip install xai-sdk` or `npm install xai-sdk`), raw HTTP (cURL)
- Billing: Prepaid credits required; monitor in console

### Current Models (February 2026 – select via `model` parameter)

| Model                              | Context Window | Best For                          | Standard Pricing (input/output per 1M tokens) | Batch Pricing (50% off) |
|------------------------------------|----------------|-----------------------------------|-----------------------------------------------|--------------------------|
| grok-4-1-fast-reasoning            | 2,000,000      | Complex reasoning, long context   | $0.20 / $0.50                                 | $0.10 / $0.25            |
| grok-4-1-fast-non-reasoning        | 2,000,000      | Fast chat, simple tasks           | $0.20 / $0.50                                 | $0.10 / $0.25            |
| grok-4-fast-reasoning              | 2,000,000      | Reasoning (earlier variant)       | $0.20 / $0.50                                 | $0.10 / $0.25            |
| grok-3                             | 131,072        | General-purpose reasoning         | $3.00 / $15.00                                | $1.50 / $7.50            |
| grok-3-mini                        | 131,072        | Lightweight, fast & cheap         | $0.30 / $0.50                                 | $0.15 / $0.25            |

**Tip**: Use reasoning models for analytical/multi-step tasks; non-reasoning for quick responses. Batch pricing applies across supported models.

## 2. Synchronous Chat Completions (Real-time)

**Endpoint**: `POST /chat/completions`

### Key Request Parameters

- `model` (string, required) – e.g. `"grok-4-1-fast-reasoning"`
- `messages` (array) – array of `{role, content}` objects (`system`, `user`, `assistant`)
- `temperature` (0–2, default 1.0) – lower = more deterministic
- `max_tokens` (int) – cap response length
- `top_p` (0–1, default 1.0)
- `stream` (bool, default false)

### cURL Example

```bash
curl https://api.x.ai/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -d '{
    "model": "grok-4-1-fast-reasoning",
    "messages": [
      {"role": "system", "content": "You are Grok built by xAI."},
      {"role": "user", "content": "Explain quantum entanglement in one paragraph."}
    ],
    "temperature": 0.7,
    "max_tokens": 512
  }'
```

### Python (OpenAI SDK – recommended)

```python
from openai import OpenAI
import os

client = OpenAI(
    api_key=os.getenv("XAI_API_KEY"),
    base_url="https://api.x.ai/v1"
)

response = client.chat.completions.create(
    model="grok-4-1-fast-reasoning",
    messages=[
        {"role": "system", "content": "You are Grok built by xAI."},
        {"role": "user", "content": "Explain quantum entanglement in one paragraph."}
    ],
    temperature=0.7,
    max_tokens=512
)

print(response.choices[0].message.content)
```

### JavaScript / Node.js (OpenAI SDK)

```javascript
const { OpenAI } = require('openai');

const client = new OpenAI({
  apiKey: process.env.XAI_API_KEY,
  baseURL: 'https://api.x.ai/v1'
});

async function main() {
  const completion = await client.chat.completions.create({
    model: 'grok-4-1-fast-reasoning',
    messages: [
      { role: 'system', content: 'You are Grok built by xAI.' },
      { role: 'user', content: 'Explain quantum entanglement in one paragraph.' }
    ],
    temperature: 0.7,
    maxTokens: 512
  });

  console.log(completion.choices[0].message.content);
}

main();
```

## 3. Batch API – Asynchronous Bulk Processing (50% Cheaper)

**Use case**: Process hundreds/thousands of prompts (e.g., classify 10,000 customer reviews, generate summaries in bulk) without quality loss.

**Benefits**:
- 50% lower token pricing
- No impact on per-minute rate limits
- Asynchronous → results typically ready in hours (up to 24h)
- Same model quality as synchronous calls
- No client-side tools/function calling support in batch

**Endpoint base**: `/batches`

**Workflow**:
1. Prepare JSONL file with requests
2. Create batch (upload file)
3. Monitor status
4. Retrieve results (JSONL output file)

### Step 1: Prepare Input JSONL File

Each line = one request object (very similar to `/chat/completions` body + metadata)

Example `requests.jsonl`:

```json
{"custom_id": "req-001", "method": "POST", "url": "/v1/chat/completions", "body": {"model": "grok-4-1-fast-reasoning", "messages": [{"role": "user", "content": "Summarize this review: Great product but slow shipping."}], "temperature": 0.5, "max_tokens": 150}}
{"custom_id": "req-002", "method": "POST", "url": "/v1/chat/completions", "body": {"model": "grok-4-1-fast-reasoning", "messages": [{"role": "user", "content": "Classify sentiment: I love this!"}], "temperature": 0.2}}
```

- `custom_id`: your tracking ID (required)
- `method`: always `"POST"`
- `url`: `"/v1/chat/completions"`
- `body`: standard chat completions request

### Step 2: Create Batch

#### cURL

```bash
curl https://api.x.ai/v1/batches \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -F file="@requests.jsonl" \
  -F metadata='{"name": "bulk-sentiment-analysis-2026-02"}'
```

#### Python (xAI SDK preferred for batch)

```python
from xai_sdk import Client

client = Client(api_key=os.getenv("XAI_API_KEY"))

batch = client.batch.create(
    input_file="requests.jsonl",          # or open("requests.jsonl", "rb")
    batch_name="bulk-sentiment-analysis"
)

print("Batch ID:", batch.batch_id)
```

#### JavaScript

```javascript
// Using xAI SDK or raw fetch – check docs.x.ai for latest SDK batch methods
```

### Step 3: Monitor Batch Status

```bash
# cURL
curl https://api.x.ai/v1/batches/batch_abc123 \
  -H "Authorization: Bearer YOUR_API_KEY"
```

Status values: `validating` → `processing` → `completed` / `failed` / `cancelled`

Python:

```python
status = client.batch.retrieve("batch_abc123")
while status.status != "completed":
    time.sleep(60)
    status = client.batch.retrieve("batch_abc123")
```

### Step 4: Retrieve Results

Output is JSONL file – each line corresponds to one input request (matched by `custom_id`)

```bash
curl https://api.x.ai/v1/files/{output_file_id}/content \
  -H "Authorization: Bearer YOUR_API_KEY" \
  > results.jsonl
```

Each result line contains: `custom_id`, `response` (full chat completion object), or `error` if failed.

### Cancellation (if needed)

```bash
curl -X POST https://api.x.ai/v1/batches/batch_abc123/cancel \
  -H "Authorization: Bearer YOUR_API_KEY"
```

## 4. Best Practices & Tips

- **Cost control**: Use `max_tokens`, low `temperature`, batch for bulk work
- **Model selection**: Match model to task (reasoning vs. speed)
- **Error handling**: Retry 429/5xx, validate JSONL before upload
- **Security**: Never expose API key client-side; use backend proxy
- **Monitoring**: Track usage & costs in console.x.ai
- **Limits**: Large batches (>100k requests) may be throttled
- **No streaming** in batch; results retrieved after completion
- **Updates**: Always verify latest at https://docs.x.ai/developers/rest-api-reference/inference/batches

This guide combines both real-time and batch integration paths for maximum flexibility and cost efficiency.

Happy building with Grok! 🚀