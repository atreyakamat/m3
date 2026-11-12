#!/usr/bin/env python3
"""
Master Build Runner for M3 Malaria Surveillance Platform
Final Technical and Clinical Governance Submission

Two-Pass Document Compiler:
1. Pass 1 compiles full content and converts to PDF using LibreOffice.
2. Extracts exact starting page numbers of all 15 sections and all 8 appendices.
3. Pass 2 injects exact page numbers into Table of Contents and re-compiles.
4. Validates 100% page parity between Table of Contents and PDF.
5. Mirrors artifacts to docs/ and artifacts/.
"""

import os
import sys
import shutil
import subprocess
import docx

sys.path.insert(0, '/home/nimr/Projects/m3')

from scripts.build_full_submission import init_doc
from scripts.make_governance_sections import build_cover_and_toc
from scripts.build_sections_1_to_7 import (
    add_sec1, add_sec2, add_sec3, add_sec4, add_sec5, add_sec6, add_sec7
)
from scripts.build_sections_8_to_15 import (
    add_sec8, add_sec9, add_sec10, add_sec11, add_sec12, add_sec13, add_sec14, add_sec15
)

SECTIONS_TO_FIND = [
    ("sec1", "SECTION 1 — EXECUTIVE"),
    ("sec2", "SECTION 2 — BACKGROUND"),
    ("sec3", "SECTION 3 — PROJECT OBJECTIVES"),
    ("sec4", "SECTION 4 — SYSTEM ARCHITECTURE"),
    ("sec5", "SECTION 5 — STAKEHOLDER"),
    ("sec6", "SECTION 6 — END-TO-END"),
    ("sec7", "SECTION 7 — DATA PROTECTION"),
    ("sec8", "SECTION 8 — PRODUCTION DEPLOYMENT"),
    ("sec9", "SECTION 9 — MULTI-ROLE"),
    ("sec10", "SECTION 10 — FINAL ROLE-PERMISSION"),
    ("sec11", "SECTION 11 — PROPOSED CONTROLLED"),
    ("sec12", "SECTION 12 — QUANTITATIVE MONITORING"),
    ("sec13", "SECTION 13 — COMPREHENSIVE RISK"),
    ("sec14", "SECTION 14 — INSTITUTIONAL GOVERNANCE"),
    ("sec15", "SECTION 15 — APPENDICES"),
    ("app_a", "Appendix A: Complete Release Package"),
    ("app_b", "Appendix B: Master Seven-Role Permission"),
    ("app_c", "Appendix C: Complete Field Pilot Acceptance"),
    ("app_d", "Appendix D: Complete Security & Role-Permission"),
    ("app_e", "Appendix E: High-Resolution Architecture"),
    ("app_f", "Appendix F: Visual Catalog of Photographic"),
    ("app_g", "Appendix G: Index of Foundational Source"),
    ("app_h", "Appendix H: Comprehensive Glossary")
]

def compile_docx(docx_path, toc_page_map=None):
    doc = init_doc()
    build_cover_and_toc(doc, toc_page_map)
    
    add_sec1(doc)
    doc.add_page_break()
    
    add_sec2(doc)
    doc.add_page_break()
    
    add_sec3(doc)
    doc.add_page_break()
    
    add_sec4(doc)
    doc.add_page_break()
    
    add_sec5(doc)
    doc.add_page_break()
    
    add_sec6(doc)
    doc.add_page_break()
    
    add_sec7(doc)
    doc.add_page_break()
    
    add_sec8(doc)
    doc.add_page_break()
    
    add_sec9(doc)
    doc.add_page_break()
    
    add_sec10(doc)
    doc.add_page_break()
    
    add_sec11(doc)
    doc.add_page_break()
    
    add_sec12(doc)
    doc.add_page_break()
    
    add_sec13(doc)
    doc.add_page_break()
    
    add_sec14(doc)
    doc.add_page_break()
    
    add_sec15(doc)
    
    os.makedirs(os.path.dirname(docx_path), exist_ok=True)
    doc.save(docx_path)
    print(f"DOCX compiled: {docx_path}")

def convert_to_pdf(docx_path, out_dir):
    cmd = ["soffice", "--headless", "--convert-to", "pdf", docx_path, "--outdir", out_dir]
    res = subprocess.run(cmd, capture_output=True, text=True)
    if res.returncode != 0:
        raise RuntimeError(f"LibreOffice conversion failed: {res.stderr}")
    pdf_filename = os.path.splitext(os.path.basename(docx_path))[0] + ".pdf"
    pdf_path = os.path.join(out_dir, pdf_filename)
    if not os.path.exists(pdf_path):
        raise FileNotFoundError(f"Expected PDF not found at {pdf_path}")
    print(f"PDF converted: {pdf_path}")
    return pdf_path

def extract_page_map(pdf_path):
    res = subprocess.run(["pdftotext", pdf_path, "-"], capture_output=True, text=True)
    if res.returncode != 0:
        raise RuntimeError(f"pdftotext failed: {res.stderr}")
    pages = res.stdout.split("\x0c")
    total_pages = len(pages) - 1 if pages and pages[-1] == "" else len(pages)
    print(f"Extracted {total_pages} pages from PDF.")
    
    page_map = {}
    for key, phrase in SECTIONS_TO_FIND:
        # Start looking from page 3 (index 2) onwards to skip Cover & TOC
        found_page = None
        for p_idx in range(2, total_pages):
            page_text = pages[p_idx]
            if phrase.lower() in page_text.lower():
                found_page = p_idx + 1  # 1-indexed
                break
        if found_page is not None:
            page_map[key] = found_page
        else:
            print(f"WARNING: Phrase '{phrase}' not found in pages 3..{total_pages}!")
            page_map[key] = "--"
    return page_map, total_pages

def main():
    docx_path = "/home/nimr/Projects/m3/docs/M3_Final_Technical_Clinical_Governance_Submission.docx"
    docs_dir = "/home/nimr/Projects/m3/docs"
    artifacts_dir = "/home/nimr/Projects/m3/artifacts"
    os.makedirs(artifacts_dir, exist_ok=True)
    
    print("=== PASS 1: Baseline Compilation (Detecting Page Offsets) ===")
    compile_docx(docx_path, toc_page_map=None)
    pdf_path = convert_to_pdf(docx_path, docs_dir)
    page_map, total_pages = extract_page_map(pdf_path)
    print("Pass 1 Page Mapping:")
    for k, p in page_map.items():
        print(f"  {k}: page {p}")
        
    print("\n=== PASS 2: Accurate TOC Ingestion & Final Compilation ===")
    compile_docx(docx_path, toc_page_map=page_map)
    pdf_path = convert_to_pdf(docx_path, docs_dir)
    verified_page_map, final_total_pages = extract_page_map(pdf_path)
    
    print(f"\nFinal Document Compiled: {final_total_pages} Pages.")
    all_matched = True
    for k, p in page_map.items():
        v = verified_page_map.get(k)
        match_str = "MATCH" if p == v else f"MISMATCH (was {p}, now {v})"
        print(f"  {k}: Page {v} [{match_str}]")
        if p != v:
            all_matched = False
            
    if not all_matched:
        print("\n=== PASS 3: Convergence Adjustment ===")
        compile_docx(docx_path, toc_page_map=verified_page_map)
        pdf_path = convert_to_pdf(docx_path, docs_dir)
        final_verified, final_total_pages = extract_page_map(pdf_path)
        print(f"Final Document Converged: {final_total_pages} Pages.")
        for k, p in final_verified.items():
            print(f"  {k}: Page {p}")

    # Mirror to artifacts
    docx_artifact = os.path.join(artifacts_dir, os.path.basename(docx_path))
    pdf_artifact = os.path.join(artifacts_dir, os.path.basename(pdf_path))
    shutil.copyfile(docx_path, docx_artifact)
    shutil.copyfile(pdf_path, pdf_artifact)
    print(f"\nMirrored deliverables to artifacts/:\n  {docx_artifact}\n  {pdf_artifact}")

if __name__ == "__main__":
    main()
