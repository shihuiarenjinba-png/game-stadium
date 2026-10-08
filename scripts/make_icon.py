#!/usr/bin/env python3
"""Create an original, self-contained EKIDEN MANAGER 256px icon.
No third-party packages or external assets required.
"""
import os
import struct
import zlib

SIZE=256
BG=(18, 37, 48, 255)
TRACK=(51, 91, 83, 255)
SAND=(234, 193, 112, 255)
WHITE=(244, 242, 226, 255)
GREEN=(93, 187, 153, 255)

image=bytearray(SIZE*SIZE*4)

def point(x,y,color):
    if 0<=x<SIZE and 0<=y<SIZE:
        i=(y*SIZE+x)*4
        image[i:i+4]=bytes(color)

def circle(cx,cy,r,color):
    for y in range(max(0,int(cy-r)),min(SIZE,int(cy+r+1))):
        for x in range(max(0,int(cx-r)),min(SIZE,int(cx+r+1))):
            if (x-cx)**2+(y-cy)**2<=r*r:point(x,y,color)

def segment(ax,ay,bx,by,r,color):
    xmin=max(0,int(min(ax,bx)-r))
    xmax=min(SIZE,int(max(ax,bx)+r+1))
    ymin=max(0,int(min(ay,by)-r))
    ymax=min(SIZE,int(max(ay,by)+r+1))
    d=(bx-ax)**2+(by-ay)**2
    for y in range(ymin,ymax):
        for x in range(xmin,xmax):
            t=max(0,min(1,((x-ax)*(bx-ax)+(y-ay)*(by-ay))/d)) if d else 0
            if (x-ax-(bx-ax)*t)**2+(y-ay-(by-ay)*t)**2<=r*r:point(x,y,color)

for yy in range(SIZE):
    for xx in range(SIZE):
        point(xx,yy,BG)

# Rounded dark teal running-track medallion.
circle(128,128,111,TRACK)
circle(128,128,94,BG)
segment(39,188,216,188,9,SAND)
# Runner: head, torso, arms and legs, plus a contrasting sash/tasuki.
circle(144,65,20,SAND)
segment(136,91,119,142,16,WHITE)
segment(121,114,90,130,10,WHITE)
segment(133,110,181,129,11,WHITE)
segment(120,143,81,189,13,WHITE)
segment(120,143,172,176,13,WHITE)
segment(115,115,139,127,9,GREEN)
# Chequered finish-mark.
for r in range(4):
    for c in range(2):
        if (r+c)%2==0:
            for y in range(87+r*13,87+(r+1)*13):
                for x in range(198+c*12,198+(c+1)*12):point(x,y,WHITE)

def chunk(t,data):
    return struct.pack(">I",len(data))+t+data+struct.pack(">I",zlib.crc32(t+data)&0xffffffff)

raw=b"".join(b"\x00"+image[y*SIZE*4:(y+1)*SIZE*4] for y in range(SIZE))
png=(b"\x89PNG\r\n\x1a\n"+
     chunk(b"IHDR",struct.pack(">IIBBBBB",SIZE,SIZE,8,6,0,0,0))+
     chunk(b"IDAT",zlib.compress(raw,9))+chunk(b"IEND",b""))

os.makedirs("build",exist_ok=True)
with open("build/icon.png","wb") as f:f.write(png)
header=struct.pack("<HHH",0,1,1)+struct.pack("<BBBBHHII",0,0,0,0,1,32,len(png),22)
with open("build/icon.ico","wb") as f:f.write(header+png)
print("Generated original icon:",len(png),"PNG bytes; 256px ICO.")
