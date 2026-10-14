// Every delegation (National Paralympic Committee) that took part in the
// Paris 2024 Paralympic Games: 168 NPCs plus Neutral Paralympic Athletes and
// the Refugee Paralympic Team. Codes are the IPC three-letter codes.
// Each entry: [English name, Thai name, ISO flag file in /flags].
// NPA, RPT and Chinese Taipei compete under their own Paralympic flags, so
// they show a neutral flag. Unknown codes still work and get a neutral flag.
export const NPC = {
  AFG: ["Afghanistan", "อัฟกานิสถาน", 'af'],
  ALG: ["Algeria", "แอลจีเรีย", 'dz'],
  ANG: ["Angola", "แองโกลา", 'ao'],
  ARG: ["Argentina", "อาร์เจนตินา", 'ar'],
  ARM: ["Armenia", "อาร์มีเนีย", 'am'],
  ARU: ["Aruba", "อารูบา", 'aw'],
  AUS: ["Australia", "ออสเตรเลีย", 'au'],
  AUT: ["Austria", "ออสเตรีย", 'at'],
  AZE: ["Azerbaijan", "อาเซอร์ไบจาน", 'az'],
  BRN: ["Bahrain", "บาห์เรน", 'bh'],
  BAN: ["Bangladesh", "บังกลาเทศ", 'bd'],
  BAR: ["Barbados", "บาร์เบโดส", 'bb'],
  BEL: ["Belgium", "เบลเยียม", 'be'],
  BEN: ["Benin", "เบนิน", 'bj'],
  BER: ["Bermuda", "เบอร์มิวดา", 'bm'],
  BHU: ["Bhutan", "ภูฏาน", 'bt'],
  BIH: ["Bosnia and Herzegovina", "บอสเนียและเฮอร์เซโกวีนา", 'ba'],
  BOT: ["Botswana", "บอตสวานา", 'bw'],
  BRA: ["Brazil", "บราซิล", 'br'],
  BUL: ["Bulgaria", "บัลแกเรีย", 'bg'],
  BUR: ["Burkina Faso", "บูร์กินาฟาโซ", 'bf'],
  BDI: ["Burundi", "บุรุนดี", 'bi'],
  CAM: ["Cambodia", "กัมพูชา", 'kh'],
  CMR: ["Cameroon", "แคเมอรูน", 'cm'],
  CAN: ["Canada", "แคนาดา", 'ca'],
  CPV: ["Cape Verde", "กาบูเวร์ดี", 'cv'],
  CAF: ["Central African Republic", "สาธารณรัฐแอฟริกากลาง", 'cf'],
  CHI: ["Chile", "ชิลี", 'cl'],
  CHN: ["China", "จีน", 'cn'],
  COL: ["Colombia", "โคลอมเบีย", 'co'],
  CRC: ["Costa Rica", "คอสตาริกา", 'cr'],
  CRO: ["Croatia", "โครเอเชีย", 'hr'],
  CUB: ["Cuba", "คิวบา", 'cu'],
  CYP: ["Cyprus", "ไซปรัส", 'cy'],
  CZE: ["Czechia", "เช็กเกีย", 'cz'],
  COD: ["DR Congo", "สาธารณรัฐประชาธิปไตยคองโก", 'cd'],
  DEN: ["Denmark", "เดนมาร์ก", 'dk'],
  DOM: ["Dominican Republic", "สาธารณรัฐโดมินิกัน", 'do'],
  ECU: ["Ecuador", "เอกวาดอร์", 'ec'],
  EGY: ["Egypt", "อียิปต์", 'eg'],
  ESA: ["El Salvador", "เอลซัลวาดอร์", 'sv'],
  ERI: ["Eritrea", "เอริเทรีย", 'er'],
  EST: ["Estonia", "เอสโตเนีย", 'ee'],
  ETH: ["Ethiopia", "เอธิโอเปีย", 'et'],
  FIJ: ["Fiji", "ฟีจี", 'fj'],
  FIN: ["Finland", "ฟินแลนด์", 'fi'],
  FRA: ["France", "ฝรั่งเศส", 'fr'],
  GAB: ["Gabon", "กาบอง", 'ga'],
  GAM: ["The Gambia", "แกมเบีย", 'gm'],
  GEO: ["Georgia", "จอร์เจีย", 'ge'],
  GER: ["Germany", "เยอรมนี", 'de'],
  GHA: ["Ghana", "กานา", 'gh'],
  GBR: ["Great Britain", "สหราชอาณาจักร", 'gb'],
  GRE: ["Greece", "กรีซ", 'gr'],
  GRN: ["Grenada", "เกรนาดา", 'gd'],
  GUA: ["Guatemala", "กัวเตมาลา", 'gt'],
  GUI: ["Guinea", "กินี", 'gn'],
  GBS: ["Guinea-Bissau", "กินี-บิสเซา", 'gw'],
  HAI: ["Haiti", "เฮติ", 'ht'],
  HON: ["Honduras", "ฮอนดูรัส", 'hn'],
  HKG: ["Hong Kong, China", "ฮ่องกง", 'hk'],
  HUN: ["Hungary", "ฮังการี", 'hu'],
  ISL: ["Iceland", "ไอซ์แลนด์", 'is'],
  IND: ["India", "อินเดีย", 'in'],
  INA: ["Indonesia", "อินโดนีเซีย", 'id'],
  IRI: ["Iran", "อิหร่าน", 'ir'],
  IRQ: ["Iraq", "อิรัก", 'iq'],
  IRL: ["Ireland", "ไอร์แลนด์", 'ie'],
  ISR: ["Israel", "อิสราเอล", 'il'],
  ITA: ["Italy", "อิตาลี", 'it'],
  CIV: ["Côte d'Ivoire", "โกตดิวัวร์", 'ci'],
  JAM: ["Jamaica", "จาเมกา", 'jm'],
  JPN: ["Japan", "ญี่ปุ่น", 'jp'],
  JOR: ["Jordan", "จอร์แดน", 'jo'],
  KAZ: ["Kazakhstan", "คาซัคสถาน", 'kz'],
  KEN: ["Kenya", "เคนยา", 'ke'],
  KIR: ["Kiribati", "คิริบาส", 'ki'],
  KOS: ["Kosovo", "คอซอวอ", 'xk'],
  KUW: ["Kuwait", "คูเวต", 'kw'],
  KGZ: ["Kyrgyzstan", "คีร์กีซสถาน", 'kg'],
  LAO: ["Laos", "ลาว", 'la'],
  LAT: ["Latvia", "ลัตเวีย", 'lv'],
  LBN: ["Lebanon", "เลบานอน", 'lb'],
  LES: ["Lesotho", "เลโซโท", 'ls'],
  LBR: ["Liberia", "ไลบีเรีย", 'lr'],
  LBA: ["Libya", "ลิเบีย", 'ly'],
  LTU: ["Lithuania", "ลิทัวเนีย", 'lt'],
  LUX: ["Luxembourg", "ลักเซมเบิร์ก", 'lu'],
  MAC: ["Macao, China", "มาเก๊า", 'mo'],
  MAW: ["Malawi", "มาลาวี", 'mw'],
  MAS: ["Malaysia", "มาเลเซีย", 'my'],
  MDV: ["Maldives", "มัลดีฟส์", 'mv'],
  MLI: ["Mali", "มาลี", 'ml'],
  MLT: ["Malta", "มอลตา", 'mt'],
  MRI: ["Mauritius", "มอริเชียส", 'mu'],
  MEX: ["Mexico", "เม็กซิโก", 'mx'],
  MDA: ["Moldova", "มอลโดวา", 'md'],
  MGL: ["Mongolia", "มองโกเลีย", 'mn'],
  MNE: ["Montenegro", "มอนเตเนโกร", 'me'],
  MAR: ["Morocco", "โมร็อกโก", 'ma'],
  MOZ: ["Mozambique", "โมซัมบิก", 'mz'],
  MYA: ["Myanmar", "เมียนมา", 'mm'],
  NAM: ["Namibia", "นามิเบีย", 'na'],
  NEP: ["Nepal", "เนปาล", 'np'],
  NED: ["Netherlands", "เนเธอร์แลนด์", 'nl'],
  NPA: ["Neutral Paralympic Athletes", "นักกีฬาพาราลิมปิกที่เป็นกลาง", ''],
  NZL: ["New Zealand", "นิวซีแลนด์", 'nz'],
  NCA: ["Nicaragua", "นิการากัว", 'ni'],
  NIG: ["Niger", "ไนเจอร์", 'ne'],
  NGR: ["Nigeria", "ไนจีเรีย", 'ng'],
  MKD: ["North Macedonia", "มาซิโดเนียเหนือ", 'mk'],
  NOR: ["Norway", "นอร์เวย์", 'no'],
  OMA: ["Oman", "โอมาน", 'om'],
  PAK: ["Pakistan", "ปากีสถาน", 'pk'],
  PLE: ["Palestine", "ปาเลสไตน์", 'ps'],
  PAN: ["Panama", "ปานามา", 'pa'],
  PNG: ["Papua New Guinea", "ปาปัวนิวกินี", 'pg'],
  PAR: ["Paraguay", "ปารากวัย", 'py'],
  PER: ["Peru", "เปรู", 'pe'],
  PHI: ["Philippines", "ฟิลิปปินส์", 'ph'],
  POL: ["Poland", "โปแลนด์", 'pl'],
  POR: ["Portugal", "โปรตุเกส", 'pt'],
  PUR: ["Puerto Rico", "เปอร์โตริโก", 'pr'],
  QAT: ["Qatar", "กาตาร์", 'qa'],
  RPT: ["Refugee Paralympic Team", "ทีมผู้ลี้ภัยพาราลิมปิก", ''],
  CGO: ["Republic of the Congo", "สาธารณรัฐคองโก", 'cg'],
  ROU: ["Romania", "โรมาเนีย", 'ro'],
  RWA: ["Rwanda", "รวันดา", 'rw'],
  VIN: ["Saint Vincent and the Grenadines", "เซนต์วินเซนต์และเกรนาดีนส์", 'vc'],
  STP: ["São Tomé and Príncipe", "เซาตูเมและปรินซิปี", 'st'],
  KSA: ["Saudi Arabia", "ซาอุดีอาระเบีย", 'sa'],
  SEN: ["Senegal", "เซเนกัล", 'sn'],
  SRB: ["Serbia", "เซอร์เบีย", 'rs'],
  SLE: ["Sierra Leone", "เซียร์ราลีโอน", 'sl'],
  SGP: ["Singapore", "สิงคโปร์", 'sg'],
  SVK: ["Slovakia", "สโลวาเกีย", 'sk'],
  SLO: ["Slovenia", "สโลวีเนีย", 'si'],
  SOL: ["Solomon Islands", "หมู่เกาะโซโลมอน", 'sb'],
  SOM: ["Somalia", "โซมาเลีย", 'so'],
  RSA: ["South Africa", "แอฟริกาใต้", 'za'],
  KOR: ["Republic of Korea", "สาธารณรัฐเกาหลี", 'kr'],
  ESP: ["Spain", "สเปน", 'es'],
  SRI: ["Sri Lanka", "ศรีลังกา", 'lk'],
  SUR: ["Suriname", "ซูรินาม", 'sr'],
  SWE: ["Sweden", "สวีเดน", 'se'],
  SUI: ["Switzerland", "สวิตเซอร์แลนด์", 'ch'],
  SYR: ["Syria", "ซีเรีย", 'sy'],
  TPE: ["Chinese Taipei", "จีนไทเป", ''],
  TAN: ["Tanzania", "แทนซาเนีย", 'tz'],
  THA: ["Thailand", "ประเทศไทย", 'th'],
  TLS: ["Timor-Leste", "ติมอร์-เลสเต", 'tl'],
  TOG: ["Togo", "โตโก", 'tg'],
  TGA: ["Tonga", "ตองกา", 'to'],
  TTO: ["Trinidad and Tobago", "ตรินิแดดและโตเบโก", 'tt'],
  TUN: ["Tunisia", "ตูนิเซีย", 'tn'],
  TUR: ["Türkiye", "ตุรกี", 'tr'],
  TKM: ["Turkmenistan", "เติร์กเมนิสถาน", 'tm'],
  UGA: ["Uganda", "ยูกันดา", 'ug'],
  UKR: ["Ukraine", "ยูเครน", 'ua'],
  UAE: ["United Arab Emirates", "สหรัฐอาหรับเอมิเรตส์", 'ae'],
  USA: ["United States", "สหรัฐอเมริกา", 'us'],
  URU: ["Uruguay", "อุรุกวัย", 'uy'],
  UZB: ["Uzbekistan", "อุซเบกิสถาน", 'uz'],
  VAN: ["Vanuatu", "วานูอาตู", 'vu'],
  VEN: ["Venezuela", "เวเนซุเอลา", 've'],
  VIE: ["Vietnam", "เวียดนาม", 'vn'],
  ISV: ["US Virgin Islands", "หมู่เกาะเวอร์จินของสหรัฐฯ", 'vi'],
  YEM: ["Yemen", "เยเมน", 'ye'],
  ZAM: ["Zambia", "แซมเบีย", 'zm'],
  ZIM: ["Zimbabwe", "ซิมบับเว", 'zw'],
}
const BY_NAME = Object.fromEntries(Object.entries(NPC).map(([code, [name]]) => [name.toLowerCase(), code]))
// Common other spellings the backend might send.
Object.assign(BY_NAME, { 'south korea': 'KOR', korea: 'KOR', 'united kingdom': 'GBR', uk: 'GBR', 'united states of america': 'USA', turkey: 'TUR', 'czech republic': 'CZE', 'ivory coast': 'CIV', 'hong kong': 'HKG', macau: 'MAC', 'gambia': 'GAM', 'cabo verde': 'CPV', 'virgin islands': 'ISV', 'taiwan': 'TPE', 'democratic republic of the congo': 'COD', 'congo': 'CGO', 'viet nam': 'VIE', 'lao pdr': 'LAO', 'east timor': 'TLS' })
// Chip colours: fixed for the host region, others picked from the code.
const FIXED = {"THA": "#0B3D91", "MAS": "#B3261E", "INA": "#9A3412", "VIE": "#A21CAF", "PHI": "#6D28D9", "MYA": "#166534", "SGP": "#3F3F46", "CAM": "#0F766E", "LAO": "#1E40AF", "TLS": "#9F1239"}
const PALETTE = ["#0B3D91", "#B3261E", "#9A3412", "#A21CAF", "#6D28D9", "#166534", "#3F3F46", "#0F766E", "#1E40AF", "#854D0E", "#9F1239", "#155E75"]

export function countryCode(value) {
  if (!value) return '—'
  const v = String(value).trim()
  if (NPC[v.toUpperCase()]) return v.toUpperCase()
  if (BY_NAME[v.toLowerCase()]) return BY_NAME[v.toLowerCase()]
  return v.slice(0, 3).toUpperCase()
}
export function countryName(value) {
  const code = countryCode(value)
  return NPC[code] ? NPC[code][0] : String(value || 'Unknown')
}
export function countryThai(value) {
  const code = countryCode(value)
  return NPC[code] ? NPC[code][1] : ''
}
export function countryFlag(value) {
  const code = countryCode(value)
  const iso = NPC[code]?.[2]
  return `flags/${iso || 'neutral'}.svg`
}
export function countryColor(value) {
  const code = countryCode(value)
  if (FIXED[code]) return FIXED[code]
  let h = 0
  for (const ch of code) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return PALETTE[h % PALETTE.length]
}
// All delegations sorted by English name, for pickers.
export const ALL_COUNTRIES = Object.keys(NPC).sort((a, b) => NPC[a][0].localeCompare(NPC[b][0]))
