// Quiz content. Points are [name, lat, lon, optional info shown after answering].
// Rivers come from MAP_DATA.rivers, island outlines from MAP_DATA.areas (both from OpenStreetMap).
// perRound: how many questions the main game asks per level (random pick). Practice asks all of them.
// fullKm: guesses closer than this get 100 points. zeroKm: guesses this far or more get 0.
window.LEVELS = [
  {
    id: 'big-cities', title: 'Veliki gradovi', perRound: 5, fullKm: 5, zeroKm: 80,
    items: [
      ['Zagreb', 45.815, 15.982], ['Split', 43.508, 16.440], ['Rijeka', 45.327, 14.442],
      ['Osijek', 45.555, 18.695], ['Zadar', 44.119, 15.231], ['Pula', 44.867, 13.850],
      ['Slavonski Brod', 45.160, 18.016], ['Karlovac', 45.487, 15.548], ['Varaždin', 46.304, 16.338],
      ['Šibenik', 43.735, 15.889], ['Dubrovnik', 42.650, 18.094], ['Sisak', 45.466, 16.378],
    ],
  },
  {
    id: 'small-cities', title: 'Manji gradovi', perRound: 5, fullKm: 5, zeroKm: 70,
    items: [
      ['Vukovar', 45.351, 19.002], ['Bjelovar', 45.899, 16.843], ['Koprivnica', 46.162, 16.828],
      ['Čakovec', 46.384, 16.434], ['Požega', 45.340, 17.685], ['Vinkovci', 45.288, 18.805],
      ['Gospić', 44.546, 15.375], ['Virovitica', 45.832, 17.384], ['Makarska', 43.297, 17.017],
      ['Poreč', 45.227, 13.595], ['Rovinj', 45.081, 13.639], ['Krapina', 46.161, 15.879],
      ['Knin', 44.041, 16.199], ['Senj', 44.989, 14.906], ['Đakovo', 45.308, 18.411],
      ['Nova Gradiška', 45.255, 17.383], ['Metković', 43.054, 17.648], ['Opatija', 45.338, 14.305],
      ['Trogir', 43.516, 16.251], ['Samobor', 45.803, 15.711], ['Velika Gorica', 45.712, 16.076],
      ['Kutina', 45.475, 16.782], ['Pazin', 45.240, 13.937], ['Ogulin', 45.266, 15.229],
      ['Imotski', 43.447, 17.216], ['Sinj', 43.703, 16.639],
    ],
  },
  {
    id: 'rivers', title: 'Rijeke', perRound: 5, fullKm: 3, zeroKm: 50,
    rivers: ['Sava', 'Drava', 'Dunav', 'Kupa', 'Una', 'Mura', 'Neretva',
      'Krka', 'Cetina', 'Korana', 'Mrežnica', 'Dobra', 'Zrmanja', 'Lika', 'Gacka',
      'Bosut', 'Vuka', 'Mirna', 'Raša', 'Rječina', 'Glina', 'Lonja', 'Bednja', 'Česma',
      'Ilova', 'Orljava', 'Karašica', 'Odra'],
  },
  {
    // Each mountain is a band along its ridge (MAP_DATA.ranges); any tap within fullKm of the ridge
    // is a hit. The point is its highest peak, from OpenStreetMap (natural=peak).
    id: 'mountains', title: 'Planine', perRound: 5, fullKm: 5, zeroKm: 60, ranges: true,
    items: [
      ['Dinara', 44.0625, 16.3829, 'vrh Dinara, 1831 m, najviši vrh Hrvatske'], ['Velebit', 44.3673, 15.5046, 'najviši vrh Vaganski vrh, 1758 m'], ['Biokovo', 43.3420, 17.0538, 'najviši vrh Sveti Jure, 1762 m'],
      ['Učka', 45.2850, 14.2020, 'najviši vrh Vojak, 1401 m'], ['Risnjak', 45.4315, 14.6214, 'najviši vrh Veliki Risnjak, 1528 m'], ['Medvednica', 45.8993, 15.9474, 'najviši vrh Sljeme, 1033 m'],
      ['Mosor', 43.5271, 16.6374, 'najviši vrh Veliki Kabal, 1339 m'], ['Papuk', 45.5224, 17.6033, 'najviši vrh, 953 m'], ['Psunj', 45.3859, 17.3321, 'najviši vrh Brezovo polje, 984 m'],
      ['Žumberačka gora', 45.7598, 15.3182, 'najviši vrh Sveta Gera, 1178 m'], ['Kalnik', 46.1313, 16.4547, 'najviši vrh Vranilac, 643 m'], ['Ivanščica', 46.1814, 16.1272, 'najviši vrh, 1061 m'],
      ['Bjelolasica', 45.2734, 14.9615, 'najviši vrh Kula, 1534 m'], ['Svilaja', 43.7906, 16.4849, 'najviši vrh, 1509 m'],
    ],
  },
  {
    // Official park borders from OpenStreetMap (MAP_DATA.parks); a tap inside the park is a hit.
    id: 'national-parks', title: 'Nacionalni parkovi', perRound: 5, fullKm: 1, zeroKm: 50, areaSet: 'parks',
    areas: ['Plitvička jezera', 'Krka', 'Kornati', 'Mljet', 'Brijuni', 'Paklenica', 'Risnjak', 'Sjeverni Velebit'],
  },
  {
    // Tapping anywhere on the island counts as a hit.
    id: 'islands', title: 'Otoci', perRound: 5, fullKm: 1, zeroKm: 40,
    areas: ['Krk', 'Cres', 'Brač', 'Hvar', 'Pag', 'Korčula', 'Dugi otok', 'Mljet', 'Rab', 'Vis',
      'Lošinj', 'Šolta', 'Pašman', 'Ugljan', 'Lastovo', 'Čiovo', 'Murter', 'Silba', 'Žirje', 'Iž',
      'Molat', 'Susak', 'Unije', 'Olib', 'Kornat', 'Biševo', 'Šipan', 'Lopud', 'Zlarin'],
  },
];
