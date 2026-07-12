import type { LatLon, POI } from "./types";

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export function buildGpx(params: {
  name: string;
  geometry: LatLon[];
  pois?: POI[];
}): string {
  const { name, geometry, pois = [] } = params;

  const waypoints = pois
    .map(
      (p) =>
        `  <wpt lat="${p.lat}" lon="${p.lon}">\n` +
        `    <name>${escapeXml(p.name)}</name>\n` +
        `    <sym>${escapeXml(poiSymbol(p.category))}</sym>\n` +
        `  </wpt>`
    )
    .join("\n");

  const trackPoints = geometry
    .map((pt) => `      <trkpt lat="${pt.lat}" lon="${pt.lon}"></trkpt>`)
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="racebike-app" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata>
    <name>${escapeXml(name)}</name>
  </metadata>
${waypoints ? waypoints + "\n" : ""}  <trk>
    <name>${escapeXml(name)}</name>
    <trkseg>
${trackPoints}
    </trkseg>
  </trk>
</gpx>
`;
}

function poiSymbol(category: POI["category"]): string {
  switch (category) {
    case "fuel":
      return "Gas Station";
    case "supermarket":
      return "Shopping Center";
    case "ice_cream":
      return "Restaurant";
    case "cafe":
      return "Restaurant";
  }
}
