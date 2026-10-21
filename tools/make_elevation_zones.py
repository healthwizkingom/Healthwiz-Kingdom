"""Write data/elevation-zones.geojson: the estimated, illustrative terrain levels of the campus map (owner's request,
2026-10-20: "guess where elevation starts and ends based on the drone video, and rerender the contours").

    python3 tools/make_elevation_zones.py data/elevation-zones.geojson

Which area is higher comes from the owner's annotated screenshot; where each slope starts and ends was estimated from the
drone video (the frames named in each level's evidence) and the climbing staircases of the STAIRS list. The heights are
display values that keep the order, not measurements. observatory/terrain.js turns the levels into the height map and
traces the contour lines from it. Edit the boxes below (west, east, south, north, corner radius in metres) to move a slope.
"""
import json, math, sys
R=6371008.8; rad=math.pi/180; LAT=5.3505; KX=rad*R*math.cos(LAT*rad); KY=rad*R
def rr(w,e,s,n,r=12,k=6):
    # rounded rectangle, corner radius r metres, counter-clockwise
    rx=r/KX; ry=r/KY; P=[]
    for cx,cy,a0 in ((e-rx,s+ry,-90),(e-rx,n-ry,0),(w+rx,n-ry,90),(w+rx,s+ry,180)):
        for i in range(k+1):
            a=(a0+90*i/k)*rad; P.append([round(cx+rx*math.cos(a),7),round(cy+ry*math.sin(a),7)])
    P.append(P[0]); return P
F=[]
def z(id,name,region,level,H,W,box,ev):
    F.append({"type":"Feature","properties":{"id":id,"name":name,"region":region,"level":level,"illustrativeHeight_m":H,"slopeWidth_m":W,
      "source":"estimated: the owner's annotation (which area is higher) with where the slopes start and end estimated from the drone video and the staircase list; illustrative","evidence":ev},
      "geometry":{"type":"Polygon","coordinates":[rr(*box)]}})
z("upper-cluster","Middle Elevation","Upper cluster","middle",12,45,(100.53735,100.53990,5.35213,5.35302,18),
  "Owner annotation: the north is raised (middle). Drone video: the covered walkways from the academic block to the northern blocks climb in steps (frames 11, 22) and roads rise toward the hostels (frames 21-24). The STAIRS list puts climbing stairs between about 5.3518 and 5.3525 N (ST14, ST18, ST19, ST20, ST21, ST26: 'naik ke' = going up), so the slope is drawn there, from the road north of the academic block up to the northern buildings.")
z("south-terrace","South terrace","Blok C terrace","middle",10,40,(100.53800,100.54045,5.34920,5.34978,14),
  "Drone video: a covered walkway with steps climbs a grass bank from the cafe and courts to the long block (frames 31-32), and grass banks with steps sit in front of the hostel blocks (frame 30). The STAIRS list: ST04 cafe to the tennis court, ST11 tennis court to Blok C, ST12 Blok C to Blok A/B. Drawn as a terrace at Blok C, half way up.")
z("southern-region","Highest Elevation","Southern region","highest",24,22,(100.53800,100.54010,5.34845,5.34928,14),
  "Owner annotation: the south is the highest area. Drone video: the hostel blocks A and B stand above a grass embankment with steps (frames 26-30). The STAIRS list: ST12 Blok C up to Blok A/B. Drawn as the top level, reached by a short steep bank south of the terrace.")
fc={"type":"FeatureCollection","about":"ESTIMATED, ILLUSTRATIVE elevation levels for the campus map. Which area is higher comes from the owner's annotated screenshot (2026-10-20): the north raised (middle), the south the highest. Where each slope starts and ends was then estimated (2026-10-20) from the owner's drone video (TikTok @ikraMRahim, used with permission; the frames named on each level) and from the climbing staircases in the app's STAIRS list. The heights are display values chosen to show the order (base < south terrace < middle < highest), not measurements. Each level rises gradually over slopeWidth_m metres outside its outline to a flat top; where two levels meet, the higher one wins. Replace with surveyed elevations when available.","features":F}
json.dump(fc,open(sys.argv[1],'w'),indent=1)
