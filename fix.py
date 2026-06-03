import re

with open('main.js', 'r') as f:
    content = f.read()

old = '''  ctx.fillStyle = leftColor;
  ctx.fillText(leftText, mid / 2, h / 2);
  ctx.fillStyle = rightColor;
  ctx.fillText(rightText, mid + mid / 2, h / 2);'''

new = '''  // desespelhar o texto
  ctx.save();
  ctx.scale(-1, 1);
  ctx.fillStyle = leftColor;
  ctx.fillText(leftText, -(mid / 2), h / 2);
  ctx.fillStyle = rightColor;
  ctx.fillText(rightText, -(mid + mid / 2), h / 2);
  ctx.restore();'''

content = content.replace(old, new)

with open('main.js', 'w') as f:
    f.write(content)

print('Feito!')
