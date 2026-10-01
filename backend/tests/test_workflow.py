import os
import sys
import unittest

# Add backend directory to sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from fastapi.testclient import TestClient
from app.main import app
from app.database import Base, engine, SessionLocal, seed_initial_brand_data


class TestBrandForgeWorkflow(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        # Create fresh tables and seed
        Base.metadata.drop_all(bind=engine)
        Base.metadata.create_all(bind=engine)
        db = SessionLocal()
        seed_initial_brand_data(db)
        db.close()
        cls.client = TestClient(app)


    def test_01_health_check(self):
        response = self.client.get("/api/health")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["status"], "healthy")

    def test_02_get_current_brand(self):
        response = self.client.get("/api/brands/current")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["name"], "Arkiva Studio")
        self.assertGreaterEqual(data["completeness"], 80)
        self.assertIn("values", data)
        self.assertIn("voice_traits", data)

    def test_03_update_current_brand(self):
        update_payload = {
            "name": "Arkiva Studio Pro",
            "tagline": '"Design without limits - Updated."',
            "mission": "New mission statement.",
            "voice_traits": [
                {"trait": "Confident", "opposite": "Timid", "value": 92},
                {"trait": "Creative", "opposite": "Conservative", "value": 88},
                {"trait": "Approachable", "opposite": "Formal", "value": 75},
                {"trait": "Precise", "opposite": "Casual", "value": 82},
            ],
        }
        response = self.client.put("/api/brands/current", json=update_payload)
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["name"], "Arkiva Studio Pro")
        self.assertEqual(data["tagline"], '"Design without limits - Updated."')
        self.assertEqual(data["mission"], "New mission statement.")
        self.assertEqual(data["voice_traits"][0]["value"], 92)

        # Verify persistence on subsequent GET
        get_res = self.client.get("/api/brands/current")
        self.assertEqual(get_res.status_code, 200)
        get_data = get_res.json()
        self.assertEqual(get_data["name"], "Arkiva Studio Pro")
        self.assertEqual(get_data["voice_traits"][0]["value"], 92)


    def test_04_get_current_products(self):
        response = self.client.get("/api/brands/current/products")
        self.assertEqual(response.status_code, 200)
        products = response.json()
        self.assertGreaterEqual(len(products), 1)
        product_names = [p["name"] for p in products]
        self.assertIn("Arkiva Pro Suite", product_names)

    def test_05_create_campaign_and_generate_strategies(self):
        # 1. Create campaign
        campaign_payload = {
            "name": "Summer Refresh 2024",
            "product_name": "Arkiva Pro Suite",
            "objective": "Brand Awareness",
            "audience": "Creative professionals aged 28–40",
            "duration": "6 weeks",
            "message": "Arkiva transforms how creative professionals work.",
            "instructions": "Authentic, high craft",
            "platforms": ["Instagram", "LinkedIn", "YouTube"],
        }
        res_create = self.client.post("/api/campaigns", json=campaign_payload)
        self.assertEqual(res_create.status_code, 201)
        campaign = res_create.json()
        campaign_id = campaign["id"]
        self.assertEqual(campaign["name"], "Summer Refresh 2024")
        self.assertEqual(campaign["status"], "draft")

        # 2. Generate strategies
        res_gen = self.client.post(f"/api/campaigns/{campaign_id}/generate-strategies")
        self.assertEqual(res_gen.status_code, 200)
        strategies = res_gen.json()
        self.assertEqual(len(strategies), 3)

        strat_types = [s["strategy_type"] for s in strategies]
        self.assertIn("product", strat_types)
        self.assertIn("story", strat_types)
        self.assertIn("community", strat_types)

        # Check structure of each strategy
        for strat in strategies:
            self.assertIn("label", strat)
            self.assertIn("tagline", strat)
            self.assertIn("desc", strat)
            self.assertIn("pillars", strat)
            self.assertIn("timeline", strat)
            self.assertGreater(len(strat["pillars"]), 0)
            self.assertGreater(len(strat["timeline"]), 0)

        # 3. Retrieve strategies
        res_get = self.client.get(f"/api/campaigns/{campaign_id}/strategies")
        self.assertEqual(res_get.status_code, 200)
        self.assertEqual(len(res_get.json()), 3)

        # 4. Select a strategy
        story_strat = next(s for s in strategies if s["strategy_type"] == "story")
        res_select = self.client.patch(
            f"/api/campaigns/{campaign_id}/strategies/{story_strat['id']}/select",
            json={"is_selected": True},
        )
        self.assertEqual(res_select.status_code, 200)
        self.assertTrue(res_select.json()["is_selected"])

        # Store for subsequent content tests
        TestBrandForgeWorkflow.campaign_id = campaign_id
        TestBrandForgeWorkflow.strategy_id = story_strat["id"]

    def test_06_generate_content_all_platforms(self):
        campaign_id = TestBrandForgeWorkflow.campaign_id
        strategy_id = TestBrandForgeWorkflow.strategy_id

        payload = {
            "strategy_id": strategy_id,
            "platforms": ["instagram", "linkedin", "x", "youtube_shorts"],
        }
        response = self.client.post(f"/api/campaigns/{campaign_id}/content/generate", json=payload)
        self.assertEqual(response.status_code, 201)
        contents = response.json()
        self.assertEqual(len(contents), 4)

        platforms_returned = {c["platform"] for c in contents}
        self.assertEqual(platforms_returned, {"instagram", "linkedin", "x", "youtube_shorts"})

        for item in contents:
            self.assertEqual(item["campaign_id"], campaign_id)
            self.assertEqual(item["strategy_id"], strategy_id)
            self.assertTrue(item["title"])
            self.assertTrue(item["body"])
            self.assertTrue(item["hook"])
            self.assertTrue(item["call_to_action"])

        # Check platform-specific content attributes
        ig_item = next(c for c in contents if c["platform"] == "instagram")
        self.assertEqual(ig_item["content_type"], "caption")
        self.assertIn("#", ig_item["body"])
        self.assertTrue(ig_item["visual_concept"])

        li_item = next(c for c in contents if c["platform"] == "linkedin")
        self.assertEqual(li_item["content_type"], "post")
        self.assertTrue(li_item["body"])

        x_item = next(c for c in contents if c["platform"] == "x")
        self.assertEqual(x_item["content_type"], "thread")
        self.assertTrue(x_item["body"])

        yt_item = next(c for c in contents if c["platform"] == "youtube_shorts")
        self.assertEqual(yt_item["content_type"], "script")
        self.assertTrue(yt_item["visual_concept"])
        self.assertIn("[0:", yt_item["body"])

    def test_07_get_content_with_filtering(self):
        campaign_id = TestBrandForgeWorkflow.campaign_id
        strategy_id = TestBrandForgeWorkflow.strategy_id

        # 1. Fetch all content
        res_all = self.client.get(f"/api/campaigns/{campaign_id}/content")
        self.assertEqual(res_all.status_code, 200)
        self.assertEqual(len(res_all.json()), 4)

        # 2. Filter by platform
        res_ig = self.client.get(f"/api/campaigns/{campaign_id}/content?platform=instagram")
        self.assertEqual(res_ig.status_code, 200)
        items_ig = res_ig.json()
        self.assertEqual(len(items_ig), 1)
        self.assertEqual(items_ig[0]["platform"], "instagram")

        # 3. Filter by strategy_id
        res_strat = self.client.get(f"/api/campaigns/{campaign_id}/content?strategy_id={strategy_id}")
        self.assertEqual(res_strat.status_code, 200)
        self.assertEqual(len(res_strat.json()), 4)

        # 4. Filter by non-existent platform
        res_none = self.client.get(f"/api/campaigns/{campaign_id}/content?platform=tiktok")
        self.assertEqual(res_none.status_code, 200)
        self.assertEqual(len(res_none.json()), 0)

    def test_08_generate_content_subset_platforms(self):
        campaign_id = TestBrandForgeWorkflow.campaign_id
        strategy_id = TestBrandForgeWorkflow.strategy_id

        payload = {
            "strategy_id": strategy_id,
            "platforms": ["instagram", "linkedin"],
        }
        response = self.client.post(f"/api/campaigns/{campaign_id}/content/generate", json=payload)
        self.assertEqual(response.status_code, 201)
        contents = response.json()
        self.assertEqual(len(contents), 2)
        platforms = {c["platform"] for c in contents}
        self.assertEqual(platforms, {"instagram", "linkedin"})

    def test_09_invalid_campaign_id(self):
        strategy_id = TestBrandForgeWorkflow.strategy_id
        payload = {"strategy_id": strategy_id, "platforms": ["instagram"]}

        res_post = self.client.post("/api/campaigns/non-existent-campaign/content/generate", json=payload)
        self.assertEqual(res_post.status_code, 404)

        res_get = self.client.get("/api/campaigns/non-existent-campaign/content")
        self.assertEqual(res_get.status_code, 404)

    def test_10_invalid_or_mismatched_strategy_id(self):
        campaign_id = TestBrandForgeWorkflow.campaign_id

        # Non-existent strategy
        payload_bad_strat = {"strategy_id": "non-existent-strategy-id", "platforms": ["instagram"]}
        res_bad = self.client.post(f"/api/campaigns/{campaign_id}/content/generate", json=payload_bad_strat)
        self.assertEqual(res_bad.status_code, 404)

        # Strategy belonging to another campaign
        campaign2 = self.client.post(
            "/api/campaigns",
            json={"name": "Campaign 2", "objective": "Lead Generation", "product_name": "Arkiva Templates"},
        ).json()
        campaign2_id = campaign2["id"]

        res_mismatch = self.client.post(
            f"/api/campaigns/{campaign2_id}/content/generate",
            json={"strategy_id": TestBrandForgeWorkflow.strategy_id, "platforms": ["instagram"]},
        )
        self.assertEqual(res_mismatch.status_code, 400)
        self.assertIn("does not belong", res_mismatch.json()["detail"])

    def test_11_invalid_platform_validation(self):
        campaign_id = TestBrandForgeWorkflow.campaign_id
        strategy_id = TestBrandForgeWorkflow.strategy_id

        # Unsupported platform
        payload_unsupported = {"strategy_id": strategy_id, "platforms": ["pinterest", "tiktok"]}
        res_unsupported = self.client.post(f"/api/campaigns/{campaign_id}/content/generate", json=payload_unsupported)
        self.assertEqual(res_unsupported.status_code, 400)
        self.assertIn("Unsupported platform", res_unsupported.json()["detail"])

    def test_12_list_campaigns(self):
        res = self.client.get("/api/campaigns")
        self.assertEqual(res.status_code, 200)
        campaigns = res.json()
        self.assertGreaterEqual(len(campaigns), 1)
        self.assertTrue(any(c["id"] == TestBrandForgeWorkflow.campaign_id for c in campaigns))

    def test_13_strategy_type_and_platform_variations(self):
        campaign_id = TestBrandForgeWorkflow.campaign_id

        # Generate using strategy_type ('product') and platform names with spaces/caps/twitter
        payload = {
            "strategy_id": "product",
            "platforms": ["YouTube Shorts", "Instagram", "twitter", "LinkedIn"],
        }
        res = self.client.post(f"/api/campaigns/{campaign_id}/content/generate", json=payload)
        self.assertEqual(res.status_code, 201)
        items = res.json()
        self.assertEqual(len(items), 4)
        platforms = {i["platform"] for i in items}
        self.assertEqual(platforms, {"youtube_shorts", "instagram", "x", "linkedin"})

    def test_14_multi_strategy_content_isolation(self):
        campaign_id = TestBrandForgeWorkflow.campaign_id

        # Fetch product strategy content
        res_prod = self.client.get(f"/api/campaigns/{campaign_id}/content?strategy_id=product")
        self.assertEqual(res_prod.status_code, 200)
        self.assertEqual(len(res_prod.json()), 4)

        # Fetch story strategy content
        res_story = self.client.get(f"/api/campaigns/{campaign_id}/content?strategy_id={TestBrandForgeWorkflow.strategy_id}")
        self.assertEqual(res_story.status_code, 200)
        self.assertGreaterEqual(len(res_story.json()), 2)

        # Confirm different strategy contents have distinct titles / content
        prod_ig = next(c for c in res_prod.json() if c["platform"] == "instagram")
        story_ig = next(c for c in res_story.json() if c["platform"] == "instagram")
        self.assertNotEqual(prod_ig["id"], story_ig["id"])

    def test_15_audit_single_content_success(self):
        campaign_id = TestBrandForgeWorkflow.campaign_id
        res_content = self.client.get(f"/api/campaigns/{campaign_id}/content?platform=instagram")
        self.assertEqual(res_content.status_code, 200)
        items = res_content.json()
        self.assertGreater(len(items), 0)
        content_id = items[0]["id"]

        # Call POST audit
        res_audit = self.client.post(f"/api/content/{content_id}/audit")
        self.assertEqual(res_audit.status_code, 200)
        audit_data = res_audit.json()

        self.assertIn("id", audit_data)
        self.assertEqual(audit_data["campaign_content_id"], content_id)
        self.assertIn(audit_data["overall_status"], ["pass", "warning", "fail"])
        self.assertTrue(audit_data["is_current"])
        self.assertGreater(len(audit_data["findings"]), 0)

        for finding in audit_data["findings"]:
            self.assertIn(finding["guard_type"], ["brandguard", "claimguard"])
            self.assertIn(finding["severity"], ["critical", "warning", "info"])
            self.assertIn(finding["status"], ["pass", "warning", "fail"])
            self.assertTrue(finding["title"])
            self.assertTrue(finding["explanation"])

        TestBrandForgeWorkflow.content_id = content_id

    def test_16_claimguard_unsupported_environmental_claim(self):
        campaign_id = TestBrandForgeWorkflow.campaign_id
        strategy_id = TestBrandForgeWorkflow.strategy_id

        # Insert content with unsupported environmental claim
        db = SessionLocal()
        from app.models import CampaignContent
        unsupported_content = CampaignContent(
            campaign_id=campaign_id,
            strategy_id=strategy_id,
            platform="linkedin",
            content_type="post",
            title="Eco Revolution",
            body="Arkiva Pro Suite is 100% sustainable and produces zero waste across our global supply chain.",
            hook="The future of sustainable design is here.",
            call_to_action="Adopt green design today.",
        )
        db.add(unsupported_content)
        db.commit()
        unsupported_id = unsupported_content.id
        db.close()

        # Audit this content
        res = self.client.post(f"/api/content/{unsupported_id}/audit")
        self.assertEqual(res.status_code, 200)
        audit = res.json()

        self.assertEqual(audit["overall_status"], "fail")
        claim_findings = [f for f in audit["findings"] if f["guard_type"] == "claimguard" and f["status"] == "fail"]
        self.assertGreater(len(claim_findings), 0)
        self.assertTrue(any("Unsupported claim — evidence not found in the provided brand/product knowledge." in f["explanation"] for f in claim_findings))

    def test_17_claimguard_supported_claim_passes(self):
        campaign_id = TestBrandForgeWorkflow.campaign_id
        strategy_id = TestBrandForgeWorkflow.strategy_id

        # Add "Made using recycled polyester" to product description
        db = SessionLocal()
        from app.models import Product, CampaignContent
        product = db.query(Product).first()
        product.description = "Premium creator workstation made using recycled polyester casing and precision aluminum."
        db.commit()

        # Create content with substantiated claim
        supported_content = CampaignContent(
            campaign_id=campaign_id,
            strategy_id=strategy_id,
            platform="instagram",
            content_type="caption",
            title="Sustainable Craft",
            body="Every detail is intentional. Made using recycled polyester casing for effortless durability.",
            hook="Design with purpose.",
            call_to_action="Discover the craft.",
        )
        db.add(supported_content)
        db.commit()
        supported_id = supported_content.id
        db.close()

        # Audit should pass the supported claim
        res = self.client.post(f"/api/content/{supported_id}/audit")
        self.assertEqual(res.status_code, 200)
        audit = res.json()

        # Should not fail on recycled polyester claim
        recycled_findings = [f for f in audit["findings"] if "recycled" in f["title"].lower() or "recycled" in (f.get("evidence") or "").lower()]
        self.assertGreater(len(recycled_findings), 0)
        self.assertEqual(recycled_findings[0]["status"], "pass")
        self.assertEqual(audit["overall_status"], "pass")

    def test_18_claimguard_absolute_claim_flagged(self):
        campaign_id = TestBrandForgeWorkflow.campaign_id
        strategy_id = TestBrandForgeWorkflow.strategy_id

        db = SessionLocal()
        from app.models import CampaignContent
        abs_content = CampaignContent(
            campaign_id=campaign_id,
            strategy_id=strategy_id,
            platform="x",
            content_type="thread",
            title="Unbreakable Promise",
            body="Arkiva Pro is guaranteed to last forever and never fails under any workload.",
            hook="The permanent creative solution.",
            call_to_action="Get yours today.",
        )
        db.add(abs_content)
        db.commit()
        abs_id = abs_content.id
        db.close()

        res = self.client.post(f"/api/content/{abs_id}/audit")
        self.assertEqual(res.status_code, 200)
        audit = res.json()

        self.assertEqual(audit["overall_status"], "fail")
        abs_findings = [f for f in audit["findings"] if f["category"] == "absolute_claim"]
        self.assertGreater(len(abs_findings), 0)
        self.assertEqual(abs_findings[0]["status"], "fail")
        self.assertEqual(abs_findings[0]["severity"], "critical")
        self.assertIn("Unsupported claim — evidence not found in the provided brand/product knowledge.", abs_findings[0]["explanation"])

    def test_19_brandguard_dont_rule_violation(self):
        campaign_id = TestBrandForgeWorkflow.campaign_id
        strategy_id = TestBrandForgeWorkflow.strategy_id

        db = SessionLocal()
        from app.models import CampaignContent
        violating_content = CampaignContent(
            campaign_id=campaign_id,
            strategy_id=strategy_id,
            platform="linkedin",
            content_type="post",
            title="Flash Sale Alert",
            body="BUY NOW OR ELSE! Dirt cheap prices at rock bottom rates. Hurry before it is gone forever!",
            hook="Dirt cheap discount today only!",
            call_to_action="Buy immediately now!",
        )
        db.add(violating_content)
        db.commit()
        violating_id = violating_content.id
        db.close()

        res = self.client.post(f"/api/content/{violating_id}/audit")
        self.assertEqual(res.status_code, 200)
        audit = res.json()

        self.assertEqual(audit["overall_status"], "fail")
        dont_rule_findings = [f for f in audit["findings"] if f["guard_type"] == "brandguard" and f["category"] == "do_dont_rule" and f["status"] == "fail"]
        self.assertGreater(len(dont_rule_findings), 0)
        self.assertEqual(dont_rule_findings[0]["severity"], "critical")

    def test_20_brandguard_messaging_pillar_and_voice_alignment(self):
        content_id = TestBrandForgeWorkflow.content_id
        res = self.client.get(f"/api/content/{content_id}/audit")
        self.assertEqual(res.status_code, 200)
        audit = res.json()

        # Check for BrandGuard messaging pillar and voice findings
        pillar_finding = next((f for f in audit["findings"] if f["category"] == "messaging_pillar"), None)
        voice_finding = next((f for f in audit["findings"] if f["category"] == "voice"), None)

        self.assertIsNotNone(pillar_finding)
        self.assertIsNotNone(voice_finding)
        self.assertEqual(pillar_finding["status"], "pass")
        self.assertEqual(voice_finding["status"], "pass")

    def test_21_audit_persistence_and_retrieval(self):
        content_id = TestBrandForgeWorkflow.content_id
        res_get = self.client.get(f"/api/content/{content_id}/audit")
        self.assertEqual(res_get.status_code, 200)
        data = res_get.json()
        self.assertEqual(data["campaign_content_id"], content_id)
        self.assertTrue(data["is_current"])
        self.assertGreater(len(data["findings"]), 0)

    def test_22_fresh_audit_replaces_stale_audit(self):
        content_id = TestBrandForgeWorkflow.content_id

        # Run audit first time
        res1 = self.client.post(f"/api/content/{content_id}/audit")
        self.assertEqual(res1.status_code, 200)
        audit1_id = res1.json()["id"]

        # Run audit second time
        res2 = self.client.post(f"/api/content/{content_id}/audit")
        self.assertEqual(res2.status_code, 200)
        audit2_id = res2.json()["id"]

        # Verify in DB only 1 audit exists for this content
        db = SessionLocal()
        from app.models import ContentAudit
        audits = db.query(ContentAudit).filter(ContentAudit.campaign_content_id == content_id).all()
        self.assertEqual(len(audits), 1)
        self.assertEqual(audits[0].id, audit2_id)
        db.close()

    def test_23_campaign_wide_audit_endpoint(self):
        campaign_id = TestBrandForgeWorkflow.campaign_id

        # 1. Audit entire campaign
        res = self.client.post(f"/api/campaigns/{campaign_id}/audit")
        self.assertEqual(res.status_code, 200)
        campaign_audit = res.json()

        self.assertEqual(campaign_audit["campaign_id"], campaign_id)
        self.assertIn(campaign_audit["overall_status"], ["pass", "warning", "fail"])
        self.assertGreaterEqual(campaign_audit["total_audited"], 4)
        self.assertEqual(len(campaign_audit["audits"]), campaign_audit["total_audited"])

        # 2. Audit with strategy_id filter
        strategy_id = TestBrandForgeWorkflow.strategy_id
        res_strat = self.client.post(f"/api/campaigns/{campaign_id}/audit?strategy_id={strategy_id}")
        self.assertEqual(res_strat.status_code, 200)
        self.assertGreaterEqual(res_strat.json()["total_audited"], 2)

    # =========================================================================
    # MILESTONE 3C: HUMAN APPROVAL & CONTENT REVISION TESTS
    # =========================================================================

    def test_24_get_content_approval_state(self):
        content_id = TestBrandForgeWorkflow.content_id
        res = self.client.get(f"/api/content/{content_id}/approval")
        self.assertEqual(res.status_code, 200)
        data = res.json()

        self.assertEqual(data["campaign_content_id"], content_id)
        self.assertIn(data["approval_status"], ["pending_review", "changes_requested", "approved", "rejected"])
        self.assertGreaterEqual(data["revision_number"], 1)
        self.assertGreaterEqual(len(data["revisions"]), 1)
        self.assertGreaterEqual(len(data["approval_history"]), 1)

    def test_25_submit_content_for_review(self):
        content_id = TestBrandForgeWorkflow.content_id
        res = self.client.post(f"/api/content/{content_id}/submit-review")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data["approval_status"], "pending_review")
        self.assertTrue(any(a["action"] == "submitted" for a in data["approval_history"]))

    def test_26_request_changes_success(self):
        content_id = TestBrandForgeWorkflow.content_id
        feedback = "Please tone down the marketing hype and adjust CTA."
        res = self.client.post(f"/api/content/{content_id}/request-changes", json={"feedback": feedback})
        self.assertEqual(res.status_code, 200)
        data = res.json()

        self.assertEqual(data["approval_status"], "changes_requested")
        self.assertEqual(data["reviewer_feedback"], feedback)
        changes_actions = [a for a in data["approval_history"] if a["action"] == "changes_requested"]
        self.assertGreater(len(changes_actions), 0)
        self.assertEqual(changes_actions[-1]["feedback"], feedback)

    def test_27_request_changes_empty_feedback_rejected(self):
        content_id = TestBrandForgeWorkflow.content_id
        res = self.client.post(f"/api/content/{content_id}/request-changes", json={"feedback": "   "})
        self.assertEqual(res.status_code, 400)
        self.assertIn("Feedback is required", res.json()["detail"])

    def test_28_approve_blocked_when_audit_fails(self):
        # Create content with critical audit failure
        db = SessionLocal()
        from app.models import CampaignContent
        fail_content = CampaignContent(
            campaign_id=TestBrandForgeWorkflow.campaign_id,
            strategy_id=TestBrandForgeWorkflow.strategy_id,
            platform="x",
            content_type="thread",
            title="Guaranteed Forever",
            body="Arkiva Pro is guaranteed to last forever and never fails.",
            hook="Permanent solution.",
            call_to_action="Buy now.",
        )
        db.add(fail_content)
        db.commit()
        fail_id = fail_content.id
        db.close()

        # Audit -> FAIL
        res_audit = self.client.post(f"/api/content/{fail_id}/audit")
        self.assertEqual(res_audit.status_code, 200)
        self.assertEqual(res_audit.json()["overall_status"], "fail")

        # Attempt approve -> Blocked (400)
        res_approve = self.client.post(f"/api/content/{fail_id}/approve")
        self.assertEqual(res_approve.status_code, 400)
        self.assertIn("cannot be approved while the latest BrandGuard audit has critical failures", res_approve.json()["detail"])

    def test_29_approve_blocked_when_no_audit_or_stale(self):
        # Create un-audited content
        db = SessionLocal()
        from app.models import CampaignContent
        unaudited = CampaignContent(
            campaign_id=TestBrandForgeWorkflow.campaign_id,
            strategy_id=TestBrandForgeWorkflow.strategy_id,
            platform="linkedin",
            content_type="post",
            title="Fresh Draft",
            body="A fresh post that has not yet been audited.",
            hook="Opening thoughts.",
            call_to_action="Read more.",
        )
        db.add(unaudited)
        db.commit()
        unaudited_id = unaudited.id
        db.close()

        # Attempt approve -> Blocked (400)
        res_approve = self.client.post(f"/api/content/{unaudited_id}/approve")
        self.assertEqual(res_approve.status_code, 400)
        self.assertIn("cannot be approved without a current BrandGuard audit", res_approve.json()["detail"])

    def test_30_approve_success_with_pass_audit(self):
        # Create content and audit with PASS
        db = SessionLocal()
        from app.models import CampaignContent, Product
        product = db.query(Product).first()
        product.description = "Precision creator workstation made using recycled polyester casing and aluminum."
        db.commit()

        pass_content = CampaignContent(
            campaign_id=TestBrandForgeWorkflow.campaign_id,
            strategy_id=TestBrandForgeWorkflow.strategy_id,
            platform="instagram",
            content_type="caption",
            title="Crafted Intentionality",
            body="Made using recycled polyester casing for effortless durability and timeless design.",
            hook="Design with intention.",
            call_to_action="Discover the suite.",
        )
        db.add(pass_content)
        db.commit()
        pass_id = pass_content.id
        db.close()

        # Audit -> PASS
        res_audit = self.client.post(f"/api/content/{pass_id}/audit")
        self.assertEqual(res_audit.status_code, 200)
        self.assertEqual(res_audit.json()["overall_status"], "pass")

        # Approve -> Success
        res_approve = self.client.post(f"/api/content/{pass_id}/approve")
        self.assertEqual(res_approve.status_code, 200)
        data = res_approve.json()
        self.assertEqual(data["approval_status"], "approved")
        self.assertIsNotNone(data["approved_at"])
        self.assertTrue(any(a["action"] == "approved" for a in data["approval_history"]))

        TestBrandForgeWorkflow.pass_content_id = pass_id

    def test_31_approve_success_with_warning_audit(self):
        # Create content with a superlative warning
        db = SessionLocal()
        from app.models import CampaignContent
        warn_content = CampaignContent(
            campaign_id=TestBrandForgeWorkflow.campaign_id,
            strategy_id=TestBrandForgeWorkflow.strategy_id,
            platform="linkedin",
            content_type="post",
            title="World's Best Design Suite",
            body="Explore why many consider Arkiva the world's best design suite for agencies.",
            hook="Elevate your agency.",
            call_to_action="Learn more.",
        )
        db.add(warn_content)
        db.commit()
        warn_id = warn_content.id
        db.close()

        # Audit -> WARNING
        res_audit = self.client.post(f"/api/content/{warn_id}/audit")
        self.assertEqual(res_audit.status_code, 200)
        self.assertEqual(res_audit.json()["overall_status"], "warning")

        # Approve with warning -> Success
        res_approve = self.client.post(f"/api/content/{warn_id}/approve")
        self.assertEqual(res_approve.status_code, 200)
        self.assertEqual(res_approve.json()["approval_status"], "approved")

    def test_32_reject_content_with_reason(self):
        content_id = TestBrandForgeWorkflow.pass_content_id
        res_reject = self.client.post(f"/api/content/{content_id}/reject", json={"feedback": "Rejected for summer campaign."})
        self.assertEqual(res_reject.status_code, 200)
        data = res_reject.json()
        self.assertEqual(data["approval_status"], "rejected")
        self.assertEqual(data["reviewer_feedback"], "Rejected for summer campaign.")
        self.assertIsNone(data["approved_at"])
        self.assertTrue(any(a["action"] == "rejected" for a in data["approval_history"]))

    def test_33_create_revision_success(self):
        content_id = TestBrandForgeWorkflow.pass_content_id
        rev_payload = {
            "title": "Refined Intentional Craft",
            "body": "Made using recycled polyester casing with refined ergonomics.",
            "hook": "Quiet precision for creators.",
            "call_to_action": "Explore Arkiva Pro today.",
            "visual_concept": "Moody studio lighting with amber highlights.",
            "revision_reason": "Polished hook and refined ergonomics messaging.",
        }

        res_rev = self.client.post(f"/api/content/{content_id}/revisions", json=rev_payload)
        self.assertEqual(res_rev.status_code, 201)
        data = res_rev.json()

        self.assertEqual(data["revision_number"], 2)
        self.assertEqual(data["title"], "Refined Intentional Craft")
        self.assertEqual(data["body"], "Made using recycled polyester casing with refined ergonomics.")
        self.assertEqual(data["hook"], "Quiet precision for creators.")
        self.assertEqual(data["approval_status"], "pending_review")
        self.assertIsNone(data["approved_at"])

    def test_34_revision_creates_history_entries(self):
        content_id = TestBrandForgeWorkflow.pass_content_id
        res = self.client.get(f"/api/content/{content_id}/approval")
        self.assertEqual(res.status_code, 200)
        data = res.json()

        self.assertGreaterEqual(len(data["revisions"]), 2)
        rev2 = next(r for r in data["revisions"] if r["revision_number"] == 2)
        self.assertEqual(rev2["revision_reason"], "Polished hook and refined ergonomics messaging.")

        rev_actions = [a for a in data["approval_history"] if a["action"] == "revision_created"]
        self.assertGreater(len(rev_actions), 0)

    def test_35_revision_invalidates_current_audit(self):
        content_id = TestBrandForgeWorkflow.pass_content_id
        res = self.client.get(f"/api/content/{content_id}/approval")
        self.assertEqual(res.status_code, 200)
        data = res.json()

        # Audit must be marked stale (is_audit_current == False)
        self.assertFalse(data["is_audit_current"])

        # Check DB directly
        db = SessionLocal()
        from app.models import ContentAudit
        current_audits = db.query(ContentAudit).filter(
            ContentAudit.campaign_content_id == content_id,
            ContentAudit.is_current == True,
        ).all()
        self.assertEqual(len(current_audits), 0)
        db.close()

    def test_36_approval_blocked_after_revision_until_reaudited(self):
        content_id = TestBrandForgeWorkflow.pass_content_id
        res_approve = self.client.post(f"/api/content/{content_id}/approve")
        self.assertEqual(res_approve.status_code, 400)
        self.assertIn("cannot be approved without a current BrandGuard audit", res_approve.json()["detail"])

    def test_37_reaudit_creates_fresh_current_audit_and_enables_approval(self):
        content_id = TestBrandForgeWorkflow.pass_content_id

        # Run re-audit
        res_audit = self.client.post(f"/api/content/{content_id}/audit")
        self.assertEqual(res_audit.status_code, 200)
        self.assertEqual(res_audit.json()["overall_status"], "pass")
        self.assertTrue(res_audit.json()["is_current"])

        # Check approval state shows current audit
        res_approval = self.client.get(f"/api/content/{content_id}/approval")
        self.assertEqual(res_approval.status_code, 200)
        self.assertTrue(res_approval.json()["is_audit_current"])
        self.assertEqual(res_approval.json()["latest_audit_status"], "pass")

        # Now approval succeeds
        res_approve = self.client.post(f"/api/content/{content_id}/approve")
        self.assertEqual(res_approve.status_code, 200)
        self.assertEqual(res_approve.json()["approval_status"], "approved")

    def test_38_multiple_revisions_sequential_ordering(self):
        content_id = TestBrandForgeWorkflow.pass_content_id

        # Save Revision 3
        rev3_payload = {
            "title": "Final Polished Craft",
            "body": "Made using recycled polyester casing with obsidian anodized finish.",
            "hook": "Precision refined for masters.",
            "call_to_action": "Order now.",
            "revision_reason": "Third revision adding finish details.",
        }
        res_rev3 = self.client.post(f"/api/content/{content_id}/revisions", json=rev3_payload)
        self.assertEqual(res_rev3.status_code, 201)
        self.assertEqual(res_rev3.json()["revision_number"], 3)

        # Revisions in approval response are ordered 1, 2, 3
        rev_numbers = [r["revision_number"] for r in res_rev3.json()["revisions"]]
        self.assertEqual(rev_numbers, [1, 2, 3])

    def test_39_revision_empty_body_or_reason_rejected(self):
        content_id = TestBrandForgeWorkflow.pass_content_id

        # Empty body
        res_bad_body = self.client.post(f"/api/content/{content_id}/revisions", json={
            "body": "   ",
            "revision_reason": "Valid reason.",
        })
        self.assertEqual(res_bad_body.status_code, 400)

        # Empty reason
        res_bad_reason = self.client.post(f"/api/content/{content_id}/revisions", json={
            "body": "Valid body.",
            "revision_reason": "   ",
        })
        self.assertEqual(res_bad_reason.status_code, 400)

    def test_40_approval_persistence_after_db_reload(self):
        content_id = TestBrandForgeWorkflow.pass_content_id

        # Re-audit and approve revision 3
        self.client.post(f"/api/content/{content_id}/audit")
        res_approve = self.client.post(f"/api/content/{content_id}/approve")
        self.assertEqual(res_approve.status_code, 200)

        # Query in brand-new DB session
        db = SessionLocal()
        from app.models import CampaignContent
        db_content = db.query(CampaignContent).filter(CampaignContent.id == content_id).first()
        self.assertEqual(db_content.approval_status, "approved")
        self.assertEqual(db_content.revision_number, 3)
        self.assertIsNotNone(db_content.approved_at)
        db.close()

    def test_41_end_to_end_full_human_in_the_loop_cycle(self):
        # 1. AI Content Generation / Creation
        db = SessionLocal()
        from app.models import CampaignContent
        cycle_content = CampaignContent(
            campaign_id=TestBrandForgeWorkflow.campaign_id,
            strategy_id=TestBrandForgeWorkflow.strategy_id,
            platform="instagram",
            content_type="caption",
            title="Sustainable Workstation 100%",
            body="Arkiva Pro is 100% sustainable and creates zero waste across all operations.",
            hook="The eco-revolution.",
            call_to_action="Buy now.",
        )
        db.add(cycle_content)
        db.commit()
        c_id = cycle_content.id
        db.close()

        # 2. BrandGuard Audit -> FAIL (Unsupported 100% sustainable claim)
        res_audit1 = self.client.post(f"/api/content/{c_id}/audit")
        self.assertEqual(res_audit1.status_code, 200)
        self.assertEqual(res_audit1.json()["overall_status"], "fail")

        # 3. Human attempts approval -> Blocked
        res_app_blocked1 = self.client.post(f"/api/content/{c_id}/approve")
        self.assertEqual(res_app_blocked1.status_code, 400)

        # 4. Human requests changes
        res_req = self.client.post(f"/api/content/{c_id}/request-changes", json={
            "feedback": "Remove 100% sustainable and zero waste claims. State recycled polyester only."
        })
        self.assertEqual(res_req.status_code, 200)
        self.assertEqual(res_req.json()["approval_status"], "changes_requested")

        # 5. Human saves Revision 2
        res_rev2 = self.client.post(f"/api/content/{c_id}/revisions", json={
            "title": "Recycled Polyester Workstation",
            "body": "Arkiva Pro is made using recycled polyester casing with durable craft.",
            "hook=" : "Sustainable materials meet craft.",
            "call_to_action": "Discover the workstation.",
            "revision_reason": "Removed unsupported 100% claim; aligned with recycled polyester specs.",
        })
        self.assertEqual(res_rev2.status_code, 201)
        self.assertEqual(res_rev2.json()["approval_status"], "pending_review")
        self.assertFalse(res_rev2.json()["is_audit_current"])

        # 6. Human attempts approval -> Blocked (audit required)
        res_app_blocked2 = self.client.post(f"/api/content/{c_id}/approve")
        self.assertEqual(res_app_blocked2.status_code, 400)

        # 7. Human re-audits with BrandGuard
        res_audit2 = self.client.post(f"/api/content/{c_id}/audit")
        self.assertEqual(res_audit2.status_code, 200)
        self.assertEqual(res_audit2.json()["overall_status"], "pass")

        # 8. Human approves content -> Success!
        res_final_app = self.client.post(f"/api/content/{c_id}/approve")
        self.assertEqual(res_final_app.status_code, 200)
        self.assertEqual(res_final_app.json()["approval_status"], "approved")

        # 9. Verify full approval state & history
        res_final_state = self.client.get(f"/api/content/{c_id}/approval")
        self.assertEqual(res_final_state.status_code, 200)
        final_data = res_final_state.json()
        self.assertEqual(final_data["approval_status"], "approved")
        self.assertEqual(final_data["revision_number"], 2)
        self.assertEqual(len(final_data["revisions"]), 2)
        actions = [a["action"] for a in final_data["approval_history"]]
        self.assertIn("submitted", actions)
        self.assertIn("changes_requested", actions)
        self.assertIn("revision_created", actions)
        self.assertIn("approved", actions)

    # =========================================================================
    # MILESTONE 4 TESTS — CAMPAIGN MEMORY & CROSS-CAMPAIGN LEARNINGS
    # =========================================================================

    def test_42_get_campaign_memory(self):
        """Test GET /api/memory returns memory health, active insights, and governance/approval learnings."""
        res = self.client.get("/api/memory")
        self.assertEqual(res.status_code, 200)
        data = res.json()

        self.assertIn("health", data)
        self.assertIn("insights", data)
        self.assertIn("governance_learnings", data)
        self.assertIn("approval_learnings", data)

        health = data["health"]
        self.assertGreaterEqual(health["total_campaigns_analyzed"], 1)
        self.assertGreaterEqual(health["total_insights"], 1)
        self.assertGreaterEqual(health["total_data_points"], 1)

        insights = data["insights"]
        categories = [i["category"] for i in insights]
        self.assertIn("strategy", categories)
        self.assertTrue(any(c in categories for c in ["claim_risk", "approval_pattern", "platform"]))

    def test_43_refresh_campaign_memory_idempotent(self):
        """Test POST /api/memory/refresh recomputes insights idempotently without duplicating rows."""
        res1 = self.client.post("/api/memory/refresh")
        self.assertEqual(res1.status_code, 200)
        count1 = len(res1.json()["insights"])

        res2 = self.client.post("/api/memory/refresh")
        self.assertEqual(res2.status_code, 200)
        count2 = len(res2.json()["insights"])

        self.assertEqual(count1, count2)

    def test_44_campaign_scoped_memory(self):
        """Test GET /api/campaigns/{campaign_id}/memory returns valid memory insights for a campaign."""
        # Get existing campaigns
        camps = self.client.get("/api/campaigns").json()
        self.assertGreaterEqual(len(camps), 1)
        camp_id = camps[0]["id"]

        res = self.client.get(f"/api/campaigns/{camp_id}/memory")
        self.assertEqual(res.status_code, 200)
        insights = res.json()
        self.assertIsInstance(insights, list)
        self.assertGreaterEqual(len(insights), 1)

    def test_45_memory_insight_detail_and_traceability(self):
        """Test GET /api/memory/insights/{id} returns full insight details with traceable learning sources."""
        mem_res = self.client.get("/api/memory")
        self.assertEqual(mem_res.status_code, 200)
        insights = mem_res.json()["insights"]
        self.assertGreaterEqual(len(insights), 1)

        insight_id = insights[0]["id"]
        res = self.client.get(f"/api/memory/insights/{insight_id}")
        self.assertEqual(res.status_code, 200)
        detail = res.json()
        self.assertEqual(detail["id"], insight_id)
        self.assertIn("learning_sources", detail)
        self.assertIsInstance(detail["learning_sources"], list)
        self.assertIn(detail["confidence"], ["low", "medium", "high"])

    def test_46_record_campaign_performance(self):
        """Test POST and GET /api/campaigns/{campaign_id}/performance."""
        camps = self.client.get("/api/campaigns").json()
        camp_id = camps[0]["id"]

        perf_payload = {
            "platform": "instagram",
            "impressions": 12500,
            "reach": 9800,
            "likes": 640,
            "comments": 42,
            "shares": 88,
            "saves": 310,
            "clicks": 520,
            "conversions": 38,
        }
        res_create = self.client.post(f"/api/campaigns/{camp_id}/performance", json=perf_payload)
        self.assertEqual(res_create.status_code, 201)
        perf_data = res_create.json()
        self.assertEqual(perf_data["platform"], "instagram")
        self.assertEqual(perf_data["impressions"], 12500)
        self.assertEqual(perf_data["saves"], 310)
        self.assertGreater(perf_data["engagement_rate"], 0.0)

        # GET performance records
        res_get = self.client.get(f"/api/campaigns/{camp_id}/performance")
        self.assertEqual(res_get.status_code, 200)
        records = res_get.json()
        self.assertGreaterEqual(len(records), 1)
        self.assertEqual(records[0]["platform"], "instagram")

    def test_47_memory_learns_from_performance_data(self):
        """Test that after recording performance data, memory incorporates performance insights."""
        camps = self.client.get("/api/campaigns").json()
        camp_id = camps[0]["id"]

        # Add LinkedIn performance record
        self.client.post(f"/api/campaigns/{camp_id}/performance", json={
            "platform": "linkedin",
            "impressions": 8400,
            "reach": 7200,
            "likes": 410,
            "comments": 65,
            "shares": 95,
            "saves": 180,
            "clicks": 390,
            "conversions": 25,
        })

        # Refresh memory
        res = self.client.post("/api/memory/refresh")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        categories = [i["category"] for i in data["insights"]]
        self.assertIn("performance", categories)

    def test_48_claim_risk_governance_memory_detection(self):
        """Test that ClaimGuard audit findings are reflected in governance learnings."""
        mem = self.client.get("/api/memory").json()
        gov_learnings = mem["governance_learnings"]
        self.assertGreaterEqual(len(gov_learnings), 1)
        categories = [g["category"] for g in gov_learnings]
        self.assertIn("absolute_claim", categories)

    def test_49_approval_reviewer_habits_memory_detection(self):
        """Test that approval change requests and feedback patterns are synthesized in reviewer trends."""
        mem = self.client.get("/api/memory").json()
        app_learnings = mem["approval_learnings"]
        self.assertGreaterEqual(len(app_learnings), 1)
        patterns = [a["pattern_type"] for a in app_learnings]
        self.assertIn("hook_optimization", patterns)

    def test_50_end_to_end_cross_campaign_learning_loop(self):
        """Test creating a second campaign, running audits and approvals, and verifying memory health growth."""
        # 1. Create Campaign 2
        camp2_res = self.client.post("/api/campaigns", json={
            "name": "Autumn Velocity 2024",
            "product_name": "Arkiva Pro Suite",
            "objective": "Lead Generation",
            "duration": "4 weeks",
            "message": "Scale creative workflows with zero friction.",
            "platforms": ["LinkedIn", "YouTube Shorts"],
        })
        self.assertEqual(camp2_res.status_code, 201)
        camp2_id = camp2_res.json()["id"]

        # 2. Generate strategies for Campaign 2
        strats_res = self.client.post(f"/api/campaigns/{camp2_id}/generate-strategies")
        self.assertEqual(strats_res.status_code, 200)
        strats = strats_res.json()
        story_strat = next((s for s in strats if s["strategy_type"] == "story"), strats[0])

        # 3. Select Strategy
        self.client.patch(f"/api/campaigns/{camp2_id}/strategies/{story_strat['id']}/select", json={"is_selected": True})

        # 4. Generate Content
        content_res = self.client.post(f"/api/campaigns/{camp2_id}/content/generate", json={
            "strategy_id": story_strat["id"],
            "platforms": ["linkedin", "youtube_shorts"],
        })
        self.assertEqual(content_res.status_code, 201)
        c_items = content_res.json()
        self.assertGreaterEqual(len(c_items), 2)

        # 5. Audit all content
        camp_audit_res = self.client.post(f"/api/campaigns/{camp2_id}/audit?strategy_id={story_strat['id']}")
        self.assertEqual(camp_audit_res.status_code, 200)

        # 6. Approve one content piece
        c2_id = c_items[0]["id"]
        # If audit passed or warning, approve
        audit_state = self.client.get(f"/api/content/{c2_id}/approval").json()
        if audit_state.get("latest_audit_status") == "fail":
            # revise first
            self.client.post(f"/api/content/{c2_id}/revisions", json={
                "title": "Craft Stories",
                "body": "Durable workflows built with recycled polyester precision.",
                "revision_reason": "Policy compliance",
            })
            self.client.post(f"/api/content/{c2_id}/audit")
        self.client.post(f"/api/content/{c2_id}/approve")

        # 7. Record Performance
        self.client.post(f"/api/campaigns/{camp2_id}/performance", json={
            "platform": "linkedin",
            "impressions": 18000,
            "likes": 920,
            "comments": 78,
            "shares": 140,
            "saves": 450,
            "clicks": 810,
            "conversions": 62,
        })

        # 8. Refresh Memory & Verify Multi-Campaign Synthesis
        mem_final = self.client.post("/api/memory/refresh").json()
        health = mem_final["health"]
        self.assertGreaterEqual(health["total_campaigns_analyzed"], 2)
        self.assertGreaterEqual(health["total_insights"], 3)
        self.assertGreaterEqual(health["high_confidence_count"], 1)

        # Verify Story-Led strategy insight was synthesized across campaigns
        strat_ins = next((i for i in mem_final["insights"] if i["category"] == "strategy"), None)
        self.assertIsNotNone(strat_ins)
        self.assertIn(strat_ins["confidence"], ["medium", "high"])
        self.assertGreaterEqual(strat_ins["source_count"], 2)


    # =========================================================================
    # MILESTONE 5 TESTS — MULTI-CHANNEL PUBLISHING & CONTENT CALENDAR SCHEDULING
    # =========================================================================

    def test_51_schedule_approved_content_success(self):
        """Test scheduling an approved content item returns 201 and creates ContentSchedule with scheduled status."""
        content_id = TestBrandForgeWorkflow.pass_content_id
        # Ensure it is audited and approved
        self.client.post(f"/api/content/{content_id}/audit")
        self.client.post(f"/api/content/{content_id}/approve")

        from datetime import datetime, timedelta
        sched_time = (datetime.utcnow() + timedelta(days=2)).isoformat() + "Z"
        payload = {
            "scheduled_at": sched_time,
            "timezone": "Asia/Kolkata",
        }

        res = self.client.post(f"/api/content/{content_id}/schedule", json=payload)
        self.assertEqual(res.status_code, 201)
        data = res.json()
        self.assertEqual(data["campaign_content_id"], content_id)
        self.assertEqual(data["status"], "scheduled")
        self.assertEqual(data["timezone"], "Asia/Kolkata")
        self.assertIsNotNone(data["id"])
        self.assertGreaterEqual(len(data["events"]), 1)
        self.assertEqual(data["events"][-1]["event_type"], "scheduled")

        TestBrandForgeWorkflow.schedule_id = data["id"]

    def test_52_schedule_blocked_for_unapproved_content(self):
        """Test scheduling fails with 400 when content has not received human approval."""
        db = SessionLocal()
        from app.models import CampaignContent
        draft_content = CampaignContent(
            campaign_id=TestBrandForgeWorkflow.campaign_id,
            strategy_id=TestBrandForgeWorkflow.strategy_id,
            platform="instagram",
            content_type="caption",
            title="Unapproved Draft",
            body="Fresh copy not yet approved.",
            approval_status="pending_review",
        )
        db.add(draft_content)
        db.commit()
        draft_id = draft_content.id
        db.close()

        from datetime import datetime, timedelta
        sched_time = (datetime.utcnow() + timedelta(days=1)).isoformat() + "Z"
        res = self.client.post(f"/api/content/{draft_id}/schedule", json={"scheduled_at": sched_time})
        self.assertEqual(res.status_code, 400)
        self.assertIn("must be approved before scheduling", res.json()["detail"])

    def test_53_schedule_blocked_for_failed_or_stale_audit(self):
        """Test scheduling is blocked if content has no current audit or audit status is fail."""
        db = SessionLocal()
        from app.models import CampaignContent
        no_audit_content = CampaignContent(
            campaign_id=TestBrandForgeWorkflow.campaign_id,
            strategy_id=TestBrandForgeWorkflow.strategy_id,
            platform="x",
            content_type="thread",
            title="Approved without audit edge case",
            body="Body text",
            approval_status="approved",
        )
        db.add(no_audit_content)
        db.commit()
        no_audit_id = no_audit_content.id
        db.close()

        from datetime import datetime, timedelta
        sched_time = (datetime.utcnow() + timedelta(days=1)).isoformat() + "Z"
        res = self.client.post(f"/api/content/{no_audit_id}/schedule", json={"scheduled_at": sched_time})
        self.assertEqual(res.status_code, 400)
        self.assertIn("cannot be scheduled without a current BrandGuard audit", res.json()["detail"])

    def test_54_schedule_blocked_for_platform_mismatch(self):
        """Test scheduling is blocked if explicit platform param mismatches content's platform."""
        content_id = TestBrandForgeWorkflow.pass_content_id
        from datetime import datetime, timedelta
        sched_time = (datetime.utcnow() + timedelta(days=1)).isoformat() + "Z"
        res = self.client.post(f"/api/content/{content_id}/schedule", json={
            "scheduled_at": sched_time,
            "platform": "youtube_shorts",  # pass_content is instagram
        })
        self.assertEqual(res.status_code, 400)
        self.assertIn("does not match content platform", res.json()["detail"])

    def test_55_schedule_duplicate_active_schedule_blocked(self):
        """Test scheduling is blocked if an active schedule already exists for the content."""
        content_id = TestBrandForgeWorkflow.pass_content_id
        from datetime import datetime, timedelta
        sched_time = (datetime.utcnow() + timedelta(days=3)).isoformat() + "Z"
        res = self.client.post(f"/api/content/{content_id}/schedule", json={"scheduled_at": sched_time})
        self.assertEqual(res.status_code, 400)
        self.assertIn("already has an active schedule", res.json()["detail"])

    def test_56_get_content_schedule_and_campaign_calendar(self):
        """Test GET /api/content/{content_id}/schedule and GET /api/campaigns/{campaign_id}/calendar."""
        content_id = TestBrandForgeWorkflow.pass_content_id
        campaign_id = TestBrandForgeWorkflow.campaign_id

        # GET content schedule
        res_item = self.client.get(f"/api/content/{content_id}/schedule")
        self.assertEqual(res_item.status_code, 200)
        schedules = res_item.json()
        self.assertGreaterEqual(len(schedules), 1)
        self.assertEqual(schedules[0]["campaign_content_id"], content_id)
        self.assertEqual(schedules[0]["status"], "scheduled")

        # GET campaign calendar
        res_cal = self.client.get(f"/api/campaigns/{campaign_id}/calendar")
        self.assertEqual(res_cal.status_code, 200)
        cal_items = res_cal.json()
        self.assertGreaterEqual(len(cal_items), 1)
        self.assertEqual(cal_items[0]["campaign_id"], campaign_id)

    def test_57_get_global_calendar_with_filters(self):
        """Test GET /api/calendar returns overview with platform and status filter support."""
        res = self.client.get("/api/calendar")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertIn("total_scheduled", data)
        self.assertIn("total_published", data)
        self.assertIn("total_failed", data)
        self.assertIn("total_cancelled", data)
        self.assertIn("items", data)
        self.assertGreaterEqual(len(data["items"]), 1)

        # Filter by platform
        res_filtered = self.client.get("/api/calendar?platform=instagram")
        self.assertEqual(res_filtered.status_code, 200)
        for item in res_filtered.json()["items"]:
            self.assertEqual(item["platform"], "instagram")

        # Filter by status
        res_status = self.client.get("/api/calendar?status=scheduled")
        self.assertEqual(res_status.status_code, 200)
        for item in res_status.json()["items"]:
            self.assertEqual(item["status"], "scheduled")

    def test_58_reschedule_content_updates_time_and_logs_event(self):
        """Test PATCH /api/schedules/{schedule_id} updates scheduled time and appends rescheduled event."""
        schedule_id = TestBrandForgeWorkflow.schedule_id
        from datetime import datetime, timedelta
        new_time = (datetime.utcnow() + timedelta(days=5)).isoformat() + "Z"

        res = self.client.patch(f"/api/schedules/{schedule_id}", json={
            "scheduled_at": new_time,
            "timezone": "UTC",
        })
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data["timezone"], "UTC")

        # Verify event history contains 'rescheduled'
        history_res = self.client.get(f"/api/schedules/{schedule_id}/history")
        self.assertEqual(history_res.status_code, 200)
        events = history_res.json()
        self.assertTrue(any(e["event_type"] == "rescheduled" for e in events))

    def test_59_cancel_schedule_marks_cancelled_and_logs_event(self):
        """Test POST /api/schedules/{schedule_id}/cancel marks schedule cancelled and records event."""
        schedule_id = TestBrandForgeWorkflow.schedule_id
        reason = "Campaign shifted to Q4."
        res = self.client.post(f"/api/schedules/{schedule_id}/cancel", json={"reason": reason})
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data["status"], "cancelled")
        self.assertIsNotNone(data["cancelled_at"])

        # History check
        history_res = self.client.get(f"/api/schedules/{schedule_id}/history")
        self.assertEqual(history_res.status_code, 200)
        events = history_res.json()
        self.assertTrue(any(e["event_type"] == "cancelled" and reason in e["message"] for e in events))

    def test_60_demo_publish_success_generates_synthetic_post_id(self):
        """Test POST /api/schedules/{schedule_id}/publish-demo executes mock publish and generates external post id."""
        content_id = TestBrandForgeWorkflow.pass_content_id
        from datetime import datetime, timedelta
        sched_time = (datetime.utcnow() + timedelta(hours=1)).isoformat() + "Z"
        sched_res = self.client.post(f"/api/content/{content_id}/schedule", json={"scheduled_at": sched_time})
        self.assertEqual(sched_res.status_code, 201)
        new_sched_id = sched_res.json()["id"]

        # Execute demo publish
        res_pub = self.client.post(f"/api/schedules/{new_sched_id}/publish-demo")
        self.assertEqual(res_pub.status_code, 200)
        pub_data = res_pub.json()
        self.assertEqual(pub_data["status"], "published")
        self.assertIsNotNone(pub_data["published_at"])
        self.assertIsNotNone(pub_data["external_post_id"])
        self.assertTrue(pub_data["external_post_id"].startswith("demo_instagram_"))

        # Check events
        events = self.client.get(f"/api/schedules/{new_sched_id}/history").json()
        event_types = [e["event_type"] for e in events]
        self.assertTrue(any(t in event_types for t in ["publish_started", "publishing_started"]))
        self.assertTrue(any(t in event_types for t in ["published", "publish_succeeded"]))

    def test_61_demo_publish_failure_simulation_and_retry(self):
        """Test simulating external publishing failure and subsequent successful retry."""
        # Create a new piece of content for failure simulation
        db = SessionLocal()
        from app.models import CampaignContent
        fail_sim_content = CampaignContent(
            campaign_id=TestBrandForgeWorkflow.campaign_id,
            strategy_id=TestBrandForgeWorkflow.strategy_id,
            platform="linkedin",
            content_type="post",
            title="LinkedIn Rollout",
            body="Precision thoughts for modern creators.",
            approval_status="approved",
        )
        db.add(fail_sim_content)
        db.commit()
        sim_c_id = fail_sim_content.id
        db.close()

        # Audit and approve
        self.client.post(f"/api/content/{sim_c_id}/audit")
        self.client.post(f"/api/content/{sim_c_id}/approve")

        # Schedule
        from datetime import datetime, timedelta
        sched_time = (datetime.utcnow() + timedelta(hours=2)).isoformat() + "Z"
        sched_res = self.client.post(f"/api/content/{sim_c_id}/schedule", json={"scheduled_at": sched_time})
        self.assertEqual(sched_res.status_code, 201)
        sched_id = sched_res.json()["id"]

        # Trigger simulated failure
        res_fail = self.client.post(f"/api/schedules/{sched_id}/publish-demo?simulate_failure=true")
        self.assertEqual(res_fail.status_code, 200)
        fail_data = res_fail.json()
        self.assertEqual(fail_data["status"], "failed")
        self.assertIsNotNone(fail_data["failure_reason"])
        self.assertEqual(fail_data["publish_attempts"], 1)

        # Verify failed event logged
        events = self.client.get(f"/api/schedules/{sched_id}/history").json()
        self.assertTrue(any(e["event_type"] in ["failed", "publish_failed"] for e in events))

        # Retry publishing -> Success
        res_retry = self.client.post(f"/api/schedules/{sched_id}/publish-demo")
        self.assertEqual(res_retry.status_code, 200)
        retry_data = res_retry.json()
        self.assertEqual(retry_data["status"], "published")
        self.assertEqual(retry_data["publish_attempts"], 2)
        self.assertTrue(retry_data["external_post_id"].startswith("demo_linkedin_"))

    def test_62_revision_safety_cancels_active_schedule_and_requires_reapproval(self):
        """Test that editing an approved and scheduled piece of content cancels its active schedule,
        invalidates audit, resets approval to pending_review, and requires full re-audit & re-approval."""
        # 1. Create content
        db = SessionLocal()
        from app.models import CampaignContent
        safe_content = CampaignContent(
            campaign_id=TestBrandForgeWorkflow.campaign_id,
            strategy_id=TestBrandForgeWorkflow.strategy_id,
            platform="x",
            content_type="thread",
            title="Safe Revision Thread",
            body="Thread before editorial revision.",
            approval_status="approved",
        )
        db.add(safe_content)
        db.commit()
        s_id = safe_content.id
        db.close()

        # 2. Audit & Approve
        self.client.post(f"/api/content/{s_id}/audit")
        self.client.post(f"/api/content/{s_id}/approve")

        # 3. Schedule Content
        from datetime import datetime, timedelta
        sched_time = (datetime.utcnow() + timedelta(days=2)).isoformat() + "Z"
        sched_res = self.client.post(f"/api/content/{s_id}/schedule", json={"scheduled_at": sched_time})
        self.assertEqual(sched_res.status_code, 201)
        schedule_id = sched_res.json()["id"]
        self.assertEqual(sched_res.json()["status"], "scheduled")

        # 4. Human creates Revision 2
        rev_res = self.client.post(f"/api/content/{s_id}/revisions", json={
            "body": "Revised thread with new hooks.",
            "revision_reason": "Editorial revision of claims.",
        })
        self.assertEqual(rev_res.status_code, 201)

        # 5. Check that active schedule was automatically cancelled
        sched_check = self.client.get(f"/api/schedules/{schedule_id}/history")
        self.assertEqual(sched_check.status_code, 200)
        events = sched_check.json()
        self.assertTrue(any(e["event_type"] == "cancelled" and "Content revised" in e["message"] for e in events))

        # Check schedule status
        db = SessionLocal()
        from app.models import ContentSchedule
        db_sched = db.query(ContentSchedule).filter(ContentSchedule.id == schedule_id).first()
        self.assertEqual(db_sched.status, "cancelled")
        db.close()

        # 6. Attempting to schedule immediately -> Blocked (unapproved)
        res_block = self.client.post(f"/api/content/{s_id}/schedule", json={"scheduled_at": sched_time})
        self.assertEqual(res_block.status_code, 400)

        # 7. Re-audit and Re-approve
        self.client.post(f"/api/content/{s_id}/audit")
        self.client.post(f"/api/content/{s_id}/approve")

        # 8. Re-schedule -> Success
        res_resched = self.client.post(f"/api/content/{s_id}/schedule", json={"scheduled_at": sched_time})
        self.assertEqual(res_resched.status_code, 201)
        self.assertEqual(res_resched.json()["status"], "scheduled")

    def test_63_end_to_end_governance_to_publishing_pipeline(self):
        """Test complete pipeline from Campaign Strategy to Content Studio, BrandGuard, Human Approval,
        Calendar Scheduling, and Demo Multi-Channel Publication Execution."""
        # 1. Create new Campaign
        camp_res = self.client.post("/api/campaigns", json={
            "name": "Winter Pinnacle 2024",
            "product_name": "Arkiva Pro Suite",
            "objective": "Brand Awareness",
            "duration": "2 weeks",
            "message": "Next-generation creative workstations.",
            "platforms": ["Instagram", "LinkedIn", "YouTube Shorts"],
        })
        self.assertEqual(camp_res.status_code, 201)
        c_id = camp_res.json()["id"]

        # 2. Generate strategies
        strats = self.client.post(f"/api/campaigns/{c_id}/generate-strategies").json()
        selected_strat = strats[0]
        self.client.patch(f"/api/campaigns/{c_id}/strategies/{selected_strat['id']}/select", json={"is_selected": True})

        # 3. Generate Multi-Platform Content
        contents = self.client.post(f"/api/campaigns/{c_id}/content/generate", json={
            "strategy_id": selected_strat["id"],
            "platforms": ["instagram", "linkedin", "youtube_shorts"],
        }).json()
        self.assertEqual(len(contents), 3)

        # 4. BrandGuard Audit for each content
        for item in contents:
            audit_res = self.client.post(f"/api/content/{item['id']}/audit")
            self.assertEqual(audit_res.status_code, 200)

            # If warning or pass, approve directly; if fail, revise first
            if audit_res.json()["overall_status"] == "fail":
                self.client.post(f"/api/content/{item['id']}/revisions", json={
                    "body": "Compliant copy for creative professionals.",
                    "revision_reason": "Policy alignment",
                })
                self.client.post(f"/api/content/{item['id']}/audit")

            app_res = self.client.post(f"/api/content/{item['id']}/approve")
            self.assertEqual(app_res.status_code, 200)

        # 5. Schedule each content item across calendar timeline
        from datetime import datetime, timedelta
        schedules = []
        for i, item in enumerate(contents):
            sched_time = (datetime.utcnow() + timedelta(days=i + 1, hours=19)).isoformat() + "Z"
            s_res = self.client.post(f"/api/content/{item['id']}/schedule", json={
                "scheduled_at": sched_time,
                "timezone": "Asia/Kolkata",
            })
            self.assertEqual(s_res.status_code, 201)
            schedules.append(s_res.json())

        self.assertEqual(len(schedules), 3)

        # 6. Verify Campaign Calendar items
        cal_items = self.client.get(f"/api/campaigns/{c_id}/calendar").json()
        self.assertEqual(len(cal_items), 3)

        # 7. Execute demo publish for first schedule
        pub_res = self.client.post(f"/api/schedules/{schedules[0]['id']}/publish-demo")
        self.assertEqual(pub_res.status_code, 200)
        self.assertEqual(pub_res.json()["status"], "published")
        self.assertTrue(pub_res.json()["external_post_id"].startswith(f"demo_{schedules[0]['platform']}_"))

        # 8. Verify global calendar reflects updated metrics
        global_cal = self.client.get("/api/calendar").json()
        self.assertGreaterEqual(global_cal["total_published"], 1)

    def test_64_migration_idempotence(self):
        """Verify that running run_migrations multiple times is completely idempotent."""
        from app.migrations import run_migrations
        # Running once
        run_migrations(engine)
        # Running second time
        run_migrations(engine)
        # Verify health check and existing data are intact
        res = self.client.get("/api/health")
        self.assertEqual(res.status_code, 200)

    def test_65_migration_backfill_and_schema_recovery(self):
        """Verify migration automatically adds missing columns and backfills existing rows without data loss."""
        from sqlalchemy import create_engine as create_sqla_engine, text
        import tempfile, os
        from app.migrations import run_migrations

        temp_db = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
        temp_db.close()
        temp_url = f"sqlite:///{temp_db.name}"
        temp_eng = create_sqla_engine(temp_url)

        try:
            # 1. Create a legacy table without Milestone 3C columns
            with temp_eng.begin() as conn:
                conn.execute(text("""
                    CREATE TABLE campaign_contents (
                        id VARCHAR(36) PRIMARY KEY,
                        campaign_id VARCHAR(36) NOT NULL,
                        strategy_id VARCHAR(36) NOT NULL,
                        platform VARCHAR(50) NOT NULL,
                        content_type VARCHAR(50),
                        title VARCHAR(255),
                        body TEXT NOT NULL,
                        hook TEXT,
                        call_to_action TEXT,
                        visual_concept TEXT,
                        metadata_info JSON,
                        created_at DATETIME
                    );
                """))
                # Insert legacy row
                conn.execute(text("""
                    INSERT INTO campaign_contents (id, campaign_id, strategy_id, platform, body)
                    VALUES ('legacy-1', 'camp-1', 'strat-1', 'linkedin', 'Legacy post copy');
                """))

            # 2. Run migration on the legacy database
            run_migrations(temp_eng)

            # 3. Verify columns were added and backfilled
            with temp_eng.begin() as conn:
                res = conn.execute(text("SELECT id, approval_status, revision_number, body FROM campaign_contents WHERE id = 'legacy-1'")).fetchone()
                self.assertIsNotNone(res)
                self.assertEqual(res[0], 'legacy-1')
                self.assertEqual(res[1], 'pending_review')  # Backfilled default
                self.assertEqual(res[2], 1)                 # Backfilled revision number
                self.assertEqual(res[3], 'Legacy post copy') # Preserved existing body
        finally:
            temp_eng.dispose()
            if os.path.exists(temp_db.name):
                os.remove(temp_db.name)

    def test_66_analytics_rate_calculations_and_zero_safety(self):
        """Verify analytics rate calculations are accurate and safe against division by zero."""
        from app.services.analytics_service import (
            calc_engagement_rate,
            calc_click_through_rate,
            calc_conversion_rate,
            calc_save_rate,
            calc_share_rate,
        )

        # Normal calculations
        self.assertEqual(calc_engagement_rate(likes=400, comments=50, shares=50, saves=100, reach=8000), 7.5)
        self.assertEqual(calc_click_through_rate(clicks=500, impressions=10000), 5.0)
        self.assertEqual(calc_conversion_rate(conversions=50, clicks=500), 10.0)
        self.assertEqual(calc_save_rate(saves=100, reach=8000), 1.25)
        self.assertEqual(calc_share_rate(shares=50, reach=8000), 0.62)

        # Zero-division safety
        self.assertEqual(calc_engagement_rate(likes=100, comments=10, shares=5, saves=5, reach=0), 0.0)
        self.assertEqual(calc_click_through_rate(clicks=50, impressions=0), 0.0)
        self.assertEqual(calc_conversion_rate(conversions=10, clicks=0), 0.0)
        self.assertEqual(calc_save_rate(saves=20, reach=0), 0.0)
        self.assertEqual(calc_share_rate(shares=15, reach=0), 0.0)

    def test_67_analytics_metric_validation(self):
        """Verify analytics validation engine catches invalid inputs and allows valid data."""
        from app.services.analytics_service import validate_performance_metrics

        # Valid payload - should not raise
        try:
            validate_performance_metrics(
                impressions=1000,
                reach=800,
                likes=40,
                comments=5,
                shares=5,
                saves=10,
                clicks=50,
                conversions=5,
            )
        except ValueError:
            self.fail("validate_performance_metrics raised ValueError unexpectedly on valid input!")

        # Negative value error
        with self.assertRaises(ValueError) as ctx:
            validate_performance_metrics(
                impressions=-10, reach=0, likes=0, comments=0, shares=0, saves=0, clicks=0, conversions=0
            )
        self.assertIn("cannot be negative", str(ctx.exception))

        # Clicks > impressions error
        with self.assertRaises(ValueError) as ctx:
            validate_performance_metrics(
                impressions=100, reach=80, likes=0, comments=0, shares=0, saves=0, clicks=200, conversions=0
            )
        self.assertIn("cannot exceed impressions", str(ctx.exception))

        # Conversions > clicks error
        with self.assertRaises(ValueError) as ctx:
            validate_performance_metrics(
                impressions=1000, reach=800, likes=0, comments=0, shares=0, saves=0, clicks=50, conversions=60
            )
        self.assertIn("cannot exceed clicks", str(ctx.exception))

        # Reach > impressions error
        with self.assertRaises(ValueError) as ctx:
            validate_performance_metrics(
                impressions=500, reach=600, likes=0, comments=0, shares=0, saves=0, clicks=0, conversions=0
            )
        self.assertIn("cannot exceed impressions", str(ctx.exception))

    def test_68_post_content_performance_and_rates(self):
        """Verify submitting performance data for a content item calculates rates and persists."""
        # 1. Create a campaign and content
        c_res = self.client.post("/api/campaigns", json={
            "name": "Analytics Test Campaign",
            "product_name": "Arkiva Pro Suite",
            "objective": "Sales & Conversions",
            "audience": "Freelance Creators",
            "duration": "2 weeks",
            "message": "Scale your design output.",
            "instructions": "Data-driven",
            "platforms": ["instagram", "linkedin"],
        })
        self.assertEqual(c_res.status_code, 201)
        c_id = c_res.json()["id"]

        strats = self.client.post(f"/api/campaigns/{c_id}/generate-strategies").json()
        strat_id = strats[0]["id"]
        self.client.patch(f"/api/campaigns/{c_id}/strategies/{strat_id}/select", json={"is_selected": True})

        contents = self.client.post(f"/api/campaigns/{c_id}/content/generate", json={
            "strategy_id": strat_id,
            "platforms": ["linkedin"],
        }).json()
        content_id = contents[0]["id"]

        # 2. Post performance metrics
        perf_payload = {
            "impressions": 10000,
            "reach": 8000,
            "likes": 400,
            "comments": 50,
            "shares": 50,
            "saves": 100,
            "clicks": 500,
            "conversions": 50,
        }
        p_res = self.client.post(f"/api/content/{content_id}/performance", json=perf_payload)
        self.assertEqual(p_res.status_code, 201)
        p_data = p_res.json()

        self.assertEqual(p_data["campaign_content_id"], content_id)
        self.assertEqual(p_data["campaign_id"], c_id)
        self.assertEqual(p_data["platform"], "linkedin")
        self.assertEqual(p_data["impressions"], 10000)
        self.assertEqual(p_data["clicks"], 500)
        self.assertEqual(p_data["engagement_rate"], 7.5)
        self.assertEqual(p_data["conversion_rate"], 10.0)

    def test_69_post_performance_validation_errors(self):
        """Verify API returns 400/422 Bad Request when performance metrics violate business rules."""
        # Create campaign and content
        c_res = self.client.post("/api/campaigns", json={
            "name": "Validation Error Test Campaign",
            "product_name": "Arkiva Pro Suite",
            "objective": "Brand Awareness",
            "audience": "Enterprise Leads",
            "duration": "1 week",
            "message": "Enterprise grade workflow.",
            "instructions": "Professional",
            "platforms": ["linkedin"],
        })
        c_id = c_res.json()["id"]

        # 1. Negative clicks
        bad_res1 = self.client.post(f"/api/campaigns/{c_id}/performance", json={
            "platform": "linkedin",
            "impressions": 1000,
            "clicks": -5,
        })
        self.assertEqual(bad_res1.status_code, 400)


        # 2. Clicks > Impressions
        bad_res2 = self.client.post(f"/api/campaigns/{c_id}/performance", json={
            "platform": "linkedin",
            "impressions": 100,
            "clicks": 200,
        })
        self.assertEqual(bad_res2.status_code, 400)
        self.assertIn("cannot exceed impressions", bad_res2.json()["detail"])

        # 3. Conversions > Clicks
        bad_res3 = self.client.post(f"/api/campaigns/{c_id}/performance", json={
            "platform": "linkedin",
            "impressions": 1000,
            "clicks": 10,
            "conversions": 25,
        })
        self.assertEqual(bad_res3.status_code, 400)
        self.assertIn("cannot exceed clicks", bad_res3.json()["detail"])

    def test_70_get_content_analytics(self):
        """Verify GET /api/content/{id}/analytics returns detailed content performance."""
        # 1. Setup campaign + content
        c_res = self.client.post("/api/campaigns", json={
            "name": "Content Analytics Campaign",
            "product_name": "Arkiva Pro Suite",
            "objective": "Lead Gen",
            "audience": "Designers",
            "duration": "1 week",
            "message": "Creative clarity.",
            "instructions": "Concise",
            "platforms": ["instagram"],
        })
        c_id = c_res.json()["id"]
        strats = self.client.post(f"/api/campaigns/{c_id}/generate-strategies").json()
        strat_id = strats[0]["id"]
        self.client.patch(f"/api/campaigns/{c_id}/strategies/{strat_id}/select", json={"is_selected": True})

        contents = self.client.post(f"/api/campaigns/{c_id}/content/generate", json={
            "strategy_id": strat_id,
            "platforms": ["instagram"],
        }).json()
        content_id = contents[0]["id"]

        # Add performance entry
        self.client.post(f"/api/content/{content_id}/performance", json={
            "impressions": 5000,
            "reach": 4000,
            "likes": 300,
            "comments": 20,
            "shares": 30,
            "saves": 50,
            "clicks": 250,
            "conversions": 20,
        })

        # Query analytics
        a_res = self.client.get(f"/api/content/{content_id}/analytics")
        self.assertEqual(a_res.status_code, 200)
        data = a_res.json()
        self.assertEqual(data["content_id"], content_id)
        self.assertEqual(data["platform"], "instagram")
        self.assertIsNotNone(data["performance"])
        self.assertEqual(data["performance"]["impressions"], 5000)
        self.assertEqual(data["calculated_rates"]["click_through_rate"], 5.0)

    def test_71_post_campaign_performance_and_aggregations(self):
        """Verify submitting campaign-level performance and querying campaign analytics."""
        c_res = self.client.post("/api/campaigns", json={
            "name": "Campaign Aggregations Test",
            "product_name": "Arkiva Pro Suite",
            "objective": "Conversions",
            "audience": "Architects",
            "duration": "3 weeks",
            "message": "Design studio workflows.",
            "instructions": "Professional tone",
            "platforms": ["linkedin", "x"],
        })
        c_id = c_res.json()["id"]

        # Add linkedin performance
        self.client.post(f"/api/campaigns/{c_id}/performance", json={
            "platform": "linkedin",
            "impressions": 12000,
            "reach": 9500,
            "likes": 450,
            "comments": 40,
            "shares": 30,
            "saves": 80,
            "clicks": 600,
            "conversions": 60,
        })

        # Add X performance
        self.client.post(f"/api/campaigns/{c_id}/performance", json={
            "platform": "x",
            "impressions": 8000,
            "reach": 7000,
            "likes": 200,
            "comments": 30,
            "shares": 50,
            "saves": 20,
            "clicks": 320,
            "conversions": 20,
        })

        # Query Campaign Analytics
        res = self.client.get(f"/api/campaigns/{c_id}/analytics")
        self.assertEqual(res.status_code, 200)
        data = res.json()

        self.assertEqual(data["campaign_id"], c_id)
        self.assertEqual(data["kpis"]["total_impressions"], 20000)
        self.assertEqual(data["kpis"]["total_clicks"], 920)
        self.assertEqual(data["kpis"]["total_conversions"], 80)
        platforms = [p["platform"] for p in data["platforms"]]
        self.assertIn("linkedin", platforms)
        self.assertIn("x", platforms)

    def test_72_demo_seed_analytics(self):
        """Verify POST /api/analytics/demo-seed injects realistic deterministic demo data."""
        seed_res = self.client.post("/api/analytics/demo-seed", json={})
        self.assertEqual(seed_res.status_code, 200)
        s_data = seed_res.json()
        self.assertEqual(s_data["status"], "success")
        self.assertGreaterEqual(s_data["records_created"], 1)

        # Verify global analytics now has sufficient data for trend chart
        res = self.client.get("/api/analytics")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertTrue(data["has_sufficient_data"])
        self.assertGreaterEqual(len(data["trends"]), 2)
        self.assertGreaterEqual(len(data["insights"]), 1)

    def test_73_global_analytics_and_filtering(self):
        """Verify global analytics dashboard supports platform and date range filtering."""
        # Unfiltered
        all_res = self.client.get("/api/analytics")
        self.assertEqual(all_res.status_code, 200)
        all_data = all_res.json()
        self.assertIn("kpis", all_data)
        self.assertIn("platforms", all_data)
        self.assertIn("leaderboard", all_data)
        self.assertIn("insights", all_data)
        self.assertIn("recommendations", all_data)

        # Filter by platform
        ig_res = self.client.get("/api/analytics?platform=instagram")
        self.assertEqual(ig_res.status_code, 200)
        ig_data = ig_res.json()
        for p in ig_data["platforms"]:
            self.assertEqual(p["platform"], "instagram")

        # Filter by date range
        range_res = self.client.get("/api/analytics?date_range=30d")
        self.assertEqual(range_res.status_code, 200)

    def test_74_continuous_optimization_recommendations(self):
        """Verify Continuous Optimization Engine generates structured, actionable recommendations."""
        opt_res = self.client.get("/api/optimization/recommendations")
        self.assertEqual(opt_res.status_code, 200)
        recs = opt_res.json()
        self.assertIsInstance(recs, list)
        self.assertGreaterEqual(len(recs), 2)

        first_rec = recs[0]
        self.assertIn("id", first_rec)
        self.assertIn("category", first_rec)
        self.assertIn("title", first_rec)
        self.assertIn("recommendation", first_rec)
        self.assertIn("reason", first_rec)
        self.assertIn("evidence", first_rec)
        self.assertIn("confidence", first_rec)
        self.assertIn("suggested_instructions", first_rec)

    def test_75_campaign_memory_performance_learnings(self):
        """Verify Campaign Memory captures and exposes performance learnings alongside governance insights."""
        mem_res = self.client.get("/api/memory")
        self.assertEqual(mem_res.status_code, 200)
        mem_data = mem_res.json()

        # Check existing governance insight structures are preserved
        self.assertIn("insights", mem_data)
        self.assertIn("governance_learnings", mem_data)
        self.assertIn("approval_learnings", mem_data)

        # Check performance learnings
        self.assertIn("performance_learnings", mem_data)
        perf_learnings = mem_data["performance_learnings"]
        self.assertIsInstance(perf_learnings, list)
        if len(perf_learnings) > 0:
            first_learning = perf_learnings[0]
            self.assertIn("signal_type", first_learning)
            self.assertIn("category", first_learning)
            self.assertIn("observation", first_learning)
            self.assertIn("recommendation", first_learning)
            self.assertIn("confidence", first_learning)

    def test_76_end_to_end_continuous_optimization_loop(self):
        """
        Verify the complete Continuous Optimization closed-loop lifecycle:
        1. Brand DNA -> Campaign Creation
        2. Multi-Strategy Generation & Selection
        3. Multi-Platform Content Generation
        4. BrandGuard + ClaimGuard Governance Audits
        5. Human Approval Workflow & Revision Check
        6. Content Calendar Scheduling
        7. Demo Publishing
        8. Empirical Performance Metrics Ingestion & Validation
        9. Omnichannel Analytics Aggregation & Optimization Engine
        10. Campaign Memory Cross-Campaign Learnings Ingestion
        """
        # Step 1: Create Campaign
        c_res = self.client.post("/api/campaigns", json={
            "name": "Full Loop Continuous Campaign",
            "product_name": "Arkiva Pro Suite",
            "objective": "Conversions & Retention",
            "audience": "Senior Designers & Studio Leads",
            "duration": "4 weeks",
            "message": "Enterprise grade creative workflows.",
            "instructions": "Authoritative and precise",
            "platforms": ["linkedin", "instagram", "x"],
        })
        self.assertEqual(c_res.status_code, 201)
        c_id = c_res.json()["id"]

        # Step 2: Generate & Select Strategy
        strats = self.client.post(f"/api/campaigns/{c_id}/generate-strategies").json()
        self.assertGreaterEqual(len(strats), 3)
        selected_strat = strats[0]
        self.client.patch(f"/api/campaigns/{c_id}/strategies/{selected_strat['id']}/select", json={"is_selected": True})

        # Step 3: Multi-Platform Content Generation
        contents = self.client.post(f"/api/campaigns/{c_id}/content/generate", json={
            "strategy_id": selected_strat["id"],
            "platforms": ["linkedin", "instagram", "x"],
        }).json()
        self.assertEqual(len(contents), 3)

        # Step 4: BrandGuard + ClaimGuard Audits
        for item in contents:
            audit_res = self.client.post(f"/api/content/{item['id']}/audit")
            self.assertEqual(audit_res.status_code, 200)

            # Step 5: Human Approval (Revise if needed, then approve)
            if audit_res.json()["overall_status"] == "fail":
                self.client.post(f"/api/content/{item['id']}/revisions", json={
                    "body": "Verified compliant copy for creative workflows.",
                    "revision_reason": "Policy alignment",
                })
                self.client.post(f"/api/content/{item['id']}/audit")

            app_res = self.client.post(f"/api/content/{item['id']}/approve")
            self.assertEqual(app_res.status_code, 200)
            self.assertEqual(app_res.json()["approval_status"], "approved")

        # Step 6: Content Calendar Scheduling
        from datetime import datetime, timedelta, timezone
        schedules = []
        for i, item in enumerate(contents):
            sched_time = (datetime.now(timezone.utc) + timedelta(days=i + 1, hours=10)).isoformat()
            s_res = self.client.post(f"/api/content/{item['id']}/schedule", json={
                "scheduled_at": sched_time,
                "timezone": "Asia/Kolkata",
            })
            self.assertEqual(s_res.status_code, 201)
            schedules.append(s_res.json())

        # Step 7: Demo Publishing
        pub_res = self.client.post(f"/api/schedules/{schedules[0]['id']}/publish-demo")
        self.assertEqual(pub_res.status_code, 200)
        self.assertEqual(pub_res.json()["status"], "published")

        # Step 8: Empirical Performance Metrics Ingestion & Validation
        p_res = self.client.post(f"/api/content/{contents[0]['id']}/performance", json={
            "impressions": 15000,
            "reach": 12000,
            "likes": 650,
            "comments": 75,
            "shares": 60,
            "saves": 120,
            "clicks": 900,
            "conversions": 90,
        })
        self.assertEqual(p_res.status_code, 201)
        self.assertEqual(p_res.json()["conversion_rate"], 10.0)

        # Step 9: Omnichannel Analytics & Optimization Engine
        camp_analytics = self.client.get(f"/api/campaigns/{c_id}/analytics").json()
        self.assertGreaterEqual(camp_analytics["kpis"]["total_impressions"], 15000)
        self.assertGreaterEqual(camp_analytics["kpis"]["total_clicks"], 900)

        opt_recs = self.client.get("/api/optimization/recommendations").json()
        self.assertGreaterEqual(len(opt_recs), 2)
        self.assertTrue(any(rec["confidence"] in ["high", "medium", "low"] for rec in opt_recs))

        # Step 10: Campaign Memory Cross-Campaign Learnings Ingestion
        mem = self.client.get("/api/memory").json()
        self.assertIn("performance_learnings", mem)

    def test_77_strategy_selection_using_persisted_uuid_regression(self):
        """
        Regression Test for Strategy Selection Contract:
        1. Create a campaign.
        2. Generate the campaign's strategies.
        3. Retrieve the strategies.
        4. Confirm each generated strategy has its persisted UUID.
        5. Select one strategy using its persisted ID.
        6. Confirm the request succeeds.
        7. Confirm the selected strategy is persisted.
        8. Confirm the strategy can subsequently be retrieved as selected.
        9. Confirm the system does not depend on 'story' being the database ID.
        10. Test switching to Product-Led and Community-Led by persisted UUID.
        """
        # 1. Create a campaign
        c_res = self.client.post("/api/campaigns", json={
            "name": "Strategy Selection Regression Campaign",
            "product_name": "Arkiva Pro Suite",
            "objective": "Brand Awareness",
            "audience": "Creative Directors",
            "duration": "4 weeks",
            "message": "Design with unparalleled clarity.",
            "instructions": "Calm, confident",
            "platforms": ["instagram", "linkedin", "x"],
        })
        self.assertEqual(c_res.status_code, 201)
        campaign_id = c_res.json()["id"]

        # 2. Generate strategies
        gen_res = self.client.post(f"/api/campaigns/{campaign_id}/generate-strategies")
        self.assertEqual(gen_res.status_code, 200)
        strategies = gen_res.json()
        self.assertEqual(len(strategies), 3)

        # 3. Retrieve strategies
        get_res = self.client.get(f"/api/campaigns/{campaign_id}/strategies")
        self.assertEqual(get_res.status_code, 200)
        retrieved_strats = get_res.json()
        self.assertEqual(len(retrieved_strats), 3)

        # 4. Confirm each generated strategy has its persisted UUID (valid length and not equal to type slug)
        for s in retrieved_strats:
            self.assertTrue(len(s["id"]) > 10)
            self.assertNotEqual(s["id"], s["strategy_type"])
            self.assertEqual(s["campaign_id"], campaign_id)

        # Find Story-Led strategy
        story_strat = next(s for s in retrieved_strats if s["strategy_type"] == "story")
        story_uuid = story_strat["id"]
        self.assertNotEqual(story_uuid, "story")

        # 5. Select strategy using its persisted UUID
        patch_res = self.client.patch(
            f"/api/campaigns/{campaign_id}/strategies/{story_uuid}/select",
            json={"is_selected": True},
        )
        # 6. Confirm request succeeds
        self.assertEqual(patch_res.status_code, 200)
        # 7. Confirm selected strategy is marked is_selected
        self.assertTrue(patch_res.json()["is_selected"])
        self.assertEqual(patch_res.json()["id"], story_uuid)

        # 8. Confirm strategy can subsequently be retrieved as selected
        verify_res = self.client.get(f"/api/campaigns/{campaign_id}/strategies")
        self.assertEqual(verify_res.status_code, 200)
        all_strats = verify_res.json()
        selected_strat = next(s for s in all_strats if s["is_selected"])
        self.assertEqual(selected_strat["id"], story_uuid)
        self.assertEqual(selected_strat["strategy_type"], "story")

        # 9. Verify switching to Product-Led using its persisted UUID
        product_strat = next(s for s in all_strats if s["strategy_type"] == "product")
        prod_uuid = product_strat["id"]
        prod_patch = self.client.patch(
            f"/api/campaigns/{campaign_id}/strategies/{prod_uuid}/select",
            json={"is_selected": True},
        )
        self.assertEqual(prod_patch.status_code, 200)
        self.assertTrue(prod_patch.json()["is_selected"])
        self.assertEqual(prod_patch.json()["id"], prod_uuid)

        # Verify only Product-Led is now selected
        verify_prod = self.client.get(f"/api/campaigns/{campaign_id}/strategies").json()
        self.assertTrue(next(s for s in verify_prod if s["id"] == prod_uuid)["is_selected"])
        self.assertFalse(next(s for s in verify_prod if s["id"] == story_uuid)["is_selected"])

        # 10. Verify switching to Community-Led using its persisted UUID
        comm_strat = next(s for s in all_strats if s["strategy_type"] == "community")
        comm_uuid = comm_strat["id"]
        comm_patch = self.client.patch(
            f"/api/campaigns/{campaign_id}/strategies/{comm_uuid}/select",
            json={"is_selected": True},
        )
        self.assertEqual(comm_patch.status_code, 200)
        self.assertTrue(comm_patch.json()["is_selected"])
        self.assertEqual(comm_patch.json()["id"], comm_uuid)

    def test_78_content_repurposing_flow(self):
        """Verify multi-channel content repurposing, adaptation, persistence, and governance routing."""
        # 1. Setup campaign + strategy + initial content
        c_res = self.client.post("/api/campaigns", json={
            "name": "Repurposing Demo Campaign",
            "product_name": "Arkiva Pro Suite",
            "objective": "Engagement",
            "audience": "Creators and Art Directors",
            "duration": "2 weeks",
            "message": "Transforming creative operations.",
            "platforms": ["linkedin"],
        })
        c_id = c_res.json()["id"]
        strats = self.client.post(f"/api/campaigns/{c_id}/generate-strategies").json()
        strat_id = strats[0]["id"]
        self.client.patch(f"/api/campaigns/{c_id}/strategies/{strat_id}/select", json={"is_selected": True})

        init_contents = self.client.post(f"/api/campaigns/{c_id}/content/generate", json={
            "strategy_id": strat_id,
            "platforms": ["linkedin"],
        }).json()
        self.assertEqual(len(init_contents), 1)
        hero_content = init_contents[0]

        # 2. Test global repurpose endpoint with custom hero text
        custom_repurpose_res = self.client.post("/api/content/repurpose", json={
            "source_title": "10x Design Velocity",
            "source_text": "We analyzed 500 design sprints and found that 40% of time was wasted in manual resizing. Arkiva Pro eliminates this.",
            "source_platform": "blog",
            "target_platforms": ["x", "youtube_shorts"],
            "save_to_campaign": False,
        })
        self.assertEqual(custom_repurpose_res.status_code, 200)
        custom_data = custom_repurpose_res.json()
        self.assertEqual(custom_data["source_title"], "10x Design Velocity")
        self.assertEqual(len(custom_data["items"]), 2)
        target_platforms = {item["platform"] for item in custom_data["items"]}
        self.assertEqual(target_platforms, {"x", "youtube_shorts"})

        # 3. Test campaign repurpose endpoint using existing source_content_id and save_to_campaign=True
        camp_repurpose_res = self.client.post(f"/api/campaigns/{c_id}/content/repurpose", json={
            "source_content_id": hero_content["id"],
            "target_platforms": ["instagram", "x", "youtube_shorts"],
            "save_to_campaign": True,
        })
        self.assertEqual(camp_repurpose_res.status_code, 200)
        camp_repurpose_data = camp_repurpose_res.json()
        self.assertEqual(len(camp_repurpose_data["items"]), 3)

        # 4. Verify newly generated derivatives are persisted into SQLite CampaignContent
        db_contents = self.client.get(f"/api/campaigns/{c_id}/content").json()
        repurposed_items = [c for c in db_contents if c["metadata_info"].get("repurposed")]
        self.assertEqual(len(repurposed_items), 3)

        # 5. Verify BrandGuard audit on a repurposed item
        repurposed_x = next(c for c in repurposed_items if c["platform"] == "x")
        audit_res = self.client.post(f"/api/content/{repurposed_x['id']}/audit")
        self.assertEqual(audit_res.status_code, 200)
        audit_data = audit_res.json()
        self.assertIn(audit_data["overall_status"], ["pass", "warning", "fail"])

        # 6. Verify Human Approval workflow routing on repurposed item
        submit_res = self.client.post(f"/api/content/{repurposed_x['id']}/submit-review")
        self.assertEqual(submit_res.status_code, 200)
        self.assertEqual(submit_res.json()["approval_status"], "pending_review")

        approve_res = self.client.post(f"/api/content/{repurposed_x['id']}/approve")
        self.assertEqual(approve_res.status_code, 200)
        self.assertEqual(approve_res.json()["approval_status"], "approved")

        # 7. Test error cases
        bad_empty = self.client.post("/api/content/repurpose", json={
            "source_text": "",
            "target_platforms": ["x"],
        })
        self.assertEqual(bad_empty.status_code, 400)

        bad_platforms = self.client.post("/api/content/repurpose", json={
            "source_text": "Sample text",
            "target_platforms": ["invalid_platform"],
        })
        self.assertEqual(bad_platforms.status_code, 400)

    def test_79_system_settings_endpoints(self):
        """Verify System Settings GET and PUT endpoints."""
        # 1. GET system settings
        get_res = self.client.get("/api/system/settings")
        self.assertEqual(get_res.status_code, 200)
        data = get_res.json()

        self.assertIn("brand", data)
        self.assertEqual(data["database_engine"], "SQLite (Local File Storage)")
        self.assertEqual(data["ai_model"], "Google Gemini 2.5 Flash")
        self.assertEqual(data["default_timezone"], "Asia/Kolkata")

        # Verify governance policies
        self.assertTrue(len(data["governance_policies"]) >= 4)
        policy_ids = [p["id"] for p in data["governance_policies"]]
        self.assertIn("brand_voice", policy_ids)
        self.assertIn("claim_guard", policy_ids)
        self.assertIn("do_dont", policy_ids)

        # Verify demo publishing channels
        self.assertEqual(len(data["publishing_channels"]), 4)
        for channel in data["publishing_channels"]:
            self.assertTrue(channel["is_simulator"])
            self.assertIn("Ready (Synthetic Driver)", channel["status"])

        # 2. PUT system settings to update brand properties
        update_res = self.client.put("/api/system/settings", json={
            "brand_name": "Arkiva Studio Enterprise",
            "tagline": '"Elevating creative operations at scale."',
            "stage": "Enterprise Growth",
        })
        self.assertEqual(update_res.status_code, 200)
        updated_data = update_res.json()
        self.assertEqual(updated_data["brand"]["name"], "Arkiva Studio Enterprise")
        self.assertEqual(updated_data["brand"]["tagline"], '"Elevating creative operations at scale."')
        self.assertEqual(updated_data["brand"]["stage"], "Enterprise Growth")


if __name__ == "__main__":
    unittest.main()










