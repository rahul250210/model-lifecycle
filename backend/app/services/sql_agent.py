"""
MARS AI Agent — sql_agent.py
Database-grounded chatbot agent with structured intent detection,
entity extraction, SQL templates, context memory, and rich response generation.
"""
import os
import re
import json
import time
from enum import Enum
from typing import Any, Dict, List, Optional, Tuple
from difflib import SequenceMatcher
from sqlalchemy.orm import Session
from sqlalchemy import text
from dotenv import load_dotenv
from app.services.planner_llm import QueryPlan, QueryTask
from app.services.llm_service import call_llm

load_dotenv()

# ==============================================================================
# § 1  ENUMS & CONSTANTS
# ==============================================================================

class IntentType(str, Enum):
    METADATA        = "metadata"
    COMPARISON      = "comparison"
    ANALYTICS       = "analytics"
    VERSION_HISTORY = "version_history"
    DOWNLOAD        = "download"
    CONCEPTUAL      = "conceptual"
    VERSION_LINEAGE = "version_lineage"
    CLARIFICATION   = "clarification"
    KNOWLEDGE       = "knowledge"

class ComparisonType(str, Enum):
    MODEL_VS_MODEL         = "model_vs_model"
    VERSION_VS_VERSION     = "version_vs_version"
    FACTORY_VS_FACTORY     = "factory_vs_factory"
    ALGORITHM_VS_ALGORITHM = "algorithm_vs_algorithm"
    MODELS_IN_ALGORITHM    = "models_in_algorithm"
    MODELS_IN_FACTORY      = "models_in_factory"
    FACTORY_VS_ALGORITHM   = "factory_vs_algorithm"
    FACTORY_VS_MODEL       = "factory_vs_model"
    ALGORITHM_VS_MODEL     = "algorithm_vs_model"
    CROSS_FACTORY_MODEL_COMPARISON = "cross_factory_model_comparison"
    ALL_VERSIONS           = "all_versions"

# Canonical metric column names
METRIC_ALIASES: Dict[str, str] = {
    "acc":          "accuracy",
    "accuracy":     "accuracy",
    "precision":    "precision",
    "prec":         "precision",
    "recall":       "recall",
    "rec":          "recall",
    "f1":           "f1_score",
    "f1 score":     "f1_score",
    "f1score":      "f1_score",
    "inference":    "inference_time",
    "speed":        "inference_time",
    "latency":      "inference_time",
    "cpu":          "cpu_utilization",
    "gpu":          "gpu_utilization",
}
# Metric definitions for use in CONCEPTUAL responses
_METRIC_DEFINITIONS: Dict[str, str] = {
    "accuracy":       "**Accuracy** measures the percentage of correct predictions out of all predictions made. "
                      "Formula: `(TP + TN) / (TP + TN + FP + FN)`.",
    "precision":      "**Precision** measures how many of the model's positive predictions were actually correct. "
                      "Formula: `TP / (TP + FP)`. High precision means fewer false alarms.",
    "recall":         "**Recall** (Sensitivity) measures how many actual positives the model correctly identified. "
                      "Formula: `TP / (TP + FN)`. High recall means fewer missed detections.",
    "f1":             "**F1 Score** is the harmonic mean of Precision and Recall. "
                      "Formula: `2 * (Precision × Recall) / (Precision + Recall)`. Useful when classes are imbalanced.",
    "f1_score":       "**F1 Score** is the harmonic mean of Precision and Recall. "
                      "Formula: `2 * (Precision × Recall) / (Precision + Recall)`. Useful when classes are imbalanced.",
    "inference_time": "**Inference Time** (Latency) is the time taken by a model to produce a prediction for one sample. "
                      "Lower is better — it directly impacts real-time performance.",
    "latency":        "**Latency** is the time taken by a model to produce a prediction. Lower values indicate a faster model.",
    "cpu":            "**CPU Utilization** is the percentage of CPU resources consumed by the model during inference.",
    "cpu_utilization":"**CPU Utilization** is the percentage of CPU resources consumed by the model during inference.",
    "gpu":            "**GPU Utilization** is the percentage of GPU resources consumed by the model during inference. "
                      "Higher utilization can indicate better use of hardware.",
    "gpu_utilization":"**GPU Utilization** is the percentage of GPU resources consumed by the model during inference.",
}

_KNOWLEDGE_OFFLINE_GLOSSARY: Dict[str, str] = {
    "accuracy": "**Accuracy** measures the percentage of correct predictions out of all predictions made. Formula: `(TP + TN) / (TP + TN + FP + FN)`.",
    "precision": "**Precision** measures how many of the model's positive predictions were actually correct. Formula: `TP / (TP + FP)`. High precision means fewer false alarms.",
    "recall": "**Recall** (Sensitivity) measures how many actual positives the model correctly identified. Formula: `TP / (TP + FN)`. High recall means fewer missed detections.",
    "f1": "**F1 Score** is the harmonic mean of Precision and Recall. Formula: `2 * (Precision * Recall) / (Precision + Recall)`. Useful when classes are imbalanced.",
    "overfitting": "**Overfitting** occurs when a machine learning model learns the training data too well, capturing noise and details that do not generalize to new, unseen data.",
    "confusion matrix": "A **Confusion Matrix** is a table showing the performance of a classification model by comparing actual values (True Positive, True Negative) with predicted values (False Positive, False Negative)."
}

_PRONOUN_PATTERNS = [
    r"\bit\b", r"\bthat model\b", r"\bwhich one\b", r"\bthat one\b",
    r"\bthe model\b", r"\bthe factory\b", r"\bthe algorithm\b",
    r"\bthose\b", r"\bthem\b", r"\bthey\b", r"\bthe same\b", r"\bthis model\b",
]

# ==============================================================================





# ==============================================================================
# § 2  CACHE SYSTEMS (TTLCache & Schema Discovery & Alias Cache)
# ==============================================================================

import redis

class CacheProvider:
    def get(self, key: str) -> Optional[Any]:
        raise NotImplementedError

    def set(self, key: str, value: Any, ttl: int = 600) -> None:
        raise NotImplementedError

class NoOpCacheProvider(CacheProvider):
    def get(self, key: str) -> Optional[Any]:
        return None

    def set(self, key: str, value: Any, ttl: int = 600) -> None:
        pass

class RedisCacheProvider(CacheProvider):
    def __init__(self, redis_url: str = None):
        if not redis_url:
            redis_url = os.getenv("REDIS_URL", "redis://localhost:6379/0")
        self.client = redis.Redis.from_url(redis_url, socket_timeout=1.0, socket_connect_timeout=1.0)
        # Test connection immediately
        self.client.ping()

    def get(self, key: str) -> Optional[Any]:
        try:
            val = self.client.get(key)
            if val is not None:
                return json.loads(val)
        except Exception as e:
            print(f"[RedisCacheProvider] Get failed: {e}")
        return None

    def set(self, key: str, value: Any, ttl: int = 600) -> None:
        try:
            self.client.setex(key, ttl, json.dumps(value))
        except Exception as e:
            print(f"[RedisCacheProvider] Set failed: {e}")

_cache_provider: Optional[CacheProvider] = None

def get_cache_provider() -> CacheProvider:
    global _cache_provider
    if _cache_provider is None:
        try:
            _cache_provider = RedisCacheProvider()
            print("[Cache] Initialized RedisCacheProvider successfully.")
        except Exception as e:
            print(f"[Cache] Redis connection failed ({e}). Falling back to NoOpCacheProvider.")
            _cache_provider = NoOpCacheProvider()
    return _cache_provider

class SchemaCache:
    tables: Dict[str, Dict[str, Any]] = {
        "models": {
            "columns": ["id", "name", "description", "created_at", "algorithm_id", "factory_id"],
            "foreign_keys": [
                {"constrained_columns": ["algorithm_id"], "referred_table": "algorithms", "referred_columns": ["id"]},
                {"constrained_columns": ["factory_id"], "referred_table": "factories", "referred_columns": ["id"]}
            ]
        },
        "model_versions": {
            "columns": [
                "id", "model_id", "version_number", "is_active", "accuracy", "precision", 
                "recall", "f1_score", "inference_time", "cpu_utilization", "gpu_utilization", 
                "cpu_memory_usage", "gpu_memory_usage", "note", "created_at", "updated_at"
            ],
            "foreign_keys": [
                {"constrained_columns": ["model_id"], "referred_table": "models", "referred_columns": ["id"]}
            ]
        },
        "algorithms": {
            "columns": ["id", "name", "description"],
            "foreign_keys": []
        },
        "factories": {
            "columns": ["id", "name", "description"],
            "foreign_keys": []
        },
        "aliases": {
            "columns": ["alias_name", "canonical_name", "entity_type"],
            "foreign_keys": []
        }
    }
    initialized: bool = True

class AliasCache:
    _aliases: Dict[str, Dict[str, str]] = {}
    initialized: bool = False

    @classmethod
    def initialize(cls, db_session: Session):
        if cls.initialized:
            return
        try:
            # Create aliases table if it does not exist
            db_session.execute(text("""
                CREATE TABLE IF NOT EXISTS aliases (
                    alias_name VARCHAR PRIMARY KEY,
                    canonical_name VARCHAR NOT NULL,
                    entity_type VARCHAR NOT NULL
                )
            """))
            db_session.commit()

            # Seed initial records if empty
            res = db_session.execute(text("SELECT COUNT(*) FROM aliases")).fetchone()
            if res and res[0] == 0:
                defaults = [
                    ("rf", "Random Forest", "algorithm"),
                    ("xgb", "XGBoost", "algorithm"),
                    ("xg", "XGBoost", "algorithm"),
                    ("svm", "Support Vector Machine", "algorithm"),
                    ("knn", "K-Nearest Neighbors", "algorithm"),
                    ("lr", "Logistic Regression", "algorithm"),
                    ("gb", "Gradient Boosting", "algorithm"),
                    ("yolo11", "YOLOv11", "model"),
                ]
                for alias, canonical, etype in defaults:
                    db_session.execute(
                        text("INSERT INTO aliases (alias_name, canonical_name, entity_type) VALUES (:a, :c, :e)"),
                        {"a": alias, "c": canonical, "e": etype}
                    )
                db_session.commit()

            # Load aliases
            rows = db_session.execute(text("SELECT alias_name, canonical_name, entity_type FROM aliases")).fetchall()
            cls._aliases = {r[0].lower().strip(): {"canonical": r[1], "type": r[2]} for r in rows}
            cls.initialized = True
            print(f"[AliasCache] Loaded {len(cls._aliases)} aliases from database.")
        except Exception as e:
            print(f"[AliasCache] Failed to initialize alias cache: {e}")

    @classmethod
    def get_aliases(cls) -> Dict[str, Dict[str, str]]:
        return cls._aliases

# ==============================================================================
# § 3  CONTEXT MEMORY SYSTEM (Replaces LLM for simple pronoun/referring expressions)
# ==============================================================================

class ContextMemory:
    def __init__(self):
        self.last_model = None          # {'id': int, 'name': str}
        self.last_factory = None        # {'id': int, 'name': str}
        self.last_algorithm = None      # {'id': int, 'name': str}
        self.last_version = None        # int
        self.last_comparison_pair = []  # List of dicts
        self.last_ranking_query = None    # {'metric': str, 'order': str}
        self.last_groups = []           # List of relationship group dicts
        
        # Extended fields:
        self.last_models = []
        self.last_metric = None
        self.last_comparison = []

    @classmethod
    def build_from_context(cls, context: List[Dict], extractor: 'EntityExtractor') -> 'ContextMemory':
        mem = cls()
        extractor._load()
        
        # Reconstruct final conversation state from oldest to newest message
        for msg in context:
            content = msg.get("content", "")
            if not content:
                continue
            content_lower = content.lower()
            
            # Find models
            msg_models_raw = []
            for m in extractor._models:
                mname_lower = m["name"].lower()
                escaped = re.escape(mname_lower)
                start_b = r"(?<!\w)" if mname_lower[0].isalnum() else ""
                end_b   = r"(?!\w)"  if mname_lower[-1].isalnum() else ""
                if re.search(start_b + escaped + end_b, content_lower):
                    exact_start_b = r"(?<!\w)" if m["name"][0].isalnum() else ""
                    exact_end_b   = r"(?!\w)"  if m["name"][-1].isalnum() else ""
                    is_exact = bool(re.search(exact_start_b + re.escape(m["name"]) + exact_end_b, content))
                    msg_models_raw.append((m, is_exact))
            if msg_models_raw:
                exact_matches = [m for m, exact in msg_models_raw if exact]
                msg_models = exact_matches if exact_matches else [m for m, exact in msg_models_raw]
                mem.last_model = msg_models[-1]
                mem.last_models = msg_models
                if len(msg_models) >= 2:
                    mem.last_comparison_pair = msg_models[:2]
                    mem.last_comparison = msg_models[:2]
                    
            # Find factories
            msg_factories_raw = []
            for f in extractor._factories:
                fname_lower = f["name"].lower()
                escaped = re.escape(fname_lower)
                start_b = r"(?<!\w)" if fname_lower[0].isalnum() else ""
                end_b   = r"(?!\w)"  if fname_lower[-1].isalnum() else ""
                if re.search(start_b + escaped + end_b, content_lower):
                    exact_start_b = r"(?<!\w)" if f["name"][0].isalnum() else ""
                    exact_end_b   = r"(?!\w)"  if f["name"][-1].isalnum() else ""
                    is_exact = bool(re.search(exact_start_b + re.escape(f["name"]) + exact_end_b, content))
                    msg_factories_raw.append((f, is_exact))
            if msg_factories_raw:
                exact_matches = [f for f, exact in msg_factories_raw if exact]
                msg_factories = exact_matches if exact_matches else [f for f, exact in msg_factories_raw]
                mem.last_factory = msg_factories[-1]
                if len(msg_factories) >= 2:
                    mem.last_comparison_pair = msg_factories[:2]
                    mem.last_comparison = msg_factories[:2]

            # Find algorithms
            msg_algos_raw = []
            for a in extractor._algorithms:
                aname_lower = a["name"].lower()
                escaped = re.escape(aname_lower)
                start_b = r"(?<!\w)" if aname_lower[0].isalnum() else ""
                end_b   = r"(?!\w)"  if aname_lower[-1].isalnum() else ""
                if re.search(start_b + escaped + end_b, content_lower):
                    exact_start_b = r"(?<!\w)" if a["name"][0].isalnum() else ""
                    exact_end_b   = r"(?!\w)"  if a["name"][-1].isalnum() else ""
                    is_exact = bool(re.search(exact_start_b + re.escape(a["name"]) + exact_end_b, content))
                    msg_algos_raw.append((a, is_exact))
            if msg_algos_raw:
                exact_matches = [a for a, exact in msg_algos_raw if exact]
                msg_algos = exact_matches if exact_matches else [a for a, exact in msg_algos_raw]
                mem.last_algorithm = msg_algos[-1]
                if len(msg_algos) >= 2:
                    mem.last_comparison_pair = msg_algos[:2]
                    mem.last_comparison = msg_algos[:2]

            # Find versions
            v_matches = re.findall(r'\bv(?:ersion\s*)?(\d+)\b|\bversion\s+(\d+)\b', content_lower)
            if v_matches:
                mem.last_version = int(v_matches[-1][0] or v_matches[-1][1])
                
            # Find ranking details
            msg_metric = None
            for alias, canonical in METRIC_ALIASES.items():
                if re.search(r'\b' + re.escape(alias) + r'\b', content_lower):
                    msg_metric = canonical
                    break
            
            if msg_metric:
                mem.last_metric = msg_metric

            is_ranking = any(w in content_lower for w in ["best", "worst", "top", "bottom", "highest", "lowest", "rank", "ranking"])
            if is_ranking and msg_metric:
                is_latency = msg_metric == "inference_time"
                order = "ASC" if (any(w in content_lower for w in ["worst", "bottom", "lowest", "slowest"]) != is_latency) else "DESC"
                mem.last_ranking_query = {"metric": msg_metric, "order": order}

            # Try to extract relationship groups from context message
            try:
                msg_extracted = extractor.extract(content)
                if msg_extracted.get("groups"):
                    mem.last_groups = msg_extracted["groups"]
            except Exception:
                pass

        return mem

def resolve_context_rules(question: str, memory: ContextMemory) -> Tuple[str, float]:
    """Attempt pronoun substitution using ContextMemory. Returns (resolved_question, confidence)."""
    q = question.lower()
    has_pronoun = any(re.search(p, q) for p in _PRONOUN_PATTERNS)
    if not has_pronoun:
        return question, 0.0

    resolved = question

    # 0. "Which one is deployed?" / "Which is active?"
    if "deployed" in q or "active" in q:
        if memory.last_model:
            resolved = re.sub(r'\bwhich one\b|\bthat one\b|\bwhich\b|\bthis\b', f"model {memory.last_model['name']}", resolved, flags=re.IGNORECASE)
            return resolved, 1.0

    # 1. Check if we have relationship groups in memory
    if memory.last_groups and len(memory.last_groups) >= 2:
        # Format relationship groups into strings preserving associations
        group_strings = []
        for g in memory.last_groups:
            parts = []
            if g.get("model"):
                parts.append(g["model"]["name"])
            elif g.get("algorithm"):
                parts.append(f"{g['algorithm']['name']} model")
                
            if g.get("version") is not None:
                parts.append(f"version {g['version']}")
            if g.get("factory"):
                parts.append(f"in {g['factory']['name']}")
            if parts:
                group_strings.append(" ".join(parts))
                
        if len(group_strings) >= 2:
            names = " and ".join(group_strings)
            # Replaces "them", "those", "which is", "which one is", "which one"
            resolved = re.sub(r'\bthem\b|\bthose\b', f"{names}", resolved, flags=re.IGNORECASE)
            resolved = re.sub(r'\bwhich is\b|\bwhich one is\b|\bwhich one\b', f"which of {names} is", resolved, flags=re.IGNORECASE)
            return resolved, 1.0

    # 2. "Which is..." / "Which one is..." / "compare them" / "Which one..." -> last compared pair fallback if we have one
    if "which is" in q or "which one is" in q or "compare them" in q or "which one" in q:
        if len(memory.last_comparison_pair) >= 2:
            names = " and ".join(x["name"] for x in memory.last_comparison_pair)
            resolved = re.sub(r'\bthem\b|\bthose\b', f"{names}", resolved, flags=re.IGNORECASE)
            resolved = re.sub(r'\bwhich is\b|\bwhich one is\b|\bwhich one\b', f"which of {names} is", resolved, flags=re.IGNORECASE)
            return resolved, 1.0

    # 3. "Which one is deployed?" -> last model or factory
    if "which one" in q or "that one" in q:
        if memory.last_model:
            resolved = re.sub(r'\bwhich one\b|\bthat one\b', f"model {memory.last_model['name']}", resolved, flags=re.IGNORECASE)
            return resolved, 1.0
        elif memory.last_factory:
            resolved = re.sub(r'\bwhich one\b|\bthat one\b', f"factory {memory.last_factory['name']}", resolved, flags=re.IGNORECASE)
            return resolved, 1.0

    # 4. "its accuracy" / "what about it" -> last model
    if "its" in q or "it" in q or "this model" in q or "the model" in q:
        if memory.last_model:
            name = memory.last_model['name']
            resolved = re.sub(r'\bits\b', f"{name}'s", resolved, flags=re.IGNORECASE)
            resolved = re.sub(r'\bthis model\b|\bthe model\b|\bit\b', f"model {name}", resolved, flags=re.IGNORECASE)
            return resolved, 1.0

    # 5. "Which is more accurate?" -> last compared pair fallback
    if "which is" in q or "which one is" in q or "compare them" in q:
        if len(memory.last_comparison_pair) >= 2:
            names = " and ".join(x["name"] for x in memory.last_comparison_pair)
            resolved = re.sub(r'\bthem\b|\bthose\b', f"{names}", resolved, flags=re.IGNORECASE)
            resolved = re.sub(r'\bwhich is\b', f"which of {names} is", resolved, flags=re.IGNORECASE)
            return resolved, 1.0

    return question, 0.0


# ==============================================================================
# § 4  LLM CONNECTOR (Moved to llm_service.py)
# ==============================================================================
# § 5  ENTITY EXTRACTION & SCORING (Exact 1.0, Alias 0.95, Strong 0.85, Weak 0.70)
# ==============================================================================

class EntityExtractor:
    STOP_WORDS = {
        "compare", "comparison", "version", "versions", "all", "the", "of", "a",
        "model", "models", "algorithm", "algorithms", "factory", "factories",
        "and", "vs", "versus", "between", "show", "list", "get", "tell", "me",
        "about", "what", "is", "are", "how", "top", "best", "by", "in", "for",
        "with", "has", "have", "which", "that", "this", "those", "their",
        "its", "details", "info", "information", "data", "report", "download",
    }

    def __init__(self, db_session: Session):
        self.db = db_session
        self._factories: List[Dict] = []
        self._algorithms: List[Dict] = []
        self._models: List[Dict] = []
        self._loaded = False

    def _load(self):
        if self._loaded:
            return
        try:
            f_res = self.db.execute(text("SELECT id, name FROM factories"))
            self._factories = [{"id": r[0], "name": r[1]} for r in f_res]
            a_res = self.db.execute(text("SELECT id, name FROM algorithms"))
            self._algorithms = [{"id": r[0], "name": r[1]} for r in a_res]
            m_res = self.db.execute(text("SELECT id, name, algorithm_id, factory_id FROM models"))
            self._models = [{"id": r[0], "name": r[1], "algorithm_id": r[2], "factory_id": r[3]} for r in m_res]
            self._loaded = True
        except Exception as e:
            print(f"[EntityExtractor] DB load error: {e}")

    def _fuzzy_match(self, query_lower: str, original_query: str, candidates: List[Dict], entity_type: str) -> List[Dict]:
        matched = []
        def get_words(text: str) -> List[str]:
            return [w.strip(".,?!()*_\"'#;:") for w in text.split() if w.strip(".,?!()*_\"'#;:")]
            
        q_tokens = get_words(query_lower)
        q_words = [w for w in q_tokens if len(w) >= 2 and w not in self.STOP_WORDS]
        sorted_cands = sorted(candidates, key=lambda c: len(c["name"]), reverse=True)
        aliases = AliasCache.get_aliases()

        for candidate in sorted_cands:
            name_lower = candidate["name"].strip().lower()
            score = 0.0
            match_type = None

            # 1. Exact Match Check (1.0 vs 0.94)
            escaped = re.escape(name_lower)
            start_b = r"(?<!\w)" if name_lower[0].isalnum() else ""
            end_b   = r"(?!\w)"  if name_lower[-1].isalnum() else ""
            if re.search(start_b + escaped + end_b, query_lower):
                # Verify case-sensitive exact match
                exact_name = candidate["name"]
                exact_escaped = re.escape(exact_name)
                exact_start_b = r"(?<!\w)" if exact_name[0].isalnum() else ""
                exact_end_b   = r"(?!\w)"  if exact_name[-1].isalnum() else ""
                if re.search(exact_start_b + exact_escaped + exact_end_b, original_query):
                    score = 1.0
                else:
                    score = 0.94
                match_type = "exact"
            else:
                # 2. Alias Match Check (0.95)
                for alias_name, info in aliases.items():
                    if info["canonical"].lower() == name_lower and info["type"] == entity_type:
                        if re.search(r'\b' + re.escape(alias_name) + r'\b', query_lower):
                            score = 0.95
                            match_type = "alias"
                            break

            # 3. Fuzzy Match Check (Strong 0.85, Weak 0.70)
            if score == 0.0:
                best_ratio = 0.0
                cand_words = get_words(name_lower)
                k = len(cand_words)
                query_words = get_words(query_lower)
                if k > 0 and len(query_words) >= k:
                    sub_phrases = [" ".join(query_words[i:i+k]) for i in range(len(query_words) - k + 1)]
                    for phrase in sub_phrases:
                        ratio = SequenceMatcher(None, name_lower, phrase).ratio()
                        if ratio > best_ratio:
                            best_ratio = ratio
                else:
                    ratio = SequenceMatcher(None, name_lower, query_lower).ratio()
                    if ratio > best_ratio:
                        best_ratio = ratio

                # Fallback to single word check
                for qw in q_words:
                    ratio = SequenceMatcher(None, name_lower, qw).ratio()
                    if ratio > best_ratio:
                        best_ratio = ratio

                if best_ratio >= 0.72:
                    score = 0.85 if best_ratio >= 0.85 else 0.70
                    match_type = "fuzzy"

            if score > 0.0:
                matched.append({**candidate, "score": score, "match_type": match_type})

        # Deduplicate by id and keep highest score
        matched.sort(key=lambda c: c["score"], reverse=True)
        seen = set()
        result = []
        for m in matched:
            if m["id"] not in seen:
                seen.add(m["id"])
                result.append(m)

        # Filter out weak matches if strong matches exist
        high_scores = [m["score"] for m in result if m["score"] >= 0.85]
        if high_scores:
            result = [m for m in result if m["score"] >= 0.85]

        # Group competitors and filter out lower-scoring ones (outside 5% margin)
        filtered = []
        for m in result:
            has_better_competitor = False
            for f in filtered:
                names_identical = (m["name"].lower() == f["name"].lower())
                names_very_similar = (SequenceMatcher(None, m["name"].lower(), f["name"].lower()).ratio() > 0.85)
                if names_identical or names_very_similar:
                    same_factory = (m.get("factory_id") == f.get("factory_id")) or (m.get("factory_id") is None) or (f.get("factory_id") is None)
                    if same_factory and (f["score"] - m["score"]) > 0.05:
                        has_better_competitor = True
                        break
            if not has_better_competitor:
                filtered.append(m)

        return filtered

    def extract_relationship_groups(self, question: str, factories: List[Dict], algorithms: List[Dict], models: List[Dict]) -> List[Dict[str, Any]]:
        """
        Build structured relationship groups from entity mentions.
        Each group contains: model, factory, algorithm, version.
        """
        tokens = []
        q = question.lower()

        # Helper to find all occurrences of a substring
        def find_occurrences(name: str, etype: str, data: Dict):
            name_lower = name.lower()
            escaped = re.escape(name_lower)
            start_b = r"(?<!\w)" if name_lower[0].isalnum() else ""
            end_b   = r"(?!\w)"  if name_lower[-1].isalnum() else ""
            for m in re.finditer(start_b + escaped + end_b, q):
                # Verify case-sensitive exact match
                exact_name = name
                exact_escaped = re.escape(exact_name)
                exact_start_b = r"(?<!\w)" if exact_name[0].isalnum() else ""
                exact_end_b   = r"(?!\w)"  if exact_name[-1].isalnum() else ""
                score = 1.0 if re.search(exact_start_b + exact_escaped + exact_end_b, question) else 0.94
                
                tokens.append({
                    "type": etype,
                    "data": data,
                    "start": m.start(),
                    "end": m.end(),
                    "score": score
                })

        # We want to keep all model candidates that share the same name/casing as matched tokens
        for f in factories:
            find_occurrences(f["name"], "factory", f)
        for a in algorithms:
            find_occurrences(a["name"], "algorithm", a)
            
        # Group models by name so we can keep multiple candidates for the same matched token
        model_names = {m["name"].lower() for m in models}
        for mname in model_names:
            candidates = [m for m in models if m["name"].lower() == mname]
            escaped = re.escape(mname)
            start_b = r"(?<!\w)" if mname[0].isalnum() else ""
            end_b   = r"(?!\w)"  if mname[-1].isalnum() else ""
            for match_obj in re.finditer(start_b + escaped + end_b, q):
                tokens.append({
                    "type": "model",
                    "candidates": candidates,
                    "start": match_obj.start(),
                    "end": match_obj.end(),
                })

        # Extract version numbers
        v_matches = re.finditer(r'\bv(?:ersion\s*)?(\d+)\b|\bversion\s+(\d+)\b', q)
        for m in v_matches:
            val = int(m.group(1) or m.group(2))
            tokens.append({
                "type": "version",
                "data": val,
                "start": m.start(),
                "end": m.end()
            })

        # Extract separators
        seps = ["vs", "versus", "with", "between", "and", ","]
        for sep in seps:
            escaped = re.escape(sep)
            pat = r'\b' + escaped + r'\b' if sep != "," else ","
            for m in re.finditer(pat, q):
                tokens.append({
                    "type": "separator",
                    "data": sep,
                    "start": m.start(),
                    "end": m.end()
                })

        # Sort tokens by start position
        tokens.sort(key=lambda x: x["start"])

        # 2. Iterate and group tokens
        groups = []
        current_group = {}

        for t in tokens:
            if t["type"] == "separator":
                if current_group:
                    groups.append(current_group)
                    current_group = {}
                continue

            etype = t["type"]
            if etype in current_group or (etype == "model" and "model_candidates" in current_group):
                groups.append(current_group)
                current_group = {}

            if etype == "model":
                current_group["model_candidates"] = t["candidates"]
            else:
                current_group[etype] = t["data"]

        if current_group:
            groups.append(current_group)

        # 3. Propagate shared entities (inheritance / distribution)
        # Propagate single unique factory
        non_none_factories = [g["factory"] for g in groups if g.get("factory") is not None]
        unique_factories = []
        for f in non_none_factories:
            if f["id"] not in [uf["id"] for uf in unique_factories]:
                unique_factories.append(f)
        if len(unique_factories) == 1:
            for g in groups:
                if g.get("factory") is None:
                    g["factory"] = unique_factories[0]

        # Propagate single unique algorithm
        non_none_algorithms = [g["algorithm"] for g in groups if g.get("algorithm") is not None]
        unique_algorithms = []
        for a in non_none_algorithms:
            if a["id"] not in [ua["id"] for ua in unique_algorithms]:
                unique_algorithms.append(a)
        if len(unique_algorithms) == 1:
            for g in groups:
                if g.get("algorithm") is None:
                    g["algorithm"] = unique_algorithms[0]

        # Propagate single unique model candidates list
        non_none_model_cands = [g["model_candidates"] for g in groups if g.get("model_candidates") is not None]
        if non_none_model_cands:
            first_name = non_none_model_cands[0][0]["name"].lower()
            all_same_name = all(all(c["name"].lower() == first_name for c in cands) for cands in non_none_model_cands)
            if all_same_name:
                for g in groups:
                    if g.get("model_candidates") is None:
                        g["model_candidates"] = non_none_model_cands[0]

        # 4. Resolve exact model candidate in each group based on group's factory/algorithm
        for g in groups:
            if g.get("model_candidates"):
                resolved_model = None
                if g.get("factory"):
                    fid = g["factory"]["id"]
                    matches = [c for c in g["model_candidates"] if c.get("factory_id") == fid]
                    if matches:
                        resolved_model = matches[0]
                if not resolved_model and g.get("algorithm"):
                    aid = g["algorithm"]["id"]
                    matches = [c for c in g["model_candidates"] if c.get("algorithm_id") == aid]
                    if matches:
                        resolved_model = matches[0]
                if not resolved_model:
                    resolved_model = g["model_candidates"][0]
                
                g["model"] = resolved_model
                g["explicit_model"] = True
                del g["model_candidates"]
            else:
                resolved_model = None
                if g.get("algorithm"):
                    aid = g["algorithm"]["id"]
                    if g.get("factory"):
                        fid = g["factory"]["id"]
                        matches = [m for m in self._models if m.get("factory_id") == fid and m.get("algorithm_id") == aid]
                    else:
                        matches = [m for m in self._models if m.get("algorithm_id") == aid]
                    if matches:
                        resolved_model = matches[0]
                elif g.get("factory"):
                    # Fallback to first model in this factory if only factory specified
                    fid = g["factory"]["id"]
                    matches = [m for m in self._models if m.get("factory_id") == fid]
                    if matches:
                        resolved_model = matches[0]
                g["model"] = resolved_model
                g["explicit_model"] = False

            if "factory" not in g: g["factory"] = None
            if "algorithm" not in g: g["algorithm"] = None
            if "version" not in g: g["version"] = None

        return groups

    def extract(self, question: str, plan: Optional[QueryPlan] = None) -> Dict[str, Any]:
        self._load()
        q = question.lower()
        
        # Apply database alias substitutions
        aliases = AliasCache.get_aliases()
        substituted_question = question
        for alias, info in aliases.items():
            q = re.sub(r'\b' + re.escape(alias) + r'\b', info["canonical"].lower(), q)
            substituted_question = re.sub(r'\b' + re.escape(alias) + r'\b', info["canonical"], substituted_question, flags=re.IGNORECASE)

        factories = []
        algorithms = []
        models = []

        plan_entity_names = []
        plan_entity_types = []
        if plan and plan.tasks:
            for t in plan.tasks:
                if t.entity_names and t.entity_types:
                    for name, etype in zip(t.entity_names, t.entity_types):
                        plan_entity_names.append(name)
                        plan_entity_types.append(etype)

        if plan_entity_names and plan_entity_types:
            for name, etype in zip(plan_entity_names, plan_entity_types):
                name_lower = name.lower()
                for alias_name, info in aliases.items():
                    if alias_name == name_lower:
                        name_lower = info["canonical"].lower()
                        break
                
                if etype == "factory":
                    for f in self._factories:
                        if f["name"].lower() == name_lower:
                            exact_start_b = r"(?<!\w)" if f["name"][0].isalnum() else ""
                            exact_end_b   = r"(?!\w)"  if f["name"][-1].isalnum() else ""
                            score = 1.0 if re.search(exact_start_b + re.escape(f["name"]) + exact_end_b, question) else 0.94
                            factories.append({**f, "score": score, "match_type": "exact"})
                elif etype == "algorithm":
                    for a in self._algorithms:
                        if a["name"].lower() == name_lower:
                            exact_start_b = r"(?<!\w)" if a["name"][0].isalnum() else ""
                            exact_end_b   = r"(?!\w)"  if a["name"][-1].isalnum() else ""
                            score = 1.0 if re.search(exact_start_b + re.escape(a["name"]) + exact_end_b, question) else 0.94
                            algorithms.append({**a, "score": score, "match_type": "exact"})
                elif etype == "model":
                    for m in self._models:
                        if m["name"].lower() == name_lower:
                            exact_start_b = r"(?<!\w)" if m["name"][0].isalnum() else ""
                            exact_end_b   = r"(?!\w)"  if m["name"][-1].isalnum() else ""
                            score = 1.0 if re.search(exact_start_b + re.escape(m["name"]) + exact_end_b, question) else 0.94
                            models.append({**m, "score": score, "match_type": "exact"})

        if not factories:
            factories  = self._fuzzy_match(q, question, self._factories, "factory")
        if not algorithms:
            algorithms = self._fuzzy_match(q, question, self._algorithms, "algorithm")
        if not models:
            models     = self._fuzzy_match(q, question, self._models, "model")

        def filter_competitors(matched_list):
            matched_list.sort(key=lambda c: c["score"], reverse=True)
            seen = set()
            result = []
            for m in matched_list:
                if m["id"] not in seen:
                    seen.add(m["id"])
                    result.append(m)
            high_scores = [m["score"] for m in result if m["score"] >= 0.85]
            if high_scores:
                result = [m for m in result if m["score"] >= 0.85]
            filtered = []
            for m in result:
                has_better_competitor = False
                for f in filtered:
                    names_identical = (m["name"].lower() == f["name"].lower())
                    names_very_similar = (SequenceMatcher(None, m["name"].lower(), f["name"].lower()).ratio() > 0.85)
                    if names_identical or names_very_similar:
                        same_factory = (m.get("factory_id") == f.get("factory_id")) or (m.get("factory_id") is None) or (f.get("factory_id") is None)
                        if same_factory and (f["score"] - m["score"]) > 0.05:
                            has_better_competitor = True
                            break
                if not has_better_competitor:
                    filtered.append(m)
            return filtered

        factories = filter_competitors(factories)
        algorithms = filter_competitors(algorithms)
        models = filter_competitors(models)

        # Extract version numbers
        v_matches = re.findall(
            r'\bv(?:ersion\s*)?(\d+)\b|\bversion\s+(\d+)\b', q, re.IGNORECASE
        )
        version_numbers = list({int(a or b) for a, b in v_matches if (a or b)})

        # Detect ordinal version reference ("first version", "second version", "last version", etc.)
        # Maps to a sentinel used by the dispatcher to build the right SQL.
        # Possible values: "first", "second", "third", "fourth", "fifth",
        #                  "last", "latest", "previous", or None.
        _ORDINAL_MAP = {
            "first":    "first",
            "1st":      "first",
            "second":   "second",
            "2nd":      "second",
            "third":    "third",
            "3rd":      "third",
            "fourth":   "fourth",
            "4th":      "fourth",
            "fifth":    "fifth",
            "5th":      "fifth",
            "last":     "last",
            "latest":   "last",
            "newest":   "last",
            "previous": "previous",
            "older":    "previous",
            "earliest": "first",
        }
        version_ordinal = None
        # Only trigger when the ordinal is near a version/release context word
        _ordinal_ctx_re = re.compile(
            r'\b(' + '|'.join(re.escape(k) for k in _ORDINAL_MAP) + r')\b'
            r'(?:\s+(?:version|release|model|v))?',
            re.IGNORECASE
        )
        _ord_match = _ordinal_ctx_re.search(q)
        if _ord_match and not version_numbers:
            # Only use ordinal if no explicit numeric version was found
            version_ordinal = _ORDINAL_MAP[_ord_match.group(1).lower()]

        # Detect metric mentioned
        metric = None
        if plan and plan.tasks:
            for t in plan.tasks:
                if t.metric:
                    metric = METRIC_ALIASES.get(t.metric.lower(), t.metric)
                    break
            
        if not metric:
            for alias, canonical in METRIC_ALIASES.items():
                if re.search(r'\b' + re.escape(alias) + r'\b', q):
                    metric = canonical
                    break

        # Detect limits
        limit_match = re.search(r'\btop\s+(\d+)\b', q)
        limit = int(limit_match.group(1)) if limit_match else 5

        threshold = None
        thresh_match = re.search(
            r'(?:above|over|greater than|>|>=|minimum)\s*(\d+(?:\.\d+)?)\s*%?', q
        )
        if thresh_match:
            val = float(thresh_match.group(1))
            threshold = val / 100.0 if val > 1.5 else val

        explicit_factories = [f for f in factories if f["name"].lower() in q]
        explicit_algorithms = [a for a in algorithms if a["name"].lower() in q]
        explicit_models = [
            m for m in models 
            if m["name"].lower() in q or (m.get("name") and any(w in q for w in m["name"].lower().split("_") if len(w) >= 2))
        ]

        groups = self.extract_relationship_groups(substituted_question, factories, algorithms, models)

        # Proactively append group-resolved models to flat models list
        for g in groups:
            if g.get("model") is not None:
                m_obj = g["model"]
                if "score" not in m_obj:
                    m_obj = dict(m_obj)
                    m_obj["score"] = 1.0
                    g["model"] = m_obj
                if m_obj["id"] not in [m["id"] for m in models]:
                    models.append(m_obj)

        return {
            "factories":          factories,
            "algorithms":         algorithms,
            "models":             models,
            "version_numbers":    version_numbers,
            "version_ordinal":    version_ordinal,
            "metric":             metric,
            "limit":              limit,
            "threshold":          threshold,
            "groups":             groups,
            "explicit_factories": explicit_factories,
            "explicit_algorithms": explicit_algorithms,
            "explicit_models":    explicit_models,
        }

# ==============================================================================
# § 6  METRIC & ENTITY AMBIGUITY RESOLVERS (Ask clarification instead of guessing)
# ==============================================================================

def check_metric_ambiguity(question: str, intent: str, entities: Dict) -> Optional[Dict[str, Any]]:
    """Verify if query is ranking/analytics but lacks a metric. Ask clarification."""
    has_ranking_intent = intent in (IntentType.ANALYTICS, "analytics")
    
    if has_ranking_intent:
        if not entities.get("metric"):
            return {
                "answer": "Should I rank by Accuracy, Precision, Recall, or F1 Score?",
                "type": "text",
                "confidence": 0.6,
                "follow_ups": [
                    f"{question} by Accuracy",
                    f"{question} by F1 Score",
                    f"{question} by Precision",
                    f"{question} by Recall"
                ]
            }
    return None

def check_ambiguity(question: str, entities: Dict, intent: str) -> Optional[Dict[str, Any]]:
    """Ask clarification if multiple matched entities are within 5% score difference."""
    if intent in (IntentType.METADATA, "metadata", IntentType.VERSION_HISTORY, "version_history", IntentType.COMPARISON, "comparison"):
        
        # Check models
        models = entities.get("models", [])
        if len(models) >= 2:
            models.sort(key=lambda x: x.get("score", 1.0), reverse=True)
            for i in range(len(models)):
                for j in range(i + 1, len(models)):
                    m1 = models[i]
                    m2 = models[j]
                    if abs(m1.get("score", 1.0) - m2.get("score", 1.0)) <= 0.05:
                        names_identical = (m1["name"].lower() == m2["name"].lower())
                        names_very_similar = (SequenceMatcher(None, m1["name"].lower(), m2["name"].lower()).ratio() > 0.85)
                        if names_identical or names_very_similar:
                            candidates = [m1, m2]
                            for k in range(len(models)):
                                if k != i and k != j and abs(models[k].get("score", 1.0) - m1.get("score", 1.0)) <= 0.05:
                                    if (models[k]["name"].lower() == m1["name"].lower() or 
                                        SequenceMatcher(None, models[k]["name"].lower(), m1["name"].lower()).ratio() > 0.85):
                                        candidates.append(models[k])
                            seen_ids = set()
                            unique_cands = []
                            for c in candidates:
                                if c["id"] not in seen_ids:
                                    seen_ids.add(c["id"])
                                    unique_cands.append(c)
                            if len(unique_cands) >= 2:
                                names = [f"**{c['name']}**" for c in unique_cands[:5]]
                                return {
                                    "answer": f"⚠️ I found multiple models matching your request:\n"
                                              + "\n".join(f"- {n}" for n in names)
                                              + "\n\nWhich one did you mean? Please ask with the exact model name.",
                                    "type": "text",
                                    "confidence": 0.6,
                                    "follow_ups": [f"Tell me about {c['name']}" for c in unique_cands[:3]]
                                }

        # Check factories
        factories = entities.get("factories", [])
        if len(factories) >= 2:
            factories.sort(key=lambda x: x.get("score", 1.0), reverse=True)
            for i in range(len(factories)):
                for j in range(i + 1, len(factories)):
                    f1 = factories[i]
                    f2 = factories[j]
                    if abs(f1.get("score", 1.0) - f2.get("score", 1.0)) <= 0.05:
                        names_identical = (f1["name"].lower() == f2["name"].lower())
                        names_very_similar = (SequenceMatcher(None, f1["name"].lower(), f2["name"].lower()).ratio() > 0.85)
                        if names_identical or names_very_similar:
                            candidates = [f1, f2]
                            for k in range(len(factories)):
                                if k != i and k != j and abs(factories[k].get("score", 1.0) - f1.get("score", 1.0)) <= 0.05:
                                    if (factories[k]["name"].lower() == f1["name"].lower() or 
                                        SequenceMatcher(None, factories[k]["name"].lower(), f1["name"].lower()).ratio() > 0.85):
                                        candidates.append(factories[k])
                            seen_ids = set()
                            unique_cands = []
                            for c in candidates:
                                if c["id"] not in seen_ids:
                                    seen_ids.add(c["id"])
                                    unique_cands.append(c)
                            if len(unique_cands) >= 2:
                                names = [f"**{c['name']}**" for c in unique_cands[:5]]
                                return {
                                    "answer": f"⚠️ I found multiple factories matching your request:\n"
                                              + "\n".join(f"- {n}" for n in names)
                                              + "\n\nWhich one did you mean? Please ask with the exact factory name.",
                                    "type": "text",
                                    "confidence": 0.6,
                                    "follow_ups": [f"Tell me about {c['name']}" for c in unique_cands[:3]]
                                }

        # Check algorithms
        algorithms = entities.get("algorithms", [])
        if len(algorithms) >= 2:
            algorithms.sort(key=lambda x: x.get("score", 1.0), reverse=True)
            for i in range(len(algorithms)):
                for j in range(i + 1, len(algorithms)):
                    a1 = algorithms[i]
                    a2 = algorithms[j]
                    if abs(a1.get("score", 1.0) - a2.get("score", 1.0)) <= 0.05:
                        names_identical = (a1["name"].lower() == a2["name"].lower())
                        names_very_similar = (SequenceMatcher(None, a1["name"].lower(), a2["name"].lower()).ratio() > 0.85)
                        if names_identical or names_very_similar:
                            candidates = [a1, a2]
                            for k in range(len(algorithms)):
                                if k != i and k != j and abs(algorithms[k].get("score", 1.0) - a1.get("score", 1.0)) <= 0.05:
                                    if (algorithms[k]["name"].lower() == a1["name"].lower() or 
                                        SequenceMatcher(None, algorithms[k]["name"].lower(), a1["name"].lower()).ratio() > 0.85):
                                        candidates.append(algorithms[k])
                            seen_ids = set()
                            unique_cands = []
                            for c in candidates:
                                if c["id"] not in seen_ids:
                                    seen_ids.add(c["id"])
                                    unique_cands.append(c)
                            if len(unique_cands) >= 2:
                                names = [f"**{c['name']}**" for c in unique_cands[:5]]
                                return {
                                    "answer": f"⚠️ I found multiple algorithms matching your request:\n"
                                              + "\n".join(f"- {n}" for n in names)
                                              + "\n\nWhich one did you mean? Please ask with the exact algorithm name.",
                                    "type": "text",
                                    "confidence": 0.6,
                                    "follow_ups": [f"Tell me about {c['name']}" for c in unique_cands[:3]]
                                }
                
    return None

# ==============================================================================
# § 7  INTENT CLASSIFIER (Rules First, LLM Fallback Last)
# ==============================================================================

def _determine_comparison_type(question: str, entities: Dict) -> ComparisonType:
    q = question.lower()
    groups = entities.get("groups", [])
    group_models = [g["model"] for g in groups if g.get("model") is not None]
    group_versions = [g["version"] for g in groups if g.get("version") is not None]
    
    n_fac_exp  = len(entities.get("explicit_factories", entities["factories"]))
    n_algo_exp = len(entities.get("explicit_algorithms", entities["algorithms"]))
    n_mod_exp  = len(entities.get("explicit_models", entities["models"]))

    if len(group_models) >= 2:
        unique_mids = {m["id"] for m in group_models}
        if len(unique_mids) == 1 and len(group_versions) >= 2:
            return ComparisonType.VERSION_VS_VERSION
        elif len(unique_mids) >= 2:
            if n_mod_exp >= 2 or n_fac_exp == 0:
                return ComparisonType.MODEL_VS_MODEL

    # Special rule: compare models across multiple factories in a single algorithm context
    if n_fac_exp >= 2 and n_algo_exp == 1:
        return ComparisonType.MODELS_IN_ALGORITHM

    if (n_algo_exp >= 1 or "algorithm" in q) and ("model" in q or "models" in q) and n_mod_exp == 0:
        return ComparisonType.MODELS_IN_ALGORITHM
    if (n_fac_exp >= 1 or "factory" in q) and ("model" in q or "models" in q) and n_mod_exp == 0:
        return ComparisonType.MODELS_IN_FACTORY

    if n_fac_exp >= 1 and n_algo_exp >= 1:
        return ComparisonType.FACTORY_VS_ALGORITHM
    if n_fac_exp >= 1 and n_mod_exp >= 1:
        if n_fac_exp >= 2:
            return ComparisonType.CROSS_FACTORY_MODEL_COMPARISON
        return ComparisonType.FACTORY_VS_MODEL
    if n_algo_exp >= 1 and n_mod_exp >= 1:
        return ComparisonType.ALGORITHM_VS_MODEL
    if n_fac_exp >= 2:
        return ComparisonType.FACTORY_VS_FACTORY
    if n_algo_exp >= 2:
        return ComparisonType.ALGORITHM_VS_ALGORITHM
    if n_mod_exp >= 2:
        return ComparisonType.MODEL_VS_MODEL
    if entities["version_numbers"] and n_mod_exp >= 1:
        return ComparisonType.VERSION_VS_VERSION
    return ComparisonType.ALL_VERSIONS



# ==============================================================================
# § 8  RANKING PARSER & QUERY GENERATOR
# ==============================================================================

def parse_ranking_params(question: str, metric: str) -> Tuple[str, int, int]:
    """Parse sorting direction, query limits, and offsets from a query."""
    q = question.lower()
    is_latency = metric == "inference_time"
    
    if any(w in q for w in ["worst", "bottom", "lowest", "slowest"]):
        order = "ASC" if not is_latency else "DESC"
    else:
        order = "DESC" if not is_latency else "ASC"
        
    offset = 0
    if "second best" in q or "second-best" in q:
        offset = 1
    elif "third best" in q or "third-best" in q:
        offset = 2
        
    limit = 5
    if offset > 0:
        limit = 1
    else:
        limit_match = re.search(r'\b(?:top|bottom)\s+(\d+)\b', q)
        if limit_match:
            limit = int(limit_match.group(1))
        elif any(w in q for w in ["best", "worst", "highest", "lowest", "fastest", "slowest"]):
            limit = 1
            
    return order, limit, offset

# ==============================================================================
# § 9  SQL TEMPLATE REGISTRY (100% Parameterized to prevent SQL Injection)
# ==============================================================================

class SQLTemplateRegistry:
    @staticmethod
    def get_ranking_sql(metric: str, order: str = "DESC", has_mids: bool = False, has_aids: bool = False) -> str:
        # Secure dynamic interpolation of verified metric column names
        allowed_metrics = {"accuracy", "precision", "recall", "f1_score", "inference_time", "cpu_utilization", "gpu_utilization"}
        col = metric if metric in allowed_metrics else "accuracy"
        ord_dir = "ASC" if order == "ASC" else "DESC"
        
        where_clauses = []
        if has_mids:
            where_clauses.append("m.id IN :mids")
        if has_aids:
            where_clauses.append("m.algorithm_id IN :aids")
            
        where_str = "WHERE " + " AND ".join(where_clauses) if where_clauses else ""
        
        return f"""
            SELECT m.id AS model_id, m.name AS model_name,
                   a.name AS algorithm_name, f.name AS factory_name,
                   mv.version_number AS best_version, mv.is_active,
                   mv.{col} AS {col}, mv.f1_score, mv.accuracy,
                   mv.precision, mv.recall, mv.inference_time
            FROM models m
            JOIN algorithms a ON a.id = m.algorithm_id
            JOIN factories f ON f.id = m.factory_id
            JOIN LATERAL (
                SELECT *
                FROM model_versions
                WHERE model_id = m.id AND {col} IS NOT NULL
                ORDER BY {col} {ord_dir} LIMIT 1
            ) mv ON TRUE
            {where_str}
            ORDER BY mv.{col} {ord_dir}
            LIMIT :limit OFFSET :offset;
        """

    @staticmethod
    def get_factory_ranking_sql(metric: str, order: str = "DESC") -> str:
        allowed_metrics = {"accuracy", "precision", "recall", "f1_score", "inference_time"}
        col = metric if metric in allowed_metrics else "accuracy"
        ord_dir = "ASC" if order == "ASC" else "DESC"

        return f"""
            SELECT f.id AS factory_id, f.name AS factory_name, f.description,
                   COUNT(DISTINCT m.id) AS total_models,
                   ROUND(AVG(mv.{col})::numeric, 3) AS avg_{col},
                   ROUND(MAX(mv.{col})::numeric, 3) AS best_{col},
                   ROUND(AVG(mv.f1_score)::numeric, 3) AS avg_f1,
                   ROUND(AVG(mv.inference_time)::numeric, 2) AS avg_inference_ms
            FROM factories f
            JOIN models m ON m.factory_id = f.id
            JOIN model_versions mv ON mv.model_id = m.id
            WHERE mv.{col} IS NOT NULL
            GROUP BY f.id, f.name, f.description
            ORDER BY avg_{col} {ord_dir}
            LIMIT :limit;
        """

    @staticmethod
    def get_cross_factory_model_sql() -> str:
        return """
            SELECT m.id AS model_id, m.name AS model_name,
                   f.name AS factory_name, f.id AS factory_id,
                   mv.version_number AS best_version,
                   mv.version_number AS version_number,
                   mv.is_active,
                   mv.accuracy, mv.precision, mv.recall, mv.f1_score,
                   mv.inference_time
            FROM models m
            JOIN factories f ON f.id = m.factory_id
            JOIN LATERAL (
                SELECT version_number, is_active, accuracy, precision, recall, f1_score, inference_time
                FROM model_versions
                WHERE model_id = m.id
                ORDER BY is_active DESC, accuracy DESC NULLS LAST LIMIT 1
            ) mv ON TRUE
            WHERE m.name ILIKE :pattern
            ORDER BY mv.accuracy DESC;
        """

# ==============================================================================
# § 10 DB EXECUTION & SECURITY CHECK
# ==============================================================================

_UNSAFE = {"drop", "delete", "update", "insert", "alter", "truncate", "create"}

def _execute_sql(sql: str, db_session: Session, params: Optional[Dict] = None) -> Tuple[List[Dict], Optional[str]]:
    """Execute a read-only query safely on the database, blocking dangerous writes."""
    try:
        lower = sql.lower().strip()
        if not lower.startswith("select") and not lower.startswith("with"):
            return [], "Only SELECT queries are allowed."
        
        # Word boundary safety checks
        unsafe_patterns = [r'\bdrop\b', r'\bdelete\b', r'\bupdate\b', r'\binsert\b', r'\balter\b', r'\btruncate\b', r'\bcreate\b']
        if any(re.search(pat, lower) for pat in unsafe_patterns):
            print(f"[_execute_sql] Blocked query containing unsafe keywords: {sql}")
            return [], "Destructive database operations are blocked."
            
        print(f"[_execute_sql] Database URL: {db_session.bind.url}")
        print(f"[_execute_sql] Executing parameterized query:\n{sql}\nParams: {params}")
        
        result = db_session.execute(text(sql), params or {})
        cols = list(result.keys())
        rows = [dict(zip(cols, r)) for r in result]
        print(f"[_execute_sql] Query returned {len(rows)} rows.")
        return rows, None
    except Exception as e:
        print(f"[_execute_sql] ERROR running query:\n{sql}\nError: {e}")
        import traceback; traceback.print_exc()
        return [], str(e)

# ==============================================================================

# ==============================================================================
# § 12 DETERMINISTIC VALIDATION & SAFETY (No LLM Fact Checking)
# ==============================================================================

def deterministic_verify(results: List[Dict], generated_answer: str) -> str:
    """
    Deterministic fact checker.
    Validates that any numbers/percentages in the custom response correspond
    exactly to numbers/percentages present in the query results.
    """
    if not results:
        return "⚠️ No records found in the database."

    factual_numbers = set()
    # Add count of rows as a factual number
    factual_numbers.add(str(len(results)))
    factual_numbers.add(f"{float(len(results)):.1f}")

    for row in results:
        for val in row.values():
            if val is not None:
                try:
                    f_val = float(val)
                    factual_numbers.add(f"{f_val:.1f}")
                    factual_numbers.add(f"{f_val:.2f}")
                    factual_numbers.add(f"{f_val:.3f}")
                    factual_numbers.add(f"{int(f_val)}")
                    if f_val <= 1.0:
                        factual_numbers.add(f"{f_val*100:.1f}%")
                        factual_numbers.add(f"{f_val*100:.0f}%")
                except (ValueError, TypeError):
                    pass

    words = re.findall(r'\b\d+(?:\.\d+)?%?\b', generated_answer)
    corrected_answer = generated_answer
    for w in words:
        val_clean = w.strip('%')
        try:
            float(val_clean)
            is_valid = False
            for fn in factual_numbers:
                if val_clean in fn or fn in val_clean:
                    is_valid = True
                    break
            if not is_valid:
                corrected_answer = corrected_answer.replace(w, "Not Available")
        except ValueError:
            pass

    return corrected_answer

# ==============================================================================
# § 13 TREND ANALYZER SERVICE
# ==============================================================================

class TrendAnalyzer:
    @classmethod
    def analyze_trends(cls, rows: List[Dict], metric: str) -> Dict[str, Any]:
        """Automatically calculates version-to-version metrics progress and net improvement."""
        metric_rows = [r for r in rows if r.get(metric) is not None]
        if not metric_rows:
            return {"net_improvement": "Not Available", "insights": ["Performance metrics trend is not available."]}

        metric_rows.sort(key=lambda x: x.get("version_number", 0))

        first_val = float(metric_rows[0][metric])
        latest_val = float(metric_rows[-1][metric])
        net_diff = latest_val - first_val
        is_pct = metric not in ("inference_time", "f1_score")

        if is_pct:
            net_str = f"+{net_diff:.1f}%" if net_diff >= 0 else f"{net_diff:.1f}%"
        else:
            net_str = f"+{net_diff:.3f}" if net_diff >= 0 else f"{net_diff:.3f}"

        insights = [
            f"- **{metric.replace('_', ' ').capitalize()} Lifecycle Trend**: Changed **{net_str}** from **v{metric_rows[0].get('version_number')}** → **v{metric_rows[-1].get('version_number')}**."
        ]
        return {
            "net_improvement": net_str,
            "insights": insights
        }

# ==============================================================================
# § 14 FORMATTING UTILITIES & METRIC DELTAS
# ==============================================================================

def _fmt(val: Any, is_pct: bool = False, decimals: int = 3) -> str:
    """Format numerical values cleanly; return 'Not Available' for None."""
    if val is None:
        return "Not Available"
    try:
        f = float(val)
        if is_pct:
            if f <= 1.0 and f > 0:
                f = f * 100.0
            return f"{f:.1f}%"
        if f == int(f):
            return str(int(f))
        return f"{f:.{decimals}f}"
    except Exception:
        return str(val)

def _medal(rank: int) -> str:
    return ["🥇", "🥈", "🥉"][rank] if rank < 3 else f"#{rank + 1}"

def _best_idx(rows: List[Dict], col: str, higher_better: bool = True) -> int:
    vals = []
    for i, r in enumerate(rows):
        val = r.get(col)
        if val is not None and val != "Not Available":
            try:
                vals.append((i, float(val)))
            except ValueError:
                pass
    if not vals:
        return -1
    return (max if higher_better else min)(vals, key=lambda x: x[1])[0]

def _calculate_metric_deltas(rows: List[Dict]) -> str:
    """Calculate and format differences between metrics for compared models."""
    if len(rows) < 2:
        return ""
    
    m1 = rows[0]
    m2 = rows[1]
    
    n1 = m1.get("model_name") or m1.get("name") or "Model 1"
    n2 = m2.get("model_name") or m2.get("name") or "Model 2"
    v1 = f"v{m1.get('version_number') or m1.get('best_version') or 1}"
    v2 = f"v{m2.get('version_number') or m2.get('best_version') or 1}"
    
    lbl1 = f"**{n1} ({v1})**"
    lbl2 = f"**{n2} ({v2})**"
    
    deltas = []
    
    # Accuracy delta
    acc1, acc2 = m1.get("accuracy"), m2.get("accuracy")
    if acc1 is not None and acc2 is not None:
        diff = float(acc1) - float(acc2)
        diff_str = f"+{diff:.1f}%" if diff >= 0 else f"{diff:.1f}%"
        deltas.append(f"- **Accuracy**: {lbl1} is {diff_str} relative to {lbl2} ({_fmt(acc1, True)} vs {_fmt(acc2, True)}).")
        
    # F1 score delta
    f1_1, f1_2 = m1.get("f1_score"), m2.get("f1_score")
    if f1_1 is not None and f1_2 is not None:
        diff = float(f1_1) - float(f1_2)
        diff_str = f"+{diff:.3f}" if diff >= 0 else f"{diff:.3f}"
        deltas.append(f"- **F1 Score**: {lbl1} is {diff_str} relative to {lbl2} ({_fmt(f1_1)} vs {_fmt(f1_2)}).")

    # Precision delta
    p1, p2 = m1.get("precision"), m2.get("precision")
    if p1 is not None and p2 is not None:
        diff = float(p1) - float(p2)
        diff_str = f"+{diff:.1f}%" if diff >= 0 else f"{diff:.1f}%"
        deltas.append(f"- **Precision**: {lbl1} is {diff_str} relative to {lbl2} ({_fmt(p1, True)} vs {_fmt(p2, True)}).")

    # Recall delta
    r1, r2 = m1.get("recall"), m2.get("recall")
    if r1 is not None and r2 is not None:
        diff = float(r1) - float(r2)
        diff_str = f"+{diff:.1f}%" if diff >= 0 else f"{diff:.1f}%"
        deltas.append(f"- **Recall**: {lbl1} is {diff_str} relative to {lbl2} ({_fmt(r1, True)} vs {_fmt(r2, True)}).")
        
    # Inference time delta
    inf1, inf2 = m1.get("inference_time"), m2.get("inference_time")
    if inf1 is not None and inf2 is not None:
        diff = float(inf1) - float(inf2)
        rel_str = "slower" if diff > 0 else "faster"
        deltas.append(f"- **Latency (Inference)**: {lbl1} is {abs(diff):.1f} ms {rel_str} than {lbl2} ({_fmt(inf1)} ms vs {_fmt(inf2)} ms).")
        
    if not deltas:
        return ""
        
    return "### ⚖️ Metric Differences\n" + "\n".join(deltas) + "\n"

# ==============================================================================
# § 15 STRUCTURED FORMATTING
# ==============================================================================

def _format_single_version_detail(
    row: Dict,
    total_versions: int,
    deployed_version: Optional[Dict],
    ordinal_label: str,
) -> Dict:
    """
    Formatter for a single specific version queried by ordinal (first, second,
    last, etc.) or by explicit version number.
    Shows correct total version count and the actual deployed version rather
    than the queried one.
    """
    if not row:
        return {"answer": "\u26a0\ufe0f No data found for the requested version.", "type": "text"}

    model_name   = row.get("model_name", "Unknown")
    algo_name    = row.get("algorithm_name", "Not Available")
    factory_name = row.get("factory_name", "Not Available")
    desc         = row.get("description") or "No description available."
    vnum         = row.get("version_number", "?")
    is_this_deployed = bool(row.get("is_active"))

    lines = [
        f"## \U0001f916 Model Details \u2014 {ordinal_label} Version (v{vnum})",
        f"- **Name**: **{model_name}**",
        f"- **Description**: {desc}",
        f"- **Algorithm**: {algo_name}",
        f"- **Factory**: {factory_name}",
        f"- **Total Registered Versions**: {total_versions}",
        f"- **Viewing**: **{ordinal_label} version (v{vnum})**",
        ""
    ]

    lines += [
        "## \U0001f4ca Performance Metrics",
        f"### Version v{vnum} Metrics",
        "| Metric | Value |",
        "|---|---|",
        f"| Accuracy | **{_fmt(row.get('accuracy'), True)}** |",
        f"| Precision | **{_fmt(row.get('precision'), True)}** |",
        f"| Recall | **{_fmt(row.get('recall'), True)}** |",
        f"| F1 Score | **{_fmt(row.get('f1_score'))}** |",
        f"| Inference Latency | **{_fmt(row.get('inference_time'))} ms** |",
        f"| CPU Utilization | **{_fmt(row.get('cpu_utilization'))}%** |",
        f"| GPU Utilization | **{_fmt(row.get('gpu_utilization'))}%** |",
        ""
    ]

    lines += ["## \U0001f680 Deployment Information"]
    if is_this_deployed:
        lines += [
            f"- **This version (v{vnum}) is currently \u2705 Deployed / Active.**",
            f"- **Deployment Note**: _{row.get('note') or 'None'}_",
            ""
        ]
    elif deployed_version:
        dv = deployed_version
        lines += [
            f"- **Active/Deployed Version**: **v{dv.get('version_number')}** (not the version you are viewing)",
            f"- **This version (v{vnum})**: Inactive \u2014 not currently deployed.",
            f"- **Deployed Version Note**: _{dv.get('note') or 'None'}_",
            ""
        ]
    else:
        lines += [
            "- **Deployed Status**: \u26a0\ufe0f No version of this model is currently active/deployed.",
            ""
        ]

    lines += [
        "## \U0001f4a1 Key Insights",
        f"- You are viewing the **{ordinal_label} version (v{vnum})** of **{model_name}**.",
    ]
    if not is_this_deployed and deployed_version:
        lines.append(f"- To see the deployed version, ask: *\"Show details of v{deployed_version.get('version_number')} of {model_name}\"*")
    if total_versions > 1:
        lines.append(f"- This model has **{total_versions} total registered versions**. Ask to compare all versions for a full overview.")

    return {
        "answer": "\n".join(lines),
        "type": "text",
        "data": [row],
        "entity_type": "versions",
        "verified": True
    }


def _format_metadata_model(rows: List[Dict], entities: Dict) -> Dict:
    if not rows:
        name = entities["models"][0]["name"] if entities["models"] else "the model"
        return {"answer": f"⚠️ No data found for model **{name}** in the MARS database.", "type": "text"}

    r0 = rows[0]
    model_name   = r0.get("model_name", "Unknown")
    algo_name    = r0.get("algorithm_name", "Not Available")
    factory_name = r0.get("factory_name", "Not Available")
    desc         = r0.get("description") or "No description available."
    active_v     = next((r for r in rows if r.get("is_active")), None)
    
    acc_rows = [r for r in rows if r.get("accuracy") is not None]
    best_v   = max(acc_rows, key=lambda r: float(r["accuracy"])) if acc_rows else rows[-1]

    # Details Section
    lines = [
        "## 🤖 Model Details",
        f"- **Name**: **{model_name}**",
        f"- **Description**: {desc}",
        f"- **Algorithm**: {algo_name}",
        f"- **Factory**: {factory_name}",
        f"- **Total Registered Versions**: {len(rows)}",
        ""
    ]

    # Performance Metrics Section
    lines += [
        "## 📊 Performance Metrics",
        f"### Best Performing Version (v{best_v.get('version_number')})",
        "| Metric | Value |",
        "|---|---|",
        f"| Accuracy | **{_fmt(best_v.get('accuracy'), True)}** |",
        f"| Precision | **{_fmt(best_v.get('precision'), True)}** |",
        f"| Recall | **{_fmt(best_v.get('recall'), True)}** |",
        f"| F1 Score | **{_fmt(best_v.get('f1_score'))}** |",
        f"| Inference Latency | **{_fmt(best_v.get('inference_time'))} ms** |",
        f"| CPU Utilization | **{_fmt(best_v.get('cpu_utilization'))}%** |",
        f"| GPU Utilization | **{_fmt(best_v.get('gpu_utilization'))}%** |",
        ""
    ]

    if len(rows) > 1:
        lines += [
            "### 📈 Version History Table",
            "| Version | Accuracy | F1 | Latency | Status |",
            "|---|---|---|---|---|",
        ]
        for rv in rows:
            status = "✅ Deployed" if rv.get("is_active") else "Inactive"
            lines.append(
                f"| v{rv.get('version_number')} | "
                f"{_fmt(rv.get('accuracy'), True)} | "
                f"{_fmt(rv.get('f1_score'))} | "
                f"{_fmt(rv.get('inference_time'))} ms | {status} |"
            )
        lines.append("")

    # Deployment Information Section
    lines += ["## 🚀 Deployment Information"]
    if active_v:
        lines += [
            f"- **Active/Deployed Version**: **v{active_v.get('version_number')}**",
            f"- **Deployment Note**: _{active_v.get('note') or 'None'}_",
            f"- **Deployed Status**: Active",
            ""
        ]
    else:
        lines += [
            "- **Deployed Status**: ⚠️ No version of this model is currently active/deployed.",
            ""
        ]

    # Key Insights Section
    lines += ["## 💡 Key Insights"]
    insights_found = False
    if len(acc_rows) >= 2:
        d = float(acc_rows[-1]["accuracy"]) - float(acc_rows[0]["accuracy"])
        trend = f"+{d:.1f}%" if d >= 0 else f"{d:.1f}%"
        lines += [f"- Accuracy changed **{trend}** from **v{acc_rows[0].get('version_number')}** → **v{acc_rows[-1].get('version_number')}**."]
        insights_found = True
        
    if best_v.get("gpu_utilization") and best_v["gpu_utilization"] != "Not Available" and float(best_v["gpu_utilization"]) > 85.0:
        lines += ["- **Resource Tradeoff**: This model exhibits high GPU utilization, which may require scaling hardware during peaks."]
        insights_found = True
        
    if not insights_found:
        lines += ["- Performance remains stable across the registered lifecycle."]

    return {
        "answer": "\n".join(lines),
        "type": "text",
        "data": rows,
        "entity_type": "versions"
    }

def _format_metadata_factory(rows: List[Dict], model_rows: List[Dict], entities: Dict) -> Dict:
    if not rows:
        name = entities["factories"][0]["name"] if entities["factories"] else "the factory"
        return {"answer": f"⚠️ No data found for factory **{name}**.", "type": "text"}
        
    r = rows[0]
    name = r.get("name", "Unknown")
    desc = r.get("description") or "No description available."
    
    lines = [
        "## 🏭 Factory Details",
        f"- **Name**: **{name}**",
        f"- **Description**: {desc}",
        f"- **Total Models Run**: {r.get('total_models', 0)}",
        f"- **Total Algorithms Used**: {r.get('total_algorithms', 0)}",
        f"- **Total Model Versions**: {r.get('total_versions', 0)}",
        ""
    ]
    
    lines += [
        "## 📊 Performance Metrics",
        "| Metric | Factory Avg / Aggregate |",
        "|---|---|",
        f"| Average Accuracy | **{_fmt(r.get('avg_accuracy'), True)}** |",
        f"| Best Accuracy | **{_fmt(r.get('best_accuracy'), True)}** |",
        f"| Average F1 Score | **{_fmt(r.get('avg_f1'))}** |",
        f"| Average Latency | **{_fmt(r.get('avg_inference_ms'))} ms** |",
        ""
    ]
    
    active_models = [m for m in model_rows if m.get("total_versions", 0) > 0]
    lines += ["## 🚀 Deployment Information"]
    if active_models:
        lines += [f"- **Status**: Running **{len(active_models)}** model(s) actively."]
        for m in active_models[:3]:
            lines.append(f"  - **{m.get('model_name')}**: Best Acc {_fmt(m.get('best_accuracy'), True)} (Algo: _{m.get('algorithm_name')}_)")
    else:
        lines += ["- **Status**: No models are currently deployed in this factory."]
    lines.append("")
        
    lines += ["## 💡 Key Insights"]
    if r.get('avg_accuracy') and r['avg_accuracy'] != "Not Available" and float(r['avg_accuracy']) > 80.0:
        lines += ["- **High Performing Factory**: This site averages high accuracy across models, maintaining robust MLOps health."]
    else:
        lines += ["- **Optimization Opportunity**: Average performance metrics are below target. Consider upgrading model versions."]
        
    return {
        "answer": "\n".join(lines),
        "type": "text",
        "data": rows,
        "entity_type": "factories"
    }

def _format_metadata_algorithm(rows: List[Dict], entities: Dict) -> Dict:
    if not rows:
        name = entities["algorithms"][0]["name"] if entities["algorithms"] else "the algorithm"
        return {"answer": f"⚠️ No data found for algorithm **{name}**.", "type": "text"}
    
    r = rows[0]
    name = r.get("name", "Unknown")
    desc = r.get("description") or "No description."
    
    lines = [
        "## ⚙️ Algorithm Details",
        f"- **Name**: **{name}**",
        f"- **Description**: {desc}",
        f"- **Total Model Architectures**: {r.get('total_models', 0)}",
        f"- **Factories Utilizing**: {r.get('total_factories', 0)} ({r.get('factory_names') or 'None'})",
        ""
    ]
    
    lines += [
        "## 📊 Performance Metrics",
        "| Metric | Aggregate Value |",
        "|---|---|",
        f"| Average Accuracy | **{_fmt(r.get('avg_accuracy'), True)}** |",
        f"| Best Accuracy | **{_fmt(r.get('best_accuracy'), True)}** |",
        f"| Average F1 Score | **{_fmt(r.get('avg_f1'))}** |",
        ""
    ]
    
    lines += [
        "## 💡 Key Insights",
        f"- The {name} algorithm is deployed across {r.get('total_factories', 0)} sites, demonstrating versatile generalization."
    ]
    
    return {
        "answer": "\n".join(lines),
        "type": "text",
        "data": rows,
        "entity_type": "algorithms"
    }

def _format_comparison_models(rows: List[Dict], entities: Dict) -> Dict:
    if not rows:
        return {"answer": "⚠️ No comparison data found for the requested models.", "type": "text"}
        
    has_diff_factories = len(set(r.get("factory_name") for r in rows if r.get("factory_name"))) > 1
    if has_diff_factories:
        title = " vs ".join(f"**{r.get('model_name','?')} in {r.get('factory_name','?')}**" for r in rows)
    else:
        title = " vs ".join(f"**{r.get('model_name','?')}**" for r in rows)
    lines = [
        "## ⚔️ Comparison Summary",
        f"Side-by-side performance breakdown for: {title}.",
        ""
    ]

    metrics = [
        ("Accuracy",        "accuracy",        True,  True),
        ("Precision",       "precision",       True,  True),
        ("Recall",          "recall",          True,  True),
        ("F1 Score",        "f1_score",        False, True),
        ("Inference (ms)",  "inference_time",  False, False),
        ("CPU %",           "cpu_utilization", False, False),
        ("GPU %",           "gpu_utilization", False, False),
    ]
    labels = []
    for r in rows:
        mname = r.get('model_name','?')
        vnum = r.get('best_version') or r.get('version_number') or 1
        fname = r.get('factory_name')
        if has_diff_factories and fname:
            labels.append(f"{mname} ({fname}) (v{vnum})")
        else:
            labels.append(f"{mname} (v{vnum})")
    header = "| Metric | " + " | ".join(f"**{l}**" for l in labels) + " |"
    sep    = "|---|" + "---|" * len(rows)
    table  = [header, sep]
    
    for name, col, is_pct, higher_better in metrics:
        vals = [r.get(col) for r in rows]
        fmted = [_fmt(v, is_pct) for v in vals]
        bidx = _best_idx(rows, col, higher_better)
        if bidx >= 0:
            fmted[bidx] = f"**{fmted[bidx]}** ✓"
        table.append("| " + name + " | " + " | ".join(fmted) + " |")
        
    lines += ["## 📊 Performance Metrics", "", "\n".join(table), ""]
    
    delta_str = _calculate_metric_deltas(rows)
    if delta_str:
        lines += [delta_str, ""]

    # Key Insights
    lines += ["## 💡 Key Insights"]
    insights = []
    
    b_acc_idx = _best_idx(rows, "accuracy", True)
    b_speed_idx = _best_idx(rows, "inference_time", False)
    
    if b_acc_idx >= 0 and b_speed_idx >= 0:
        if b_acc_idx != b_speed_idx:
            n_acc = rows[b_acc_idx].get("model_name")
            n_spd = rows[b_speed_idx].get("model_name")
            insights.append(f"- **Latency Tradeoff**: **{n_acc}** is more accurate, but **{n_spd}** is faster.")
        else:
            n_both = rows[b_acc_idx].get("model_name")
            insights.append(f"- **Dominant Model**: **{n_both}** dominates in both accuracy and speed.")
            
    for r in rows:
        cpu = r.get("cpu_utilization")
        if cpu and cpu != "Not Available" and float(cpu) > 80.0:
            insights.append(f"- **Resource Alarm**: **{r.get('model_name')}** has high CPU usage ({_fmt(cpu)}%).")
            
    if not insights:
        insights.append("- Model profiles are relatively similar in operational behavior.")
    lines += insights + [""]

    # Recommendations
    lines += ["## 🏆 Recommendations"]
    bidx = _best_idx(rows, "accuracy", True)
    if bidx >= 0:
        rec_model = rows[bidx].get("model_name")
        acc_val = _fmt(rows[bidx].get("accuracy"), True)
        lines += [
            f"Based on accuracy benchmarking, we recommend deploying **{rec_model}** due to its top-performing accuracy of **{acc_val}**.",
            "If runtime environments are hardware-constrained, review the latency and CPU/GPU footprints above."
        ]
    else:
        lines += ["Insufficient performance data to recommend a specific deployment candidate."]

    return {
        "answer": "\n".join(lines),
        "type": "comparison",
        "data": rows,
        "entity_type": "models"
    }

def _format_comparison_factories(rows: List[Dict], entities: Dict) -> Dict:
    if not rows:
        return {"answer": "⚠️ No comparison data found for the factories.", "type": "text"}
        
    labels = [r.get("factory_name", "?") for r in rows]
    title = " vs ".join(f"**{l}**" for l in labels)
    
    lines = [
        "## ⚔️ Comparison Summary",
        f"Cross-factory comparison of operations and aggregate models for: {title}.",
        ""
    ]
    
    metrics = [
        ("Total Models",     "total_models",     False, True),
        ("Algorithms Used",  "total_algorithms", False, True),
        ("Avg Accuracy",     "avg_accuracy",     True,  True),
        ("Best Accuracy",    "best_accuracy",    True,  True),
        ("Avg F1 Score",     "avg_f1",           False, True),
        ("Avg Inference",    "avg_inference_ms", False, False),
    ]
    header = "| Metric | " + " | ".join(f"**{l}**" for l in labels) + " |"
    sep    = "|---|" + "---|" * len(rows)
    table  = [header, sep]
    
    for name, col, is_pct, higher_better in metrics:
        vals = [r.get(col) for r in rows]
        fmted = [_fmt(v, is_pct) for v in vals]
        bidx = _best_idx(rows, col, higher_better)
        if bidx >= 0:
            fmted[bidx] = f"**{fmted[bidx]}** ✓"
        table.append("| " + name + " | " + " | ".join(fmted) + " |")
        
    lines += ["## 📊 Performance Metrics", "", "\n".join(table), ""]
    
    lines += ["## 💡 Key Insights"]
    bidx = _best_idx(rows, "avg_accuracy", True)
    if bidx >= 0:
        lines += [f"- **{rows[bidx].get('factory_name')}** leads overall factory efficiency with a higher average accuracy."]
    else:
        lines += ["- Factory operational footprints are closely matched."]
    lines.append("")
        
    lines += ["## 🏆 Recommendations"]
    if bidx >= 0:
        lines += [f"Based on aggregate model parameters, **{rows[bidx].get('factory_name')}** serves as the benchmark factory for model deployments."]
        
    return {
        "answer": "\n".join(lines),
        "type": "sql",
        "data": rows,
        "entity_type": "factories"
    }

def _format_comparison_algorithms(rows: List[Dict], entities: Dict) -> Dict:
    if not rows:
        return {"answer": "⚠️ No comparison data found for the algorithms.", "type": "text"}
        
    labels = [r.get("algorithm_name", "?") for r in rows]
    title = " vs ".join(f"**{l}**" for l in labels)
    
    lines = [
        "## ⚔️ Comparison Summary",
        f"Benchmarking analysis of algorithm models: {title}.",
        ""
    ]
    
    metrics = [
        ("Total Models Run", "total_models",     False, True),
        ("Factories Used In", "total_factories",  False, True),
        ("Avg Accuracy",     "avg_accuracy",     True,  True),
        ("Best Accuracy",    "best_accuracy",    True,  True),
        ("Avg F1 Score",     "avg_f1",           False, True),
        ("Avg Inference",    "avg_inference_ms", False, False),
    ]
    header = "| Metric | " + " | ".join(f"**{l}**" for l in labels) + " |"
    sep    = "|---|" + "---|" * len(rows)
    table  = [header, sep]
    
    for name, col, is_pct, higher_better in metrics:
        vals = [r.get(col) for r in rows]
        fmted = [_fmt(v, is_pct) for v in vals]
        bidx = _best_idx(rows, col, higher_better)
        if bidx >= 0:
            fmted[bidx] = f"**{fmted[bidx]}** ✓"
        table.append("| " + name + " | " + " | ".join(fmted) + " |")
        
    lines += ["## 📊 Performance Metrics", "", "\n".join(table), ""]
    
    lines += ["## 💡 Key Insights"]
    bidx = _best_idx(rows, "avg_accuracy", True)
    if bidx >= 0:
        lines += [f"- **{rows[bidx].get('algorithm_name')}** yields higher average precision-recall ratios and better deployment metrics."]
    else:
        lines += ["- Algorithmic throughput averages remain highly comparable."]
    lines.append("")
        
    lines += ["## 🏆 Recommendations"]
    if bidx >= 0:
        lines += [f"Select **{rows[bidx].get('algorithm_name')}** for general use cases to leverage superior standard metrics."]
        
    return {
        "answer": "\n".join(lines),
        "type": "sql",
        "data": rows,
        "entity_type": "algorithms"
    }

def _format_models_in_group(rows: List[Dict], group_name: str, group_type: str) -> Dict:
    if not rows:
        return {"answer": f"⚠️ No models found in {group_type} **{group_name}**.", "type": "text"}
        
    count = len(rows)
    bidx  = _best_idx(rows, "accuracy", True)
    best  = rows[bidx] if bidx >= 0 else rows[0]
    
    lines = [
        f"## 📊 Performance Metrics for Models in {group_type.capitalize()}: **{group_name}**",
        f"Found **{count} model(s)**. Here is how they rank:",
        "",
        "| Rank | Model | Factory | Best Ver | Accuracy | F1 | Latency |",
        "|---|---|---|---|---|---|---|",
    ]
    for i, r in enumerate(rows):
        lines.append(
            f"| {_medal(i)} | **{r.get('model_name','?')}** | "
            f"{r.get('factory_name','?')} | v{r.get('best_version','?')} | "
            f"{_fmt(r.get('accuracy'), True)} | {_fmt(r.get('f1_score'))} | "
            f"{_fmt(r.get('inference_time'))} ms |"
        )
    lines.append("")
        
    lines += [
        "## 💡 Key Insights",
        f"- The top performer is **{best.get('model_name','?')}** running at **{best.get('factory_name','?')}**.",
        ""
    ]
    
    lines += [
        "## 🏆 Recommendations",
        f"We recommend utilizing **{best.get('model_name','?')}** for workloads requiring optimized accuracy."
    ]
    
    return {
        "answer": "\n".join(lines),
        "type": "comparison",
        "data": rows,
        "entity_type": "versions"
    }

def _format_analytics(rows: List[Dict], metric: str, question: str) -> Dict:
    if not rows:
        return {"answer": "⚠️ No models met the criteria for this analytics query.", "type": "text"}
        
    display = {
        "accuracy": "Accuracy", "precision": "Precision", "recall": "Recall",
        "f1_score": "F1 Score", "inference_time": "Inference Time",
    }.get(metric, metric.replace("_", " ").capitalize())
    is_pct   = metric not in ("inference_time", "f1_score")
    is_speed = metric == "inference_time"
    
    lines = [
        f"## 📊 Performance Metrics (Top Ranked Models by {display})",
        "",
        f"| Rank | Model | Factory | Algorithm | {display} | F1 | Status |",
        "|---|---|---|---|---|---|---|",
    ]
    for i, r in enumerate(rows):
        status = "✅ Active" if r.get("is_active") else "Inactive"
        lines.append(
            f"| {_medal(i)} | **{r.get('model_name','?')}** | "
            f"{r.get('factory_name','?')} | {r.get('algorithm_name','?')} | "
            f"{_fmt(r.get(metric), is_pct)} | {_fmt(r.get('f1_score'))} | "
            f"{status} |"
        )
    lines.append("")
    
    best = rows[0]
    superlative = "fastest" if is_speed else "highest performing"
    
    lines += [
        "## 💡 Key Insights",
        f"- **{best.get('model_name','?')}** deployed at **{best.get('factory_name','?')}** leads as the {superlative} candidate with a metric value of **{_fmt(best.get(metric), is_pct)}**.",
        ""
    ]
    
    lines += [
        "## 🏆 Recommendations",
        f"Deploy **{best.get('model_name','?')}** for performance-critical pipelines that optimize for {display}."
    ]
    
    return {
        "answer": "\n".join(lines),
        "type": "sql",
        "data": rows,
        "entity_type": "models"
    }

def _format_version_history(rows: List[Dict], entities: Dict) -> Dict:
    if not rows:
        name = entities["models"][0]["name"] if entities["models"] else "the model"
        return {"answer": f"⚠️ No version history found for **{name}**.", "type": "text"}
        
    model_name = rows[0].get("model_name", "Model")
    
    lines = [
        "## 🤖 Model Details",
        f"- **Model Name**: **{model_name}**",
        f"- **Total Versions Registered**: {len(rows)}",
        ""
    ]
    
    lines += [
        "## 📊 Performance Metrics (Version Breakdown)",
        "| Version | Accuracy | F1 | Latency | Status | Note | Delta (Acc) |",
        "|---|---|---|---|---|---|---|",
    ]
    
    prev_acc = None
    for i, v in enumerate(rows):
        status = "✅ Deployed" if v.get("is_active") else "Inactive"
        acc = v.get("accuracy")
        delta_str = "—"
        if acc is not None:
            if prev_acc is not None:
                diff = float(acc) - float(prev_acc)
                delta_str = f"+{diff:.1f}%" if diff >= 0 else f"{diff:.1f}%"
            prev_acc = acc
            
        lines.append(
            f"| v{v.get('version_number')} | "
            f"{_fmt(v.get('accuracy'), True)} | "
            f"{_fmt(v.get('f1_score'))} | "
            f"{_fmt(v.get('inference_time'))} ms | {status} | "
            f"{v.get('note') or '—'} | {delta_str} |"
        )
    lines.append("")
    
    acc_rows = [r for r in rows if r.get("accuracy") is not None]
    if len(acc_rows) >= 2:
        diff = float(acc_rows[-1]["accuracy"]) - float(acc_rows[0]["accuracy"])
        trend = f"+{diff:.1f}%" if diff >= 0 else f"{diff:.1f}%"
        lines += [
            "### ⚖️ Metric Differences",
            f"- **Lifecycle Accuracy Trend**: Changed **{trend}** from **v{acc_rows[0].get('version_number')}** → **v{acc_rows[-1].get('version_number')}**.",
            ""
        ]
        
    active_v = next((r for r in rows if r.get("is_active")), None)
    lines += ["## 🚀 Deployment Information"]
    if active_v:
        lines += [f"- **Current Active Version**: **v{active_v.get('version_number')}** (Deployed)"]
    else:
        lines += ["- **Current Active Version**: ⚠️ No active version is deployed."]
    lines.append("")
        
    lines += ["## 💡 Key Insights"]
    if acc_rows:
        best_v = max(acc_rows, key=lambda r: float(r["accuracy"]))
        lines += [f"- **Peak Version**: **v{best_v.get('version_number')}** reached highest accuracy of **{_fmt(best_v.get('accuracy'), True)}**."]
    else:
        lines += ["- Metric details are underpopulated for tracking performance trends."]
        
    return {
        "answer": "\n".join(lines),
        "type": "comparison",
        "data": rows,
        "entity_type": "versions"
    }

def _format_cross_factory_model_comparison(rows: List[Dict], entities: Dict) -> Dict:
    if not rows:
        return {"answer": "⚠️ No comparison data found for the cross-factory model comparison.", "type": "text"}
    
    title = " vs ".join(f"**{r.get('model_name','?')} in {r.get('factory_name','?')}**" for r in rows)
    lines = [
        "## ⚔️ Comparison Summary",
        f"Cross-factory model comparison for: {title}.",
        ""
    ]
    
    metrics = [
        ("Best Version",    "best_version",    False, True),
        ("Accuracy",        "accuracy",        True,  True),
        ("Precision",       "precision",       True,  True),
        ("Recall",          "recall",          True,  True),
        ("F1 Score",        "f1_score",        False, True),
        ("Inference (ms)",  "inference_time",  False, False),
    ]
    
    labels = [f"{r.get('model_name','?')} ({r.get('factory_name','?')})" for r in rows]
    header = "| Metric | " + " | ".join(f"**{l}**" for l in labels) + " |"
    sep    = "|---|" + "---|" * len(rows)
    table  = [header, sep]
    
    for name, col, is_pct, higher_better in metrics:
        vals = [r.get(col) for r in rows]
        fmted = [_fmt(v, is_pct) for v in vals]
        bidx = _best_idx(rows, col, higher_better)
        if bidx >= 0:
            fmted[bidx] = f"**{fmted[bidx]}** ✓"
        table.append("| " + name + " | " + " | ".join(fmted) + " |")
        
    lines += ["## 📊 Performance Metrics", "", "\n".join(table), ""]
    
    delta_str = _calculate_metric_deltas(rows)
    if delta_str:
        lines += [delta_str, ""]
        
    lines += ["## 💡 Key Insights"]
    bidx = _best_idx(rows, "accuracy", True)
    if bidx >= 0:
        lines += [f"- The model configuration at **{rows[bidx].get('factory_name')}** performs better by accuracy."]
    else:
        lines += ["- Metrics are identical across sites."]
    lines.append("")
    
    lines += ["## 🏆 Recommendations"]
    if bidx >= 0:
        lines += [f"Deploy the model configuration from **{rows[bidx].get('factory_name')}** for general usage."]
        
    return {
        "answer": "\n".join(lines),
        "type": "comparison",
        "data": rows,
        "entity_type": "models"
    }

def compare_factory_vs_algorithm(factory_id: int, algorithm_id: int, db: Session) -> Dict:
    f_rows, _ = _execute_sql("""
        SELECT f.name AS name,
               ROUND(AVG(mv.accuracy)::numeric, 2) AS avg_accuracy,
               ROUND(MAX(mv.accuracy)::numeric, 2) AS best_accuracy,
               ROUND(AVG(mv.f1_score)::numeric, 3) AS avg_f1,
               ROUND(AVG(mv.inference_time)::numeric, 2) AS avg_inference_ms
        FROM factories f
        LEFT JOIN models m ON m.factory_id = f.id
        LEFT JOIN model_versions mv ON mv.model_id = m.id
        WHERE f.id = :fid
        GROUP BY f.name;
    """, db, {"fid": factory_id})
    
    a_rows, _ = _execute_sql("""
        SELECT a.name AS name,
               ROUND(AVG(mv.accuracy)::numeric, 2) AS avg_accuracy,
               ROUND(MAX(mv.accuracy)::numeric, 2) AS best_accuracy,
               ROUND(AVG(mv.f1_score)::numeric, 3) AS avg_f1,
               ROUND(AVG(mv.inference_time)::numeric, 2) AS avg_inference_ms
        FROM algorithms a
        LEFT JOIN models m ON m.algorithm_id = a.id
        LEFT JOIN model_versions mv ON mv.model_id = m.id
        WHERE a.id = :aid
        GROUP BY a.name;
    """, db, {"aid": algorithm_id})
    
    if not f_rows or not a_rows:
        return {"answer": "⚠️ Missing data for comparison.", "type": "text"}
        
    f_data = f_rows[0]
    a_data = a_rows[0]
    
    lines = [
        "## ⚔️ Comparison Summary",
        f"Comparing Factory **{f_data['name']}** and Algorithm **{a_data['name']}**.",
        "",
        "## 📊 Performance Metrics",
        "| Metric | Factory: " + f_data['name'] + " | Algorithm: " + a_data['name'] + " |",
        "|---|---|---|",
        f"| Avg Accuracy | {_fmt(f_data['avg_accuracy'], True)} | {_fmt(a_data['avg_accuracy'], True)} |",
        f"| Best Accuracy | {_fmt(f_data['best_accuracy'], True)} | {_fmt(a_data['best_accuracy'], True)} |",
        f"| Avg F1 Score | {_fmt(f_data['avg_f1'])} | {_fmt(a_data['avg_f1'])} |",
        f"| Avg Latency | {_fmt(f_data['avg_inference_ms'])} ms | {_fmt(a_data['avg_inference_ms'])} ms |",
        "",
        "## 💡 Key Insights",
        f"- Factory **{f_data['name']}** reflects operational performance in its physical site.",
        f"- Algorithm **{a_data['name']}** represents performance across all factories using this architecture."
    ]
    return {"answer": "\n".join(lines), "type": "sql", "data": f_rows + a_rows}

def compare_factory_vs_model(factory_id: int, model_id: int, db: Session) -> Dict:
    f_rows, _ = _execute_sql("""
        SELECT f.name AS name,
               ROUND(AVG(mv.accuracy)::numeric, 2) AS avg_accuracy,
               ROUND(MAX(mv.accuracy)::numeric, 2) AS best_accuracy,
               ROUND(AVG(mv.f1_score)::numeric, 3) AS avg_f1,
               ROUND(AVG(mv.inference_time)::numeric, 2) AS avg_inference_ms
        FROM factories f
        LEFT JOIN models m ON m.factory_id = f.id
        LEFT JOIN model_versions mv ON mv.model_id = m.id
        WHERE f.id = :fid
        GROUP BY f.name;
    """, db, {"fid": factory_id})
    
    m_rows, _ = _execute_sql("""
        SELECT m.name AS name,
               ROUND(MAX(mv.accuracy)::numeric, 2) AS best_accuracy,
               ROUND(AVG(mv.accuracy)::numeric, 2) AS avg_accuracy,
               ROUND(AVG(mv.f1_score)::numeric, 3) AS avg_f1,
               ROUND(AVG(mv.inference_time)::numeric, 2) AS avg_inference_ms
        FROM models m
        LEFT JOIN model_versions mv ON mv.model_id = m.id
        WHERE m.id = :mid
        GROUP BY m.name;
    """, db, {"mid": model_id})
    
    if not f_rows or not m_rows:
        return {"answer": "⚠️ Missing data for comparison.", "type": "text"}
        
    f_data = f_rows[0]
    m_data = m_rows[0]
    
    lines = [
        "## ⚔️ Comparison Summary",
        f"Comparing Factory **{f_data['name']}** and Model **{m_data['name']}**.",
        "",
        "## 📊 Performance Metrics",
        "| Metric | Factory: " + f_data['name'] + " | Model: " + m_data['name'] + " |",
        "|---|---|---|",
        f"| Avg Accuracy | {_fmt(f_data['avg_accuracy'], True)} | {_fmt(m_data['avg_accuracy'], True)} |",
        f"| Best Accuracy | {_fmt(f_data['best_accuracy'], True)} | {_fmt(m_data['best_accuracy'], True)} |",
        f"| Avg F1 Score | {_fmt(f_data['avg_f1'])} | {_fmt(m_data['avg_f1'])} |",
        f"| Avg Latency | {_fmt(f_data['avg_inference_ms'])} ms | {_fmt(m_data['avg_inference_ms'])} ms |",
        "",
        "## 💡 Key Insights",
        f"- Factory **{f_data['name']}** represents the average performance of all its models.",
        f"- Model **{m_data['name']}** represents a specific deployed architecture's performance."
    ]
    return {"answer": "\n".join(lines), "type": "sql", "data": f_rows + m_rows}

def compare_algorithm_vs_model(algorithm_id: int, model_id: int, db: Session) -> Dict:
    a_rows, _ = _execute_sql("""
        SELECT a.name AS name,
               ROUND(AVG(mv.accuracy)::numeric, 2) AS avg_accuracy,
               ROUND(MAX(mv.accuracy)::numeric, 2) AS best_accuracy,
               ROUND(AVG(mv.f1_score)::numeric, 3) AS avg_f1,
               ROUND(AVG(mv.inference_time)::numeric, 2) AS avg_inference_ms
        FROM algorithms a
        LEFT JOIN models m ON m.algorithm_id = a.id
        LEFT JOIN model_versions mv ON mv.model_id = m.id
        WHERE a.id = :aid
        GROUP BY a.name;
    """, db, {"aid": algorithm_id})
    
    m_rows, _ = _execute_sql("""
        SELECT m.name AS name,
               ROUND(MAX(mv.accuracy)::numeric, 2) AS best_accuracy,
               ROUND(AVG(mv.accuracy)::numeric, 2) AS avg_accuracy,
               ROUND(AVG(mv.f1_score)::numeric, 3) AS avg_f1,
               ROUND(AVG(mv.inference_time)::numeric, 2) AS avg_inference_ms
        FROM models m
        LEFT JOIN model_versions mv ON mv.model_id = m.id
        WHERE m.id = :mid
        GROUP BY m.name;
    """, db, {"mid": model_id})
    
    if not a_rows or not m_rows:
        return {"answer": "⚠️ Missing data for comparison.", "type": "text"}
        
    a_data = a_rows[0]
    m_data = m_rows[0]
    
    lines = [
        "## ⚔️ Comparison Summary",
        f"Comparing Algorithm **{a_data['name']}** and Model **{m_data['name']}**.",
        "",
        "## 📊 Performance Metrics",
        "| Metric | Algorithm: " + a_data['name'] + " | Model: " + m_data['name'] + " |",
        "|---|---|---|",
        f"| Avg Accuracy | {_fmt(a_data['avg_accuracy'], True)} | {_fmt(m_data['avg_accuracy'], True)} |",
        f"| Best Accuracy | {_fmt(a_data['best_accuracy'], True)} | {_fmt(m_data['best_accuracy'], True)} |",
        f"| Avg F1 Score | {_fmt(a_data['avg_f1'])} | {_fmt(m_data['avg_f1'])} |",
        f"| Avg Latency | {_fmt(a_data['avg_inference_ms'])} ms | {_fmt(m_data['avg_inference_ms'])} ms |",
        "",
        "## 💡 Key Insights",
        f"- Algorithm **{a_data['name']}** performance represents the aggregate of all models using this architecture.",
        f"- Model **{m_data['name']}** is a specific instance of a model utilizing this algorithm."
    ]
    return {"answer": "\n".join(lines), "type": "sql", "data": a_rows + m_rows}

def _format_list(rows: List[Dict], entity_type: str) -> Dict:
    if not rows:
        return {"answer": f"⚠️ No {entity_type} found.", "type": "text"}
    count = len(rows)
    icon  = {"factories": "🏭", "algorithms": "⚙️", "models": "🤖"}.get(entity_type, "📋")
    names = [r.get("name") or r.get("model_name") or r.get("factory_name") or r.get("algorithm_name")
             for r in rows if any(r.get(k) for k in ("name","model_name","factory_name","algorithm_name"))]
    shown  = names[:5]
    suffix = f" and {count - 5} more" if count > 5 else ""
    name_list = ", ".join(f"**{n}**" for n in shown) + suffix
    answer = f"{icon} There are **{count} {entity_type}** registered: {name_list}."
    return {
        "answer": answer,
        "type": "sql",
        "data": rows,
        "entity_type": entity_type
    }

def _enrich(rows: List[Dict], entity_type: Optional[str], db: Session) -> List[Dict]:
    if not rows or not entity_type:
        return rows
    enriched = []
    for row in rows:
        r = dict(row)
        try:
            if entity_type == "factories":
                if not r.get("id") and r.get("name"):
                    res = db.execute(text("SELECT id FROM factories WHERE name=:n LIMIT 1"),
                                     {"n": r["name"]}).fetchone()
                    if res: r["id"] = res[0]
            elif entity_type == "algorithms":
                if not r.get("id") and r.get("name"):
                    res = db.execute(text("SELECT id FROM algorithms WHERE name=:n LIMIT 1"),
                                     {"n": r["name"]}).fetchone()
                    if res: r["id"] = res[0]
            elif entity_type == "models":
                mid = r.get("id") or r.get("model_id")
                if not mid:
                    name = r.get("model_name") or r.get("name")
                    if name:
                        res = db.execute(text("SELECT id FROM models WHERE name=:n LIMIT 1"),
                                         {"n": name}).fetchone()
                        if res: mid = res[0]; r["id"] = mid
                if mid:
                    res = db.execute(text("""
                        SELECT m.name,m.algorithm_id,m.factory_id,a.name,f.name
                        FROM models m
                        LEFT JOIN algorithms a ON a.id=m.algorithm_id
                        LEFT JOIN factories  f ON f.id=m.factory_id
                        WHERE m.id=:mid
                    """), {"mid": mid}).fetchone()
                    if res:
                        r["name"] = res[0]; r["id"] = mid
                        r["algorithm_id"] = res[1]; r["factory_id"] = res[2]
                        r["algorithm_name"] = res[3]; r["factory_name"] = res[4]
            elif entity_type == "versions":
                mid = r.get("model_id")
                if not mid and r.get("model_name"):
                    res = db.execute(text("SELECT id FROM models WHERE name=:n LIMIT 1"),
                                     {"n": r["model_name"]}).fetchone()
                    if res: mid = res[0]; r["model_id"] = mid
                if mid:
                    res = db.execute(text("""
                        SELECT m.name,m.algorithm_id,m.factory_id,a.name,f.name
                        FROM models m
                        LEFT JOIN algorithms a ON a.id=m.algorithm_id
                        LEFT JOIN factories  f ON f.id=m.factory_id
                        WHERE m.id=:mid
                    """), {"mid": mid}).fetchone()
                    if res:
                        r["model_name"] = res[0]; r["model_id"] = mid
                        r["algorithm_id"] = res[1]; r["factory_id"] = res[2]
                        r["algorithm_name"] = res[3]; r["factory_name"] = res[4]
        except Exception:
            pass
        enriched.append(r)
    return enriched

def _run_download(question: str, db_session: Session, entities: Optional[Dict] = None, context: List[Dict] = []) -> Dict[str, Any]:
    """
    Determine the report type and name from extracted entities first,
    falling back to keyword matching on the raw question only if needed.

    Priority order:
      1. Entities dict (models → model, algorithms → algorithm, factories → factory)
      1. Explicit keyword phrases in the question ("factory report", "algorithm report", etc.)
      2. Entities dict (models → model, algorithms → algorithm, factories → factory)
      3. Raw keyword presence ("model", "algorithm" in question)
      4. Default: factory
    """
    q = question.lower()

    # ── 0. Check if this is a follow-up answer to a model version zip download prompt ──
    last_bot_msg = None
    if context:
        for msg in reversed(context):
            if msg.get("role") == "bot":
                last_bot_msg = msg.get("content", "")
                break

    if last_bot_msg:
        # Match pattern: <!-- DOWNLOAD_PROMPT: model_id=(\d+), version_id=(\d+), available=\{(.*?)\} -->
        match = re.search(r"<!-- DOWNLOAD_PROMPT: model_id=(\d+), version_id=(\d+), available=\{(.*?)\} -->", last_bot_msg)
        if match:
            model_id = int(match.group(1))
            version_id = int(match.group(2))
            available_str = match.group(3)
            available_types = {}
            if available_str.strip():
                for item in available_str.split(","):
                    if ":" in item:
                        k, v = item.split(":")
                        available_types[k.strip().replace("'", "").replace('"', '')] = int(v.strip())

            model_row = db_session.execute(
                text("SELECT id, name, algorithm_id, factory_id FROM models WHERE id = :id"),
                {"id": model_id}
            ).fetchone()
            version_row = db_session.execute(
                text("SELECT id, version_number FROM model_versions WHERE id = :id"),
                {"id": version_id}
            ).fetchone()

            if model_row and version_row:
                download_all = any(w in q for w in ["all", "everything", "whole", "complete", "both"])
                dataset_selected = download_all or any(w in q for w in ["dataset", "image", "images", "data"])
                labels_selected = download_all or any(w in q for w in ["label", "labels", "annotation", "annotations"])
                model_selected = download_all or any(w in q for w in ["model", "weights", "parameter", "parameters", "pt", "pth", "onnx", "engine"])
                code_selected = download_all or any(w in q for w in ["code", "script", "scripts", "py", "python", "src"])

                if not (dataset_selected or labels_selected or model_selected or code_selected):
                    dataset_selected = labels_selected = model_selected = code_selected = True

                selected_types_display = []
                params = {}

                if dataset_selected and "dataset" in available_types:
                    params["dataset"] = "true"
                    selected_types_display.append("Dataset")
                if labels_selected and "label" in available_types:
                    params["labels"] = "true"
                    selected_types_display.append("Labels")
                if model_selected and "model" in available_types:
                    params["model"] = "true"
                    selected_types_display.append("Model weights")
                if code_selected and "code" in available_types:
                    params["code"] = "true"
                    selected_types_display.append("Code")

                if not params:
                    if "dataset" in available_types:
                        params["dataset"] = "true"
                        selected_types_display.append("Dataset")
                    if "label" in available_types:
                        params["labels"] = "true"
                        selected_types_display.append("Labels")
                    if "model" in available_types:
                        params["model"] = "true"
                        selected_types_display.append("Model weights")
                    if "code" in available_types:
                        params["code"] = "true"
                        selected_types_display.append("Code")

                query_str = "&".join(f"{k}={v}" for k, v in params.items())
                download_url = f"/algorithms/{model_row.algorithm_id}/factories/{model_row.factory_id}/models/{model_row.id}/versions/{version_row.id}/download?{query_str}"

                components_str = ", ".join(selected_types_display)
                return {
                    "answer": f"Here is the zip file export bundle for **{model_row.name}** (v{version_row.version_number}) containing the selected components: **{components_str}**.\n\nClick the button below to download the zip file.",
                    "type": "zip_download",
                    "download_url": download_url,
                    "model_name": model_row.name,
                    "version_number": version_row.version_number,
                    "components": selected_types_display,
                    "follow_ups": [
                        f"Download all files for {model_row.name} v{version_row.version_number}",
                        "List all factories"
                    ]
                }

    # ── 0.5. Check if the initial query is asking for a version zip file / export bundle ──
    is_zip_request = any(w in q for w in ["zip", "bundle", "export", "files", "artifact", "artifacts"])
    has_model_and_ver = bool(entities and entities.get("models") and (entities.get("version_numbers") or entities.get("version_ordinal") or "version" in q or "active" in q or "artifact" in q or "artifacts" in q))

    if is_zip_request and has_model_and_ver:
        model_name = entities["models"][0]["name"]
        model_row = db_session.execute(
            text("SELECT id, name, algorithm_id, factory_id FROM models WHERE name = :name"),
            {"name": model_name}
        ).fetchone()

        if model_row:
            version_row = None
            version_number = None

            if entities.get("version_numbers"):
                version_number = entities["version_numbers"][0]
                version_row = db_session.execute(
                    text("SELECT id, version_number FROM model_versions WHERE model_id = :model_id AND version_number = :version_number"),
                    {"model_id": model_row.id, "version_number": version_number}
                ).fetchone()
            elif entities.get("version_ordinal"):
                order = "ASC" if entities["version_ordinal"] in ("first", "earliest") else "DESC"
                version_row = db_session.execute(
                    text(f"SELECT id, version_number FROM model_versions WHERE model_id = :model_id ORDER BY version_number {order} LIMIT 1"),
                    {"model_id": model_row.id}
                ).fetchone()
            else:
                version_row = db_session.execute(
                    text("SELECT id, version_number FROM model_versions WHERE model_id = :model_id AND is_active = true"),
                    {"model_id": model_row.id}
                ).fetchone()
                if not version_row:
                    version_row = db_session.execute(
                        text("SELECT id, version_number FROM model_versions WHERE model_id = :model_id ORDER BY version_number DESC LIMIT 1"),
                        {"model_id": model_row.id}
                    ).fetchone()

            if not version_row:
                ver_str = f" v{version_number}" if version_number else ""
                return {
                    "answer": f"I couldn't find version{ver_str} for model **{model_row.name}** in the repository.",
                    "type": "text"
                }

            artifacts_res = db_session.execute(
                text("SELECT type, COUNT(*) FROM artifacts WHERE version_id = :version_id GROUP BY type"),
                {"version_id": version_row.id}
            ).fetchall()

            available_types = {row[0]: row[1] for row in artifacts_res}

            if not available_types:
                return {
                    "answer": f"There are no artifacts or files uploaded for **{model_row.name}** (v{version_row.version_number}) yet.",
                    "type": "text"
                }

            summary_lines = []
            follow_ups = ["Download All Components"]

            display_map = {
                "dataset": "Dataset",
                "label": "Labels",
                "model": "Model weights",
                "code": "Code"
            }

            for t, count in available_types.items():
                disp = display_map.get(t, t.capitalize())
                unit = "file" if count == 1 else "files"
                if t == "dataset":
                    unit = "image" if count == 1 else "images"
                summary_lines.append(f"- **{disp}**: {count} {unit}")
                follow_ups.append(f"{disp} only")

            summary_str = "\n".join(summary_lines)
            state_dict_str = ",".join(f"'{k}':{v}" for k, v in available_types.items())
            state_comment = f"<!-- DOWNLOAD_PROMPT: model_id={model_row.id}, version_id={version_row.id}, available={{{state_dict_str}}} -->"

            return {
                "answer": (
                    f"I found the following files uploaded for **{model_row.name}** (Version {version_row.version_number}):\n"
                    f"{summary_str}\n\n"
                    f"What components would you like to download? (Select specific or all)\n"
                    f"{state_comment}"
                ),
                "type": "text",
                "follow_ups": follow_ups
            }
    rtype: str = ""
    rname: Optional[str] = None
    q = question.lower()

    # ── 1. Explicit phrase detection (highest priority) ───────────────────────
    #    "download factory report", "report for algorithm", etc.
    #    These are unambiguous — the user explicitly named the report type.
    if re.search(r"\bfactor(?:y|ies)\s+report\b|\breport\s+(?:for|of)\s+(?:the\s+)?factor(?:y|ies)\b", q):
        rtype = "factory"
    elif re.search(r"\b(?:algorithm|algo)\s+report\b|\breport\s+(?:for|of)\s+(?:the\s+)?(?:algorithm|algo)\b", q):
        rtype = "algorithm"
    elif re.search(r"\bmodels?\s+report\b|\breport\s+(?:for|of)\s+(?:the\s+)?models?\b", q):
        rtype = "model"

    # ── 2. Entity-aware routing (fallback when no explicit phrase) ────────────
    #    "download report for YOLOv11" → entity extractor resolves model
    if not rtype and entities:
        # Detect target type keywords in the question
        has_factory_keyword = bool(re.search(r"\bfactor(?:y|ies)\b", q))
        has_algo_keyword = bool(re.search(r"\b(?:algorithm|algo)\b", q))
        has_model_keyword = bool(re.search(r"\bmodels?\b", q))

        # Check explicitly mentioned entity names in the query
        explicit_models = [m for m in entities.get("models", []) if re.search(r'\b' + re.escape(m["name"].lower()) + r'\b', q)]
        explicit_algos = [a for a in entities.get("algorithms", []) if re.search(r'\b' + re.escape(a["name"].lower()) + r'\b', q)]
        explicit_factories = [f for f in entities.get("factories", []) if re.search(r'\b' + re.escape(f["name"].lower()) + r'\b', q)]

        # Phase A: Explicit type keyword AND presence of matching entity
        if has_model_keyword and entities.get("models"):
            rtype = "model"
            rname = explicit_models[0].get("name") if explicit_models else entities["models"][0].get("name")
        elif has_algo_keyword and entities.get("algorithms"):
            rtype = "algorithm"
            rname = explicit_algos[0].get("name") if explicit_algos else entities["algorithms"][0].get("name")
        elif has_factory_keyword and entities.get("factories"):
            rtype = "factory"
            rname = explicit_factories[0].get("name") if explicit_factories else entities["factories"][0].get("name")

        # Phase B: If no type keyword, check for explicitly mentioned entity names
        if not rtype:
            if explicit_models:
                rtype = "model"
                rname = explicit_models[0].get("name")
            elif explicit_algos:
                rtype = "algorithm"
                rname = explicit_algos[0].get("name")
            elif explicit_factories:
                rtype = "factory"
                rname = explicit_factories[0].get("name")

        # Phase C: Last fallback inside step 2 — use first entity of any type, ignoring inference
        if not rtype:
            if entities.get("models"):
                rtype = "model"
                rname = entities["models"][0].get("name")
            elif entities.get("algorithms"):
                rtype = "algorithm"
                rname = entities["algorithms"][0].get("name")
            elif entities.get("factories"):
                rtype = "factory"
                rname = entities["factories"][0].get("name")

    # ── 3. Single-keyword fallback ────────────────────────────────────────────
    if not rtype:
        if re.search(r"\b(?:algorithm|algo)\b", q):
            rtype = "algorithm"
        elif re.search(r"\bfactor(?:y|ies)\b", q):
            rtype = "factory"
        elif re.search(r"\bmodels?\b", q):
            rtype = "model"
        else:
            rtype = "factory"  # last resort

    # ── 4. Extract name from question if not already resolved via entities ────
    if not rname:
        name_match = re.search(
            r'(?:for|of)\s+([A-Za-z0-9][A-Za-z0-9\s\+\-\.]*?)'
            r'(?:\s+report|\s+csv|\s+factory|\s+algorithm|\s+model|$)',
            question, re.IGNORECASE
        )
        if name_match:
            candidate = name_match.group(1).strip()
            _skip = {"the", "a", "an", "all", "factory", "algorithm", "model"}
            if candidate.lower() not in _skip:
                rname = candidate

    label    = {"factory": "Factory", "algorithm": "Algorithm", "model": "Model"}.get(rtype, "Report")
    name_str = f" — {rname}" if rname else ""
    
    algo_id = None
    algo_name = None
    fac_id = None
    fac_name = None
    model_id = None

    if entities:
        # 1. Try to find resolved model and other entities from groups
        for g in entities.get("groups", []):
            if g.get("model"):
                if not rname or g["model"]["name"].lower() == rname.lower():
                    model_id = g["model"]["id"]
                    if g.get("algorithm"):
                        algo_id = g["algorithm"]["id"]
                        algo_name = g["algorithm"]["name"]
                    if g.get("factory"):
                        fac_id = g["factory"]["id"]
                        fac_name = g["factory"]["name"]
                    break

        # 2. Fallbacks if not set
        if not model_id and entities.get("models"):
            if len(entities["models"]) == 1:
                model_id = entities["models"][0]["id"]
            elif rname:
                matching_models = [m for m in entities["models"] if m["name"].lower() == rname.lower()]
                if len(matching_models) == 1:
                    model_id = matching_models[0]["id"]
                elif matching_models:
                    temp_algo_id = entities["algorithms"][0]["id"] if entities.get("algorithms") else None
                    temp_fac_id = entities["factories"][0]["id"] if entities.get("factories") else None
                    
                    filtered_models = matching_models
                    if temp_algo_id:
                        filtered_models = [m for m in filtered_models if m.get("algorithm_id") == temp_algo_id]
                    if temp_fac_id:
                        filtered_models = [m for m in filtered_models if m.get("factory_id") == temp_fac_id]
                    
                    if filtered_models:
                        model_id = filtered_models[0]["id"]

        if not algo_id and entities.get("algorithms"):
            algo_id = entities["algorithms"][0]["id"]
            algo_name = entities["algorithms"][0]["name"]
        if not fac_id and entities.get("factories"):
            fac_id = entities["factories"][0]["id"]
            fac_name = entities["factories"][0]["name"]

    print(f"[Download] report_type={rtype} | report_name={rname} | model_id={model_id} | algorithm_id={algo_id} | factory_id={fac_id}")
    return {
        "answer": (
            f"I've prepared your **{label} Report{name_str}** 📄\n\n"
            "Click the button below to download it as a CSV file."
        ),
        "type": "download",
        "report_type": rtype,
        "report_name": rname,
        "algorithm_id": algo_id,
        "algorithm_name": algo_name,
        "factory_id": fac_id,
        "factory_name": fac_name,
        "model_id": model_id,
        "follow_ups": [
            "Download model report",
            "Download algorithm report",
            "Download factory report",
        ],
    }

# ==============================================================================

# ==============================================================================
# § 16 FOLLOW-UP INTELLIGENCE
# ==============================================================================

def generate_follow_ups(intent: IntentType, comp_type: Optional[ComparisonType], entities: Dict) -> List[str]:
    """Generate smart, context-appropriate follow-ups based on intent and entities."""
    follow_ups = []
    
    if intent == IntentType.METADATA:
        if entities["models"]:
            name = entities["models"][0]["name"]
            follow_ups = [
                f"Compare versions of {name}",
                f"Show deployment details for {name}",
                "Show factory information"
            ]
        elif entities["factories"]:
            name = entities["factories"][0]["name"]
            follow_ups = [
                f"Compare models in {name} factory",
                f"Show deployment details in {name}",
                "List all factories"
            ]
        else:
            follow_ups = ["List all models", "List all factories", "Top 5 models by accuracy"]
            
    elif intent == IntentType.COMPARISON:
        follow_ups = [
            "Which one is deployed?",
            "Show performance trend",
            "Compare with top model"
        ]
        
    elif intent == IntentType.ANALYTICS:
        follow_ups = [
            "Show top factories",
            "Show top algorithms",
            "Show version history"
        ]
        
    elif intent in (IntentType.VERSION_HISTORY, IntentType.VERSION_LINEAGE):
        if entities["models"]:
            name = entities["models"][0]["name"]
            follow_ups = [
                f"Tell me about {name}",
                f"Compare all versions of {name}",
                "Show active version deployment"
            ]
        else:
            follow_ups = ["List all models", "List all factories"]
            
    elif intent == IntentType.KNOWLEDGE:
        follow_ups = [
            "What is accuracy?",
            "What is precision?",
            "Explain recall.",
            "What is F1 score?",
            "What is overfitting?",
            "Explain confusion matrix."
        ]
            
    else:
        follow_ups = ["List all models", "List all factories", "Top 5 models by accuracy"]
        
    return follow_ups

# ==============================================================================
# § 16.5 VERSION LINEAGE & EVOLUTION SERVICE
# ==============================================================================

def calculate_delta(curr: Optional[float], prev: Optional[float], metric_type: str) -> str:
    if curr is None or prev is None:
        return "—"
    try:
        c = float(curr)
        p = float(prev)
        diff = c - p
        if metric_type in ("accuracy", "precision", "recall"):
            if max(abs(c), abs(p)) <= 1.0 and (c > 0 or p > 0):
                diff = diff * 100.0
            return f"+{diff:.1f}%" if diff >= 0 else f"{diff:.1f}%"
        elif metric_type == "f1_score":
            if max(abs(c), abs(p)) <= 1.0 and (c > 0 or p > 0):
                return f"+{diff:.3f}" if diff >= 0 else f"{diff:.3f}"
            else:
                return f"+{diff:.1f}" if diff >= 0 else f"{diff:.1f}"
        elif metric_type == "inference_time":
            return f"+{diff:.1f} ms" if diff >= 0 else f"{diff:.1f} ms"
    except Exception:
        pass
    return "—"

def format_cell_with_delta(val: Any, delta: str, is_pct: bool = False, is_lat: bool = False) -> str:
    fmt_val = _fmt(val, is_pct)
    if fmt_val == "Not Available" or val is None:
        return "**Not Available**"
    
    suffix = ""
    if is_lat and "ms" not in fmt_val:
        suffix = " ms"
        
    if delta == "—":
        return f"**{fmt_val}{suffix}**"
    return f"**{fmt_val}{suffix}** ({delta})"

class VersionLineageIntent:
    @staticmethod
    def process(question: str, entities: Dict[str, Any], db: Session) -> Dict[str, Any]:
        model = None
        if entities.get("models"):
            model = entities["models"][0]
        else:
            res = db.execute(text("SELECT id, name FROM models ORDER BY id LIMIT 1")).fetchone()
            if res:
                model = {"id": res[0], "name": res[1]}
        
        if not model:
            return {"answer": "⚠️ No models found in the database.", "type": "text"}

        q_lower = question.lower()
        v_nums = sorted(entities.get("version_numbers") or [])
        
        if len(v_nums) >= 2:
            return VersionLineageIntent.handle_comparison(model, v_nums[0], v_nums[1], db)
        
        if "improved" in q_lower and "accuracy" in q_lower and "most" in q_lower:
            return VersionLineageIntent.handle_max_improvement(model, db)
            
        return VersionLineageIntent.handle_evolution(model, db)

    @staticmethod
    def handle_comparison(model: Dict[str, Any], v1: int, v2: int, db: Session) -> Dict[str, Any]:
        rows, _ = _execute_sql("""
            SELECT mv.id, mv.version_number, mv.note, mv.is_active,
                   mv.accuracy, mv.precision, mv.recall, mv.f1_score,
                   mv.inference_time, mv.cpu_utilization, mv.gpu_utilization
            FROM model_versions mv
            WHERE mv.model_id = :mid AND mv.version_number IN (:v1, :v2)
            ORDER BY mv.version_number ASC;
        """, db, {"mid": model["id"], "v1": v1, "v2": v2})
        
        if len(rows) < 2:
            return {"answer": f"⚠️ Could not find both version v{v1} and version v{v2} for model **{model['name']}** to compare.", "type": "text"}
            
        r1 = rows[0]
        r2 = rows[1]
        
        acc_delta = calculate_delta(r2.get("accuracy"), r1.get("accuracy"), "accuracy")
        prec_delta = calculate_delta(r2.get("precision"), r1.get("precision"), "precision")
        rec_delta = calculate_delta(r2.get("recall"), r1.get("recall"), "recall")
        f1_delta = calculate_delta(r2.get("f1_score"), r1.get("f1_score"), "f1_score")
        lat_delta = calculate_delta(r2.get("inference_time"), r1.get("inference_time"), "inference_time")
        
        lines = [
            f"## ⚖️ Side-by-Side Comparison: **{model['name']}** (v{r1['version_number']} vs v{r2['version_number']})",
            f"Comparing performance changes from **v{r1['version_number']}** to **v{r2['version_number']}**:",
            "",
            "| Metric | v" + str(r1['version_number']) + " | v" + str(r2['version_number']) + " | Delta |",
            "|---|---|---|---|",
            f"| Accuracy | {_fmt(r1.get('accuracy'), True)} | {_fmt(r2.get('accuracy'), True)} | {acc_delta} |",
            f"| Precision | {_fmt(r1.get('precision'), True)} | {_fmt(r2.get('precision'), True)} | {prec_delta} |",
            f"| Recall | {_fmt(r1.get('recall'), True)} | {_fmt(r2.get('recall'), True)} | {rec_delta} |",
            f"| F1 Score | {_fmt(r1.get('f1_score'))} | {_fmt(r2.get('f1_score'))} | {f1_delta} |",
            f"| Latency | {_fmt(r1.get('inference_time'))} ms | {_fmt(r2.get('inference_time'))} ms | {lat_delta} |",
            "",
            "### 📝 Key Changes Breakdown",
            f"- **Accuracy Delta**: {acc_delta} ({_fmt(r1.get('accuracy'), True)} vs {_fmt(r2.get('accuracy'), True)})",
            f"- **Precision Delta**: {prec_delta} ({_fmt(r1.get('precision'), True)} vs {_fmt(r2.get('precision'), True)})",
            f"- **Recall Delta**: {rec_delta} ({_fmt(r1.get('recall'), True)} vs {_fmt(r2.get('recall'), True)})",
            f"- **F1 Delta**: {f1_delta} ({_fmt(r1.get('f1_score'))} vs {_fmt(r2.get('f1_score'))})",
            f"- **Latency Delta**: {lat_delta} ({_fmt(r1.get('inference_time'))} ms vs {_fmt(r2.get('inference_time'))} ms)",
        ]
        
        return {
            "answer": "\n".join(lines),
            "type": "comparison",
            "data": rows,
            "entity_type": "versions"
        }

    @staticmethod
    def handle_max_improvement(model: Dict[str, Any], db: Session) -> Dict[str, Any]:
        rows, _ = _execute_sql("""
            SELECT mv.id, mv.version_number, mv.accuracy, mv.is_active, mv.note
            FROM model_versions mv
            WHERE mv.model_id = :mid
            ORDER BY mv.version_number ASC;
        """, db, {"mid": model["id"]})
        
        if len(rows) < 2:
            return {"answer": f"⚠️ Model **{model['name']}** does not have enough registered versions to compute metric improvements.", "type": "text"}
            
        best_prev = None
        best_curr = None
        max_diff = -999.0
        
        for idx in range(1, len(rows)):
            prev = rows[idx - 1]
            curr = rows[idx]
            if prev.get("accuracy") is not None and curr.get("accuracy") is not None:
                p_val = float(prev["accuracy"])
                c_val = float(curr["accuracy"])
                diff = c_val - p_val
                if diff > max_diff:
                    max_diff = diff
                    best_prev = prev
                    best_curr = curr
                    
        if max_diff == -999.0 or best_curr is None:
            return {"answer": f"⚠️ Could not compute accuracy changes for model **{model['name']}** due to missing metric values.", "type": "text"}
            
        p_val = float(best_prev["accuracy"])
        c_val = float(best_curr["accuracy"])
        is_ratio = max(abs(p_val), abs(c_val)) <= 1.0 and (p_val > 0 or c_val > 0)
        
        disp_diff = max_diff
        if is_ratio:
            disp_diff = disp_diff * 100.0
            
        diff_str = f"+{disp_diff:.1f}%" if disp_diff >= 0 else f"{disp_diff:.1f}%"
        
        lines = [
            f"## 🏆 Accuracy Improvement Analysis: **{model['name']}**",
            f"The version of **{model['name']}** that improved accuracy the most is **v{best_curr['version_number']}**.",
            "",
            f"- **Improvement**: **{diff_str}** accuracy increase",
            f"- **Previous Version (v{best_prev['version_number']})**: Accuracy was **{_fmt(best_prev.get('accuracy'), True)}**",
            f"- **Improved Version (v{best_curr['version_number']})**: Accuracy is **{_fmt(best_curr.get('accuracy'), True)}**",
            f"- **Deployment Status**: " + ("✅ Deployed / Active" if best_curr.get("is_active") else "Inactive"),
            f"- **Note**: _{best_curr.get('note') or 'None'}_"
        ]
        
        return {
            "answer": "\n".join(lines),
            "type": "text",
            "data": [best_prev, best_curr],
            "entity_type": "versions"
        }

    @staticmethod
    def handle_evolution(model: Dict[str, Any], db: Session) -> Dict[str, Any]:
        rows, _ = _execute_sql("""
            SELECT mv.id, mv.version_number, mv.note, mv.is_active,
                   mv.accuracy, mv.precision, mv.recall, mv.f1_score,
                   mv.inference_time, mv.cpu_utilization, mv.gpu_utilization
            FROM model_versions mv
            WHERE mv.model_id = :mid
            ORDER BY mv.version_number ASC;
        """, db, {"mid": model["id"]})
        
        if not rows:
            return {"answer": f"⚠️ No versions found for model **{model['name']}**.", "type": "text"}

        best_idx = -1
        worst_idx = -1
        max_acc = -1.0
        min_acc = 999.0
        
        for idx, r in enumerate(rows):
            acc = r.get("accuracy")
            if acc is not None:
                acc_val = float(acc)
                if acc_val > max_acc:
                    max_acc = acc_val
                    best_idx = idx
                if acc_val < min_acc:
                    min_acc = acc_val
                    worst_idx = idx

        lines = [
            "## 🤖 Model Details",
            f"- **Model Name**: **{model['name']}**",
            f"- **Total Versions Registered**: {len(rows)}",
            "",
            "## 📊 Performance Metrics",
            f"### Model Progression & Evolution: **{model['name']}**",
            f"Here is the progression history across all registered versions of **{model['name']}**:",
            "",
            "| Version | Accuracy | Precision | Recall | F1 Score | Latency | Status | Note |",
            "|---|---|---|---|---|---|---|---|",
        ]

        for idx, r in enumerate(rows):
            vnum = r.get("version_number")
            v_lbl = f"v{vnum}"
            if len(rows) > 1:
                if idx == best_idx:
                    v_lbl += " (🏆 Best)"
                elif idx == worst_idx:
                    v_lbl += " (⚠️ Worst)"
            
            if idx == 0:
                acc_delta = prec_delta = rec_delta = f1_delta = lat_delta = "—"
            else:
                prev_r = rows[idx - 1]
                acc_delta = calculate_delta(r.get("accuracy"), prev_r.get("accuracy"), "accuracy")
                prec_delta = calculate_delta(r.get("precision"), prev_r.get("precision"), "precision")
                rec_delta = calculate_delta(r.get("recall"), prev_r.get("recall"), "recall")
                f1_delta = calculate_delta(r.get("f1_score"), prev_r.get("f1_score"), "f1_score")
                lat_delta = calculate_delta(r.get("inference_time"), prev_r.get("inference_time"), "inference_time")
            
            acc_str = format_cell_with_delta(r.get("accuracy"), acc_delta, is_pct=True)
            prec_str = format_cell_with_delta(r.get("precision"), prec_delta, is_pct=True)
            rec_str = format_cell_with_delta(r.get("recall"), rec_delta, is_pct=True)
            f1_str = format_cell_with_delta(r.get("f1_score"), f1_delta, is_pct=False)
            lat_str = format_cell_with_delta(r.get("inference_time"), lat_delta, is_pct=False, is_lat=True)
            
            status = "✅ Deployed" if r.get("is_active") else "Inactive"
            note = r.get("note") or "—"
            
            lines.append(f"| {v_lbl} | {acc_str} | {prec_str} | {rec_str} | {f1_str} | {lat_str} | {status} | {note} |")

        lines.append("")
        lines.append("## 🚀 Deployment Information")
        active_v = next((r for r in rows if r.get("is_active")), None)
        if active_v:
            lines.append(f"- **Current Active Version**: **v{active_v.get('version_number')}** (Deployed)")
        else:
            lines.append("- **Current Active Version**: ⚠️ No active version is deployed.")
            
        lines.append("")
        lines.append("## 💡 Key Insights & Version Highlights")
        
        if len(rows) > 1:
            if best_idx >= 0:
                best_ver = rows[best_idx]
                lines.append(f"- **🥇 Best Performing Version**: **v{best_ver['version_number']}** with accuracy of **{_fmt(best_ver.get('accuracy'), True)}**.")
            if worst_idx >= 0:
                worst_ver = rows[worst_idx]
                lines.append(f"- **⚠️ Worst Performing Version**: **v{worst_ver['version_number']}** with accuracy of **{_fmt(worst_ver.get('accuracy'), True)}**.")
            
            first_ver = rows[0]
            last_ver = rows[-1]
            if first_ver.get("accuracy") is not None and last_ver.get("accuracy") is not None:
                net_diff = float(last_ver["accuracy"]) - float(first_ver["accuracy"])
                net_sign = "+" if net_diff >= 0 else ""
                lines.append(f"- **📈 Net Accuracy Change**: {net_sign}{net_diff:.1f}% across all versions (from {_fmt(first_ver.get('accuracy'), True)} in v{first_ver['version_number']} → {_fmt(last_ver.get('accuracy'), True)} in v{last_ver['version_number']}).")
        else:
            lines.append("- Performance remains stable across the registered lifecycle.")

        return {
            "answer": "\n".join(lines),
            "type": "comparison",
            "data": rows,
            "entity_type": "versions"
        }

# ==============================================================================
# § 17 TEMPLATE DISPATCHER DELEGATION
# ==============================================================================

def dispatch_task(
    task: QueryTask,
    entities: Dict,
    question: str,
    db: Session,
    context: List[Dict] = []
) -> Optional[Dict[str, Any]]:
    from app.services.query_dispatcher import dispatch_task as _dispatch_task
    return _dispatch_task(task, entities, question, db, context)

# ==============================================================================
# § 18 MAIN HARDENED AGENT PIPELINE DELEGATION
# ==============================================================================

def run_sql_agent(
    user_question: str,
    db_session: Session,
    context: List[Dict] = [],
) -> Dict[str, Any]:
    from app.services.query_dispatcher import run_sql_agent as _run_sql_agent
    return _run_sql_agent(user_question, db_session, context)
