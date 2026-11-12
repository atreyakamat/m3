#!/usr/bin/env python3
"""
Master Builder for M3 Malaria Surveillance Platform
Final Technical and Clinical Governance Submission (DOCX & PDF)
"""

import os
import sys
import docx
from docx.shared import Inches, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.oxml import parse_xml
from docx.oxml.ns import nsdecls

# Colors
COLOR_PRIMARY = RGBColor(0x1F, 0x4E, 0x79)    # Deep Navy (#1F4E79)
COLOR_SECONDARY = RGBColor(0x2E, 0x75, 0xB6)  # Slate Blue (#2E75B6)
COLOR_DARK = RGBColor(0x26, 0x26, 0x26)       # Charcoal Body Text
COLOR_MUTED = RGBColor(0x59, 0x59, 0x59)      # Muted Gray
COLOR_WARN = RGBColor(0xB2, 0x22, 0x22)       # Firebrick Warning (#B22222)
COLOR_SUCCESS = RGBColor(0x2E, 0x69, 0x30)    # Forest Green

HEX_PRIMARY = "1F4E79"
HEX_SECONDARY = "2E75B6"
HEX_LIGHT_BG = "F4F6F9"
HEX_WARN_BG = "FDF6F6"
HEX_BORDER = "D3D3D3"
HEX_WARN_BORDER = "B22222"

def set_cell_margins(table, top=90, bottom=90, left=130, right=130):
    tblPr = table._element.xpath('w:tblPr')
    if tblPr:
        tblCellMar = parse_xml(f'''
            <w:tblCellMar {nsdecls("w")}>
                <w:top w:w="{top}" w:type="dxa"/>
                <w:bottom w:w="{bottom}" w:type="dxa"/>
                <w:left w:w="{left}" w:type="dxa"/>
                <w:right w:w="{right}" w:type="dxa"/>
            </w:tblCellMar>
        ''')
        tblPr[0].append(tblCellMar)

def set_table_borders(table, color="D3D3D3", sz="4", val="single"):
    tblPr = table._element.xpath('w:tblPr')
    if tblPr:
        borders = parse_xml(f'''
            <w:tblBorders {nsdecls("w")}>
                <w:top w:val="{val}" w:sz="{sz}" w:space="0" w:color="{color}"/>
                <w:bottom w:val="{val}" w:sz="{sz}" w:space="0" w:color="{color}"/>
                <w:left w:val="none"/>
                <w:right w:val="none"/>
                <w:insideH w:val="{val}" w:sz="{sz}" w:space="0" w:color="{color}"/>
                <w:insideV w:val="none"/>
            </w:tblBorders>
        ''')
        tblPr[0].append(borders)

def set_box_borders(table, color="1F4E79", sz="16"):
    tblPr = table._element.xpath('w:tblPr')
    if tblPr:
        borders = parse_xml(f'''
            <w:tblBorders {nsdecls("w")}>
                <w:top w:val="none"/>
                <w:bottom w:val="none"/>
                <w:left w:val="single" w:sz="{sz}" w:space="0" w:color="{color}"/>
                <w:right w:val="none"/>
                <w:insideH w:val="none"/>
                <w:insideV w:val="none"/>
            </w:tblBorders>
        ''')
        tblPr[0].append(borders)

def add_title(doc, text):
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p.paragraph_format.space_before = Pt(12)
    p.paragraph_format.space_after = Pt(4)
    run = p.add_run(text)
    run.font.name = "Arial"
    run.font.size = Pt(22)
    run.font.bold = True
    run.font.color.rgb = COLOR_PRIMARY
    return p

def add_subtitle(doc, text):
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p.paragraph_format.space_after = Pt(16)
    run = p.add_run(text)
    run.font.name = "Arial"
    run.font.size = Pt(12)
    run.font.bold = True
    run.font.color.rgb = COLOR_SECONDARY
    return p

def add_h1(doc, text):
    p = doc.add_paragraph()
    p.paragraph_format.space_before = Pt(18)
    p.paragraph_format.space_after = Pt(6)
    p.paragraph_format.keep_with_next = True
    run = p.add_run(text)
    run.font.name = "Arial"
    run.font.size = Pt(13.5)
    run.font.bold = True
    run.font.color.rgb = COLOR_PRIMARY
    return p

def add_h2(doc, text):
    p = doc.add_paragraph()
    p.paragraph_format.space_before = Pt(12)
    p.paragraph_format.space_after = Pt(4)
    p.paragraph_format.keep_with_next = True
    run = p.add_run(text)
    run.font.name = "Arial"
    run.font.size = Pt(11)
    run.font.bold = True
    run.font.color.rgb = COLOR_SECONDARY
    return p

def add_h3(doc, text):
    p = doc.add_paragraph()
    p.paragraph_format.space_before = Pt(8)
    p.paragraph_format.space_after = Pt(2)
    p.paragraph_format.keep_with_next = True
    run = p.add_run(text)
    run.font.name = "Arial"
    run.font.size = Pt(9.5)
    run.font.bold = True
    run.font.color.rgb = COLOR_DARK
    return p

def add_p(doc, text, bold_prefix=None, italic=False, space_after=4):
    p = doc.add_paragraph()
    p.paragraph_format.space_after = Pt(space_after)
    p.paragraph_format.line_spacing = 1.15
    if bold_prefix:
        r_pre = p.add_run(bold_prefix)
        r_pre.font.name = "Arial"
        r_pre.font.size = Pt(9)
        r_pre.font.bold = True
        r_pre.font.color.rgb = COLOR_DARK
    run = p.add_run(text)
    run.font.name = "Arial"
    run.font.size = Pt(9)
    run.font.italic = italic
    run.font.color.rgb = COLOR_DARK
    return p

def add_bullet(doc, text, bold_prefix=None):
    p = doc.add_paragraph(style='List Bullet')
    p.paragraph_format.space_after = Pt(2.5)
    p.paragraph_format.line_spacing = 1.15
    if bold_prefix:
        r_pre = p.add_run(bold_prefix)
        r_pre.font.name = "Arial"
        r_pre.font.size = Pt(9)
        r_pre.font.bold = True
        r_pre.font.color.rgb = COLOR_DARK
    run = p.add_run(text)
    run.font.name = "Arial"
    run.font.size = Pt(9)
    run.font.color.rgb = COLOR_DARK
    return p

def add_callout(doc, text, title="INSTITUTIONAL GOVERNANCE NOTICE", warn=False):
    table = doc.add_table(rows=1, cols=1)
    table.alignment = WD_TABLE_ALIGNMENT.CENTER
    table.autofit = False
    table.columns[0].width = Inches(6.9)
    
    set_cell_margins(table, top=110, bottom=110, left=150, right=150)
    border_color = HEX_WARN_BORDER if warn else HEX_PRIMARY
    bg_color = HEX_WARN_BG if warn else HEX_LIGHT_BG
    set_box_borders(table, color=border_color, sz="16")
    
    cell = table.rows[0].cells[0]
    tcPr = cell._element.get_or_add_tcPr()
    shd = parse_xml(f'<w:shd {nsdecls("w")} w:fill="{bg_color}"/>')
    tcPr.append(shd)
    
    p = cell.paragraphs[0]
    p.paragraph_format.space_after = Pt(2)
    p.paragraph_format.line_spacing = 1.15
    r_title = p.add_run(f"[{title}] ")
    r_title.font.name = "Arial"
    r_title.font.size = Pt(8.5)
    r_title.font.bold = True
    r_title.font.color.rgb = COLOR_WARN if warn else COLOR_PRIMARY
    
    r_text = p.add_run(text)
    r_text.font.name = "Arial"
    r_text.font.size = Pt(8.5)
    r_text.font.italic = True
    r_text.font.color.rgb = COLOR_DARK
    
    p_spacer = doc.add_paragraph()
    p_spacer.paragraph_format.space_after = Pt(3)

def add_table(doc, headers, data, col_widths=None):
    table = doc.add_table(rows=len(data) + 1, cols=len(headers))
    table.alignment = WD_TABLE_ALIGNMENT.CENTER
    table.autofit = False
    set_cell_margins(table, top=70, bottom=70, left=80, right=80)
    set_table_borders(table, color="D3D3D3", sz="4")
    
    # Header row
    hdr_row = table.rows[0]
    hdr_trPr = hdr_row._element.get_or_add_trPr()
    hdr_trPr.append(parse_xml(f'<w:tblHeader {nsdecls("w")}/>'))
    
    for c_idx, title in enumerate(headers):
        cell = hdr_row.cells[c_idx]
        if col_widths and c_idx < len(col_widths):
            cell.width = col_widths[c_idx]
        tcPr = cell._element.get_or_add_tcPr()
        shd = parse_xml(f'<w:shd {nsdecls("w")} w:fill="{HEX_PRIMARY}"/>')
        tcPr.append(shd)
        p = cell.paragraphs[0]
        p.alignment = WD_ALIGN_PARAGRAPH.LEFT
        p.paragraph_format.space_after = Pt(0)
        run = p.add_run(title)
        run.font.name = "Arial"
        run.font.size = Pt(8)
        run.font.bold = True
        run.font.color.rgb = RGBColor(0xFF, 0xFF, 0xFF)
        
    # Data rows
    for r_idx, row_data in enumerate(data):
        row = table.rows[r_idx + 1]
        bg = HEX_LIGHT_BG if r_idx % 2 == 1 else "FFFFFF"
        for c_idx, val in enumerate(row_data):
            cell = row.cells[c_idx]
            if col_widths and c_idx < len(col_widths):
                cell.width = col_widths[c_idx]
            tcPr = cell._element.get_or_add_tcPr()
            if bg != "FFFFFF":
                shd = parse_xml(f'<w:shd {nsdecls("w")} w:fill="{bg}"/>')
                tcPr.append(shd)
            p = cell.paragraphs[0]
            p.alignment = WD_ALIGN_PARAGRAPH.LEFT
            p.paragraph_format.space_after = Pt(0)
            run = p.add_run(str(val))
            run.font.name = "Arial"
            run.font.size = Pt(7.5)
            run.font.color.rgb = COLOR_DARK
            
    p_spacer = doc.add_paragraph()
    p_spacer.paragraph_format.space_after = Pt(3)
    return table

def add_image_with_caption(doc, image_path, caption, width=Inches(5.0)):
    if not os.path.exists(image_path):
        add_p(doc, f"[Image file missing: {image_path}]", italic=True)
        return
    p_img = doc.add_paragraph()
    p_img.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p_img.paragraph_format.space_before = Pt(4)
    p_img.paragraph_format.space_after = Pt(2)
    p_img.add_run().add_picture(image_path, width=width)
    
    p_cap = doc.add_paragraph()
    p_cap.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p_cap.paragraph_format.space_after = Pt(6)
    run = p_cap.add_run(caption)
    run.font.name = "Arial"
    run.font.size = Pt(7.5)
    run.font.italic = True
    run.font.color.rgb = COLOR_MUTED

def init_doc():
    doc = docx.Document()
    for section in doc.sections:
        section.top_margin = Inches(0.8)
        section.bottom_margin = Inches(0.8)
        section.left_margin = Inches(0.8)
        section.right_margin = Inches(0.8)
        
        # Header
        header = section.header
        hp = header.paragraphs[0]
        hp.alignment = WD_ALIGN_PARAGRAPH.RIGHT
        hrun = hp.add_run("M3 MALARIA SURVEILLANCE PLATFORM  |  TECHNICAL & CLINICAL GOVERNANCE SUBMISSION")
        hrun.font.name = "Arial"
        hrun.font.size = Pt(7.5)
        hrun.font.color.rgb = RGBColor(0x88, 0x88, 0x88)
        
        # Footer
        footer = section.footer
        fp = footer.paragraphs[0]
        fp.alignment = WD_ALIGN_PARAGRAPH.RIGHT
        frun = fp.add_run("GOVERNANCE SUBMISSION  |  DHS GOA & NVBDCP APPRAISAL  |  Page ")
        frun.font.name = "Arial"
        frun.font.size = Pt(7.5)
        frun.font.color.rgb = RGBColor(0x88, 0x88, 0x88)
        
        fldSimple = parse_xml(r'<w:fldSimple %s w:instr="PAGE"/>' % nsdecls('w'))
        fp._p.append(fldSimple)
        
        frun2 = fp.add_run(" of ")
        frun2.font.name = "Arial"
        frun2.font.size = Pt(7.5)
        frun2.font.color.rgb = RGBColor(0x88, 0x88, 0x88)
        
        fldSimple2 = parse_xml(r'<w:fldSimple %s w:instr="NUMPAGES"/>' % nsdecls('w'))
        fp._p.append(fldSimple2)
    return doc

print("Make governance doc core ready.")
