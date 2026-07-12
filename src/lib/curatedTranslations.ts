import type { AppLocale } from "@/i18n/routing";

/**
 * EN/NL translations of the curated scenic-corridor and signature-route
 * descriptions in scenicCorridors.ts / signatureRoutes.ts. German is the
 * source language those files were curated in, so it's repeated here rather
 * than referenced, keeping each locale's text self-contained and easy to
 * diff/update independently.
 */
export const SCENIC_CORRIDOR_DESCRIPTIONS: Record<string, Record<AppLocale, string>> = {
  kennemerduinen: {
    de: "Wanderdünen, Strand und Pinienwälder zwischen Zandvoort und Bloemendaal aan Zee.",
    en: "Shifting dunes, beach, and pine forests between Zandvoort and Bloemendaal aan Zee.",
    nl: "Wandelende duinen, strand en dennenbossen tussen Zandvoort en Bloemendaal aan Zee.",
  },
  "zuid-kennemerland": {
    de: "Küstenduinen mit Schottischen Hochlandrindern und weiten Ausblicken auf die Nordsee, direkt bei Haarlem.",
    en: "Coastal dunes with Scottish Highland cattle and wide views of the North Sea, right next to Haarlem.",
    nl: "Kustduinen met Schotse Hooglanders en weidse uitzichten op de Noordzee, vlak bij Haarlem.",
  },
  "schoorlse-duinen": {
    de: "Eines der größten zusammenhängenden Dünengebiete Europas, hügelig und bewaldet, nahe Bergen aan Zee.",
    en: "One of the largest contiguous dune areas in Europe, hilly and wooded, near Bergen aan Zee.",
    nl: "Een van de grootste aaneengesloten duingebieden van Europa, heuvelachtig en bebost, bij Bergen aan Zee.",
  },
  "duinen-van-voorne": {
    de: "Ruhiges Dünen- und Strandgebiet auf Voorne-Putten, südlich der Nieuwe Waterweg.",
    en: "A quiet dune and beach area on Voorne-Putten, south of the Nieuwe Waterweg.",
    nl: "Rustig duin- en strandgebied op Voorne-Putten, ten zuiden van de Nieuwe Waterweg.",
  },
  "walcheren-domburg": {
    de: "Zeeländische Dünenlandschaft und Badeorte an der Nordseeküste von Walcheren.",
    en: "Zeeland dune landscape and seaside resorts along Walcheren's North Sea coast.",
    nl: "Zeeuws duinlandschap en badplaatsen aan de Noordzeekust van Walcheren.",
  },
  "hoge-veluwe": {
    de: "Ausgedehnte Wälder, Heide und Sandverwehungen mit dem Kröller-Müller-Museum mittendrin.",
    en: "Vast forests, heathland, and drift sand, with the Kröller-Müller Museum right in the middle.",
    nl: "Uitgestrekte bossen, heide en stuifzand, met het Kröller-Müller Museum er middenin.",
  },
  speulderbos: {
    de: "Alter Waldbestand auf der Veluwe rund um Garderen, ruhige, schattige Wege.",
    en: "Old-growth forest on the Veluwe around Garderen, quiet and shaded paths.",
    nl: "Oud bos op de Veluwe rond Garderen, rustige, schaduwrijke paden.",
  },
  "utrechtse-heuvelrug": {
    de: "Bewaldeter Endmoränenrücken mit sanften Steigungen zwischen Zeist und Rhenen.",
    en: "A forested moraine ridge with gentle climbs between Zeist and Rhenen.",
    nl: "Beboste stuwwal met glooiende hellingen tussen Zeist en Rhenen.",
  },
  "loonse-en-drunense-duinen": {
    de: 'Binnenlanddünen und Kiefernwald in Brabant, bekannt als "Sahara des Nordens".',
    en: 'Inland dunes and pine forest in Brabant, known as the "Sahara of the North".',
    nl: 'Binnenlandse duinen en dennenbos in Brabant, bekend als de "Sahara van het Noorden".',
  },
  "beemster-polder": {
    de: "UNESCO-Weltkulturerbe: schnurgerade Polderwege, Grachten und historische Bauernhöfe.",
    en: "UNESCO World Heritage site: dead-straight polder roads, canals, and historic farmhouses.",
    nl: "UNESCO-werelderfgoed: kaarsrechte polderwegen, vaarten en historische boerderijen.",
  },
  "alblasserwaard-kinderdijk": {
    de: "Flache Polderlandschaft mit den berühmten Windmühlen von Kinderdijk.",
    en: "Flat polder landscape with the famous windmills of Kinderdijk.",
    nl: "Vlak polderlandschap met de beroemde molens van Kinderdijk.",
  },
  "groene-hart-reeuwijk": {
    de: "Torfseen, Weidelandschaft und Kanäle im grünen Herzen der Randstad.",
    en: "Peat lakes, pastureland, and canals in the green heart of the Randstad.",
    nl: "Veenplassen, weidelandschap en vaarten in het Groene Hart van de Randstad.",
  },
  dwingelderveld: {
    de: "Größte zusammenhängende Heidefläche Westeuropas mit Wacholderbüschen und Schafherden.",
    en: "Western Europe's largest contiguous heathland, with juniper bushes and flocks of sheep.",
    nl: "Grootste aaneengesloten heidegebied van West-Europa, met jeneverbesstruiken en kuddes schapen.",
  },
  "drents-friese-wold": {
    de: "Abwechslungsreiches Mosaik aus Wald, Heide, Sandverwehungen und dem Fochteloërveen.",
    en: "A varied mosaic of forest, heathland, drift sand, and the Fochteloërveen bog.",
    nl: "Afwisselend mozaïek van bos, heide, stuifzand en het Fochteloërveen.",
  },
  bargerveen: {
    de: "Eines der letzten Hochmoorreste der Niederlande, weit und still an der deutschen Grenze.",
    en: "One of the last raised-bog remnants in the Netherlands, wide and quiet along the German border.",
    nl: "Een van de laatste hoogveenrestanten van Nederland, uitgestrekt en stil langs de Duitse grens.",
  },
  "zuid-limburg-heuvelland": {
    de: "Das einzig wirklich hügelige Rennradrevier der Niederlande, Hohlwege und Fachwerkdörfer.",
    en: "The only genuinely hilly road cycling area in the Netherlands, with sunken lanes and half-timbered villages.",
    nl: "Het enige echt heuvelachtige racefietsgebied van Nederland, met holle wegen en vakwerkdorpen.",
  },
  vaalserberg: {
    de: "Höchste Erhebung der Niederlande, direkt am Dreiländereck mit Belgien und Deutschland.",
    en: "The highest point in the Netherlands, right at the tripoint with Belgium and Germany.",
    nl: "Het hoogste punt van Nederland, direct bij het drielandenpunt met België en Duitsland.",
  },
  biesbosch: {
    de: "Eines der letzten Süßwasser-Gezeitengebiete Europas, mit Prielen, Röhricht und kleinen Fähren.",
    en: "One of the last freshwater tidal areas in Europe, with creeks, reed beds, and small ferries.",
    nl: "Een van de laatste zoetwatergetijdengebieden van Europa, met kreken, rietvelden en kleine veerponten.",
  },
  waterland: {
    de: "Historische Fischerdörfer wie Marken und Volendam entlang des IJsselmeers, direkt bei Amsterdam.",
    en: "Historic fishing villages like Marken and Volendam along the IJsselmeer, right next to Amsterdam.",
    nl: "Historische vissersdorpen zoals Marken en Volendam langs het IJsselmeer, vlak bij Amsterdam.",
  },
  "loosdrechtse-plassen": {
    de: "Ausgedehntes Seengebiet mit Segelbooten, Schilfinseln und Sommerhäusern.",
    en: "An extensive lake area with sailboats, reed islands, and summer houses.",
    nl: "Uitgestrekt plassengebied met zeilboten, rieteilanden en zomerhuisjes.",
  },
};

export const SIGNATURE_ROUTE_DESCRIPTIONS: Record<string, Record<AppLocale, string>> = {
  amstelroute: {
    de: "Folgt dem Fluss Amstel südwärts, vorbei an Windmühlen und historischen Dörfern wie Ouderkerk aan de Amstel.",
    en: "Follows the Amstel river south, past windmills and historic villages like Ouderkerk aan de Amstel.",
    nl: "Volgt de Amstel zuidwaarts, langs molens en historische dorpen zoals Ouderkerk aan de Amstel.",
  },
  "waterland-runde": {
    de: "Nordholland-Kanal, Weerslotkanal, IJsselmeer-Deich, durch Broek in Waterland und Monnickendam; bei Wind am Deich exponiert.",
    en: "Noordhollandsch Canal, Weerslotkanal, IJsselmeer dike, through Broek in Waterland and Monnickendam; exposed to wind on the dike.",
    nl: "Noordhollandsch Kanaal, Weerslotkanaal, IJsselmeerdijk, door Broek in Waterland en Monnickendam; winderig op de dijk.",
  },
  "bollenstreek-zandvoort-runde": {
    de: "Amsterdam–Haarlem–Lisse–Zandvoort–Amsterdam; im Frühling Tulpenfelder, Küste bei Zandvoort, Kennemerduinen.",
    en: "Amsterdam–Haarlem–Lisse–Zandvoort–Amsterdam; tulip fields in spring, the coast at Zandvoort, Kennemerduinen.",
    nl: "Amsterdam–Haarlem–Lisse–Zandvoort–Amsterdam; in het voorjaar bollenvelden, de kust bij Zandvoort, Kennemerduinen.",
  },
  "alte-jaegerrunde": {
    de: "Moderate Höhenunterschiede für NL-Verhältnisse, Dünenlandschaft Zuid-Kennemerland.",
    en: "Moderate elevation changes by Dutch standards, dune landscape of Zuid-Kennemerland.",
    nl: "Gematigde hoogteverschillen naar Nederlandse maatstaven, duinlandschap van Zuid-Kennemerland.",
  },
  "sloterdijk-schiphol-runde": {
    de: "Neues Meer, Amsterdamse Bos, Schiphol, Amstelveen, zurück über die Amstel.",
    en: "Nieuwe Meer, Amsterdamse Bos, Schiphol, Amstelveen, back via the Amstel.",
    nl: "Nieuwe Meer, Amsterdamse Bos, Schiphol, Amstelveen, terug via de Amstel.",
  },
  "kustroute-den-haag-katwijk": {
    de: "Teil der Radfernroute LF Kustroute/EuroVelo 12, durchs Dünengebiet Meijendel.",
    en: "Part of the long-distance LF Kustroute/EuroVelo 12, through the Meijendel dune area.",
    nl: "Onderdeel van de LF Kustroute/EuroVelo 12, door het duingebied Meijendel.",
  },
  "kinderdijk-route": {
    de: "Entlang der UNESCO-Windmühlen von Kinderdijk, Flusslandschaft.",
    en: "Along the UNESCO windmills of Kinderdijk, a river landscape.",
    nl: "Langs de UNESCO-molens van Kinderdijk, rivierlandschap.",
  },
  "round-lake-veere": {
    de: "Umrundet den Veerse Meer, Highlights: Grote Kerk in Veere, Dünen bei Zoutelande.",
    en: "Loops around the Veerse Meer, highlights: the Grote Kerk in Veere, dunes at Zoutelande.",
    nl: "Rondje Veerse Meer, hoogtepunten: de Grote Kerk in Veere, duinen bij Zoutelande.",
  },
  "salzige-route": {
    de: "Entlang Oosterschelde und Westerschelde, kulinarischer Fokus.",
    en: "Along the Oosterschelde and Westerschelde, with a culinary focus.",
    nl: "Langs de Oosterschelde en Westerschelde, met een culinaire insteek.",
  },
  "der-sieg-ueber-das-wasser": {
    de: "Erinnert an die Sturmflut 1953, führt zum Watersnoodmuseum.",
    en: "Commemorates the 1953 North Sea flood, passing the Watersnoodmuseum.",
    nl: "Herinnert aan de watersnoodramp van 1953, langs het Watersnoodmuseum.",
  },
  "noord-beveland-entdecken": {
    de: "Küstenradwege vor dem Deich, Blick auf Oosterschelde und Veerse Meer.",
    en: "Coastal cycle paths in front of the dike, views of the Oosterschelde and Veerse Meer.",
    nl: "Kustfietspaden voor de dijk, uitzicht op de Oosterschelde en het Veerse Meer.",
  },
  "tholen-route": {
    de: "Weitläufige Polderlandschaft, historische Bauernhöfe.",
    en: "Wide-open polder landscape, historic farmhouses.",
    nl: "Weids polderlandschap, historische boerderijen.",
  },
  "zeelandische-wind-route": {
    de: "Anspruchsvoll, entlang der Deltawerke, für sportliche Fahrer.",
    en: "Demanding, along the Delta Works, for sporty riders.",
    nl: "Pittig, langs de Deltawerken, voor de sportieve fietser.",
  },
  zwinroute: {
    de: "Naturreservat Het Zwin, Ebbe-und-Flut-Landschaft.",
    en: "The Zwin nature reserve, a tidal landscape.",
    nl: "Natuurgebied Het Zwin, getijdenlandschap.",
  },
  "amstel-gold-race-loop": {
    de: "Bekannteste Rennrad-Herausforderung NLs, signifikante Höhenmeter für niederländische Verhältnisse.",
    en: "The Netherlands' best-known road cycling challenge, significant elevation gain by Dutch standards.",
    nl: "De bekendste racefietsuitdaging van Nederland, aanzienlijke hoogtemeters naar Nederlandse maatstaven.",
  },
  "drielandenpunt-runde": {
    de: "Grenzüberschreitend NL/BE/DE, kurze knackige Anstiege, aussichtsreiche Ab-/Auffahrten.",
    en: "Crosses the NL/BE/DE border, short punchy climbs, scenic descents and ascents.",
    nl: "Grensoverschrijdend NL/BE/DE, korte pittige klimmetjes, panoramische af- en beklimmingen.",
  },
  "tour-of-lake-veluwe": {
    de: "Malerische Seerunde um das Veluwemeer.",
    en: "A scenic loop around Lake Veluwe.",
    nl: "Schilderachtige rondrit om het Veluwemeer.",
  },
  "nationalpark-hoge-veluwe": {
    de: "Einer der größten Nationalparks Europas, vielfältige Flora/Fauna.",
    en: "One of the largest national parks in Europe, with diverse flora and fauna.",
    nl: "Een van de grootste nationale parken van Europa, met een grote diversiteit aan flora en fauna.",
  },
  "nationalpark-veluwezoom": {
    de: "Wechsel aus schattigen Waldabschnitten und offenen Heide-Panoramen.",
    en: "A mix of shaded forest sections and open heathland panoramas.",
    nl: "Afwisseling van schaduwrijke bospaden en open heidepanorama's.",
  },
};
