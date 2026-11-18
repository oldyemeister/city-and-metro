"""Count modern tagged ways with a node in the playable Shanghai rectangle."""
import hashlib
import json
from pathlib import Path
import subprocess
import sys
import xml.etree.ElementTree as ET
from collections import Counter

pbf = Path(sys.argv[1])
west, north = 121.2049027850762, 31.42
east, south = west + 192 / 380.6, north - 180 / 442.3
classes = ("motorway", "trunk", "primary")
tags = (*classes, *(tag + "_link" for tag in classes))
inside = set()
counts, one_way = Counter(), Counter()
command = ["osmium", "tags-filter", str(pbf), "w/highway=" + ",".join(tags), "-f", "osm"]
with subprocess.Popen(command, stdout=subprocess.PIPE) as process:
    for _, obj in ET.iterparse(process.stdout, events=("end",)):
        if obj.tag == "node":
            if west <= float(obj.get("lon")) <= east and south <= float(obj.get("lat")) <= north:
                inside.add(obj.get("id"))
        elif obj.tag == "way":
            if any(node.get("ref") in inside for node in obj.iterfind("nd")):
                props = {tag.get("k"): tag.get("v") for tag in obj.iterfind("tag")}
                counts[props["highway"]] += 1
                if props.get("oneway") in ("yes", "true", "1", "-1"):
                    one_way[props["highway"]] += 1
        else:
            continue
        obj.clear()
    if process.wait():
        raise SystemExit("osmium tags-filter failed")
assert set(counts) == set(tags)
print(json.dumps({
    "pbfSHA256": hashlib.sha256(pbf.read_bytes()).hexdigest(),
    "bboxWGS84": [west, south, east, north],
    "rule": "One count per OSM way with at least one source node inside the playable map. "
            "Modern geometry inventory, all access values, only explicit oneway counted.",
    "ways": dict(sorted(counts.items())),
    "explicitOneWay": dict(sorted(one_way.items())),
}, indent=2))
