import json
from typing import Any, Dict, List, Optional
from sqlalchemy.orm import Session

from app.services.llm_service import call_llm, parse_json_from_llm
from app.services.schema_provider import SchemaProvider

def analyze_query(user_question: str, db_session: Session, context: Optional[List[Dict[str, Any]]] = None) -> Dict[str, Any]:
    """
    Master Analyst function that holistically evaluates the user query, context, and schema.
    Returns a unified execution plan containing intent, extracted entities, and action payloads.
    """
    schema_provider = SchemaProvider.from_session(db_session)
    schema_desc = schema_provider.generate_prompt_description()

    history_str = ""
    if context:
        formatted = []
        for msg in context:
            role = "User" if msg.get("role") == "user" else "Assistant"
            content = msg.get("content", "")
            if content:
                formatted.append(f"{role}: {content}")
        if formatted:
            history_str = "\nCONVERSATION HISTORY:\n" + "\n".join(formatted) + "\n"

    prompt = f"""You are the Master Analyst for MARS, an MLOps platform chatbot.
Your task is to analyze the user's query and the conversation history to determine their EXACT intent, extract relevant entities (models, factories, algorithms), and formulate an execution plan.

{history_str}

DATABASE SCHEMA FOR CONTEXT:
{schema_desc}

POSSIBLE INTENTS:
1. DATABASE_QUERY: Wants to query the database (e.g., list models, count versions, find the most accurate model).
2. ACTION_QUERY: Wants to perform an action (e.g., download zip/report, compare models/versions, create/edit/delete an entity).
3. KNOWLEDGE_QUERY: Wants to ask a general AI/ML concept or definition (e.g., "What is RAG?").
4. AMBIGUOUS: The query is fundamentally unclear, or it uses pronouns/references that cannot be confidently resolved from the history, or it refers to multiple potential entities without specifying which one (e.g. "compare them", "download version 3").

INSTRUCTIONS:
- Analyze the user question and context.
- Extract any mentioned models, factories, or algorithms (resolve pronouns if applicable). You MUST aggressively extract proper nouns, technical terms, and descriptive keywords (e.g., 'intrusion', 'yolo', 'suwon', 'v11') into the `entities` arrays. If the user mentions a term, do NOT leave the array empty.
- If the user asks to 'compare', 'contrast', 'diff', or asks for a 'comparison', you MUST classify the intent as ACTION_QUERY and set `action_details.action` to 'compare_versions'. Do NOT classify it as a DATABASE_QUERY.
- If the user asks to 'download', 'export', or get a 'zip' or 'report', you MUST classify the intent as ACTION_QUERY and set `action_details.action` to the appropriate download type. Do NOT classify it as a DATABASE_QUERY.
- If the User Question is a direct answer clarifying a previous Assistant question (e.g., providing a missing factory name like "suwon"), you MUST inherit the intent of the original question being clarified, extract the newly provided entities alongside the previously established ones, and generate a `resolved_question` that combines the history into a complete standalone question.
- HOWEVER, if the User Question is asking a new question, asking for help, or asking for clarification (e.g., "which factories are those?", "what do you mean?"), you MUST evaluate it on its own merits as a DATABASE_QUERY or KNOWLEDGE_QUERY, and DO NOT inherit the previous ACTION_QUERY intent.
- If no clarification from history is needed, simply set `resolved_question` to the user's exact original question.
- If the intent is AMBIGUOUS, you MUST provide a `clarification_question` to ask the user.
- If the intent is ACTION_QUERY, you MUST populate `action_details`.
- Respond with a single JSON object (no markdown formatting, no explanation).

JSON SCHEMA:
{{
  "intent": "DATABASE_QUERY" | "ACTION_QUERY" | "KNOWLEDGE_QUERY" | "AMBIGUOUS" | "UNSUPPORTED",
  "resolved_question": "string",
  "clarification_question": "string or null",
  "entities": {{
    "models": ["List of extracted model names"],
    "factories": ["List of extracted factory names"],
    "algorithms": ["List of extracted algorithm names"]
  }},
  "action_details": {{
    "action": "download_report" | "download_zip" | "compare_versions" | "interactive_create" | "interactive_edit" | "interactive_delete" | "none",
    "entity_type": "model" | "algorithm" | "factory" | "version" | null,
    "compare_scope": "models" | "versions" | null,
    "targets": [
      {{"name": "extracted entity name", "version": "version number (integer) or null"}}
    ]
  }}
}}

User Question: "{user_question}"
Output JSON:"""

    raw_response = call_llm(prompt, temperature=0.0)
    parsed = parse_json_from_llm(raw_response)
    
    if not parsed:
        return {
            "intent": "DATABASE_QUERY",
            "resolved_question": user_question,
            "clarification_question": None,
            "entities": {"models": [], "factories": [], "algorithms": []},
            "action_details": {}
        }
    return parsed
