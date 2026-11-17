from PIL import Image, ImageDraw

SIZE = 512
INK = (22, 19, 14, 255)
PAPER = (243, 239, 229, 255)
ORANGE = (255, 74, 28, 255)
MUTED = (139, 130, 114, 255)

image = Image.new("RGBA", (SIZE, SIZE), INK)
draw = ImageDraw.Draw(image)

# 미묘한 트랙 레인 라인
for y in range(0, SIZE, 64):
    draw.line([(0, y), (SIZE, y)], fill=(255, 255, 255, 8), width=2)

# 세 개의 기울어진 바: 발맞춤의 '보폭'을 상징
bars = [
    (150, 360, 62, 150, ORANGE),
    (238, 390, 62, 250, PAPER),
    (326, 300, 62, 120, MUTED),
]
slant = 26
for x, bottom, width, height, color in bars:
    top = bottom - height
    draw.polygon(
        [
            (x + slant, top),
            (x + slant + width, top),
            (x + width, bottom),
            (x, bottom),
        ],
        fill=color,
    )

# 하단 베이스 라인
draw.line([(132, 408), (380, 408)], fill=(243, 239, 229, 90), width=4)

image.save("logo.png")
print("saved logo.png")
