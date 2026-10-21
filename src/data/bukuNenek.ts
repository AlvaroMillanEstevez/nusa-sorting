/**
 * Buku Nenek, Grandma's book: one entry per item kind of the catalogue, unlocked the first time the player makes its
 * triple. Each has a short, true fact (one or two sentences: what it is, where it comes from or what it is for) and,
 * where it applies, its region or origin, in English and Indonesian.
 *
 * FIRST DRAFT, PENDING REVIEW: every text here is waiting to be checked and corrected by a native speaker before it
 * ships (see docs/buku-nenek.md, made from this file with `node tools/docs/buku-nenek.mjs`). Facts only where the
 * writer was sure; nothing religious and no doubtful history.
 */

export interface Text {
  readonly en: string;
  readonly id: string;
}

export interface AlbumEntry {
  /** Where it comes from or is known for, when that is a place; omitted for things found everywhere. */
  readonly region?: Text;
  readonly fact: Text;
}

const ACROSS: Text = { en: 'Across Indonesia', id: 'Seluruh Indonesia' };

export const BUKU_NENEK: Readonly<Record<string, AlbumEntry>> = {
  // ---------------------------------------------------------------- dishes
  'nasi-goreng': {
    region: ACROSS,
    fact: {
      en: 'Rice fried with sweet soy sauce (kecap manis), shallots, garlic and chili, often topped with a fried egg. A favourite way to use up yesterday’s rice.',
      id: 'Nasi yang digoreng dengan kecap manis, bawang merah, bawang putih, dan cabai, sering diberi telur ceplok. Cara favorit memakai nasi sisa kemarin.',
    },
  },
  sate: {
    region: ACROSS,
    fact: {
      en: 'Small pieces of meat on skewers, grilled over charcoal and served with peanut or soy sauce. Madura and Padang each have their own famous style.',
      id: 'Potongan kecil daging yang ditusuk, dibakar di atas arang, lalu disajikan dengan bumbu kacang atau kecap. Madura dan Padang punya gaya sate sendiri yang terkenal.',
    },
  },
  bakso: {
    region: ACROSS,
    fact: {
      en: 'Meatballs, usually of beef, served in a clear broth with noodles. Sold from carts and stalls all over the country.',
      id: 'Bola daging, biasanya daging sapi, disajikan dalam kuah bening dengan mi. Dijual dari gerobak dan warung di seluruh negeri.',
    },
  },
  'mie-goreng': {
    region: ACROSS,
    fact: {
      en: 'Noodles stir-fried with sweet soy sauce, vegetables and egg, at warungs and street carts everywhere.',
      id: 'Mi yang digoreng dengan kecap manis, sayuran, dan telur, ada di warung dan gerobak di mana-mana.',
    },
  },
  rendang: {
    region: { en: 'West Sumatra (Minangkabau)', id: 'Sumatra Barat (Minangkabau)' },
    fact: {
      en: 'Beef slow-cooked for hours in coconut milk and spices until almost dry. It comes from the Minangkabau people of West Sumatra.',
      id: 'Daging sapi yang dimasak berjam-jam dalam santan dan bumbu hingga hampir kering. Berasal dari masyarakat Minangkabau di Sumatra Barat.',
    },
  },
  'gado-gado': {
    region: { en: 'Jakarta (Betawi)', id: 'Jakarta (Betawi)' },
    fact: {
      en: 'Boiled vegetables, tofu, tempeh and egg with a peanut sauce dressing, often topped with crackers.',
      id: 'Sayuran rebus, tahu, tempe, dan telur dengan saus kacang, sering diberi kerupuk di atasnya.',
    },
  },
  'ayam-goreng': {
    region: ACROSS,
    fact: {
      en: 'Chicken marinated in spices such as turmeric and garlic, then fried until crisp.',
      id: 'Ayam yang dibumbui rempah seperti kunyit dan bawang putih, lalu digoreng hingga renyah.',
    },
  },
  'ikan-bakar': {
    region: { en: 'Coastal towns across Indonesia', id: 'Kota pesisir di seluruh Indonesia' },
    fact: {
      en: 'Whole fish grilled over charcoal, often brushed with sweet soy sauce and served with sambal.',
      id: 'Ikan utuh yang dibakar di atas arang, sering diolesi kecap manis dan disajikan dengan sambal.',
    },
  },
  ketupat: {
    region: ACROSS,
    fact: {
      en: 'Rice cooked inside a pouch woven from young coconut leaves, which presses it into a firm cake. Often eaten with satay or opor ayam.',
      id: 'Nasi yang dimasak di dalam anyaman janur (daun kelapa muda) sehingga menjadi padat. Sering dimakan dengan sate atau opor ayam.',
    },
  },

  // ---------------------------------------------------------------- fried snacks
  tempe: {
    region: { en: 'Java', id: 'Jawa' },
    fact: {
      en: 'Soybeans fermented with a mould until they bind into a firm cake. It comes from Java and is rich in protein.',
      id: 'Kedelai yang difermentasi dengan jamur hingga menyatu menjadi padat. Berasal dari Jawa dan kaya protein.',
    },
  },
  'tahu-goreng': {
    region: ACROSS,
    fact: {
      en: 'Fried tofu: soft inside, golden outside. Often eaten with a small green chili on the side.',
      id: 'Tahu yang digoreng: lembut di dalam, keemasan di luar. Sering dimakan bersama cabai rawit.',
    },
  },
  'pisang-goreng': {
    region: ACROSS,
    fact: {
      en: 'Bananas dipped in batter and deep-fried; a favourite with afternoon tea or coffee.',
      id: 'Pisang yang dicelup adonan tepung lalu digoreng; teman minum teh atau kopi di sore hari.',
    },
  },
  'kerupuk-udang': {
    region: ACROSS,
    fact: {
      en: 'Crackers made from prawns and tapioca, dried and then fried until they puff up. Served with many meals for crunch.',
      id: 'Kerupuk dari udang dan tepung tapioka, dikeringkan lalu digoreng hingga mengembang. Pelengkap renyah untuk banyak hidangan.',
    },
  },

  // ---------------------------------------------------------------- sweets
  'martabak-manis': {
    fact: {
      en: 'A thick, fluffy pancake cooked in a round pan, filled with chocolate sprinkles, cheese or peanuts and folded in half. Also called terang bulan.',
      id: 'Kue tebal dan lembut yang dimasak di loyang bundar, diisi meses, keju, atau kacang, lalu dilipat dua. Juga disebut terang bulan.',
    },
  },
  klepon: {
    region: { en: 'Java', id: 'Jawa' },
    fact: {
      en: 'Balls of glutinous rice dough coloured green with pandan, filled with palm sugar that melts when you bite, and rolled in grated coconut.',
      id: 'Bola tepung ketan berwarna hijau dari daun pandan, berisi gula merah yang meleleh saat digigit, dan dibalur kelapa parut.',
    },
  },
  'onde-onde': {
    fact: {
      en: 'Fried balls of glutinous rice flour coated in sesame seeds, filled with sweet mung bean paste.',
      id: 'Bola tepung ketan goreng berbalut wijen, berisi pasta kacang hijau yang manis.',
    },
  },
  'dadar-gulung': {
    fact: {
      en: 'A thin pancake coloured green with pandan, rolled around grated coconut cooked in palm sugar.',
      id: 'Dadar tipis berwarna hijau dari daun pandan, digulung dengan isian kelapa parut dan gula merah.',
    },
  },

  // ---------------------------------------------------------------- drinks
  'es-teh-manis': {
    region: ACROSS,
    fact: {
      en: 'Sweet iced tea, the everyday drink of warungs all over Indonesia.',
      id: 'Teh manis dingin, minuman sehari-hari di warung di seluruh Indonesia.',
    },
  },
  'es-cendol': {
    region: { en: 'West Java', id: 'Jawa Barat' },
    fact: {
      en: 'Green jelly drops made from rice flour and pandan, served with coconut milk, palm sugar syrup and ice. In Central Java a similar drink is called dawet.',
      id: 'Cendol hijau dari tepung beras dan pandan, disajikan dengan santan, gula merah cair, dan es. Di Jawa Tengah minuman serupa disebut dawet.',
    },
  },
  'es-kelapa-muda': {
    region: ACROSS,
    fact: {
      en: 'The water and soft flesh of a young coconut, served cold, often straight from the shell.',
      id: 'Air dan daging kelapa muda yang disajikan dingin, sering langsung dari batoknya.',
    },
  },
  jamu: {
    region: { en: 'Java', id: 'Jawa' },
    fact: {
      en: 'A traditional herbal drink made from roots and spices such as turmeric, ginger and tamarind, often sold by women who carry the bottles in a basket on their back.',
      id: 'Minuman tradisional dari akar dan rempah seperti kunyit, jahe, dan asam, sering dijual keliling oleh penjual jamu gendong.',
    },
  },

  // ---------------------------------------------------------------- fruit
  durian: {
    fact: {
      en: 'Called the king of fruits: a spiky husk around creamy, strong-smelling flesh. Many hotels do not allow it inside.',
      id: 'Dijuluki raja buah: kulit berduri membungkus daging buah yang lembut dan beraroma kuat. Banyak hotel melarang durian dibawa masuk.',
    },
  },
  rambutan: {
    fact: {
      en: 'Its name comes from “rambut”, hair, for the soft spines on its red skin. Inside is sweet, juicy white flesh.',
      id: 'Namanya berasal dari kata “rambut”, karena kulit merahnya berambut lembut. Di dalamnya ada daging buah putih yang manis dan berair.',
    },
  },
  manggis: {
    fact: {
      en: 'A thick purple rind around sweet white segments. Count the petals on the bottom of the fruit: there are as many segments inside.',
      id: 'Kulit ungu yang tebal membungkus daging putih yang manis. Hitung kelopak di bagian bawah buahnya: sebanyak itulah juring di dalamnya.',
    },
  },
  salak: {
    region: { en: 'Yogyakarta and Bali, among others', id: 'Yogyakarta dan Bali, antara lain' },
    fact: {
      en: 'Called snake fruit for its scaly brown skin. Salak pondoh from Sleman, Yogyakarta, is known for its sweetness.',
      id: 'Disebut buah ular karena kulitnya cokelat bersisik. Salak pondoh dari Sleman, Yogyakarta, terkenal manis.',
    },
  },
  cabai: {
    fact: {
      en: 'Chili peppers first came from the Americas and reached Indonesia centuries ago. Today they are the heart of every sambal.',
      id: 'Cabai berasal dari benua Amerika dan tiba di Indonesia berabad-abad lalu. Kini cabai menjadi inti setiap sambal.',
    },
  },

  // ---------------------------------------------------------------- Budaya Jawa
  blangkon: {
    region: { en: 'Java', id: 'Jawa' },
    fact: {
      en: 'A headcloth worn by Javanese men, made of batik folded and sewn into a ready-to-wear shape. The Yogyakarta style has a bump at the back called mondolan.',
      id: 'Penutup kepala pria Jawa dari kain batik yang dilipat dan dijahit sehingga siap pakai. Gaya Yogyakarta punya tonjolan di belakang yang disebut mondolan.',
    },
  },
  batik: {
    region: { en: 'Java and other islands', id: 'Jawa dan pulau-pulau lain' },
    fact: {
      en: 'Cloth patterned by drawing with hot wax and then dyeing it: the waxed parts keep their colour. UNESCO lists Indonesian batik as Intangible Cultural Heritage (2009).',
      id: 'Kain yang diberi motif dengan malam (lilin) panas lalu dicelup warna: bagian yang terkena malam tetap berwarna asli. UNESCO mengakui batik Indonesia sebagai Warisan Budaya Takbenda (2009).',
    },
  },
  'wayang-kulit': {
    region: { en: 'Java and Bali', id: 'Jawa dan Bali' },
    fact: {
      en: 'Flat puppets of carved and painted leather. The puppeteer, the dalang, casts their shadows on a screen to gamelan music, often all night long.',
      id: 'Boneka pipih dari kulit yang diukir dan dicat. Sang dalang memainkan bayangannya di kelir dengan iringan gamelan, sering semalam suntuk.',
    },
  },
  kendang: {
    region: { en: 'Java, Bali and Sunda', id: 'Jawa, Bali, dan Sunda' },
    fact: {
      en: 'A two-headed drum played with the hands. In a gamelan, the drummer sets and changes the tempo.',
      id: 'Gendang berkepala dua yang dipukul dengan tangan. Dalam gamelan, pemain kendang mengatur dan mengubah tempo.',
    },
  },
  gong: {
    region: { en: 'Java and Bali', id: 'Jawa dan Bali' },
    fact: {
      en: 'The largest gong of a gamelan, the gong ageng, marks the end of each cycle of the music.',
      id: 'Gong terbesar dalam gamelan, gong ageng, menandai akhir setiap putaran lagu.',
    },
  },
  caping: {
    region: ACROSS,
    fact: {
      en: 'A wide conical hat woven from bamboo, worn by farmers against the sun and the rain.',
      id: 'Topi kerucut lebar dari anyaman bambu, dipakai petani untuk melindungi diri dari panas dan hujan.',
    },
  },
  kipas: {
    fact: {
      en: 'A folding hand fan, often of bamboo and cloth or paper. Fans are part of several traditional dances.',
      id: 'Kipas lipat yang sering terbuat dari bambu dan kain atau kertas. Kipas dipakai dalam beberapa tarian tradisional.',
    },
  },

  // ---------------------------------------------------------------- 17 Agustus
  bendera: {
    fact: {
      en: 'The Sang Saka Merah Putih: red above, white below. Indonesia’s flag was first raised at the proclamation of independence on 17 August 1945.',
      id: 'Sang Saka Merah Putih: merah di atas, putih di bawah. Bendera Indonesia pertama kali dikibarkan saat proklamasi kemerdekaan, 17 Agustus 1945.',
    },
  },
  karung: {
    fact: {
      en: 'In the sack race, balap karung, children and grown-ups hop to the finish inside a sack: a classic of Independence Day.',
      id: 'Dalam balap karung, anak-anak dan orang dewasa melompat ke garis akhir di dalam karung: lomba khas Hari Kemerdekaan.',
    },
  },
  kelereng: {
    fact: {
      en: 'Runners carry a marble on a spoon held between their teeth, and must start again if it falls.',
      id: 'Peserta membawa kelereng di atas sendok yang digigit, dan harus mengulang jika kelerengnya jatuh.',
    },
  },
  'panjat-pinang': {
    fact: {
      en: 'Teams climb a tall pole smeared with grease, standing on each other’s shoulders, to reach the prizes hanging at the top.',
      id: 'Regu memanjat batang pinang tinggi yang dilumuri oli, saling berdiri di pundak, untuk meraih hadiah yang tergantung di puncak.',
    },
  },
  peci: {
    fact: {
      en: 'A black velvet cap worn by many Indonesian men on formal occasions. Sukarno, the first president, made it a symbol of the nation.',
      id: 'Topi beludru hitam yang dipakai banyak pria Indonesia pada acara resmi. Sukarno, presiden pertama, menjadikannya lambang bangsa.',
    },
  },
  terompet: {
    fact: {
      en: 'A paper trumpet, sold by street vendors for celebrations and on New Year’s Eve.',
      id: 'Terompet kertas yang dijual pedagang kaki lima saat perayaan dan malam Tahun Baru.',
    },
  },

  // ---------------------------------------------------------------- Pasar Malam
  lampion: {
    fact: {
      en: 'Paper lanterns that light up night markets and festivals. Red ones hang everywhere at Imlek, the Chinese New Year.',
      id: 'Lampion kertas yang menerangi pasar malam dan perayaan. Lampion merah tergantung di mana-mana saat Imlek.',
    },
  },
  'arum-manis': {
    fact: {
      en: 'Sugar spun into fine threads by a spinning machine. Its name means “fragrant and sweet”.',
      id: 'Gula yang dipintal menjadi benang halus dengan mesin yang berputar. Namanya berarti “harum dan manis”.',
    },
  },
  balon: {
    fact: {
      en: 'Balloons in bright colours, the favourite thing for children to take home from the night market.',
      id: 'Balon warna-warni, oleh-oleh favorit anak-anak dari pasar malam.',
    },
  },
  topeng: {
    fact: {
      en: 'Toy masks are sold at fairs. Carved wooden masks are worn in the traditional mask dances of Java and Bali.',
      id: 'Topeng mainan dijual di pasar malam. Topeng kayu berukir dipakai dalam tari topeng tradisional Jawa dan Bali.',
    },
  },
  'kembang-api': {
    fact: {
      en: 'Fireworks light up New Year’s Eve and other celebrations. Their Indonesian name means “flowers of fire”.',
      id: 'Kembang api menerangi malam Tahun Baru dan perayaan lainnya. Namanya berarti “bunga dari api”.',
    },
  },
  bianglala: {
    fact: {
      en: 'The Ferris wheel of the night market. “Bianglala” is also an old word for a rainbow.',
      id: 'Kincir ria di pasar malam. “Bianglala” juga kata lama untuk pelangi.',
    },
  },

  // ---------------------------------------------------------------- Laut Nusantara
  pinisi: {
    region: { en: 'South Sulawesi', id: 'Sulawesi Selatan' },
    fact: {
      en: 'A two-masted wooden sailing ship built by the shipwrights of South Sulawesi. UNESCO lists the art of building it as Intangible Cultural Heritage (2017).',
      id: 'Kapal layar kayu bertiang dua buatan para pembuat kapal Sulawesi Selatan. UNESCO mengakui seni pembuatannya sebagai Warisan Budaya Takbenda (2017).',
    },
  },
  kerang: {
    fact: {
      en: 'Seashells wash up on Indonesia’s countless beaches and are made into necklaces, lamps and decorations.',
      id: 'Kerang terdampar di pantai-pantai Indonesia yang tak terhitung jumlahnya, lalu dijadikan kalung, lampu, dan hiasan.',
    },
  },
  'bintang-laut': {
    fact: {
      en: 'Starfish live on the sea floor and can grow back an arm they have lost.',
      id: 'Bintang laut hidup di dasar laut dan bisa menumbuhkan kembali lengannya yang putus.',
    },
  },
  jaring: {
    fact: {
      en: 'Fishermen mend their nets by hand on the beach between trips out to sea.',
      id: 'Nelayan memperbaiki jaring dengan tangan di pantai, di sela-sela waktu melaut.',
    },
  },
  layangan: {
    fact: {
      en: 'Kites fill the sky on windy afternoons over beaches and fields. Bali holds a famous kite festival with giant kites.',
      id: 'Layangan memenuhi langit pada sore berangin di atas pantai dan lapangan. Bali punya festival layang-layang terkenal dengan layangan raksasa.',
    },
  },
  kelapa: {
    fact: {
      en: 'The coconut palm gives food, drink, oil, leaves for weaving and wood for building: nearly every part of it is used.',
      id: 'Pohon kelapa memberi makanan, minuman, minyak, daun untuk anyaman, dan kayu untuk bangunan: hampir semua bagiannya berguna.',
    },
  },

  // ---------------------------------------------------------------- Olahraga
  kok: {
    fact: {
      en: 'A badminton shuttlecock is made of 16 feathers fixed in a cork base.',
      id: 'Kok bulu tangkis dibuat dari 16 helai bulu yang ditancapkan pada gabus.',
    },
  },
  raket: {
    fact: {
      en: 'Badminton is one of Indonesia’s best-loved sports. The country’s first Olympic gold medals, in 1992, were both won in badminton.',
      id: 'Bulu tangkis adalah salah satu olahraga paling digemari di Indonesia. Medali emas Olimpiade pertama Indonesia, pada 1992, keduanya dari bulu tangkis.',
    },
  },
  'sepak-takraw': {
    fact: {
      en: 'A ball of woven rattan, kicked over a net without using the hands. The game is played all over Southeast Asia.',
      id: 'Bola dari anyaman rotan yang ditendang melewati net tanpa memakai tangan. Permainan ini dimainkan di seluruh Asia Tenggara.',
    },
  },
  sepatu: {
    fact: {
      en: 'On Car Free Day, on Sunday mornings, the main streets of big cities fill with runners, walkers and cyclists.',
      id: 'Saat Hari Bebas Kendaraan Bermotor di Minggu pagi, jalan-jalan utama kota besar dipenuhi pelari, pejalan kaki, dan pesepeda.',
    },
  },
  piala: {
    fact: {
      en: 'A trophy for the champion. Indonesia has won the Thomas Cup, the men’s world badminton team championship, more times than any other country.',
      id: 'Piala untuk sang juara. Indonesia telah memenangkan Piala Thomas, kejuaraan beregu bulu tangkis putra dunia, lebih sering daripada negara lain.',
    },
  },
  peluit: {
    fact: {
      en: 'The referee’s whistle starts the game, stops it for fouls and ends it.',
      id: 'Peluit wasit memulai pertandingan, menghentikannya saat ada pelanggaran, dan mengakhirinya.',
    },
  },

  // ---------------------------------------------------------------- Permainan Tradisional
  gasing: {
    fact: {
      en: 'A wooden spinning top, wound with string and thrown to make it spin. Players try to knock each other’s tops out of the ring.',
      id: 'Gasing kayu dililit tali lalu dilempar agar berputar. Pemain berusaha menjatuhkan gasing lawan keluar dari lingkaran.',
    },
  },
  congklak: {
    fact: {
      en: 'A board with two rows of small holes and a store at each end, played with shells or seeds sown around it. In Java it is also called dakon.',
      id: 'Papan dengan dua baris lubang kecil dan satu lumbung di tiap ujung, dimainkan dengan kerang atau biji yang disebar berkeliling. Di Jawa juga disebut dakon.',
    },
  },
  egrang: {
    fact: {
      en: 'Bamboo stilts. Walking and racing on them takes balance and practice.',
      id: 'Tongkat bambu untuk berjalan tinggi. Berjalan dan berlomba dengannya butuh keseimbangan dan latihan.',
    },
  },
  yoyo: {
    fact: {
      en: 'Two discs joined by an axle, with a string wound around it: thrown down, it spins and climbs back up to the hand.',
      id: 'Dua cakram yang disambung poros dengan tali yang dililitkan: dilempar ke bawah, ia berputar lalu naik kembali ke tangan.',
    },
  },
  bekel: {
    fact: {
      en: 'Players bounce a small rubber ball and pick up metal jacks, the biji bekel, before catching it again.',
      id: 'Pemain memantulkan bola karet kecil dan memungut biji bekel dari logam sebelum menangkap bolanya lagi.',
    },
  },
  'lompat-tali': {
    fact: {
      en: 'A rope made by linking rubber bands. Two players hold it while the others jump over it, higher each round.',
      id: 'Tali dari karet gelang yang disambung-sambung. Dua pemain memegangnya, yang lain melompatinya, makin tinggi setiap putaran.',
    },
  },

  // ---------------------------------------------------------------- Rempah Maluku
  cengkeh: {
    region: { en: 'North Maluku', id: 'Maluku Utara' },
    fact: {
      en: 'Cloves are the dried flower buds of a tree native to the islands of North Maluku. For centuries, traders sailed to the Spice Islands for them.',
      id: 'Cengkeh adalah kuncup bunga yang dikeringkan dari pohon asli kepulauan Maluku Utara. Selama berabad-abad, pedagang berlayar ke Kepulauan Rempah untuk mencarinya.',
    },
  },
  pala: {
    region: { en: 'Banda Islands, Maluku', id: 'Kepulauan Banda, Maluku' },
    fact: {
      en: 'Nutmeg grows on the Banda Islands. Its seed gives nutmeg, and the red lace around the seed gives mace.',
      id: 'Pala tumbuh di Kepulauan Banda. Bijinya menjadi pala, dan selaput merah di sekeliling bijinya menjadi fuli.',
    },
  },
  'kayu-manis': {
    region: { en: 'Kerinci, Sumatra', id: 'Kerinci, Sumatra' },
    fact: {
      en: 'Cinnamon is the dried inner bark of a tree, which curls into sticks as it dries. Indonesia is one of the world’s largest growers.',
      id: 'Kayu manis adalah kulit bagian dalam pohon yang dikeringkan dan menggulung menjadi batang. Indonesia termasuk penghasil terbesar di dunia.',
    },
  },
  lada: {
    region: { en: 'Lampung and Bangka Belitung', id: 'Lampung dan Bangka Belitung' },
    fact: {
      en: 'Peppercorns dried in the sun become black pepper; with the skin removed, they become white pepper.',
      id: 'Biji lada yang dijemur menjadi lada hitam; jika kulitnya dikupas, menjadi lada putih.',
    },
  },
  cobek: {
    region: ACROSS,
    fact: {
      en: 'A shallow stone mortar with its pestle, the ulekan, for grinding chilies and spices into sambal.',
      id: 'Wadah batu yang dangkal dengan ulekannya, untuk menghaluskan cabai dan bumbu menjadi sambal.',
    },
  },
  'karung-rempah': {
    region: { en: 'Maluku', id: 'Maluku' },
    fact: {
      en: 'Spices from Maluku travelled in sacks on ships to markets across Asia and Europe.',
      id: 'Rempah dari Maluku diangkut dalam karung dengan kapal ke pasar-pasar di Asia dan Eropa.',
    },
  },

  // ---------------------------------------------------------------- Sawah
  padi: {
    fact: {
      en: 'Rice grows in flooded fields, and its ripe ears turn golden. In Bali, the subak system shares water between the terraces; UNESCO listed it as World Heritage in 2012.',
      id: 'Padi tumbuh di sawah yang digenangi air, dan bulirnya menguning saat matang. Di Bali, sistem subak membagi air antarteras; UNESCO menetapkannya sebagai Warisan Dunia pada 2012.',
    },
  },
  cangkul: {
    fact: {
      en: 'A hoe with a wide blade: the farmer’s basic tool for turning the soil.',
      id: 'Alat berbilah lebar, perkakas dasar petani untuk menggemburkan tanah.',
    },
  },
  'orang-orangan': {
    fact: {
      en: 'A scarecrow dressed in old clothes stands in the field to keep birds away from the ripening rice.',
      id: 'Orang-orangan berbaju bekas berdiri di sawah untuk mengusir burung dari padi yang mulai menguning.',
    },
  },
  kerbau: {
    fact: {
      en: 'Water buffaloes pull ploughs through muddy rice fields, and love to wallow in water to keep cool.',
      id: 'Kerbau menarik bajak di sawah berlumpur, dan senang berkubang di air agar tetap sejuk.',
    },
  },
  bakul: {
    fact: {
      en: 'A round basket woven from bamboo, used to carry and serve rice.',
      id: 'Wadah bundar dari anyaman bambu untuk membawa dan menyajikan nasi.',
    },
  },
  gubuk: {
    fact: {
      en: 'A small hut on stilts among the fields, where farmers rest in the shade and keep watch over the crop.',
      id: 'Pondok kecil berkaki di tengah sawah, tempat petani berteduh dan menjaga tanamannya.',
    },
  },

  // ---------------------------------------------------------------- Fauna Nusantara
  komodo: {
    region: { en: 'East Nusa Tenggara', id: 'Nusa Tenggara Timur' },
    fact: {
      en: 'The largest living lizard in the world, found only on Komodo, Rinca and a few nearby islands. Adults can grow to about three metres.',
      id: 'Kadal terbesar di dunia, hanya ada di Pulau Komodo, Rinca, dan beberapa pulau di sekitarnya. Yang dewasa bisa sepanjang sekitar tiga meter.',
    },
  },
  orangutan: {
    region: { en: 'Sumatra and Kalimantan', id: 'Sumatra dan Kalimantan' },
    fact: {
      en: 'Great apes that live only on Sumatra and Borneo. Their name means “person of the forest”.',
      id: 'Kera besar yang hanya hidup di Sumatra dan Kalimantan. Namanya berarti “orang hutan”.',
    },
  },
  rangkong: {
    region: { en: 'Kalimantan, Sumatra and Sulawesi', id: 'Kalimantan, Sumatra, dan Sulawesi' },
    fact: {
      en: 'Hornbills wear a large casque on top of their bill. When nesting, the female seals herself into a tree hollow and the male feeds her through a slit.',
      id: 'Rangkong punya tanduk (balung) besar di atas paruhnya. Saat bersarang, betina mengurung diri di lubang pohon dan jantan memberinya makan lewat celah kecil.',
    },
  },
  penyu: {
    fact: {
      en: 'Sea turtles come back to the beaches where they hatched to lay their eggs. Six of the world’s seven species live in Indonesian waters.',
      id: 'Penyu kembali ke pantai tempat ia menetas untuk bertelur. Enam dari tujuh jenis penyu di dunia hidup di perairan Indonesia.',
    },
  },
  cendrawasih: {
    region: { en: 'Papua', id: 'Papua' },
    fact: {
      en: 'Birds of paradise live in Papua. The males show off long, colourful plumes and dance to win a mate.',
      id: 'Cendrawasih hidup di Papua. Burung jantan memamerkan bulu panjang yang berwarna-warni dan menari untuk menarik betina.',
    },
  },
  tarsius: {
    region: { en: 'Sulawesi', id: 'Sulawesi' },
    fact: {
      en: 'One of the smallest primates, with enormous eyes: each one is about as big as its brain. It comes out at night.',
      id: 'Salah satu primata terkecil, dengan mata sangat besar: tiap matanya kira-kira sebesar otaknya. Ia aktif di malam hari.',
    },
  },
};
