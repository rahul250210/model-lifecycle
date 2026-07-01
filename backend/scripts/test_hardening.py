import os
import sys
import time
import unittest
import unittest.mock
from pathlib import Path

# Load env variables manually from .env
env_path = Path("c:/Users/Rahul/Desktop/model_lifecycle/backend/.env")
if env_path.exists():
    with open(env_path, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                key, val = line.split("=", 1)
                os.environ[key.strip()] = val.strip().strip('"').strip("'")

sys.path.append("c:/Users/Rahul/Desktop/model_lifecycle/backend")

from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from app.services.query_dispatcher import run_sql_agent

DATABASE_URL = os.getenv("DATABASE_URL")
engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

class TestMIRA(unittest.TestCase):
    def setUp(self):
        self.db = SessionLocal()

    def tearDown(self):
        self.db.close()

    def test_sql_injection_rejection(self):
        """Test 1: SQL Injection inputs must be rejected or bound safely."""
        # Query with SQL injection payload
        malicious_input = "R2+1D'; DROP TABLE aliases; --"
        res = run_sql_agent(malicious_input, self.db)
        
        # Verify the agent didn't run raw injection and fail destructive checks
        self.assertNotEqual(res.get("type"), "error")
        # Ensure the destructive operation was blocked or safely treated as string parameter
        with engine.connect() as conn:
            # Check table still exists
            res_table = conn.execute(
                text("SELECT count(*) FROM information_schema.tables WHERE table_name = 'aliases'")
            ).fetchone()
            self.assertEqual(res_table[0], 1)

    def test_deterministic_fact_verification(self):
        """Test 2: Verify missing metrics are reported as 'Not Available' deterministically."""
        res = run_sql_agent("Tell me about model yolov11", self.db)
        answer = res.get("answer", "")
        # yolov11 has None for inference_time, cpu_utilization, gpu_utilization
        self.assertIn("Not Available ms", answer)
        self.assertIn("Not Available%", answer)
        # Ensure there are no hallucinations of numeric metrics
        self.assertNotIn("95 ms", answer)

    # Caching is disabled in the new LLM-driven architecture, so latency performance caching tests are not applicable.

    def test_context_pronoun_resolution(self):
        """Test 4: Verify pronoun references are resolved correctly using context memory."""
        context = [
            {"role": "user", "content": "Compare model R2+1D and yolov11"},
            {"role": "bot", "content": "Here is a comparison of R2+1D and yolov11..."}
        ]
        res = run_sql_agent("Which one is deployed?", self.db, context=context)
        
        # Verify that it resolved to yolov11 (the deployed model)
        self.assertEqual(res.get("type"), "text")
        self.assertIn("yolov11", res.get("answer", ""))
        self.assertIn("person cart", res.get("answer", ""))

    def test_template_miss_unsupported(self):
        """Test 5: Verify template misses return the unsupported response format."""
        unsupported_query = "Give me a summary of everything"
        res = run_sql_agent(unsupported_query, self.db)
        
        self.assertEqual(res.get("type"), "unsupported")
        self.assertEqual(
            res.get("answer"),
            "This query is not currently supported."
        )

    def test_cross_factory_relationship(self):
        """Test 6: Verify cross-factory comparison resolves to correct distinct model IDs."""
        res = run_sql_agent("Compare YOLOv11 in beijing and YOLOv11 in Bhushan", self.db)
        self.assertEqual(res.get("type"), "comparison")
        self.assertEqual(res.get("entity_type"), "models")
        
        mids = {row["model_id"] for row in res.get("data", [])}
        self.assertIn(18, mids)  # yolov11 in beijing
        self.assertIn(20, mids)  # YOLOv11 in Bhushan
        
        answer = res.get("answer", "")
        self.assertIn("beijing", answer)
        self.assertIn("Bhushan", answer)

    def test_cross_factory_relationship_implicit(self):
        """Test 6b: Verify cross-factory comparison without explicit model name resolves correctly."""
        res = run_sql_agent("compare the Bhushan model with suwon model in FAS", self.db)
        self.assertEqual(res.get("type"), "comparison")
        self.assertEqual(res.get("entity_type"), "versions")
        
        mids = {row["model_id"] for row in res.get("data", [])}
        self.assertIn(23, mids)  # Resnet in Bhushan
        self.assertIn(16, mids)  # yolo in Suwon
        
        answer = res.get("answer", "")
        self.assertIn("Bhushan", answer)
        self.assertIn("Suwon", answer)

    def test_cross_version_relationship(self):
        """Test 7: Verify cross-version comparison inherits model ID for both versions."""
        self.db.execute(text("""
            INSERT INTO model_versions (model_id, version_number, accuracy, precision, recall, f1_score, inference_time, cpu_utilization, gpu_utilization, is_active, created_at, updated_at)
            VALUES (20, 2, 0.82, 0.91, 0.97, 0.93, 19.0, 85.0, 95.0, false, NOW(), NOW())
        """))
        self.db.commit()
        
        try:
            res = run_sql_agent("Compare YOLOv11 version 1 and version 2", self.db)
            self.assertEqual(res.get("type"), "comparison")
            self.assertEqual(res.get("entity_type"), "versions")
            
            rows = res.get("data", [])
            self.assertEqual(len(rows), 2)
            
            versions = {r["version_number"] for r in rows}
            self.assertIn(1, versions)
            self.assertIn(2, versions)
            
            for r in rows:
                self.assertEqual(r["model_id"], 20)
                
        finally:
            self.db.execute(text("DELETE FROM model_versions WHERE model_id = 20 AND version_number = 2"))
            self.db.commit()

    def test_multi_model_relationship_propagation(self):
        """Test 8: Verify algorithm and model relationship propagation across factories."""
        self.db.execute(text("""
            INSERT INTO algorithms (id, name, description, created_at)
            VALUES (999, 'Random Forest', 'Temporary algorithm for testing', NOW())
        """))
        self.db.execute(text("""
            INSERT INTO models (id, name, description, algorithm_id, factory_id, created_at)
            VALUES (998, 'RF_Sejong', 'RF model in Sejong', 999, 11, NOW())
        """))
        self.db.execute(text("""
            INSERT INTO models (id, name, description, algorithm_id, factory_id, created_at)
            VALUES (997, 'RF_Suwon', 'RF model in Suwon', 999, 12, NOW())
        """))
        self.db.execute(text("""
            INSERT INTO model_versions (model_id, version_number, accuracy, precision, recall, f1_score, inference_time, cpu_utilization, gpu_utilization, is_active, created_at, updated_at)
            VALUES (998, 1, 0.85, 0.88, 0.84, 0.86, 15.0, 70.0, 80.0, true, NOW(), NOW())
        """))
        self.db.execute(text("""
            INSERT INTO model_versions (model_id, version_number, accuracy, precision, recall, f1_score, inference_time, cpu_utilization, gpu_utilization, is_active, created_at, updated_at)
            VALUES (997, 1, 0.82, 0.84, 0.81, 0.82, 18.0, 72.0, 82.0, true, NOW(), NOW())
        """))
        self.db.commit()
        
        try:
            res = run_sql_agent("Compare RF models from Sejong and Suwon", self.db)
            self.assertEqual(res.get("type"), "comparison")
            self.assertEqual(res.get("entity_type"), "models")
            
            rows = res.get("data", [])
            self.assertEqual(len(rows), 2)
            
            mids = {r["model_id"] for r in rows}
            self.assertIn(998, mids)
            self.assertIn(997, mids)
            
        finally:
            self.db.execute(text("DELETE FROM model_versions WHERE model_id IN (998, 997)"))
            self.db.execute(text("DELETE FROM models WHERE id IN (998, 997)"))
            self.db.execute(text("DELETE FROM algorithms WHERE id = 999"))
            self.db.commit()

    def test_all_versions_comparison_routing(self):
        """Test 9: Verify all five version-comparison queries successfully route and return version histories."""
        # Seed temporary XGBoost algorithm, model, and version
        self.db.execute(text("""
            INSERT INTO algorithms (id, name, description, created_at)
            VALUES (996, 'XGBoost', 'Temporary algorithm for testing', NOW())
        """))
        self.db.execute(text("""
            INSERT INTO models (id, name, description, algorithm_id, factory_id, created_at)
            VALUES (995, 'xgboost_model', 'XGBoost model', 996, 11, NOW())
        """))
        self.db.execute(text("""
            INSERT INTO model_versions (model_id, version_number, accuracy, precision, recall, f1_score, inference_time, cpu_utilization, gpu_utilization, is_active, created_at, updated_at)
            VALUES (995, 1, 0.85, 0.89, 0.92, 0.88, 12.0, 65.0, 75.0, true, NOW(), NOW())
        """))
        self.db.commit()
        
        try:
            queries = [
                "compare versions of r2+1d",
                "compare all versions of yolov11",
                "compare every version of cnn",
                "version comparison for xgboost model",
                "show evolution of yolov11"
            ]
            
            for q in queries:
                print(f"\n[Test All Versions] Running query: {q}")
                res = run_sql_agent(q, self.db)
                
                # Check for correct return structure
                self.assertIsNotNone(res)
                self.assertNotEqual(res.get("type"), "unsupported", f"Query '{q}' fell through to unsupported query!")
                self.assertNotEqual(res.get("type"), "error", f"Query '{q}' returned error!")
                
                answer = res.get("answer", "")
                self.assertIn("Model Details", answer)
                self.assertIn("Performance Metrics", answer)
                self.assertIn("v1", answer)
                self.assertIn("Deployment Information", answer)
                self.assertIn("Key Insights", answer)
                
        finally:
            # Clean up XGBoost temporary entities
            self.db.execute(text("DELETE FROM model_versions WHERE model_id = 995"))
            self.db.execute(text("DELETE FROM models WHERE id = 995"))
            self.db.execute(text("DELETE FROM algorithms WHERE id = 996"))
            self.db.commit()

    # The rule-based query planner (planner_llm) is replaced by the new semantic routing architecture (query_router.py).

    def test_hybrid_query_execution(self):
        """Test 11: Verify that Hybrid Query Execution successfully merges database and knowledge responses."""
        q = "Which model has highest precision and explain precision?"
        res = run_sql_agent(q, self.db)
        
        # Verify the structure is correct
        self.assertIsNotNone(res)
        self.assertEqual(res.get("type"), "sql")
        
        answer = res.get("answer", "")
        self.assertTrue(any(w in answer.lower() for w in ["yolov11", "r2+1d"]))
        self.assertIn("Concept Explanation", answer)
        self.assertIn("measures how many of the model's positive predictions were actually correct", answer.lower())
        self.assertIn("tp / (tp + fp)", answer.lower())



    def test_download_report_routing(self):
        """Test 14: Verify download reports for algorithms and factories resolve to correct report types and names."""
        # Query 1: FAS algorithm report
        res1 = run_sql_agent("download the report of FAS(Algorithm name)", self.db)
        self.assertEqual(res1.get("type"), "download")
        self.assertEqual(res1.get("report_type"), "algorithm")
        self.assertEqual(res1.get("report_name"), "FAS")
        
        # Query 2: Suwon factory report
        res2 = run_sql_agent("download the report of Suwon factory", self.db)
        self.assertEqual(res2.get("type"), "download")
        self.assertEqual(res2.get("report_type"), "factory")
        self.assertEqual(res2.get("report_name"), "Suwon")

    def test_download_report_contents(self):
        """Test 15: Verify chatbot download report CSV format matches expected page-level formats."""
        from fastapi.testclient import TestClient
        from app.main import app
        import csv
        import io

        client = TestClient(app)

        # 1. Factory Report
        response = client.get("/chatbot/download-report?report_type=factory&name=Suwon")
        self.assertEqual(response.status_code, 200)
        self.assertIn("Content-Disposition", response.headers)
        self.assertIn("attachment", response.headers["Content-Disposition"])
        self.assertIn("factory", response.headers["Content-Disposition"])

        content = response.content.decode("utf-8-sig")  # Decode with BOM removal
        reader = csv.reader(io.StringIO(content))
        rows = list(reader)
        self.assertTrue(len(rows) > 0)
        # Verify headers match factories.py:generate_factory_report
        expected_factory_headers = [
            "Model Name",
            "Algorithm Name",
            "Version",
            "Status",
            "Created At",
            "Description",
            "Dataset Count",
            "Accuracy",
            "Precision",
            "Recall",
            "F1 Score",
            "CPU Utilization (%)",
            "GPU Utilization (%)",
            "Inference Time (ms)",
            "Hyperparameters",
        ]
        self.assertEqual(rows[0], expected_factory_headers)

        # 2. Model Report
        response = client.get("/chatbot/download-report?report_type=model&name=yolov11")
        self.assertEqual(response.status_code, 200)
        content = response.content.decode("utf-8-sig")
        reader = csv.reader(io.StringIO(content))
        rows = list(reader)
        self.assertTrue(len(rows) > 0)
        expected_model_headers = [
            "Version Number",
            "Created At",
            "Description",
            "Dataset Total Count",
            "Accuracy",
            "Precision",
            "Recall",
            "F1 Score",
            "CPU Utilization (%)",
            "GPU Utilization (%)",
            "Inference Time (ms)",
            "Hyperparameters"
        ]
        self.assertEqual(rows[0], expected_model_headers)

        # 3. Algorithm Report
        response = client.get("/chatbot/download-report?report_type=algorithm&name=FAS")
        self.assertEqual(response.status_code, 200)
        content = response.content.decode("utf-8-sig")
        reader = csv.reader(io.StringIO(content))
        rows = list(reader)
        self.assertTrue(len(rows) > 0)
        expected_algo_headers = [
            "Factory Name",
            "Model Name",
            "Version Number",
            "Created At",
            "Description",
            "Dataset Total Count",
            "Accuracy",
            "Precision",
            "Recall",
            "F1 Score",
            "CPU Utilization (%)",
            "GPU Utilization (%)",
            "Inference Time (ms)",
            "Hyperparameters"
        ]
        self.assertEqual(rows[0], expected_algo_headers)
    def test_download_report_no_filtering_for_factory_and_algorithm(self):
        """Test 15b: Verify that downloading factory or algorithm reports ignores model/algorithm/factory filters."""
        from fastapi.testclient import TestClient
        from app.main import app
        import csv
        import io

        client = TestClient(app)

        # Query factory report without filters
        resp_nofilter = client.get("/chatbot/download-report?report_type=factory&name=Suwon")
        self.assertEqual(resp_nofilter.status_code, 200)
        content_nofilter = resp_nofilter.content.decode("utf-8-sig")
        rows_nofilter = list(csv.reader(io.StringIO(content_nofilter)))

        # Query factory report with model_id=9999 filter (which doesn't exist)
        resp_filter = client.get("/chatbot/download-report?report_type=factory&name=Suwon&model_id=9999&algorithm_id=9999")
        self.assertEqual(resp_filter.status_code, 200)
        content_filter = resp_filter.content.decode("utf-8-sig")
        rows_filter = list(csv.reader(io.StringIO(content_filter)))

        # They should return the exact same content, since model_id and algorithm_id filters must be ignored for factory reports
        self.assertEqual(len(rows_nofilter), len(rows_filter))
        self.assertEqual(rows_nofilter, rows_filter)

        # Query algorithm report without filters
        resp_algo_nofilter = client.get("/chatbot/download-report?report_type=algorithm&name=FAS")
        self.assertEqual(resp_algo_nofilter.status_code, 200)
        content_algo_nofilter = resp_algo_nofilter.content.decode("utf-8-sig")
        rows_algo_nofilter = list(csv.reader(io.StringIO(content_algo_nofilter)))

        # Query algorithm report with factory_id=9999 and model_id=9999 filters
        resp_algo_filter = client.get("/chatbot/download-report?report_type=algorithm&name=FAS&factory_id=9999&model_id=9999")
        self.assertEqual(resp_algo_filter.status_code, 200)
        content_algo_filter = resp_algo_filter.content.decode("utf-8-sig")
        rows_algo_filter = list(csv.reader(io.StringIO(content_algo_filter)))

        # They should return the exact same content, since factory_id and model_id filters must be ignored for algorithm reports
        self.assertEqual(len(rows_algo_nofilter), len(rows_algo_filter))
        self.assertEqual(rows_algo_nofilter, rows_algo_filter)

    def test_models_in_algorithm_comparison(self):
        """Test 16: Verify that comparing models of an algorithm resolves to ComparisonType.MODELS_IN_ALGORITHM and returns type: comparison with version_number."""
        res = run_sql_agent("compare all the models of FAS", self.db)
        self.assertEqual(res.get("type"), "comparison")
        self.assertEqual(res.get("entity_type"), "versions")
        
        # Verify that version_number is selected and present in rows
        rows = res.get("data", [])
        self.assertTrue(len(rows) > 0)
        for r in rows:
            self.assertIn("version_number", r)
            self.assertIsNotNone(r["version_number"])

    def test_aggregate_comparison_types(self):
        """Test 17: Verify that aggregate comparisons (like factory vs algorithm) return type: sql to prevent rendering errors."""
        # Query: Compare factory Suwon and algorithm FAS
        res = run_sql_agent("Compare factory Suwon and algorithm FAS", self.db)
        self.assertEqual(res.get("type"), "sql")

    def test_models_in_algorithm_count_verification(self):
        """Test 18: Verify that number of models found in algorithm is not sanitized as Not Available."""
        res = run_sql_agent("compare all the models of FAS", self.db)
        answer = res.get("answer", "")
        self.assertNotIn("Not Available model(s)", answer)
        self.assertIn("model(s)", answer)

    def test_evolution_yolov11(self):
        """Test 19: Verify evolution table and best/worst highlights for YOLOv11."""
        res = run_sql_agent("Show evolution of YOLOv11", self.db)
        self.assertEqual(res.get("type"), "comparison")
        self.assertEqual(res.get("entity_type"), "versions")
        answer = res.get("answer", "")
        self.assertIn("Model Progression & Evolution", answer)
        self.assertIn("yolov11", answer.lower())
        self.assertIn("Accuracy", answer)
        self.assertIn("Precision", answer)
        self.assertIn("Recall", answer)
        self.assertIn("F1 Score", answer)
        self.assertIn("Latency", answer)
        self.assertIn("v1", answer)

    def test_version_delta_v4_v5(self):
        """Test 20: Verify side-by-side comparison between v4 and v5 of R2+1D."""
        res = run_sql_agent("What changed between v4 and v5 of R2+1D?", self.db)
        self.assertEqual(res.get("type"), "comparison")
        self.assertEqual(res.get("entity_type"), "versions")
        answer = res.get("answer", "")
        self.assertIn("Side-by-Side Comparison", answer)
        self.assertIn("R2+1D", answer)
        self.assertIn("-32.0%", answer) # accuracy delta: 45 - 77 = -32.0%
        self.assertIn("-14.0%", answer) # precision delta: 53 - 67 = -14.0%
        self.assertIn("-20.0%", answer) # recall delta: 67 - 87 = -20.0%
        self.assertIn("-43.0", answer) # F1 delta: 45 - 88 = -43.0

    def test_most_improved_accuracy(self):
        """Test 21: Verify 'improved accuracy most' identifies the correct version."""
        res = run_sql_agent("Which version of R2+1D improved accuracy most?", self.db)
        self.assertEqual(res.get("type"), "text")
        answer = res.get("answer", "")
        self.assertIn("Accuracy Improvement Analysis", answer)
        self.assertIn("R2+1D", answer)
        self.assertIn("v6", answer)
        self.assertIn("+33.0%", answer)

    def test_version_zip_download_dialogue(self):
        """Test 22: Verify multi-turn dialogue flow for downloading version zip files."""
        # Start transaction
        self.db.begin_nested()
        try:
            # 1. Insert a dummy model, model version, and artifacts
            # We find a factory and algorithm to link to
            fact = self.db.execute(text("SELECT id FROM factories LIMIT 1")).fetchone()
            algo = self.db.execute(text("SELECT id FROM algorithms LIMIT 1")).fetchone()
            
            self.db.execute(
                text("INSERT INTO models (id, name, algorithm_id, factory_id, created_at) VALUES (9999, 'TestModelZip', :aid, :fid, CURRENT_TIMESTAMP)"),
                {"aid": algo[0], "fid": fact[0]}
            )
            self.db.execute(
                text("INSERT INTO model_versions (id, model_id, version_number, is_active, created_at) VALUES (9999, 9999, 1, true, CURRENT_TIMESTAMP)")
            )
            # Add artifacts
            # type can be dataset, label, model, code
            self.db.execute(
                text("INSERT INTO artifacts (id, version_id, name, type, path, size, checksum) VALUES "
                     "(9990, 9999, 'img1.jpg', 'dataset', '/tmp/img1.jpg', 100, 'abc'),"
                     "(9991, 9999, 'img2.jpg', 'dataset', '/tmp/img2.jpg', 100, 'def'),"
                     "(9992, 9999, 'label1.txt', 'label', '/tmp/label1.txt', 50, 'ghi'),"
                     "(9993, 9999, 'weights.pt', 'model', '/tmp/weights.pt', 2000, 'jkl'),"
                     "(9994, 9999, 'train.py', 'code', '/tmp/train.py', 500, 'mno')")
            )
            
            # Query 1: Initial request
            res1 = run_sql_agent("download zip for TestModelZip v1", self.db)
            self.assertEqual(res1.get("type"), "text")
            answer1 = res1.get("answer", "")
            self.assertIn("TestModelZip", answer1)
            self.assertIn("Dataset**: 2 images", answer1)
            self.assertIn("Labels**: 1 file", answer1)
            self.assertIn("Model weights**: 1 file", answer1)
            self.assertIn("Code**: 1 file", answer1)
            self.assertIn("DOWNLOAD_PROMPT", answer1)
            
            # Verify follow ups
            self.assertIn("Download All Components", res1.get("follow_ups", []))
            self.assertIn("Dataset only", res1.get("follow_ups", []))
            
            # Query 2: Simulation of user selecting "Download All Components"
            context = [
                {"role": "user", "content": "download zip for TestModelZip v1"},
                {"role": "bot", "content": answer1}
            ]
            res2 = run_sql_agent("Download All Components", self.db, context=context)
            self.assertEqual(res2.get("type"), "zip_download")
            self.assertIn("Model weights", res2.get("answer", ""))
            self.assertIn("dataset=true", res2.get("download_url", ""))
            self.assertIn("labels=true", res2.get("download_url", ""))
            self.assertIn("model=true", res2.get("download_url", ""))
            self.assertIn("code=true", res2.get("download_url", ""))
            self.assertEqual(res2.get("model_name"), "TestModelZip")
            self.assertEqual(res2.get("version_number"), 1)
            
            # Query 3: Simulation of user selecting "dataset only"
            res3 = run_sql_agent("dataset only", self.db, context=context)
            self.assertEqual(res3.get("type"), "zip_download")
            self.assertIn("dataset=true", res3.get("download_url", ""))
            self.assertNotIn("labels=true", res3.get("download_url", ""))
            self.assertNotIn("model=true", res3.get("download_url", ""))
            self.assertNotIn("code=true", res3.get("download_url", ""))
            
        finally:
            # Rollback nested transaction to clean up dummy model/version/artifacts
            self.db.rollback()

    def test_artifact_zip_download_dialogue(self):
        """Test 22b: Verify dialogue flow for downloading zip of artifacts."""
        self.db.begin_nested()
        try:
            fact = self.db.execute(text("SELECT id FROM factories LIMIT 1")).fetchone()
            algo = self.db.execute(text("SELECT id FROM algorithms LIMIT 1")).fetchone()
            
            self.db.execute(
                text("INSERT INTO models (id, name, algorithm_id, factory_id, created_at) VALUES (9999, 'TestModelZip', :aid, :fid, CURRENT_TIMESTAMP)"),
                {"aid": algo[0], "fid": fact[0]}
            )
            self.db.execute(
                text("INSERT INTO model_versions (id, model_id, version_number, is_active, created_at) VALUES (9999, 9999, 1, true, CURRENT_TIMESTAMP)")
            )
            self.db.execute(
                text("INSERT INTO artifacts (id, version_id, name, type, path, size, checksum) VALUES "
                     "(9990, 9999, 'img1.jpg', 'dataset', '/tmp/img1.jpg', 100, 'abc'),"
                     "(9992, 9999, 'label1.txt', 'label', '/tmp/label1.txt', 50, 'ghi')")
            )
            
            # Query 1: Using "download the zip of artifacts" phrasing
            res1 = run_sql_agent("download the zip of artifacts for TestModelZip v1", self.db)
            self.assertEqual(res1.get("type"), "text")
            self.assertIn("TestModelZip", res1.get("answer", ""))
            self.assertIn("DOWNLOAD_PROMPT", res1.get("answer", ""))
            
            # Query 2: Using "download artifacts" phrasing
            res2 = run_sql_agent("download artifacts for TestModelZip", self.db)
            self.assertEqual(res2.get("type"), "text")
            self.assertIn("TestModelZip", res2.get("answer", ""))
            self.assertIn("DOWNLOAD_PROMPT", res2.get("answer", ""))

        finally:
            self.db.rollback()

    def test_download_report_duplicate_filtering(self):
        """Test 23: Verify that downloading a report for a model with duplicate name in different algorithms is filtered correctly."""
        from app.api.chatbot import download_report
        import csv
        import io

        self.db.begin_nested()
        try:
            # 1. Ensure we have two distinct algorithms and a factory
            algos = self.db.execute(text("SELECT id, name FROM algorithms LIMIT 2")).fetchall()
            fact = self.db.execute(text("SELECT id FROM factories LIMIT 1")).fetchone()
            if len(algos) < 2 or not fact:
                # Insert dummy ones if not enough
                self.db.execute(text("INSERT INTO algorithms (id, name, description) VALUES (9901, 'AlgoOne', 'Algo 1') ON CONFLICT DO NOTHING"))
                self.db.execute(text("INSERT INTO algorithms (id, name, description) VALUES (9902, 'AlgoTwo', 'Algo 2') ON CONFLICT DO NOTHING"))
                self.db.execute(text("INSERT INTO factories (id, name, description) VALUES (9901, 'FactOne', 'Fact 1') ON CONFLICT DO NOTHING"))
                algo1_id, algo1_name = 9901, "AlgoOne"
                algo2_id, algo2_name = 9902, "AlgoTwo"
                fid = 9901
            else:
                algo1_id, algo1_name = algos[0][0], algos[0][1]
                algo2_id, algo2_name = algos[1][0], algos[1][1]
                fid = fact[0]

            # 2. Insert two models with the same name 'DupYOLO' but under different algorithms
            self.db.execute(
                text("INSERT INTO models (id, name, algorithm_id, factory_id) VALUES (9901, 'DupYOLO', :aid, :fid)"),
                {"aid": algo1_id, "fid": fid}
            )
            self.db.execute(
                text("INSERT INTO models (id, name, algorithm_id, factory_id) VALUES (9902, 'DupYOLO', :aid, :fid)"),
                {"aid": algo2_id, "fid": fid}
            )

            # 3. Add distinct versions to both models
            self.db.execute(
                text("INSERT INTO model_versions (id, model_id, version_number, note, accuracy) VALUES (9901, 9901, 1, 'Model 1 Version Note', 0.85)")
            )
            self.db.execute(
                text("INSERT INTO model_versions (id, model_id, version_number, note, accuracy) VALUES (9902, 9902, 1, 'Model 2 Version Note', 0.95)")
            )

            # 4. Test run_sql_agent to see if it extracts the specific model/algorithm context
            res = run_sql_agent(f"download the report of DupYOLO of {algo1_name}", self.db)
            self.assertEqual(res.get("type"), "download")
            self.assertEqual(res.get("report_type"), "model")
            self.assertEqual(res.get("report_name"), "DupYOLO")
            self.assertEqual(res.get("model_id"), 9901)
            self.assertEqual(res.get("algorithm_id"), algo1_id)

            # 5. Call download_report directly with algorithm_id filter and verify CSV contains only the filtered model's versions
            response = download_report(report_type="model", name="DupYOLO", algorithm_id=algo1_id, db=self.db)
            import asyncio
            async def get_body(iterator):
                res_list = []
                async for chunk in iterator:
                    res_list.append(chunk if isinstance(chunk, str) else chunk.decode("utf-8"))
                return "".join(res_list)
            content = asyncio.run(get_body(response.body_iterator))
            reader = csv.reader(io.StringIO(content))
            rows = list(reader)
            self.assertTrue(len(rows) > 0)
            
            # The CSV row values for version note should contain only 'Model 1 Version Note' and NOT 'Model 2 Version Note'
            row_contents = [row[2] for row in rows[1:] if len(row) > 2]
            self.assertIn("Model 1 Version Note", row_contents)
            self.assertNotIn("Model 2 Version Note", row_contents)

        finally:
            self.db.rollback()

    def test_compare_multiple_factories_in_algorithm(self):
        """Test 24: Verify that comparing multiple factories in a single algorithm context compares all their models."""
        self.db.begin_nested()
        try:
            # 1. Insert two factories, one algorithm
            self.db.execute(text("INSERT INTO algorithms (id, name, description) VALUES (9951, 'AlgoOne', 'Algo One description') ON CONFLICT DO NOTHING"))
            self.db.execute(text("INSERT INTO factories (id, name, description) VALUES (9951, 'FactOne', 'Fact One description') ON CONFLICT DO NOTHING"))
            self.db.execute(text("INSERT INTO factories (id, name, description) VALUES (9952, 'FactTwo', 'Fact Two description') ON CONFLICT DO NOTHING"))
            
            # 2. Insert 3 models: 1 in FactOne, 2 in FactTwo, all in AlgoOne
            self.db.execute(text("INSERT INTO models (id, name, algorithm_id, factory_id) VALUES (9951, 'ModelA', 9951, 9951)"))
            self.db.execute(text("INSERT INTO models (id, name, algorithm_id, factory_id) VALUES (9952, 'ModelB', 9951, 9952)"))
            self.db.execute(text("INSERT INTO models (id, name, algorithm_id, factory_id) VALUES (9953, 'ModelC', 9951, 9952)"))
            
            # 3. Insert active versions for all 3 models
            self.db.execute(text("INSERT INTO model_versions (id, model_id, version_number, is_active, accuracy, precision, recall, f1_score, inference_time) VALUES (9951, 9951, 1, true, 0.85, 0.86, 0.84, 0.85, 12.0)"))
            self.db.execute(text("INSERT INTO model_versions (id, model_id, version_number, is_active, accuracy, precision, recall, f1_score, inference_time) VALUES (9952, 9952, 1, true, 0.88, 0.89, 0.87, 0.88, 15.0)"))
            self.db.execute(text("INSERT INTO model_versions (id, model_id, version_number, is_active, accuracy, precision, recall, f1_score, inference_time) VALUES (9953, 9953, 1, true, 0.92, 0.93, 0.91, 0.92, 14.0)"))
            
            # 4. Request comparison of multiple factories in the algorithm context
            res = run_sql_agent("compare factory FactOne and FactTwo in AlgoOne", self.db)
            self.assertEqual(res.get("type"), "comparison")
            
            # Verify the response includes all 3 models
            answer = res.get("answer", "")
            self.assertIn("ModelA", answer)
            self.assertIn("ModelB", answer)
            self.assertIn("ModelC", answer)
            
            # Verify rank output showing model count
            self.assertIn("3 model(s)", answer)
            
            # Verify comparison data contains correct models
            m_ids = [m["model_id"] for m in res.get("data", [])]
            self.assertIn(9951, m_ids)
            self.assertIn(9952, m_ids)
            self.assertIn(9953, m_ids)

        finally:
            self.db.rollback()

    def test_intent_clarification_fallback(self):
        """Test 25: Verify that ambiguous/unresolved intents return the clarification prompt."""
        res = run_sql_agent("show me the strongest one", self.db)
        self.assertEqual(res.get("type"), "text")
        self.assertEqual(res.get("answer"), "Do you want to compare models, algorithms, or factories?")

    def test_context_clarification_fallback(self):
        """Test 26: Verify that when pronoun resolution fails (e.g. asking "Which one is deployed?" with empty context history), the agent returns clarification."""
        res = run_sql_agent("Which one is deployed?", self.db, context=[])
        self.assertEqual(res.get("type"), "text")
        self.assertEqual(res.get("answer"), "Could you please specify which model, factory, or algorithm you are referring to?")

    def test_knowledge_intent(self):
        """Test 27: Verify that conceptual queries like 'What is overfitting?' resolve to KNOWLEDGE intent, returning a text answer and filtered follow-ups."""
        res = run_sql_agent("What is overfitting?", self.db)
        self.assertEqual(res.get("type"), "text")
        self.assertIsNotNone(res.get("answer"))
        self.assertTrue(len(res.get("answer", "")) > 10)
        
        # Verify follow ups are returned and filtered
        follow_ups = res.get("follow_ups", [])
        self.assertTrue(len(follow_ups) > 0)
        for fu in follow_ups:
            self.assertNotIn("overfitting", fu.lower())

    def test_multitask_query_planning(self):
        """Test 28: Verify that multi-task query planning splits multi-intent queries, executes them independently, merges answers, and preserves SQL determinism."""
        q = "Which factory has the best YOLOv11 model and explain precision?"
        res = run_sql_agent(q, self.db)
        
        self.assertIsNotNone(res)
        self.assertEqual(res.get("type"), "sql")
        
        answer = res.get("answer", "")
        # Should contain both the database answers (about YOLOv11 and factories) and the precision concept explanation
        self.assertTrue(any(w in answer.lower() for w in ["yolov11", "factory"]))
        self.assertIn("Concept Explanation", answer)
        self.assertIn("precision", answer.lower())
        
        # Verify SQL determinism is preserved
        self.assertTrue(res.get("verified"))
        self.assertIsNotNone(res.get("data"))

if __name__ == "__main__":
    from sqlalchemy import text
    unittest.main()
