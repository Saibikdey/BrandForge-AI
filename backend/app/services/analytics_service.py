import logging
import uuid
from datetime import datetime, timedelta, timezone
from typing import List, Dict, Any, Optional, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import func

from ..models import (
    Campaign,
    CampaignStrategy,
    CampaignContent,
    CampaignPerformance,
    ContentSchedule,
    ContentAudit,
    ContentRevision,
    ApprovalAction,
)
from ..schemas import (
    PerformanceEntryCreate,
    PerformanceTrendPoint,
    PlatformPerformanceSummary,
    ContentLeaderboardItem,
    AnalyticsInsight,
    AnalyticsKPISummary,
    CampaignAnalyticsResponse,
    GlobalAnalyticsResponse,
    ContentAnalyticsResponse,
    CampaignSummaryCard,
    CalculatedRates,
    CampaignPerformanceResponse,
)
from ..config import settings

logger = logging.getLogger(__name__)


# =============================================================================
# PART 3: DETERMINISTIC RATE CALCULATIONS (DIVISION-BY-ZERO SAFE)
# =============================================================================

def calc_engagement_rate(likes: int, comments: int, shares: int, saves: int, reach: int) -> float:
    """Engagement rate = (likes + comments + shares + saves) / reach * 100 (safe if reach == 0)."""
    if not reach or reach <= 0:
        return 0.0
    val = ((likes + comments + shares + saves) / float(reach)) * 100.0
    return round(val, 2)


def calc_click_through_rate(clicks: int, impressions: int) -> float:
    """CTR = clicks / impressions * 100 (safe if impressions == 0)."""
    if not impressions or impressions <= 0:
        return 0.0
    val = (clicks / float(impressions)) * 100.0
    return round(val, 2)


def calc_conversion_rate(conversions: int, clicks: int) -> float:
    """Conversion rate = conversions / clicks * 100 (safe if clicks == 0)."""
    if not clicks or clicks <= 0:
        return 0.0
    val = (conversions / float(clicks)) * 100.0
    return round(val, 2)


def calc_save_rate(saves: int, reach: int) -> float:
    """Save rate = saves / reach * 100 (safe if reach == 0)."""
    if not reach or reach <= 0:
        return 0.0
    val = (saves / float(reach)) * 100.0
    return round(val, 2)


def calc_share_rate(shares: int, reach: int) -> float:
    """Share rate = shares / reach * 100 (safe if reach == 0)."""
    if not reach or reach <= 0:
        return 0.0
    val = (shares / float(reach)) * 100.0
    return round(val, 2)


# =============================================================================
# PART 30: DATA INTEGRITY & VALIDATION
# =============================================================================

def validate_performance_metrics(
    impressions: int,
    reach: int,
    likes: int,
    comments: int,
    shares: int,
    saves: int,
    clicks: int,
    conversions: int,
) -> None:
    """Validates metric bounds and logical constraints."""
    if any(m < 0 for m in [impressions, reach, likes, comments, shares, saves, clicks, conversions]):
        raise ValueError("Performance metrics cannot be negative.")

    if impressions > 0 and clicks > impressions:
        raise ValueError("Clicks cannot exceed impressions.")

    if clicks > 0 and conversions > clicks:
        raise ValueError("Conversions cannot exceed clicks.")

    if impressions > 0 and reach > impressions:
        raise ValueError("Reach cannot exceed impressions.")

    if clicks == 0 and conversions > 0:
        raise ValueError("Conversions cannot exceed clicks.")


# =============================================================================
# CORE PERFORMANCE INGESTION & DEMO SEEDING
# =============================================================================

def record_performance_data(
    db: Session,
    campaign_id: str,
    payload: PerformanceEntryCreate,
    campaign_content_id: Optional[str] = None,
) -> CampaignPerformance:
    """Validates and persists a performance record to SQLite."""
    validate_performance_metrics(
        impressions=payload.impressions,
        reach=payload.reach,
        likes=payload.likes,
        comments=payload.comments,
        shares=payload.shares,
        saves=payload.saves,
        clicks=payload.clicks,
        conversions=payload.conversions,
    )

    campaign = db.query(Campaign).filter(Campaign.id == campaign_id).first()
    if not campaign:
        raise ValueError(f"Campaign with ID '{campaign_id}' not found.")

    target_content_id = campaign_content_id or payload.campaign_content_id
    platform = (payload.platform or "").lower()

    if target_content_id:
        content = db.query(CampaignContent).filter(CampaignContent.id == target_content_id).first()
        if content:
            if not platform:
                platform = content.platform
            elif platform != content.platform.lower():
                raise ValueError(f"Specified platform '{platform}' does not match content platform '{content.platform}'.")

    if not platform:
        platform = "instagram"

    # Compute rates
    eng_rate = calc_engagement_rate(
        likes=payload.likes,
        comments=payload.comments,
        shares=payload.shares,
        saves=payload.saves,
        reach=payload.reach,
    )
    conv_rate = calc_conversion_rate(
        conversions=payload.conversions,
        clicks=payload.clicks,
    )

    rec_time = payload.recorded_at or datetime.utcnow()

    perf = CampaignPerformance(
        id=str(uuid.uuid4()),
        campaign_id=campaign_id,
        campaign_content_id=target_content_id,
        platform=platform,
        impressions=payload.impressions,
        reach=payload.reach,
        likes=payload.likes,
        comments=payload.comments,
        shares=payload.shares,
        saves=payload.saves,
        clicks=payload.clicks,
        conversions=payload.conversions,
        engagement_rate=eng_rate,
        conversion_rate=conv_rate,
        recorded_at=rec_time,
        created_at=datetime.utcnow(),
    )
    db.add(perf)
    db.commit()
    db.refresh(perf)

    return perf


def seed_demo_performance_data(db: Session, campaign_id: Optional[str] = None) -> List[CampaignPerformance]:
    """Generates deterministic, realistic demo performance data for campaigns."""
    camp_query = db.query(Campaign)
    if campaign_id:
        camp_query = camp_query.filter(Campaign.id == campaign_id)
    campaigns = camp_query.all()

    created: List[CampaignPerformance] = []
    base_date = datetime.utcnow() - timedelta(days=14)

    # Deterministic platform profiles
    platform_profiles = {
        "instagram": {"imp": 12500, "reach": 8800, "likes": 560, "comm": 74, "shares": 110, "saves": 190, "clicks": 320, "conv": 44},
        "linkedin": {"imp": 8900, "reach": 6400, "likes": 340, "comm": 62, "shares": 78, "saves": 130, "clicks": 280, "conv": 38},
        "x": {"imp": 15400, "reach": 9200, "likes": 410, "comm": 85, "shares": 160, "saves": 95, "clicks": 210, "conv": 22},
        "youtube_shorts": {"imp": 21000, "reach": 14200, "likes": 890, "comm": 115, "shares": 210, "saves": 280, "clicks": 450, "conv": 56},
    }

    for c_idx, camp in enumerate(campaigns):
        contents = db.query(CampaignContent).filter(CampaignContent.campaign_id == camp.id).all()

        for idx, content in enumerate(contents):
            # Check if performance already exists for this content
            existing = db.query(CampaignPerformance).filter(CampaignPerformance.campaign_content_id == content.id).first()
            if existing:
                continue

            prof = platform_profiles.get(content.platform.lower(), platform_profiles["instagram"])
            # Apply slight deterministic variation per campaign and index
            factor = 1.0 + ((c_idx * 3 + idx * 7) % 25) / 100.0  # 1.00 to 1.24

            imp = int(prof["imp"] * factor)
            reach = int(prof["reach"] * factor)
            likes = int(prof["likes"] * factor)
            comm = int(prof["comm"] * factor)
            shares = int(prof["shares"] * factor)
            saves = int(prof["saves"] * factor)
            clicks = int(prof["clicks"] * factor)
            conv = int(prof["conv"] * factor)

            eng_rate = calc_engagement_rate(likes, comm, shares, saves, reach)
            conv_rate = calc_conversion_rate(conv, clicks)
            rec_date = base_date + timedelta(days=(idx * 2) % 12, hours=(idx * 3) % 24)

            perf = CampaignPerformance(
                id=str(uuid.uuid4()),
                campaign_id=camp.id,
                campaign_content_id=content.id,
                platform=content.platform,
                impressions=imp,
                reach=reach,
                likes=likes,
                comments=comm,
                shares=shares,
                saves=saves,
                clicks=clicks,
                conversions=conv,
                engagement_rate=eng_rate,
                conversion_rate=conv_rate,
                recorded_at=rec_date,
                created_at=datetime.utcnow(),
            )
            db.add(perf)
            created.append(perf)

    if created:
        db.commit()

    return created


# =============================================================================
# PART 4 & 5: AGGREGATIONS & PLATFORM ANALYTICS
# =============================================================================

def build_kpi_summary(performances: List[CampaignPerformance], schedules: List[ContentSchedule], total_campaigns: int = 1) -> AnalyticsKPISummary:
    """Aggregates high-level metrics across all filtered performance records."""
    if not performances:
        pub_count = len([s for s in schedules if s.status == "published"])
        sched_count = len([s for s in schedules if s.status == "scheduled"])
        fail_count = len([s for s in schedules if s.status == "failed"])
        return AnalyticsKPISummary(
            total_impressions=0,
            total_reach=0,
            total_likes=0,
            total_comments=0,
            total_shares=0,
            total_saves=0,
            total_clicks=0,
            total_conversions=0,
            avg_engagement_rate=0.0,
            avg_conversion_rate=0.0,
            avg_click_through_rate=0.0,
            published_count=pub_count,
            scheduled_count=sched_count,
            failed_count=fail_count,
            total_campaigns=total_campaigns,
        )

    tot_imp = sum(p.impressions for p in performances)
    tot_reach = sum(p.reach for p in performances)
    tot_likes = sum(p.likes for p in performances)
    tot_comm = sum(p.comments for p in performances)
    tot_shares = sum(p.shares for p in performances)
    tot_saves = sum(p.saves for p in performances)
    tot_clicks = sum(p.clicks for p in performances)
    tot_conv = sum(p.conversions for p in performances)

    avg_eng = calc_engagement_rate(tot_likes, tot_comm, tot_shares, tot_saves, tot_reach)
    avg_conv = calc_conversion_rate(tot_conv, tot_clicks)
    avg_ctr = calc_click_through_rate(tot_clicks, tot_imp)

    pub_count = len([s for s in schedules if s.status == "published"])
    sched_count = len([s for s in schedules if s.status == "scheduled"])
    fail_count = len([s for s in schedules if s.status == "failed"])

    return AnalyticsKPISummary(
        total_impressions=tot_imp,
        total_reach=tot_reach,
        total_likes=tot_likes,
        total_comments=tot_comm,
        total_shares=tot_shares,
        total_saves=tot_saves,
        total_clicks=tot_clicks,
        total_conversions=tot_conv,
        avg_engagement_rate=avg_eng,
        avg_conversion_rate=avg_conv,
        avg_click_through_rate=avg_ctr,
        published_count=pub_count,
        scheduled_count=sched_count,
        failed_count=fail_count,
        total_campaigns=total_campaigns,
    )


def build_platform_summaries(
    performances: List[CampaignPerformance],
    contents: List[CampaignContent],
    platform_filter: Optional[str] = None,
) -> List[PlatformPerformanceSummary]:
    """Aggregates performance by platform with contextual highlights."""
    if platform_filter and platform_filter.lower() != "all":
        platforms = [platform_filter.lower()]
    else:
        platforms = ["instagram", "linkedin", "x", "youtube_shorts"]
    summaries: List[PlatformPerformanceSummary] = []


    # Map content count per platform
    content_counts: Dict[str, int] = {}
    for c in contents:
        p = c.platform.lower()
        content_counts[p] = content_counts.get(p, 0) + 1

    # Map performances by platform
    by_plat: Dict[str, List[CampaignPerformance]] = {}
    for p in performances:
        plat = p.platform.lower()
        if plat not in by_plat:
            by_plat[plat] = []
        by_plat[plat].append(p)

    for plat in platforms:
        plat_perfs = by_plat.get(plat, [])
        c_count = content_counts.get(plat, len(plat_perfs))

        if not plat_perfs:
            summaries.append(PlatformPerformanceSummary(
                platform=plat,
                content_count=c_count,
                impressions=0,
                reach=0,
                engagement=0,
                likes=0,
                comments=0,
                shares=0,
                saves=0,
                clicks=0,
                conversions=0,
                engagement_rate=0.0,
                conversion_rate=0.0,
                click_through_rate=0.0,
                save_rate=0.0,
                share_rate=0.0,
                contextual_note="No performance records logged yet.",
            ))
            continue

        p_imp = sum(p.impressions for p in plat_perfs)
        p_reach = sum(p.reach for p in plat_perfs)
        p_likes = sum(p.likes for p in plat_perfs)
        p_comm = sum(p.comments for p in plat_perfs)
        p_shares = sum(p.shares for p in plat_perfs)
        p_saves = sum(p.saves for p in plat_perfs)
        p_clicks = sum(p.clicks for p in plat_perfs)
        p_conv = sum(p.conversions for p in plat_perfs)
        p_eng = p_likes + p_comm + p_shares + p_saves

        eng_rate = calc_engagement_rate(p_likes, p_comm, p_shares, p_saves, p_reach)
        conv_rate = calc_conversion_rate(p_conv, p_clicks)
        ctr = calc_click_through_rate(p_clicks, p_imp)
        save_r = calc_save_rate(p_saves, p_reach)
        share_r = calc_share_rate(p_shares, p_reach)

        summaries.append(PlatformPerformanceSummary(
            platform=plat,
            content_count=max(c_count, len(plat_perfs)),
            impressions=p_imp,
            reach=p_reach,
            engagement=p_eng,
            likes=p_likes,
            comments=p_comm,
            shares=p_shares,
            saves=p_saves,
            clicks=p_clicks,
            conversions=p_conv,
            engagement_rate=eng_rate,
            conversion_rate=conv_rate,
            click_through_rate=ctr,
            save_rate=save_r,
            share_rate=share_r,
        ))

    # Add contextual relative notes
    valid_sums = [s for s in summaries if s.reach > 0]
    if valid_sums:
        highest_eng = max(valid_sums, key=lambda s: s.engagement_rate)
        highest_conv = max(valid_sums, key=lambda s: s.conversion_rate)
        highest_clicks = max(valid_sums, key=lambda s: s.clicks)
        highest_saves = max(valid_sums, key=lambda s: s.saves)

        for s in summaries:
            notes = []
            if s.platform == highest_eng.platform and s.engagement_rate > 0:
                notes.append("Highest engagement rate in this campaign")
            if s.platform == highest_conv.platform and s.conversions > 0:
                notes.append("Highest conversion efficiency")
            if s.platform == highest_clicks.platform and s.clicks > 0 and s.platform != highest_conv.platform:
                notes.append("Top traffic / click volume")
            if s.platform == highest_saves.platform and s.saves > 0 and s.platform != highest_eng.platform:
                notes.append("Strongest bookmark / save rate")

            s.contextual_note = " · ".join(notes) if notes else "Consistent baseline engagement"

    return summaries


# =============================================================================
# PART 6: CONTENT PERFORMANCE LEADERBOARD
# =============================================================================

def build_content_leaderboard(
    db: Session,
    performances: List[CampaignPerformance],
    contents: List[CampaignContent],
    metric_sort: str = "engagement_rate",
) -> List[ContentLeaderboardItem]:
    """Builds a sortable individual content performance leaderboard."""
    items: List[ContentLeaderboardItem] = []

    # Map content items
    content_map = {c.id: c for c in contents}
    strategy_map = {s.id: s for s in db.query(CampaignStrategy).all()}
    schedule_map = {sc.campaign_content_id: sc for sc in db.query(ContentSchedule).all()}

    # Group performance by content ID
    perf_by_content: Dict[str, List[CampaignPerformance]] = {}
    for p in performances:
        cid = p.campaign_content_id or f"orphan_{p.id}"
        if cid not in perf_by_content:
            perf_by_content[cid] = []
        perf_by_content[cid].append(p)

    for content_id, content in content_map.items():
        c_perfs = perf_by_content.get(content_id, [])
        strat = strategy_map.get(content.strategy_id)
        sched = schedule_map.get(content_id)

        imp = sum(p.impressions for p in c_perfs)
        reach = sum(p.reach for p in c_perfs)
        likes = sum(p.likes for p in c_perfs)
        comm = sum(p.comments for p in c_perfs)
        shares = sum(p.shares for p in c_perfs)
        saves = sum(p.saves for p in c_perfs)
        clicks = sum(p.clicks for p in c_perfs)
        conv = sum(p.conversions for p in c_perfs)

        eng_rate = calc_engagement_rate(likes, comm, shares, saves, reach)
        conv_rate = calc_conversion_rate(conv, clicks)
        ctr = calc_click_through_rate(clicks, imp)
        save_r = calc_save_rate(saves, reach)
        share_r = calc_share_rate(shares, reach)

        pub_status = sched.status if sched else ("published" if c_perfs else "draft")
        ext_id = sched.external_post_id if sched else None

        items.append(ContentLeaderboardItem(
            id=content.id,
            campaign_id=content.campaign_id,
            title=content.title or f"{content.platform.title()} {content.content_type.title()}",
            platform=content.platform,
            content_type=content.content_type,
            strategy_id=content.strategy_id,
            strategy_label=strat.label if strat else "Strategy Direction",
            approval_status=content.approval_status or "pending_review",
            publishing_status=pub_status,
            external_post_id=ext_id,
            impressions=imp,
            reach=reach,
            likes=likes,
            comments=comm,
            shares=shares,
            saves=saves,
            clicks=clicks,
            conversions=conv,
            engagement_rate=eng_rate,
            conversion_rate=conv_rate,
            click_through_rate=ctr,
            save_rate=save_r,
            share_rate=share_r,
        ))

    # Sort based on requested metric
    sort_key_map = {
        "engagement_rate": lambda x: (x.engagement_rate, x.reach),
        "clicks": lambda x: (x.clicks, x.conversions),
        "conversions": lambda x: (x.conversions, x.clicks),
        "conversion_rate": lambda x: (x.conversion_rate, x.conversions),
        "saves": lambda x: (x.saves, x.reach),
        "shares": lambda x: (x.shares, x.reach),
        "impressions": lambda x: (x.impressions, x.clicks),
    }

    sort_fn = sort_key_map.get(metric_sort, sort_key_map["engagement_rate"])
    items.sort(key=sort_fn, reverse=True)

    return items


# =============================================================================
# PART 7: PERFORMANCE TRENDS OVER TIME
# =============================================================================

def build_trend_points(performances: List[CampaignPerformance], date_range: str = "all") -> Tuple[List[PerformanceTrendPoint], bool]:
    """Computes daily aggregated performance trend points within date_range."""
    if not performances:
        return [], False

    # Filter by date range
    now = datetime.utcnow()
    cutoff: Optional[datetime] = None
    if date_range == "7d":
        cutoff = now - timedelta(days=7)
    elif date_range == "30d":
        cutoff = now - timedelta(days=30)
    elif date_range == "90d":
        cutoff = now - timedelta(days=90)

    filtered = [p for p in performances if (cutoff is None or p.recorded_at >= cutoff)]
    if not filtered:
        return [], False

    # Group by date string YYYY-MM-DD
    grouped: Dict[str, List[CampaignPerformance]] = {}
    for p in filtered:
        d_str = p.recorded_at.strftime("%Y-%m-%d")
        if d_str not in grouped:
            grouped[d_str] = []
        grouped[d_str].append(p)

    trend_points: List[PerformanceTrendPoint] = []
    for d_str in sorted(grouped.keys()):
        day_perfs = grouped[d_str]
        d_imp = sum(p.impressions for p in day_perfs)
        d_reach = sum(p.reach for p in day_perfs)
        d_likes = sum(p.likes for p in day_perfs)
        d_comm = sum(p.comments for p in day_perfs)
        d_shares = sum(p.shares for p in day_perfs)
        d_saves = sum(p.saves for p in day_perfs)
        d_clicks = sum(p.clicks for p in day_perfs)
        d_conv = sum(p.conversions for p in day_perfs)
        d_eng = d_likes + d_comm + d_shares + d_saves

        eng_r = calc_engagement_rate(d_likes, d_comm, d_shares, d_saves, d_reach)
        conv_r = calc_conversion_rate(d_conv, d_clicks)

        trend_points.append(PerformanceTrendPoint(
            date=d_str,
            impressions=d_imp,
            reach=d_reach,
            engagement=d_eng,
            clicks=d_clicks,
            conversions=d_conv,
            engagement_rate=eng_r,
            conversion_rate=conv_r,
        ))

    # A trend is reliable if we have at least 2 distinct data points or meaningful volume
    has_sufficient = len(trend_points) >= 2 or sum(tp.impressions for tp in trend_points) > 500

    return trend_points, has_sufficient


# =============================================================================
# PART 8 & 9: AI ANALYTICS INSIGHTS (OBSERVATION / INTERPRETATION / RECOMMENDATION)
# =============================================================================

def generate_analytics_insights(
    performances: List[CampaignPerformance],
    contents: List[CampaignContent],
    strategies: List[CampaignStrategy],
    campaigns: List[Campaign],
) -> List[AnalyticsInsight]:
    """Generates structured AI insights distinguishing Observation, Interpretation, and Recommendation."""
    insights: List[AnalyticsInsight] = []
    total_records = len(performances)

    if total_records == 0:
        return [
            AnalyticsInsight(
                type="general",
                title="Baseline Setup: Awaiting Performance Data",
                observation="No campaign performance records have been logged yet.",
                interpretation="Campaign content has been generated and approved, but performance measurement is not yet active.",
                recommendation="Publish campaign content and enter post-launch metrics to initiate AI continuous learning.",
                confidence="low",
                supporting_metric="0 active records",
            )
        ]

    # Compute confidence based on volume
    if total_records >= 5:
        conf = "high"
    elif total_records >= 3:
        conf = "medium"
    else:
        conf = "low"

    # 1. Strategy-level Performance Insight
    strat_map = {s.id: s for s in strategies}
    content_strat_map = {c.id: c.strategy_id for c in contents}

    strat_perf: Dict[str, List[CampaignPerformance]] = {}
    for p in performances:
        if p.campaign_content_id and p.campaign_content_id in content_strat_map:
            sid = content_strat_map[p.campaign_content_id]
            st = strat_map.get(sid).strategy_type if sid in strat_map else "general"
        else:
            st = "story"  # default
        if st not in strat_perf:
            strat_perf[st] = []
        strat_perf[st].append(p)

    story_perfs = strat_perf.get("story", [])
    product_perfs = strat_perf.get("product", [])

    if story_perfs and product_perfs:
        story_eng = sum(p.engagement_rate for p in story_perfs) / len(story_perfs)
        prod_eng = sum(p.engagement_rate for p in product_perfs) / len(product_perfs)

        if story_eng >= prod_eng:
            insights.append(AnalyticsInsight(
                type="strategy",
                title="Narrative Resonance: Story-Led Positioning Outperforms Feature Listings",
                observation=f"Story-Led assets generated a {story_eng:.1f}% average engagement rate versus {prod_eng:.1f}% for Product-Led assets in this campaign sample.",
                interpretation="Narrative-first copy that centers on creator struggle and vision elicits stronger emotional connection and social bookmarking than standalone feature lists.",
                recommendation="Consider testing another Story-Led direction in the upcoming campaign to build top-of-funnel brand affinity.",
                confidence=conf,
                supporting_metric=f"{story_eng:.1f}% vs {prod_eng:.1f}% avg engagement",
            ))
        else:
            insights.append(AnalyticsInsight(
                type="strategy",
                title="Utility Velocity: Product-Led Demonstrations Drive Conversion Velocity",
                observation=f"Product-Led assets generated a {prod_eng:.1f}% engagement rate and higher direct click-through compared to narrative assets ({story_eng:.1f}%).",
                interpretation="Audiences in this market segment appear highly utility-driven, responding faster to concrete workflow walkthroughs and interface demonstrations.",
                recommendation="Prioritize tangible product workflows and feature side-by-sides in the next campaign cycle.",
                confidence=conf,
                supporting_metric=f"{prod_eng:.1f}% Product-Led engagement",
            ))

    # 2. Platform Synergy Insight
    plat_perfs: Dict[str, List[CampaignPerformance]] = {}
    for p in performances:
        plat = p.platform.lower()
        if plat not in plat_perfs:
            plat_perfs[plat] = []
        plat_perfs[plat].append(p)

    if "instagram" in plat_perfs and "linkedin" in plat_perfs:
        ig_reach = sum(p.reach for p in plat_perfs["instagram"])
        ig_eng = sum(p.engagement_rate for p in plat_perfs["instagram"]) / len(plat_perfs["instagram"])
        li_clicks = sum(p.clicks for p in plat_perfs["linkedin"])
        li_conv = sum(p.conversions for p in plat_perfs["linkedin"])
        li_conv_rate = calc_conversion_rate(li_conv, li_clicks)

        insights.append(AnalyticsInsight(
            type="platform",
            title="Multi-Channel Funnel: Instagram Drives Engagement, LinkedIn Converts",
            observation=f"Instagram generated the highest engagement rate ({ig_eng:.1f}%) across {ig_reach:,} reach, while LinkedIn delivered higher bottom-funnel conversion efficiency ({li_conv_rate:.1f}%).",
            interpretation="Cross-channel audiences use Instagram for brand discovery and aesthetic validation, while LinkedIn drives professional consideration and purchase intent.",
            recommendation="Allocate visually captivating hero reels to Instagram and deploy substantiated product case studies on LinkedIn.",
            confidence=conf,
            supporting_metric=f"{ig_eng:.1f}% IG engagement · {li_conv_rate:.1f}% LinkedIn conversion",
        ))
    elif plat_perfs:
        best_plat = max(plat_perfs.keys(), key=lambda k: sum(p.engagement_rate for p in plat_perfs[k]) / max(1, len(plat_perfs[k])))
        best_rate = sum(p.engagement_rate for p in plat_perfs[best_plat]) / max(1, len(plat_perfs[best_plat]))
        insights.append(AnalyticsInsight(
            type="platform",
            title=f"{best_plat.title()} Channel Outperformance",
            observation=f"{best_plat.title()} generated a {best_rate:.1f}% average engagement rate across logged campaign assets.",
            interpretation=f"Audience responsiveness to your brand tone is currently highest on {best_plat.title()}.",
            recommendation=f"Consider allocating an additional content variation to {best_plat.title()} in the next sprint.",
            confidence=conf,
            supporting_metric=f"{best_rate:.1f}% engagement on {best_plat.title()}",
        ))

    # 3. CTA & Conversion Insight
    total_clicks = sum(p.clicks for p in performances)
    total_conv = sum(p.conversions for p in performances)
    tot_saves = sum(p.saves for p in performances)

    if total_clicks > 0:
        overall_conv_r = calc_conversion_rate(total_conv, total_clicks)
        insights.append(AnalyticsInsight(
            type="conversion",
            title="Intent Capture: High Save Volume Signals Strong Long-Tail Consideration",
            observation=f"Logged assets generated {total_clicks:,} total clicks, resulting in {total_conv:,} conversions ({overall_conv_r:.1f}% conversion rate) alongside {tot_saves:,} bookmark saves.",
            interpretation="High save counts indicate that users are bookmarking high-value creative assets for subsequent reference prior to purchase.",
            recommendation="Test concise, single-action CTAs ('Download the Guide', 'Start Free Trial') to reduce cognitive friction at the point of conversion.",
            confidence=conf,
            supporting_metric=f"{overall_conv_r:.1f}% conversion rate · {tot_saves:,} total saves",
        ))

    return insights[:4]


# =============================================================================
# PART 13: ENDPOINT HANDLERS (GLOBAL, CAMPAIGN, CONTENT ANALYTICS)
# =============================================================================

def get_global_analytics(
    db: Session,
    date_range: str = "all",
    platform: Optional[str] = None,
    metric_sort: str = "engagement_rate",
) -> GlobalAnalyticsResponse:
    """Builds global cross-campaign analytics response."""
    # Seed demo data if DB has campaigns and content but zero performances
    perf_count = db.query(CampaignPerformance).count()
    is_demo = False
    if perf_count == 0:
        seeded = seed_demo_performance_data(db)
        if seeded:
            is_demo = True
    else:
        # Check if performances are flagged demo
        is_demo = True  # In simulated environment all seeded records represent demo analytics

    query = db.query(CampaignPerformance)
    if platform and platform != "all":
        query = query.filter(CampaignPerformance.platform == platform.lower())
    performances = query.all()

    campaigns = db.query(Campaign).order_by(Campaign.created_at.desc()).all()
    contents = db.query(CampaignContent).all()
    strategies = db.query(CampaignStrategy).all()
    schedules = db.query(ContentSchedule).all()

    # KPI summary
    kpis = build_kpi_summary(performances, schedules, total_campaigns=len(campaigns))

    # Platform summaries
    plat_sums = build_platform_summaries(performances, contents, platform_filter=platform)

    # Leaderboard
    leaderboard = build_content_leaderboard(db, performances, contents, metric_sort=metric_sort)

    # Trends
    trends, has_sufficient = build_trend_points(performances, date_range=date_range)

    # Insights
    insights = generate_analytics_insights(performances, contents, strategies, campaigns)

    # Import optimization service
    from .optimization_service import generate_optimization_recommendations
    recommendations = generate_optimization_recommendations(db)

    # Build campaign summary cards
    campaign_cards: List[CampaignSummaryCard] = []
    for c in campaigns:
        c_perfs = [p for p in performances if p.campaign_id == c.id]
        c_scheds = [s for s in schedules if s.campaign_id == c.id]
        c_reach = sum(p.reach for p in c_perfs)
        c_conv = sum(p.conversions for p in c_perfs)
        c_eng = (sum(p.engagement_rate for p in c_perfs) / len(c_perfs)) if c_perfs else 0.0
        pub_cnt = len([s for s in c_scheds if s.status == "published"]) or len(c_perfs)

        campaign_cards.append(CampaignSummaryCard(
            id=c.id,
            name=c.name,
            objective=c.objective,
            status=c.status,
            published_count=pub_cnt,
            total_reach=c_reach,
            avg_engagement_rate=round(c_eng, 2),
            total_conversions=c_conv,
            created_at=c.created_at,
        ))

    notice = None
    if not has_sufficient:
        notice = "Not enough performance data to display a reliable trend."

    return GlobalAnalyticsResponse(
        kpis=kpis,
        platforms=plat_sums,
        leaderboard=leaderboard[:10],
        trends=trends,
        insights=insights,
        recommendations=recommendations,
        campaigns_summary=campaign_cards,
        is_demo_data=is_demo,
        has_sufficient_data=has_sufficient,
        notice_message=notice,
    )


def get_campaign_analytics(
    db: Session,
    campaign_id: str,
    date_range: str = "all",
    platform: Optional[str] = None,
    metric_sort: str = "engagement_rate",
) -> CampaignAnalyticsResponse:
    """Builds campaign-scoped analytics response."""
    camp = db.query(Campaign).filter(Campaign.id == campaign_id).first()
    if not camp:
        raise ValueError(f"Campaign '{campaign_id}' not found.")

    # Check for performance records
    c_perfs_count = db.query(CampaignPerformance).filter(CampaignPerformance.campaign_id == campaign_id).count()
    is_demo = False
    if c_perfs_count == 0:
        seeded = seed_demo_performance_data(db, campaign_id=campaign_id)
        if seeded:
            is_demo = True
    else:
        is_demo = True

    perf_q = db.query(CampaignPerformance).filter(CampaignPerformance.campaign_id == campaign_id)
    if platform and platform != "all":
        perf_q = perf_q.filter(CampaignPerformance.platform == platform.lower())
    performances = perf_q.all()

    contents = db.query(CampaignContent).filter(CampaignContent.campaign_id == campaign_id).all()
    strategies = db.query(CampaignStrategy).filter(CampaignStrategy.campaign_id == campaign_id).all()
    schedules = db.query(ContentSchedule).filter(ContentSchedule.campaign_id == campaign_id).all()

    kpis = build_kpi_summary(performances, schedules, total_campaigns=1)
    plat_sums = build_platform_summaries(performances, contents, platform_filter=platform)
    leaderboard = build_content_leaderboard(db, performances, contents, metric_sort=metric_sort)
    trends, has_sufficient = build_trend_points(performances, date_range=date_range)
    insights = generate_analytics_insights(performances, contents, strategies, [camp])

    from .optimization_service import generate_optimization_recommendations
    recommendations = generate_optimization_recommendations(db, campaign_id=campaign_id)

    notice = None
    if not has_sufficient:
        notice = "Not enough performance data to display a reliable trend."

    return CampaignAnalyticsResponse(
        campaign_id=camp.id,
        campaign_name=camp.name,
        kpis=kpis,
        platforms=plat_sums,
        leaderboard=leaderboard,
        trends=trends,
        insights=insights,
        recommendations=recommendations,
        is_demo_data=is_demo,
        has_sufficient_data=has_sufficient,
        notice_message=notice,
    )


def get_content_analytics(db: Session, content_id: str) -> ContentAnalyticsResponse:
    """Retrieves deep analytics for an individual content asset."""
    content = db.query(CampaignContent).filter(CampaignContent.id == content_id).first()
    if not content:
        raise ValueError(f"Content with ID '{content_id}' not found.")

    camp = db.query(Campaign).filter(Campaign.id == content.campaign_id).first()
    strat = db.query(CampaignStrategy).filter(CampaignStrategy.id == content.strategy_id).first()
    sched = db.query(ContentSchedule).filter(ContentSchedule.campaign_content_id == content_id).first()
    audit = db.query(ContentAudit).filter(ContentAudit.campaign_content_id == content_id, ContentAudit.is_current == True).first()
    rev_count = db.query(ContentRevision).filter(ContentRevision.campaign_content_id == content_id).count() or 1

    perf = db.query(CampaignPerformance).filter(CampaignPerformance.campaign_content_id == content_id).first()

    if perf:
        rates = CalculatedRates(
            engagement_rate=calc_engagement_rate(perf.likes, perf.comments, perf.shares, perf.saves, perf.reach),
            click_through_rate=calc_click_through_rate(perf.clicks, perf.impressions),
            conversion_rate=calc_conversion_rate(perf.conversions, perf.clicks),
            save_rate=calc_save_rate(perf.saves, perf.reach),
            share_rate=calc_share_rate(perf.shares, perf.reach),
        )
        perf_res = CampaignPerformanceResponse.model_validate(perf)
    else:
        rates = CalculatedRates()
        perf_res = None


    return ContentAnalyticsResponse(
        content_id=content.id,
        campaign_id=content.campaign_id,
        campaign_name=camp.name if camp else None,
        title=content.title or f"{content.platform.title()} {content.content_type.title()}",
        platform=content.platform,
        content_type=content.content_type,
        strategy_label=strat.label if strat else "Strategy Direction",
        approval_status=content.approval_status or "pending_review",
        publishing_status=sched.status if sched else ("published" if perf else "draft"),
        external_post_id=sched.external_post_id if sched else None,
        performance=perf_res,
        calculated_rates=rates,
        audit_status=audit.overall_status if audit else None,
        revision_count=rev_count,
        is_demo_data=True if perf else False,
    )
