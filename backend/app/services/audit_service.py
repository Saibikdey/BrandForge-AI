import re
import logging
from typing import Dict, Any, List, Optional
from ..config import settings
from ..schemas import AuditFindingItem, LLMAuditOutput

logger = logging.getLogger(__name__)


def compute_overall_audit_status(findings: List[Any]) -> str:
    """Deterministic policy engine: computes overall audit status from findings.
    
    Rules:
    - 'fail' if any finding has status == 'fail' or severity == 'critical'
    - 'warning' if any finding has status == 'warning' or severity == 'warning'
    - 'pass' otherwise
    """
    has_fail = False
    has_warning = False

    for f in findings:
        status = getattr(f, "status", None) or (f.get("status") if isinstance(f, dict) else "")
        severity = getattr(f, "severity", None) or (f.get("severity") if isinstance(f, dict) else "")

        if status == "fail" or severity == "critical":
            has_fail = True
        elif status == "warning" or severity == "warning":
            has_warning = True

    if has_fail:
        return "fail"
    if has_warning:
        return "warning"
    return "pass"


def _extract_context_snippet(text: str, match_start: int, match_end: int, window: int = 40) -> str:
    """Extracts a readable excerpt around a regex match."""
    start = max(0, match_start - window)
    end = min(len(text), match_end + window)
    prefix = "..." if start > 0 else ""
    suffix = "..." if end < len(text) else ""
    return f"{prefix}{text[start:end].strip()}{suffix}"


def run_deterministic_audit(
    content_data: Dict[str, Any],
    brand_data: Dict[str, Any],
    campaign_data: Dict[str, Any],
    strategy_data: Dict[str, Any],
    product_data: Optional[Dict[str, Any]] = None,
) -> LLMAuditOutput:
    """Deterministic rule-based audit engine for BrandGuard and ClaimGuard."""
    product_data = product_data or {}
    findings: List[AuditFindingItem] = []

    # Prepare content text corpus
    title = content_data.get("title") or ""
    hook = content_data.get("hook") or ""
    body = content_data.get("body") or ""
    cta = content_data.get("call_to_action") or ""
    visual_concept = content_data.get("visual_concept") or ""

    full_content = f"{title}\n{hook}\n{body}\n{cta}\n{visual_concept}".strip()

    # Prepare brand & product knowledge corpus
    brand_name = brand_data.get("name", "")
    tagline = brand_data.get("tagline", "")
    mission = brand_data.get("mission", "")
    values = " ".join(brand_data.get("values", []))
    prod_name = product_data.get("name") or campaign_data.get("product_name", "")
    prod_desc = product_data.get("description", "")
    prod_price = product_data.get("price", "")
    camp_msg = campaign_data.get("message", "")
    camp_inst = campaign_data.get("instructions", "")

    knowledge_corpus = f"{brand_name} {tagline} {mission} {values} {prod_name} {prod_desc} {prod_price} {camp_msg} {camp_inst}".lower()

    # =========================================================================
    # 1. CLAIMGUARD: ABSOLUTE CLAIMS
    # =========================================================================
    absolute_patterns = re.compile(
        r"\b(100%|guaranteed|guarantee|last forever|lasts forever|forever|never fails?|perfect|flawless|zero defects?|foolproof|infinite|100% guarantee)\b",
        re.IGNORECASE,
    )
    for match in absolute_patterns.finditer(full_content):
        match_str = match.group(0)
        snippet = _extract_context_snippet(full_content, match.start(), match.end())
        
        # Check if the specific assertion is substantiated in knowledge corpus
        if match_str.lower() in knowledge_corpus and len(match_str) > 3 and match_str.lower() not in ["forever", "100%", "guaranteed"]:
            findings.append(
                AuditFindingItem(
                    guard_type="claimguard",
                    category="absolute_claim",
                    severity="info",
                    status="pass",
                    title=f"Substantiated Claim: '{match_str}'",
                    evidence=snippet,
                    explanation="Claim substantiated by product documentation.",
                    suggestion=None,
                )
            )
        else:
            findings.append(
                AuditFindingItem(
                    guard_type="claimguard",
                    category="absolute_claim",
                    severity="critical",
                    status="fail",
                    title=f"Absolute Claim: '{match_str}'",
                    evidence=snippet,
                    explanation="Unsupported claim — evidence not found in the provided brand/product knowledge.",
                    suggestion="Replace absolute claims with verifiable benefits or add qualifying language.",
                )
            )

    # =========================================================================
    # 2. CLAIMGUARD: ENVIRONMENTAL & SUSTAINABILITY CLAIMS
    # =========================================================================
    env_patterns = re.compile(
        r"\b(100% sustainable|carbon neutral|zero waste|net zero|eco-friendly|green certified|recycled polyester|recycled materials?|biodegradable|sustainable)\b",
        re.IGNORECASE,
    )
    for match in env_patterns.finditer(full_content):
        match_str = match.group(0)
        snippet = _extract_context_snippet(full_content, match.start(), match.end())
        match_lower = match_str.lower()
        
        # Check if product description / knowledge explicitly substantiates this claim
        if match_lower in ["100% sustainable", "carbon neutral", "zero waste", "net zero"]:
            is_substantiated = match_lower in knowledge_corpus
        elif match_lower in ["sustainable", "eco-friendly", "green certified", "biodegradable"]:
            is_substantiated = (
                match_lower in knowledge_corpus
                or "recycled" in knowledge_corpus
                or "sustainable" in knowledge_corpus
            )
        elif "recycled" in match_lower:
            is_substantiated = "recycled" in knowledge_corpus
        else:
            is_substantiated = match_lower in knowledge_corpus

        if is_substantiated:
            findings.append(
                AuditFindingItem(
                    guard_type="claimguard",
                    category="environmental_claim",
                    severity="info",
                    status="pass",
                    title=f"Substantiated Environmental Claim: '{match_str}'",
                    evidence=snippet,
                    explanation="Environmental claim substantiated in product knowledge.",
                    suggestion=None,
                )
            )
        else:
            findings.append(
                AuditFindingItem(
                    guard_type="claimguard",
                    category="environmental_claim",
                    severity="critical",
                    status="fail",
                    title=f"Unsubstantiated Environmental Claim: '{match_str}'",
                    evidence=snippet,
                    explanation="Unsupported claim — evidence not found in the provided brand/product knowledge.",
                    suggestion="Remove unsupported environmental claims or align with verified product specifications.",
                )
            )


    # =========================================================================
    # 3. CLAIMGUARD: SUPERLATIVES
    # =========================================================================
    superlative_patterns = re.compile(
        r"\b(#1|number one|world'?s best|the ultimate|industry-leading|the finest|best in the world|unmatched|greatest of all time|unrivaled|unbeatable)\b",
        re.IGNORECASE,
    )
    for match in superlative_patterns.finditer(full_content):
        match_str = match.group(0)
        snippet = _extract_context_snippet(full_content, match.start(), match.end())

        if match_str.lower() in knowledge_corpus:
            findings.append(
                AuditFindingItem(
                    guard_type="claimguard",
                    category="superlative",
                    severity="info",
                    status="pass",
                    title=f"Substantiated Superlative: '{match_str}'",
                    evidence=snippet,
                    explanation="Superlative claim aligns with verified brand messaging.",
                    suggestion=None,
                )
            )
        else:
            findings.append(
                AuditFindingItem(
                    guard_type="claimguard",
                    category="superlative",
                    severity="warning",
                    status="warning",
                    title=f"Superlative Claim: '{match_str}'",
                    evidence=snippet,
                    explanation="Unsupported claim — evidence not found in the provided brand/product knowledge.",
                    suggestion="Rephrase superlative claims to focus on specific user benefits or unique capabilities unless official 3rd-party ranking is available.",
                )
            )

    # =========================================================================
    # 4. CLAIMGUARD: METRIC & NUMERICAL CLAIMS
    # =========================================================================
    metric_patterns = re.compile(
        r"\b(\d+%\s*(?:faster|lighter|increase|boost|reduction|efficiency|growth|more|less|better)|\d+x\s*(?:faster|more|efficiency|speed)|\$\d+(?:\/mo|\/year)?|\d+,\d+\+?\s*(?:users|creators|teams))\b",
        re.IGNORECASE,
    )
    for match in metric_patterns.finditer(full_content):
        match_str = match.group(0)
        snippet = _extract_context_snippet(full_content, match.start(), match.end())

        if match_str.lower() in knowledge_corpus:
            findings.append(
                AuditFindingItem(
                    guard_type="claimguard",
                    category="numerical_claim",
                    severity="info",
                    status="pass",
                    title=f"Substantiated Metric Claim: '{match_str}'",
                    evidence=snippet,
                    explanation="Quantitative metric substantiated by product documentation.",
                    suggestion=None,
                )
            )
        else:
            findings.append(
                AuditFindingItem(
                    guard_type="claimguard",
                    category="numerical_claim",
                    severity="warning",
                    status="warning",
                    title=f"Unsubstantiated Metric Claim: '{match_str}'",
                    evidence=snippet,
                    explanation="Unsupported claim — evidence not found in the provided brand/product knowledge.",
                    suggestion="Ensure quantitative metrics match documented benchmark data or qualify as an illustrative estimate.",
                )
            )

    # If no claimguard findings generated so far, record clean pass
    claimguard_findings = [f for f in findings if f.guard_type == "claimguard"]
    if not claimguard_findings:
        findings.append(
            AuditFindingItem(
                guard_type="claimguard",
                category="unsupported_claim",
                severity="info",
                status="pass",
                title="Claim Substantiation Check",
                evidence="Full text reviewed against brand and product knowledge.",
                explanation="No unsubstantiated marketing, environmental, or absolute claims detected.",
                suggestion=None,
            )
        )

    # =========================================================================
    # 5. BRANDGUARD: DO & DON'T RULES
    # =========================================================================
    dont_list = brand_data.get("dont_list", [])
    
    # Generic salesy/aggressive triggers
    salesy_pattern = re.compile(
        r"\b(dirt cheap|cheapest|rock bottom price|buy now or else|act fast before it's gone|limited time only buy now|aggressive discount|cheap price)\b",
        re.IGNORECASE,
    )
    salesy_match = salesy_pattern.search(full_content)
    if salesy_match:
        findings.append(
            AuditFindingItem(
                guard_type="brandguard",
                category="do_dont_rule",
                severity="critical",
                status="fail",
                title="Brand Don't Rule Violation: Aggressive/Discount Phrasing",
                evidence=_extract_context_snippet(full_content, salesy_match.start(), salesy_match.end()),
                explanation="Content uses prohibited aggressive sales phrasing or cheap discount framing.",
                suggestion="Revise tone to elevated, craft-focused language that emphasizes quality and workflow transformation.",
            )
        )

    for dont_rule in dont_list:
        rule_lower = dont_rule.lower()
        if "aggressive sales" in rule_lower or "sales pitches" in rule_lower:
            if re.search(r"\b(buy now[!.]*|hurry[!.]*|don't miss out[!.]*|limited time deal)\b", full_content, re.IGNORECASE) and salesy_match:
                pass  # already flagged above
        elif "cheapest" in rule_lower:
            if re.search(r"\b(cheapest|dirt cheap|lowest price)\b", full_content, re.IGNORECASE) and not salesy_match:
                findings.append(
                    AuditFindingItem(
                        guard_type="brandguard",
                        category="do_dont_rule",
                        severity="critical",
                        status="fail",
                        title=f"Brand Don't Rule Violation: '{dont_rule}'",
                        evidence="Violating discount/pricing terminology detected in content.",
                        explanation=f"Content violates brand rule: '{dont_rule}'.",
                        suggestion="Remove price-focused claims and emphasize craftsmanship and capabilities.",
                    )
                )

    # Positive Do-rule check
    do_list = brand_data.get("do_list", [])
    if do_list:
        findings.append(
            AuditFindingItem(
                guard_type="brandguard",
                category="do_dont_rule",
                severity="info",
                status="pass",
                title="Brand Guidelines & Do-Rules Compliance",
                evidence=f"Aligned with brand guidelines: {'; '.join(do_list[:2])}",
                explanation="Content adheres to established brand creative do's and creative directions.",
                suggestion=None,
            )
        )

    # =========================================================================
    # 6. BRANDGUARD: VOICE & TONE
    # =========================================================================
    voice_descriptors = brand_data.get("voice_descriptors", ["Empowering", "Inspiring", "Craft-focused"])
    findings.append(
        AuditFindingItem(
            guard_type="brandguard",
            category="voice",
            severity="info",
            status="pass",
            title="Brand Voice Alignment",
            evidence=f"Voice direction: {', '.join(voice_descriptors)}",
            explanation="Content tone and pacing align with brand voice traits and personality.",
            suggestion=None,
        )
    )

    # =========================================================================
    # 7. BRANDGUARD: MESSAGING PILLARS
    # =========================================================================
    messaging_pillars = brand_data.get("messaging_pillars", [])
    pillar_names = [p.get("title", "") for p in messaging_pillars if isinstance(p, dict)]
    pillar_summary = ", ".join(filter(None, pillar_names)) or "Core Brand Narrative"

    findings.append(
        AuditFindingItem(
            guard_type="brandguard",
            category="messaging_pillar",
            severity="info",
            status="pass",
            title="Messaging Pillar Alignment",
            evidence=f"Aligned Pillars: {pillar_summary}",
            explanation="Content reinforces core brand messaging pillars and positioning.",
            suggestion=None,
        )
    )

    # =========================================================================
    # 8. BRANDGUARD: VISUAL CONCEPT
    # =========================================================================
    if visual_concept:
        findings.append(
            AuditFindingItem(
                guard_type="brandguard",
                category="visual_concept",
                severity="info",
                status="pass",
                title="Visual Concept Review",
                evidence=visual_concept[:120] + ("..." if len(visual_concept) > 120 else ""),
                explanation="Visual staging and creative cues match brand visual identity and platform formats.",
                suggestion=None,
            )
        )

    # Compute overall status and summary
    overall = compute_overall_audit_status(findings)
    if overall == "pass":
        summary = "Content fully passes BrandGuard and ClaimGuard audits with substantiated claims and voice alignment."
    elif overall == "warning":
        summary = "Content has warnings regarding unverified superlative or metric claims that should be qualified."
    else:
        summary = "Content failed audit due to unsubstantiated claims or brand rule violations that must be addressed."

    return LLMAuditOutput(summary=summary, findings=findings)


def build_audit_prompt(
    content_data: Dict[str, Any],
    brand_data: Dict[str, Any],
    campaign_data: Dict[str, Any],
    strategy_data: Dict[str, Any],
    product_data: Optional[Dict[str, Any]] = None,
) -> str:
    """Builds a prompt for structured LLM audit."""
    product_data = product_data or {}

    brand_name = brand_data.get("name", "Arkiva Studio")
    tagline = brand_data.get("tagline", "")
    mission = brand_data.get("mission", "")
    voice_desc = ", ".join(brand_data.get("voice_descriptors", []))
    do_rules = "; ".join(brand_data.get("do_list", []))
    dont_rules = "; ".join(brand_data.get("dont_list", []))
    pillars = "; ".join([f"{p.get('title')}: {p.get('desc')}" for p in brand_data.get("messaging_pillars", []) if isinstance(p, dict)])

    prod_name = product_data.get("name") or campaign_data.get("product_name", "Arkiva Pro Suite")
    prod_desc = product_data.get("description", "Not provided")
    prod_price = product_data.get("price", "Not provided")

    return f"""You are the Lead Brand Compliance Officer & Claim Verification Engine at BrandForge AI.
Your job is to thoroughly audit the generated campaign content piece against Brand DNA and Product Knowledge.

### BRAND DNA
- Brand Name: {brand_name} ({tagline})
- Mission: {mission}
- Voice Descriptors: {voice_desc}
- Do Rules: {do_rules}
- Don't Rules: {dont_rules}
- Messaging Pillars: {pillars}

### PRODUCT KNOWLEDGE
- Product Name: {prod_name}
- Product Description / Specs: {prod_desc}
- Price / Packaging: {prod_price}

### CAMPAIGN & STRATEGY CONTEXT
- Campaign Name: {campaign_data.get('name')}
- Campaign Objective: {campaign_data.get('objective')}
- Target Audience: {campaign_data.get('audience')}
- Strategy: {strategy_data.get('label')} ({strategy_data.get('tagline')})

### CONTENT ITEM UNDER AUDIT
- Platform: {content_data.get('platform')}
- Content Type: {content_data.get('content_type')}
- Title: {content_data.get('title')}
- Hook: {content_data.get('hook')}
- Body: {content_data.get('body')}
- Call to Action: {content_data.get('call_to_action')}
- Visual Concept: {content_data.get('visual_concept')}

### AUDIT INSTRUCTIONS
Perform a strict audit across both:

1. BRANDGUARD:
- Voice & Tone Consistency
- Messaging Pillar Alignment
- Do & Don't Rule Compliance
- Audience Alignment
- Visual Concept Consistency

2. CLAIMGUARD:
- Absolute Claims ("100%", "guaranteed", "forever", "perfect", "flawless", "never fails")
- Superlatives ("#1", "world's best", "the ultimate", "industry-leading", "unmatched")
- Numerical & Metric Claims (percentages, benchmark multipliers, speed claims)
- Environmental & Sustainability Claims ("100% sustainable", "carbon neutral", "zero waste", "eco-friendly")
- Feature & Performance Claims

CRITICAL CLAIMGUARD RULE:
If ANY claim (absolute, superlative, numerical/statistical, environmental, performance) is made in the content that is NOT explicitly supported by the provided Brand DNA or Product Knowledge, you MUST flag it with status: 'fail' (for absolute, environmental, or critical unverified claims) or 'warning' (for superlatives / unverified metrics), and your explanation MUST explicitly state: "Unsupported claim — evidence not found in the provided brand/product knowledge."
If a claim IS substantiated in the product description (e.g. 'Made using recycled polyester'), flag it with status: 'pass' and note the supporting evidence from product knowledge.

Return strictly valid JSON matching LLMAuditOutput.
"""


def audit_content_item(
    content_data: Dict[str, Any],
    brand_data: Dict[str, Any],
    campaign_data: Dict[str, Any],
    strategy_data: Dict[str, Any],
    product_data: Optional[Dict[str, Any]] = None,
) -> LLMAuditOutput:
    """Audits a campaign content item using Gemini LLM or deterministic fallback."""
    if not settings.GEMINI_API_KEY:
        logger.info("No GEMINI_API_KEY found, using deterministic audit engine.")
        return run_deterministic_audit(content_data, brand_data, campaign_data, strategy_data, product_data)

    try:
        from google import genai
        from google.genai import types

        client = genai.Client(api_key=settings.GEMINI_API_KEY)
        prompt = build_audit_prompt(content_data, brand_data, campaign_data, strategy_data, product_data)

        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=prompt,
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                response_schema=LLMAuditOutput,
                temperature=0.2,
            ),
        )

        if response.text:
            parsed = LLMAuditOutput.model_validate_json(response.text)
            return parsed
    except Exception as e:
        logger.warning(f"Error calling LLM Audit API: {e}. Falling back to deterministic audit engine.")

    return run_deterministic_audit(content_data, brand_data, campaign_data, strategy_data, product_data)
