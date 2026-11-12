#!/usr/bin/env python3
"""
M3 Malaria Surveillance Platform
Final Technical and Clinical Governance Submission Generator
Generates: docs/M3_Final_Technical_Clinical_Governance_Submission.docx
"""

import os
import sys
import docx
from docx.shared import Inches, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT, WD_ALIGN_VERTICAL
from docx.oxml import parse_xml, OxmlElement
from docx.oxml.ns import nsdecls, qn

def create_document():
    doc = docx.Document()
    
    # Page setup - Margins
    for section in doc.sections:
        section.top_margin = Inches(0.8)
        section.bottom_margin = Inches(0.8)
        section.left_margin = Inches(0.8)
        section.right_margin = Inches(0.8)
        
        # Configure Header & Footer
        header = section.header
        hp = header.paragraphs[0]
        hp.alignment = WD_ALIGN_PARAGRAPH.RIGHT
        hrun = hp.add_run("M3 MALARIA SURVEILLANCE PLATFORM  |  GOVERNANCE SUBMISSION v2.0.0-RC1")
        hrun.font.name = "Arial"
        hrun.font.size = Pt(8)
        hrun.font.color.rgb = RGBColor(0x88, 0x88, 0x88)
        
        footer = section.footer
        fp = footer.paragraphs[0]
        fp.alignment = WD_ALIGN_PARAGRAPH.RIGHT
        frun = fp.add_run("CONFIDENTIAL & PROPRIETARY  |  DHS GOA & NVBDCP REVIEW  |  Page ")
        frun.font.name = "Arial"
        frun.font.size = Pt(8)
        frun.font.color.rgb = RGBColor(0x88, 0x88, 0x88)
        
        fldSimple = parse_xml(r'<w:fldSimple %s w:instr="PAGE"/>' % nsdecls('w'))
        fp._p.append(fldSimple)
        
        frun2 = fp.add_run(" of ")
        frun2.font.name = "Arial"
        frun2.font.size = Pt(8)
        frun2.font.color.rgb = RGBColor(0x88, 0x88, 0x88)
        
        fldSimple2 = parse_xml(r'<w:fldSimple %s w:instr="NUMPAGES"/>' % nsdecls('w'))
        fp._p.append(fldSimple2)

    return doc

print("Document setup module loaded successfully")
