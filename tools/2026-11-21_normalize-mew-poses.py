"""Normalize imagegen art for review; preserve all shipped motion cells."""
from pathlib import Path
from PIL import Image, ImageDraw
import json
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'assets/characters'
src=Image.open(OUT/'2026-11-21_mew-float-dead3-source.png').convert('RGBA')
old=Image.open(OUT/'2026-11-15_mew-motion-v2-frames.png').convert('RGBA')
idle=Image.open(OUT/'2026-10-16_mew-idle-hd.png').convert('RGBA')
def original(i):return old.crop((i%4*108,i//4*96,i%4*108+108,i//4*96+96))
cells=[]
for i in range(3):
 c=src.crop((round(i*src.width/3),0,round((i+1)*src.width/3),src.height))
 c.putalpha(c.getchannel('A').point(lambda a:255 if a>=128 else 0))
 cells.append(c.crop(c.getbbox()))
ref=original(8);box=ref.getbbox()
idlebox=idle.getbbox()
scale=(idlebox[3]-idlebox[1])/cells[0].height
frames={}
for name,c in zip(['calibration','float','dead3'],cells):
 c=c.resize((round(c.width*scale),round(c.height*scale)),Image.Resampling.NEAREST)
 x=64-round(c.width*.59);y=94-c.height
 assert x>=2 and y>=2 and x+c.width<=106,(name,c.size,x,y)
 f=Image.new('RGBA',(108,96));f.alpha_composite(c,(x,y))
 f.save(OUT/f'2026-11-21_mew-{name}.png');frames[name]=f
board=Image.new('RGBA',(1080,420),'#241b36');d=ImageDraw.Draw(board)
for col,(name,im) in enumerate([('IDLE',idle),('JUMP APEX (UNCHANGED)',original(9)),('FLOAT NEW',frames['float']),('DEAD3 OLD',original(14)),('DEAD3 NEW',frames['dead3'])]):
 d.text((col*216+5,8),name,fill='white')
 board.alpha_composite(im,(col*216+54,30))
 board.alpha_composite(im.resize((216,192),Image.Resampling.NEAREST),(col*216,170))
board.save(OUT/'2026-11-21_mew-float-dead3-preview.png')
revised=old.copy()
revised.paste(frames['dead3'],(216,288))
for i in range(16):
 if i==14:continue
 rect=(i%4*108,i//4*96,i%4*108+108,i//4*96+96)
 assert revised.crop(rect).tobytes()==old.crop(rect).tobytes()
revised.save(OUT/'2026-11-21_mew-motion-v2-dead3-frames.png')
(OUT/'2026-11-21_mew-float-dead3-metrics.json').write_text(json.dumps({'logical':[54,48],'density':2,'ax':32,'shared_scale':scale,'calibration':'existing idle 86px silhouette height applied to generated reference pose','bounds':{k:v.getbbox() for k,v in frames.items()}},indent=2)+'\n',encoding='utf-8',newline='\n')
print('PASS review: 108x96, shared scale, transparent 2px border; shipped sheets unchanged')
