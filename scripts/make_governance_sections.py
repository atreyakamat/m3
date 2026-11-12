# Section Builders for M3 Governance Submission
import docx
from docx.shared import Inches, Pt, RGBColor
from scripts.build_full_submission import (
    add_title, add_subtitle, add_h1, add_h2, add_h3, add_p, add_bullet,
    add_callout, add_table, add_image_with_caption, HEX_PRIMARY, HEX_LIGHT_BG
)

def build_cover_and_toc(doc, toc_page_map=None):
    add_title(doc, "M3 MALARIA SURVEILLANCE PLATFORM")
    add_subtitle(doc, "FINAL TECHNICAL AND CLINICAL GOVERNANCE SUBMISSION\nInstitutional Review & Evaluation for Controlled Field Deployment in Goa")
    
    add_callout(doc, 
        "This document is a formal institutional governance submission prepared for official review by the Directorate of Health Services (DHS), Government of Goa, and the National Vector Borne Disease Control Programme (NVBDCP). It provides comprehensive architectural, clinical, and security specifications alongside full testing evidence for Release Candidate v2.0.0-RC3. This document constitutes a formal submission for institutional appraisal and does NOT claim existing government authorization, statutory clearance, or statewide clinical validation.",
        title="STATUTORY GOVERNANCE & APPRAISAL NOTICE", warn=False)
    
    # Metadata table
    meta_headers = ["Governance Dimension", "Release Specification & Audit Record"]
    meta_data = [
        ["Platform Name", "M3 Malaria Surveillance Platform (Migrant Worker Surveillance System)"],
        ["Target Population", "Interstate Migrant Construction Workers in the State of Goa"],
        ["Release Candidate", "v2.0.0-RC3 (Semantic Version 2.0.0)"],
        ["Git Release Tag", "v2.0.0-RC3 (Release Candidate Frozen)"],
        ["Git Commit Hash", "557ab75f0a0d859ebcc5938435d6481cf13ceca1 (Clean working tree)"],
        ["Release Freeze Status", "FROZEN — Strict immutability active; zero feature additions or scope alterations"],
        ["Submission Date", "November 12, 2026"],
        ["Submitted To", "Directorate of Health Services (DHS), Goa & NVBDCP State Programme Management"],
        ["Target Demonstration Facilities", "Phase 1A: Candolim PHC (PHC-CAN-01) & Calangute Health Hub / Sub-Centre (14 Days)\nPhase 1B: Panaji UPHC (Tiswadi Taluka) subject to evaluation & approval"],
        ["Target Device Hardware", "Samsung Galaxy Tab A7 Lite (SM-T225, Android 14 / API 34) — 25 Enterprise Pool"],
        ["Technical Acceptance Status", "Reported Passed: 14/14 Transfer Lifecycle Checks, 18 Languages (100% Key Parity)"],
        ["Automated Test Suites", "Reported Passed: 155 / 155 Tests (111 Mobile Jest + 44 Shared Vitest), 0 TS Errors"],
        ["Physical-Device Validation", "Reported Passed: 8 / 8 Reference UI Flows Matching M3_MOBILE_APP_UI.pptx"],
        ["Cryptographic Signature", "Android Signature Scheme v2 (CN=M3 Prototype — Restricted to Pilot Hardware)"],
        ["Institutional Approval Status", "PENDING FORMAL REVIEW & WRITTEN STATUTORY SANCTION (Separate Technical Acceptance vs Clinical Authorization vs Data Governance vs Conditional Pilot Authorization)"]
    ]
    add_table(doc, meta_headers, meta_data, [Inches(2.3), Inches(4.5)])
    
    doc.add_page_break()
    
    # Table of Contents
    add_h1(doc, "TABLE OF CONTENTS")
    
    toc_keys = [
        ("sec1", "Section 1 — Executive Summary"),
        ("sec2", "Section 2 — Background and Public Health Rationale"),
        ("sec3", "Section 3 — Project Objectives & Evolutionary Scope"),
        ("sec4", "Section 4 — Comprehensive System Architecture"),
        ("sec5", "Section 5 — Stakeholder Roles, Responsibilities & Access Boundaries"),
        ("sec6", "Section 6 — End-to-End Application Workflows"),
        ("sec7", "Section 7 — Data Protection, Privacy & Security Architecture"),
        ("sec8", "Section 8 — Production Deployment Readiness & Infrastructure Verification"),
        ("sec9", "Section 9 — Multi-Role Field Pilot Acceptance Testing"),
        ("sec10", "Section 10 — Final Role-Permission & Data-Access Security Audit"),
        ("sec11", "Section 11 — Proposed Controlled Field Deployment Plan"),
        ("sec12", "Section 12 — Quantitative Monitoring and Evaluation Framework"),
        ("sec13", "Section 13 — Comprehensive Risk Analysis & Technical Limitations"),
        ("sec14", "Section 14 — Institutional Governance and Regulatory Approval Sign-Off"),
        ("sec15", "Section 15 — Appendices"),
        ("app_a", "  Appendix A: Complete Release Package & Cryptographic Integrity Manifest"),
        ("app_b", "  Appendix B: Master Seven-Role Permission & Boundary Matrix"),
        ("app_c", "  Appendix C: Complete Field Pilot Acceptance Test Suite Matrix (44 Tests)"),
        ("app_d", "  Appendix D: Complete Security & Role-Permission Audit Matrix (41 Checks)"),
        ("app_e", "  Appendix E: High-Resolution Architecture & Workflow Schematics"),
        ("app_f", "  Appendix F: Visual Catalog of Photographic & Device Screenshots"),
        ("app_g", "  Appendix G: Index of Foundational Source Reports & Evidence Files"),
        ("app_h", "  Appendix H: Comprehensive Glossary of Technical & Epidemiological Terms"),
    ]
    
    toc_items = []
    for k, title in toc_keys:
        page_val = str(toc_page_map.get(k, "--")) if toc_page_map else "--"
        toc_items.append([title, page_val])
        
    toc_headers = ["Document Section & Sub-Modules", "Reference Page"]
    add_table(doc, toc_headers, toc_items, [Inches(5.6), Inches(1.2)])
    
    doc.add_page_break()

print("Cover and TOC module loaded.")
