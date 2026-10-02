"""
Gera e2e/fixtures/ean13.mjpeg: "vídeo de câmera" falso com um código de
barras EAN-13 desenhado do zero (tabelas oficiais do padrão), usado pelo
Chromium via --use-file-for-fake-video-capture no teste E2E do leitor.

Rodar só se precisar regerar:  python e2e/fixtures/make-barcode-video.py
(precisa de Pillow e ffmpeg)
"""
from PIL import Image, ImageDraw
import subprocess, os

CODE = "4006381333931"  # EAN-13 de exemplo, dígito verificador válido
L = ["0001101","0011001","0010011","0111101","0100011","0110001","0101111","0111011","0110111","0001011"]
G = ["0100111","0110011","0011011","0100001","0011101","0111001","0000101","0010001","0001001","0010111"]
R = ["1110010","1100110","1101100","1000010","1011100","1001110","1010000","1000100","1001000","1110100"]
PARITY = ["LLLLLL","LLGLGG","LLGGLG","LLGGGL","LGLLGG","LGGLLG","LGGGLL","LGLGLG","LGLGGL","LGGLGL"]

def ean13_bits(code):
    first, left, right = int(code[0]), code[1:7], code[7:]
    bits = "101"
    for d, p in zip(left, PARITY[first]):
        bits += (L if p == "L" else G)[int(d)]
    bits += "01010"
    for d in right:
        bits += R[int(d)]
    return bits + "101"

bits = ean13_bits(CODE)
MOD, H = 4, 160
W, HH = 640, 360
img = Image.new("RGB", (W, HH), "white")
draw = ImageDraw.Draw(img)
x0 = (W - len(bits) * MOD) // 2
y0 = (HH - H) // 2
for i, b in enumerate(bits):
    if b == "1":
        draw.rectangle([x0 + i * MOD, y0, x0 + (i + 1) * MOD - 1, y0 + H], fill="black")
here = os.path.dirname(os.path.abspath(__file__))
png = os.path.join(here, "ean13.png")
img.save(png)
subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-loop", "1", "-i", png, "-t", "1", "-r", "5",
                "-pix_fmt", "yuvj420p", "-f", "mjpeg", os.path.join(here, "ean13.mjpeg")], check=True)
os.remove(png)
print("gerado:", os.path.join(here, "ean13.mjpeg"), "código:", CODE)
