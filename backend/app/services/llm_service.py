import json
import logging
from typing import Dict, Any, List, Optional
from ..config import settings
from ..schemas import (
    LLMStrategiesOutput,
    LLMStrategyItem,
    TimelineItem,
    PlatformContentItem,
    LLMContentGenerationOutput,
)


logger = logging.getLogger(__name__)


def build_strategy_generation_prompt(brand_data: Dict[str, Any], campaign_data: Dict[str, Any]) -> str:
    """Constructs a comprehensive, rich prompt for structured LLM strategy generation."""
    brand_name = brand_data.get("name", "Arkiva Studio")
    tagline = brand_data.get("tagline", "Design without limits.")
    mission = brand_data.get("mission", "Empower creative professionals with intelligent design tools.")
    voice_desc = ", ".join(brand_data.get("voice_descriptors", ["Empowering", "Inspiring", "Craft-focused"]))
    do_rules = "; ".join(brand_data.get("do_list", []))
    dont_rules = "; ".join(brand_data.get("dont_list", []))

    product = campaign_data.get("product_name", "Arkiva Pro Suite")
    campaign_name = campaign_data.get("name", "New Campaign")
    objective = campaign_data.get("objective", "Brand Awareness")
    audience = campaign_data.get("audience", "Creative professionals, design tool users")
    duration = campaign_data.get("duration", "3 weeks")
    key_message = campaign_data.get("message", "Transforms creative workflow")
    instructions = campaign_data.get("instructions", "Keep it authentic and elevated")
    platforms = ", ".join(campaign_data.get("platforms", ["Instagram", "LinkedIn"]))

    return f"""You are the Chief Brand & Creative Strategist at BrandForge AI.
Generate 3 distinct, high-impact campaign strategy directions for the following brand and campaign brief.

### BRAND DNA
- Brand: {brand_name} ({tagline})
- Mission: {mission}
- Voice Descriptors: {voice_desc}
- Do's: {do_rules}
- Don'ts: {dont_rules}

### CAMPAIGN BRIEF
- Campaign Name: {campaign_name}
- Product/Service: {product}
- Objective: {objective}
- Target Audience: {audience}
- Duration: {duration}
- Key Message: {key_message}
- Strategic Platforms: {platforms}
- Additional Constraints/Instructions: {instructions}

### REQUIRED OUTPUT
You must return 3 distinct, fully fleshed-out strategic directions:
1. Product-Led (id: 'product', color: '#5B9BC4'): Lead with product capabilities, workflow demonstrations, before/after transformations, and time saved.
2. Story-Led (id: 'story', color: '#C4813A', recommended: true): Lead with creator origin stories, emotional resonance, authentic journeys, and the human side of craft.
3. Community-Led (id: 'community', color: '#5BA373'): Lead with community challenges, user co-creation, collaborative showcases, and peer-to-peer inspiration.

Each strategy must include:
- strategy_type: 'product', 'story', or 'community'
- label: 'Product-Led', 'Story-Led', or 'Community-Led'
- tagline: Punchy 1-line strategy slogan
- description: 2-3 sentence strategic rationale
- core_message: The single key takeaway headline
- audience_insight: Deep psychological and behavioral insight
- audience_tags: 3-4 short uppercase tags (e.g. ['TIME-CONSCIOUS', 'CRAFT-FOCUSED'])
- content_pillars: Exactly 3 thematic pillars
- narrative: The overarching creative arc
- tone: Specific tone guidance
- best_platforms: Top 2-3 platforms for this angle
- color: '#5B9BC4' (product), '#C4813A' (story), '#5BA373' (community)
- recommended: boolean (true for story-led)
- timeline: Phased rollout breakdown across the campaign duration ({duration})
- total_pieces: Total number of content pieces calculated across the timeline

Return strictly valid JSON matching the schema.
"""


def generate_fallback_strategies(brand_data: Dict[str, Any], campaign_data: Dict[str, Any]) -> LLMStrategiesOutput:
    """Deterministic fallback strategy generator tailored dynamically to user inputs."""
    product = campaign_data.get("product_name", "Arkiva Pro Suite")
    objective = campaign_data.get("objective", "Brand Awareness")
    audience = campaign_data.get("audience", "Creative professionals, design tool users")
    duration = campaign_data.get("duration", "3 weeks")
    key_msg = campaign_data.get("message") or f"{product} transforms how creative professionals work."
    platforms = campaign_data.get("platforms", ["Instagram", "LinkedIn"])

    # Determine timeline phases based on duration
    timeline_templates = [
        TimelineItem(week="Week 1", phase="Teaser", desc=f"Mystery & anticipation teasers highlighting {product} capabilities", pieces=3),
        TimelineItem(week="Week 2", phase="Launch", desc=f"Full campaign reveal with hero content and core narrative for {objective}", pieces=6),
        TimelineItem(week="Week 3", phase="Feature", desc="Deep-dive workflow breakdowns and creator feature showcases", pieces=8),
        TimelineItem(week="Week 4", phase="Social Proof", desc="Community transformations, results showcases, and UGC", pieces=5),
        TimelineItem(week="Week 5", phase="CTA Push", desc="Conversion-focused content driving trials and upgrades", pieces=6),
        TimelineItem(week="Week 6", phase="Follow-up", desc="Recap, community highlights, and ongoing engagement", pieces=4),
    ]

    product_strat = LLMStrategyItem(
        strategy_type="product",
        label="Product-Led",
        tagline="Let the craft speak first.",
        description=f"Lead with {product}'s most powerful capabilities through high-fidelity demos and before/after moments. Show real workflows, measurable results, and saved time tailored for {objective}.",
        core_message=f'"{key_msg}"',
        audience_insight=f"Your audience ({audience}) deals with tool fatigue and friction. Demonstrating concrete speed and quality improvements builds immediate trust.",
        audience_tags=["WORKFLOW-DRIVEN", "PRECISION-MINDED", "TOOL-FATIGUED", "EFFICIENCY-SEEKING"],
        content_pillars=["Feature Spotlight", "Workflow Deep-Dives", "Before & After Transformations"],
        narrative=f"From tedious friction to effortless flow: how {product} unlocks the master craftsman inside every creator.",
        tone="Direct, confident, technical depth without jargon",
        best_platforms=[p for p in ["LinkedIn", "YouTube Shorts", "X"] if p in platforms] or ["LinkedIn", "YouTube Shorts"],
        color="#5B9BC4",
        recommended=False,
        timeline=timeline_templates,
        total_pieces=32,
    )

    story_strat = LLMStrategyItem(
        strategy_type="story",
        label="Story-Led",
        tagline="Every masterwork has a creative origin.",
        description=f"Position {product} through the lens of visionary creators. Authentic journeys, creative struggles, and the human side of design excellence to power your {objective} goals.",
        core_message=f'"{key_msg}"',
        audience_insight=f"Creative professionals in {audience} want to feel seen and elevated. Emotional resonance and authentic stories turn casual viewers into passionate brand advocates.",
        audience_tags=["CRAFT-FOCUSED", "EMOTIONALLY-DRIVEN", "ASPIRATIONAL", "CREATIVE-PRIDE"],
        content_pillars=["Creator Journeys", "Behind the Work", "Studio Vignettes"],
        narrative=f"The untold story behind every great project: how visionary artists overcome the creative wall with {product}.",
        tone="Warm, narrative-rich, emotionally resonant, inspirational",
        best_platforms=[p for p in ["Instagram", "LinkedIn", "YouTube"] if p in platforms] or ["Instagram", "LinkedIn"],
        color="#C4813A",
        recommended=True,
        timeline=timeline_templates,
        total_pieces=32,
    )

    community_strat = LLMStrategyItem(
        strategy_type="community",
        label="Community-Led",
        tagline="Great design is made together.",
        description=f"Activate peer-to-peer creator collaboration, design challenges, and showcase galleries around {product} to accelerate organic momentum for {objective}.",
        core_message=f'"{key_msg}"',
        audience_insight=f"Creators love learning from their peers and showing off their latest work. A participatory approach creates viral compounding loops.",
        audience_tags=["COMMUNITY-ORIENTED", "COLLABORATIVE", "PARTICIPATORY", "PEER-INSPIRED"],
        content_pillars=["Design Challenges", "Community Showcases", "Creator Spotlights"],
        narrative=f"A shared movement where every maker contributes to a collective standard of design intelligence.",
        tone="Energetic, inclusive, celebratory, highly participatory",
        best_platforms=[p for p in ["X", "Instagram", "TikTok"] if p in platforms] or ["X", "Instagram"],
        color="#5BA373",
        recommended=False,
        timeline=timeline_templates,
        total_pieces=32,
    )

    return LLMStrategiesOutput(
        product_led=product_strat,
        story_led=story_strat,
        community_led=community_strat,
    )


def generate_campaign_strategies(brand_data: Dict[str, Any], campaign_data: Dict[str, Any]) -> LLMStrategiesOutput:
    """Generates 3 campaign strategies using Gemini / LLM with structured output or fallback."""
    if not settings.GEMINI_API_KEY:
        logger.info("No GEMINI_API_KEY found, using structured dynamic strategy engine.")
        return generate_fallback_strategies(brand_data, campaign_data)

    try:
        from google import genai
        from google.genai import types

        client = genai.Client(api_key=settings.GEMINI_API_KEY)
        prompt = build_strategy_generation_prompt(brand_data, campaign_data)

        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=prompt,
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                response_schema=LLMStrategiesOutput,
                temperature=0.7,
            ),
        )

        if response.text:
            parsed = LLMStrategiesOutput.model_validate_json(response.text)
            return parsed
    except Exception as e:
        logger.warning(f"Error calling LLM API: {e}. Falling back to structured generator.")

    return generate_fallback_strategies(brand_data, campaign_data)


# ==============================================================================
# MILESTONE 2A: PLATFORM CONTENT GENERATION
# ==============================================================================


def build_content_generation_prompt(
    brand_data: Dict[str, Any],
    campaign_data: Dict[str, Any],
    strategy_data: Dict[str, Any],
    platforms: List[str],
) -> str:
    """Builds a rich prompt for platform-native content generation."""
    brand_name = brand_data.get("name", "Arkiva Studio")
    tagline = brand_data.get("tagline", "Design without limits.")
    mission = brand_data.get("mission", "Empower creative professionals with intelligent design tools.")
    industry = brand_data.get("industry", "Design Software")
    stage = brand_data.get("stage", "Growth")
    voice_desc = ", ".join(brand_data.get("voice_descriptors", ["Empowering", "Inspiring", "Craft-focused"]))
    do_rules = "; ".join(brand_data.get("do_list", []))
    dont_rules = "; ".join(brand_data.get("dont_list", []))
    product_info = brand_data.get("product_info", {})

    product = campaign_data.get("product_name", "Arkiva Pro Suite")
    campaign_name = campaign_data.get("name", "New Campaign")
    objective = campaign_data.get("objective", "Brand Awareness")
    audience = campaign_data.get("audience", "Creative professionals, design tool users")
    duration = campaign_data.get("duration", "3 weeks")
    key_message = campaign_data.get("message", "Transforms creative workflow")
    instructions = campaign_data.get("instructions", "Keep it authentic and elevated")

    strategy_label = strategy_data.get("label", "Story-Led")
    strategy_tagline = strategy_data.get("tagline", "Every masterwork has a creative origin.")
    strategy_desc = strategy_data.get("desc") or strategy_data.get("description", "")
    strategy_core_msg = strategy_data.get("core_message", key_message)
    audience_insight = strategy_data.get("audience_insight", "")
    narrative = strategy_data.get("narrative", "")
    strategy_tone = strategy_data.get("tone", voice_desc)

    platforms_str = ", ".join(platforms)

    return f"""You are the Master Creative Director & Copywriting Engine at BrandForge AI.
Generate bespoke, platform-native content tailored to the selected strategy, campaign brief, and brand identity.

### BRAND CONTEXT
- Brand Name: {brand_name} ({tagline})
- Mission: {mission}
- Industry & Stage: {industry} · {stage}
- Voice & Tone Guidelines: {voice_desc} (Specific tone: {strategy_tone})
- Do's: {do_rules}
- Don'ts: {dont_rules}
- Product Info: {product} — {product_info.get('description', 'Intelligent workspace for creators')} ({product_info.get('price', '$49/mo')})

### CAMPAIGN BRIEF
- Campaign Name: {campaign_name}
- Featured Product: {product}
- Primary Objective: {objective}
- Target Audience Persona: {audience}
- Campaign Duration: {duration}
- Key Takeaway Message: {key_message}
- Brief Constraints: {instructions}

### SELECTED STRATEGIC DIRECTION
- Strategy: {strategy_label} ("{strategy_tagline}")
- Strategy Rationale: {strategy_desc}
- Core Strategy Headline: {strategy_core_msg}
- Audience Behavioral Insight: {audience_insight}
- Overarching Narrative Arc: {narrative}

### PLATFORM SPECIFICATIONS
Generate ONE distinct, highly optimized content piece for each of the following requested platforms: [{platforms_str}]

Requirements per platform:
1. 'instagram':
   - content_type: 'caption'
   - title: Visual Concept Title / Carousel Theme
   - hook: Engaging visual or text hook (first 2 lines before cutoff)
   - body: Full storytelling caption with thoughtful line breaks, emoji accents, and 3-5 high-relevance hashtags
   - call_to_action: Profile link / save / comment prompt
   - visual_concept: Detailed art direction (composition, lighting, typography, color palette #0A0908, #C4813A, #EDE8DF)

2. 'linkedin':
   - content_type: 'post'
   - title: Professional Thought-Leadership Headline
   - hook: Contrarian / compelling opening line that demands expanding the post
   - body: Structured executive/creative post with whitespace, clear bullet insights, and actionable industry takeaways
   - call_to_action: Conversational peer engagement question / discussion prompt
   - visual_concept: Supporting graphic / framework diagram or infographic note

3. 'x':
   - content_type: 'thread' (or 'post')
   - title: Topic / Angle Headline
   - hook: Punchy scroll-stopping opening tweet designed for bookmarks & reposts
   - body: Numbered mini-thread (3-4 concise tweets) or crisp standalone post packed with high-signal insight
   - call_to_action: Action-oriented closing link / CTA
   - visual_concept: UI animation or high-contrast demo snippet description

4. 'youtube_shorts':
   - content_type: 'script'
   - title: High-CTR video title (< 60 characters with #Shorts)
   - hook: 0-3 second spoken & visual opening hook line
   - body: Complete 30-45 second spoken script formatted with timestamps ([0:00-0:05], etc.) and actor/screen actions
   - call_to_action: Pinned comment & subscribe/try prompt
   - visual_concept: Dynamic staging, camera movements, screen zoom-ins, typography overlay cues

Return strictly valid JSON matching the LLMContentGenerationOutput schema containing an 'items' array.
"""


def generate_fallback_content(
    brand_data: Dict[str, Any],
    campaign_data: Dict[str, Any],
    strategy_data: Dict[str, Any],
    platforms: List[str],
) -> LLMContentGenerationOutput:
    """Deterministic fallback content generator adapted natively to each requested platform."""
    product = campaign_data.get("product_name", "Arkiva Pro Suite")
    brand_name = brand_data.get("name", "Arkiva Studio")
    objective = campaign_data.get("objective", "Brand Awareness")
    audience = campaign_data.get("audience", "Creative professionals, design tool users")
    key_msg = campaign_data.get("message") or f"{product} transforms how creative professionals work."
    strat_label = strategy_data.get("label", "Story-Led")
    strat_type = strategy_data.get("strategy_type", "story")

    items: List[PlatformContentItem] = []

    for platform in platforms:
        p = platform.strip().lower().replace(" ", "_").replace("-", "_")
        if p == "twitter":
            p = "x"

        if p == "instagram":
            if strat_type == "product":
                ig_title = f"Workflow Shift: Designing at the Speed of Thought with {product}"
                ig_hook = "What happens when your design tools finally get out of the way?"
                ig_body = f"""Most design tools force you into endless menus, broken plugins, and repetitive grunt work.

With {product}, we rebuilt the creative canvas from the ground up:
✦ Instant multi-platform orchestration
✦ AI-guided layout and typographic rhythm
✦ Zero-lag collaboration in real time

No technical friction. Just pure creative momentum.

Experience the shift at the link in bio.

#Arkiva #CreativeTools #DesignWorkspace #DesignIntelligence #ProductDesign"""
                ig_cta = "Tap the link in bio to start your 14-day free trial."
                ig_visual = "Split-screen carousel: Slide 1 shows chaotic multi-tool friction in muted slate; Slide 2-4 shows seamless fluid orchestration in Obsidian & Copper UI palette."
            elif strat_type == "community":
                ig_title = f"Community Showcase: What 5,000 Designers Built with {product}"
                ig_hook = "Great design isn't made in isolation — it's made together."
                ig_body = f"""This week, we asked our creator community to push {product} to its absolute limits.

The result? Over 5,000 breathtaking design systems, editorial layouts, and brand identities crafted in record time.

Swipe through to see 5 outstanding creator projects that redefined what's possible with intelligent design tools.

Which project inspires your next sprint? Drop your thoughts below 👇

#ArkivaCommunity #MadeWithArkiva #DesignShowcase #CreatorCraft #GraphicDesign"""
                ig_cta = "Swipe to explore creator builds, then join the challenge at the link in bio."
                ig_visual = "High-contrast carousel featuring 5 creator portfolio showcases with creator tags, highlighted in obsidian frames with copper accents."
            else:  # Story-Led default
                ig_title = f"The Creative Origin: Building with {product}"
                ig_hook = "Every masterwork begins at the edge of frustration."
                ig_body = f"""For years, creative professionals have spent 40% of their day fighting the software they rely on to make a living.

We built {product} because we believe tools should empower craft — not bottleneck it.

{key_msg}

When you step into the flow state, the technology disappears and only your vision remains.

Save this for your next creative sprint. ✦

#ArkivaStudio #CreativeEmpowerment #DesignCraft #DesignIntelligence #Creators"""
                ig_cta = "Discover the story and start creating at the link in bio."
                ig_visual = "Atmospheric studio photography: designer working late at a warm-lit obsidian desk, screen displaying Arkiva UI with warm copper rim lighting."

            items.append(
                PlatformContentItem(
                    platform="instagram",
                    content_type="caption",
                    title=ig_title,
                    hook=ig_hook,
                    body=ig_body,
                    call_to_action=ig_cta,
                    visual_concept=ig_visual,
                )
            )

        elif p == "linkedin":
            if strat_type == "product":
                li_title = f"Why tool fatigue is costing creative teams 15+ hours every week"
                li_hook = "The biggest bottleneck in professional design isn't lack of talent — it's tool fragmentation."
                li_body = f"""Creative teams frequently toggle between 6+ disparate applications just to deliver a single campaign asset.

At {brand_name}, our benchmark analysis showed:
→ 42% of design hours are lost to manual reformatting
→ Asset version drift causes 30% of rework
→ Context-switching destroys deep creative flow

That is why we engineered {product}.

By unifying intelligent template orchestration, real-time typography scaling, and brand governance into one unified workspace, teams reduce production cycle time by over 60%.

{key_msg}"""
                li_cta = "How is your creative organization streamlining design tooling this year? Share your approach below."
                li_visual = "Comparative workflow diagram: 'Fragmented Tool Stack (6 Tools)' vs 'Unified Workspace with Arkiva Pro Suite'."
            elif strat_type == "community":
                li_title = f"The collaborative future of professional creative workflows"
                li_hook = "The best design teams don't just share files — they share intelligence."
                li_body = f"""In high-velocity creative teams, knowledge silos are the silent killer of consistency.

When one senior designer solves a layout hierarchy challenge, that pattern should instantly empower every creator across the team.

With {product}'s shared community intelligence:
• Design systems learn from live usage patterns
• Junior creators ramp up 3x faster with contextual guidelines
• Cross-functional stakeholders review and approve in seconds

Building together elevates the standard of craft for everyone."""
                li_cta = "Join 10,000+ creative leaders in the Arkiva Community. Link in comments."
                li_visual = "Infographic highlighting creator network effects and team velocity metrics."
            else:  # Story-Led default
                li_title = f"The human side of design tools: Giving creators their time back"
                li_hook = "We didn't set out to build another software suite. We set out to give creators their flow state back."
                li_body = f"""Over the past 5 years speaking with hundreds of art directors and brand designers, one recurring theme stood out:

Creative professionals are exhausted.

Not from designing — but from the tedious, repetitive overhead that modern tools have introduced into their workday.

"{key_msg}"

When software anticipates what you need without getting in the way, professional creators don't just work faster — they produce bolder, more resonant work.

That is the vision behind {product}."""
                li_cta = "What's the one design task you wish software would handle for you automatically? Join the discussion below."
                li_visual = "Clean editorial quote card on obsidian background with copper accents and Fraunces typography."

            items.append(
                PlatformContentItem(
                    platform="linkedin",
                    content_type="post",
                    title=li_title,
                    hook=li_hook,
                    body=li_body,
                    call_to_action=li_cta,
                    visual_concept=li_visual,
                )
            )

        elif p == "x":
            if strat_type == "product":
                x_title = f"How {product} eliminates creative tool fatigue 🧵"
                x_hook = "Most creative tools are built for features. The best tools are built for flow. 🧵👇"
                x_body = f"""1/ Designers spend 40% of their day on repetitive reformatting and manual resizing.

2/ With {product}, 1 master asset generates all platform variations instantly — with pixel-perfect typography hierarchy intact.

3/ No plugins. No lag. No multi-app circus.

4/ More craft. Zero grunt work."""
                x_cta = "Try {product} free: arkiva.studio"
                x_visual = "12-second high-speed video capture showing 1 layout adapting to 6 aspect ratios instantly."
            elif strat_type == "community":
                x_title = f"Join the {product} Design Challenge 🧵"
                x_hook = "We're giving away $10k in grants to the most innovative designs built in {product} this month. 🧵👇"
                x_body = f"""1/ The {brand_name} Creator Challenge is live!

2/ Build an original brand system or layout using {product}.

3/ Share your project using #MadeWithArkiva for peer review and showcase placement.

4/ Winners featured across our global creator network."""
                x_cta = "Submit your entry at arkiva.studio/community"
                x_visual = "Grid of featured community submissions with clean typographic overlays."
            else:  # Story-Led default
                x_title = f"Why the best creative software is invisible 🧵"
                x_hook = "The best creative tools don't scream for attention. They disappear into your workflow. 🧵👇"
                x_body = f"""1/ When you're in true creative flow, you shouldn't be thinking about software menus or keyboard shortcuts.

2/ You should only be thinking about craft, rhythm, and clarity.

3/ {key_msg}

4/ That's why we built {product}."""
                x_cta = "Experience flow state: arkiva.studio"
                x_visual = "Minimalist UI screenshot showing distraction-free Zen canvas mode."

            items.append(
                PlatformContentItem(
                    platform="x",
                    content_type="thread",
                    title=x_title,
                    hook=x_hook,
                    body=x_body,
                    call_to_action=x_cta,
                    visual_concept=x_visual,
                )
            )

        elif p == "youtube_shorts":
            if strat_type == "product":
                yt_title = f"Stop resizing banners manually! #Shorts"
                yt_hook = "[Sound: Fast Record Scratch] 'Are you still resizing design assets by hand in 2024?'"
                yt_body = f"""[0:00 - 0:04] Host looks directly into camera with disbelief, holding up a phone displaying 10 stretched graphics.
Host: 'If you're still spending 2 hours making 20 banner sizes, stop scrolling.'

[0:05 - 0:20] Screen capture zooms smoothly into {product} Smart Canvas.
Host: 'Watch this. I take 1 master design, click Orchestrate, and {product} formats all 12 platform layouts with perfect font scaling in 2 seconds.'

[0:21 - 0:35] Fast-paced cut back to host testing the outputs.
Host: 'Every margin, crop, and CTA stays 100% on-brand. That's hours saved every single week.'"""
                yt_cta = "Link in pinned comment to try {product} free!"
                yt_visual = "Split-screen dynamic zoom-ins, fast punchy cuts, Fraunces bold title captions in copper."
            elif strat_type == "community":
                yt_title = f"Can AI really design better than humans? #Shorts"
                yt_hook = "[Sound: High-Energy Synth] 'We asked 100 top designers to race this new AI workspace!'"
                yt_body = f"""[0:00 - 0:05] Fast cuts of designers at dual-monitor setups competing in live design sprint.
Host: 'Can intelligent design software beat a seasoned pro? Let's find out.'

[0:06 - 0:25] Screen recordings of {product} generating intelligent color palettes and layout suggestions while designers refine the details.
Host: 'Turns out, it's not AI vs Designer. It's Designer + {product} creating 5x faster with unmatched precision.'

[0:26 - 0:40] Showcase of the jaw-dropping final brand guidelines.
Host: 'See the top 10 community creations and download the templates below!'"""
                yt_cta = "Check the pinned link to join the Arkiva Creator Community!"
                yt_visual = "Montage of creator reactions, live side-by-side timer, glowing UI screen highlights."
            else:  # Story-Led default
                yt_title = f"The secret to staying in creative flow state #Shorts"
                yt_hook = "[Audio: Ambient Lofi Piano] 'Ever notice how some design tools drain your energy while others fuel it?'"
                yt_body = f"""[0:00 - 0:06] Close-up of stylus on tablet and hands on keyboard in warm moody lighting.
Host: 'The hardest part of any project isn't having the idea. It's fighting your tools to bring it to life.'

[0:07 - 0:22] Camera glides over {product}'s obsidian canvas as an intricate brand layout comes together effortlessly.
Host: '{product} was built for the master craftsman. It anticipates your rhythm so you never leave flow state.'

[0:23 - 0:38] Host leans back with finished project on screen.
Host: '{key_msg}. Time to do what matters: create.'" """
                yt_cta = "Link in bio & comments to experience Arkiva Pro free."
                yt_visual = "Cinematic 4K shallow depth of field, warm amber lighting, smooth kinetic text transitions in Inter font."

            items.append(
                PlatformContentItem(
                    platform="youtube_shorts",
                    content_type="script",
                    title=yt_title,
                    hook=yt_hook,
                    body=yt_body,
                    call_to_action=yt_cta,
                    visual_concept=yt_visual,
                )
            )

    return LLMContentGenerationOutput(items=items)


def generate_platform_content(
    brand_data: Dict[str, Any],
    campaign_data: Dict[str, Any],
    strategy_data: Dict[str, Any],
    platforms: List[str],
) -> LLMContentGenerationOutput:
    """Generates platform-native content using Gemini / LLM with structured output or fallback."""
    if not settings.GEMINI_API_KEY:
        logger.info("No GEMINI_API_KEY found, using structured dynamic content generator.")
        return generate_fallback_content(brand_data, campaign_data, strategy_data, platforms)

    try:
        from google import genai
        from google.genai import types

        client = genai.Client(api_key=settings.GEMINI_API_KEY)
        prompt = build_content_generation_prompt(brand_data, campaign_data, strategy_data, platforms)

        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=prompt,
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                response_schema=LLMContentGenerationOutput,
                temperature=0.7,
            ),
        )

        if response.text:
            parsed = LLMContentGenerationOutput.model_validate_json(response.text)
            return parsed
    except Exception as e:
        logger.warning(f"Error calling LLM Content API: {e}. Falling back to structured generator.")

    return generate_fallback_content(brand_data, campaign_data, strategy_data, platforms)


# ==============================================================================
# CONTENT REPURPOSING ENGINE (HERO-TO-DERIVATIVE ADAPTATION)
# ==============================================================================


def build_repurpose_prompt(
    brand_data: Dict[str, Any],
    source_title: str,
    source_text: str,
    source_platform: str,
    target_platforms: List[str],
    strategy_data: Optional[Dict[str, Any]] = None,
) -> str:
    """Builds a specialized prompt to adapt hero content into platform-native derivatives."""
    brand_name = brand_data.get("name", "Arkiva Studio")
    tagline = brand_data.get("tagline", "Design without limits.")
    voice_desc = ", ".join(brand_data.get("voice_descriptors", ["Empowering", "Inspiring", "Craft-focused"]))
    do_rules = "; ".join(brand_data.get("do_list", []))
    dont_rules = "; ".join(brand_data.get("dont_list", []))

    strat_label = strategy_data.get("label", "Brand Strategic Tone") if strategy_data else "Editorial Hero"
    strat_tone = strategy_data.get("tone", voice_desc) if strategy_data else voice_desc

    platforms_str = ", ".join(target_platforms)

    return f"""You are the Master Content Repurposing & Adaptation Engine at BrandForge AI.
Your mission is to take the provided HERO / SOURCE CONTENT and adapt its core thesis, message, and insights into high-impact, platform-native derivative assets for: [{platforms_str}]

### BRAND DNA & GOVERNANCE
- Brand: {brand_name} ({tagline})
- Voice & Tone: {voice_desc} (Strategic tone: {strat_tone})
- Do's: {do_rules}
- Don'ts: {dont_rules}

### SOURCE / HERO CONTENT
- Source Format/Channel: {source_platform}
- Source Title/Headline: {source_title}
- Source Body:
\"\"\"
{source_text}
\"\"\"

### ADAPTATION REQUIREMENTS BY PLATFORM
1. 'instagram':
   - content_type: 'caption'
   - title: Visual Concept Title / Carousel Theme
   - hook: Evocative visual or text hook (first 2 lines before feed cutoff)
   - body: Engaging storytelling caption with clean whitespace, bullet points, and 3-5 relevant hashtags
   - call_to_action: Profile link / save / comment prompt
   - visual_concept: Detailed art direction (composition, obsidian/copper palette, slide breakdown)

2. 'linkedin':
   - content_type: 'post'
   - title: Executive / Thought Leadership Headline
   - hook: Contrarian or compelling opening line that demands expanding 'see more'
   - body: Structured executive breakdown with clear whitespace, insight bullets, and actionable business takeaways
   - call_to_action: Conversational peer engagement question
   - visual_concept: Supporting graphic / framework diagram or infographic note

3. 'x':
   - content_type: 'thread' (or 'post')
   - title: Thread Topic Headline
   - hook: Punchy scroll-stopping opening tweet designed for bookmarks & retweets
   - body: Numbered mini-thread (3-4 concise tweets) or crisp standalone post packed with high-signal insight
   - call_to_action: Closing link / engagement prompt
   - visual_concept: UI animation or high-contrast demo snippet description

4. 'youtube_shorts':
   - content_type: 'script'
   - title: High-CTR video title (< 60 characters with #Shorts)
   - hook: 0-3 second spoken & visual opening hook line
   - body: Complete 30-45 second spoken script formatted with timestamps ([0:00-0:05], etc.) and actor/screen actions
   - call_to_action: Pinned comment & subscribe/try prompt
   - visual_concept: Dynamic staging, camera movements, screen zoom-ins, typography overlay cues

Return strictly valid JSON matching the LLMContentGenerationOutput schema containing an 'items' array.
"""


def generate_fallback_repurposed_content(
    brand_data: Dict[str, Any],
    source_title: str,
    source_text: str,
    source_platform: str,
    target_platforms: List[str],
    strategy_data: Optional[Dict[str, Any]] = None,
) -> LLMContentGenerationOutput:
    """Deterministic fallback for content repurposing across platforms."""
    brand_name = brand_data.get("name", "Arkiva Studio")
    clean_title = source_title.strip() if source_title else "Transformative Creative Insights"

    # Extract first line or summary as hook candidate
    lines = [l.strip() for l in source_text.split("\n") if l.strip()]
    first_sentence = lines[0] if lines else f"How {brand_name} is reshaping creative workflows."
    summary_snippet = " ".join(lines[:3]) if len(lines) >= 3 else source_text[:200]

    items: List[PlatformContentItem] = []

    for platform in target_platforms:
        p = platform.strip().lower().replace(" ", "_").replace("-", "_")
        if p == "twitter":
            p = "x"

        if p == "instagram":
            items.append(
                PlatformContentItem(
                    platform="instagram",
                    content_type="caption",
                    title=f"Visual Carousel: {clean_title}",
                    hook=first_sentence if len(first_sentence) < 90 else first_sentence[:87] + "...",
                    body=f"""✦ {clean_title} ✦

{summary_snippet}

Key Takeaways:
1. Simplify your core workflow before scaling output
2. Eliminate redundant tools to protect your creative energy
3. Let intelligent systems handle the repetitive grunt work

Swipe through for the full breakdown. ➔

Save this post for your next project sprint.

#ArkivaStudio #CreativeWorkflow #DesignIntelligence #Productivity #DesignCraft""",
                    call_to_action="Tap the link in bio to read the full case study & start creating.",
                    visual_concept="5-slide visual carousel in Obsidian (#0D0C0B) and Copper (#C4813A) palette with typography set in Fraunces and Inter.",
                )
            )

        elif p == "linkedin":
            items.append(
                PlatformContentItem(
                    platform="linkedin",
                    content_type="post",
                    title=f"The Strategic Breakdown: {clean_title}",
                    hook=f"Why the most productive design teams are rethinking their workflow: {clean_title}",
                    body=f"""{first_sentence}

Here is what we observed across creative teams scaling high-velocity campaigns:

→ Fragmentation is the hidden tax on creativity
→ 40% of production time is lost to manual reformatting
→ Unified intelligent systems reduce revision cycles by over half

"{summary_snippet}"

When tools remove friction rather than adding complexity, creative teams don't just work faster — they produce distinctly better craft.

How is your team modernizing creative workflows this quarter?""",
                    call_to_action="Share your perspective in the comments below.",
                    visual_concept="Clean 1200x628 executive summary card with key statistics and brand quote styling.",
                )
            )

        elif p == "x":
            items.append(
                PlatformContentItem(
                    platform="x",
                    content_type="thread",
                    title=f"Thread: {clean_title} 🧵",
                    hook=f"{first_sentence} 🧵👇",
                    body=f"""1/ {first_sentence}

2/ The core lesson: {summary_snippet[:140]}

3/ 3 rules to protect your creative velocity:
• Ruthlessly eliminate repetitive reformatting
• Standardize brand governance upstream
• Focus 100% of human energy on craft and storytelling

4/ More craft. Zero grunt work.""",
                    call_to_action="Follow for more daily creative systems teardowns. Repost to share with your team!",
                    visual_concept="High-contrast infographic showing before-and-after workflow efficiency.",
                )
            )

        elif p == "youtube_shorts":
            items.append(
                PlatformContentItem(
                    platform="youtube_shorts",
                    content_type="script",
                    title=f"The #1 workflow mistake creative teams make! #Shorts",
                    hook=f"[Audio: Quick Synth Riser] 'Stop spending hours on grunt work — here's what top creators do instead.'",
                    body=f"""[0:00 - 0:05] Host addresses camera directly with split-screen showing chaotic timeline vs unified canvas.
Host: '{first_sentence}'

[0:06 - 0:22] Camera pans smoothly into {brand_name} interface demonstrating instant asset transformation.
Host: '{summary_snippet[:150]}... In just two clicks, 1 hero asset becomes 4 platform-ready formats.'

[0:23 - 0:38] Host wraps up with key takeaway on screen in bold copper typography.
Host: 'Stop fighting your tools. Let intelligence handle the formatting so you can focus on pure craft.'""",
                    call_to_action="Check the pinned link to test this workflow free!",
                    visual_concept="Fast-paced 9:16 vertical video with kinetic typography overlays and obsidian desk studio lighting.",
                )
            )

    return LLMContentGenerationOutput(items=items)


def repurpose_content_items(
    brand_data: Dict[str, Any],
    source_title: str,
    source_text: str,
    source_platform: str,
    target_platforms: List[str],
    strategy_data: Optional[Dict[str, Any]] = None,
) -> LLMContentGenerationOutput:
    """Repurposes source hero content into platform-adapted versions using Gemini or deterministic fallback."""
    if not settings.GEMINI_API_KEY:
        logger.info("No GEMINI_API_KEY found, using structured dynamic repurposing generator.")
        return generate_fallback_repurposed_content(
            brand_data, source_title, source_text, source_platform, target_platforms, strategy_data
        )

    try:
        from google import genai
        from google.genai import types

        client = genai.Client(api_key=settings.GEMINI_API_KEY)
        prompt = build_repurpose_prompt(
            brand_data, source_title, source_text, source_platform, target_platforms, strategy_data
        )

        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=prompt,
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                response_schema=LLMContentGenerationOutput,
                temperature=0.7,
            ),
        )

        if response.text:
            parsed = LLMContentGenerationOutput.model_validate_json(response.text)
            return parsed
    except Exception as e:
        logger.warning(f"Error calling LLM Repurposing API: {e}. Falling back to structured generator.")

    return generate_fallback_repurposed_content(
        brand_data, source_title, source_text, source_platform, target_platforms, strategy_data
    )


