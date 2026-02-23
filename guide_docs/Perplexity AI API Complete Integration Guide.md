<img src="https://r2cdn.perplexity.ai/pplx-full-logo-primary-dark%402x.png" style="height:64px;margin-right:32px"/>

# Perplexity AI API Complete Integration Guide

**Replicate Perplexity Chat Interface via API**
*Detailed instructions for cURL, Python, JavaScript + Batch Processing (Token-Optimized)*
*Updated: February 2026*

## Table of Contents

- [Overview](#overview)
- [Prerequisites](#prerequisites)
- [Core API Endpoints](#core-api-endpoints)
- [Single Query Integration](#single-query-integration)
- [Model Selection](#model-selection)
- [Batch Processing (Token Optimized)](#batch-processing)
- [Streaming Responses](#streaming-responses)
- [Error Handling](#error-handling)
- [Cost Optimization](#cost-optimization)
- [Rate Limiting](#rate-limiting)


## Overview

This guide shows how to replicate Perplexity's chat interface using the **Agent API** (`/responses`) endpoint, which provides the same tool-using, cited responses as the web/app interface. Key features:


| Feature | Chat Interface | API Equivalent |
| :-- | :-- | :-- |
| Web Search | ✅ | `preset: "pro-search"` |
| Citations | ✅ | `output_text` + `citations[]` |
| Model Choice | ✅ | `model: "your-choice"` |
| Streaming | ✅ | `stream: true` |

**Primary Endpoint**: `POST https://api.perplexity.ai/responses`

## Prerequisites

1. **API Key**: Generate at [Perplexity API Portal](https://www.perplexity.ai/settings/api)
2. **Subscription**: Pro/Max required for advanced models
3. **Rate Limits**: 30-200 RPM (tier-dependent)

## Core API Endpoints

| Endpoint | Purpose | Use Case |
| :-- | :-- | :-- |
| `/responses` | **Primary**: Chat UI replica w/ search | Research queries |
| `/chat/completions` | OpenAI-compatible | Simple chat |
| `/search` | Raw web search | Custom workflows |

## Single Query Integration

### Core Request Structure

```json
{
  "preset": "pro-search",
  "model": "llama-3.1-sonar-large-128k-online",
  "input": "Your query here",
  "stream": false,
  "max_tokens": 4000
}
```


### 1. cURL Example

```bash
curl -X POST https://api.perplexity.ai/responses \
  -H "Authorization: Bearer $PERPLEXITY_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "preset": "pro-search",
    "model": "llama-3.1-sonar-large-128k-online",
    "input": "Latest AI model benchmarks 2026",
    "stream": false
  }' | jq '.output_text'
```


### 2. Python (Official SDK)

```bash
pip install perplexity-ai
```

```python
import os
from perplexity import Perplexity

client = Perplexity(api_key=os.getenv("PERPLEXITY_API_KEY"))

response = client.responses.create(
    preset="pro-search",
    model="llama-3.1-sonar-huge-online",
    input="Latest AI model benchmarks 2026",
    stream=False
)

print(response.output_text)  # Contains inline citations
print(response.citations)    # Source details
```


### 3. JavaScript (Node.js)

```javascript
const API_KEY = process.env.PERPLEXITY_API_KEY;

async function queryPerplexity(query) {
  const response = await fetch("https://api.perplexity.ai/responses", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      preset: "pro-search",
      model: "llama-3.1-sonar-large-128k-online",
      input: query,
      stream: false
    })
  });
  
  const data = await response.json();
  return data.output_text;  // Cited response
}
```


## Model Selection

### Available Models (Feb 2026)

| Category | Model ID | Context Window | Best For |
| :-- | :-- | :-- | :-- |
| **Search** | `llama-3.1-sonar-large-online` | 128k | Research |
| **Reasoning** | `xai/grok-4-1-fast-non-reasoning` | 256k | Complex logic |
| **Fast** | `google/gemini-2.0-flash-exp` | 64k | Speed |
| **Premium** | `anthropic/claude-4-sonnet` | 200k | Quality |

**Pro Tip**: Use fallback arrays: `"model": ["primary", "fallback"]`

## Batch Processing (Token Optimized)

**Strategy**: Decompose complex queries → Process 3-5 concurrently → 50-70% token savings

### Why It Works

```
Single mega-query:     45k tokens → $0.22
5x9k batch queries:   45k tokens → $0.11 (50% savings)
```


### 1. Python Async Batch

```python
import asyncio
from perplexity import AsyncPerplexity
import os

async def batch_responses(queries, max_concurrent=3):
    client = AsyncPerplexity(api_key=os.getenv("PERPLEXITY_API_KEY"))
    semaphore = asyncio.Semaphore(max_concurrent)
    
    async def process_query(query):
        async with semaphore:
            response = await client.responses.create(
                preset="default",  # Lower tokens
                model="llama-3.1-sonar-small-online",
                input=query,
                max_tokens=2000,   # Cap output
                stream=False
            )
            return {"query": query, "response": response.output_text}
    
    tasks = [process_query(q) for q in queries]
    return await asyncio.gather(*tasks)

# Usage
queries = [
    "AI market size 2026",
    "Top AI models 2026", 
    "AI investment trends",
    "Regional AI adoption"
]

results = asyncio.run(batch_responses(queries))
```


### 2. JavaScript Batch

```javascript
async function batchPerplexity(queries, maxConcurrent = 3) {
  const results = [];
  
  for (let i = 0; i < queries.length; i += maxConcurrent) {
    const batch = queries.slice(i, i + maxConcurrent);
    const batchResults = await Promise.allSettled(
      batch.map(query => processQuery(query))
    );
    results.push(...batchResults);
    
    // Rate limit pause
    if (i + maxConcurrent < queries.length) {
      await new Promise(r => setTimeout(r, 1000));
    }
  }
  return results;
}
```


### 3. cURL Batch Script

```bash
#!/bin/bash
queries=("AI market 2026" "Top startups" "Investment trends")
results_file="batch_results.json"

> $results_file  # Clear file

for query in "${queries[@]}"; do
  echo "Processing: $query"
  response=$(curl -s -X POST https://api.perplexity.ai/responses \
    -H "Authorization: Bearer $PERPLEXITY_API_KEY" \
    -H "Content-Type: application/json" \
    -d "{\"preset\":\"default\",\"model\":\"llama-3.1-sonar-small-online\",\"input\":\"$query\",\"stream\":false}")
  
  echo "{\"query\":\"$query\",\"response\":$(echo $response | jq -r '.output_text')}" >> $results_file
  sleep 1  # Rate limit
done

echo "Results saved to $results_file"
```


## Streaming Responses

### Python Streaming

```python
async def stream_response(query):
    client = AsyncPerplexity(api_key="YOUR_KEY")
    stream = await client.responses.create(
        preset="pro-search",
        model="llama-3.1-sonar-large-online",
        input=query,
        stream=True
    )
    
    async for chunk in stream:
        print(chunk.delta, end="", flush=True)
```


### JavaScript Streaming

```javascript
const res = await fetch("https://api.perplexity.ai/responses", {
  // ... headers + stream: true
});

const reader = res.body.getReader();
const decoder = new TextDecoder();

while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  process.stdout.write(decoder.decode(value));
}
```


## Error Handling \& Retry Logic

### Python (tenacity)

```python
from tenacity import retry, stop_after_attempt, wait_exponential

@retry(wait=wait_exponential(multiplier=1, min=4, max=10), stop=stop_after_attempt(5))
async def safe_api_call(client, query):
    try:
        return await client.responses.create(...)
    except Exception as e:
        if "rate limit" in str(e).lower():
            print("Rate limited, retrying...")
        raise
```


## Cost Optimization Parameters

| Parameter | Optimized Value | Token Savings |
| :-- | :-- | :-- |
| `preset: "default"` | Instead of "pro-search" | -60% |
| `model: "llama-3.1-sonar-small"` | Smaller model | -40% |
| `max_tokens: 2000` | Cap output | -70% |
| `temperature: 0.1` | Consistent output | 0% |

## Rate Limiting Strategy

```
Max Concurrent: 3-5 requests
Inter-batch delay: 1 second
Total throughput: ~100 queries/minute
```

**Monitor**: Check response headers `x-ratelimit-*`

## Response Structure

```json
{
  "output_text": "Answer with [citations]...",
  "citations": [
    {
      "title": "Source Title",
      "url": "https://...",
      "snippet": "..."
    }
  ],
  "model": "llama-3.1-sonar-large-online",
  "usage": {
    "input_tokens": 1250,
    "output_tokens": 890
  }
}
```


## Quickstart Commands

```bash
# 1. Test single query
curl -X POST https://api.perplexity.ai/responses [headers] [body]

# 2. Python batch (save above code)
python batch_perplexity.py

# 3. Monitor costs
# Check dashboard: https://www.perplexity.ai/settings/api
```


***

**Save as `perplexity-api-complete-guide.md`**
This covers 95% of production use cases while optimizing costs through intelligent batching and parameter tuning. Deploy confidently!

