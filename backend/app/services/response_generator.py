import json
from typing import Any, Dict, List, Union
from app.services.llm_service import call_llm

def generate_response(
    user_question: str,
    generated_sql: str,
    query_results: Union[List[Dict[str, Any]], Dict[str, Any]],
    temperature: float = 0.3
) -> str:
    """
    Generates a natural language response explaining database query results.
    
    Responsibilities:
    1. Explain results in natural language.
    2. Summarize large result sets.
    3. Produce markdown tables when appropriate.
    4. Never expose internal schema unless requested.
    5. Never expose stack traces.
    
    Args:
        user_question: The original user question.
        generated_sql: The SQL query that was generated and executed.
        query_results: Raw query execution output (either a list of rows or execution dictionary).
        temperature: Model sampling temperature.
        
    Returns:
        The final markdown-formatted chatbot response string.
    """
    # Normalize results input
    if isinstance(query_results, dict):
        rows = query_results.get("rows", [])
    elif isinstance(query_results, list):
        rows = query_results
    else:
        rows = [query_results]
        
    # Serialize to JSON for prompt injection
    results_json = json.dumps(rows, default=str)
    
    prompt = f"""You are MIRA, an intelligent AI assistant for the MARS MLOps platform.
Your task is to answer the user's question by explaining the data in natural, friendly, and professional language.

USER QUESTION:
{user_question}

GENERATED SQL QUERY:
{generated_sql}

QUERY RESULTS (JSON):
{results_json}

INSTRUCTIONS:
1. Explain the results clearly in natural language relative to the user's question.
2. If the result set is large, summarize the key findings, trends, or top entries rather than printing every row.
3. When listing multiple factories, algorithms, or models, do NOT use tables. Use bulleted lists instead.
4. For each factory, algorithm, or model in the list, format its name as a clickable Markdown hyperlink to its overview page. You MUST use this exact syntax: `[Name](URL)`. For example, `[Suwon Factory](/factories/12)`. NEVER print raw URL routes or plain paths like `/factories/12` directly in the text. Use these exact URL structures:
   - Factory: `/factories/{{id}}`
   - Algorithm: `/algorithms/{{id}}/factories`
   - Model: `/algorithms/{{algorithm_id}}/factories/{{factory_id}}/models/{{id}}`
   (Note: Use the actual numeric IDs from the JSON results in the URLs, e.g., `/factories/1`).
5. NEVER display database IDs, primary keys, or foreign key IDs (like model_id, algorithm_id, factory_id, version_id) anywhere in the visible conversational text of the response (e.g., do NOT say 'factory 3', 'algorithm 15', 'model 9901'). If you need to refer to a factory, algorithm, or model, use its name. If the name is not present in the database results, refer to it without its ID (e.g., 'the associated factory') or omit it; NEVER print the raw numeric ID. IDs should ONLY be used behind the scenes inside the Markdown URLs.
6. Produce markdown tables ONLY for comparisons (e.g., comparing metrics across models or versions).
7. Do NOT mention internal database schema details (such as database table names, column names, join conditions, schema keys) unless the user explicitly asked for them. Translate them into user-friendly business terms (e.g. instead of 'model_versions table', use 'model versions').
8. NEVER expose any database stack traces, raw SQL execution errors, or internal technical code details.
9. Provide a concise, professional answer.
10. Do NOT mention or explain SQL limits, query restrictions, or technical pagination details (e.g., 'limited to the first 100 entries', 'query limits') in the conversational response. Keep the explanation user-friendly and business-focused.
11. Do NOT refer to internal database operations or technical terms such as 'the query', 'the database query', 'the SQL execution', 'database results', or 'records returned' in the visible text of your response. Speak directly about the real-world business items instead (e.g., say 'Here are the models...', 'The active version is...', rather than 'The query returned the active version').
12. Be extremely concise, direct, and conversational. Do NOT output long preambles, verbose explanations, or unnecessary details unless explicitly requested. Aim for a response length of 1 to 3 short paragraphs max.
13. If the user is asking to download, export, or generate a report/ZIP file (e.g. "download report of model R2+1D"), the platform will automatically present a download button alongside your response. Therefore, do NOT say "let me know if you want me to generate/download it" or offer to create it. Instead, simply give a brief overview of the requested item (such as its name, description, active status, or key metrics) and mention that the download button has been generated.

Response:"""

    response = call_llm(prompt, temperature=temperature)
    if response == "__LLM_OFFLINE__":
        return generate_offline_db_response(user_question, generated_sql, rows)
    return response.strip()

def generate_offline_db_response(user_question: str, generated_sql: str, rows: List[Dict[str, Any]]) -> str:
    """Generates a structured markdown answer from SQL results when the LLM is offline/rate-limited."""
    lines = []
    if not rows:
        lines.append("I found no records matching your query in the database repository.")
    else:
        lines.append("Here is the information I retrieved from the database repository:")
        for r in rows:
            items = []
            for k, v in r.items():
                if k.lower() in ("id", "algorithm_id", "factory_id", "model_id", "version_id"):
                    continue
                k_clean = k.replace("_", " ").title()
                q_lower = user_question.lower()
                if k_clean == "Count" and ("model" in q_lower or "how many" in q_lower):
                    k_clean = "Model(s) Count"
                items.append(f"**{k_clean}**: {v}")
            lines.append(f"- " + ", ".join(items))
            
    # Include concept explanations if matching glossary terms are found in the query
    glossary = {
        "accuracy": "**Accuracy** measures the percentage of correct predictions out of all predictions made. Formula: `(TP + TN) / (TP + TN + FP + FN)`.",
        "precision": "**Precision** measures how many of the model's positive predictions were actually correct. Formula: `TP / (TP + FP)`. High precision means fewer false alarms.",
        "recall": "**Recall** (Sensitivity) measures how many actual positives the model correctly identified. Formula: `TP / (TP + FN)`. High recall means fewer missed detections.",
        "f1": "**F1 Score** is the harmonic mean of Precision and Recall. Formula: `2 * (Precision * Recall) / (Precision + Recall)`. Useful when classes are imbalanced.",
        "overfitting": "**Overfitting** occurs when a machine learning model learns the training data too well, capturing noise and details that do not generalize to new, unseen data.",
        "confusion matrix": "A **Confusion Matrix** is a table showing the performance of a classification model by comparing actual values (True Positive, True Negative) with predicted values (False Positive, False Negative)."
    }
    
    q_lower = user_question.lower()
    explanations = []
    for term, definition in glossary.items():
        if term in q_lower:
            explanations.append(definition)
            
    if explanations:
        lines.append("\n### 📖 Concept Explanation")
        for exp in explanations:
            lines.append(exp)
            
    return "\n".join(lines)
