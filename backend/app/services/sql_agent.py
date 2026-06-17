"""
MARS AI Agent — sql_agent.py
Database-grounded chatbot agent with context memory, entity extraction, and DB execution helpers.
"""
import os
import re
import json
import time
from typing import Any, Dict, List, Optional, Tuple
from difflib import SequenceMatcher
from sqlalchemy.orm import Session
from sqlalchemy import text
from dotenv import load_dotenv
from app.services.llm_service import call_llm

load_dotenv()

# ==============================================================================
# § 1  CONSTANTS
# ==============================================================================

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

_PRONOUN_PATTERNS = [
    r"\bit\b", r"\bthat model\b", r"\bwhich one\b", r"\bthat one\b",
    r"\bthe model\b", r"\bthe factory\b", r"\bthe algorithm\b",
    r"\bthose\b", r"\bthem\b", r"\bthey\b", r"\bthe same\b", r"\bthis model\b",
]

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
# § 3  CONTEXT MEMORY SYSTEM
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
# § 4  ENTITY EXTRACTION & SCORING
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

            # 1. Exact Match Check
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
                # 2. Alias Match Check
                for alias_name, info in aliases.items():
                    if info["canonical"].lower() == name_lower and info["type"] == entity_type:
                        if re.search(r'\b' + re.escape(alias_name) + r'\b', query_lower):
                            score = 0.95
                            match_type = "alias"
                            break

            # 3. Fuzzy Match Check
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

        # Group competitors and filter out lower-scoring ones
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
        tokens = []
        q = question.lower()

        # Helper to find all occurrences of a substring
        def find_occurrences(name: str, etype: str, data: Dict):
            name_lower = name.lower()
            escaped = re.escape(name_lower)
            start_b = r"(?<!\w)" if name_lower[0].isalnum() else ""
            end_b   = r"(?!\w)"  if name_lower[-1].isalnum() else ""
            for m in re.finditer(start_b + escaped + end_b, q):
                tokens.append({
                    "start": m.start(),
                    "end": m.end(),
                    "type": etype,
                    "name": name,
                    "data": data
                })

        for f in factories:
            find_occurrences(f["name"], "factory", f)
        for a in algorithms:
            find_occurrences(a["name"], "algorithm", a)
        for m in models:
            find_occurrences(m["name"], "model", m)

        # Parse numeric version references
        v_matches = re.finditer(r'\bv(?:ersion\s*)?(\d+)\b|\bversion\s+(\d+)\b', q, re.IGNORECASE)
        for vm in v_matches:
            val = int(vm.group(1) or vm.group(2))
            tokens.append({
                "start": vm.start(),
                "end": vm.end(),
                "type": "version",
                "val": val
            })

        tokens.sort(key=lambda t: t["start"])

        # Group tokens by proximity
        groups = []
        curr_group = {}
        last_end = -1
        
        for t in tokens:
            # Multi-word models/factories can overlap. Handle overlaps
            if t["start"] < last_end:
                continue
            
            # Start new group if token is far from previous
            if last_end != -1 and (t["start"] - last_end) > 35:
                if curr_group:
                    groups.append(curr_group)
                    curr_group = {}
            
            # Put token into current group
            if t["type"] == "factory":
                curr_group["factory"] = t["data"]
            elif t["type"] == "algorithm":
                curr_group["algorithm"] = t["data"]
            elif t["type"] == "version":
                curr_group["version"] = t["val"]
            elif t["type"] == "model":
                if "model_candidates" not in curr_group:
                    curr_group["model_candidates"] = []
                curr_group["model_candidates"].append(t["data"])
                
            last_end = t["end"]
            
        if curr_group:
            groups.append(curr_group)

        # Post-process groups to resolve model candidates and propagate singletons
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

        # Resolve exact model candidate in each group based on group's factory/algorithm
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

    def extract(self, question: str) -> Dict[str, Any]:
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

        # Detect ordinal version reference
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
        _ordinal_ctx_re = re.compile(
            r'\b(' + '|'.join(re.escape(k) for k in _ORDINAL_MAP) + r')\b'
            r'(?:\s+(?:version|release|model|v))?',
            re.IGNORECASE
        )
        _ord_match = _ordinal_ctx_re.search(q)
        if _ord_match and not version_numbers:
            version_ordinal = _ORDINAL_MAP[_ord_match.group(1).lower()]

        # Detect metric mentioned
        metric = None
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

# End of sql_agent.py (legacy resolvers and execution helpers removed)
