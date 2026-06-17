import time
import re
import json
from typing import Any, Dict, List, Optional, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import text

from app.services.planner_llm import QueryPlan, QueryTask, generate_query_plan
from app.services.response_generator import generate_response_llm
from app.services.llm_service import call_llm

from app.services.sql_agent import (
    AliasCache,
    ContextMemory,
    EntityExtractor,
    _PRONOUN_PATTERNS,
    resolve_context_rules,
    get_cache_provider,
    check_metric_ambiguity,
    check_ambiguity,
    
    _run_download,
    VersionLineageIntent,
    METRIC_ALIASES,
    _METRIC_DEFINITIONS,
    _KNOWLEDGE_OFFLINE_GLOSSARY,
    _execute_sql,
    _enrich,
    _format_list,
    _format_metadata_factory,
    _format_metadata_algorithm,
    _format_single_version_detail,
    _format_metadata_model,
    _format_version_history,
    _determine_comparison_type,
    compare_factory_vs_algorithm,
    compare_factory_vs_model,
    compare_algorithm_vs_model,
    _format_comparison_factories,
    _format_comparison_algorithms,
    _format_models_in_group,
    _format_cross_factory_model_comparison,
    _format_comparison_models,
    parse_ranking_params,
    SQLTemplateRegistry,
    _format_analytics,
    
    deterministic_verify,
    generate_follow_ups,
    IntentType,
    ComparisonType
)

def run_sql_agent(
    user_question: str,
    db_session: Session,
    context: List[Dict] = [],
) -> Dict[str, Any]:
    """
    Production Hardened AI Agent (MIRA) Entrypoint.
    Provides database grounding, SQL-injection prevention, observability, and deterministic validation.
    """
    start_time = time.time()
    
    # 0. Startup Setup
    AliasCache.initialize(db_session)

    # 0.5 Check if previous message was a download prompt or a metric clarification prompt
    last_bot_msg = None
    original_user_msg = None
    if context:
        for idx in range(len(context) - 1, -1, -1):
            if context[idx].get("role") == "bot":
                last_bot_msg = context[idx].get("content", "")
                if idx > 0 and context[idx-1].get("role") == "user":
                    original_user_msg = context[idx-1].get("content", "")
                break

    is_download_followup = bool(last_bot_msg and "<!-- DOWNLOAD_PROMPT:" in last_bot_msg)
    is_metric_clarification_reply = bool(
        last_bot_msg and
        "Should I rank by Accuracy, Precision, Recall, or F1 Score?" in last_bot_msg and
        user_question.strip().lower() in (
            "accuracy", "precision", "recall", "f1", "f1 score", "f1_score",
            "inference time", "inference_time", "latency", "cpu", "gpu", "cpu_utilization", "gpu_utilization"
        )
    )

    # 1. Stateful Context Resolution (Rules first)
    extractor = EntityExtractor(db_session)
    has_pronoun = any(re.search(p, user_question.lower()) for p in _PRONOUN_PATTERNS)
    
    if is_download_followup:
        resolved_q = user_question
        context_conf = 1.0
    elif is_metric_clarification_reply and original_user_msg:
        resolved_q = f"{original_user_msg} by {user_question}"
        context_conf = 1.0
    else:
        context_memory = ContextMemory.build_from_context(context, extractor)
        resolved_q, context_conf = resolve_context_rules(user_question, context_memory)

    if has_pronoun and context_conf < 0.8:
        return {
            "answer": "Could you please specify which model, factory, or algorithm you are referring to?",
            "type": "text"
        }

    # Cache key based on resolved query
    cache_key = f"q:{resolved_q.strip().lower()}"
    cached_response = get_cache_provider().get(cache_key)
    if cached_response:
        execution_ms = int((time.time() - start_time) * 1000)
        print(f"[Observability] [Cache Hit] resolved_q='{resolved_q}' | Time={execution_ms}ms")
        return cached_response

    # 2. Query Planner Layer
    if is_download_followup:
        plan = QueryPlan(tasks=[QueryTask(type="download")], confidence=1.0)
    else:
        raw_entities = extractor.extract(resolved_q, plan=None)
        plan = generate_query_plan(resolved_q, raw_entities)

    # Observability Logging (as requested in requirement 5)
    print(f"[Observability] user query: {user_question}")
    print(f"[Observability] planner output: {plan}")
    for task in plan.tasks:
        print(f"[Observability] selected task: {task}")
        
    # 2.5 Entity Resolver (Entity extraction uses planner output)
    entities = extractor.extract(resolved_q, plan=plan)

    # Determine extraction confidence
    extractor_conf = 1.0
    all_matched_entities = entities["models"] + entities["factories"] + entities["algorithms"]
    if all_matched_entities:
        # Score is based on worst match score
        extractor_conf = min(e.get("score", 1.0) for e in all_matched_entities)

    # Combined internal confidence score
    confidence = min(extractor_conf, plan.confidence)

    # 3. Metric Ambiguity Extraction (if single task is analytics/ranking)
    task = plan.tasks[0] if plan.tasks else QueryTask(type="metadata")
    if len(plan.tasks) == 1:
        metric_clarification = check_metric_ambiguity(resolved_q, task.type, entities)
        if metric_clarification:
            return metric_clarification

        name_clarification = check_ambiguity(resolved_q, entities, task.type)
        if name_clarification:
            return name_clarification

    # 4. Dispatch the QueryPlan to the query dispatcher
    result = dispatch_query_plan(plan, entities, resolved_q, db_session, context, confidence)

    get_cache_provider().set(cache_key, result)
    execution_ms = int((time.time() - start_time) * 1000)
    print(f"[Observability] [Dispatch] {task.type if plan.tasks else 'empty'} | [Time] {execution_ms}ms | [Confidence] {confidence:.2f}")
    return result

def dispatch_task(
    task: QueryTask,
    entities: Dict,
    question: str,
    db: Session,
    context: List[Dict] = []
) -> Optional[Dict[str, Any]]:
    q    = question.lower()
    facs = entities["factories"]
    algs = entities["algorithms"]
    mods = entities["models"]
    vers = entities["version_numbers"]
    met  = entities["metric"]
    lim  = entities["limit"]
    groups = entities.get("groups", [])

    # ── DOWNLOAD ──
    if task.type == "download":
        return _run_download(question, db, entities, context)

    # ── CLARIFICATION ──
    if task.type == "clarification":
        return {
            "answer": "Do you want to compare models, algorithms, or factories?",
            "type": "text",
            "follow_ups": ["List all models", "List all factories", "Top 5 models by accuracy"]
        }

    # ── VERSION LINEAGE / VERSION HISTORY ──
    if task.type == "version_history":
        return VersionLineageIntent.process(question, entities, db)

    # ── KNOWLEDGE / CONCEPTUAL ──
    if task.type in ("knowledge", "conceptual"):
        # Collect ALL metrics mentioned in the question (not just the first)
        metric_hits: List[str] = []
        _seen_canonicals: set = set()
        for alias, canonical in METRIC_ALIASES.items():
            if canonical not in _seen_canonicals and re.search(rf"\b{re.escape(alias)}\b", q):
                metric_hits.append(canonical)
                _seen_canonicals.add(canonical)
        # Also check canonical names not covered by aliases
        for canonical in ["accuracy", "precision", "recall", "f1_score", "inference_time",
                          "cpu_utilization", "gpu_utilization"]:
            if canonical not in _seen_canonicals and canonical.replace("_", " ") in q:
                metric_hits.append(canonical)
                _seen_canonicals.add(canonical)

        # Filter to those that have definitions
        metric_hits = [m for m in metric_hits if m in _METRIC_DEFINITIONS]

        if len(metric_hits) >= 2:
            # Multi-metric response (e.g. "difference between accuracy and recall")
            parts = []
            for mh in metric_hits:
                parts.append(_METRIC_DEFINITIONS[mh])
            displays = [mh.replace("_", " ").title() for mh in metric_hits]
            display_list = ", ".join(displays)
            answer = (
                f"Here's a comparison of **{display_list}**:\n\n"
                + "\n\n---\n\n".join(parts)
                + "\n\n💡 *You can compare these metrics across models by asking:*\n"
                + f"- **Top 5 models by {displays[0].lower()}**\n"
                + f"- **Top 5 models by {displays[-1].lower()}**\n"
                + "- **Compare model X vs model Y**"
            )
            follow_ups = [
                f"Top 5 models by {displays[0].lower()}",
                f"Top 5 models by {displays[-1].lower()}",
                "List all models",
            ]
        elif len(metric_hits) == 1:
            # Single metric definition
            metric_hit = metric_hits[0]
            definition = _METRIC_DEFINITIONS[metric_hit]
            display = metric_hit.replace("_", " ").title()
            answer = (
                f"{definition}\n\n"
                f"💡 *In this platform, {display} is tracked for every model version. "
                f"You can ask me:*\n"
                f"- **Top 5 models by {display.lower()}**\n"
                f"- **Compare {display.lower()} across factories**\n"
                f"- **Best {display.lower()} model in Factory X**"
            )
            follow_ups = [
                f"Top 5 models by {display.lower()}",
                f"Which model has the highest {display.lower()}?",
                "List all models",
            ]
        else:
            # General knowledge question — call the LLM to give a real, concise answer.
            knowledge_prompt = (
                "You are MIRA, an AI assistant for the MARS MLOps platform. "
                "Answer the following question concisely and helpfully in 2-4 short paragraphs. "
                "Focus on what the technology/concept IS, why it matters, and any connection to "
                "ML/computer vision/model deployment if relevant. "
                "Do NOT mention that you are an LLM or that you are powered by any specific model.\n\n"
                f"Question: {question}\n\n"
                "Answer:"
            )
            llm_answer = call_llm(knowledge_prompt, temperature=0.3)
            if llm_answer and llm_answer != "__LLM_OFFLINE__":
                answer = llm_answer
            else:
                def lookup_knowledge_offline(question: str) -> str:
                    q_lower = question.lower()
                    for term, definition in _KNOWLEDGE_OFFLINE_GLOSSARY.items():
                        if term == "f1":
                            if "f1" in q_lower:
                                return definition
                        elif term in q_lower:
                            return definition
                    return ("I'm currently offline and unable to fetch a detailed explanation. "
                            "You can try asking me about platform-specific metrics like accuracy, precision, or recall, "
                            "or ask about models, factories, and algorithms in this platform.")
                answer = lookup_knowledge_offline(question)
            
            # Generate follow-up suggestions, filtering out the current question
            follow_ups = []
            q_lower = question.lower()
            for sug in [
                "What is accuracy?",
                "What is precision?",
                "Explain recall.",
                "What is F1 score?",
                "What is overfitting?",
                "Explain confusion matrix."
            ]:
                term = ""
                if "accuracy" in sug.lower(): term = "accuracy"
                elif "precision" in sug.lower(): term = "precision"
                elif "recall" in sug.lower(): term = "recall"
                elif "f1" in sug.lower(): term = "f1"
                elif "overfitting" in sug.lower(): term = "overfitting"
                elif "confusion matrix" in sug.lower(): term = "confusion matrix"
                
                if term and term in q_lower:
                    continue
                follow_ups.append(sug)

        return {
            "answer": answer,
            "type": "text",
            "confidence": 1.0,
            "follow_ups": follow_ups,
        }

    # ── METADATA ──
    if task.type == "metadata":
        # 1. Determine what the user is explicitly asking *about* — the PRIMARY subject.
        target = None
        _ENTITY_RE = r"(models?|factor(?:y|ies)|algorithms?|algos?)"
        subj_match = re.search(
            r"(?:list|show|what|which|get|find|display|tell)\s+(?:all\s+)?(?:the\s+)?(?:me\s+)?"
            + _ENTITY_RE, q
        )
        if subj_match:
            subj = subj_match.group(1)
            if "model" in subj:
                target = "model"
            elif "factor" in subj:
                target = "factory"
            else:
                target = "algorithm"
        else:
            # Fallback: first entity-type keyword found anywhere in the question
            if re.search(r"\bfactor(?:y|ies)\b", q):
                target = "factory"
            elif re.search(r"\b(?:algorithm|algorithms|algo|algos)\b", q):
                target = "algorithm"
            elif re.search(r"\bmodels?\b", q):
                target = "model"

        # Also detect secondary entity types mentioned (used as filters)
        _has_factory_word = bool(re.search(r"\bfactor(?:y|ies)\b", q))
        _has_algo_word    = bool(re.search(r"\b(?:algorithm|algorithms|algo|algos)\b", q))
        _has_model_word   = bool(re.search(r"\bmodels?\b", q))
        
        # 2. Sub-handlers for grouped relationships
        # Factories in an algorithm
        if target == "factory" and (algs or re.search(r"\b(?:algorithm|algo|algos)\b", q)):
            aid = None
            algo_name = None
            if algs:
                aid = algs[0]["id"]
                algo_name = algs[0]["name"]
            elif mods:
                for m in mods:
                    check = db.execute(text(
                        "SELECT id, name FROM algorithms WHERE LOWER(name) = LOWER(:n) LIMIT 1"
                    ), {"n": m["name"]}).fetchone()
                    if check:
                        aid = check[0]; algo_name = check[1]; break
            if aid:
                rows, _ = _execute_sql("""
                    SELECT f.id, f.name, f.description, COUNT(m.id) as model_count
                    FROM factories f
                    JOIN models m ON m.factory_id = f.id
                    WHERE m.algorithm_id = :aid
                    GROUP BY f.id, f.name, f.description
                """, db, {"aid": aid})
                if rows:
                    result = _format_list(_enrich(rows, "factories", db), "factories")
                    result["answer"] = (
                        f"Here are the factories using the **{algo_name}** algorithm:\n\n"
                        + result.get("answer", "")
                    )
                    return result
                return {
                    "answer": f"No factories found using the **{algo_name}** algorithm.",
                    "type": "text",
                    "follow_ups": ["List all factories", "List all algorithms"],
                }
            # No specific algorithm identified — list all factories instead
            rows, err = _execute_sql("""
                SELECT f.id, f.name, f.description, f.created_at,
                       COUNT(DISTINCT m.id) AS total_models
                FROM factories f
                LEFT JOIN models m ON m.factory_id = f.id
                GROUP BY f.id, f.name, f.description, f.created_at
                ORDER BY f.name;
            """, db)
            if not err and rows:
                return _format_list(_enrich(rows, "factories", db), "factories")

        # Algorithms in a factory
        if target == "algorithm" and (facs or re.search(r"\bfactor(?:y|ies)\b", q)):
            fid = None
            fac_name = None
            if facs:
                fid = facs[0]["id"]
                fac_name = facs[0]["name"]
            elif mods:
                for m in mods:
                    check = db.execute(text(
                        "SELECT id, name FROM factories WHERE LOWER(name) = LOWER(:n) LIMIT 1"
                    ), {"n": m["name"]}).fetchone()
                    if check:
                        fid = check[0]; fac_name = check[1]; break
            if fid:
                rows, _ = _execute_sql("""
                    SELECT a.id, a.name, a.description, COUNT(m.id) as model_count
                    FROM algorithms a
                    JOIN models m ON m.algorithm_id = a.id
                    WHERE m.factory_id = :fid
                    GROUP BY a.id, a.name, a.description
                """, db, {"fid": fid})
                if rows:
                    result = _format_list(_enrich(rows, "algorithms", db), "algorithms")
                    result["answer"] = (
                        f"Here are the algorithms used in **{fac_name}** factory:\n\n"
                        + result.get("answer", "")
                    )
                    return result
                return {
                    "answer": f"No algorithms found in the **{fac_name}** factory.",
                    "type": "text",
                    "follow_ups": ["List all factories", "List all algorithms"],
                }
            # No specific factory identified — list all algorithms instead
            rows, err = _execute_sql("""
                SELECT a.id, a.name, a.description, a.created_at,
                       COUNT(DISTINCT m.id) AS total_models
                FROM algorithms a
                LEFT JOIN models m ON m.algorithm_id = a.id
                GROUP BY a.id, a.name, a.description, a.created_at
                ORDER BY a.name;
            """, db)
            if not err and rows:
                return _format_list(_enrich(rows, "algorithms", db), "algorithms")

        # Models in a factory
        if target == "model" and (_has_factory_word or facs):
            fid = None
            fac_name = None
            if facs:
                fid = facs[0]["id"]
                fac_name = facs[0]["name"]
            elif mods:
                for m in mods:
                    check = db.execute(text(
                        "SELECT id, name FROM factories WHERE LOWER(name) = LOWER(:n) LIMIT 1"
                    ), {"n": m["name"]}).fetchone()
                    if check:
                        fid = check[0]; fac_name = check[1]; break
            if fid:
                rows, _ = _execute_sql("""
                    SELECT m.id, m.name AS model_name,
                           a.name AS algorithm_name, a.id AS algorithm_id,
                           f.name AS factory_name, f.id AS factory_id,
                           COUNT(mv.id) AS total_versions,
                           ROUND(MAX(mv.accuracy)::numeric, 2) AS best_accuracy,
                           ROUND(MAX(mv.f1_score)::numeric, 3) AS best_f1
                    FROM models m
                    LEFT JOIN algorithms a ON a.id = m.algorithm_id
                    LEFT JOIN factories f ON f.id = m.factory_id
                    LEFT JOIN model_versions mv ON mv.model_id = m.id
                    WHERE m.factory_id = :fid
                    GROUP BY m.id, m.name, a.name, a.id, f.name, f.id
                    ORDER BY m.name;
                """, db, {"fid": fid})
                if rows:
                    result = _format_list(_enrich(rows, "models", db), "models")
                    result["answer"] = (
                        f"Here are all the models in **{fac_name}** factory:\n\n"
                        + result.get("answer", "")
                    )
                    return result
                return {
                    "answer": f"No models found in the **{fac_name}** factory.",
                    "type": "text",
                    "follow_ups": ["List all models", "List all factories"],
                }

        # Models in an algorithm
        if target == "model" and (_has_algo_word or algs):
            aid = None
            algo_name = None
            if algs:
                aid = algs[0]["id"]
                algo_name = algs[0]["name"]
            elif mods:
                for m in mods:
                    check = db.execute(text(
                        "SELECT id, name FROM algorithms WHERE LOWER(name) = LOWER(:n) LIMIT 1"
                    ), {"n": m["name"]}).fetchone()
                    if check:
                        aid = check[0]; algo_name = check[1]; break
            if aid:
                rows, _ = _execute_sql("""
                    SELECT m.id, m.name AS model_name,
                           a.name AS algorithm_name, a.id AS algorithm_id,
                           f.name AS factory_name, f.id AS factory_id,
                           COUNT(mv.id) AS total_versions,
                           ROUND(MAX(mv.accuracy)::numeric, 2) AS best_accuracy,
                           ROUND(MAX(mv.f1_score)::numeric, 3) AS best_f1
                    FROM models m
                    LEFT JOIN algorithms a ON a.id = m.algorithm_id
                    LEFT JOIN factories f ON f.id = m.factory_id
                    LEFT JOIN model_versions mv ON mv.model_id = m.id
                    WHERE m.algorithm_id = :aid
                    GROUP BY m.id, m.name, a.name, a.id, f.name, f.id
                    ORDER BY m.name;
                """, db, {"aid": aid})
                if rows:
                    result = _format_list(_enrich(rows, "models", db), "models")
                    result["answer"] = (
                        f"Here are all the models using the **{algo_name}** algorithm:\n\n"
                        + result.get("answer", "")
                    )
                    return result
                return {
                    "answer": f"No models found using the **{algo_name}** algorithm.",
                    "type": "text",
                    "follow_ups": ["List all models", "List all algorithms"],
                }

        # 3. Standard Listings / Detail Views
        if not facs and not algs and not mods:
            if target == "factory":
                rows, err = _execute_sql("SELECT id, name, description, created_at FROM factories", db)
                if not err and rows: return _format_list(_enrich(rows, "factories", db), "factories")
            if target == "algorithm":
                rows, err = _execute_sql("SELECT id, name, description, created_at FROM algorithms", db)
                if not err and rows: return _format_list(_enrich(rows, "algorithms", db), "algorithms")
            if target == "model":
                rows, err = _execute_sql("SELECT id, name, description, created_at FROM models", db)
                if not err and rows: return _format_list(_enrich(rows, "models", db), "models")
            return None

        # Factory Details
        if facs and not mods:
            fid = facs[0]["id"]
            rows, _ = _execute_sql("""
                SELECT f.id, f.name, f.description, f.created_at,
                       COUNT(DISTINCT m.id) AS total_models,
                       COUNT(DISTINCT m.algorithm_id) AS total_algorithms,
                       COUNT(DISTINCT mv.id) AS total_versions,
                       ROUND(AVG(mv.accuracy)::numeric, 2) AS avg_accuracy,
                       ROUND(MAX(mv.accuracy)::numeric, 2) AS best_accuracy,
                       ROUND(AVG(mv.f1_score)::numeric, 3) AS avg_f1,
                       ROUND(AVG(mv.inference_time)::numeric, 2) AS avg_inference_ms
                FROM factories f
                LEFT JOIN models m ON m.factory_id = f.id
                LEFT JOIN model_versions mv ON mv.model_id = m.id
                WHERE f.id = :fid
                GROUP BY f.id, f.name, f.description, f.created_at;
            """, db, {"fid": fid})
            mrows, _ = _execute_sql("""
                SELECT m.id, m.name AS model_name, a.name AS algorithm_name,
                       COUNT(mv.id) AS total_versions,
                       ROUND(MAX(mv.accuracy)::numeric, 2) AS best_accuracy
                FROM models m
                LEFT JOIN algorithms a ON a.id = m.algorithm_id
                LEFT JOIN model_versions mv ON mv.model_id = m.id
                WHERE m.factory_id = :fid
                GROUP BY m.id, m.name, a.name;
            """, db, {"fid": fid})
            return _format_metadata_factory(rows, _enrich(mrows, "models", db), entities)

        # Algorithm Details
        if algs and not mods and not facs:
            aid = algs[0]["id"]
            rows, _ = _execute_sql("""
                SELECT a.id, a.name, a.description, a.created_at,
                       COUNT(DISTINCT m.id) AS total_models,
                       COUNT(DISTINCT m.factory_id) AS total_factories,
                       COUNT(DISTINCT mv.id) AS total_versions,
                       ROUND(AVG(mv.accuracy)::numeric, 2) AS avg_accuracy,
                       ROUND(MAX(mv.accuracy)::numeric, 2) AS best_accuracy,
                       ROUND(AVG(mv.f1_score)::numeric, 3) AS avg_f1,
                       STRING_AGG(DISTINCT f.name, ', ') AS factory_names
                FROM algorithms a
                LEFT JOIN models m ON m.algorithm_id = a.id
                LEFT JOIN factories f ON f.id = m.factory_id
                LEFT JOIN model_versions mv ON mv.model_id = m.id
                WHERE a.id = :aid
                GROUP BY a.id, a.name, a.description, a.created_at;
            """, db, {"aid": aid})
            return _format_metadata_algorithm(rows, entities)

        # Model Details
        if mods and target not in ("factory", "algorithm"):
            mid = mods[0]["id"]
            version_ordinal = entities.get("version_ordinal")

            def _fetch_supplementary(model_id: int):
                cnt_row = db.execute(
                    text("SELECT COUNT(*) FROM model_versions WHERE model_id = :mid"),
                    {"mid": model_id}
                ).fetchone()
                total = int(cnt_row[0]) if cnt_row else 0
                dep_rows, _ = _execute_sql("""
                    SELECT mv.version_number, mv.note
                    FROM model_versions mv
                    WHERE mv.model_id = :mid AND mv.is_active = true
                    ORDER BY mv.version_number DESC
                    LIMIT 1;
                """, db, {"mid": model_id})
                dep = dep_rows[0] if dep_rows else None
                return total, dep

            _SV_SELECT = """
                SELECT mv.id, mv.version_number, mv.note, mv.is_active,
                       mv.accuracy, mv.precision, mv.recall, mv.f1_score,
                       mv.inference_time, mv.cpu_utilization, mv.gpu_utilization,
                       m.name AS model_name, m.id AS model_id,
                       a.name AS algorithm_name, f.name AS factory_name,
                       m.description
                FROM model_versions mv
                JOIN models m ON m.id = mv.model_id
                JOIN algorithms a ON a.id = m.algorithm_id
                JOIN factories f ON f.id = m.factory_id
                WHERE mv.model_id = :mid
            """

            if vers:
                rows, _ = _execute_sql(
                    _SV_SELECT + " AND mv.version_number = :vnum;",
                    db, {"mid": mid, "vnum": vers[0]}
                )
                if rows:
                    total, dep = _fetch_supplementary(mid)
                    return _format_single_version_detail(rows[0], total, dep, f"v{vers[0]}")
                rows, _ = _execute_sql("""
                    SELECT m.id AS model_id, m.name AS model_name, m.description, m.created_at,
                           a.name AS algorithm_name, f.name AS factory_name,
                           mv.id, mv.version_number, mv.is_active, mv.note,
                           mv.accuracy, mv.precision, mv.recall, mv.f1_score,
                           mv.inference_time, mv.cpu_utilization, mv.gpu_utilization,
                           mv.cpu_memory_usage, mv.gpu_memory_usage, mv.updated_at
                    FROM models m
                    JOIN algorithms a ON a.id = m.algorithm_id
                    JOIN factories f ON f.id = m.factory_id
                    LEFT JOIN model_versions mv ON mv.model_id = m.id
                    WHERE m.id = :mid
                    ORDER BY mv.version_number ASC;
                """, db, {"mid": mid})
                return _format_metadata_model(_enrich(rows, "versions", db), entities)

            elif version_ordinal in ("first", "earliest"):
                rows, _ = _execute_sql(
                    _SV_SELECT + " ORDER BY mv.version_number ASC LIMIT 1;",
                    db, {"mid": mid}
                )
                if rows:
                    total, dep = _fetch_supplementary(mid)
                    return _format_single_version_detail(rows[0], total, dep, "First")

            elif version_ordinal in ("last", "latest", "newest"):
                rows, _ = _execute_sql(
                    _SV_SELECT + " ORDER BY mv.version_number DESC LIMIT 1;",
                    db, {"mid": mid}
                )
                if rows:
                    total, dep = _fetch_supplementary(mid)
                    return _format_single_version_detail(rows[0], total, dep, "Latest")

            elif version_ordinal == "second":
                rows, _ = _execute_sql(
                    _SV_SELECT + " ORDER BY mv.version_number ASC LIMIT 1 OFFSET 1;",
                    db, {"mid": mid}
                )
                if rows:
                    total, dep = _fetch_supplementary(mid)
                    return _format_single_version_detail(rows[0], total, dep, "Second")

            elif version_ordinal == "third":
                rows, _ = _execute_sql(
                    _SV_SELECT + " ORDER BY mv.version_number ASC LIMIT 1 OFFSET 2;",
                    db, {"mid": mid}
                )
                if rows:
                    total, dep = _fetch_supplementary(mid)
                    return _format_single_version_detail(rows[0], total, dep, "Third")

            elif version_ordinal == "fourth":
                rows, _ = _execute_sql(
                    _SV_SELECT + " ORDER BY mv.version_number ASC LIMIT 1 OFFSET 3;",
                    db, {"mid": mid}
                )
                if rows:
                    total, dep = _fetch_supplementary(mid)
                    return _format_single_version_detail(rows[0], total, dep, "Fourth")

            elif version_ordinal == "fifth":
                rows, _ = _execute_sql(
                    _SV_SELECT + " ORDER BY mv.version_number ASC LIMIT 1 OFFSET 4;",
                    db, {"mid": mid}
                )
                if rows:
                    total, dep = _fetch_supplementary(mid)
                    return _format_single_version_detail(rows[0], total, dep, "Fifth")

            elif version_ordinal in ("previous", "older"):
                rows, _ = _execute_sql(
                    _SV_SELECT + " ORDER BY mv.version_number DESC LIMIT 1 OFFSET 1;",
                    db, {"mid": mid}
                )
                if rows:
                    total, dep = _fetch_supplementary(mid)
                    return _format_single_version_detail(rows[0], total, dep, "Previous")

            rows, _ = _execute_sql("""
                SELECT m.id AS model_id, m.name AS model_name, m.description, m.created_at,
                       a.name AS algorithm_name, f.name AS factory_name,
                       mv.id, mv.version_number, mv.is_active, mv.note,
                       mv.accuracy, mv.precision, mv.recall, mv.f1_score,
                       mv.inference_time, mv.cpu_utilization, mv.gpu_utilization,
                       mv.cpu_memory_usage, mv.gpu_memory_usage, mv.updated_at
                FROM models m
                JOIN algorithms a ON a.id = m.algorithm_id
                JOIN factories f ON f.id = m.factory_id
                LEFT JOIN model_versions mv ON mv.model_id = m.id
                WHERE m.id = :mid
                ORDER BY mv.version_number ASC;
            """, db, {"mid": mid})
            return _format_metadata_model(_enrich(rows, "versions", db), entities)

    # ── VERSION HISTORY ──
    if task.type == "version_history":
        if not mods: return None
        mid = mods[0]["id"]
        rows, _ = _execute_sql("""
            SELECT mv.id, mv.version_number, mv.note, mv.is_active,
                   mv.accuracy, mv.precision, mv.recall, mv.f1_score,
                   mv.inference_time, mv.cpu_utilization, mv.gpu_utilization,
                   mv.cpu_memory_usage, mv.gpu_memory_usage,
                   m.name AS model_name, m.id AS model_id,
                   m.algorithm_id, m.factory_id
            FROM model_versions mv
            JOIN models m ON m.id = mv.model_id
            WHERE mv.model_id = :mid
            ORDER BY mv.version_number ASC;
        """, db, {"mid": mid})
        return _format_version_history(_enrich(rows, "versions", db), entities)

    # ── COMPARISON & RELATIONSHIP ──
    if task.type in ("comparison", "relationship"):
        comp_type = _determine_comparison_type(question, entities)
        # Factory vs Factory
        if comp_type == ComparisonType.FACTORY_VS_FACTORY:
            fids = tuple(g["factory"]["id"] for g in groups if g.get("factory") is not None)[:4]
            if len(fids) >= 2:
                rows, _ = _execute_sql("""
                    SELECT f.id AS factory_id, f.name AS factory_name, f.description,
                           COUNT(DISTINCT m.id) AS total_models,
                           COUNT(DISTINCT m.algorithm_id) AS total_algorithms,
                           COUNT(DISTINCT mv.id) AS total_versions,
                           ROUND(AVG(mv.accuracy)::numeric, 2) AS avg_accuracy,
                           ROUND(MAX(mv.accuracy)::numeric, 2) AS best_accuracy,
                           ROUND(AVG(mv.f1_score)::numeric, 3) AS avg_f1,
                           ROUND(AVG(mv.inference_time)::numeric, 2) AS avg_inference_ms
                    FROM factories f
                    LEFT JOIN models m ON m.factory_id = f.id
                    LEFT JOIN model_versions mv ON mv.model_id = m.id
                    WHERE f.id IN :fids
                    GROUP BY f.id, f.name, f.description;
                """, db, {"fids": fids})
                return _format_comparison_factories(rows, entities)

        # Algorithm vs Algorithm
        if comp_type == ComparisonType.ALGORITHM_VS_ALGORITHM:
            aids = tuple(g["algorithm"]["id"] for g in groups if g.get("algorithm") is not None)[:4]
            if len(aids) >= 2:
                rows, _ = _execute_sql("""
                    SELECT a.id AS algorithm_id, a.name AS algorithm_name, a.description,
                           COUNT(DISTINCT m.id) AS total_models,
                           COUNT(DISTINCT m.factory_id) AS total_factories,
                           COUNT(DISTINCT mv.id) AS total_versions,
                           ROUND(AVG(mv.accuracy)::numeric, 2) AS avg_accuracy,
                           ROUND(MAX(mv.accuracy)::numeric, 2) AS best_accuracy,
                           ROUND(AVG(mv.f1_score)::numeric, 3) AS avg_f1,
                           ROUND(AVG(mv.inference_time)::numeric, 2) AS avg_inference_ms
                    FROM algorithms a
                    LEFT JOIN models m ON m.algorithm_id = a.id
                    LEFT JOIN model_versions mv ON mv.model_id = m.id
                    WHERE a.id IN :aids
                    GROUP BY a.id, a.name, a.description;
                """, db, {"aids": aids})
                return _format_comparison_algorithms(rows, entities)

        # Models in Algorithm
        if comp_type == ComparisonType.MODELS_IN_ALGORITHM:
            a_groups = [g for g in groups if g.get("algorithm") is not None]
            if a_groups:
                aid = a_groups[0]["algorithm"]["id"]
                fids = tuple(f["id"] for f in entities.get("factories", []))
                if fids:
                    rows, _ = _execute_sql("""
                        SELECT m.id AS model_id, m.name AS model_name,
                               a.name AS algorithm_name, a.id AS algorithm_id,
                               f.name AS factory_name, f.id AS factory_id,
                               mv.version_number AS best_version,
                               mv.version_number AS version_number,
                               mv.accuracy, mv.precision, mv.recall, mv.f1_score,
                               mv.inference_time, mv.cpu_utilization, mv.gpu_utilization
                        FROM models m
                        LEFT JOIN algorithms a ON a.id = m.algorithm_id
                        LEFT JOIN factories f ON f.id = m.factory_id
                        LEFT JOIN LATERAL (
                            SELECT version_number, accuracy, precision, recall, f1_score,
                                   inference_time, cpu_utilization, gpu_utilization
                            FROM model_versions WHERE model_id = m.id
                            ORDER BY is_active DESC, accuracy DESC NULLS LAST LIMIT 1
                        ) mv ON TRUE
                        WHERE m.algorithm_id = :aid AND m.factory_id IN :fids;
                    """, db, {"aid": aid, "fids": fids})
                    group_names = " and ".join(f["name"] for f in entities.get("factories", []))
                    return _format_models_in_group(_enrich(rows, "models", db), f"{a_groups[0]['algorithm']['name']} across factories {group_names}", "algorithm")
                else:
                    rows, _ = _execute_sql("""
                        SELECT m.id AS model_id, m.name AS model_name,
                               a.name AS algorithm_name, a.id AS algorithm_id,
                               f.name AS factory_name, f.id AS factory_id,
                               mv.version_number AS best_version,
                               mv.version_number AS version_number,
                               mv.accuracy, mv.precision, mv.recall, mv.f1_score,
                               mv.inference_time, mv.cpu_utilization, mv.gpu_utilization
                        FROM models m
                        LEFT JOIN algorithms a ON a.id = m.algorithm_id
                        LEFT JOIN factories f ON f.id = m.factory_id
                        LEFT JOIN LATERAL (
                            SELECT version_number, accuracy, precision, recall, f1_score,
                                   inference_time, cpu_utilization, gpu_utilization
                            FROM model_versions WHERE model_id = m.id
                            ORDER BY is_active DESC, accuracy DESC NULLS LAST LIMIT 1
                        ) mv ON TRUE
                        WHERE m.algorithm_id = :aid;
                    """, db, {"aid": aid})
                    return _format_models_in_group(_enrich(rows, "models", db), a_groups[0]["algorithm"]["name"], "algorithm")

        # Models in Factory
        if comp_type == ComparisonType.MODELS_IN_FACTORY:
            fids = tuple(f["id"] for f in entities.get("factories", []))
            if fids:
                rows, _ = _execute_sql("""
                    SELECT m.id AS model_id, m.name AS model_name,
                           a.name AS algorithm_name, a.id AS algorithm_id,
                           f.name AS factory_name, f.id AS factory_id,
                           mv.version_number AS best_version,
                           mv.version_number AS version_number,
                           mv.accuracy, mv.precision, mv.recall, mv.f1_score,
                           mv.inference_time, mv.cpu_utilization, mv.gpu_utilization
                    FROM models m
                    LEFT JOIN algorithms a ON a.id = m.algorithm_id
                    LEFT JOIN factories f ON f.id = m.factory_id
                    LEFT JOIN LATERAL (
                        SELECT version_number, accuracy, precision, recall, f1_score,
                               inference_time, cpu_utilization, gpu_utilization
                        FROM model_versions WHERE model_id = m.id
                        ORDER BY is_active DESC, accuracy DESC NULLS LAST LIMIT 1
                    ) mv ON TRUE
                    WHERE m.factory_id IN :fids;
                """, db, {"fids": fids})
                group_names = " and ".join(f["name"] for f in entities.get("factories", []))
                return _format_models_in_group(_enrich(rows, "models", db), group_names, "factory")

        # Cross Factory Model Comparison
        if comp_type == ComparisonType.CROSS_FACTORY_MODEL_COMPARISON and mods:
            pat = f"%{mods[0]['name']}%"
            sql = SQLTemplateRegistry.get_cross_factory_model_sql()
            rows, _ = _execute_sql(sql, db, {"pattern": pat})
            return _format_cross_factory_model_comparison(_enrich(rows, "models", db), entities)

        # Factory vs Algorithm
        if comp_type == ComparisonType.FACTORY_VS_ALGORITHM and facs and algs:
            return compare_factory_vs_algorithm(facs[0]["id"], algs[0]["id"], db)

        # Factory vs Model
        if comp_type == ComparisonType.FACTORY_VS_MODEL and facs and mods:
            return compare_factory_vs_model(facs[0]["id"], mods[0]["id"], db)

        # Algorithm vs Model
        if comp_type == ComparisonType.ALGORITHM_VS_MODEL and algs and mods:
            return compare_algorithm_vs_model(algs[0]["id"], mods[0]["id"], db)

        # Model vs Model
        if comp_type == ComparisonType.MODEL_VS_MODEL:
            mids = tuple(g["model"]["id"] for g in groups if g.get("model") is not None)[:4]
            if len(mids) >= 2:
                rows, _ = _execute_sql("""
                    SELECT m.id AS model_id, m.name AS model_name,
                           a.name AS algorithm_name, a.id AS algorithm_id,
                           f.name AS factory_name, f.id AS factory_id,
                           mv.version_number, mv.version_number AS best_version,
                           mv.is_active,
                           mv.accuracy, mv.precision, mv.recall, mv.f1_score,
                           mv.inference_time, mv.cpu_utilization, mv.gpu_utilization,
                           mv.cpu_memory_usage, mv.gpu_memory_usage
                    FROM models m
                    JOIN algorithms a ON a.id = m.algorithm_id
                    JOIN factories f ON f.id = m.factory_id
                    LEFT JOIN LATERAL (
                        SELECT id, version_number, is_active, accuracy, precision, recall, f1_score,
                               inference_time, cpu_utilization, gpu_utilization,
                               cpu_memory_usage, gpu_memory_usage
                        FROM model_versions WHERE model_id = m.id
                        ORDER BY is_active DESC, accuracy DESC NULLS LAST LIMIT 1
                    ) mv ON TRUE
                    WHERE m.id IN :mids;
                """, db, {"mids": mids})
                return _format_comparison_models(_enrich(rows, "models", db), entities)

        # Version vs Version
        if comp_type == ComparisonType.VERSION_VS_VERSION:
            clauses = []
            params = {}
            valid_groups = [g for g in groups if g.get("model") is not None and g.get("version") is not None]
            if len(valid_groups) >= 2:
                for idx, g in enumerate(valid_groups):
                    clauses.append(f"(mv.model_id = :mid{idx} AND mv.version_number = :vnum{idx})")
                    params[f"mid{idx}"] = g["model"]["id"]
                    params[f"vnum{idx}"] = g["version"]
                
                where_clause = " OR ".join(clauses)
                rows, _ = _execute_sql(f"""
                    SELECT mv.id, mv.version_number, mv.note, mv.is_active,
                           mv.accuracy, mv.precision, mv.recall, mv.f1_score,
                           mv.inference_time, mv.cpu_utilization, mv.gpu_utilization,
                           m.name AS model_name, m.id AS model_id,
                           m.algorithm_id, m.factory_id
                    FROM model_versions mv
                    JOIN models m ON m.id = mv.model_id
                    WHERE {where_clause}
                    ORDER BY m.name ASC, mv.version_number ASC;
                """, db, params)
                return _format_version_history(_enrich(rows, "versions", db), entities)
            elif mods and vers:
                vids = tuple(v for v in vers)
                mid = mods[0]["id"]
                rows, _ = _execute_sql("""
                    SELECT mv.id, mv.version_number, mv.note, mv.is_active,
                           mv.accuracy, mv.precision, mv.recall, mv.f1_score,
                           mv.inference_time, mv.cpu_utilization, mv.gpu_utilization,
                           m.name AS model_name, m.id AS model_id,
                           m.algorithm_id, m.factory_id
                    FROM model_versions mv
                    JOIN models m ON m.id = mv.model_id
                    WHERE mv.model_id = :mid AND mv.version_number IN :vids
                    ORDER BY mv.version_number ASC;
                """, db, {"mid": mid, "vids": vids})
                return _format_version_history(_enrich(rows, "versions", db), entities)

        # All Versions Comparison
        if comp_type == ComparisonType.ALL_VERSIONS and mods:
            mid = mods[0]["id"]
            rows, _ = _execute_sql("""
                SELECT mv.id, mv.version_number, mv.accuracy, mv.precision,
                       mv.recall, mv.f1_score, mv.inference_time,
                       mv.cpu_utilization, mv.gpu_utilization, mv.is_active,
                       mv.note, m.name AS model_name, m.id AS model_id,
                       m.algorithm_id, m.factory_id
                FROM model_versions mv
                JOIN models m ON m.id = mv.model_id
                WHERE mv.model_id = :mid
                ORDER BY mv.version_number ASC;
            """, db, {"mid": mid})
            return _format_version_history(_enrich(rows, "versions", db), entities)

    # ── ANALYTICS ──
    if task.type == "analytics":
        metric = met or "accuracy"
        order, limit, offset = parse_ranking_params(question, metric)
        
        # Factory aggregate ranking request
        if "factory" in q or "factories" in q:
            sql = SQLTemplateRegistry.get_factory_ranking_sql(metric, order)
            rows, _ = _execute_sql(sql, db, {"limit": limit})
            return _format_comparison_factories(rows, entities)
            
        # Standard model ranking request (with optional model/algorithm filters)
        has_mids = len(mods) > 0
        has_aids = len(algs) > 0
        sql = SQLTemplateRegistry.get_ranking_sql(metric, order, has_mids=has_mids, has_aids=has_aids)
        
        params = {"limit": limit, "offset": offset}
        if has_mids:
            params["mids"] = tuple(m["id"] for m in mods)
        if has_aids:
            params["aids"] = tuple(a["id"] for a in algs)
            
        rows, _ = _execute_sql(sql, db, params)
        
        # Special case: if query specifies a single model and asks about "version",
        # return the version details directly instead of the model ranking table.
        if len(mods) == 1 and ("version" in q or " v" in q) and rows:
            mid = mods[0]["id"]
            # Fetch total versions for this model
            cnt_row = db.execute(
                text("SELECT COUNT(*) FROM model_versions WHERE model_id = :mid"),
                {"mid": mid}
            ).fetchone()
            total_versions = int(cnt_row[0]) if cnt_row else 0
            
            # Fetch deployed version info
            dep_rows = db.execute(text("""
                SELECT version_number, note
                FROM model_versions
                WHERE model_id = :mid AND is_active = true
                ORDER BY version_number DESC
                LIMIT 1
            """), {"mid": mid}).fetchall()
            deployed_version = {"version_number": dep_rows[0][0], "note": dep_rows[0][1]} if dep_rows else None
            
            # Map best_version to version_number for compatibility with single-version formatter
            row = dict(rows[0])
            row["version_number"] = row.get("best_version", "?")
            # Fetch description of the model
            desc_row = db.execute(text("SELECT description FROM models WHERE id = :mid"), {"mid": mid}).fetchone()
            row["description"] = desc_row[0] if desc_row else None
            
            return _format_single_version_detail(row, total_versions, deployed_version, "Best")

        return _format_analytics(_enrich(rows, "models", db), metric, question)

    return None

def dispatch_query_plan(
    plan: QueryPlan,
    entities: Dict[str, Any],
    resolved_q: str,
    db_session: Session,
    context: List[Dict[str, Any]] = [],
    confidence: float = 1.0
) -> Dict[str, Any]:
    """
    Dispatcher responsibility:
    1. Receive QueryPlan.
    2. Decide which executor to call.
    3. Route: metadata, comparison, analytics, version_history, relationship, download, knowledge.
    """
    
    # Multi-Task / Hybrid Execution Path
    if len(plan.tasks) >= 2:
        results = []
        for task in plan.tasks:
            task_res = dispatch_task(task, entities, resolved_q, db_session, context)
            if task_res is not None:
                # Run LLM response generator if applicable
                if task.type == "analytics" and task_res.get("entity_type") != "versions" and "data" in task_res and task_res["data"]:
                    try:
                        task_plan = QueryPlan(tasks=[task], confidence=plan.confidence)
                        llm_res_str = generate_response_llm(task_plan, task_res["data"], resolved_q)
                        if llm_res_str:
                            task_res["answer"] = llm_res_str
                            task_res["verified"] = False
                    except Exception as e:
                        print(f"[ResponseGenerator] Failed to run LLM response generator for task: {e}")
                
                # Verify DB data
                needs_db_verify = task.type not in ("conceptual", "download", "knowledge") \
                                  and "data" in task_res and not task_res.get("verified")
                if needs_db_verify:
                    task_res["answer"] = deterministic_verify(task_res.get("data", []), task_res["answer"])
                    task_res["verified"] = True
            else:
                task_res = {
                    "answer": "This query is not currently supported.",
                    "type": "unsupported"
                }
            results.append(task_res)
            
        db_answers = []
        knowledge_answers = []
        other_answers = []
        
        merged_type = "text"
        merged_entity_type = None
        merged_fups = []
        merged_data = []
        
        for r, t in zip(results, plan.tasks):
            if not r:
                continue
            ans = r.get("answer", "")
            if t.type == "knowledge":
                knowledge_answers.append(ans)
            elif r.get("type") in ("sql", "comparison", "analytics"):
                db_answers.append(ans)
                merged_type = r.get("type")
            else:
                other_answers.append(ans)
                if r.get("type") != "text":
                    merged_type = r.get("type")
                    
            if r.get("entity_type"):
                merged_entity_type = r.get("entity_type")
            if r.get("follow_ups"):
                for fu in r["follow_ups"]:
                    if fu not in merged_fups:
                        merged_fups.append(fu)
            if r.get("data"):
                if isinstance(r["data"], list):
                    merged_data.extend(r["data"])
                else:
                    merged_data.append(r["data"])
                    
        combined_parts = []
        if db_answers:
            combined_parts.append("\n\n".join(db_answers))
        if other_answers:
            combined_parts.append("\n\n".join(other_answers))
            
        combined_answer = "\n\n--\n\n".join(combined_parts)
        if knowledge_answers:
            if combined_answer:
                combined_answer += "\n\n---\n\n### 📖 Concept Explanation\n"
            combined_answer += "\n\n".join(knowledge_answers)
            
        return {
            "answer": combined_answer,
            "type": merged_type,
            "entity_type": merged_entity_type,
            "follow_ups": merged_fups,
            "data": merged_data,
            "verified": True,
            "confidence": confidence
        }

    # Single-task execution
    task = plan.tasks[0] if plan.tasks else QueryTask(type="metadata")

    if task.type == "clarification":
        res = dispatch_task(task, entities, resolved_q, db_session, context)
        if res is not None:
            res["confidence"] = confidence
        return res

    # SQL Template Registry Dispatcher (Main Execution Path)
    result = dispatch_task(task, entities, resolved_q, db_session, context)

    if result is not None:
        # Try LLM Response Generator first
        llm_response = None
        if task.type == "analytics" and result.get("entity_type") != "versions" and "data" in result and result["data"]:
            try:
                llm_response = generate_response_llm(plan, result["data"], resolved_q)
            except Exception as e:
                print(f"[ResponseGenerator] Failed to run LLM response generator: {e}")
        
        if llm_response:
            result["answer"] = llm_response
            result["verified"] = False

        # Deterministic validator — only applies to DB-backed results.
        needs_db_verify = task.type not in ("conceptual", "download", "knowledge") \
                          and "data" in result and not result.get("verified")
        if needs_db_verify:
            result["answer"] = deterministic_verify(result.get("data", []), result["answer"])
            result["verified"] = True

        # Preserve follow-ups already set by the dispatcher,
        # only overwrite if the dispatcher did not supply them.
        if not result.get("follow_ups"):
            intent_map = {
                "metadata":        IntentType.METADATA,
                "comparison":      IntentType.COMPARISON,
                "analytics":       IntentType.ANALYTICS,
                "version_history": IntentType.VERSION_HISTORY,
                "relationship":    IntentType.VERSION_LINEAGE,
                "download":        IntentType.DOWNLOAD,
                "knowledge":       IntentType.KNOWLEDGE,
                "clarification":   IntentType.CLARIFICATION,
            }
            mapped_intent = intent_map.get(task.type, IntentType.METADATA)
            comp_type = _determine_comparison_type(resolved_q, entities) if task.type in ("comparison", "relationship") else None
            result["follow_ups"] = generate_follow_ups(mapped_intent, comp_type, entities)

        result["confidence"] = confidence
        return result

    unsupported_response = {
        "answer": "This query is not currently supported.",
        "type": "unsupported",
        "confidence": confidence
    }
    return unsupported_response
