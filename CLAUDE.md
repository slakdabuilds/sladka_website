# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# Agent Instructions

You're working inside the **WAT framework** (Workflows, Agents, Tools). This architecture separates concerns so that probabilistic AI handles reasoning while deterministic code handles execution. That separation is what makes this system reliable.

## The WAT Architecture

**Layer 1: Workflows (The Instructions)**
- Markdown SOPs stored in `workflows/`
- Each workflow defines the objective, required inputs, which tools to use, expected outputs, and how to handle edge cases
- Naming convention: `verb_noun.md` (e.g. `scrape_website.md`, `send_email.md`)

**Layer 2: Agents (The Decision-Maker)**
- This is your role. Read the relevant workflow, run tools in the correct sequence, handle failures gracefully, and ask clarifying questions when needed.
- If you need to pull data from a website, don't attempt it directly. Read the relevant workflow, figure out the required inputs, then execute the appropriate tool script.

**Layer 3: Tools (The Execution)**
- Python scripts in `tools/` that do the actual work
- Each script accepts inputs via CLI args, outputs to stdout or a file, and loads credentials from `.env` via `python-dotenv`
- Errors are printed to stderr with a non-zero exit code

**Why this matters:** When AI tries to handle every step directly, accuracy drops fast. If each step is 90% accurate, you're down to 59% success after just five steps. By offloading execution to deterministic scripts, you stay focused on orchestration and decision-making where you excel.

## How to Operate

**1. Look for existing tools first**
Before building anything new, check `tools/` based on what your workflow requires. Only create new scripts when nothing exists for that task.

**2. Learn and adapt when things fail**
When you hit an error:
- Read the full error message and trace
- Fix the script and retest (if it uses paid API calls or credits, check with the user before running again)
- Document what you learned in the workflow (rate limits, timing quirks, unexpected behavior)

**3. Keep workflows current**
Workflows should evolve as you learn. When you find better methods, discover constraints, or encounter recurring issues, update the workflow. Don't create or overwrite workflows without asking unless explicitly told to.

## Setup

```bash
pip install -r requirements.txt
```

Required `.env` keys:
| Key | Used by |
|-----|---------|
| `ANTHROPIC_API_KEY` | `synthesize_content.py`, `analyze_youtube_trends.py` |
| `NANOBANANA_API_KEY` | `generate_infographics.py` (kie.ai) |
| `GMAIL_FROM` | `send_email.py` |
| `GMAIL_APP_PASSWORD` | `send_email.py` (Gmail App Password, not account password) |
| `YOUTUBE_API_KEY` | `scrape_youtube_trends.py` (optional — yt-dlp fallback if missing) |

## Available Tools

| Script | Purpose | Key input | Output |
|--------|---------|-----------|--------|
| `synthesize_content.py` | Generate structured JSON content for a topic via Claude | topic string | `.tmp/newsflow/{slug}/content.json` |
| `generate_infographics.py` | Generate infographic PNGs via kie.ai (Nanobanana) | `content.json` path | `.tmp/newsflow/{slug}/infographics/*.png` + updates `content.json` with `infographic_paths` |
| `generate_html.py` | Render self-contained HTML newsletter (base64-embeds logo + images) | `content.json` path | `.tmp/newsflow/{slug}/index.html` |
| `send_email.py` | Send HTML file via Gmail SMTP | html path, recipient email, optional subject | — |
| `scrape_youtube_trends.py` | Collect raw video data from 25 AI/automation YouTube channels + keyword searches | — (CLI flags optional) | `.tmp/youtube_trends/{date}/raw_data.json` |
| `analyze_youtube_trends.py` | Compute metrics, generate 8 brand-style charts, synthesize insights via Claude | `raw_data.json` path | `.tmp/youtube_trends/{date}/analysis.json` + `charts/*.png` |
| `generate_slides.py` | Render 13-slide McKinsey-style HTML deck (base64-embeds logo + charts) | `analysis.json` path | `.tmp/youtube_trends/{date}/slides.html` |
| `generate_grid_images.py` | Generate 27 Instagram grid images (9 slots × 3 variations) via kie.ai NANOBANANA PRO | `--client {slug}` | `.tmp/grid/{slug}/{date}/slot_N_vM.png` + `grid_review.html` |

## Workflows

### newsflow — Branded HTML news brief for any topic

```bash
TOPIC="EU AI Act 2025"
python tools/synthesize_content.py "$TOPIC"
SLUG=$(echo "$TOPIC" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9]/-/g' | sed 's/-\+/-/g' | sed 's/^-\|-$//g')
python tools/generate_infographics.py ".tmp/newsflow/$SLUG/content.json"
python tools/generate_html.py ".tmp/newsflow/$SLUG/content.json"
# Optional: email it
python tools/send_email.py ".tmp/newsflow/$SLUG/index.html" "recipient@example.com"
```

Notes:
- Infographics take ~15–30s each; total ~1–2 min for 3 images (~$0.04/image on nano-banana-2)
- `generate_html.py` renders cleanly even if infographics are missing — Step 2 is optional
- HTML is fully self-contained (base64-embedded assets) — safe to email or share directly

### youtube_trends — Weekly AI/automation YouTube trend analysis slide deck

```bash
python tools/scrape_youtube_trends.py
DATE=$(python -c "from datetime import date; print(date.today())")
python tools/analyze_youtube_trends.py ".tmp/youtube_trends/$DATE/raw_data.json"
python tools/generate_slides.py ".tmp/youtube_trends/$DATE/analysis.json"
# Optional: email it
python tools/send_email.py ".tmp/youtube_trends/$DATE/slides.html" "actiongrave@gmail.com" "Sladka - YouTube AI Trends $DATE"
```

Notes:
- No YouTube API key? Add `--fallback` to Step 1 to use yt-dlp instead (free, no credentials)
- Claude API call in Step 2 costs ~$0.01–0.05 per run
- slides.html is self-contained (8–15 MB); open in browser → Ctrl+P → Save as PDF
- See `workflows/youtube_trends.md` for full options, edge cases, and customisation

### instagram_grid — Instagram grid planning + image generation for a client

```bash
# Full generation run (after onboarding + plan approval)
python tools/generate_grid_images.py --client {slug}
# Dry run — print all 27 prompts without API calls
python tools/generate_grid_images.py --client {slug} --dry-run
# Regenerate a single slot only
python tools/generate_grid_images.py --client {slug} --slot 3
# Email review page
python tools/send_email.py ".tmp/grid/{slug}/{date}/grid_review.html" "actiongrave@gmail.com" "Grid Review — {Client} {date}"
```

Notes:
- Client profiles live in `clients/{slug}/` (permanent — not .tmp)
- Generates 27 images: 9 slots × 3 variations, 4:5 portrait, 2K, NANOBANANA PRO
- Script resumes interrupted runs automatically (skips existing files)
- ⚠️  Verify `MODEL = "nano-banana-pro"` in generate_grid_images.py against kie.ai's current model list
- Cost: ~$0.04/image = ~$1.08 per full 27-image batch
- See `workflows/instagram_grid.md` for full onboarding + planning + generation SOP

## File Structure

```
.tmp/           # Temporary files (regenerated as needed — treat as disposable)
clients/        # Permanent client profiles, reference photos, and grid plans
tools/          # Python scripts for deterministic execution
workflows/      # Markdown SOPs defining what to do and how
templates/      # Jinja2 HTML templates used by generate_html.py
brand_assets/   # Logo and brand assets embedded into HTML output
.env            # API keys (NEVER store secrets anywhere else)
```

**Core principle:** Local files are just for processing. Everything in `.tmp/` is disposable. Deliverables go to cloud services or are emailed directly.

## The Self-Improvement Loop

Every failure is a chance to make the system stronger:
1. Identify what broke
2. Fix the tool
3. Verify the fix works
4. Update the workflow with the new approach
5. Move on with a more robust system
