// ─── OCR Language Support Module ─────────────────────────────────────────────
// Post-correction dictionaries and scoring for DE, FR, ES, IT, PT languages

const commonSubstitutions = [
  [/\bIl\b/g, 'Il'],
  [/\s{2,}/g, ' '],
];

const languageProfiles = {
  rus: {
    name: 'Russian',
    alphabet: /[А-Яа-яЁё]/g,
    commonWords: ['и', 'в', 'на', 'не', 'что', 'он', 'как', 'это', 'по', 'но', 'из', 'за', 'для', 'его', 'от', 'до', 'при', 'уже', 'все', 'она', 'так', 'они', 'был', 'бы', 'ещё', 'же', 'ни', 'ко', 'то', 'да', 'я', 'мы', 'ты', 'вы', 'оно', 'мне', 'тебе', 'нам', 'вам', 'ему', 'ей', 'им', 'меня', 'тебя', 'нас', 'вас', 'её', 'их', 'себя', 'свой', 'кто', 'какой', 'который', 'чей', 'сколько', 'где', 'когда', 'куда', 'откуда', 'почему', 'зачем', 'быть', 'иметь', 'мочь', 'знать', 'хотеть', 'видеть', 'говорить', 'думать', 'стать', 'делать', 'идти', 'дать', 'сказать', 'работать', 'жить', 'стоять', 'называть', 'начать', 'должен', 'нужно', 'человек', 'время', 'год', 'дело', 'жизнь', 'день', 'рука', 'работа', 'слово', 'место', 'лицо', 'друг', 'глаз', 'вопрос', 'дом', 'сторона', 'страна', 'мир', 'случай', 'голова', 'ребёнок', 'сила', 'конец', 'большой', 'новый', 'хороший', 'старый', 'последний', 'другой', 'каждый', 'первый', 'должный', 'русский', 'молодой', 'главный', 'общий', 'важный', 'маленький', 'тоже', 'только', 'очень', 'здесь', 'сейчас', 'там', 'потом', 'тогда', 'вдруг', 'опять', 'сразу', 'даже', 'почти', 'через', 'между', 'после', 'перед', 'под', 'над', 'если', 'чтобы', 'потому', 'хотя', 'или', 'либо', 'ведь', 'ибо', 'без', 'более', 'будет', 'вот', 'всё', 'два', 'другие', 'есть', 'ещё', 'какие', 'может', 'надо', 'них', 'ну', 'один', 'очень', 'раз', 'свою', 'себе', 'такой', 'такие', 'теперь', 'тут', 'часть', 'чем', 'этот', 'эти', 'этого'],
    fixes: [
      [/rnе/g, 'те'],
      [/rn/g, 'т'],
      [/\bпо3/g, 'поз'],
      [/0([А-Яа-я])/g, 'О$1'],
      [/([А-Яа-я])0/g, '$1О'],
      [/3([а-яё])/g, 'з$1'],
      [/([а-яё])3/g, '$1з'],
      [/\bТI/g, 'Т'],
      [/\bСТ0/g, 'СТО'],
      [/\bС0/g, 'СО'],
      [/\bд0/g, 'до'],
    ],
  },
  eng: {
    name: 'English',
    alphabet: /[A-Za-z]/g,
    commonWords: ['the', 'be', 'to', 'of', 'and', 'a', 'in', 'that', 'have', 'i', 'it', 'for', 'not', 'on', 'with', 'he', 'as', 'you', 'do', 'at', 'this', 'but', 'his', 'by', 'from', 'they', 'we', 'say', 'her', 'she'],
    fixes: [
      [/\brn\b/g, 'm'],
      [/\bcI\b/g, 'cl'],
      [/\btI\b/g, 'tl'],
    ],
  },
  deu: {
    name: 'German',
    alphabet: /[A-Za-zÄäÖöÜüß]/g,
    commonWords: ['der', 'die', 'und', 'in', 'den', 'von', 'zu', 'das', 'mit', 'sich', 'des', 'auf', 'für', 'ist', 'im', 'dem', 'nicht', 'ein', 'eine', 'als', 'auch', 'es', 'an', 'werden', 'aus', 'er', 'hat', 'dass', 'sie', 'nach'],
    fixes: [
      [/\brn/g, 'm'],
      [/ii/g, 'ü'],
      [/oe/g, 'ö'],
      [/ae/g, 'ä'],
      [/Ii/g, 'Ü'],
      [/\bfiir\b/g, 'für'],
      [/\bDaf3\b/g, 'Daß'],
      [/13/g, 'ß'],
    ],
  },
  fra: {
    name: 'French',
    alphabet: /[A-Za-zÀ-ÿ]/g,
    commonWords: ['de', 'la', 'le', 'et', 'les', 'des', 'en', 'un', 'du', 'une', 'que', 'est', 'dans', 'qui', 'par', 'pour', 'au', 'il', 'sur', 'pas', 'plus', 'ce', 'ne', 'ou', 'se', 'son', 'avec', 'sont', 'tout', 'mais'],
    fixes: [
      [/\brn/g, 'm'],
      [/I'/g, "l'"],
      [/c'/g, "c'"],
      [/n'/g, "n'"],
      [/\bqu '/g, "qu'"],
      [/\bl '/g, "l'"],
      [/\bd '/g, "d'"],
      [/oeu/g, 'œu'],
    ],
  },
  spa: {
    name: 'Spanish',
    alphabet: /[A-Za-záéíóúñüÁÉÍÓÚÑÜ¿¡]/g,
    commonWords: ['de', 'la', 'que', 'el', 'en', 'y', 'a', 'los', 'del', 'se', 'las', 'por', 'un', 'para', 'con', 'no', 'una', 'su', 'al', 'lo', 'como', 'más', 'pero', 'sus', 'le', 'ya', 'o', 'fue', 'este', 'ha'],
    fixes: [
      [/\brn/g, 'm'],
      [/ii/g, 'ñ'],
      [/\b;/g, '¡'],
      [/\b\?$/g, '¿'],
    ],
  },
  ita: {
    name: 'Italian',
    alphabet: /[A-Za-zÀ-ÿ]/g,
    commonWords: ['di', 'che', 'è', 'e', 'la', 'il', 'un', 'a', 'per', 'in', 'una', 'mi', 'sono', 'ho', 'non', 'lo', 'ma', 'ha', 'le', 'si', 'no', 'al', 'da', 'del', 'dei', 'con', 'come', 'io', 'ci', 'questo'],
    fixes: [
      [/\brn/g, 'm'],
      [/I'/g, "l'"],
      [/c'/g, "c'"],
      [/d'/g, "d'"],
      [/n'/g, "n'"],
      [/\bpiu\b/g, 'più'],
      [/\bperche\b/g, 'perché'],
    ],
  },
  por: {
    name: 'Portuguese',
    alphabet: /[A-Za-záàâãéèêíóòôõúçÁÀÂÃÉÈÊÍÓÒÔÕÚÇ]/g,
    commonWords: ['de', 'a', 'o', 'que', 'e', 'do', 'da', 'em', 'um', 'para', 'é', 'com', 'não', 'uma', 'os', 'no', 'se', 'na', 'por', 'mais', 'as', 'dos', 'como', 'mas', 'foi', 'ao', 'ele', 'das', 'tem', 'seu'],
    fixes: [
      [/\brn/g, 'm'],
      [/\bcao\b/g, 'ção'],
      [/cao\b/g, 'ção'],
      [/\bnao\b/gi, 'não'],
      [/\be\b(?=[a-z])/g, 'é'],
    ],
  },
  // ─── New languages (Phase 3.2) ──────────────────────────────────────────
  chi_sim: {
    name: 'Chinese (Simplified)',
    alphabet: /[\u4e00-\u9fff]/g,
    commonWords: ['的', '是', '了', '在', '不', '和', '有', '这', '人', '中', '大', '为', '上', '个', '国', '我', '以', '要', '他', '时', '来', '用', '们', '到', '说', '她', '作', '会', '着', '就'],
    fixes: [],
  },
  chi_tra: {
    name: 'Chinese (Traditional)',
    alphabet: /[\u4e00-\u9fff\u3400-\u4dbf]/g,
    commonWords: ['的', '是', '了', '在', '不', '和', '有', '這', '人', '中', '大', '為', '上', '個', '國', '我', '以', '要', '他', '時', '來', '用', '們', '到', '說', '她', '作', '會', '著', '就'],
    fixes: [],
  },
  jpn: {
    name: 'Japanese',
    alphabet: /[\u3040-\u309f\u30a0-\u30ff\u4e00-\u9fff]/g,
    commonWords: ['の', 'に', 'は', 'を', 'た', 'が', 'で', 'て', 'と', 'し', 'れ', 'さ', 'ある', 'いる', 'する', 'から', 'こと', 'この', 'それ', 'なる', 'ない', 'よう', 'もの', 'です', 'ます', 'その', 'ため', 'また', 'ども', 'など'],
    fixes: [],
  },
  kor: {
    name: 'Korean',
    alphabet: /[\uac00-\ud7af\u1100-\u11ff]/g,
    commonWords: ['이', '는', '을', '의', '에', '가', '하', '는', '고', '다', '한', '로', '에서', '과', '도', '수', '들', '그', '것', '이다', '위', '와', '않', '대', '되', '후', '무', '사', '전', '주'],
    fixes: [],
  },
  ara: {
    name: 'Arabic',
    alphabet: /[\u0600-\u06ff\u0750-\u077f]/g,
    commonWords: ['في', 'من', 'على', 'إلى', 'أن', 'هذا', 'التي', 'هو', 'الذي', 'كان', 'عن', 'أو', 'ما', 'مع', 'بين', 'هي', 'لا', 'بعد', 'كل', 'ذلك', 'عند', 'قد', 'لم', 'ثم', 'حتى', 'تم', 'يا', 'منذ', 'أيضا', 'فقط'],
    fixes: [],
  },
  hin: {
    name: 'Hindi',
    alphabet: /[\u0900-\u097f]/g,
    commonWords: ['का', 'के', 'में', 'है', 'की', 'को', 'और', 'से', 'ने', 'पर', 'एक', 'यह', 'कि', 'हैं', 'भी', 'नहीं', 'तो', 'कर', 'था', 'हो', 'वह', 'इस', 'या', 'अपने', 'जो', 'बाद', 'साथ', 'अब', 'उन', 'गया'],
    fixes: [],
  },
  tur: {
    name: 'Turkish',
    alphabet: /[A-Za-zÇçĞğİıÖöŞşÜü]/g,
    commonWords: ['bir', 'bu', 've', 'de', 'için', 'ile', 'da', 'olan', 'olarak', 'en', 'gibi', 'daha', 'çok', 'var', 'sonra', 'ne', 'kadar', 'üzerinde', 'ancak', 'yıl', 'ise', 'tarafından', 'ya', 'her', 'den', 'ama', 'bunu', 'arasında', 'önce', 'büyük'],
    fixes: [
      [/\brn/g, 'm'],
      [/I/g, 'İ'],
    ],
  },
  pol: {
    name: 'Polish',
    alphabet: /[A-Za-zĄąĆćĘęŁłŃńÓóŚśŹźŻż]/g,
    commonWords: ['i', 'w', 'na', 'nie', 'z', 'się', 'do', 'to', 'że', 'jest', 'jak', 'ale', 'co', 'o', 'tak', 'za', 'od', 'już', 'po', 'by', 'ze', 'czy', 'tylko', 'jego', 'jej', 'ich', 'gdy', 'ten', 'może', 'tego'],
    fixes: [
      [/\brn/g, 'm'],
      [/l\b/g, 'ł'],
    ],
  },
  ces: {
    name: 'Czech',
    alphabet: /[A-Za-záčďéěíňóřšťúůýžÁČĎÉĚÍŇÓŘŠŤÚŮÝŽ]/g,
    commonWords: ['a', 'v', 'je', 'na', 'se', 'že', 'to', 'z', 'do', 'pro', 'ale', 'si', 'o', 's', 'jako', 'jeho', 'byl', 'by', 'tak', 'po', 'jsou', 'jak', 'i', 'nebo', 'ten', 'už', 'za', 'když', 'být', 'co'],
    fixes: [
      [/\brn/g, 'm'],
    ],
  },
  // ─── New languages (Phase 4) ──────────────────────────────────────────────
  ukr: {
    name: 'Ukrainian',
    alphabet: /[А-Яа-яЁёІіЇїЄєҐґ']/g,
    commonWords: ['і', 'в', 'на', 'не', 'що', 'він', 'як', 'це', 'по', 'але', 'з', 'за', 'для', 'його', 'від', 'до', 'при', 'вже', 'все', 'вона', 'так', 'вони', 'був', 'би', 'ще', 'же', 'ні', 'ко', 'то', 'та', 'я', 'ми', 'ти', 'ви', 'воно', 'мені', 'тобі', 'нам', 'вам', 'йому', 'їй', 'їм', 'мене', 'тебе', 'нас', 'вас', 'її', 'їх'],
    fixes: [
      [/rn/g, 'т'],
      [/0([А-Яа-яІіЇїЄєҐґ])/g, 'О$1'],
      [/([А-Яа-яІіЇїЄєҐґ])0/g, '$1о'],
      [/3([а-яіїєґ])/g, 'з$1'],
      [/\bii\b/g, 'ії'],
      [/\bi([а-яєїґ])/g, 'і$1'],
    ],
  },
  bel: {
    name: 'Belarusian',
    alphabet: /[А-Яа-яЁёЎўІі']/g,
    commonWords: ['і', 'у', 'на', 'не', 'што', 'ён', 'як', 'гэта', 'па', 'але', 'з', 'за', 'для', 'яго', 'ад', 'да', 'пры', 'ужо', 'усё', 'яна', 'так', 'яны', 'быў', 'бы', 'яшчэ', 'жа', 'ні', 'ка', 'то', 'ды', 'я', 'мы', 'ты', 'вы', 'яно', 'мне', 'табе', 'нам', 'вам', 'яму', 'ёй', 'ім', 'мяне', 'цябе', 'нас', 'вас', 'яе', 'іх'],
    fixes: [
      [/rn/g, 'т'],
      [/0([А-Яа-яЎўІі])/g, 'О$1'],
      [/([А-Яа-яЎўІі])0/g, '$1о'],
      [/3([а-яўі])/g, 'з$1'],
      [/y([а-я])/g, 'ў$1'],
    ],
  },
  nld: {
    name: 'Dutch',
    alphabet: /[A-Za-zÀ-ÿĳĲ]/g,
    commonWords: ['de', 'het', 'een', 'van', 'en', 'in', 'is', 'dat', 'op', 'te', 'zijn', 'voor', 'met', 'die', 'niet', 'aan', 'er', 'maar', 'om', 'ook', 'als', 'dan', 'nog', 'wat', 'bij', 'uit', 'wel', 'naar', 'kan', 'zo', 'al', 'werd', 'door', 'over', 'deze', 'tot', 'heb', 'heeft', 'hun', 'haar', 'zou', 'jaar', 'meer', 'veel', 'geen', 'nu', 'mijn', 'waar', 'ons', 'dit'],
    fixes: [
      [/\brn/g, 'm'],
      [/IJ/g, 'IJ'],
      [/ij/g, 'ij'],
      [/\bee\b(?=n\s)/g, 'ee'],
    ],
  },
  swe: {
    name: 'Swedish',
    alphabet: /[A-Za-zÅåÄäÖö]/g,
    commonWords: ['och', 'i', 'att', 'det', 'som', 'en', 'på', 'är', 'av', 'för', 'med', 'har', 'den', 'till', 'inte', 'om', 'ett', 'men', 'var', 'jag', 'de', 'så', 'han', 'vi', 'kan', 'ska', 'från', 'sin', 'hade', 'hon', 'här', 'vid', 'nu', 'eller', 'bara', 'efter', 'alla', 'under', 'sig', 'ut', 'hur', 'mot', 'upp', 'två', 'då', 'mycket', 'bli', 'år', 'där', 'blev'],
    fixes: [
      [/\brn/g, 'm'],
      [/a\b/g, 'å'],
      [/ii/g, 'ö'],
    ],
  },
  nor: {
    name: 'Norwegian',
    alphabet: /[A-Za-zÆæØøÅå]/g,
    commonWords: ['og', 'i', 'er', 'det', 'som', 'en', 'på', 'av', 'for', 'med', 'har', 'den', 'til', 'ikke', 'om', 'et', 'men', 'var', 'jeg', 'de', 'så', 'han', 'vi', 'kan', 'skal', 'fra', 'sin', 'hadde', 'hun', 'her', 'ved', 'nå', 'eller', 'bare', 'etter', 'alle', 'under', 'seg', 'ut', 'mot', 'opp', 'to', 'da', 'mye', 'bli', 'år', 'der', 'ble', 'denne', 'mange'],
    fixes: [
      [/\brn/g, 'm'],
      [/ae/g, 'æ'],
      [/oe/g, 'ø'],
    ],
  },
  fin: {
    name: 'Finnish',
    alphabet: /[A-Za-zÄäÖö]/g,
    commonWords: ['ja', 'on', 'ei', 'se', 'että', 'oli', 'hän', 'kun', 'niin', 'ovat', 'mutta', 'tai', 'ne', 'jo', 'olla', 'vain', 'ole', 'myös', 'kuin', 'sitä', 'he', 'sen', 'tämä', 'nyt', 'yli', 'tässä', 'siitä', 'mutta', 'miten', 'sitten', 'vielä', 'minä', 'sinä', 'me', 'te', 'kanssa', 'itse', 'kaikki', 'eri', 'joka', 'mitä', 'ennen', 'hyvä', 'saada', 'tulla', 'tehdä', 'ottaa', 'antaa', 'pitää', 'nähdä'],
    fixes: [
      [/\brn/g, 'm'],
      [/ii/g, 'ä'],
      [/oe/g, 'ö'],
    ],
  },
  ell: {
    name: 'Greek',
    alphabet: /[\u0370-\u03FF\u1F00-\u1FFF]/g,
    commonWords: ['και', 'το', 'να', 'της', 'με', 'που', 'τα', 'ο', 'η', 'ένα', 'για', 'στο', 'τον', 'από', 'είναι', 'δεν', 'θα', 'αυτό', 'αυτή', 'μου', 'σου', 'του', 'στη', 'στα', 'αλλά', 'πολύ', 'έχει', 'αυτά', 'μια', 'σε', 'ως', 'κάτι', 'πως', 'εδώ', 'εκεί', 'πριν', 'μετά', 'μέσα', 'πάνω', 'κάτω', 'όλα', 'όταν', 'τώρα', 'ήταν', 'μπορεί', 'μόνο', 'κάνει', 'λέει', 'πάει', 'βλέπει'],
    fixes: [
      [/rn/g, 'τ'],
      [/0/g, 'Ο'],
    ],
  },
  heb: {
    name: 'Hebrew',
    alphabet: /[\u0590-\u05FF]/g,
    commonWords: ['של', 'הוא', 'על', 'לא', 'את', 'זה', 'עם', 'כי', 'גם', 'או', 'היא', 'אם', 'כל', 'אני', 'יש', 'מה', 'הם', 'אל', 'בין', 'רק', 'עד', 'כך', 'היה', 'אחד', 'אבל', 'מן', 'כמו', 'הן', 'אחר', 'שלא', 'לו', 'אנחנו', 'הזה', 'עוד', 'אותו', 'פי', 'כבר', 'למה', 'שם', 'שלו', 'כדי', 'תוך', 'ידי', 'לפני', 'אפשר', 'צריך', 'אותה', 'הרבה', 'איך', 'שני'],
    fixes: [],
  },
  vie: {
    name: 'Vietnamese',
    alphabet: /[A-Za-zÀ-ỹĂăÂâĐđÊêÔôƠơƯư]/g,
    commonWords: ['và', 'của', 'là', 'có', 'được', 'trong', 'cho', 'không', 'một', 'này', 'với', 'các', 'để', 'đã', 'từ', 'người', 'những', 'hay', 'khi', 'về', 'tại', 'do', 'còn', 'đến', 'ra', 'theo', 'hoặc', 'như', 'nhưng', 'vào', 'lại', 'nào', 'sẽ', 'đó', 'năm', 'trên', 'cũng', 'rất', 'phải', 'thì', 'đây', 'ở', 'sau', 'bị', 'nên', 'qua', 'nhiều', 'vẫn', 'mà', 'bằng'],
    fixes: [
      [/\brn/g, 'm'],
      [/d\b/g, 'đ'],
    ],
  },
  tha: {
    name: 'Thai',
    alphabet: /[\u0E00-\u0E7F]/g,
    commonWords: ['ที่', 'และ', 'ใน', 'มี', 'ไม่', 'ของ', 'จะ', 'ได้', 'ว่า', 'เป็น', 'การ', 'ให้', 'กับ', 'ก็', 'แต่', 'คน', 'นี้', 'จาก', 'หรือ', 'ไป', 'มา', 'อยู่', 'แล้ว', 'ทำ', 'เรา', 'คือ', 'นั้น', 'ถ้า', 'เขา', 'ดี', 'ต้อง', 'อีก', 'ยัง', 'กัน', 'ซึ่ง', 'ครับ', 'ค่ะ', 'แม้', 'หนึ่ง', 'ทุก', 'เมื่อ', 'ความ', 'บ้าน', 'วัน', 'กว่า', 'ระหว่าง', 'แรก', 'ผม', 'ดัง', 'น่า'],
    fixes: [],
  },
  ron: {
    name: 'Romanian',
    alphabet: /[A-Za-zĂăÂâÎîȘșȚț]/g,
    commonWords: ['și', 'în', 'de', 'la', 'cu', 'pe', 'un', 'este', 'nu', 'că', 'o', 'din', 'care', 'se', 'a', 'mai', 'sunt', 'ce', 'al', 'le', 'pentru', 'sau', 'să', 'i', 'acest', 'am', 'ca', 'dar', 'ea', 'el', 'fost', 'fi', 'lui', 'ei', 'era', 'lor', 'foarte', 'avea', 'după', 'face', 'tot', 'acum', 'doar', 'când', 'unde', 'cum', 'aici', 'ori', 'toți', 'putea'],
    fixes: [
      [/\brn/g, 'm'],
      [/s,/g, 'ș'],
      [/t,/g, 'ț'],
      [/S,/g, 'Ș'],
      [/T,/g, 'Ț'],
    ],
  },
  bul: {
    name: 'Bulgarian',
    alphabet: /[А-Яа-яЁё]/g,
    commonWords: ['и', 'на', 'в', 'е', 'за', 'не', 'да', 'от', 'с', 'се', 'че', 'по', 'са', 'те', 'но', 'ще', 'до', 'ги', 'ми', 'му', 'го', 'ме', 'им', 'ни', 'при', 'като', 'още', 'бе', 'си', 'тя', 'той', 'аз', 'тук', 'там', 'има', 'какво', 'защо', 'когато', 'само', 'може', 'ние', 'вие', 'така', 'нещо', 'всеки', 'между', 'след', 'преди', 'много', 'под'],
    fixes: [
      [/rn/g, 'т'],
      [/0([А-Яа-я])/g, 'О$1'],
      [/([А-Яа-я])0/g, '$1о'],
      [/3([а-я])/g, 'з$1'],
    ],
  },
};

export function getLanguageProfile(lang) {
  return languageProfiles[lang] || languageProfiles.eng;
}

export function getSupportedLanguages() {
  return Object.keys(languageProfiles);
}

export function getLanguageName(lang) {
  return languageProfiles[lang]?.name || lang;
}

export function postCorrectByLanguage(text, lang) {
  if (!text) return text;
  let out = text;
  const profile = languageProfiles[lang];
  if (!profile) return out;

  for (const [pattern, replacement] of commonSubstitutions) {
    out = out.replace(pattern, replacement);
  }
  for (const [pattern, replacement] of profile.fixes) {
    out = out.replace(pattern, replacement);
  }

  out = out.replace(/\s{2,}/g, ' ').trim();
  return out;
}

// Russian bigram frequency pairs (most common)
const russianBigrams = ['ст', 'но', 'то', 'на', 'ен', 'не', 'ов', 'ко', 'ро', 'по', 'ра', 'ер', 'ни', 'пр', 'ор', 'ре', 'ал', 'ан', 'ос', 'го', 'ед', 'ел', 'ли', 'ле', 'ка', 'ат', 'от', 'де', 'ол', 'ет', 'ва', 'ве', 'ви', 'во', 'да', 'ди', 'до', 'ем', 'за', 'зн', 'ие', 'из', 'ик', 'ил', 'ин', 'ис', 'ит', 'ки', 'ла', 'ло', 'ль', 'ма', 'ме', 'ми', 'мо', 'ны', 'об', 'ог', 'од', 'ой', 'ом', 'он', 'ош', 'пе', 'пи', 'ру', 'ск', 'сл', 'со', 'та', 'те', 'ти', 'тр', 'ть', 'ул', 'ча', 'че', 'чи', 'ри', 'се', 'си', 'су', 'ту', 'уч', 'хо', 'це', 'ша', 'ще', 'эт', 'юч', 'яз'];

// Russian trigram frequency triples (most common)
const russianTrigrams = ['ста', 'ени', 'ост', 'ого', 'ани', 'ова', 'про', 'при', 'что', 'нов', 'ото', 'ния', 'ные', 'тор', 'ско', 'ком', 'ной', 'ели', 'тел', 'ать', 'ить', 'ест', 'ным', 'ных', 'ный', 'ски', 'ном', 'ова', 'ать', 'ени'];

// English bigram frequency pairs (most common)
const englishBigrams = ['th', 'he', 'in', 'en', 'nt', 'er', 'on', 're', 'an', 'ti', 'es', 'at', 'ed', 'nd', 'to', 'or', 'ea', 'is', 'ou', 'it', 'al', 'ar', 'st', 'ng', 'te', 'se', 'ha', 'as', 'le', 'of'];

function scoreBigrams(text, bigrams) {
  if (!text || text.length < 4) return 0;
  const lower = text.toLowerCase();
  let hits = 0;
  for (const bg of bigrams) {
    if (lower.includes(bg)) hits++;
  }
  return (hits / bigrams.length) * 30;
}

function scoreTrigrams(text, trigrams) {
  if (!text || text.length < 6) return 0;
  const lower = text.toLowerCase();
  let hits = 0;
  for (const tg of trigrams) {
    if (lower.includes(tg)) hits++;
  }
  return (hits / trigrams.length) * 20;
}

function scoreCyrillicWordQuality(text) {
  if (!text) return 0;
  const words = text.match(/[А-Яа-яЁё]{2,}/g) || [];
  if (!words.length) return 0;
  let goodWords = 0;
  for (const w of words) {
    const hasVowel = /[АЕИОУЫЭЮЯаеиоуыэюяЁё]/.test(w);
    const reasonable = w.length >= 2 && w.length <= 25;
    if (hasVowel && reasonable) goodWords++;
  }
  return (goodWords / words.length) * 20;
}

function hasMixedCyrillicLatinToken(text) {
  return /[А-Яа-яЁё][A-Za-z]|[A-Za-z][А-Яа-яЁё]/.test(text);
}

export function scoreTextByLanguage(text, lang) {
  if (!text) return 0;
  const profile = languageProfiles[lang];
  if (!profile) return 0;

  const words = text.toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return 0;

  let score = 0;

  // Check alphabet match
  const alphaMatches = text.match(profile.alphabet) || [];
  const alphaRatio = alphaMatches.length / Math.max(1, text.replace(/\s/g, '').length);
  score += alphaRatio * 40;

  // Check common words
  const commonHits = words.filter((w) => profile.commonWords.includes(w)).length;
  const commonRatio = commonHits / Math.max(1, words.length);
  score += commonRatio * 40;

  // Bigram scoring for Russian and English
  if (lang === 'rus') {
    score += scoreBigrams(text, russianBigrams);
    score += scoreTrigrams(text, russianTrigrams);
    score += scoreCyrillicWordQuality(text);
    if (hasMixedCyrillicLatinToken(text)) score -= 15;
  } else if (lang === 'eng') {
    score += scoreBigrams(text, englishBigrams);
    if (hasMixedCyrillicLatinToken(text)) score -= 15;
  }

  // Penalize very short garbage text
  const digits = (text.match(/[0-9]/g) || []).length;
  score += Math.min(5, digits);

  return Math.round(Math.max(0, score));
}

export function detectLanguage(text) {
  if (!text || text.length < 20) return 'eng';

  let bestLang = 'eng';
  let bestScore = 0;

  for (const lang of Object.keys(languageProfiles)) {
    const score = scoreTextByLanguage(text, lang);
    if (score > bestScore) {
      bestScore = score;
      bestLang = lang;
    }
  }

  return bestLang;
}
