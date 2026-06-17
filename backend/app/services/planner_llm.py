import os
import json
import re
from pydantic import BaseModel
from typing import Optional, List, Dict, Any

class QueryTask(BaseModel):
    type: str  # e.g. metadata, comparison, analytics, version_history, relationship, download, knowledge
    entity_types: List[str] = []
    entity_names: List[str] = []
    metric: Optional[str] = None
    operation: Optional[str] = None
    filters: Dict = {}
    confidence: float = 1.0

class QueryPlan(BaseModel):
    tasks: List[QueryTask] = []
    confidence: float = 1.0

def generate_query_plan_llm(question: str) -> Optional[QueryPlan]:
    prompt = f"""You are a Query Planner for MARS, an MLOps platform.
Analyze the user's natural language question and convert it into a structured query plan in JSON format.
If the question asks for multiple distinct things (e.g. comparing model performance AND explaining a concept like precision), split them into multiple tasks.

Supported task types:
- metadata: For queries asking about model description, information, creation date, deployment, active versions, e.g., "tell me about model yolov11", "show all models".
- comparison: For queries comparing two or more models, versions, factories, or algorithms, e.g., "Compare YOLOv11 in beijing and YOLOv11 in Bhushan".
- analytics: For queries asking for top/best/worst performing, averages, rankings, above/below metric thresholds, e.g., "Which model has highest precision?".
- version_history: For queries asking about versions or lineage of a model, e.g., "show version history of R2+1D".
- relationship: For queries comparing factories, models, algorithms, e.g., "compare the Bhushan model with suwon model in FAS".
- download: For queries requesting to download or export reports, e.g., "download report of yolov11".
- knowledge: For conceptual questions, definitions, explanations of ML metrics or concepts, e.g., "What is accuracy?".

Constraints:
- Return ONLY a valid JSON object. Do not include any explanation, markdown formatting, or SQL queries.
- The planner must never generate SQL.

The JSON output must have the following structure:
{{
  "tasks": [
    {{
      "type": "<one of the supported task types>",
      "entity_types": ["model" | "version" | "factory" | "algorithm"],
      "entity_names": ["<extracted entity names, e.g., R2+1D, yolov11, Bhushan, Suwon>"],
      "metric": "<precision | accuracy | recall | f1_score | inference_time | cpu_utilization | gpu_utilization | None>",
      "operation": "<ranking | comparison | export | definition | metadata | None>",
      "filters": {{}},
      "confidence": 1.0
    }}
  ],
  "confidence": 1.0
}}

User Question: "{question}"
Output:"""

    try:
        from app.services.llm_service import call_llm
        response_str = call_llm(prompt, temperature=0.0)
        if response_str == "__LLM_OFFLINE__" or not response_str.strip():
            return None
            
        # Clean markdown code block if present
        if response_str.startswith("```json"):
            response_str = response_str[7:]
        elif response_str.startswith("```"):
            response_str = response_str[3:]
        if response_str.endswith("```"):
            response_str = response_str[:-3]
        response_str = response_str.strip()
        
        data = json.loads(response_str)
        plan = QueryPlan(**data)
        return plan
    except Exception as e:
        print(f"[QueryPlanner] LLM planner failed or returned invalid JSON ({e}). Falling back to rules.")
        return None


DOWNLOAD_KEYWORDS = [
    "download", "export", "generate report", "create report", "get report",
    "save report", "download report", "export report", "report for",
    "factory report", "algorithm report", "model report",
]

ANALYTICS_KEYWORDS = [
    "top", "best", "highest", "lowest", "worst", "rank", "ranking",
    "most accurate", "most precise", "fastest", "slowest",
    "above", "below", "greater than", "less than", "over", "under",
    "average", "avg", "mean", "leaderboard", "benchmark", "dominates", "leader", "strongest"
]

CONCEPTUAL_PATTERNS = [
    r"\bwhat is\b",
    r"\bexplain\b(?!\s+the\s+model)(?!\s+this\s+model)",
    r"\bhow does .* work\b",
    r"\bdefine\b",
    r"\bwhat does .* mean\b",
    r"\bwhat are\b",
    r"\btell me about\b",
]

def generate_query_plan_fallback(question: str, entities: Dict[str, Any]) -> QueryPlan:
    q = question.lower()
    
    # 1. Download
    requires_download = any(re.search(rf"\b{re.escape(kw)}\b", q) for kw in DOWNLOAD_KEYWORDS)
    
    # 2. Comparison
    distinct_models = {m["name"].lower() for m in entities.get("models", [])}
    distinct_factories = {f["name"].lower() for f in entities.get("factories", [])}
    distinct_algorithms = {a["name"].lower() for a in entities.get("algorithms", [])}
    requires_comparison = any(re.search(rf"\b{re.escape(kw)}\b", q) for kw in [
        "compare", "comparison", "versus", " vs ", "difference between",
        "which is better", "how does", " vs.", "against", "side by side",
    ]) or len(distinct_models) >= 2 or len(distinct_factories) >= 2 or len(distinct_algorithms) >= 2
    
    # 3. Analytics
    requires_analytics = any(re.search(rf"\b{re.escape(kw)}\b", q) for kw in ANALYTICS_KEYWORDS) or any(re.search(rf"\b{re.escape(w)}\b", q) for w in [
        "best", "worst", "top", "bottom", "highest", "lowest", "rank", "ranking", "average", "avg", "mean"
    ])
    
    # 4. Explanation
    requires_explanation = any(re.search(rf"\b{re.escape(w)}\b", q) for w in ["explain", "why", "explanation", "meaning", "definition"])
    
    # 5. Check if it's a version history / lineage query
    is_lineage = any(re.search(rf"\b{re.escape(phrase)}\b", q) for phrase in [
        "evolution of", "model progression", "progression of", "model evolution",
        "improved accuracy most", "improved precision most", "improved recall most", "improved f1 most", "improved latency most",
        "what changed between", "changes between v", "change between v", "compare all versions", "compare every version"
    ]) or ("compare" in q and "version" in q and "evolution" in q)
    
    has_version_comp_phrase = any(re.search(rf"\b{re.escape(phrase)}\b", q) for phrase in [
        "compare versions", "compare every version", 
        "version comparison", "compare model evolution"
    ])
    
    is_version_history = any(re.search(rf"\b{re.escape(kw)}\b", q) for kw in [
        "history", "evolution", "trend", "progress", "over time",
        "across version", "all version", "every version",
    ])
    
    requires_lineage = is_lineage or has_version_comp_phrase or is_version_history
    
    # 6. DB
    has_entities = bool(entities.get("models") or entities.get("factories") or entities.get("algorithms"))
    
    is_conceptual_query = False
    for pat in CONCEPTUAL_PATTERNS:
        if re.search(pat, q):
            is_conceptual_query = True
            break
            
    is_pure_conceptual = not has_entities and is_conceptual_query and not requires_analytics and not requires_comparison and not requires_download and not requires_lineage
    requires_db = not is_pure_conceptual
    
    # 7. Knowledge
    requires_knowledge = (
        requires_explanation or 
        (any(re.search(rf"\b{re.escape(w)}\b", q) for w in ["what is", "how do", "define", "what does", "what are", "tell me about"]) and not has_entities) or 
        is_pure_conceptual
    )
    
    # 8. Clarification check
    has_target_type = any(re.search(rf"\b{re.escape(w)}\b", q) for w in ["model", "models", "algorithm", "algorithms", "factory", "factories"])
    is_ambiguous = (requires_comparison or requires_analytics) and not has_entities and not has_target_type and not is_conceptual_query
    
    if is_ambiguous:
        return QueryPlan(
            tasks=[QueryTask(type="clarification")],
            confidence=0.5
        )
    
    entity_names = []
    entity_types = []
    for m in entities.get("models", []):
        entity_names.append(m["name"])
        entity_types.append("model")
    for f in entities.get("factories", []):
        entity_names.append(f["name"])
        entity_types.append("factory")
    for a in entities.get("algorithms", []):
        entity_names.append(a["name"])
        entity_types.append("algorithm")

    tasks = []
    
    if requires_db and requires_knowledge:
        db_intent = "metadata"
        if requires_download:
            db_intent = "download"
        elif requires_lineage:
            db_intent = "version_history"
        elif requires_comparison:
            db_intent = "comparison"
        elif requires_analytics:
            db_intent = "analytics"
            
        tasks.append(QueryTask(
            type=db_intent,
            entity_types=entity_types,
            entity_names=entity_names,
            metric=entities.get("metric"),
            operation="ranking" if requires_analytics else ("comparison" if requires_comparison else None),
            filters={}
        ))
        tasks.append(QueryTask(
            type="knowledge",
            entity_types=[],
            entity_names=[],
            filters={}
        ))
    else:
        intent = "metadata"
        if requires_download:
            intent = "download"
        elif requires_lineage:
            intent = "version_history"
        elif requires_comparison:
            intent = "comparison"
        elif requires_analytics:
            intent = "analytics"
        elif requires_knowledge:
            intent = "knowledge"
            
        tasks.append(QueryTask(
            type=intent,
            entity_types=entity_types,
            entity_names=entity_names,
            metric=entities.get("metric"),
            operation="ranking" if requires_analytics else ("comparison" if requires_comparison else None),
            filters={}
        ))

    plan = QueryPlan(
        tasks=tasks,
        confidence=1.0
    )
    return plan

def generate_query_plan(question: str, entities: Dict[str, Any]) -> QueryPlan:
    plan = generate_query_plan_llm(question)
    if plan is not None:
        return plan
    return generate_query_plan_fallback(question, entities)

def requires_db(plan: QueryPlan) -> bool:
    for t in plan.tasks:
        if t.type != "knowledge":
            return True
    return False

def requires_knowledge(plan: QueryPlan) -> bool:
    for t in plan.tasks:
        if t.type == "knowledge":
            return True
    return False

def requires_comparison(plan: QueryPlan) -> bool:
    for t in plan.tasks:
        if t.type == "comparison":
            return True
    return False

def requires_analytics(plan: QueryPlan) -> bool:
    for t in plan.tasks:
        if t.type == "analytics":
            return True
    return False

def requires_explanation(plan: QueryPlan) -> bool:
    for t in plan.tasks:
        if t.type == "knowledge":
            return True
    return False

def requires_download(plan: QueryPlan) -> bool:
    for t in plan.tasks:
        if t.type == "download":
            return True
    return False

def get_steps(plan: QueryPlan) -> List[str]:
    steps = []
    req_db = requires_db(plan)
    req_download = requires_download(plan)
    req_knowledge = requires_knowledge(plan)
    req_comparison = requires_comparison(plan)
    req_analytics = requires_analytics(plan)
    req_explanation = requires_explanation(plan)
    
    if req_db:
        if req_download:
            steps.append("Identify target entity for report generation")
            steps.append("Query database for matching entity records")
            steps.append("Generate CSV report and build download payload")
        else:
            steps.append("Identify target entities and metric parameters")
            if req_comparison:
                steps.append("Query database for comparison details between entities")
            elif req_analytics:
                steps.append("Query database and perform analytical ranking/averages")
            else:
                steps.append("Query database for metadata and deployment details")
    
    if req_knowledge:
        if req_explanation:
            steps.append("Retrieve explanation and detailed definition from knowledge resource")
        else:
            steps.append("Retrieve definition from conceptual metric glossary")
    steps.append("Format response and present to user")
    return steps
