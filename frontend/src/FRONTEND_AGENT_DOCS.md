# Frontend Agent Integration Guide

This document outlines how the frontend should interact with the **Agentic-RAG-Rust-Core** pipeline, specifically focusing on the SSE (Server-Sent Events) streaming protocol and the multi-agent state machine.

---

## 1. Connection Lifecycle

The frontend initiates an agentic run via the `/query/stream` endpoint.

**Endpoint:** `POST /query/stream`
**Payload:**
```json
{
  "question": "What are the performance metrics of the Rust core?",
  "top_k": 3,
  "mode": "agentic",
  "min_score": 0.7,
  "max_attempts": 3,
  "return_trace": true
}
```

---

## 2. SSE Event Schema

The stream emits multiple event types as the agents progress through the pipeline.

### `event: status`
Sent at the start and end of the session.
- **Data:** `{"state": "started"}`

### `event: trace`
Emitted by individual agents to report their internal logic and intermediate thoughts.
- **Agent Names:** `QueryRefiner`, `Retriever`, `Selector`, `Generator`, `Evaluator`, `UserProxy`
- **Data Structure:**
  ```json
  {
    "agent": "Retriever",
    "message": "Retrieved 15 candidates (top_n=15, top_k=3).",
    "data": { "query_used": "...", "top_n": 15, "top_k": 3 }
  }
  ```

### `event: retrieved`
Sent after the `Retriever` agent finishes. Contains the raw metadata of all candidate chunks.
- **Data Structure:**
  ```json
  {
    "items": [
      { "text": "...", "source": "paper.pdf", "page": 5, "distance": 0.1234 },
      ...
    ]
  }
  ```

### `event: answer`
Sent after the `Generator` agent completes the first draft of the answer.
- **Data Structure:**
  ```json
  {
    "answer": "The core performance is...",
    "model_used": "phi4-mini:3.8b"
  }
  ```

### `event: evaluation`
Sent after the `Evaluator` agent scores the answer for faithfulness and relevance.
- **Data Structure:**
  ```json
  {
    "score": 0.85,
    "summary": "The answer correctly references page 5...",
    "should_retry": false,
    "attempts": 1
  }
  ```

### `event: retry`
Sent if the score is below `min_score` and `attempts < max_attempts`. The pipeline will reset to the `QueryRefiner` step.
- **Data Structure:**
  ```json
  { "attempts": 1, "score": 0.45 }
  ```

### `event: final`
The final state of the request, containing all cumulative data.
- **Data Structure:** Matches the `QueryResponse` Pydantic model.

---

## 3. Agent Execution Flow (State Machine)

The frontend should visualize these steps to provide a "transparent AI" experience:

1.  **Refiner**: The user query is rewritten for better searchability.
2.  **Retriever**: Vector DB (LanceDB) fetches `TOP_N` (e.g., 15) candidate passages.
3.  **Selector (DPS)**: *[New]* An LLM (e.g., Qwen 3B) selects the most relevant `TOP_K` (e.g., 3-5) passages from the 15 candidates.
4.  **Generator**: The answer is synthesized based on selected chunks.
5.  **Evaluator**: The answer is cross-checked against source text. If it fails, the loop restarts.

---

## 4. UI Implementation Tips

- **Trace Logs**: Use a "Terminal" or "Log" style component to show `trace` events in real-time.
- **Provenance Highlighting**: When an answer is received, use the `retrieved` items to show which PDF pages were cited.
- **Progress Bar**: Map the agent names to a step-indicator (1. Refining -> 2. Searching -> 3. Filtering -> 4. Drafting -> 5. Verifying).
- **Retry Indicator**: If a `retry` event occurs, show a notification like "Score low, refining strategy and retrying..." to manage user expectations.

---

## 5. Model Routing (Ollama Version)

If using `api_ollama.py`, the backend uses a tiered model strategy. The frontend doesn't need to specify these, but it's useful for "Model Badge" UI elements:
- **Refiner**: `qwen2.5:0.5b` (Fast)
- **Generator**: `qwen2.5:1.5b` (Creative)
- **Evaluator**: `qwen2.5:1.5b` (Analytical)
- **Selector**: `qwen2.5:3b` (Precise context selection)
