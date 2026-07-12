import type { SignatureRoute } from "./types";

/**
 * Curated from Komoot, Outdooractive, AllTrails, Zeeland.com (Stand: Juli
 * 2026) — see the source research list this was transcribed from. Start
 * coordinates are approximate (geocoded from the named region/town, not
 * surveyed), and each route's free-text landscape description was mapped
 * onto the existing LandscapeType taxonomy for filter consistency with the
 * "Landschafts-Route" corridor mode; the original wording is kept in
 * `description`.
 */
export const SIGNATURE_ROUTES: SignatureRoute[] = [
  // Noord-Holland
  {
    id: "amstelroute",
    name: "Amstelroute",
    province: "Noord-Holland",
    landscapeType: "fluss_meer",
    description:
      "Folgt dem Fluss Amstel südwärts, vorbei an Windmühlen und historischen Dörfern wie Ouderkerk aan de Amstel.",
    approxDistanceKm: 43.5,
    startRegionName: "Amsterdam",
    center: { lat: 52.3676, lon: 4.9041 },
  },
  {
    id: "waterland-runde",
    name: "Waterland-Runde",
    province: "Noord-Holland",
    landscapeType: "polder",
    description:
      "Nordholland-Kanal, Weerslotkanal, IJsselmeer-Deich, durch Broek in Waterland und Monnickendam; bei Wind am Deich exponiert.",
    approxDistanceKm: 45.5,
    startRegionName: "Amsterdam Centraal",
    center: { lat: 52.3791, lon: 4.8994 },
  },
  {
    id: "bollenstreek-zandvoort-runde",
    name: "Bollenstreek/Zandvoort-Runde",
    province: "Noord-Holland",
    landscapeType: "duenen_kueste",
    description:
      "Amsterdam–Haarlem–Lisse–Zandvoort–Amsterdam; im Frühling Tulpenfelder, Küste bei Zandvoort, Kennemerduinen.",
    approxDistanceKm: 50,
    startRegionName: "Amsterdam",
    center: { lat: 52.3676, lon: 4.9041 },
  },
  {
    id: "alte-jaegerrunde",
    name: "Alte Jägerrunde",
    province: "Noord-Holland",
    landscapeType: "duenen_kueste",
    description:
      "Moderate Höhenunterschiede für NL-Verhältnisse, Dünenlandschaft Zuid-Kennemerland.",
    approxDistanceKm: 44,
    startRegionName: "Zandvoort",
    center: { lat: 52.372, lon: 4.533 },
  },
  {
    id: "sloterdijk-schiphol-runde",
    name: "Sloterdijk-Schiphol-Runde",
    province: "Noord-Holland",
    landscapeType: "wald",
    description:
      "Neues Meer, Amsterdamse Bos, Schiphol, Amstelveen, zurück über die Amstel.",
    approxDistanceKm: null,
    startRegionName: "Bahnhof Sloterdijk",
    center: { lat: 52.3888, lon: 4.8384 },
  },

  // Zuid-Holland
  {
    id: "kustroute-den-haag-katwijk",
    name: "Kustroute Den Haag–Katwijk",
    province: "Zuid-Holland",
    landscapeType: "duenen_kueste",
    description:
      "Teil der Radfernroute LF Kustroute/EuroVelo 12, durchs Dünengebiet Meijendel.",
    approxDistanceKm: null,
    startRegionName: "Den Haag",
    center: { lat: 52.0809, lon: 4.3238 },
  },
  {
    id: "kinderdijk-route",
    name: "Kinderdijk-Route",
    province: "Zuid-Holland",
    landscapeType: "fluss_meer",
    description:
      "Entlang der UNESCO-Windmühlen von Kinderdijk, Flusslandschaft.",
    approxDistanceKm: null,
    startRegionName: "Rotterdam-Umgebung",
    center: { lat: 51.883, lon: 4.632 },
  },

  // Zeeland
  {
    id: "round-lake-veere",
    name: "Round Lake Veere",
    province: "Zeeland",
    landscapeType: "fluss_meer",
    description:
      "Umrundet den Veerse Meer, Highlights: Grote Kerk in Veere, Dünen bei Zoutelande.",
    approxDistanceKm: 54.6,
    startRegionName: "Middelburg/Veere",
    center: { lat: 51.551, lon: 3.672 },
  },
  {
    id: "salzige-route",
    name: "Salzige Route (Muscheln & Austern)",
    province: "Zeeland",
    landscapeType: "fluss_meer",
    description: "Entlang Oosterschelde und Westerschelde, kulinarischer Fokus.",
    approxDistanceKm: 51,
    startRegionName: "Zuid-Beveland",
    center: { lat: 51.504, lon: 3.8896 },
  },
  {
    id: "der-sieg-ueber-das-wasser",
    name: "Der Sieg über das Wasser",
    province: "Zeeland",
    landscapeType: "polder",
    description:
      "Erinnert an die Sturmflut 1953, führt zum Watersnoodmuseum.",
    approxDistanceKm: 61,
    startRegionName: "Schouwen-Duiveland",
    center: { lat: 51.647, lon: 3.916 },
  },
  {
    id: "noord-beveland-entdecken",
    name: "Noord-Beveland entdecken",
    province: "Zeeland",
    landscapeType: "polder",
    description:
      "Küstenradwege vor dem Deich, Blick auf Oosterschelde und Veerse Meer.",
    approxDistanceKm: 36,
    startRegionName: "Noord-Beveland",
    center: { lat: 51.598, lon: 3.746 },
  },
  {
    id: "tholen-route",
    name: "Tholen-Route",
    province: "Zeeland",
    landscapeType: "polder",
    description: "Weitläufige Polderlandschaft, historische Bauernhöfe.",
    approxDistanceKm: 77,
    startRegionName: "Tholen",
    center: { lat: 51.533, lon: 4.221 },
  },
  {
    id: "zeelandische-wind-route",
    name: "Zeeländische-Wind-Route",
    province: "Zeeland",
    landscapeType: "duenen_kueste",
    description:
      "Anspruchsvoll, entlang der Deltawerke, für sportliche Fahrer.",
    approxDistanceKm: 101,
    startRegionName: "Zuid-Beveland/Walcheren",
    center: { lat: 51.4426, lon: 3.5736 },
  },
  {
    id: "zwinroute",
    name: "Zwinroute",
    province: "Zeeland",
    landscapeType: "duenen_kueste",
    description: "Naturreservat Het Zwin, Ebbe-und-Flut-Landschaft.",
    approxDistanceKm: null,
    startRegionName: "Grenzgebiet NL/BE",
    center: { lat: 51.301, lon: 3.59 },
  },

  // Zuid-Limburg
  {
    id: "amstel-gold-race-loop",
    name: "Amstel Gold Race Loop",
    province: "Zuid-Limburg",
    landscapeType: "heuvelland",
    description:
      "Bekannteste Rennrad-Herausforderung NLs, signifikante Höhenmeter für niederländische Verhältnisse.",
    approxDistanceKm: 76.7,
    startRegionName: "Region Valkenburg",
    center: { lat: 50.865, lon: 5.83 },
  },
  {
    id: "drielandenpunt-runde",
    name: "Drielandenpunt-Runde (Vaals–Mechelen)",
    province: "Zuid-Limburg",
    landscapeType: "heuvelland",
    description:
      "Grenzüberschreitend NL/BE/DE, kurze knackige Anstiege, aussichtsreiche Ab-/Auffahrten.",
    approxDistanceKm: null,
    startRegionName: "Vaals",
    center: { lat: 50.771, lon: 6.016 },
  },

  // Gelderland/Veluwe
  {
    id: "tour-of-lake-veluwe",
    name: "Tour of Lake Veluwe",
    province: "Gelderland/Veluwe",
    landscapeType: "fluss_meer",
    description: "Malerische Seerunde um das Veluwemeer.",
    approxDistanceKm: null,
    startRegionName: "Veluwemeer",
    center: { lat: 52.341, lon: 5.62 },
  },
  {
    id: "nationalpark-hoge-veluwe",
    name: "Nationalpark Hoge Veluwe",
    province: "Gelderland/Veluwe",
    landscapeType: "wald",
    description:
      "Einer der größten Nationalparks Europas, vielfältige Flora/Fauna.",
    approxDistanceKm: null,
    startRegionName: "Otterlo",
    center: { lat: 52.098, lon: 5.769 },
  },
  {
    id: "nationalpark-veluwezoom",
    name: "Nationalpark Veluwezoom",
    province: "Gelderland/Veluwe",
    landscapeType: "wald",
    description:
      "Wechsel aus schattigen Waldabschnitten und offenen Heide-Panoramen.",
    approxDistanceKm: null,
    startRegionName: "Rheden",
    center: { lat: 52.004, lon: 6.033 },
  },
];
