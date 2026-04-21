import json, sys, os
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.units import mm
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, Image, PageBreak, HRFlowable
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_LEFT, TA_RIGHT, TA_CENTER

with open(sys.argv[1]) as f:
    d = json.load(f)

estimate = d['estimate']
items = d['items']
project = d.get('project') or {}
client = d.get('client') or {}
logo_path = d['logo_path']
out_path = d['out_path']
quote_type = estimate.get('quote_type') or 'framing'
terms = estimate.get('terms') or ''

doc = SimpleDocTemplate(out_path, pagesize=A4,
    rightMargin=20*mm, leftMargin=20*mm, topMargin=15*mm, bottomMargin=20*mm)

styles = getSampleStyleSheet()

h_style = ParagraphStyle('h', fontSize=9, fontName='Helvetica-Bold')
n_style = ParagraphStyle('n', fontSize=9, fontName='Helvetica', leading=14)
b_style = ParagraphStyle('b', fontSize=9, fontName='Helvetica', leading=14, leftIndent=6)
r_style = ParagraphStyle('r', fontSize=9, fontName='Helvetica', alignment=TA_RIGHT)
tc_style = ParagraphStyle('tc', fontSize=9, fontName='Helvetica', leading=15, leftIndent=8, spaceAfter=1)
tc_bold_style = ParagraphStyle('tcb', fontSize=9, fontName='Helvetica-Bold', leading=15, leftIndent=8, spaceAfter=1)
tc_red_style = ParagraphStyle('tcr', fontSize=9, fontName='Helvetica-Bold', leading=15, leftIndent=8, spaceAfter=1, textColor=colors.red)
tc_h_style = ParagraphStyle('tch', fontSize=11, fontName='Helvetica-Bold', spaceBefore=8, spaceAfter=6)
sub_style = ParagraphStyle('sub', fontSize=9, fontName='Helvetica-Bold', leading=14, leftIndent=22)
payment_h_style = ParagraphStyle('pyh', fontSize=10, fontName='Helvetica-Bold', spaceBefore=10, spaceAfter=4)
payment_item_style = ParagraphStyle('pyi', fontSize=10, fontName='Helvetica-Bold', leading=16, leftIndent=16)

story = []

def add_logo():
    if os.path.exists(logo_path):
        img = Image(logo_path, width=60*mm, height=24*mm)
        img.hAlign = 'LEFT'
        story.append(img)
    else:
        story.append(Paragraph('<b>LAWLESS CONSTRUCTION</b>', styles['Title']))
    story.append(Spacer(1, 4*mm))

add_logo()

proj_name = project.get('name', '')
story.append(Paragraph('<u><b>Address: ' + proj_name + '</b></u>',
    ParagraphStyle('t', fontSize=11, fontName='Helvetica-Bold', spaceAfter=8)))

if quote_type == 'steel':
    story.append(Paragraph('<u><b>Member Description Finish</b></u>',
        ParagraphStyle('mh', fontSize=10, fontName='Helvetica-Bold', spaceAfter=6)))

    all_scope_lines = []
    total_price = 0
    for item in items:
        scope = item.get('scope', '') or ''
        total_price += item.get('quantity', 1) * item.get('unit_cost', 0) * (1 + item.get('margin_percent', 30) / 100)
        for line in scope.split('\n'):
            line = line.strip()
            if line:
                all_scope_lines.append(line)

    table_data = [[
        Paragraph('<b>Member</b>', ParagraphStyle('th', fontSize=9, fontName='Helvetica-Bold', textColor=colors.HexColor('#cc0000'))),
        Paragraph('<b>Description</b>', ParagraphStyle('th2', fontSize=9, fontName='Helvetica-Bold', textColor=colors.HexColor('#cc0000'))),
        Paragraph('<b>Finish</b>', ParagraphStyle('th3', fontSize=9, fontName='Helvetica-Bold', textColor=colors.HexColor('#cc0000'))),
    ]]

    current_section = None
    for line in all_scope_lines:
        # Detect section headers (lines with no member code pattern)
        parts = line.split(' ', 1)
        member = parts[0] if parts else ''
        rest = parts[1] if len(parts) > 1 else ''
        
        # Check if it looks like a section header (no alphanumeric member code)
        looks_like_member = len(member) >= 2 and any(c.isdigit() for c in member)
        
        if not looks_like_member:
            # Section header row
            table_data.append([
                Paragraph('', n_style),
                Paragraph('<b>' + line + '</b>', ParagraphStyle('sh', fontSize=9, fontName='Helvetica-Bold')),
                Paragraph('', n_style),
            ])
            continue
        
        finish = 'Painted'
        desc = rest
        for fin in ['Painted', 'Galvanized', 'Hot dipped', 'painted', 'galvanized']:
            if fin.lower() in rest.lower():
                finish = 'Painted' if 'paint' in fin.lower() else 'Hot Dip Galv'
                idx = rest.lower().find(fin.lower())
                desc = rest[:idx].strip().rstrip(',').strip()
                break
        table_data.append([
            Paragraph('<b><font color="#cc0000">' + member + '</font></b>', n_style),
            Paragraph(desc, n_style),
            Paragraph(finish, n_style),
        ])

    t = Table(table_data, colWidths=[20*mm, 120*mm, 25*mm])
    t.setStyle(TableStyle([
        ('BOX', (0,0), (-1,-1), 0.5, colors.black),
        ('INNERGRID', (0,0), (-1,-1), 0.5, colors.black),
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('TOPPADDING', (0,0), (-1,-1), 4),
        ('BOTTOMPADDING', (0,0), (-1,-1), 4),
        ('LEFTPADDING', (0,0), (-1,-1), 5),
    ]))
    story.append(t)
    story.append(Spacer(1, 8*mm))
    price_str = '${:,.0f} Plus GST'.format(total_price)
    story.append(Paragraph('<b><font color="#cc0000">Price -</font></b>',
        ParagraphStyle('pr', fontSize=11, fontName='Helvetica-Bold', spaceAfter=4)))
    story.append(Paragraph(price_str,
        ParagraphStyle('pv', fontSize=12, fontName='Helvetica-Bold', spaceAfter=4)))

else:
    # Framing quote
    table_data = [[
        Paragraph('<b>ACTIVITY</b>', h_style),
        Paragraph('<b>QTY</b>', h_style),
        Paragraph('<b>SCOPE</b>', h_style),
        Paragraph('<b>AMOUNT</b>', h_style),
    ]]

    for item in items:
        scope_text = item.get('scope', '') or item.get('description', '')
        lines = [l.strip() for l in scope_text.split('\n') if l.strip()]
        scope_html = '<br/>'.join(['• ' + l for l in lines]) if lines else item.get('description', '')
        scope_para = Paragraph(scope_html, b_style)
        item_total = item.get('quantity', 1) * item.get('unit_cost', 0) * (1 + item.get('margin_percent', 30) / 100)
        amount_str = '${:,.0f}'.format(item_total)
        table_data.append([
            Paragraph('<b>' + item.get('description', '') + '</b>', h_style),
            Paragraph(str(int(item.get('quantity', 1))), n_style),
            scope_para,
            Paragraph(amount_str, r_style),
        ])

    grand_total = sum(
        i.get('quantity', 1) * i.get('unit_cost', 0) * (1 + i.get('margin_percent', 30) / 100)
        for i in items
    )
    grand_str = '${:,.0f} Plus GST'.format(grand_total)
    table_data.append([
        Paragraph('<b>TOTAL</b>', ParagraphStyle('tot', fontSize=10, fontName='Helvetica-Bold')),
        '', '',
        Paragraph('<b>' + grand_str + '</b>', ParagraphStyle('totr', fontSize=10, fontName='Helvetica-Bold', alignment=TA_RIGHT)),
    ])

    t = Table(table_data, colWidths=[38*mm, 12*mm, 90*mm, 25*mm], repeatRows=1)
    t.setStyle(TableStyle([
        ('BOX', (0,0), (-1,-1), 0.5, colors.black),
        ('INNERGRID', (0,0), (-1,-2), 0.5, colors.black),
        ('LINEABOVE', (0,-1), (-1,-1), 0.5, colors.black),
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('TOPPADDING', (0,0), (-1,-1), 5),
        ('BOTTOMPADDING', (0,0), (-1,-1), 5),
        ('LEFTPADDING', (0,0), (-1,-1), 5),
        ('RIGHTPADDING', (0,0), (-1,-1), 5),
        ('SPAN', (1,-1), (2,-1)),
    ]))
    story.append(t)

# Page 2 - T&Cs
story.append(PageBreak())
add_logo()

if client:
    story.append(Paragraph('<b>Client - </b>' + client.get('name', ''),
        ParagraphStyle('cl', fontSize=11, fontName='Helvetica-Bold', spaceAfter=3)))
    email = client.get('email', '')
    if email:
        story.append(Paragraph('<font color="#1155CC"><u>' + email + '</u></font>', n_style))
    phone = client.get('phone', '')
    if phone:
        story.append(Paragraph(phone, n_style))
    story.append(Spacer(1, 6*mm))

if quote_type == 'steel':
    story.append(Paragraph('<b>PLEASE READ THESE TERMS AND CONDITIONS CAREFULLY</b>',
        ParagraphStyle('tct', fontSize=11, fontName='Helvetica-Bold', alignment=TA_CENTER, spaceAfter=10)))
    story.append(HRFlowable(width='100%', thickness=1, color=colors.black))
    story.append(Spacer(1, 4*mm))
    story.append(Paragraph('<u>Payment Terms &amp; Conditions - C.O.D</u>', tc_h_style))
else:
    story.append(Paragraph('<b>Terms &amp; Conditions -</b>', tc_h_style))

# Parse and render terms
in_payment_section = False
if terms:
    for line in terms.split('\n'):
        line = line.strip()
        if not line:
            story.append(Spacer(1, 2*mm))
            continue
        
        # Detect payment terms section header
        if 'payment terms' in line.lower() and not line.startswith('-'):
            in_payment_section = True
            story.append(Spacer(1, 3*mm))
            story.append(Paragraph('<b>' + line + '</b>', payment_h_style))
            continue
        
        if line.startswith('- '):
            content = line[2:].strip()
            if in_payment_section:
                # Payment items get special treatment — bold and prominent
                story.append(Paragraph('&#9658; ' + content, payment_item_style))
            else:
                story.append(Paragraph('&nbsp;&nbsp;&nbsp;&nbsp;&#8211; ' + content, sub_style))
        elif 'charges apply' in line.lower():
            story.append(Paragraph('&#8226; <b>' + line + ' <font color="red">(If not charges apply)</font></b>', tc_style))
        else:
            story.append(Paragraph('&#8226; <b>' + line + '</b>', tc_style))

story.append(Spacer(1, 8*mm))
story.append(HRFlowable(width='100%', thickness=0.5, color=colors.black))
story.append(Spacer(1, 4*mm))
story.append(Paragraph(
    '<b><u>By commencing the project, the builder/client is agreeing to all terms and conditions listed by Lawless Construction.</u></b>',
    ParagraphStyle('close', fontSize=9, fontName='Helvetica-Bold')
))

doc.build(story)
print('OK')
