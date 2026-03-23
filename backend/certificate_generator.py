from reportlab.lib.pagesizes import landscape, A4
from reportlab.pdfgen import canvas
from reportlab.lib import colors
import io
from datetime import datetime

def generate_certificate_pdf(student_name, course_name, org_name, issue_date=None):
    """
    Generates a professional certificate PDF in memory using ReportLab.
    """
    buffer = io.BytesIO()
    # Use landscape A4
    w, h = landscape(A4)
    c = canvas.Canvas(buffer, pagesize=landscape(A4))

    # 1. Background Border
    c.setStrokeColor(colors.HexColor("#7c3aed")) # Admin Purple
    c.setLineWidth(15)
    c.rect(20, 20, w-40, h-40) # Outer border
    
    c.setStrokeColor(colors.HexColor("#a78bfa")) # Light Purple
    c.setLineWidth(2)
    c.rect(35, 35, w-70, h-70) # Inner thin border

    # 2. Header / Logo Placeholder (Organization Name)
    c.setFont("Helvetica-Bold", 34)
    c.setFillColor(colors.HexColor("#1e293b"))
    c.drawCentredString(w/2, h-120, org_name.upper())
    
    c.setFont("Helvetica", 18)
    c.drawCentredString(w/2, h-155, "OFFICIAL CERTIFICATE OF COMPLETION")

    # 3. Content
    c.setFont("Helvetica", 22)
    c.drawCentredString(w/2, h/2 + 40, "This is to certify that")
    
    # Student Name (Large and Blue/Purple)
    c.setFont("Helvetica-Bold", 48)
    c.setFillColor(colors.HexColor("#7c3aed"))
    c.drawCentredString(w/2, h/2 - 20, student_name)
    
    c.setFont("Helvetica", 22)
    c.setFillColor(colors.HexColor("#1e293b"))
    c.drawCentredString(w/2, h/2 - 70, "has successfully completed the course")
    
    # Course Title
    c.setFont("Helvetica-BoldOblique", 28)
    c.drawCentredString(w/2, h/2 - 120, f'"{course_name}"')

    # 4. Footer (Date and Signature)
    if not issue_date:
        issue_date = datetime.utcnow().strftime("%B %d, %Y")
    
    c.setFont("Helvetica", 14)
    c.drawCentredString(w/4 + 50, 120, f"Issued on: {issue_date}")
    
    # Signature Line
    c.setDash(1, 2)
    c.line(w*0.6, 120, w*0.85, 120)
    c.setDash()
    c.setFont("Helvetica-Oblique", 12)
    c.drawCentredString(w*0.725, 105, "Platform Administrator")

    # 5. Finishing up
    c.showPage()
    c.save()
    
    buffer.seek(0)
    return buffer
