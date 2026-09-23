// Dialogues & missions. Argou de Dristor. All characters are fictional.
// Each NPC script is an async function(ctx). ctx: say(who,text), me(text), choose([..]) -> index,
// money(delta) / ctx.state.money, give(item), has(item), take(item), mission (id), setMission(id), phone(from,text), slots(), sfx(name)

export const MISSIONS = {
  geta:     { title: 'Vorbește cu Tanti Geta (stă la geam, ca de obicei)', target: 'geta' },
  farmacie: { title: 'Ia-i lui Tanti Geta Algocalmin de la farmacie', target: 'farmacista' },
  geta2:    { title: 'Du-i Algocalminul lui Tanti Geta', target: 'geta' },
  shaorma:  { title: 'Ți-e foame de mori. Mergi la shaorma', target: 'nelu' },
  bani:     { title: 'Fă rost de 30 de lei: păcănele sau amanet', target: ['gigi', 'costel'] },
  shaorma2: { title: 'Înapoi la Nelu cu banii', target: 'nelu' },
  moodeng:  { title: 'Moo Deng a evadat! E în Parcul IOR, lângă lac', target: 'moodeng' },
  metrou:   { title: 'Du-o pe Moo Deng la metrou Dristor. Fugi de maidanezi!', target: 'metrou' },
  gata:     { title: 'Misiune completă! Explorează liber Dristorul', target: null },
};

export const NPC_DEFS = {
  geta: {
    name: 'Tanti Geta', look: { shirt: '#6b3fa0', pants: '#333', scarf: '#c0392b', skin: '#e8c3a4', female: true }, window: true,
    async talk(c) {
      if (c.mission === 'geta') {
        await c.say('Tanti Geta', 'Câmpi! Iar vii la 5 dimineața, mă? Te-am văzut cum te-ai împiedicat de tomberon. Mă-ta știe?');
        const r = await c.choose(['Săru-mâna, tanti Geta!', 'Nu eram eu, era frate-miu geamăn.', 'Ce faci la geam la ora asta?']);
        if (r === 1) await c.say('Tanti Geta', 'Ce frate, mă? Tu n-ai frate. Mă crezi proastă? Am 40 de ani de geam în Dristor, eu văd tot.');
        if (r === 2) await c.say('Tanti Geta', 'Ce să fac, mă? Supraveghez. Dacă nu stau eu la geam, cine? Poliția? Hă-hă.');
        await c.say('Tanti Geta', 'Uite ce e, mă doare capul de la manelele alea din Logan-ul de jos. Du-te și ia-mi un Algocalmin de la farmacie. Și nu-mi lua generic, că ăla nu merge.');
        await c.me('Bine, tanti. Da\' dați-mi bani?');
        await c.say('Tanti Geta', 'Bani? Ce bani, mă? Ți-am dat 5 lei în 2014 când ai terminat a patra. Ți-i țin minte. Hai, fugi!');
        c.setMission('farmacie');
      } else if (c.mission === 'geta2' && c.has('algocalmin')) {
        c.take('algocalmin');
        await c.say('Tanti Geta', 'Ahaa, bravo, mă! Vezi că poți să fii și tu om? Uite, ia 10 lei. Nu-i bea pe toți.');
        c.money(10);
        await c.me('Mersi, tanti. Mor de foame, zic să iau o shaorma.');
        await c.say('Tanti Geta', 'Du-te la Nelu, că ăla pune și cartofi în ea. Da\' spală-te pe mâini după, că nu știi ce-a pipăit.');
        c.setMission('shaorma');
      } else if (c.mission === 'moodeng' || c.mission === 'metrou') {
        await c.say('Tanti Geta', 'Mă, ce e porcu\' ăla negru după tine?! Să nu-l bagi în bloc, că-l spun la administrator!');
        await c.me('E hipopotam pitic, tanti. E vedetă pe TikTok.');
        await c.say('Tanti Geta', 'Vedetă... Și tu te credeai vedetă în clasa a opta. Hai, du-l de-aici.');
      } else {
        await c.say('Tanti Geta', pick(['Ce stai, mă, ca prostu\' în mijlocul drumului? Du-te la treabă!', 'Iar ai slăbit. Nu mănânci nimic, numai prostii.', 'Vecina de la 3 iar a luat credit. Să nu-i zici că ți-am zis.', 'Pe vremea mea, băieții de vârsta ta aveau copii și rate la bancă.']));
      }
    },
  },
  farmacista: {
    name: 'Doamna farmacistă', look: { shirt: '#ffffff', pants: '#ffffff', hair: '#8a5a2b', female: true, glasses: true },
    async talk(c) {
      if (c.mission === 'farmacie') {
        await c.say('Farmacista', 'Bună ziua. Vă ascult. Și vă rog, fără rețete scrise pe șervețel.');
        const r = await c.choose(['Un Algocalmin, vă rog. Pentru o bătrânică.', 'Ceva tare, doamnă. Pentru mahmureală.', 'Aveți ceva pentru prostie?']);
        if (r === 1) { await c.say('Farmacista', 'Tare? Domnule, e farmacie, nu bar. Vă dau Algocalmin și un sfat: apă.'); }
        if (r === 2) { await c.say('Farmacista', 'Dacă aveam, îl luam eu prima, că stau toată ziua cu voi. Algocalmin vă dau.'); }
        await c.say('Farmacista', 'Face 9 lei. Card sau cash?');
        if (c.state.money < 9) { await c.say('Farmacista', 'N-aveți 9 lei? Doamne... Luați-l, că mi-e milă de bătrânica aia. Nu mai veniți pe aici.'); }
        else { c.money(-9); await c.me('Cash, doamnă. Numai monede de 50 de bani, sper că nu vă supărați.'); await c.say('Farmacista', 'Mă supăr. Dar le iau.'); }
        c.give('algocalmin', '💊 Algocalmin');
        c.setMission('geta2');
      } else {
        await c.say('Farmacista', pick(['Vitamina C avem la reducere. Pentru dumneavoastră, și ceva pentru ochi. Arătați obosit.', 'Nu, nu avem Xanax fără rețetă. Nici pentru prieteni.', 'Tensiunea v-o măsor gratuit. Numai să nu vă speriați de rezultat.']));
      }
    },
  },
  nelu: {
    name: 'Nelu Shaormaru', look: { shirt: '#f4f4f4', pants: '#222', hair: '#111', beard: true, cap: '#d7263d' },
    async talk(c) {
      if (c.mission === 'shaorma') {
        await c.say('Nelu', 'Ce vrei, bă, frumosule? Zi repede că am 40 de comenzi pe aplicație și un livrator care a adormit pe trotinetă.');
        const r = await c.choose(['Mare, cu de toate, dublă carne!', 'Una mică, fără ceapă, fără usturoi, fără varză...', 'Ai ceva vegan?']);
        if (r === 1) await c.say('Nelu', 'Fără ceapă, fără usturoi... Atunci ce vrei, bă, o lipie goală? Du-te la patiserie. Glumesc, ți-o fac cu de toate.');
        if (r === 2) await c.say('Nelu', 'Vegan? Cartofii. Și ceapa. Restu\' e porc, fratele meu, că suntem în Dristor, nu în Berlin.');
        await c.say('Nelu', 'Mare cu de toate, 30 de lei. Dă banii.');
        if (c.state.money >= 30) { c.money(-30); c.give('shaorma', '🌯 Shaorma cu de toate'); c.setMission('moodeng'); await c.say('Nelu', 'Poftă bună, coaie. Și nu mai veni beat pe la mine, că data trecută ai dansat cu frigiderul de sucuri.'); c.phoneLater(); }
        else {
          await c.me(`Am doar ${c.state.money} lei... Îmi dai pe datorie?`);
          await c.say('Nelu', 'Pe datorie?! Futu-i, bă, eu sunt Crucea Roșie? Du-te fă-ți banii. Joacă la păcănele la colț, sau amanetează-ți ceasul lu\' bunicu\'. Ai 30, ai shaorma. N-ai, n-ai.');
          c.setMission('bani');
        }
      } else if (c.mission === 'shaorma2' || (c.mission === 'bani' && c.state.money >= 30)) {
        if (c.state.money >= 30) {
          await c.say('Nelu', 'Aaa, s-a întors milionaru\'. Hai, dă banii.'); c.money(-30);
          c.give('shaorma', '🌯 Shaorma cu de toate');
          await c.say('Nelu', 'Na, cu de toate, cu cartofi, cu sos de usturoi dublu. Nu pupa pe nimeni azi.');
          c.setMission('moodeng'); c.phoneLater();
        } else await c.say('Nelu', 'Tot 30 de lei costă, bă. Nu s-a ieftinit de când ai plecat.');
      } else {
        await c.say('Nelu', pick(['Ce mai e, bă? Vrei și suc? E cald, frigideru\' s-a stricat de la tine.', 'Shaorma de aici a vindecat mai multe mahmureli decât farmacia de vizavi.', 'Am un văr care a deschis shaormerie în Germania. Acu\' e bogat. Eu am tot Dristoru\'.']));
      }
    },
  },
  gigi: {
    name: 'Gigi Trening', look: { shirt: '#1b1b1b', pants: '#1b1b1b', hair: '#111', cap: '#111', shoes: '#fff' },
    async talk(c) {
      if (c.mission === 'bani' || c.mission === 'shaorma2') {
        await c.say('Gigi', 'Frate, frate, bagă și tu! Aparatu\' e cald, pe cuvântu\' meu. A mâncat 2000 de lei de la ăla cu BMW, trebuie să dea acu\'.');
        const r = await c.choose(['Hai, bag 5 lei. (joacă la păcănele)', 'Nu, bă, că pierd tot.', 'Tu cât ai câștigat azi?']);
        if (r === 2) { await c.say('Gigi', 'Eu? Azi? ... Mâine câștig. Simt. Hai, bagă!'); }
        if (r === 1) { await c.say('Gigi', 'Fricosu\'. Bine, du-te la amanet la Costel, să-ți fure ăla banii mai elegant.'); return; }
        await c.slots();
        if (c.state.money >= 30) { await c.say('Gigi', 'VEZI, BĂ?! Ți-am zis! Dă-mi și mie 5 lei, că eu ți-am dat pontu\'.'); const g = await c.choose(['Na, 5 lei, Gigi.', 'Nu-ți dau nimic.']); if (g === 0) { c.money(-5); await c.say('Gigi', 'Ești frate cu mine. Hai că-i bag înapoi.'); } else await c.say('Gigi', 'Zgârcit ca Tanti Geta. Du-te, du-te.');
          if (c.state.money >= 30) c.setMission('shaorma2'); }
        else await c.say('Gigi', 'Nu-i nimic, frate, și eu am pierdut casa așa. Du-te la amanet, la Costel.');
      } else {
        await c.say('Gigi', pick(['Ai cumva 10 lei? Îi dau înapoi când dă aparatu\'.', 'Știi care-i diferența dintre mine și un milionar? Un rând de trei de 7.', 'Frate, ți-am zis de afacerea cu adidași? Nu? Bine.']));
        const r = await c.choose(['Joacă la păcănele (5 lei)', 'Pa, Gigi.']);
        if (r === 0) await c.slots();
      }
    },
  },
  costel: {
    name: 'Costel Amanet', look: { shirt: '#ffffff', pants: '#222', hair: '#222', bald: true, beard: false, chain: true },
    async talk(c) {
      if ((c.mission === 'bani' || c.mission === 'shaorma2') && !c.state.flags.pawned) {
        await c.say('Costel', 'Bună ziua, șefu\'. Ce-mi aduceți? Aur, telefoane, ceasuri, rinichi? Glumesc cu rinichii. Parțial.');
        const r = await c.choose(['Ceasul lu\' bunicu\'.', 'Telefonul meu.', 'PlayStation-ul lu\' frate-miu (nu știe).']);
        const off = [40, 25, 55][r];
        const what = ['ceasul', 'telefonul', 'PlayStation-ul'][r];
        if (r === 0) await c.say('Costel', 'Ceas rusesc, Pobeda. Frumos. Bunicu\' l-a furat de la un rus sau invers?');
        if (r === 1) await c.say('Costel', 'Telefon cu ecranul spart în formă de păianjen. Clasic Dristor. Îți dau puțin, că n-are nici încărcător.');
        if (r === 2) await c.say('Costel', 'Aoleu, frate-tu o să te caute cu toată scara. Eu nu te-am văzut. Îți dau bine.');
        await c.say('Costel', `Îți dau ${off} de lei pe ${what}. Ultimu\' preț, că am și eu copii la privat.`);
        const k = await c.choose([`Bate palma, ${off} lei.`, 'Doar atât? Hoțule!']);
        if (k === 1) await c.say('Costel', 'Hoț e ăla de la bancă, mă. Eu sunt antreprenor. Tot ${off} îți dau, că mi-e milă.'.replace('${off}', off));
        c.money(off); c.state.flags.pawned = what;
        await c.say('Costel', 'Poți să-l răscumperi în 30 de zile cu dobândă de 67%. Glumesc. 60.');
        if (c.state.money >= 30) c.setMission('shaorma2');
      } else {
        await c.say('Costel', pick(['Nu mai am ce să-ți cumpăr, șefu\'. Poate dacă mai ai un frate cu PlayStation.', 'Aur de 14 carate, frate. Pentru tine, 18.', 'Toată lumea vine la Costel până la urmă. Și ăia de la bancă.']));
      }
    },
  },
  moodeng: {
    name: 'Moo Deng', hippo: true,
    async talk(c) {
      if (c.mission === 'moodeng') {
        c.sfx('bite');
        await c.say('Moo Deng', '*MUȘCĂ* *MUȘCĂ* *face splash cu apa din lac*');
        await c.me('Au, fă! Nu mă mușca! Uite, am o shaorma. Cu de toate.');
        if (c.has('shaorma')) {
          c.take('shaorma');
          await c.say('Moo Deng', '*mănâncă shaorma cu tot cu staniol* *te privește cu ochi de îndrăgostită*');
          await c.me('Aia era shaorma mea... Bine, hai cu mine, fată. Te duc la metrou, că de acolo te ia Zoo-ul.');
          c.follow();
          c.setMission('metrou');
        } else await c.me('Ce să-i dau să mănânce... Aveam o shaorma. Hmm.');
      } else await c.say('Moo Deng', pick(['*se uită fix la tine* *mușcă aerul*', '*face zoomies în jurul tău*', '*sforăie dramatic*']));
    },
  },
  taxi: {
    name: 'Taximetristu\'', look: { shirt: '#f2c200', pants: '#333', hair: '#555', beard: true },
    async talk(c) {
      await c.say('Taximetristu\'', pick(['Unde mergem, șefu\'? Până la Titan 80 de lei, că e trafic. Cum adică e la un kilometru? Păi și benzina?', 'Aparatu\' e stricat, facem la negru. Îți fac preț de prieten: dublu.', 'Am dus-o pe una de la Dristor la Otopeni cu 400 de lei. Plângea de fericire. Sau de altceva.']));
    },
  },
  bormasina: {
    name: 'Vecinu\' cu bormașina', look: { shirt: '#5a7d3a', pants: '#6b6b6b', hair: '#777', beard: true },
    async talk(c) {
      c.sfx('drill');
      await c.say('Vecinu\'', pick(['E duminică? Și ce dacă, bă? Eu îmi renovez baia de 3 ani. Anul ăsta termin. Poate.', 'Am dat de țeava lu\' ăla de la 4. Acu\' are cascadă. Premium.', 'Zi-i lu\' Tanti Geta că n-am auzit-o când a bătut în calorifer. Am căști.']));
    },
  },
  manelist: {
    name: 'Florinel BMW', look: { shirt: '#ffffff', pants: '#1a1a1a', hair: '#111', chain: true, glasses: true },
    async talk(c) {
      c.sfx('manea');
      await c.say('Florinel', pick(['Ce te uiți, bă? Vrei o dedicație? Pentru Câmpi, cel mai tare din Dristor, să trăiești, frate, că ești sufletu\' meu!', 'Mașina e în leasing, da\' respectu\' e cash.', 'Futu-i, am parcat pe trecere. Da\' e trecerea mea, stau aici de mic.']));
    },
  },
  pensionar: {
    name: 'Nea Mitică', look: { shirt: '#8a7a5a', pants: '#4a4a4a', hair: '#dddddd', cap: '#555', glasses: true },
    async talk(c) {
      await c.say('Nea Mitică', pick(['Pe vremea lui Ceaușescu blocurile astea erau noi, bă. Acu\' uită-te la ele. Ca tine după o noapte.', 'Hai la o tablă. Pun 5 lei. Nu, nu joc cu tine, că ești cu telefonu\' ăla, trișezi.', 'Am lucrat 40 de ani la IOR. Mi-au dat pensie cât o shaorma pe zi. Fără cartofi.']));
    },
  },
  nonstop: {
    name: 'Mădălina de la Non-Stop', look: { shirt: '#f28c28', pants: '#222', hair: '#d4a24c', female: true },
    async talk(c) {
      await c.say('Mădălina', pick(['Țigări pe datorie nu mai dăm, Câmpi. Ai deja 67 de lei în caiet.', 'Berea rece e în spate, da\' nu e rece, că frigideru\' e decorativ.', 'Iar ai venit doar să stai la aer condiționat? Ia măcar o gumă.']));
    },
  },
  politist: {
    name: 'Agentu\' Pătrașcu', look: { shirt: '#1d2f5a', pants: '#1d2f5a', hair: '#222', cap: '#1d2f5a' },
    async talk(c) {
      if (c.state.follower) await c.say('Agentu\' Pătrașcu', 'Stai așa! Animalu\' ăsta are botniță? Are carnet de sănătate? ... Bine, mergi. Da\' să nu facă pe trotuar, că te amendez pe tine.');
      else await c.say('Agentu\' Pătrașcu', pick(['Actele la control. ... Glumesc, n-am chef de hârtii. Circulă.', 'Ai văzut cumva un BMW negru cu manele? Nu? Nici eu. Nu vreau să-l văd.', 'Poliția Locală, sector 3. Suntem aici să vă protejăm. De obicei de la 9 la 5.']));
    },
  },
};

export const PED_LINES = [
  'Ai un foc?', 'Frate, ai 2 lei de-o pâine? ... Mă rog, de-o bere.', 'Bă, tu ești ăla de pe TikTok? Ăla cu 6-7?', 'Futu-i, ce cald e. Nici la Mamaia nu-i așa.',
  'Nu mă filma, coaie!', 'Știi unde e Dristor 2? Că eu sunt la Dristor 1 de 20 de minute.', 'Aoleu, ce ochelari! Ești de la ANAF?', 'Mă scuzați, sunteți din bloc? Că n-a mai venit apa caldă din martie.',
  'Hai, bă, că întârzii la muncă. Iar.', 'Six seven! ... Ce, nu știi? Ești bătrân.', 'Ce faci, bă, Câmpi? Te-am văzut aseară la shaorma. Ai dansat pe masă.', 'Doamne, iar au săpat pe Mihai Bravu.',
  'Parcarea asta e a mea, am pus găleată pe ea din 2009.', 'Ai auzit? Se face metrou până la Ploiești. Pe bune. Anu\' ăsta.', 'Mânca-ți-aș, ce frumos ești azi.', 'Pleacă, bă, de lângă mine că-mi iei semnalu\'.',
];
export const DOG_BITES = ['Te-a mușcat un maidanez! -5 lei (vaccin la farmacie)', 'Haita te-a prins! Ai rămas fără un adidas. -5 lei', 'MAIDANEZII! Fugi, bă!'];
export const CAR_HITS = ['Ți-a dat cu Logan-ul! -10 lei (să-i plătești oglinda)', 'BĂ, FII ATENT! Ai lovit un BMW cu fața. -10 lei', 'Te-a lovit o mașină de la Uber. N-avea nici 5 stele.'];

function pick(a) { return a[(Math.random() * a.length) | 0]; }
