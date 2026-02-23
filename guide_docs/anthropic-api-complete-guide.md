# Anthropic Claude API — Complete Integration Guide

A unified reference for integrating the Claude API using **cURL**, **Python**, and **JavaScript/Node.js**.  
Covers standard synchronous requests, model selection, conversations, streaming, and the **Batch API** for 50% cost reduction.

---

## Table of Contents

### Part 1 — Standard API
1. [Prerequisites](#1-prerequisites)
2. [Authentication](#2-authentication)
3. [Available Models](#3-available-models)
4. [Basic Request Structure](#4-basic-request-structure)
5. [cURL — Standard Examples](#5-curl--standard-examples)
6. [Python — Standard Examples](#6-python--standard-examples)
7. [JavaScript — Standard Examples](#7-javascript--standard-examples)
8. [System Prompts](#8-system-prompts)
9. [Multi-turn Conversations](#9-multi-turn-conversations)
10. [Streaming Responses](#10-streaming-responses)
11. [Error Handling](#11-error-handling)

### Part 2 — Batch API (50% Cost Reduction)
12. [How the Batch API Works](#12-how-the-batch-api-works)
13. [When to Use Batches](#13-when-to-use-batches)
14. [Batch Limitations](#14-batch-limitations)
15. [Batch Request Structure](#15-batch-request-structure)
16. [cURL — Batch Examples](#16-curl--batch-examples)
17. [Python — Batch Examples](#17-python--batch-examples)
18. [JavaScript — Batch Examples](#18-javascript--batch-examples)
19. [Polling for Results](#19-polling-for-results)
20. [Processing Results](#20-processing-results)
21. [Real-World Use Cases](#21-real-world-use-cases)
22. [Cost Comparison](#22-cost-comparison)

### Part 3 — General Best Practices
23. [Best Practices](#23-best-practices)
24. [Resources](#24-resources)

---

# Part 1 — Standard API

---

## 1. Prerequisites

Before starting, make sure you have:

- An **Anthropic API key** — get yours at [console.anthropic.com](https://console.anthropic.com)
- For Python: **Python 3.8+** and `pip` installed
- For JavaScript: **Node.js 18+** and `npm` installed
- For cURL: available natively on macOS/Linux; on Windows use Git Bash or WSL

---

## 2. Authentication

All requests require your API key in the `x-api-key` header.

**Never hardcode your API key** in source files. Always use environment variables:

```bash
# macOS / Linux — add to ~/.zshrc or ~/.bashrc
export ANTHROPIC_API_KEY="sk-ant-..."

# Windows (PowerShell)
$env:ANTHROPIC_API_KEY="sk-ant-..."
```

For local development, use a `.env` file and add it to `.gitignore`:

```bash
# .env
ANTHROPIC_API_KEY=sk-ant-...
```

```bash
# .gitignore
.env
```

---

## 3. Available Models

| Key      | Model String                 | Best For                                 |
|----------|------------------------------|------------------------------------------|
| `opus`   | `claude-opus-4-6`            | Complex reasoning, deep analysis         |
| `sonnet` | `claude-sonnet-4-6`          | Balanced — smart and fast (recommended)  |
| `haiku`  | `claude-haiku-4-5-20251001`  | Fast, lightweight, high-volume tasks     |

> **Tip:** Start with `sonnet` for most use cases. Use `haiku` for cost-sensitive or high-throughput tasks, and `opus` when maximum reasoning quality is required.

---

## 4. Basic Request Structure

Every request to the `/v1/messages` endpoint follows this structure:

```
POST https://api.anthropic.com/v1/messages
```

**Required headers:**

| Header              | Value              |
|---------------------|--------------------|
| `x-api-key`         | Your API key       |
| `anthropic-version` | `2023-06-01`       |
| `content-type`      | `application/json` |

**Required body fields:**

| Field        | Type    | Description                                   |
|--------------|---------|-----------------------------------------------|
| `model`      | string  | The model to use (see table above)            |
| `max_tokens` | integer | Maximum tokens in the response (e.g., `8096`) |
| `messages`   | array   | Array of `{ role, content }` objects          |

**Optional body fields:**

| Field         | Type   | Description                                                    |
|---------------|--------|----------------------------------------------------------------|
| `system`      | string | System prompt — sets context/persona for the assistant         |
| `temperature` | float  | Creativity from `0.0` (precise) to `1.0` (creative)           |
| `stream`      | bool   | Set `true` to receive a streamed response                      |

**Expected response format:**

```json
{
  "id": "msg_01XFDUDYJgAACzvnptvVoYEL",
  "type": "message",
  "role": "assistant",
  "content": [
    {
      "type": "text",
      "text": "Hello! How can I help you today?"
    }
  ],
  "model": "claude-sonnet-4-6",
  "stop_reason": "end_turn",
  "usage": {
    "input_tokens": 10,
    "output_tokens": 25
  }
}
```

The response text is always at `content[0].text`.

---

## 5. cURL — Standard Examples

### 5.1 Simple message

```bash
curl https://api.anthropic.com/v1/messages \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "content-type: application/json" \
  -d '{
    "model": "claude-sonnet-4-6",
    "max_tokens": 1024,
    "messages": [
      { "role": "user", "content": "Hello, Claude!" }
    ]
  }'
```

### 5.2 Model as a shell variable

```bash
# Set the model variable — change this line to switch models
MODEL="claude-sonnet-4-6"
# MODEL="claude-opus-4-6"
# MODEL="claude-haiku-4-5-20251001"

curl https://api.anthropic.com/v1/messages \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "content-type: application/json" \
  -d "{
    \"model\": \"$MODEL\",
    \"max_tokens\": 1024,
    \"messages\": [
      { \"role\": \"user\", \"content\": \"What model are you?\" }
    ]
  }"
```

### 5.3 With a system prompt

```bash
MODEL="claude-sonnet-4-6"

curl https://api.anthropic.com/v1/messages \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "content-type: application/json" \
  -d "{
    \"model\": \"$MODEL\",
    \"max_tokens\": 1024,
    \"system\": \"You are a helpful assistant specialized in luxury yacht rentals.\",
    \"messages\": [
      { \"role\": \"user\", \"content\": \"What should I look for when renting a yacht?\" }
    ]
  }"
```

### 5.4 Run with environment variable override

```bash
CLAUDE_MODEL=claude-haiku-4-5-20251001 bash script.sh
CLAUDE_MODEL=claude-opus-4-6 bash script.sh
```

---

## 6. Python — Standard Examples

### 6.1 Installation

```bash
pip install anthropic
```

### 6.2 Simple message

```python
import anthropic

# Reads ANTHROPIC_API_KEY from environment automatically
client = anthropic.Anthropic()

response = client.messages.create(
    model="claude-sonnet-4-6",
    max_tokens=1024,
    messages=[
        {"role": "user", "content": "Hello, Claude!"}
    ]
)

print(response.content[0].text)
```

### 6.3 Model as a variable

```python
import anthropic

client = anthropic.Anthropic()

MODELS = {
    "opus":   "claude-opus-4-6",
    "sonnet": "claude-sonnet-4-6",
    "haiku":  "claude-haiku-4-5-20251001",
}

# Change this key to switch models
selected_model = MODELS["sonnet"]

response = client.messages.create(
    model=selected_model,
    max_tokens=1024,
    messages=[
        {"role": "user", "content": "What model are you?"}
    ]
)

print(f"Model used: {response.model}")
print(f"Response: {response.content[0].text}")
```

### 6.4 Reusable function with model selection

```python
import anthropic
import os

client = anthropic.Anthropic(api_key=os.environ.get("ANTHROPIC_API_KEY"))

MODELS = {
    "opus":   "claude-opus-4-6",
    "sonnet": "claude-sonnet-4-6",
    "haiku":  "claude-haiku-4-5-20251001",
}


def chat(
    user_message: str,
    model_key: str = "sonnet",
    system_prompt: str = None,
    max_tokens: int = 1024
) -> str:
    """
    Send a message to Claude and return the text response.

    Args:
        user_message:  The message to send
        model_key:     One of 'opus', 'sonnet', 'haiku' — or a full model string
        system_prompt: Optional system-level context
        max_tokens:    Maximum response length

    Returns:
        The assistant's response as a string
    """
    # Accepts either a short key ("sonnet") or a full model string
    model = MODELS.get(model_key, model_key)

    params = {
        "model": model,
        "max_tokens": max_tokens,
        "messages": [{"role": "user", "content": user_message}]
    }

    if system_prompt:
        params["system"] = system_prompt

    response = client.messages.create(**params)
    return response.content[0].text


# Usage
print(chat("Hello!", model_key="haiku"))
print(chat("Explain quantum computing.", model_key="opus"))
print(chat("Hello!", model_key="claude-sonnet-4-6"))  # Full string also works
print(chat(
    "What documents do I need?",
    model_key="sonnet",
    system_prompt="You are an expert in Spanish Digital Nomad Visa applications."
))
```

### 6.5 Environment variable model selection

```python
import anthropic, os

client = anthropic.Anthropic()

# Override model via env var, fallback to sonnet
model = os.environ.get("CLAUDE_MODEL", "claude-sonnet-4-6")

response = client.messages.create(
    model=model,
    max_tokens=1024,
    messages=[{"role": "user", "content": "Hello!"}]
)

print(response.content[0].text)
```

```bash
CLAUDE_MODEL=claude-haiku-4-5-20251001 python script.py
CLAUDE_MODEL=claude-opus-4-6 python script.py
```

---

## 7. JavaScript — Standard Examples

### 7.1 Installation

```bash
npm install @anthropic-ai/sdk
```

### 7.2 Simple message

```javascript
import Anthropic from "@anthropic-ai/sdk";

// Reads ANTHROPIC_API_KEY from environment automatically
const client = new Anthropic();

const response = await client.messages.create({
  model: "claude-sonnet-4-6",
  max_tokens: 1024,
  messages: [
    { role: "user", content: "Hello, Claude!" }
  ],
});

console.log(response.content[0].text);
```

### 7.3 Model as a variable

```javascript
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

const MODELS = {
  opus:   "claude-opus-4-6",
  sonnet: "claude-sonnet-4-6",
  haiku:  "claude-haiku-4-5-20251001",
};

// Change this key to switch models
const selectedModel = MODELS.sonnet;

const response = await client.messages.create({
  model: selectedModel,
  max_tokens: 1024,
  messages: [
    { role: "user", content: "What model are you?" }
  ],
});

console.log(`Model used: ${response.model}`);
console.log(`Response: ${response.content[0].text}`);
```

### 7.4 Reusable function with model selection

```javascript
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

const MODELS = {
  opus:   "claude-opus-4-6",
  sonnet: "claude-sonnet-4-6",
  haiku:  "claude-haiku-4-5-20251001",
};

/**
 * Send a message to Claude and return the text response.
 * @param {string} userMessage     - The message to send
 * @param {string} modelKey        - One of 'opus', 'sonnet', 'haiku' or a full model string
 * @param {string|null} systemPrompt - Optional system context
 * @param {number} maxTokens       - Maximum response length
 * @returns {Promise<string>}
 */
async function chat(
  userMessage,
  modelKey = "sonnet",
  systemPrompt = null,
  maxTokens = 1024
) {
  const model = MODELS[modelKey] ?? modelKey;

  const params = {
    model,
    max_tokens: maxTokens,
    messages: [{ role: "user", content: userMessage }],
  };

  if (systemPrompt) params.system = systemPrompt;

  const response = await client.messages.create(params);
  return response.content[0].text;
}

// Usage
console.log(await chat("Hello!", "haiku"));
console.log(await chat("Explain quantum computing.", "opus"));
console.log(await chat("Hello!", "claude-sonnet-4-6")); // Full string also works
console.log(await chat(
  "What documents do I need?",
  "sonnet",
  "You are an expert in Spanish Digital Nomad Visa applications."
));
```

### 7.5 Environment variable model selection

```javascript
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

// Override model via env var, fallback to sonnet
const model = process.env.CLAUDE_MODEL ?? "claude-sonnet-4-6";

const response = await client.messages.create({
  model,
  max_tokens: 1024,
  messages: [{ role: "user", content: "Hello!" }],
});

console.log(response.content[0].text);
```

```bash
CLAUDE_MODEL=claude-haiku-4-5-20251001 node script.js
CLAUDE_MODEL=claude-opus-4-6 node script.js
```

---

## 8. System Prompts

A **system prompt** sets the context, persona, or rules for the assistant before the conversation begins. It is passed separately from the `messages` array and applies to the entire conversation.

```python
# Python
response = client.messages.create(
    model="claude-sonnet-4-6",
    max_tokens=1024,
    system="You are a luxury yacht rental specialist. Always respond in a professional and elegant tone.",
    messages=[
        {"role": "user", "content": "What's the best yacht for a 7-day Caribbean trip?"}
    ]
)
```

```javascript
// JavaScript
const response = await client.messages.create({
  model: "claude-sonnet-4-6",
  max_tokens: 1024,
  system: "You are a luxury yacht rental specialist. Always respond in a professional and elegant tone.",
  messages: [
    { role: "user", content: "What's the best yacht for a 7-day Caribbean trip?" }
  ],
});
```

**Tips for effective system prompts:**
- Be specific about the persona and tone
- Specify the output format if you need structured data (JSON, lists, etc.)
- Define what the assistant should NOT do
- Keep system prompts concise — they consume input tokens on every request

---

## 9. Multi-turn Conversations

Claude has **no memory between API calls**. To maintain a conversation, pass the full message history on each request. You are responsible for managing conversation state.

```python
# Python
import anthropic

client = anthropic.Anthropic()

conversation_history = []


def send_message(user_message: str, model: str = "claude-sonnet-4-6") -> str:
    """Send a message and maintain conversation history."""
    conversation_history.append({"role": "user", "content": user_message})

    response = client.messages.create(
        model=model,
        max_tokens=1024,
        messages=conversation_history
    )

    assistant_message = response.content[0].text
    conversation_history.append({"role": "assistant", "content": assistant_message})

    return assistant_message


# Simulated conversation
print(send_message("Hello! My name is Heverton."))
print(send_message("What is my name?"))  # Claude will remember "Heverton"
print(send_message("What have we talked about so far?"))
```

```javascript
// JavaScript
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();
const conversationHistory = [];

async function sendMessage(userMessage, model = "claude-sonnet-4-6") {
  conversationHistory.push({ role: "user", content: userMessage });

  const response = await client.messages.create({
    model,
    max_tokens: 1024,
    messages: conversationHistory,
  });

  const assistantMessage = response.content[0].text;
  conversationHistory.push({ role: "assistant", content: assistantMessage });

  return assistantMessage;
}

// Simulated conversation
console.log(await sendMessage("Hello! My name is Heverton."));
console.log(await sendMessage("What is my name?")); // Will remember "Heverton"
console.log(await sendMessage("What have we talked about so far?"));
```

> **Tip:** For long conversations, consider trimming old messages to stay within the context window. Always keep the system prompt and the most recent exchanges.

---

## 10. Streaming Responses

Streaming delivers the response token by token as it is generated, significantly improving perceived latency for longer responses.

```python
# Python — streaming
with client.messages.stream(
    model="claude-sonnet-4-6",
    max_tokens=1024,
    messages=[{"role": "user", "content": "Tell me a story about the sea."}]
) as stream:
    for text in stream.text_stream:
        print(text, end="", flush=True)
```

```javascript
// JavaScript — streaming
const stream = await client.messages.create({
  model: "claude-sonnet-4-6",
  max_tokens: 1024,
  stream: true,
  messages: [{ role: "user", content: "Tell me a story about the sea." }],
});

for await (const event of stream) {
  if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
    process.stdout.write(event.delta.text);
  }
}
```

```bash
# cURL — streaming
curl https://api.anthropic.com/v1/messages \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "content-type: application/json" \
  -d '{
    "model": "claude-sonnet-4-6",
    "max_tokens": 1024,
    "stream": true,
    "messages": [{ "role": "user", "content": "Tell me a story about the sea." }]
  }'
```

---

## 11. Error Handling

Always wrap API calls in try/catch blocks. Common HTTP status codes:

| Status | Meaning                                     |
|--------|---------------------------------------------|
| `400`  | Bad request — invalid parameters            |
| `401`  | Unauthorized — invalid or missing API key   |
| `429`  | Rate limit exceeded — slow down requests    |
| `529`  | API overloaded — retry after a short delay  |
| `500`  | Internal server error — retry after a delay |

```python
# Python
import anthropic

client = anthropic.Anthropic()

try:
    response = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=1024,
        messages=[{"role": "user", "content": "Hello!"}]
    )
    print(response.content[0].text)

except anthropic.AuthenticationError:
    print("Invalid API key. Check your ANTHROPIC_API_KEY.")

except anthropic.RateLimitError:
    print("Rate limit exceeded. Please wait and try again.")

except anthropic.APIStatusError as e:
    print(f"API error {e.status_code}: {e.message}")
```

```javascript
// JavaScript
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

try {
  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1024,
    messages: [{ role: "user", content: "Hello!" }],
  });
  console.log(response.content[0].text);

} catch (error) {
  if (error instanceof Anthropic.AuthenticationError) {
    console.error("Invalid API key. Check your ANTHROPIC_API_KEY.");
  } else if (error instanceof Anthropic.RateLimitError) {
    console.error("Rate limit exceeded. Please wait and try again.");
  } else if (error instanceof Anthropic.APIStatusError) {
    console.error(`API error ${error.status}: ${error.message}`);
  } else {
    throw error;
  }
}
```

---

# Part 2 — Batch API (50% Cost Reduction)

---

## 12. How the Batch API Works

Instead of sending one request and waiting for a response, with the Batch API you:

1. **Submit** a batch of up to 10,000 requests in a single API call
2. **Receive** a `batch_id` immediately (requests queue in the background)
3. **Poll** the batch status until it returns `ended`
4. **Download** all results at once via a results endpoint

```
Your App  →  POST /v1/messages/batches       →  { batch_id }
                                                      ↓  (async, up to 24h)
Your App  ←  GET  /v1/messages/batches/{id}  ←  status: ended
Your App  ←  GET  /v1/messages/batches/{id}/results  ←  all responses (JSONL)
```

**Quality is 100% identical** to standard calls. Same model, same inference, same outputs. The only difference is that you don't wait in real time.

---

## 13. When to Use Batches

**✅ Perfect for:**
- Generating descriptions for hundreds of product or service listings
- Classifying or tagging large datasets
- Translating content in bulk
- Extracting structured data from many documents
- Running evaluations or test suites
- Pre-generating content that does not need to be real-time
- Any task where a delay of minutes to a few hours is acceptable

**❌ Not suitable for:**
- Real-time user-facing chat interfaces
- Tasks requiring immediate responses
- Requests that depend on the output of a previous request within the same batch

---

## 14. Batch Limitations

| Parameter              | Limit                        |
|------------------------|------------------------------|
| Requests per batch     | Up to **10,000**             |
| Batch processing time  | Up to **24 hours**           |
| Results availability   | **29 days** after creation   |
| Streaming support      | **Not available** in batches |
| Cost discount          | **50% off** standard pricing |

---

## 15. Batch Request Structure

Each batch is an array of **request objects**. Every request contains:

```json
{
  "custom_id": "unique-id-you-define",
  "params": {
    "model": "claude-sonnet-4-6",
    "max_tokens": 1024,
    "system": "Optional system prompt",
    "messages": [
      { "role": "user", "content": "Your message here" }
    ]
  }
}
```

- `custom_id` — your own identifier (any string), used to match results back to requests
- `params` — identical to the fields used in a standard `/v1/messages` request

---

## 16. cURL — Batch Examples

### 16.1 Submit a batch

```bash
curl https://api.anthropic.com/v1/messages/batches \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "anthropic-beta: message-batches-2024-09-24" \
  -H "content-type: application/json" \
  -d '{
    "requests": [
      {
        "custom_id": "request-001",
        "params": {
          "model": "claude-sonnet-4-6",
          "max_tokens": 1024,
          "messages": [
            { "role": "user", "content": "Describe a luxury yacht in 3 sentences." }
          ]
        }
      },
      {
        "custom_id": "request-002",
        "params": {
          "model": "claude-sonnet-4-6",
          "max_tokens": 1024,
          "messages": [
            { "role": "user", "content": "Describe a private jet in 3 sentences." }
          ]
        }
      }
    ]
  }'
```

### 16.2 Check batch status

```bash
BATCH_ID="msgbatch_01..."

curl "https://api.anthropic.com/v1/messages/batches/$BATCH_ID" \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "anthropic-beta: message-batches-2024-09-24"
```

### 16.3 Download results

```bash
curl "https://api.anthropic.com/v1/messages/batches/$BATCH_ID/results" \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "anthropic-beta: message-batches-2024-09-24"
```

---

## 17. Python — Batch Examples

### 17.1 Submit a batch

```python
import anthropic

client = anthropic.Anthropic()

# Build requests list
requests = [
    {
        "custom_id": f"product-{i}",
        "params": {
            "model": "claude-sonnet-4-6",
            "max_tokens": 512,
            "system": "You write luxury product descriptions in 2 sentences.",
            "messages": [
                {"role": "user", "content": f"Write a description for product #{i}"}
            ]
        }
    }
    for i in range(1, 101)  # 100 requests in one batch
]

# Submit
batch = client.beta.messages.batches.create(requests=requests)

print(f"Batch ID: {batch.id}")
print(f"Status:   {batch.processing_status}")
print(f"Counts:   {batch.request_counts}")
# Save batch.id — you will need it to retrieve results
```

### 17.2 Poll until complete and download results

```python
import anthropic
import time

client = anthropic.Anthropic()


def wait_for_batch(batch_id: str, poll_interval: int = 60) -> None:
    """
    Poll a batch until it finishes, then print all results.

    Args:
        batch_id:      The batch ID returned when submitting
        poll_interval: Seconds between status checks (default: 60)
    """
    print(f"Waiting for batch {batch_id}...")

    while True:
        batch = client.beta.messages.batches.retrieve(batch_id)
        status = batch.processing_status
        counts = batch.request_counts

        print(f"  Status: {status} | Processing: {counts.processing} | "
              f"Succeeded: {counts.succeeded} | Errored: {counts.errored}")

        if status == "ended":
            break

        time.sleep(poll_interval)

    print("\nBatch complete. Downloading results...\n")

    for result in client.beta.messages.batches.results(batch_id):
        custom_id = result.custom_id

        if result.result.type == "succeeded":
            text = result.result.message.content[0].text
            print(f"[{custom_id}] {text}\n")

        elif result.result.type == "errored":
            error = result.result.error
            print(f"[{custom_id}] ERROR: {error.type} — {error.message}\n")

        elif result.result.type == "expired":
            print(f"[{custom_id}] EXPIRED — resubmit this request\n")


# Usage
wait_for_batch("msgbatch_01...")
```

### 17.3 Full production-ready pipeline

```python
import anthropic
import time
import json
from pathlib import Path

client = anthropic.Anthropic()

MODELS = {
    "opus":   "claude-opus-4-6",
    "sonnet": "claude-sonnet-4-6",
    "haiku":  "claude-haiku-4-5-20251001",
}


def build_batch_requests(items: list[dict], model_key: str = "sonnet") -> list[dict]:
    """
    Convert a list of items into batch request format.

    Each item should have:
      - id:           unique identifier (will become custom_id)
      - prompt:       the user message
      - system:       (optional) system prompt override
      - max_tokens:   (optional) defaults to 512
    """
    model = MODELS.get(model_key, model_key)

    return [
        {
            "custom_id": str(item["id"]),
            "params": {
                "model": model,
                "max_tokens": item.get("max_tokens", 512),
                "system": item.get("system", "You are a helpful assistant."),
                "messages": [
                    {"role": "user", "content": item["prompt"]}
                ]
            }
        }
        for item in items
    ]


def submit_batch(items: list[dict], model_key: str = "sonnet") -> str:
    """Submit items as a batch and return the batch ID."""
    requests = build_batch_requests(items, model_key)
    batch = client.beta.messages.batches.create(requests=requests)
    print(f"Batch submitted: {batch.id} ({len(requests)} requests)")
    return batch.id


def fetch_results(batch_id: str, poll_interval: int = 30) -> dict[str, str]:
    """
    Wait for a batch to complete and return results as { custom_id: response_text }.
    """
    while True:
        batch = client.beta.messages.batches.retrieve(batch_id)

        if batch.processing_status == "ended":
            break

        counts = batch.request_counts
        print(f"  Processing... ({counts.processing} pending, "
              f"{counts.succeeded} done, {counts.errored} errors)")
        time.sleep(poll_interval)

    results = {}
    errors  = {}

    for result in client.beta.messages.batches.results(batch_id):
        if result.result.type == "succeeded":
            results[result.custom_id] = result.result.message.content[0].text
        else:
            errors[result.custom_id] = result.result.type

    if errors:
        print(f"  Warning: {len(errors)} failed: {list(errors.keys())}")

    print(f"  Done: {len(results)} results retrieved.")
    return results


def save_results(results: dict, output_path: str) -> None:
    """Save results to a JSON file."""
    Path(output_path).write_text(json.dumps(results, indent=2, ensure_ascii=False))
    print(f"Results saved to {output_path}")


# ─── Example usage ─────────────────────────────────────────────────────────────

items = [
    {
        "id": "yacht-001",
        "prompt": "Write a 2-sentence luxury description for a 40ft sailing yacht.",
        "system": "You write elegant descriptions for a luxury yacht marketplace.",
    },
    {
        "id": "yacht-002",
        "prompt": "Write a 2-sentence luxury description for a 60ft motor yacht.",
        "system": "You write elegant descriptions for a luxury yacht marketplace.",
    },
    {
        "id": "jet-001",
        "prompt": "Write a 2-sentence description for a Cessna Citation private jet.",
        "system": "You write premium descriptions for a private aviation marketplace.",
    },
]

batch_id = submit_batch(items, model_key="sonnet")
results  = fetch_results(batch_id, poll_interval=30)
save_results(results, "batch_results.json")

print(results["yacht-001"])
print(results["jet-001"])
```

---

## 18. JavaScript — Batch Examples

### 18.1 Submit a batch

```javascript
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

const MODELS = {
  opus:   "claude-opus-4-6",
  sonnet: "claude-sonnet-4-6",
  haiku:  "claude-haiku-4-5-20251001",
};

// Build requests array
const requests = Array.from({ length: 100 }, (_, i) => ({
  custom_id: `product-${i + 1}`,
  params: {
    model: MODELS.sonnet,
    max_tokens: 512,
    system: "You write luxury product descriptions in 2 sentences.",
    messages: [
      { role: "user", content: `Write a description for product #${i + 1}` }
    ],
  },
}));

// Submit
const batch = await client.beta.messages.batches.create({ requests });

console.log(`Batch ID: ${batch.id}`);
console.log(`Status:   ${batch.processing_status}`);
// Save batch.id — you will need it to retrieve results
```

### 18.2 Poll until complete and download results

```javascript
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

async function waitForBatch(batchId, pollInterval = 60000) {
  console.log(`Waiting for batch ${batchId}...`);

  while (true) {
    const batch = await client.beta.messages.batches.retrieve(batchId);
    const { processing_status, request_counts } = batch;

    console.log(
      `  Status: ${processing_status} | ` +
      `Processing: ${request_counts.processing} | ` +
      `Succeeded: ${request_counts.succeeded} | ` +
      `Errored: ${request_counts.errored}`
    );

    if (processing_status === "ended") break;

    await new Promise((resolve) => setTimeout(resolve, pollInterval));
  }

  console.log("\nBatch complete. Downloading results...\n");

  const results = {};

  for await (const result of await client.beta.messages.batches.results(batchId)) {
    const { custom_id, result: res } = result;

    if (res.type === "succeeded") {
      results[custom_id] = res.message.content[0].text;
      console.log(`[${custom_id}] ${results[custom_id]}\n`);
    } else if (res.type === "errored") {
      console.error(`[${custom_id}] ERROR: ${res.error.type}\n`);
    } else if (res.type === "expired") {
      console.warn(`[${custom_id}] EXPIRED — resubmit this request\n`);
    }
  }

  return results;
}

// Usage
const results = await waitForBatch("msgbatch_01...");
```

### 18.3 Full production-ready pipeline

```javascript
import Anthropic from "@anthropic-ai/sdk";
import { writeFileSync } from "fs";

const client = new Anthropic();

const MODELS = {
  opus:   "claude-opus-4-6",
  sonnet: "claude-sonnet-4-6",
  haiku:  "claude-haiku-4-5-20251001",
};

/**
 * Convert items array into batch request format.
 * Each item: { id, prompt, system?, max_tokens? }
 */
function buildBatchRequests(items, modelKey = "sonnet") {
  const model = MODELS[modelKey] ?? modelKey;

  return items.map((item) => ({
    custom_id: String(item.id),
    params: {
      model,
      max_tokens: item.max_tokens ?? 512,
      system: item.system ?? "You are a helpful assistant.",
      messages: [{ role: "user", content: item.prompt }],
    },
  }));
}

/** Submit items as a batch and return the batch ID. */
async function submitBatch(items, modelKey = "sonnet") {
  const requests = buildBatchRequests(items, modelKey);
  const batch = await client.beta.messages.batches.create({ requests });
  console.log(`Batch submitted: ${batch.id} (${requests.length} requests)`);
  return batch.id;
}

/** Wait for batch to complete and return results as { custom_id: text }. */
async function fetchResults(batchId, pollInterval = 30000) {
  while (true) {
    const batch = await client.beta.messages.batches.retrieve(batchId);

    if (batch.processing_status === "ended") break;

    const { processing, succeeded, errored } = batch.request_counts;
    console.log(
      `  Processing... (${processing} pending, ${succeeded} done, ${errored} errors)`
    );

    await new Promise((r) => setTimeout(r, pollInterval));
  }

  const results = {};
  const errors  = {};

  for await (const result of await client.beta.messages.batches.results(batchId)) {
    if (result.result.type === "succeeded") {
      results[result.custom_id] = result.result.message.content[0].text;
    } else {
      errors[result.custom_id] = result.result.type;
    }
  }

  if (Object.keys(errors).length > 0) {
    console.warn(`  Warning: ${Object.keys(errors).length} requests failed`);
  }

  console.log(`  Done: ${Object.keys(results).length} results retrieved.`);
  return results;
}

/** Save results to a JSON file. */
function saveResults(results, outputPath) {
  writeFileSync(outputPath, JSON.stringify(results, null, 2));
  console.log(`Results saved to ${outputPath}`);
}

// ─── Example usage ─────────────────────────────────────────────────────────────

const items = [
  {
    id: "yacht-001",
    prompt: "Write a 2-sentence luxury description for a 40ft sailing yacht.",
    system: "You write elegant descriptions for a luxury yacht marketplace.",
  },
  {
    id: "yacht-002",
    prompt: "Write a 2-sentence luxury description for a 60ft motor yacht.",
    system: "You write elegant descriptions for a luxury yacht marketplace.",
  },
  {
    id: "jet-001",
    prompt: "Write a 2-sentence description for a Cessna Citation private jet.",
    system: "You write premium descriptions for a private aviation marketplace.",
  },
];

const batchId = await submitBatch(items, "sonnet");
const results  = await fetchResults(batchId, 30000);
saveResults(results, "batch_results.json");

console.log(results["yacht-001"]);
console.log(results["jet-001"]);
```

---

## 19. Polling for Results

Since batches are asynchronous, you need to poll the status endpoint periodically. The `processing_status` field can return:

| Status        | Meaning                                            |
|---------------|----------------------------------------------------|
| `in_progress` | Requests are being processed                       |
| `ended`       | All requests finished (success, error, or expired) |

**Recommended polling intervals:**

| Batch size      | Poll interval  |
|-----------------|----------------|
| < 100 requests  | Every 10–30s   |
| 100–1,000       | Every 30–60s   |
| 1,000–10,000    | Every 60–300s  |

> Avoid polling too frequently — it wastes API quota and adds unnecessary load.

---

## 20. Processing Results

Results are delivered in **JSONL format** (one JSON object per line). Each result contains:

```json
{
  "custom_id": "your-id",
  "result": {
    "type": "succeeded",
    "message": {
      "content": [{ "type": "text", "text": "The response here..." }],
      "usage": { "input_tokens": 45, "output_tokens": 120 }
    }
  }
}
```

Possible `result.type` values:

| Type        | Meaning                                                              |
|-------------|----------------------------------------------------------------------|
| `succeeded` | Request completed — text is at `result.message.content[0].text`    |
| `errored`   | Request failed — check `result.error.type` and `result.error.message` |
| `expired`   | Request did not process within 24h — resubmit if needed             |

Always handle all three cases in your results loop.

---

## 21. Real-World Use Cases

### Generate descriptions for 500 boat listings

```python
import anthropic, time, json

client = anthropic.Anthropic()

# Load from your database or CSV
listings = [
    {"id": "boat-001", "name": "Sea Spirit 40",    "type": "Sailboat",    "length": 40},
    {"id": "boat-002", "name": "Blue Horizon 60",  "type": "Motor Yacht", "length": 60},
    # ... up to 10,000
]

requests = [
    {
        "custom_id": listing["id"],
        "params": {
            "model": "claude-sonnet-4-6",
            "max_tokens": 300,
            "system": "You write luxury descriptions for a Brazilian yacht marketplace. Write in English. Be elegant and concise.",
            "messages": [{
                "role": "user",
                "content": f"Write a 3-sentence rental description for: {listing['name']}, a {listing['length']}ft {listing['type']}."
            }]
        }
    }
    for listing in listings
]

batch = client.beta.messages.batches.create(requests=requests)
print(f"Submitted {len(requests)} listings. Batch ID: {batch.id}")
```

### Classify and tag customer messages at scale

```python
# Use haiku for classification — cheapest and fast enough
requests = [
    {
        "custom_id": f"msg-{msg['id']}",
        "params": {
            "model": "claude-haiku-4-5-20251001",
            "max_tokens": 60,
            "system": 'Classify the user intent. Reply ONLY with valid JSON: {"intent": "...", "urgency": "low|medium|high"}',
            "messages": [{"role": "user", "content": msg["text"]}]
        }
    }
    for msg in customer_messages
]
```

### Translate content in bulk

```python
languages = ["Portuguese", "Spanish", "French"]

requests = []
for item in content_items:
    for lang in languages:
        requests.append({
            "custom_id": f"{item['id']}-{lang.lower()}",
            "params": {
                "model": "claude-haiku-4-5-20251001",
                "max_tokens": 1024,
                "system": f"Translate the following text to {lang}. Output only the translation, nothing else.",
                "messages": [{"role": "user", "content": item["text"]}]
            }
        })
```

---

## 22. Cost Comparison

The Batch API provides a flat **50% discount** on all token pricing.

| Scenario                          | Standard API | Batch API | Savings |
|-----------------------------------|--------------|-----------|---------|
| 10,000 product descriptions       | $10.00       | $5.00     | $5.00   |
| 100,000 classifications (haiku)   | $2.50        | $1.25     | $1.25   |
| 1,000 long-form articles (opus)   | $150.00      | $75.00    | $75.00  |

> Prices are illustrative. See [anthropic.com/pricing](https://www.anthropic.com/pricing) for current token rates.

**When to use Standard API vs Batch API:**

| Criteria                    | Standard API | Batch API   |
|-----------------------------|:------------:|:-----------:|
| Real-time response needed   | ✅           | ❌          |
| User is waiting for reply   | ✅           | ❌          |
| Processing > 10 items       | ✅           | ✅          |
| Processing > 100 items      | ❌           | ✅          |
| Delay of hours acceptable   | ❌           | ✅          |
| Cost is a priority          | ❌           | ✅          |

---

# Part 3 — General Best Practices

---

## 23. Best Practices

### Security
- Always store your API key in environment variables, never in source code
- Use `.env` files locally (`python-dotenv` for Python, `dotenv` for Node.js) and always add `.env` to `.gitignore`
- Rotate your API key immediately if it is ever exposed in a repository or log

### Model selection
- Default to `sonnet` for most tasks — best balance of quality and speed
- Use `haiku` for classification, extraction, tagging, or any high-volume repetitive task
- Reserve `opus` for tasks requiring deep reasoning, complex analysis, or long-form structured outputs

### Prompt design
- Write specific, focused system prompts — they consume input tokens on every request
- Specify the output format explicitly when you need structured data (JSON, lists, etc.)
- Use `temperature: 0` for deterministic outputs (classification, extraction); higher values for creative tasks

### Token management
- Set `max_tokens` conservatively — you are charged for tokens generated
- Monitor `response.usage.input_tokens` and `response.usage.output_tokens` to track costs
- For multi-turn conversations, trim old messages when history grows long to avoid hitting context limits

### Batch API specifics
- Use meaningful `custom_id` values like `listing-{db_id}` or `user-{uuid}-task` for easy result mapping
- Save the `batch_id` to persistent storage before your script exits — results are available for 29 days
- Always handle all three result types: `succeeded`, `errored`, and `expired`
- Collect failed `custom_id`s and resubmit them in a new batch rather than reprocessing everything
- For datasets larger than 10,000 items, split into multiple batches of 10,000 each

### Performance
- Use streaming for real-time chat interfaces to improve perceived latency
- Use the Batch API whenever a delay of minutes to hours is acceptable — it cuts costs in half
- Cache system prompts in your application layer if they are reused across many users or calls

---

## 24. Resources

| Resource                    | URL                                                                 |
|-----------------------------|---------------------------------------------------------------------|
| Anthropic Documentation     | https://docs.claude.com                                             |
| API Reference               | https://docs.anthropic.com/en/api                                   |
| Batch API Reference         | https://docs.anthropic.com/en/api/creating-message-batches         |
| Prompt Engineering Guide    | https://docs.claude.com/en/docs/build-with-claude/prompt-engineering/overview |
| Anthropic Console           | https://console.anthropic.com                                       |
| Pricing                     | https://www.anthropic.com/pricing                                   |
| Python SDK                  | https://github.com/anthropics/anthropic-sdk-python                 |
| Node.js SDK                 | https://github.com/anthropics/anthropic-sdk-node                   |
